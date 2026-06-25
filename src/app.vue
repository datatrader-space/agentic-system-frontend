<template>
  <div id="app" class="min-h-screen" :class="appBackgroundClass">
    <!-- Public webchat (/a/:token, /embed/:token): bare full-bleed, no app header/shell -->
    <router-view v-if="isBareChat" />

    <template v-else>
      <!-- Header Component — legacy top nav. Authenticated users live entirely
           inside the v2 AppShell (/dashboard) which owns its own header/sidebar,
           so this is NEVER shown when signed in (`!currentUser`). It only remains
           as a public-navbar fallback for logged-out non-marketing pages.
           Also gated on routerReady so the initial async auth guard can't flash it
           before the shell resolves. -->
      <AppHeader
        v-if="routerReady && !currentUser && !isAppShell && !isMarketingPage"
        :current-user="currentUser"
        :llm-health="llmHealth"
        :theme="theme"
        @logout="handleLogout"
        @connect-github="connectGitHub"
        @toggle-theme="handleToggleTheme"
      />

      <!-- Main Content -->
      <main v-if="!isAppShell" :class="mainContentClass">
        <router-view />
      </main>
      <!-- v2 app shell: full-bleed, owns its own layout -->
      <router-view v-else />
    </template>

    <!-- Global confirm dialog host (replaces native window.confirm everywhere) -->
    <ConfirmDialog />
    
    <!-- Toast Notifications (if any) -->
    <div class="fixed bottom-4 right-4 space-y-2">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="bg-white shadow-lg rounded-lg p-4 max-w-sm"
        :class="{
          'border-l-4 border-green-500': notification.type === 'success',
          'border-l-4 border-red-500': notification.type === 'error',
          'border-l-4 border-blue-500': notification.type === 'info'
        }"
      >
        <div class="flex items-start">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900">
              {{ notification.message }}
            </p>
          </div>
          <button
            @click="removeNotification(notification.id)"
            class="ml-4 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, provide, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from './services/api'
import AppHeader from './components/layout/AppHeader.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useTheme } from './composables/useTheme'
import { identify } from './composables/useAnalytics'

const router = useRouter()
const route = useRoute()
const llmHealth = ref(null)

// True once the initial navigation (incl. the async auth guard) has resolved.
// Until then `route` is at START_LOCATION (path '/', name undefined), which would
// otherwise make the legacy AppHeader flash on a hard refresh of /dashboard/*.
const routerReady = ref(false)
router.isReady().then(() => { routerReady.value = true })

// Initialize the theme system. Honors the user's saved choice (useTheme reads
// localStorage on first use and defaults brand-new sessions to light). Dark mode
// is still in beta, so the toggle in Settings warns about possible inconsistencies.
const { theme, toggleTheme } = useTheme()

const handleToggleTheme = () => {
  toggleTheme()
  if (theme.value === 'dark') {
    addNotification('Note: Dark theme is currently in beta. You may see some inconsistencies.', 'info')
  }
}

// Layout computed properties
const isFullScreen = computed(() => route.name === 'repository-detail' || route.name === 'agent-playground')

// v2 app shell routes (/dashboard/*) and the separate admin dashboard (/admin-dashboard/*) render
// full-bleed with their own sidebar/header.
const isAppShell = computed(() =>
  route.path === '/dashboard' || route.path.startsWith('/dashboard/') ||
  route.path === '/admin-dashboard' || route.path.startsWith('/admin-dashboard/'))

// Public webchat pages render completely bare (no app header, no main wrapper).
const isBareChat = computed(() => route.path.startsWith('/a/') || route.path.startsWith('/embed/'))

// Marketing routes carry their own PublicLayout header+footer; standalone auth
// pages render their own centered card. In both cases the legacy AppHeader must
// not also render. (Login already self-hides via its own isLoginPage check.)
const marketingRoutes = new Set([
  'landing', 'features', 'how-it-works', 'blog', 'blog-post',
  'pricing', 'about', 'contact', 'docs', 'docs-page',
  'signup', 'forgot-password', 'reset-password', 'verify-email',
])
const isMarketingPage = computed(() => marketingRoutes.has(route.name))

// Public pages that need full-width dark layout
const isPublicPage = computed(() => {
  return !!route.meta.public
})

// Background class based on page type. Light theme only — public/marketing pages
// are now light too (they're var-driven, so flipping the canvas + data-theme=light
// makes them render light). See REDESIGN_PLAN.md Phase 6.
const appBackgroundClass = computed(() => 'app-light-theme')

// Main content class based on page type
const mainContentClass = computed(() => {
  if (isFullScreen.value) {
    return 'h-[calc(100vh-64px)]'
  }
  if (isPublicPage.value) {
    return '' // Full width for public pages
  }
  return 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'
})

const currentUser = ref(null)
const notifications = ref([])

// Load current user
const loadCurrentUser = async () => {
  try {
    const response = await api.getCurrentUser()
    currentUser.value = response.data.user
    // Link this visitor to the signed-in user (no-op without analytics consent).
    identify()
  } catch (error) {
    console.error('Failed to load user:', error)
    currentUser.value = null
  }
}

// Load user data on mount
onMounted(async () => {
  // Check for GitHub OAuth callback
  const urlParams = new URLSearchParams(window.location.search)

  if (urlParams.get('github_connected')) {
    const username = urlParams.get('username')
    addNotification(`GitHub connected successfully as ${username}!`, 'success')

    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname)

    // Reload user data to update GitHub status
    await loadCurrentUser()
  } else if (urlParams.get('github_error')) {
    const error = urlParams.get('github_error')
    const errorMessages = {
      'no_code': 'GitHub authorization was cancelled',
      'no_token': 'Failed to get GitHub access token',
      'exchange_failed': 'Failed to connect to GitHub'
    }
    addNotification(errorMessages[error] || 'GitHub connection failed', 'error')

    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname)
  }

  // Load current user if authenticated
  if (route.path !== '/login') {
    await loadCurrentUser()
  }

  // Check LLM health
  try {
    const response = await api.get('/llm/health/')
    llmHealth.value = response.data
  } catch (error) {
    console.error('Failed to check LLM health:', error)
  }
})

// Watch for route changes to reload user if needed
watch(() => route.path, async (newPath) => {
  if (newPath !== '/login' && !currentUser.value) {
    await loadCurrentUser()
  }
})

// Logout
const handleLogout = async () => {
  try {
    // Call backend logout to clear session cookie
    await api.logout()
    
    // Clear all frontend state
    currentUser.value = null
    
    // Clear ALL localStorage (not just 'user')
    localStorage.clear()
    
    // Clear sessionStorage too (if any)
    sessionStorage.clear()
    
    // Show success message
    addNotification('Logged out successfully', 'success')
    
    // Force a full page reload to clear any in-memory authentication state
    // This ensures axios interceptors and all component states are reset
    window.location.href = '/login'
    
  } catch (error) {
    console.error('Logout failed:', error)
    
    // Even if backend logout fails, clear frontend state
    currentUser.value = null
    localStorage.clear()
    sessionStorage.clear()
    
    // Still redirect and reload
    window.location.href = '/login'
  }
}

// Connect GitHub
const connectGitHub = () => {
  const state = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

  api.githubConfig()
    .then((response) => {
      const { client_id: clientId, redirect_uri: redirectUri, scope } = response.data
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state
      })
      window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`
    })
    .catch((error) => {
      console.error('Failed to load GitHub OAuth config:', error)
      addNotification(
        error.response?.data?.error || 'GitHub OAuth is not configured.',
        'error'
      )
    })
}

// Notification system
let notificationId = 0

const addNotification = (message, type = 'info') => {
  const id = notificationId++
  notifications.value.push({ id, message, type })

  // Auto-remove after 5 seconds
  setTimeout(() => {
    removeNotification(id)
  }, 5000)
}

const removeNotification = (id) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

// Expose to child components via provide/inject
provide('notify', addNotification)
// v2 app shell consumes these (LeftSidebar user footer + sign out)
provide('currentUser', currentUser)
provide('logout', handleLogout)
</script>

<style>
/* Global styles */
body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

/* Light-only canvas for public/marketing + app pages */
.app-light-theme {
  background: #FBFAFF;
}

/* Light theme background */
.bg-gray-50 {
  background-color: #f9fafb;
}

.btn-primary-small {
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border-radius: 0.375rem;
  font-weight: 600;
  font-size: 0.875rem;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-primary-small:hover {
  background: #5a67d8;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
