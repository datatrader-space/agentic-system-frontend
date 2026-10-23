// A single shared 1-second ticking clock (Date.now() in ms) for live elapsed timers on
// running activity steps — so a long-running command shows a visibly-advancing duration
// instead of a static "…". One interval for the whole app; components just read the ref.
//
// The interval runs only while something uses the clock: each caller inside a component / effect
// scope is counted, and the interval stops when the last one is disposed (page-speed plan Phase 5).
import { ref, getCurrentScope, onScopeDispose } from 'vue'

const nowMs = ref(Date.now())
let timer = null
let users = 0

function release() {
  users = Math.max(0, users - 1)
  if (!users && timer) { clearInterval(timer); timer = null }
}

export function useClock() {
  // A caller outside any scope cannot be released, so it would keep the interval forever: refuse to
  // tick for it (the ref still holds the time it was read).
  if (!getCurrentScope()) return nowMs
  users += 1
  onScopeDispose(release)
  if (!timer) {
    nowMs.value = Date.now()
    timer = setInterval(() => { nowMs.value = Date.now() }, 1000)
  }
  return nowMs
}

// Test hook: how many scopes hold the clock, and whether it is ticking.
export function _clockState() { return { users, ticking: !!timer } }
