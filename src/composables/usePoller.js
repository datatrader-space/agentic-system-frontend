// One poller for the whole app (page-speed plan Phase 5 item 1).
//
// Every page that refreshes something on a timer uses this instead of a bare setInterval, so that
// each of them, without the page having to remember:
//   - pauses while the tab is hidden and polls once as soon as it is visible again
//   - stops for good on a final state (the caller's `stopWhen(result)` predicate)
//   - backs off exponentially after an error, and recovers its normal pace after a success
//     (one failed poll never stops updates forever)
//   - never runs two polls at once (in-flight guard), so end-of-run side effects cannot repeat
//   - is cancelled when its component / effect scope goes away (onScopeDispose), and aborts the
//     request it has in flight through the AbortSignal it hands to `fn`
//
// Usage:
//   const poller = usePoller(async ({ signal }) => {
//     const { data } = await api.get(`/runs/${id}/`, { signal })
//     run.value = data
//     return data
//   }, { interval: 2000, stopWhen: (d) => ['done', 'failed'].includes(d?.status) })
//   poller.start()          // first poll runs now (pass { immediate: false } to wait one interval)
//   poller.stop()
import { ref, getCurrentScope, getCurrentInstance, onScopeDispose, onActivated, onDeactivated } from 'vue'

export function usePoller(fn, options = {}) {
  const {
    interval = 5000,
    maxInterval = 60000,
    stopWhen = null,
    pauseWhenHidden = true,
    onError = null,
  } = options

  const active = ref(false)
  const inFlight = ref(false)
  const error = ref(null)
  let timer = null
  let failures = 0
  let controller = null
  let pendingWhileHidden = false
  let disposed = false

  const hidden = () => pauseWhenHidden && typeof document !== 'undefined' && document.hidden

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null }
  }

  function nextDelay() {
    if (!failures) return interval
    return Math.min(interval * 2 ** failures, maxInterval)
  }

  function schedule(delay = nextDelay()) {
    clearTimer()
    if (!active.value) return
    timer = setTimeout(tick, delay)
  }

  async function tick() {
    timer = null
    if (!active.value) return
    if (hidden()) { pendingWhileHidden = true; return }
    if (inFlight.value) return
    inFlight.value = true
    controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    let result
    let failed = false
    try {
      result = await fn({ signal: controller?.signal })
      failures = 0
      error.value = null
    } catch (e) {
      failed = true
      if (!active.value) return
      failures += 1
      error.value = e
      if (onError) { try { onError(e) } catch { /* a broken handler must not stop polling */ } }
    } finally {
      inFlight.value = false
      controller = null
    }
    if (!active.value) return
    if (!failed && stopWhen) {
      let done = false
      try { done = !!stopWhen(result) } catch { done = false }
      if (done) { stop(); return }
    }
    schedule()
  }

  function onVisibility() {
    if (!active.value || hidden()) return
    if (pendingWhileHidden) {
      pendingWhileHidden = false
      clearTimer()
      tick()
    }
  }

  function start({ immediate = true } = {}) {
    if (disposed) return
    if (active.value) return
    active.value = true
    failures = 0
    if (pauseWhenHidden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }
    if (immediate) tick()
    else schedule(interval)
  }

  function stop() {
    active.value = false
    pendingWhileHidden = false
    clearTimer()
    if (controller) { try { controller.abort() } catch { /* ignore */ } controller = null }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
  }

  // Poll now (e.g. after a user action), keeping the schedule.
  function refresh() {
    if (!active.value || inFlight.value) return
    clearTimer()
    tick()
  }

  if (getCurrentScope()) {
    onScopeDispose(() => { disposed = true; stop() })
  }

  // Inside <KeepAlive> (Settings sections, agent editor steps) a hidden view is deactivated, not unmounted:
  // pause with it, and poll once as soon as it is shown again, as for a hidden tab.
  let pausedByKeepAlive = false
  if (getCurrentInstance()) {
    onDeactivated(() => {
      if (active.value) { pausedByKeepAlive = true; stop() }
    })
    onActivated(() => {
      if (pausedByKeepAlive && !disposed) { pausedByKeepAlive = false; start() }
    })
  }

  return { start, stop, refresh, active, inFlight, error }
}

export default usePoller
