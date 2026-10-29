// Server-side render of the prerendered public pages (scripts/prerender.mjs builds this with `vite build --ssr`).
//
// It renders the same App, route records, plugins and directive main.js uses, so the markup is the app's own
// first render of the page: main.js replaces it with an identical tree, without a layout shift. Only what that
// first render shows is here: onMounted work (API calls, timers, analytics, the cookie banner, icon data)
// never runs on the server, so each page shows its built-in content, as it does before its data arrives.
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { renderToString } from 'vue/server-renderer'
import App from './app.vue'
import reveal from './directives/reveal'
import { prerenderedRoutes, redirectsSignedIn, SIGNED_IN_HINT_KEY } from './prerenderedPages'

export { prerenderedRoutes, redirectsSignedIn, SIGNED_IN_HINT_KEY }

/**
 * The page at `path` as HTML for the inside of #app, what its useMeta() asked for (null when none), and the source
 * modules it rendered (@vitejs/plugin-vue records them), to find the page's stylesheets in the client build.
 */
export async function render(path) {
  const app = createSSRApp(App)
  app.use(createPinia())
  app.directive('reveal', reveal)
  app.provide('notify', () => {})
  const router = createRouter({ history: createMemoryHistory(), routes: prerenderedRoutes })
  app.use(router)
  await router.push(path)
  await router.isReady()
  const context = {}
  const html = await renderToString(app, context)
  return { html, meta: context.meta || null, modules: [...(context.modules || [])] }
}
