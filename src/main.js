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
import { trackPageview } from './composables/useAnalytics'

// Set global axios defaults
axios.defaults.withCredentials = true

// Views — lazy-loaded for route-level code-splitting (Phase 7 optimization).
// Vue Router accepts async component factories, so each view ships in its own chunk
// instead of one giant bundle; heavy deps (Monaco, pdf.js, highlight.js) only load
// on the routes that need them.
const LetsCode = () => import('./views/LetsCode.vue')
const SystemDetail = () => import('./views/SystemDetail.vue')
const RepositoryPage = () => import('./views/RepositoryPage.vue')
const Login = () => import('./views/Login.vue')
const ForgotPassword = () => import('./views/ForgotPassword.vue')
const ResetPassword = () => import('./views/ResetPassword.vue')
const VerifyEmail = () => import('./views/VerifyEmail.vue')
const LLMSettings = () => import('./views/LLMSettings.vue')
const LLMDashboard = () => import('./views/LLMDashboard.vue')
const LLMContextDashboard = () => import('./views/LLMContextDashboard.vue')
const ConnectorsPage = () => import('./views/ConnectorsPage.vue')
const ToolsPage = () => import('./views/ToolsPage.vue')
const HelpCenter = () => import('./views/HelpCenter.vue')
const DocumentationHome = () => import('./views/DocumentationHome.vue')
const TutorialsLibrary = () => import('./views/TutorialsLibrary.vue')
const TutorialDetail = () => import('./views/TutorialDetail.vue')
const HelpArticle = () => import('./views/HelpArticle.vue')
const LearningPaths = () => import('./views/LearningPaths.vue')
const LearningPathDetail = () => import('./views/LearningPathDetail.vue')
const HelpTopics = () => import('./views/HelpTopics.vue')
const GuidedToursLibrary = () => import('./views/GuidedToursLibrary.vue')
const GuidedTourDetail = () => import('./views/GuidedTourDetail.vue')
const GuidedToursPage = () => import('./views/GuidedToursPage.vue')
const SupportCenter = () => import('./views/SupportCenter.vue')
const ApiReference = () => import('./views/ApiReference.vue')
const GettingStarted = () => import('./views/GettingStarted.vue')
const BudgetsPage = () => import('./views/BudgetsPage.vue')
const OrganizationPage = () => import('./views/OrganizationPage.vue')
const OrganizationModulePage = () => import('./views/OrganizationModulePage.vue')
const AgentApprovalsPage = () => import('./views/AgentApprovalsPage.vue')
const SchedulesPage = () => import('./views/SchedulesPage.vue')
const AgentLibrary = () => import('./views/AgentLibrary.vue')
const AgentPlayground = () => import('./views/AgentPlayground.vue')
const AgentOverview = () => import('./views/AgentOverview.vue')
const AgentBuilderCanvas = () => import('./views/AgentBuilderCanvas.vue')
const AgentEditor = () => import('./views/AgentEditor.vue')
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
const OAuthProviderRegistration = () => import('./views/OAuthProviderRegistration.vue')
const ServiceDrafts = () => import('./views/ServiceDrafts.vue')
const OrgSettings = () => import('./views/OrgSettings.vue')
const WorkspaceDashboard = () => import('./views/WorkspaceDashboard.vue')
const InviteAccept = () => import('./views/InviteAccept.vue')
const Connections = () => import('./views/Connections.vue')
const ConnectionDocs = () => import('./views/ConnectionDocs.vue')
const IntegrationGuide = () => import('./views/IntegrationGuide.vue')
const PublicChat = () => import('./views/PublicChat.vue')
const Docs = () => import('./views/Docs.vue')
const AdminPanel = () => import('./views/AdminPanel.vue')
const ModelPricingPage = () => import('./views/ModelPricingPage.vue')
const AdminShell = () => import('./components/admin-shell/AdminShell.vue')
const AdminOverview = () => import('./views/admin/AdminOverview.vue')
const CrawlerExportAPI = () => import('./views/admin/CrawlerExportAPI.vue')
const AdminKnowledge = () => import('./views/admin/AdminKnowledge.vue')
const Billing = () => import('./views/Billing.vue')

// v2 app shell + chat workspace + tabbed settings (also lazy)
const AppShell = () => import('./components/app-shell/AppShell.vue')
const HomeDashboard = () => import('./components/app-shell/HomeDashboard.vue')
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
    { path: '/admin', name: 'admin', redirect: '/admin-dashboard/overview' },
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresGuest: true, public: true }
    },
    {
      path: '/signup',
      name: 'signup',
      component: Login,
      meta: { requiresGuest: true, public: true }
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPassword,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: ResetPassword,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: VerifyEmail,
      meta: { requiresAuth: false, public: true }
    },
    {
      // v2 chat-first dashboard: AppShell wraps all /dashboard/* children.
      // Existing top-level routes (/services, /mcp, …) stay alive until Phase 5.
      path: '/dashboard',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard-home', component: HomeDashboard },
        { path: 'chat/new', name: 'dashboard-chat-new', component: ChatWorkspace },
        { path: 'chat/:sessionId', name: 'dashboard-chat', component: ChatWorkspace },
        { path: 'lets-code', name: 'dashboard-lets-code', component: LetsCode },
        { path: 'systems', redirect: '/dashboard/lets-code' },
        // Legacy pages re-housed inside the shell so navigation never leaves it.
        // (The old top-level routes below remain for back-compat / deep links.)
        { path: 'agents', name: 'dashboard-agents', component: AgentLibrary },
        { path: 'built-in-agents', name: 'builtin-agent-library', component: () => import('./views/BuiltinAgentLibrary.vue') },
        { path: 'agents/new', name: 'dashboard-agent-new', component: AgentEditor },
        { path: 'agents/:id/editor', name: 'dashboard-agent-editor', component: AgentEditor },
        { path: 'agents/:id/workspace', name: 'dashboard-agent-workspace', component: () => import('./views/AgentWorkspacePage.vue') },
        { path: 'agents/:id/guardrails', name: 'dashboard-agent-guardrails', component: AgentApprovalsPage },
        { path: 'agents/:id/configure', redirect: to => `/dashboard/agents/${to.params.id}/editor` },
        { path: 'agents/:id/advanced', name: 'dashboard-agent-advanced', component: AgentBuilderCanvas },
        { path: 'agents/:id/monitor', name: 'dashboard-agent-monitor', component: AgentMonitor },
        { path: 'agents/:id/playground', name: 'dashboard-agent-playground', component: AgentPlayground },
        { path: 'agents/:id', name: 'dashboard-agent-overview', component: AgentOverview },
        // Tools library (Screen 24) — revived standalone page; Services / MCP / Workspaces still fold into Connectors.
        { path: 'tools', name: 'dashboard-tools', component: ToolsPage },
        { path: 'services', name: 'dashboard-services', redirect: '/dashboard/connectors' },
        { path: 'mcp', name: 'dashboard-mcp', redirect: '/dashboard/connectors' },
        { path: 'connectors', name: 'dashboard-connectors', component: ConnectorsPage },
        { path: 'integration-hub', redirect: '/dashboard/connectors' },
        // Workflow Builder (NEW node-canvas system — lazy-loaded; separate from old /workflows feature)
        { path: 'workflow-builder', name: 'dashboard-workflow-builder', component: () => import('./views/WorkflowsList.vue') },
        { path: 'workflow-builder/:id', name: 'dashboard-workflow-canvas', component: () => import('./views/WorkflowBuilder.vue') },
        { path: 'schedules', name: 'dashboard-schedules', component: SchedulesPage },
        { path: 'workspaces', name: 'dashboard-workspaces', redirect: '/dashboard/connectors' },
        { path: 'budgets', name: 'dashboard-budgets', component: BudgetsPage },
        { path: 'organization', name: 'dashboard-organization', component: OrganizationPage },
        { path: 'organization/:module', name: 'dashboard-organization-module', component: OrganizationModulePage },
        { path: 'activity', name: 'dashboard-activity', component: LLMDashboard },
        { path: 'help-center', name: 'dashboard-help-center', component: HelpCenter },
        { path: 'help-center/get-started', name: 'dashboard-help-get-started', component: GettingStarted },
        { path: 'help-center/documentation', name: 'dashboard-help-documentation', component: DocumentationHome },
        { path: 'help-center/topics', name: 'dashboard-help-topics', component: HelpTopics },
        { path: 'help-center/api-reference', name: 'dashboard-help-api-reference', component: ApiReference },
        { path: 'help-center/tutorials', name: 'dashboard-help-tutorials', component: TutorialsLibrary },
        { path: 'help-center/tutorials/:slug', name: 'dashboard-help-tutorial-detail', component: TutorialDetail },
        { path: 'help-center/article/:slug', name: 'dashboard-help-article', component: HelpArticle },
        { path: 'help-center/learning-paths', name: 'dashboard-help-learning-paths', component: LearningPaths },
        { path: 'help-center/learning-paths/:slug', name: 'dashboard-help-learning-path', component: LearningPathDetail },
        // One doc system: the docs URLs now render the new DocumentationHome (it reads
        // :productArea to pre-filter). The legacy DocsBrowser cards page is retired.
        { path: 'help-center/docs', name: 'dashboard-help-docs', component: DocumentationHome },
        { path: 'help-center/docs/:productArea', name: 'dashboard-help-docs-area', component: DocumentationHome },
        { path: 'help-center/guided-tours', name: 'dashboard-help-guided-tours', component: GuidedToursLibrary },
        { path: 'help-center/guided-tours/:slug', name: 'dashboard-help-guided-tour', component: GuidedTourDetail },
        { path: 'help-center/support', name: 'dashboard-help-support', component: SupportCenter },
        { path: 'documentation', name: 'dashboard-documentation', component: DocumentationHome },
        { path: 'tutorials', name: 'dashboard-tutorials', redirect: '/dashboard/help-center/tutorials' },
        { path: 'guided-tours', name: 'dashboard-guided-tours', redirect: '/dashboard/help-center/guided-tours' },
        { path: 'get-started', name: 'dashboard-get-started', redirect: '/dashboard/help-center/get-started' },
        { path: 'llm-context', name: 'dashboard-llm-context', redirect: '/admin-dashboard/llm-context' },
        { path: 'llm-settings', name: 'dashboard-llm-settings', component: LLMSettings },
        // Phase 5: previously top-level authed pages, re-housed inside the single shell.
        { path: 'systems/:id', name: 'dashboard-system-detail', component: SystemDetail },
        { path: 'systems/:systemId/repositories/:repoId', name: 'dashboard-repository-detail', component: RepositoryPage },
        { path: 'services/register', name: 'dashboard-service-register', component: ServiceRegistrationV2 },
        { path: 'connectors/oauth-provider/new', name: 'dashboard-oauth-provider-new', component: OAuthProviderRegistration },
        { path: 'services/wizard', name: 'dashboard-service-wizard', component: ServiceRegistrationV2 },
        { path: 'services/drafts', name: 'dashboard-service-drafts', component: ServiceDrafts },
        { path: 'workspace/:wsId', name: 'dashboard-workspace', component: WorkspaceDashboard },
        { path: 'workspace/:wsId/:tab', name: 'dashboard-workspace-tab', component: WorkspaceDashboard },
        { path: 'connections', name: 'dashboard-connections', component: Connections },
        { path: 'connections/docs', name: 'dashboard-connection-docs', component: ConnectionDocs },
        { path: 'integration-guide/:agentId?', name: 'dashboard-integration-guide', component: IntegrationGuide },
        { path: 'org/:orgSlug/settings', name: 'dashboard-org-settings', component: OrgSettings },
        { path: 'org/:orgSlug/settings/:tab', name: 'dashboard-org-settings-tab', component: OrgSettings },
        { path: 'org-guardrails', name: 'dashboard-org-guardrails', component: () => import('./views/OrgGuardrails.vue') },
        { path: 'admin', name: 'dashboard-admin', redirect: '/admin-dashboard/platform' },
        { path: 'model-pricing', name: 'dashboard-model-pricing', redirect: '/admin-dashboard/model-pricing' },
        { path: 'billing', name: 'dashboard-billing', component: Billing },
        { path: 'settings', redirect: '/dashboard/settings/general' },
        { path: 'settings/:tab', name: 'dashboard-settings', component: SettingsLayout },
      ]
    },
    // ── Separate ADMIN dashboard (own shell + sidebar, staff-gated). Admin pages live here, not in
    //    the user /dashboard. requiresAdmin on the parent gates every child.
    {
      path: '/admin-dashboard',
      component: AdminShell,
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        { path: '', redirect: '/admin-dashboard/overview' },
        { path: 'overview', name: 'admin-overview', component: AdminOverview },
        { path: 'platform', name: 'admin-platform', component: AdminPanel },
        { path: 'guardrails', name: 'admin-guardrails', component: () => import('./views/admin/AdminGuardrails.vue') },
        { path: 'knowledge', name: 'admin-knowledge', component: AdminKnowledge },
        { path: 'model-pricing', name: 'admin-model-pricing', component: ModelPricingPage },
        { path: 'llm-context', name: 'admin-llm-context', component: LLMContextDashboard },
        { path: 'crawler-export', name: 'admin-crawler-export', component: CrawlerExportAPI },
        { path: 'api-reference', name: 'admin-api-reference', component: () => import('./views/admin/AdminApiReference.vue') },
        { path: 'help-analytics', name: 'admin-help-analytics', component: () => import('./views/admin/AdminHelpAnalytics.vue') },
        // Unified Help Center CMS hub (Content · Guided Tours · API Reference as tabs).
        { path: 'help-center', name: 'admin-help-center', component: () => import('./views/admin/AdminHelpCms.vue') },
        // Individual routes kept for deep links; the hub renders the same components as tabs.
        { path: 'help-content', name: 'admin-help-content', component: () => import('./views/admin/AdminHelpContent.vue') },
        { path: 'guided-tours', name: 'admin-guided-tours', component: () => import('./views/admin/AdminGuidedTours.vue') },
        { path: 'builtin-agents', name: 'admin-builtin-agents', component: () => import('./views/admin/AdminBuiltinAgents.vue') },
      ],
    },
    // ── Phase 5: legacy top-level authed paths now REDIRECT into the single shell.
    //    Names are kept so name-based navigation keeps working; bookmarks/deep links too.
    { path: '/systems/:id', name: 'system-detail', redirect: to => `/dashboard/systems/${to.params.id}` },
    { path: '/systems/:systemId/repositories/:repoId', name: 'repository-detail', redirect: to => `/dashboard/systems/${to.params.systemId}/repositories/${to.params.repoId}` },
    { path: '/ai-settings', name: 'ai-settings', redirect: '/dashboard/llm-settings' },
    { path: '/ai-dashboard', name: 'ai-dashboard', redirect: '/dashboard/activity' },
    { path: '/tools', name: 'tools', redirect: '/dashboard' },
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
          return next('/dashboard')
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
      // Admin-only routes (e.g. Model Pricing) additionally require is_staff.
      // Backend already enforces IsAdminUser; this blocks direct-URL access for UX/security.
      if (to.meta.requiresAdmin && !response.data.user?.is_staff) {
        console.warn('Admin route blocked for non-staff user:', to.path)
        return next('/dashboard/chat/new')
      }
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

// First-party analytics: record a pageview on public/marketing routes only
// (no-op until the user grants cookie consent; never fires under Do-Not-Track).
router.afterEach((to) => {
  if (to.meta?.public && !to.path.startsWith('/a/') && !to.path.startsWith('/embed/')) {
    trackPageview(to)
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
