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
    }
  ]
})

// Route guards
router.beforeEach(async (to, from, next) => {
  const localUser = localStorage.getItem('user')
  let isAuthenticated = !!localUser

  // For routes requiring auth, verify with server if not already verified in this session
  // Or if we need to be absolutely sure. For now, trust localStorage for redirection
  // and let individual components handle unauthorized errors.

  if (to.meta.requiresAuth && !isAuthenticated) {
    // Double check with server if we think we're not authenticated
    try {
      const response = await api.checkAuth()
      if (response.data.authenticated) {
        isAuthenticated = true
      }
    } catch (error) {
      isAuthenticated = false
    }
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresGuest && isAuthenticated) {
    next('/')
  } else {
    next()
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
