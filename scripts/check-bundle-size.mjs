#!/usr/bin/env node
// Bundle-size budget (page-speed plan Phase 6, ADM-1079; report: Phase 0, ADM-1072).
//
//   node scripts/check-bundle-size.mjs [--dist dist] [--budget-kb 200] [--json dist-report/bundle-size.json]
//
// "Entry JS" is what the app's shell makes the browser fetch before any lazy route runs: the
// <script type="module" src> plus every <link rel="modulepreload">. Vite writes one modulepreload per
// chunk in the entry's static import graph, so their sum is the first-load JS. It is measured gzipped
// (zlib level 9; nginx serves level 5, so production bytes are a little larger), in kB of 1000 bytes,
// the unit `vite build` prints. Over the budget the script exits 1, which fails the CI build.
// CSS is reported (the entry's stylesheets and all CSS in the build) but not budgeted.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_BUDGET_KB = 200

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return m ? (m[1] ?? m[2] ?? m[3]) : null
}

// The files index.html loads up front, in document order, as paths relative to the dist root.
// External URLs (another origin) are not part of this build and are skipped.
export function parseEntryAssets(html, base = '/') {
  const scripts = []
  const modulepreloads = []
  const stylesheets = []
  const local = (url) => {
    if (!url || /^([a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.startsWith('data:')) return null
    let p = url.split(/[?#]/)[0]
    if (base !== '/' && p.startsWith(base)) p = p.slice(base.length)
    return p.replace(/^\.?\//, '')
  }
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    if ((attr(tag, 'type') || '').toLowerCase() !== 'module') continue
    const p = local(attr(tag, 'src'))
    if (p) scripts.push(p)
  }
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(tag, 'rel') || '').toLowerCase().split(/\s+/)
    const p = local(attr(tag, 'href'))
    if (!p) continue
    if (rel.includes('modulepreload')) modulepreloads.push(p)
    else if (rel.includes('stylesheet')) stylesheets.push(p)
  }
  return { scripts, modulepreloads, stylesheets }
}

const sizeOf = (file) => {
  const buf = readFileSync(file)
  return { raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length }
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name)
  return statSync(full).isDirectory() ? walk(full) : [full]
})

const kb = (bytes) => Math.round(bytes / 10) / 100

// The shell: dist/app.html once scripts/prerender.mjs has run (index.html is then the prerendered home page, whose
// extra stylesheets belong to that page), else dist/index.html as Vite wrote it. Both load the same entry JS.
export function shellFile(distDir) {
  return existsSync(path.join(distDir, 'app.html')) ? 'app.html' : 'index.html'
}

export function measure(distDir, { budgetKb = DEFAULT_BUDGET_KB, base = '/' } = {}) {
  const shell = shellFile(distDir)
  const html = readFileSync(path.join(distDir, shell), 'utf8')
  const entry = parseEntryAssets(html, base)
  const row = (kind) => (file) => ({ file, kind, ...sizeOf(path.join(distDir, file)) })
  // A chunk named twice (script AND modulepreload) is downloaded once, so it is counted once.
  const jsFiles = [...new Set([...entry.scripts, ...entry.modulepreloads])]
  const entryJs = jsFiles.map((f) => row(entry.scripts.includes(f) ? 'script' : 'modulepreload')(f))
  const entryCss = entry.stylesheets.map(row('stylesheet'))
  const sum = (rows, k) => rows.reduce((n, r) => n + r[k], 0)

  // Every stylesheet in the build, lazy routes and the Training Data page included.
  const allCss = walk(distDir).filter((f) => f.endsWith('.css'))
    .map((f) => ({ file: path.relative(distDir, f).split(path.sep).join('/'), ...sizeOf(f) }))

  const entryJsGzip = sum(entryJs, 'gzip')
  return {
    unit: 'kB = 1000 bytes; gzip = zlib level 9',
    shell,
    budget_kb_gzip: budgetKb,
    entry_js: { files: entryJs, raw_kb: kb(sum(entryJs, 'raw')), gzip_kb: kb(entryJsGzip) },
    entry_css: { files: entryCss, raw_kb: kb(sum(entryCss, 'raw')), gzip_kb: kb(sum(entryCss, 'gzip')) },
    total_css: { count: allCss.length, raw_kb: kb(sum(allCss, 'raw')), gzip_kb: kb(sum(allCss, 'gzip')) },
    over_budget: entryJsGzip > budgetKb * 1000,
  }
}

function args(argv) {
  const out = { dist: 'dist', budgetKb: DEFAULT_BUDGET_KB, json: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dist') out.dist = argv[++i]
    else if (argv[i] === '--budget-kb') out.budgetKb = Number(argv[++i])
    else if (argv[i] === '--json') out.json = argv[++i]
    else throw new Error(`unknown argument: ${argv[i]}`)
  }
  if (!(out.budgetKb > 0)) throw new Error('--budget-kb must be a positive number')
  return out
}

function main() {
  const opts = args(process.argv.slice(2))
  const report = measure(opts.dist, { budgetKb: opts.budgetKb })
  const line = (r) => `  ${String(kb(r.gzip)).padStart(8)} kB gz  ${String(kb(r.raw)).padStart(9)} kB  ${r.kind.padEnd(13)} ${r.file}`
  console.log(`Entry JS (${report.shell} script + modulepreloads):`)
  report.entry_js.files.forEach((r) => console.log(line(r)))
  console.log(`  total ${report.entry_js.gzip_kb} kB gzip (${report.entry_js.raw_kb} kB raw); budget ${opts.budgetKb} kB gzip`)
  console.log(`Entry CSS: ${report.entry_css.gzip_kb} kB gzip (${report.entry_css.raw_kb} kB raw), ${report.entry_css.files.length} file(s)`)
  console.log(`All CSS in the build: ${report.total_css.gzip_kb} kB gzip (${report.total_css.raw_kb} kB raw), ${report.total_css.count} file(s)`)
  if (opts.json) {
    mkdirSync(path.dirname(path.resolve(opts.json)), { recursive: true })
    writeFileSync(opts.json, JSON.stringify(report, null, 2) + '\n')
  }
  if (report.entry_js.files.length === 0) {
    console.error(`!! no entry script found in ${report.shell}: the parser and the build disagree`)
    process.exit(1)
  }
  if (report.over_budget) {
    console.error(`!! entry JS is ${report.entry_js.gzip_kb} kB gzip, over the ${opts.budgetKb} kB budget`)
    process.exit(1)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
