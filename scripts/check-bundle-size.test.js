// Phase 6 (ADM-1079): the bundle-size budget reads what index.html loads up front.
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseEntryAssets, measure } from './check-bundle-size.mjs'

const HTML = `<!doctype html><html><head>
  <script type="module" crossorigin src="/assets/index-AbC123.js"></script>
  <link rel="modulepreload" crossorigin href="/assets/vue-core-1.js">
  <link rel=modulepreload href='/assets/vendor-2.js'>
  <link rel="stylesheet" crossorigin href="/assets/index-3.css">
  <link rel="icon" href="/favicon.ico">
  <link rel="preconnect" href="https://fonts.example.com">
  <link rel="modulepreload" href="https://cdn.example.com/x.js">
  <script src="/legacy.js"></script>
  <script type="application/ld+json">{}</script>
</head><body><div id="app"></div></body></html>`

describe('bundle size budget', () => {
  it('finds the module script, modulepreloads and stylesheets, skipping other origins and non-module scripts', () => {
    expect(parseEntryAssets(HTML)).toEqual({
      scripts: ['assets/index-AbC123.js'],
      modulepreloads: ['assets/vue-core-1.js', 'assets/vendor-2.js'],
      stylesheets: ['assets/index-3.css'],
    })
  })

  it('strips a non-root base and query strings', () => {
    const html = '<script type="module" src="/app/assets/a.js?v=1"></script><link rel="modulepreload" href="/app/assets/b.js">'
    expect(parseEntryAssets(html, '/app/')).toMatchObject({ scripts: ['assets/a.js'], modulepreloads: ['assets/b.js'] })
  })

  it('sums the entry JS gzipped, counts a file once and flags a build over budget', () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'bundle-'))
    mkdirSync(path.join(dist, 'assets'))
    writeFileSync(path.join(dist, 'index.html'),
      '<script type="module" src="/assets/a.js"></script><link rel="modulepreload" href="/assets/a.js">' +
      '<link rel="modulepreload" href="/assets/b.js"><link rel="stylesheet" href="/assets/a.css">')
    // Random-looking text barely compresses, so a few kB of it is a few kB gzipped.
    const noise = (n) => Array.from({ length: n }, (_, i) => ((i * 2654435761) >>> 0).toString(36)).join('')
    writeFileSync(path.join(dist, 'assets', 'a.js'), noise(800))
    writeFileSync(path.join(dist, 'assets', 'b.js'), 'export const b = 1\n')
    writeFileSync(path.join(dist, 'assets', 'a.css'), 'body{margin:0}')
    writeFileSync(path.join(dist, 'assets', 'lazy.css'), '.x{color:red}')

    const ok = measure(dist, { budgetKb: 200 })
    expect(ok.entry_js.files.map((f) => [f.file, f.kind])).toEqual([['assets/a.js', 'script'], ['assets/b.js', 'modulepreload']])
    expect(ok.entry_js.gzip_kb).toBeGreaterThan(1)
    expect(ok.over_budget).toBe(false)
    expect(ok.entry_css.files).toHaveLength(1)
    expect(ok.total_css.count).toBe(2)

    expect(measure(dist, { budgetKb: 1 }).over_budget).toBe(true)
    expect(ok.shell).toBe('index.html')
  })

  it('measures the shell (app.html) once the public pages are prerendered, not the home page', () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'bundle-'))
    mkdirSync(path.join(dist, 'assets'))
    const entry = '<script type="module" src="/assets/a.js"></script><link rel="stylesheet" href="/assets/a.css">'
    writeFileSync(path.join(dist, 'app.html'), entry)
    // The prerendered home page also links its own page stylesheet.
    writeFileSync(path.join(dist, 'index.html'), `${entry}<link rel="stylesheet" href="/assets/Landing.css">`)
    writeFileSync(path.join(dist, 'assets', 'a.js'), 'export const a = 1\n')
    writeFileSync(path.join(dist, 'assets', 'a.css'), 'body{margin:0}')
    writeFileSync(path.join(dist, 'assets', 'Landing.css'), '.hero{color:red}')

    const report = measure(dist, { budgetKb: 200 })
    expect(report.shell).toBe('app.html')
    expect(report.entry_js.files.map((f) => f.file)).toEqual(['assets/a.js'])
    expect(report.entry_css.files.map((f) => f.file)).toEqual(['assets/a.css'])
  })
})
