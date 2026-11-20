// The Terminal's two shortcuts, as in VS Code (ADM-1325): Ctrl+` shows or hides the Terminal, Ctrl+Shift+` opens a
// new shell. Read by the bottom panel (which acts on them) and by each terminal (which lets only these two through
// to the page, so every other key still reaches the shell). By the key's place (`code`), so Shift+` (~ on a US
// keyboard) is still the same key.
export function terminalShortcut(e) {
  if (!e || !(e.ctrlKey || e.metaKey) || e.altKey) return null
  const backquote = e.code === 'Backquote' || e.key === '`' || (e.shiftKey && e.key === '~')
  if (!backquote) return null
  return e.shiftKey ? 'new' : 'toggle'
}
