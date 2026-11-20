// Focus handling shared by AppDialog and AppSheet (ADM-1333).
//
// Reka returns focus only to a <DialogTrigger>. Most of our dialogs are opened from code (a keyboard shortcut, a
// toolbar menu item, a node double-click), so the element that had focus when the dialog opened is remembered here
// and focused again when it closes. `initialFocus` (an element, a component, a ref, or a function returning one)
// picks where focus lands on open; without it Reka focuses the first focusable element.
import { unref } from 'vue'

function asElement(target) {
  const value = unref(typeof target === 'function' ? target() : target)
  if (!value) return null
  if (value instanceof HTMLElement) return value
  return value.$el instanceof HTMLElement ? value.$el : null
}

export function useOpenerFocus(getInitialFocus = () => null) {
  let opener = null

  function remember() {
    if (typeof document === 'undefined') return
    const el = document.activeElement
    opener = el && el !== document.body ? el : null
  }

  function onOpenAutoFocus(event) {
    const el = asElement(getInitialFocus())
    if (!el) return
    event.preventDefault()
    el.focus()
  }

  function onCloseAutoFocus(event) {
    const el = opener
    opener = null
    if (!el || !el.isConnected) return
    event.preventDefault()
    el.focus()
  }

  return { remember, onOpenAutoFocus, onCloseAutoFocus }
}
