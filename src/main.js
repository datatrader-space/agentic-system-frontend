import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
// import App from './App.vue'
import App from './app.vue'
import './style.css'
import api from './services/api'
import axios from 'axios'

// Set global axios defaults
axios.defaults.withCredentials = true

// Import views
import SystemList from './views/SystemList.vue'
import SystemDetail from './views/SystemDetail.vue'
import RepositoryPage from './views/RepositoryPage.vue'
import Login from './views/Login.vue'
import LLMSettings from './views/LLMSettings.vue'
import LLMDashboard from './views/LLMDashboard.vue'
import Benchmarks from './views/Benchmarks.vue'
import ToolRegistry from './views/ToolRegistry.vue'
import Services from './views/Services.vue'
import MCPServers from './views/MCPServers.vue'
import AgentLibrary from './views/AgentLibrary.vue'
import AgentPlayground from './views/AgentPlayground.vue'
import LandingPage from './views/LandingPage.vue'
import Features from './views/Features.vue'
import HowItWorks from './views/HowItWorks.vue'
import Blog from './views/Blog.vue'
import BlogPost from './views/BlogPost.vue'
import Pricing from './views/Pricing.vue'
import About from './views/About.vue'
import Contact from './views/Contact.vue'
import ServiceRegistrationV2 from './views/ServiceRegistrationV2.vue'
import ServiceDrafts from './views/ServiceDrafts.vue'
import WorkspaceHub from './views/WorkspaceHub.vue'
import OrgSettings from './views/OrgSettings.vue'
import WorkspaceDashboard from './views/WorkspaceDashboard.vue'
import InviteAccept from './views/InviteAccept.vue'
import Connections from './views/Connections.vue'
import ConnectionDocs from './views/ConnectionDocs.vue'
import Docs from './views/Docs.vue'
import AdminPanel from './views/AdminPanel.vue'

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
    {
      path: '/admin',
      name: 'admin',
      component: AdminPanel,
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresGuest: true, public: true }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: SystemList,
      meta: { requiresAuth: true }
    },
    {
      path: '/systems/:id',
      name: 'system-detail',
      component: SystemDetail,
      meta: { requiresAuth: true }
    },
    {
      path: '/systems/:systemId/repositories/:repoId',
      name: 'repository-detail',
      component: RepositoryPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/ai-settings',
      name: 'ai-settings',
      component: LLMSettings,
      meta: { requiresAuth: true }
    },
    {
      path: '/ai-dashboard',
      name: 'ai-dashboard',
      component: LLMDashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/benchmarks',
      name: 'benchmarks',
      component: Benchmarks,
      meta: { requiresAuth: true }
    },
    {
      path: '/tools',
      name: 'tools',
      component: ToolRegistry,
      meta: { requiresAuth: true }
    },
    {
      path: '/services',
      name: 'services',
      component: Services,
      meta: { requiresAuth: true }
    },
    {
      path: '/mcp',
      name: 'mcp-servers',
      component: MCPServers,
      meta: { requiresAuth: true }
    },
    {
      path: '/agents',
      name: 'agent-library',
      component: AgentLibrary,
      meta: { requiresAuth: true }
    },
    {
      path: '/agents/:id',
      name: 'agent-playground',
      component: AgentPlayground,
      meta: { requiresAuth: true }
    },
    {
      path: '/services/register',
      name: 'service-registration-v2',
      component: ServiceRegistrationV2,
      meta: { requiresAuth: true }
    },
    {
      path: '/services/wizard',
      name: 'service-wizard',
      component: ServiceRegistrationV2,
      meta: { requiresAuth: true }
    },
    {
      path: '/services/drafts',
      name: 'service-drafts',
      component: ServiceDrafts,
      meta: { requiresAuth: true }
    },
    {
      path: '/workspaces',
      name: 'workspace-hub',
      component: WorkspaceHub,
      meta: { requiresAuth: true }
    },
    {
      path: '/org/:orgSlug/settings',
      name: 'org-settings',
      component: OrgSettings,
      meta: { requiresAuth: true }
    },
    {
      path: '/org/:orgSlug/settings/:tab',
      name: 'org-settings-tab',
      component: OrgSettings,
      meta: { requiresAuth: true }
    },
    {
      path: '/workspace/:wsId',
      name: 'workspace-dashboard',
      component: WorkspaceDashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/workspace/:wsId/:tab',
      name: 'workspace-tab',
      component: WorkspaceDashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/invite/accept/:token',
      name: 'invite-accept',
      component: InviteAccept,
      meta: { requiresAuth: false, public: true }
    },
    {
      path: '/connections',
      name: 'connections',
      component: Connections,
      meta: { requiresAuth: true }
    },
    {
      path: '/docs/connections',
      name: 'connection-docs',
      component: ConnectionDocs,
      meta: { requiresAuth: true }
    }
  ]
})

// Route guards
router.beforeEach(async (to, from, next) => {
  // For routes that don't require auth, allow access immediately
  if (!to.meta.requiresAuth) {
    // If guest-only page (login) and user might be logged in, verify first
    if (to.meta.requiresGuest) {
      try {
        const response = await api.checkAuth()
        if (response.data.authenticated) {
          return next('/dashboard') // Redirect to dashboard if already logged in
        }
      } catch (error) {
        // Not authenticated, allow access to login page
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

// Add global notification helper
app.provide('notify', (message, type = 'info') => {
  // Simple console notification for now
  // Can be replaced with a toast library later
  console.log(`[${type.toUpperCase()}] ${message}`)

  // You can add a toast library here like vue-toastification
  // For now, using alert for important messages
  if (type === 'error') {
    alert(message)
  }
})

app.use(router)
app.mount('#app')
