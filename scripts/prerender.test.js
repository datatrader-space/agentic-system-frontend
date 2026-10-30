// Phase 6 (ADM-1079): the public pages' HTML is written at build time into the shell's #app.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { bootScript, criticalCss, escapeHtml, outputFile, pageHtml, pageStylesheets } from './prerender.mjs'

const SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AADML — AI Agent Development & Management Layer</title>
  <meta name="description"
    content="Default description." />
  <meta property="og:title" content="AADML — AI Agent Development & Management Layer" />
  <meta property="og:description"
    content="Default description." />
  <script type="module" crossorigin src="/assets/index-a.js"></script>
  <link rel="stylesheet" crossorigin href="/assets/index-b.css">
</head>
<body>
  <div id="app"></div>
</body>
</html>`

const boot = (src, localStorage) => {
  const attrs = {}
  const listeners = {}
  const document = {
    documentElement: { setAttribute: (k, v) => { attrs[k] = v } },
    addEventListener: (type, fn, capture) => { listeners[type] = { fn, capture } },
  }
  new Function('document', 'localStorage', src)(document, localStorage)
  return { attrs, listeners }
}
const run = (src, storage) => boot(src, { getItem: (k) => (k in storage ? storage[k] : null) }).attrs

describe('prerender', () => {
  it('maps a route to its file under dist', () => {
    expect(outputFile('/')).toBe('index.html')
    expect(outputFile('/login')).toBe('login/index.html')
    expect(outputFile('/pricing/')).toBe('pricing/index.html')
  })

  it('puts the page inside #app, marked as prerendered, and keeps the shell around it', () => {
    const out = pageHtml(SHELL, { html: '<div id="app" class="min-h-screen"><h1>Pricing</h1></div>', meta: null })
    expect(out).toContain('<div id="app" data-prerendered><div id="app" class="min-h-screen"><h1>Pricing</h1></div></div>')
    expect(out).toContain('<script type="module" crossorigin src="/assets/index-a.js"></script>')
    expect(out).toContain('<title>AADML — AI Agent Development & Management Layer</title>')
    expect(out).toContain('content="Default description."')
  })

  it('keeps "$" sequences in the page as written', () => {
    const out = pageHtml(SHELL, { html: '<p>Top up from $5, $& and $1</p>', meta: { title: 'A $& B', description: '$1' } })
    expect(out).toContain('<p>Top up from $5, $& and $1</p>')
    expect(out).toContain('<title>A $&amp; B</title>')
  })

  it('writes the page title, description and JSON-LD, escaped', () => {
    const out = pageHtml(SHELL, {
      html: '<h1>x</h1>',
      meta: { title: 'Pricing — AADML', description: 'Pay "as you go" <now>', jsonLd: { name: '</script><b>' } },
    })
    expect(out).toContain('<title>Pricing — AADML</title>')
    expect(out).toContain('<meta name="description" content="Pay &quot;as you go&quot; &lt;now&gt;" />')
    expect(out).toContain('<meta property="og:title" content="Pricing — AADML" />')
    expect(out).toContain('<meta property="og:description" content="Pay &quot;as you go&quot; &lt;now&gt;" />')
    expect(out).not.toContain('Default description.')
    expect(out).toContain('<script type="application/ld+json" id="page-jsonld">{"name":"\\u003c/script>\\u003cb>"}</script>')
    expect(out).not.toContain('</script><b>')
  })

  it('runs the boot script before the stylesheets, and hides the page for a signed-in hint only where asked', () => {
    const shown = pageHtml(SHELL, { html: '<h1>x</h1>', meta: null, hideWhenSignedIn: false })
    expect(shown.indexOf('<script>(function')).toBeLessThan(shown.indexOf('<link rel="stylesheet"'))
    expect(shown).not.toContain('data-signed-in')

    const hidden = pageHtml(SHELL, { html: '<h1>x</h1>', meta: null, hideWhenSignedIn: true, hintKey: 'k' })
    expect(hidden).toContain('<style>[data-signed-in] #app[data-prerendered]{visibility:hidden}</style>')
    expect(() => pageHtml(SHELL, { html: '', meta: null, hideWhenSignedIn: true })).toThrow(/hint key/)
  })

  it('boot script: theme as useTheme sets it, and the sign-in attribute only with the hint', () => {
    const src = bootScript({ hideWhenSignedIn: true, hintKey: 'aadml_signed_in' })
    expect(run(src, {})).toEqual({ 'data-theme': 'light' })
    expect(run(src, { 'app-theme': 'dark' })).toEqual({ 'data-theme': 'dark' })
    expect(run(src, { 'app-theme': 'odd', aadml_signed_in: '1' })).toEqual({ 'data-theme': 'light', 'data-signed-in': '' })
    expect(run(bootScript({ hideWhenSignedIn: false }), { aadml_signed_in: '1' })).toEqual({ 'data-theme': 'light' })
  })

  it('boot script: blocked storage still gives the light theme and shows the page', () => {
    const src = bootScript({ hideWhenSignedIn: true, hintKey: 'k' })
    const blocked = { getItem: () => { throw new Error('SecurityError') } }
    expect(boot(src, blocked).attrs).toEqual({ 'data-theme': 'light' })
  })

  it('boot script: the browser does not submit a form of the prerendered page, only once the app has it', () => {
    const { listeners } = boot(bootScript({ hideWhenSignedIn: false }), { getItem: () => null })
    expect(listeners.submit.capture).toBe(true)
    const submit = (insidePrerendered) => {
      let prevented = false
      listeners.submit.fn({
        target: { closest: (sel) => (sel === '#app[data-prerendered]' && insidePrerendered ? {} : null) },
        preventDefault: () => { prevented = true },
      })
      return prevented
    }
    expect(submit(true)).toBe(true)
    expect(submit(false)).toBe(false)
  })

  it('refuses a shell that has no empty #app or no charset', () => {
    expect(() => pageHtml('<html><head><meta charset="UTF-8"></head><body></body></html>', { html: '', meta: null })).toThrow(/#app|app/)
    expect(() => pageHtml('<head></head><div id="app"></div>', { html: '', meta: null })).toThrow(/charset/)
  })

  it("links the stylesheets of the modules the page rendered, once, and not the shell's own", () => {
    const manifest = {
      'src/views/Pricing.vue': ['/assets/Pricing-a.js', '/assets/Pricing-b.css'],
      'src/components/public/PublicLayout.vue': ['/assets/PublicLayout-c.js', '/assets/PublicLayout-d.css'],
      'src/components/public/HeroBackdrop.vue': ['/assets/PublicLayout-c.js', '/assets/PublicLayout-d.css'],
      'src/main.js': ['/assets/index-a.js', '/assets/index-b.css'],
      'src/views/Login.vue': ['/assets/Login-e.css'],
    }
    const modules = ['src/views/Pricing.vue', 'src/components/public/PublicLayout.vue',
      'src/components/public/HeroBackdrop.vue', 'src/main.js', 'src/unknown.vue']
    const sheets = pageStylesheets(manifest, modules, SHELL)
    expect(sheets).toEqual(['/assets/Pricing-b.css', '/assets/PublicLayout-d.css'])

    const out = pageHtml(SHELL, { html: '<h1>x</h1>', meta: null, stylesheets: sheets })
    expect(out.indexOf('href="/assets/index-b.css"')).toBeLessThan(out.indexOf('href="/assets/Pricing-b.css"'))
    const link = out.indexOf('<link rel="stylesheet" crossorigin href="/assets/PublicLayout-d.css">')
    expect(link).toBeGreaterThan(-1)
    expect(link).toBeLessThan(out.indexOf('</head>'))
    expect(out.match(/Pricing-b\.css/g)).toHaveLength(1)
  })

  it('inlines the CSS the page uses, loads the stylesheet without blocking, and leaves the CSS file as it was', async () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'prerender-css-'))
    try {
      const css = '[data-theme=light]{--ink:#111}[data-theme=dark]{--ink:#eee}.hero{color:red}.unused-rule{color:blue}'
      mkdirSync(path.join(dist, 'assets'))
      writeFileSync(path.join(dist, 'assets', 'index-b.css'), css)
      const page = pageHtml(SHELL, { html: '<h1 class="hero">x</h1>', meta: null })
      const out = await (await criticalCss(dist)).process(page)

      const head = out.slice(0, out.indexOf('</head>'))
      expect(head).toMatch(/<style>[^<]*\.hero\{color:red\}/)
      expect(head).not.toContain('unused-rule')
      // Set by the boot script in the browser only, so kept although nothing in the built page matches them.
      expect(head).toContain('[data-theme=light]{--ink:#111}')
      expect(head).toContain('[data-theme=dark]{--ink:#eee}')
      // The whole sheet still arrives, without blocking the first paint, and without script through <noscript>.
      expect(out).toMatch(/<link rel="stylesheet"[^>]*href="\/assets\/index-b\.css"[^>]*media="print"/)
      expect(out).toMatch(/<noscript><link rel="stylesheet"[^>]*href="\/assets\/index-b\.css"/)
      expect(out.indexOf('<script>(function')).toBeLessThan(out.indexOf('<style>'))
      expect(out).toContain('<div id="app" data-prerendered><h1 class="hero">x</h1></div>')
      expect(readFileSync(path.join(dist, 'assets', 'index-b.css'), 'utf8')).toBe(css)
    } finally {
      rmSync(dist, { recursive: true, force: true })
    }
  })

  it('escapes &, <, > and double quotes', () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
  })
})
