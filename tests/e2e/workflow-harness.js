// Isolated browser test entry for the Workflow Builder (ADM-1333): the production builder mounted INSIDE the
// production AppShell, so the shell's own behaviour on this route is covered (breadcrumbs, help button, sidebar,
// page scroll, the shell's Ctrl+K). Synthetic API responses only, no user session.
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory, RouterView } from 'vue-router'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import { addCollection } from '@iconify/vue'
import lucide from '@iconify-json/lucide/icons.json'
import AppShell from '/src/components/app-shell/AppShell.vue'
import WorkflowBuilder from '/src/views/WorkflowBuilder.vue'
import WorkflowTablesPage from '/src/views/WorkflowTablesPage.vue'
import DatabaseConnectionsSection from '/src/components/connectors/DatabaseConnectionsSection.vue'
import ConfirmDialog from '/src/components/ConfirmDialog.vue'
import '@fontsource-variable/inter'
import '/src/style.css'

addCollection(lucide)
const Page = (title) => ({ render: () => h('div', { style: 'padding:24px' }, [h('h1', title)]) })
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/dashboard', component: AppShell, children: [
        { path: '', name: 'dashboard-home', component: Page('Home') },
        { path: 'workflow-builder', name: 'dashboard-workflow-builder', component: Page('Workflows') },
        { path: 'workflow-builder/:id', name: 'dashboard-workflow-canvas', component: WorkflowBuilder },
        { path: 'workflow-runs', name: 'dashboard-workflow-runs', component: Page('Workflow runs') },
        // ADM-1363: the Data steps link to the Tables page and to Settings > Connectors > Databases.
        { path: 'workflow-tables', name: 'dashboard-workflow-tables', component: WorkflowTablesPage },
        { path: 'workflow-tables/:id', name: 'dashboard-workflow-table', component: WorkflowTablesPage },
        { path: 'connectors', name: 'dashboard-connectors', component: { render: () => h('div', { style: 'padding:24px' }, [h(DatabaseConnectionsSection)]) } },
        { path: 'settings/:tab', name: 'dashboard-settings', component: Page('Settings') },
      ],
    },
  ],
})
const App = { setup: () => () => h('div', { class: 'workflow-test-root' }, [h(RouterView), h(ConfirmDialog)]) }
const app = createApp(App).use(createPinia()).use(router).use(Toast, { timeout: 2500 })
await router.isReady()
app.mount('#app')
window.__wfHarnessReady = true
