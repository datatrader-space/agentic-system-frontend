// The Let's Code editor's own light or dark theme (ADM-1205, LETS_CODE_IDE_GAPS_PLAN.md phase A).
//
// The editor follows the app's theme until the person picks one with the toggle in the editor's bar; the pick is kept
// in this browser and changes only the editor (its files, code, terminal, menus and Deploy panel), never the rest of
// AADML. The editor's container carries `data-theme`, and every `--vm-*` token is defined per `[data-theme]`, so
// everything inside it follows; what is teleported to the page's body (a menu, a dialog) carries the same attribute.
import { ref, computed } from 'vue'
import { useTheme } from './useTheme'

export const IDE_THEME_KEY = 'lets-code-theme'

function stored() {
  try {
    const v = localStorage.getItem(IDE_THEME_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null                                     // storage blocked: the editor follows the app
  }
}

// One choice for every component of the editor (module level, as useTheme's own state).
const choice = ref(stored())

export function useIdeTheme() {
  const { isDark: appDark } = useTheme()
  const theme = computed(() => choice.value || (appDark.value ? 'dark' : 'light'))
  const isDark = computed(() => theme.value === 'dark')
  function toggle() {
    choice.value = isDark.value ? 'light' : 'dark'
    try { localStorage.setItem(IDE_THEME_KEY, choice.value) } catch { /* kept for this visit only */ }
  }
  return { theme, isDark, toggle }
}

// Tests: forget the pick.
export function _resetIdeTheme() {
  choice.value = stored()
}
