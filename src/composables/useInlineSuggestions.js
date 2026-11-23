// Inline code suggestions in the Let's Code editor (ADM-1316): the person's setting, read from and saved to the server
// (which enforces it on every request), and why suggestions are stopped when they are. One state for every editor on
// the page: a stop in one project (daily limit, balance, the model failing) is true for all of them.
import { reactive, readonly } from 'vue'
import api from '@/services/api'

// Codes the server answers a refusal with. Each stops suggestions until the person acts: 'off' is the setting itself;
// the others are shown in the editor's status line with a Resume button (the next request says if the cause is still
// there). No suggestion is ever asked of another model instead.
export const STOP_CODES = Object.freeze(['off', 'daily_limit', 'balance', 'budget', 'no_model', 'price_missing',
  'model_failed'])

const state = reactive({
  loaded: false,
  loading: false,
  saving: false,
  error: '',                 // the setting could not be read or saved
  enabled: false,
  dailyLimitUsd: '1.00',
  spentTodayUsd: '0',
  resetsAt: '',
  modelName: '',
  stopped: null,             // { code, message } while suggestions are stopped, else null
})

function take(data) {
  if (!data || typeof data !== 'object') return
  state.enabled = !!data.enabled
  if (data.daily_limit_usd != null) state.dailyLimitUsd = String(data.daily_limit_usd)
  if (data.spent_today_usd != null) state.spentTodayUsd = String(data.spent_today_usd)
  state.resetsAt = data.resets_at || state.resetsAt
  state.modelName = data.model?.name || ''
  state.loaded = true
}

function errorText(e, fallback) {
  const d = e?.response?.data
  return (d && (d.error || d.detail)) || fallback
}

let inflight = null
export async function loadInlineSuggestions({ force = false } = {}) {
  if (state.loaded && !force) return state
  if (inflight) return inflight
  state.loading = true
  inflight = Promise.resolve().then(() => api.getInlineCompletionSettings())
    .then(({ data }) => { take(data); state.error = '' })
    .catch((e) => { state.error = errorText(e, "Inline suggestions' setting could not be read.") })
    .finally(() => { state.loading = false; inflight = null })
  await inflight
  return state
}

// Save { enabled?, daily_limit_usd? }. Turning suggestions on (or changing the limit) clears a stop: the next pause in
// typing asks again, and the server says if the cause is still there.
export async function saveInlineSuggestions(patch) {
  state.saving = true
  state.error = ''
  try {
    const { data } = await api.saveInlineCompletionSettings(patch)
    take(data)
    if (state.enabled) state.stopped = null
    return true
  } catch (e) {
    state.error = errorText(e, "Inline suggestions' setting could not be saved. Please try again.")
    return false
  } finally {
    state.saving = false
  }
}

export function stopInlineSuggestions(code, message) {
  if (code === 'off') { state.enabled = false; state.stopped = null; return }
  state.stopped = { code, message: message || 'Inline suggestions stopped.' }
}

export function resumeInlineSuggestions() { state.stopped = null }

export function noteSpend(data) {
  if (data && data.spent_today_usd != null) state.spentTodayUsd = String(data.spent_today_usd)
  if (data && data.daily_limit_usd != null) state.dailyLimitUsd = String(data.daily_limit_usd)
}

// Whether the editor may ask for a suggestion now.
export function suggestionsActive() { return state.loaded && state.enabled && !state.stopped }

export function useInlineSuggestions() {
  return { state: readonly(state), load: loadInlineSuggestions, save: saveInlineSuggestions,
    stop: stopInlineSuggestions, resume: resumeInlineSuggestions }
}

// Tests: back to a page that has read nothing.
export function _resetInlineSuggestions() {
  Object.assign(state, { loaded: false, loading: false, saving: false, error: '', enabled: false, dailyLimitUsd: '1.00',
    spentTodayUsd: '0', resetsAt: '', modelName: '', stopped: null })
  inflight = null
}
