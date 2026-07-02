/**
 * Product-wide AI Help Assistant launcher state (singleton).
 *
 * One assistant for the whole app: the FAB + chat widget live once in AppShell
 * (see GlobalHelpAssistant.vue), and any page opens it through this composable —
 * optionally seeding a question (e.g. the Help Center "Ask Assistant" search box).
 */
import { reactive } from 'vue'

const state = reactive({
  open: false,
  question: '',   // seed question for the next open ('' = just open the panel)
  nonce: 0,       // bumped on every open so the widget re-sends a repeated question
})

export function useHelpAssistant() {
  function openAssistant(q = '') {
    state.question = q || ''
    state.open = true
    state.nonce++
  }
  function close() { state.open = false }
  return { state, openAssistant, close }
}
