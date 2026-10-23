// Isolated browser test entry: production components, synthetic API responses, no user session.
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory, RouterView, useRoute } from 'vue-router'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import { addCollection } from '@iconify/vue'
import lucide from '@iconify-json/lucide/icons.json'
import WorkflowBuilder from '/src/views/WorkflowBuilder.vue'
import ConfirmDialog from '/src/components/ConfirmDialog.vue'
import '@fontsource-variable/inter'
import '/src/style.css'
addCollection(lucide)
const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/dashboard/workflow-builder/:id', component: WorkflowBuilder },
  { path: '/dashboard/workflow-builder', component: { render: () => h('h1', 'Workflows') } },
] })
const App = { setup() {
  const route = useRoute()
  return () => h('main', { class: 'workflow-test-root' }, [
    h(RouterView, {}, { default: ({ Component }) => Component ? h(Component, { key: route.path }) : null }),
    h(ConfirmDialog),
  ])
} }
const app = createApp(App).use(createPinia()).use(router).use(Toast, { timeout: 2500 })
await router.isReady()
app.mount('#app')
