// First-run onboarding state — drives the feature tour (FeatureTour.vue) and the
// "welcome / create an agent" modal.
//
// Source of truth is the backend User flag (`onboarding_completed`, via GET /auth/me),
// so the tour follows the user across devices. localStorage is only a fast first-paint
// mirror to avoid a flash before /auth/me resolves. Completion PATCHes the backend
// best-effort — the UX never blocks on the network call.
import { reactive } from 'vue'
import api from '../services/api'

const LS_KEY = 'v2_onboarding'

function loadMirror() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {}
  } catch {
    return {}
  }
}

function saveMirror(patch) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...loadMirror(), ...patch }))
  } catch {
    /* ignore quota / disabled storage */
  }
}

// Singleton reactive state shared by every consumer.
const state = reactive({
  // True once the user has finished or skipped the tour. Seeded from the LS mirror
  // for instant first paint; corrected by hydrateFromUser() when /auth/me resolves.
  completed: !!loadMirror().completed,
  hydrated: false, // becomes true after the backend flag is read
  active: false, // tour overlay currently showing
  step: 0,
})

// Reconcile with the authoritative backend flag (called when currentUser loads).
function hydrateFromUser(user) {
  if (user && typeof user.onboarding_completed === 'boolean') {
    state.completed = user.onboarding_completed
    saveMirror({ completed: state.completed })
  }
  state.hydrated = true
}

function isTourCompleted() {
  return state.completed
}

function startTour() {
  state.step = 0
  state.active = true
}

function nextStep() {
  state.step += 1
}

function prevStep() {
  if (state.step > 0) state.step -= 1
}

function goToStep(i) {
  state.step = Math.max(0, i)
}

// End the tour. `completed=true` marks onboarding done (skip counts as done too, so
// it never auto-nags again); persist locally + best-effort to the backend.
function endTour(completed = true) {
  state.active = false
  if (completed) {
    state.completed = true
    saveMirror({ completed: true })
    api.updateOnboarding({ onboarding_completed: true }).catch(() => {})
  }
}

// Replay: clear completion and relaunch (used by "Take a tour" / Settings).
function resetTour() {
  state.completed = false
  saveMirror({ completed: false })
  api.updateOnboarding({ onboarding_completed: false }).catch(() => {})
  startTour()
}

export function useOnboarding() {
  return {
    state,
    hydrateFromUser,
    isTourCompleted,
    startTour,
    nextStep,
    prevStep,
    goToStep,
    endTour,
    resetTour,
  }
}
