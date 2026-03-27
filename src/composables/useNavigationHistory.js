/**
 * Navigation History Composable
 * 
 * Twitter/X-style history-based back navigation.
 * Tracks internal navigation stack so the back button can
 * intelligently go to the previous in-app page, or fall back
 * to a sensible default.
 * 
 * Usage:
 *   - Install in app.vue or main.js with `installNavigationHistory(router)`
 *   - Use `useNavigationHistory()` in any component to get `canGoBack` and `goBack(fallback)`
 */
import { ref, readonly } from 'vue'

// Global state (singleton across the app)
const history = ref([])
const _initialized = ref(false)

/**
 * Install the navigation history tracker on the router.
 * Should be called once in app.vue or main.js.
 */
export function installNavigationHistory(router) {
    if (_initialized.value) return

    router.afterEach((to, from) => {
        // Don't track the initial navigation (from.name is undefined)
        if (!from.name) return

        // Don't track duplicate consecutive entries (same route, staying in place)
        const lastEntry = history.value[history.value.length - 1]
        if (lastEntry && lastEntry.fullPath === from.fullPath) return

        // Push the "from" route to history stack
        history.value.push({
            fullPath: from.fullPath,
            name: from.name,
            params: { ...from.params },
            query: { ...from.query },
            meta: { ...from.meta },
        })

        // Cap at 50 entries to avoid memory bloat
        if (history.value.length > 50) {
            history.value = history.value.slice(-50)
        }
    })

    _initialized.value = true
}

/**
 * Composable for components to use back navigation.
 */
export function useNavigationHistory() {
    const canGoBack = ref(false)

    // Check if there's history to go back to
    const updateCanGoBack = () => {
        canGoBack.value = history.value.length > 0
    }

    // Reactive — watch for changes
    // (We use a simple getter since the history ref is reactive)
    return {
        /** Whether there's a previous page to go back to */
        get canGoBack() {
            return history.value.length > 0
        },

        /** The history stack (readonly) */
        history: readonly(history),

        /**
         * Go back to the previous page in the internal history stack.
         * If no history, navigates to `fallbackPath` (default: '/agents').
         * 
         * Uses router.back() when possible (preserves browser history direction),
         * falls back to router.push() otherwise.
         */
        goBack(router, fallbackPath = '/agents') {
            if (history.value.length > 0) {
                const prev = history.value.pop()
                // Use router.back() if the browser history matches (most common case)
                // This gives the proper "back" animation and preserves scroll position
                router.back()
            } else {
                router.push(fallbackPath)
            }
        },

        /**
         * Get the previous route info without navigating.
         */
        get previousRoute() {
            return history.value.length > 0
                ? history.value[history.value.length - 1]
                : null
        },

        /**
         * Get a short label for the previous page (for the back button text).
         */
        get previousLabel() {
            const prev = history.value[history.value.length - 1]
            if (!prev) return ''

            // Map route names to human labels
            const labels = {
                'dashboard': 'Dashboard',
                'agent-library': 'Agents',
                'agent-playground': 'Agent',
                'ai-settings': 'AI Settings',
                'ai-dashboard': 'AI Dashboard',
                'service-list': 'Services',
                'mcp-servers': 'MCP',
                'connections': 'Connections',
                'workspace-hub': 'Workspaces',
                'workspace-dashboard': 'Workspace',
                'settings': 'Settings',
            }

            return labels[prev.name] || ''
        }
    }
}
