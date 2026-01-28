import { ref, watch } from 'vue'

// Theme state - shared across all components
const currentTheme = ref('dark')
const isInitialized = ref(false)

/**
 * Global theme management composable
 * 
 * This composable provides:
 * - Reactive theme state (light/dark)
 * - Theme toggle functionality
 * - Automatic persistence to localStorage
 * - System preference detection on first load
 * 
 * Usage in any component:
 * ```js
 * import { useTheme } from '@/composables/useTheme'
 * const { theme, toggleTheme, isDark } = useTheme()
 * ```
 */
export function useTheme() {
  // Initialize theme only once
  if (!isInitialized.value) {
    initializeTheme()
    isInitialized.value = true
  }

  // Computed property for dark mode check
  const isDark = () => currentTheme.value === 'dark'

  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark'
    applyTheme(currentTheme.value)
    saveTheme(currentTheme.value)
  }

  /**
   * Set a specific theme
   * @param {string} theme - 'light' or 'dark'
   */
  function setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return
    currentTheme.value = theme
    applyTheme(theme)
    saveTheme(theme)
  }

  return {
    theme: currentTheme,
    isDark,
    toggleTheme,
    setTheme
  }
}

/**
 * Initialize theme from localStorage or system preference
 */
function initializeTheme() {
  // Try to get saved theme from localStorage
  const savedTheme = localStorage.getItem('app-theme')
  
  if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
    currentTheme.value = savedTheme
  } else {
    // Detect system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    currentTheme.value = prefersDark ? 'dark' : 'light'
  }
  
  applyTheme(currentTheme.value)
}

/**
 * Apply theme to document
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

/**
 * Save theme preference to localStorage
 * @param {string} theme - 'light' or 'dark'
 */
function saveTheme(theme) {
  localStorage.setItem('app-theme', theme)
}
