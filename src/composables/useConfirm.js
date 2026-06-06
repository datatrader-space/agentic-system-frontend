// Production confirm dialog — a promise-based replacement for the native,
// blocking window.confirm(). Backed by a single <ConfirmDialog> host mounted
// once at the app root (see app.vue). State lives in a module-level reactive
// singleton so it can be driven from anywhere, including plain .js modules.
//
// Usage:
//   import { confirm } from '@/composables/useConfirm'
//
//   // simplest — a question string:
//   if (!(await confirm('Delete this agent?'))) return
//
//   // full options (recommended for destructive actions):
//   const ok = await confirm({
//     title: 'Delete agent?',
//     message: 'This permanently deletes the agent and all its data.',
//     confirmText: 'Delete',
//     danger: true,
//   })
//   if (!ok) return
//
// The enclosing function must be `async` to `await` the result.
import { reactive } from 'vue'

export const confirmState = reactive({
  open: false,
  title: 'Are you sure?',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  danger: false,
  _resolve: null,
})

/**
 * Open the confirm dialog. Resolves to `true` (confirmed) or `false` (cancelled).
 * @param {string|object} options - a message string, or an options object.
 * @returns {Promise<boolean>}
 */
export function confirm(options = {}) {
  if (typeof options === 'string') options = { message: options }
  // Resolve any dialog already on screen as cancelled before opening a new one.
  if (confirmState._resolve) confirmState._resolve(false)

  confirmState.title = options.title || 'Are you sure?'
  confirmState.message = options.message || ''
  confirmState.confirmText = options.confirmText || 'Confirm'
  confirmState.cancelText = options.cancelText || 'Cancel'
  confirmState.danger = options.danger || false
  confirmState.open = true

  return new Promise((resolve) => {
    confirmState._resolve = resolve
  })
}

// Called by the <ConfirmDialog> host when the user chooses.
export function _settleConfirm(value) {
  confirmState.open = false
  const r = confirmState._resolve
  confirmState._resolve = null
  if (r) r(value)
}

export function useConfirm() {
  return confirm
}

export default confirm
