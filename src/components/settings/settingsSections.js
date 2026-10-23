// lazyComponent = defineAsyncComponent + error state + one guarded reload for a stale chunk (F-C1).
import { lazyComponent } from '@/utils/lazyComponent'
import { Settings, Brain, Bot, Gauge, Box, CreditCard, ShieldCheck, Bell, SlidersHorizontal, Plug, Blocks, Building2, Wallet } from 'lucide-vue-next'

// One catalog for the full settings page and its compact modal. Components retain their existing API and permissions.
export const SETTINGS_SECTIONS = [
  { key: 'general', label: 'General', group: 'Preferences', icon: Settings, search: 'appearance theme account name email profile training data tour', component: lazyComponent(() => import('./GeneralSettings.vue')) },
  { key: 'notifications', label: 'Notifications', group: 'Preferences', icon: Bell, search: 'email alerts updates approvals', component: lazyComponent(() => import('./NotificationSettings.vue')) },
  { key: 'organization', label: 'Organization', group: 'Workspace', icon: Building2, search: 'organization workspace team members invitations roles access policies activity', fullPage: '/dashboard/organization', modalProps: { compact: true }, component: lazyComponent(() => import('../../views/OrganizationPage.vue')) },
  { key: 'providers', label: 'AI Providers', group: 'Workspace', icon: Bot, search: 'models api keys ollama openai anthropic endpoints', component: lazyComponent(() => import('../../views/LLMSettings.vue')) },
  { key: 'connectors', label: 'Connectors', group: 'Workspace', icon: Plug, search: 'tools services mcp oauth credentials connected apps skills', modalProps: { compact: true }, component: lazyComponent(() => import('../../views/ConnectorsPage.vue')) },
  { key: 'integrations', label: 'Integrations', group: 'Workspace', icon: Blocks, search: 'agents channels websocket webhook widget mcp clients chatgpt claude', modalProps: { compact: true }, component: lazyComponent(() => import('../../views/IntegrationsPage.vue')) },
  { key: 'memory', label: 'Memory', group: 'Workspace', icon: Brain, search: 'context history summaries memories', component: lazyComponent(() => import('./MemorySettings.vue')) },
  { key: 'sandboxes', label: 'Sandboxes', group: 'Workspace', icon: Box, search: 'execution cloud computers machines', component: lazyComponent(() => import('../../views/SandboxesPage.vue')) },
  { key: 'usage', label: 'Usage', group: 'Usage & billing', icon: Gauge, search: 'cost tokens requests analytics', component: lazyComponent(() => import('../../views/UsagePage.vue')) },
  { key: 'budgets', label: 'Budgets', group: 'Usage & billing', icon: Wallet, search: 'spending limits rules alerts approvals export presets reports', fullPage: '/dashboard/budgets', modalProps: { compact: true }, component: lazyComponent(() => import('../../views/BudgetsPage.vue')) },
  { key: 'billing', label: 'Billing', group: 'Usage & billing', icon: CreditCard, search: 'plans subscription payment invoices', component: lazyComponent(() => import('../../views/Billing.vue')) },
  { key: 'security', label: 'Security', group: 'Account', icon: ShieldCheck, search: 'password session sign out verification two factor 2fa authentication', component: lazyComponent(() => import('./SecuritySettings.vue')) },
  { key: 'advanced', label: 'Advanced', group: 'Account', icon: SlidersHorizontal, search: 'reset layout clear local data about', component: lazyComponent(() => import('./AdvancedSettings.vue')) },
]
