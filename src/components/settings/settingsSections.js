import { defineAsyncComponent } from 'vue'
import { Settings, Brain, Bot, Gauge, Box, CreditCard, ShieldCheck, Bell, SlidersHorizontal, Plug, Blocks } from 'lucide-vue-next'

// One catalog for the full settings page and its compact modal. Components retain their existing API and permissions.
export const SETTINGS_SECTIONS = [
  { key: 'general', label: 'General', group: 'Preferences', icon: Settings, search: 'appearance theme account name email profile training data tour', component: defineAsyncComponent(() => import('./GeneralSettings.vue')) },
  { key: 'notifications', label: 'Notifications', group: 'Preferences', icon: Bell, search: 'email alerts updates approvals', component: defineAsyncComponent(() => import('./NotificationSettings.vue')) },
  { key: 'providers', label: 'AI Providers', group: 'Workspace', icon: Bot, search: 'models api keys ollama openai anthropic endpoints', component: defineAsyncComponent(() => import('../../views/LLMSettings.vue')) },
  { key: 'connectors', label: 'Connectors', group: 'Workspace', icon: Plug, search: 'tools services mcp oauth credentials connected apps skills', modalProps: { compact: true }, component: defineAsyncComponent(() => import('../../views/ConnectorsPage.vue')) },
  { key: 'integrations', label: 'Integrations', group: 'Workspace', icon: Blocks, search: 'agents channels websocket webhook widget mcp clients chatgpt claude', modalProps: { compact: true }, component: defineAsyncComponent(() => import('../../views/IntegrationsPage.vue')) },
  { key: 'memory', label: 'Memory', group: 'Workspace', icon: Brain, search: 'context history summaries memories', component: defineAsyncComponent(() => import('./MemorySettings.vue')) },
  { key: 'sandboxes', label: 'Sandboxes', group: 'Workspace', icon: Box, search: 'execution cloud computers machines', component: defineAsyncComponent(() => import('../../views/SandboxesPage.vue')) },
  { key: 'usage', label: 'Usage', group: 'Account', icon: Gauge, search: 'cost tokens requests analytics', component: defineAsyncComponent(() => import('../../views/UsagePage.vue')) },
  { key: 'billing', label: 'Billing', group: 'Account', icon: CreditCard, search: 'plans subscription payment invoices', component: defineAsyncComponent(() => import('../../views/Billing.vue')) },
  { key: 'security', label: 'Security', group: 'Account', icon: ShieldCheck, search: 'password session sign out verification two factor 2fa authentication', component: defineAsyncComponent(() => import('./SecuritySettings.vue')) },
  { key: 'advanced', label: 'Advanced', group: 'Account', icon: SlidersHorizontal, search: 'reset layout clear local data about', component: defineAsyncComponent(() => import('./AdvancedSettings.vue')) },
]
