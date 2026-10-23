// Abort requests a page no longer needs, and drop responses that arrive for an old input
// (page-speed plan Phase 5 item 2).
//
//   const scope = useRequestScope()
//   async function load() {
//     const signal = scope.next()                 // aborts the previous load of THIS scope
//     try {
//       const { data } = await api.get('/things/', { params, signal })
//       if (signal.aborted) return                // superseded while awaiting (stale response)
//       items.value = data
//     } catch (e) {
//       if (isAbortError(e) || signal.aborted) return
//       error.value = e
//     }
//   }
//
// Everything still in flight is aborted when the component (effect scope) is disposed, which is what
// happens on route leave and on unmount.
import { getCurrentScope, onScopeDispose } from 'vue'
import { isAbortError } from '@/services/api'

export { isAbortError }

export function useRequestScope() {
  let controller = null
  let disposed = false

  function next() {
    if (controller) controller.abort()
    controller = new AbortController()
    if (disposed) controller.abort()
    return controller.signal
  }

  function abort() {
    if (controller) controller.abort()
    controller = null
  }

  if (getCurrentScope()) {
    onScopeDispose(() => { disposed = true; abort() })
  }

  return {
    next,
    abort,
    get disposed() { return disposed },
  }
}

export default useRequestScope
