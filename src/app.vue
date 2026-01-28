<template>
  <div id="app" class="min-h-screen" :class="appBackgroundClass">
    <!-- Header Component -->
    <AppHeader
      :current-user="currentUser"
      :llm-health="llmHealth"
      :theme="theme"
      @logout="handleLogout"
      @connect-github="connectGitHub"
      @toggle-theme="toggleTheme"
    />

    <!-- Main Content -->
    <main :class="mainContentClass">
      <router-view />
    </main>
    
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
import { useTheme } from './composables/useTheme'

const router = useRouter()
const route = useRoute()
const llmHealth = ref(null)

// Initialize theme system
const { theme, toggleTheme, isDark } = useTheme()

// Layout computed properties
const isFullScreen = computed(() => route.name === 'repository-detail' || route.name === 'agent-playground')

// Public pages that need full-width dark layout
const isPublicPage = computed(() => {
  return !!route.meta.public
})

// Background class based on page type
const appBackgroundClass = computed(() => {
  if (isPublicPage.value) {
    return 'app-dark-theme'
  }
  return 'bg-gray-50'
})

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
    await api.logout()
    currentUser.value = null
    localStorage.removeItem('user')
    router.push('/login')
    addNotification('Logged out successfully', 'success')
  } catch (error) {
    console.error('Logout failed:', error)
    addNotification('Logout failed', 'error')
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

/* Dark theme for public/landing pages */
.app-dark-theme {
  background: #030712;
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
