#!/usr/bin/env node
// Prerendered public pages (page-speed plan Phase 6, ADM-1079).
//
//   node scripts/prerender.mjs        (after `vite build`; `npm run build` runs both)
//
// dist/index.html from Vite is an empty shell: nothing paints until the entry JS and CSS have loaded and run, so
// Largest Contentful Paint on the public pages was 2.8-3.3 s on CI's simulated phone, 2.3-2.9 s of it render
// delay. This script renders those pages with Node only (a `vite build --ssr` of src/entry-prerender.js and
// vue/server-renderer, no browser: the image build has none) and writes each one into the shell's #app:
//
//   /          -> dist/index.html          /login  -> dist/login/index.html
//   /features  -> dist/features/index.html /signup -> dist/signup/index.html
//   /pricing   -> dist/pricing/index.html
//
// The shell itself is kept as dist/app.html: nginx serves it for every other route of the app.
// main.js mounts over the markup once the route has resolved (data-prerendered on #app tells it to).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const SHELL_FILE = 'app.html'
const APP_ROOT = '<div id="app"></div>'

// The CSS a prerendered page's markup uses, inlined, and its stylesheets loaded without blocking the first paint:
// on CI's simulated phone the ~25 kB of render-blocking CSS was all that stood before the heading (LCP 3.1-3.5 s with
// the HTML already in the response). The CSS files are left as they are (pruneSource: false): the app shares them.
// The page's @font-face rules are inlined with it (Inter is self-hosted, its rules sit in index.css): left in the
// late sheet, the font would start downloading only after it and the text would reflow when it swaps in. Beasties
// preloads none of them (that would be every unicode-range subset): the Latin file alone is preloaded, see
// latinFontFile. The rest of the CSS still arrives through each <link>, with a <noscript> fallback.
// The theme's colour variables sit under [data-theme=light] / [data-theme=dark], which the boot script sets only in
// the browser: matched against the built page they would be dropped and the first paint would have no colours.
export async function criticalCss(dist) {
  const { default: Beasties } = await import('beasties')
  return new Beasties({ path: dist, publicPath: '/', preload: 'media', pruneSource: false, inlineFonts: true, preloadFonts: false,
                        reduceInlineStyles: false, allowRules: [/\[data-theme=/], logLevel: 'warn' })
}

// The Latin subset of Inter (~48 kB), which every prerendered page's text uses. Found only once the CSS has
// matched the page, the font arrived after the first paint on a cold visit: the text painted in the fallback, then
// re-laid out larger when Inter swapped in, and Chrome counted that later paint as the LCP (live, /: first paint
// 3.2 s, Inter 3.56 s, LCP 3.87 s). Preloaded, it downloads with the page.
export const LATIN_FONT = /^inter-latin-wght-normal-[\w-]+\.woff2$/

export function latinFontFile(dist) {
  const files = readdirSync(path.join(dist, 'assets')).filter((name) => LATIN_FONT.test(name))
  if (files.length !== 1) throw new Error(`expected one Latin Inter file in dist/assets, found ${files.length}`)
  return `/assets/${files[0]}`
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Where the page for a route path is written, relative to dist. */
export function outputFile(routePath) {
  const clean = routePath.replace(/^\/+|\/+$/g, '')
  return clean ? `${clean}/index.html` : 'index.html'
}

// Runs before the body is parsed, so the first paint already looks like the app's first render:
// - data-theme as useTheme sets it (light unless dark was chosen), which the CSS variables read;
// - on a page that sends a signed-in person on to /dashboard, data-signed-in when the sign-in hint is set
//   (src/prerenderedPages.js): the page then stays hidden until the app has taken over, instead of flashing.
//   A signed-out visitor has no hint and sees the page at once;
// - a form on the page is not submitted by the browser before the app has taken over (that would reload the page,
//   or put its fields in the URL): what was typed is kept and the app handles the submit (main.js).
export function bootScript({ hideWhenSignedIn, hintKey }) {
  const hint = hideWhenSignedIn
    ? `if(get(${JSON.stringify(hintKey)}))d.setAttribute('data-signed-in','');`
    : ''
  return '(function(){var d=document.documentElement;'
    + 'function get(k){try{return localStorage.getItem(k)}catch(e){return null}}'
    + `d.setAttribute('data-theme',get('app-theme')==='dark'?'dark':'light');${hint}`
    + "document.addEventListener('submit',function(e){var t=e.target;"
    + "if(t&&t.closest&&t.closest('#app[data-prerendered]'))e.preventDefault()},true)})()"
}

function setMeta(html, attr, name, content) {
  const tag = `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`
  const existing = new RegExp(`<meta\\s+${attr}="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'i')
  return existing.test(html) ? html.replace(existing, () => tag) : html.replace('</head>', () => `  ${tag}\n</head>`)
}

/**
 * The stylesheets a page needs beyond the shell's own: the CSS files of the client build that hold the source
 * modules the page rendered (`modules` from the SSR context, `manifest` = dist/.vite/ssr-manifest.json). A page's
 * own styles live in its lazy route chunk, which the browser would fetch only once main.js runs: without these
 * links the prerendered markup paints unstyled and moves when they arrive. Vite's preload helper later finds the
 * <link>s by href and does not add them a second time.
 */
export function pageStylesheets(manifest, modules, template) {
  const files = new Set()
  for (const id of modules) {
    for (const file of manifest[id] || []) {
      if (file.endsWith('.css') && !template.includes(`href="${file}"`)) files.add(file)
    }
  }
  return [...files]
}

/**
 * The shell with one page in it. `html` is the inside of #app, `meta` what the page's useMeta() set (null: the
 * shell's own title and description stay, as they do in the browser for a page without useMeta).
 */
export function pageHtml(template, { html, meta, hideWhenSignedIn, hintKey, stylesheets = [], fonts = [], teleports = {} }) {
  if (!template.includes(APP_ROOT)) throw new Error(`the template has no empty ${APP_ROOT}`)
  if (hideWhenSignedIn && !hintKey) throw new Error('hideWhenSignedIn needs the sign-in hint key')
  let out = template.replace(APP_ROOT, () => `<div id="app" data-prerendered>${html}</div>`)
  // A <Teleport to="body"> is hydrated from body's FIRST child: Vue expects its "teleport start anchor" there and
  // the content after it. Without it, hydration took #app itself for the teleport's content and removed the page.
  // So the markup goes straight after <body>, with no whitespace in between. Only body is a target here.
  const targets = Object.keys(teleports)
  if (targets.some((t) => t !== 'body')) throw new Error(`teleport targets other than body: ${targets.join(', ')}`)
  if (teleports.body) {
    const body = /<body[^>]*>/i
    if (!body.test(out)) throw new Error('the template has no <body>')
    out = out.replace(body, (tag) => `${tag}${teleports.body}`)
  }
  if (stylesheets.length) {
    // After the shell's own stylesheets, in the order Vite appends them at runtime.
    const links = stylesheets.map((href) => `  <link rel="stylesheet" crossorigin href="${escapeHtml(href)}">\n`).join('')
    out = out.replace('</head>', () => `${links}</head>`)
  }

  let head = `<script>${bootScript({ hideWhenSignedIn, hintKey })}</script>`
  if (hideWhenSignedIn) head += '\n  <style>[data-signed-in] #app[data-prerendered]{visibility:hidden}</style>'
  // A font is fetched in CORS mode, so its preload carries crossorigin or the browser downloads it twice.
  for (const href of fonts) head += `\n  <link rel="preload" as="font" type="font/woff2" crossorigin href="${escapeHtml(href)}">`
  // Straight after the charset, ahead of the stylesheets: an inline script after a stylesheet waits for it.
  const charset = /<meta\s+charset=[^>]*>/i
  if (!charset.test(out)) throw new Error('the template has no <meta charset>')
  out = out.replace(charset, (tag) => `${tag}\n  ${head}`)

  if (meta) {
    out = out.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(meta.title)}</title>`)
    out = setMeta(out, 'name', 'description', meta.description)
    out = setMeta(out, 'property', 'og:title', meta.title)
    out = setMeta(out, 'property', 'og:description', meta.description)
    if (meta.jsonLd) {
      // id="page-jsonld" is the element useMeta() updates in the browser, so the page keeps one copy.
      const json = JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')
      out = out.replace('</head>', () => `  <script type="application/ld+json" id="page-jsonld">${json}</script>\n</head>`)
    }
  }
  return out
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const dist = path.join(root, 'dist')
  const ssrDir = path.join(root, 'node_modules', '.cache', 'prerender')
  const indexFile = path.join(dist, 'index.html')
  const shellFile = path.join(dist, SHELL_FILE)
  const manifestDir = path.join(dist, '.vite')
  const manifestFile = path.join(manifestDir, 'ssr-manifest.json')
  if (!existsSync(manifestFile)) throw new Error('dist/.vite/ssr-manifest.json is missing: run `vite build` first')
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))

  // Run twice on one build, index.html is already the home page: start again from the kept shell.
  let template = readFileSync(indexFile, 'utf8')
  if (template.includes('data-prerendered')) template = readFileSync(shellFile, 'utf8')
  else writeFileSync(shellFile, template)

  const { build } = await import('vite')
  await build({
    root,
    configFile: path.join(root, 'vite.config.js'),
    logLevel: 'warn',
    build: { ssr: 'src/entry-prerender.js', outDir: ssrDir, emptyOutDir: true, copyPublicDir: false, minify: false },
  })
  try {
    const entry = await import(pathToFileURL(path.join(ssrDir, 'entry-prerender.js')).href)
    const inliner = await criticalCss(dist)
    const fonts = [latinFontFile(dist)]
    for (const route of entry.prerenderedRoutes) {
      const { html, meta, modules, teleports } = await entry.render(route.path)
      const file = path.join(dist, outputFile(route.path))
      mkdirSync(path.dirname(file), { recursive: true })
      const page = await inliner.process(pageHtml(template, {
        html,
        meta,
        hideWhenSignedIn: entry.redirectsSignedIn(route),
        hintKey: entry.SIGNED_IN_HINT_KEY,
        stylesheets: pageStylesheets(manifest, modules, template),
        fonts,
        teleports,
      }))
      writeFileSync(file, page)
      console.log(`prerendered ${route.path.padEnd(10)} -> dist/${outputFile(route.path)} (${(html.length / 1000).toFixed(1)} kB markup, ${(page.length / 1000).toFixed(1)} kB page)`)
    }
  } finally {
    rmSync(ssrDir, { recursive: true, force: true })
    // The manifest lists the source tree: it is read here and never served.
    rmSync(manifestDir, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
