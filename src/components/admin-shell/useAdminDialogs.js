import { onMounted, onBeforeUnmount } from 'vue'

// Progressive focus handling for existing admin dialogs, including editor dialogs teleported to body.
// Their existing cancel/close handlers remain responsible for changing component state.
export function useAdminDialogs() {
  let observer, active = null
  const returnFocus = new WeakMap()
  const visible = el => el.isConnected && el.getClientRects().length > 0
  function synchronize() {
    const dialogs = [...document.querySelectorAll('.admin-dialog')].filter(visible)
    const next = dialogs.at(-1) || null
    if (next === active) return
    const previous = active
    if (next) {
      if (!returnFocus.has(next)) returnFocus.set(next, document.activeElement)
      active = next
      if (!next.contains(document.activeElement)) next.focus()
    } else {
      active = null
      const target = previous && returnFocus.get(previous)
      if (target?.isConnected) target.focus()
    }
  }
  function onKeydown(event) {
    if (!active || event.defaultPrevented) return
    if (event.key === 'Escape') {
      const overlay = active.closest('.admin-overlay,.fixed.inset-0')
      if (overlay) { event.preventDefault(); overlay.click() }
      return
    }
    if (event.key !== 'Tab') return
    const targets = [...active.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(visible)
    if (!targets.length) { event.preventDefault(); active.focus(); return }
    const first = targets[0], last = targets.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === active)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === active)) { event.preventDefault(); first.focus() }
  }
  onMounted(() => { observer = new MutationObserver(synchronize); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] }); document.addEventListener('keydown', onKeydown); synchronize() })
  onBeforeUnmount(() => { observer?.disconnect(); document.removeEventListener('keydown', onKeydown); active = null })
}
