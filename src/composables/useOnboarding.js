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

// The id of the signed-in user, learned from hydrateFromUser. A dismissal whose PATCH failed is
// remembered for THIS user only (the mirror is per browser, not per account).
let currentUserId = null

function persistCompleted(value) {
  return api.updateOnboarding({ onboarding_completed: value })
    .then(() => { saveMirror({ pendingSyncFor: null }) })
    .catch(() => { /* kept as pendingSyncFor; retried on the next hydrate */ })
}

// Reconcile with the authoritative backend flag (called when currentUser loads).
// Exception: the person dismissed the welcome/tour here but the PATCH failed (offline, 5xx). The
// backend still says "not completed", and believing it made the welcome modal come back on every
// page load. Keep the local dismissal for that user and retry the PATCH instead.
function hydrateFromUser(user) {
  if (user && user.id != null) currentUserId = user.id
  if (user && typeof user.onboarding_completed === 'boolean') {
    const mirror = loadMirror()
    const pendingForThisUser = mirror.pendingSyncFor != null && String(mirror.pendingSyncFor) === String(user.id)
    if (!user.onboarding_completed && pendingForThisUser && mirror.completed) {
      state.completed = true
      persistCompleted(true)
    } else {
      state.completed = user.onboarding_completed
      saveMirror({ completed: state.completed, pendingSyncFor: null })
    }
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
    saveMirror({ completed: true, pendingSyncFor: currentUserId })
    persistCompleted(true)
  }
}

// Replay: clear completion and relaunch (used by "Take a tour" / Settings).
function resetTour() {
  state.completed = false
  saveMirror({ completed: false, pendingSyncFor: null })
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
