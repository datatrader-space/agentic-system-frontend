// Where the focus goes when a dialog of the editor's bar closes (Commands, Variables, pull request tasks, Deploy): its
// own button, as before. On a phone that bar is hidden and the dialog was opened from the header row's More menu
// (LetsCodePhoneBar, ADM-1330), so the focus goes back to that menu's button instead of being lost on the page.
export const FOCUS_FALLBACK = 'lc-more'

export function returnFocus(trigger) {
  const shown = trigger && (typeof trigger.checkVisibility !== 'function' || trigger.checkVisibility())
  if (shown) { trigger.focus(); return }
  document.querySelector(`[data-focus-fallback="${FOCUS_FALLBACK}"]`)?.focus()
}
