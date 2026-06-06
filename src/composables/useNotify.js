// Production notification helper — the single, explicit way to show a transient
// message to the user. Wraps vue-toastification so call sites never touch the
// native browser alert() (which is blocking, unstyled, and un-brandable).
//
// Usage (anywhere — components, stores, plain .js modules):
//   import { notify } from '@/composables/useNotify'
//   notify.success('Agent saved')
//   notify.error('Failed to save agent: ' + reason)
//
// Or inside a component if you prefer the composable form:
//   const notify = useNotify()
//
// useToast() is resolved lazily (first call) so this module is safe to import
// before app.use(Toast) runs — the toast plugin installs a global event bus,
// so calls work from outside the Vue setup() context too.
import { useToast } from 'vue-toastification'

let _toast = null
function toast() {
  if (!_toast) _toast = useToast()
  return _toast
}

const str = (m) => (m == null ? '' : String(m))

export const notify = {
  success: (m, o) => toast().success(str(m), o),
  error: (m, o) => toast().error(str(m), o, { timeout: 6000, ...o }),
  info: (m, o) => toast().info(str(m), o),
  warning: (m, o) => toast().warning(str(m), o),
  // generic — picks a sensible level from the text, mirrors the old window.alert net
  show: (m, o) => {
    const t = str(m)
    if (/(fail|error|invalid|denied|unable|could ?n.?t|wrong|exceed|missing|not found)/i.test(t)) {
      return toast().error(t, { timeout: 6000, ...o })
    }
    if (/(success|saved|created|updated|deleted|done|copied|added|sent)/i.test(t)) {
      return toast().success(t, o)
    }
    return toast().info(t, o)
  },
}

export function useNotify() {
  return notify
}

export default notify
