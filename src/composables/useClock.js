// A single shared 1-second ticking clock (Date.now() in ms) for live elapsed timers on
// running activity steps — so a long-running command shows a visibly-advancing duration
// instead of a static "…". One interval for the whole app; components just read the ref.
import { ref } from 'vue'

const nowMs = ref(Date.now())
let started = false

export function useClock() {
  if (!started) {
    started = true
    setInterval(() => { nowMs.value = Date.now() }, 1000)
  }
  return nowMs
}
