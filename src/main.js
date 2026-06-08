import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
// import App from './App.vue'
import App from './app.vue'
import './style.css'
import Toast, { POSITION, useToast } from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import api from './services/api'
import axios from 'axios'

// Set global axios defaults
axios.defaults.withCredentials = true

// Views — lazy-loaded for route-level code-splitting (Phase 7 optimization).
// Vue Router accepts async component factories, so each view ships in its own chunk
// instead of one giant bundle; heavy deps (Monaco, pdf.js, highlight.js) only load
// on the routes that need them.
const SystemList = () => import('./views/SystemList.vue')
const SystemDetail = () => import('./views/SystemDetail.vue')
const RepositoryPage = () => import('./views/RepositoryPage.vue')
const Login = () => import('./views/Login.vue')
const LLMSettings = () => import('./views/LLMSettings.vue')
const LLMDashboard = () => import('./views/LLMDashboard.vue')
const LLMContextDashboard = () => import('./views/LLMContextDashboard.vue')
const ToolRegistry = () => import('./views/ToolRegistry.vue')
const Services = () => import('./views/Services.vue')
const MCPServers = () => import('./views/MCPServers.vue')
const AgentLibrary = () => import('./views/AgentLibrary.vue')
const AgentPlayground = () => import('./views/AgentPlayground.vue')
const AgentBuilderCanvas = () => import('./views/AgentBuilderCanvas.vue')
const AgentMonitor = () => import('./views/AgentMonitor.vue')
const LandingPage = () => import('./views/LandingPage.vue')
const Features = () => import('./views/Features.vue')
const HowItWorks = () => import('./views/HowItWorks.vue')
const Blog = () => import('./views/Blog.vue')
const BlogPost = () => import('./views/BlogPost.vue')
const Pricing = () => import('./views/Pricing.vue')
const About = () => import('./views/About.vue')
const Contact = () => import('./views/Contact.vue')
const ServiceRegistrationV2 = () => import('./views/ServiceRegistrationV2.vue')
const ServiceDrafts = () => import('./views/ServiceDrafts.vue')
const WorkspaceHub = () => import('./views/WorkspaceHub.vue')
const OrgSettings = () => import('./views/OrgSettings.vue')
const WorkspaceDashboard = () => import('./views/WorkspaceDashboard.vue')
const InviteAccept = () => import('./views/InviteAccept.vue')
const Connections = () => import('./views/Connections.vue')
const ConnectionDocs = () => import('./views/ConnectionDocs.vue')
const IntegrationGuide = () => import('./views/IntegrationGuide.vue')
const PublicChat = () => import('./views/PublicChat.vue')
const Docs = () => import('./views/Docs.vue')
const AdminPanel = () => import('./views/AdminPanel.vue')

// v2 app shell + chat workspace + tabbed settings (also lazy)
const AppShell = () => import('./components/app-shell/AppShell.vue')
const ChatWorkspace = () => import('./components/chat/ChatWorkspace.vue')
const SettingsLayout = () => import('./components/settings/SettingsLayout.vue')

// Iconify: bundle icon sets so brand/colored logos work OFFLINE (no API fetch).
// 'logos' = full-color brand logos; 'lucide' = generic icons used as iconify strings.
import { addCollection } from '@iconify/vue'
import logosIcons from '@iconify-json/logos/icons.json'
import lucideIconSet from '@iconify-json/lucide/icons.json'
addCollection(logosIcons)
addCollection(lucideIconSet)

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: LandingPage,
      meta: { requiresAuth: false, public: true }
    },
    // Public shareable webchat (no login): full page + embed (runs in the widget iframe).
    { path: '/a/:token', name: 'public-chat', component: PublicChat, meta: { requiresAuth: false, public: true } },
    { path: '/embed/:token', name: 'public-chat-embed', component: PublicChat, meta: { requiresAuth: false, public: true } },
    {
      path: '/features',
      name: 'features',
      component: Features,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/how-it-works',
      name: 'how-it-works',
      component: HowItWorks,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/blog',
      name: 'blog',
      component: Blog,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/blog/:slug',
      name: 'blog-post',
      component: BlogPost,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/pricing',
      name: 'pricing',
      component: Pricing,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/about',
      name: 'about',
      component: About,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/contact',
      name: 'contact',
      component: Contact,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/docs',
      name: 'docs',
      component: Docs,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/docs/:slug',
      name: 'docs-page',
      component: Docs,
      meta: { requiresAuth: false, public: true }
    },
    { path: '/admin', name: 'admin', redirect: '/dashboard/admin' },
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresGuest: true, public: true }
    },
    {
      // v2 chat-first dashboard: AppShell wraps all /dashboard/* children.
      // Existing top-level routes (/services, /mcp, …) stay alive until Phase 5.
      path: '/dashboard',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard/chat/new' },
        { path: 'chat/new', name: 'dashboard-chat-new', component: ChatWorkspace },
        { path: 'chat/:sessionId', name: 'dashboard-chat', component: ChatWorkspace },
        { path: 'systems', name: 'dashboard-systems', component: SystemList },
        // Legacy pages re-housed inside the shell so navigation never leaves it.
        // (The old top-level routes below remain for back-compat / deep links.)
        { path: 'agents', name: 'dashboard-agents', component: AgentLibrary },
        { path: 'agents/new', name: 'dashboard-agent-new', component: AgentBuilderCanvas },
        { path: 'agents/:id/configure', name: 'dashboard-agent-configure', component: AgentBuilderCanvas },
        { path: 'agents/:id/monitor', name: 'dashboard-agent-monitor', component: AgentMonitor },
        { path: 'agents/:id', name: 'dashboard-agent-playground', component: AgentPlayground },
        { path: 'tools', name: 'dashboard-tools', component: ToolRegistry },
        { path: 'services', name: 'dashboard-services', component: Services },
        { path: 'mcp', name: 'dashboard-mcp', component: MCPServers },
        { path: 'workspaces', name: 'dashboard-workspaces', component: WorkspaceHub },
        { path: 'activity', name: 'dashboard-activity', component: LLMDashboard },
        { path: 'llm-context', name: 'dashboard-llm-context', component: LLMContextDashboard },
        { path: 'llm-settings', name: 'dashboard-llm-settings', component: LLMSettings },
        // Phase 5: previously top-level authed pages, re-housed inside the single shell.
        { path: 'systems/:id', name: 'dashboard-system-detail', component: SystemDetail },
        { path: 'systems/:systemId/repositories/:repoId', name: 'dashboard-repository-detail', component: RepositoryPage },
        { path: 'services/register', name: 'dashboard-service-register', component: ServiceRegistrationV2 },
        { path: 'services/wizard', name: 'dashboard-service-wizard', component: ServiceRegistrationV2 },
        { path: 'services/drafts', name: 'dashboard-service-drafts', component: ServiceDrafts },
        { path: 'workspace/:wsId', name: 'dashboard-workspace', component: WorkspaceDashboard },
        { path: 'workspace/:wsId/:tab', name: 'dashboard-workspace-tab', component: WorkspaceDashboard },
        { path: 'connections', name: 'dashboard-connections', component: Connections },
        { path: 'connections/docs', name: 'dashboard-connection-docs', component: ConnectionDocs },
        { path: 'integration-guide/:agentId?', name: 'dashboard-integration-guide', component: IntegrationGuide },
        { path: 'org/:orgSlug/settings', name: 'dashboard-org-settings', component: OrgSettings },
        { path: 'org/:orgSlug/settings/:tab', name: 'dashboard-org-settings-tab', component: OrgSettings },
        { path: 'admin', name: 'dashboard-admin', component: AdminPanel },
        { path: 'settings', redirect: '/dashboard/settings/general' },
        { path: 'settings/:tab', name: 'dashboard-settings', component: SettingsLayout },
      ]
    },
    // ── Phase 5: legacy top-level authed paths now REDIRECT into the single shell.
    //    Names are kept so name-based navigation keeps working; bookmarks/deep links too.
    { path: '/systems/:id', name: 'system-detail', redirect: to => `/dashboard/systems/${to.params.id}` },
    { path: '/systems/:systemId/repositories/:repoId', name: 'repository-detail', redirect: to => `/dashboard/systems/${to.params.systemId}/repositories/${to.params.repoId}` },
    { path: '/ai-settings', name: 'ai-settings', redirect: '/dashboard/llm-settings' },
    { path: '/ai-dashboard', name: 'ai-dashboard', redirect: '/dashboard/activity' },
    { path: '/tools', name: 'tools', redirect: '/dashboard/tools' },
    { path: '/services', name: 'services', redirect: '/dashboard/services' },
    { path: '/mcp', name: 'mcp-servers', redirect: '/dashboard/mcp' },
    { path: '/agents', name: 'agent-library', redirect: '/dashboard/agents' },
    { path: '/agents/:id', name: 'agent-playground', redirect: to => `/dashboard/agents/${to.params.id}` },
    { path: '/services/register', name: 'service-registration-v2', redirect: '/dashboard/services/register' },
    { path: '/services/wizard', name: 'service-wizard', redirect: '/dashboard/services/wizard' },
    { path: '/services/drafts', name: 'service-drafts', redirect: '/dashboard/services/drafts' },
    { path: '/workspaces', name: 'workspace-hub', redirect: '/dashboard/workspaces' },
    { path: '/org/:orgSlug/settings', name: 'org-settings', redirect: to => `/dashboard/org/${to.params.orgSlug}/settings` },
    { path: '/org/:orgSlug/settings/:tab', name: 'org-settings-tab', redirect: to => `/dashboard/org/${to.params.orgSlug}/settings/${to.params.tab}` },
    { path: '/workspace/:wsId', name: 'workspace-dashboard', redirect: to => `/dashboard/workspace/${to.params.wsId}` },
    { path: '/workspace/:wsId/:tab', name: 'workspace-tab', redirect: to => `/dashboard/workspace/${to.params.wsId}/${to.params.tab}` },
    { path: '/connections', name: 'connections', redirect: '/dashboard/connections' },
    { path: '/docs/connections', name: 'connection-docs', redirect: '/dashboard/connections/docs' },
    { path: '/integration-guide/:agentId?', name: 'integration-guide', redirect: to => `/dashboard/integration-guide${to.params.agentId ? '/' + to.params.agentId : ''}` },
    {
      path: '/invite/accept/:token',
      name: 'invite-accept',
      component: InviteAccept,
      meta: { requiresAuth: false, public: true }
    }
  ]
})

// Route guards
router.beforeEach(async (to, from, next) => {
  // For routes that don't require auth, allow access immediately
  if (!to.meta.requiresAuth) {
    // Already-authenticated users shouldn't see the marketing landing page or the
    // login page — send them straight into the app.
    if (to.name === 'landing' || to.meta.requiresGuest) {
      try {
        const response = await api.checkAuth()
        if (response.data.authenticated) {
          return next(to.name === 'landing' ? '/dashboard/chat/new' : '/dashboard')
        }
      } catch (error) {
        // Not authenticated, allow access to the public/login page
      }
    }
    return next()
  }

  // For routes requiring authentication, ALWAYS check with server
  // Don't trust localStorage alone - verify session is valid
  try {
    const response = await api.checkAuth()
    if (response.data.authenticated) {
      // User is authenticated, allow access
      next()
    } else {
      // Server explicitly says not authenticated
      localStorage.clear()
      sessionStorage.clear()
      next('/login')
    }
  } catch (error) {
    // Distinguish between auth failures and network errors
    const status = error?.response?.status
    if (status === 401 || status === 403) {
      // Explicit auth rejection — clear state and redirect
      console.warn('Authentication rejected (HTTP', status, ')')
      localStorage.clear()
      sessionStorage.clear()
      next('/login')
    } else {
      // Network error, server restart, timeout, etc.
      // Don't nuke the session — allow through and let the page try
      console.warn('Auth check failed (network/server error), allowing through:', error?.message)
      next()
    }
  }
})

// Create app
const app = createApp(App)

// State management (Pinia) — required by the v2 app shell
app.use(createPinia())

// v-reveal — scroll-reveal directive (Vibrant Light Mesh power-up)
import reveal from './directives/reveal'
app.directive('reveal', reveal)

// Global toast notifications (replaces native browser alert popups everywhere)
app.use(Toast, {
  position: POSITION.TOP_RIGHT,
  timeout: 4500,
  closeOnClick: true,
  pauseOnHover: true,
  hideProgressBar: false,
  newestOnTop: true,
})

// Route ALL native alert() calls app-wide to custom toasts — no browser popups anywhere.
const _toast = useToast()
const _origAlert = window.alert.bind(window)
window.alert = (msg) => {
  try {
    const text = String(msg == null ? '' : msg)
    if (/(fail|error|invalid|denied|unable|could ?n.?t|wrong|exceed|missing|not found)/i.test(text)) {
      _toast.error(text, { timeout: 6000 })
    } else if (/(success|saved|created|updated|deleted|done|copied|added)/i.test(text)) {
      _toast.success(text)
    } else {
      _toast.info(text)
    }
  } catch (e) {
    _origAlert(msg)
  }
}

// Global notify() helper now uses toasts.
app.provide('notify', (message, type = 'info') => {
  const fn = _toast[type] || _toast.info
  fn(String(message))
})

app.use(router)
app.mount('#app')
