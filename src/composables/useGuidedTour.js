// Guided Tour engine (singleton). The store holds the active tour + step index and
// drives route navigation; GuidedTourOverlay.vue (mounted once globally) renders the
// spotlight/tooltip and locates the target element for the current step. Progress is
// persisted to the backend for logged-in users and to localStorage for everyone.
import { reactive } from 'vue'
import api from '../services/api'

const LS_KEY = 'help_tour_progress_v1'

const state = reactive({
  active: false,
  slug: '',
  tour: null,
  steps: [],
  index: 0,
  loading: false,
})

let _router = null
export function registerRouter(router) { _router = router }

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch { return {} }
}
function saveLocal(slug, status, step) {
  try {
    const all = loadLocal()
    all[slug] = { status, step }
    localStorage.setItem(LS_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}
export function localTourStatus(slug) { return loadLocal()[slug] || null }

function currentPath() {
  try { return _router?.currentRoute?.value?.path || window.location.pathname } catch { return window.location.pathname }
}

async function navigateForStep() {
  const step = state.steps[state.index]
  if (!step) return
  const route = step.target_route
  if (route && route !== currentPath() && _router) {
    try { await _router.push(route) } catch { /* ignore nav abort */ }
  }
}

async function launch(slug, { restart = false } = {}) {
  state.loading = true
  try {
    const { data } = await api.getHelpGuidedTour(slug)
    state.tour = data.tour
    state.steps = data.steps || []
    state.slug = slug
    // Resume: backend progress (logged-in) or localStorage; restart forces step 0.
    let start = 0
    if (!restart) {
      const local = loadLocal()[slug]
      if (data.tour?.status === 'in_progress') start = data.tour.current_step || 0
      else if (local?.status === 'in_progress') start = local.step || 0
    }
    state.index = Math.min(Math.max(0, start), Math.max(0, state.steps.length - 1))
    state.active = state.steps.length > 0
    if (!state.active) return false
    api.startHelpTour(slug, { current_step: state.index }).catch(() => {})
    saveLocal(slug, 'in_progress', state.index)
    await navigateForStep()
    return true
  } catch (e) {
    state.active = false
    return false
  } finally {
    state.loading = false
  }
}

function persistStep() {
  api.progressHelpTour(state.slug, { current_step: state.index }).catch(() => {})
  saveLocal(state.slug, 'in_progress', state.index)
}

async function next() {
  if (state.index < state.steps.length - 1) {
    state.index += 1
    persistStep()
    await navigateForStep()
  } else {
    await finish()
  }
}
async function back() {
  if (state.index > 0) {
    state.index -= 1
    persistStep()
    await navigateForStep()
  }
}
function goToStep(i) {
  if (i >= 0 && i < state.steps.length) { state.index = i; persistStep(); navigateForStep() }
}
async function finish() {
  api.completeHelpTour(state.slug).catch(() => {})
  saveLocal(state.slug, 'completed', state.steps.length)
  close()
}
async function skip() {
  api.skipHelpTour(state.slug).catch(() => {})
  saveLocal(state.slug, 'skipped', state.index)
  close()
}
function close() {
  state.active = false
  state.tour = null
  state.steps = []
  state.index = 0
}

export function useGuidedTour() {
  return { state, launch, next, back, goToStep, finish, skip, close, registerRouter }
}
