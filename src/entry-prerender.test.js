// @vitest-environment jsdom
// Phase 6 (ADM-1079): the public pages are rendered at build time, and main.js replaces that markup with the
// app's own first render. Both must be the same tree, or the swap shifts the layout (CLS is a CI gate).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

// No network: the pages' onMounted calls (the signed-in user, social sign-in buttons) get an empty answer.
vi.mock('./services/api', () => {
  const call = () => Promise.resolve({ data: {} })
  // Not `then`: a proxy answering every name would read as a promise and never settle.
  return { default: new Proxy({}, { get: (_, name) => (name === 'then' || typeof name === 'symbol' ? undefined : call) }) }
})

import App from './app.vue'
import { render, prerenderedRoutes, redirectsSignedIn } from './entry-prerender'

const HEADINGS = {
  '/': 'The Aadml OS for',
  '/features': 'One platform. Every capability an agent needs.',
  '/pricing': 'Pay only for what you use',
  '/login': 'That Work For You',
  '/signup': 'That Work For You',
}

// The structure that decides layout: elements, their attributes (any order) and text. Comments (Vue's
// fragment and v-if markers on the server) and whitespace-only text are not laid out.
function shape(node) {
  if (node.nodeType === 3) return node.textContent.trim() ? { text: node.textContent } : null
  if (node.nodeType !== 1) return null
  const attrs = [...node.attributes]
    // v-model: the server writes value="", the client sets the property. Same field either way.
    .filter((a) => !(a.name === 'value' && /^(input|textarea)$/i.test(node.tagName)))
    // Scoped-style ids: here the .vue files are compiled for the browser, so renderToString takes Vue's
    // fallback path, which does not copy a parent's id onto a child's root. The real prerender is an SSR
    // build with its own render functions; its ids are compared in the browser (ADM-1079 evidence).
    .filter((a) => !a.name.startsWith('data-v-'))
    // An empty style (Iconify's placeholder icon sets one in the DOM, the server leaves it out) styles nothing.
    .filter((a) => !(a.name === 'style' && !a.value.trim()))
    // Styles as the browser reads them: "z-index:1" and "z-index: 1", "#fff" and "rgb(255, 255, 255)" are one.
    .map((a) => `${a.name}=${a.name === 'style' && node.style ? node.style.cssText : a.value}`)
    .sort()
  const children = [...node.childNodes].map(shape).filter(Boolean)
  // Adjacent text nodes (the server joins them) compare as one.
  const merged = []
  for (const c of children) {
    const last = merged[merged.length - 1]
    if (c.text !== undefined && last && last.text !== undefined) last.text += c.text
    else merged.push(c)
  }
  return { tag: node.tagName.toLowerCase(), attrs, children: merged }
}

async function clientFirstRender(path) {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp(App)
  app.use(createPinia())
  app.directive('reveal', {}) // what keepOnScreenShown() leaves for an element on screen: nothing
  const router = createRouter({ history: createMemoryHistory(), routes: prerenderedRoutes })
  app.use(router)
  await router.push(path)
  await router.isReady()
  app.mount(root)
  const tree = shape(root.firstElementChild)
  return { tree, done: () => { app.unmount(); root.remove() } }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('prerendered public pages', () => {
  it('are the five public pages, and only / /login /signup send a signed-in person on', () => {
    expect(prerenderedRoutes.map((r) => r.path)).toEqual(['/', '/features', '/pricing', '/login', '/signup'])
    expect(prerenderedRoutes.filter(redirectsSignedIn).map((r) => r.path)).toEqual(['/', '/login', '/signup'])
  })

  for (const path of Object.keys(HEADINGS)) {
    it(`${path}: the server render is the client's first render, with the page's heading`, async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] }) // the landing page's typing terminal
      vi.stubEnv('SSR', true)
      const { html, meta } = await render(path)
      vi.unstubAllEnvs()

      expect(html).toContain(HEADINGS[path])
      if (path === '/pricing') expect(meta).toMatchObject({ title: 'Pricing — AADML' })
      if (path === '/login') expect(meta).toBeNull() // Login sets no title: the shell's own stays
      if (path === '/') expect(meta.jsonLd).toMatchObject({ '@type': 'SoftwareApplication' })

      const server = document.createElement('div')
      server.innerHTML = html
      const client = await clientFirstRender(path)
      try {
        expect(shape(server.firstElementChild)).toEqual(client.tree)
      } finally {
        client.done()
      }
    })
  }
})
