// The Workflow Builder's keyboard model (plan §3.5, F13). Pure: `resolveShortcut` turns a keydown into an action
// name, and the page runs the action. Tested without a DOM.
//
// Rules:
//   - While typing in a field, only Ctrl/⌘+S (save), Ctrl/⌘+K (add node), Ctrl/⌘+Enter (run) and Escape act. Escape in
//     a field only leaves the field; the field's own undo, copy and paste stay the browser's.
//   - While a dialog or sheet is open, only Escape (handled by the dialog itself), Ctrl/⌘+S and Ctrl/⌘+K act, and
//     Ctrl/⌘+K never opens the shell's own command palette as well.
//   - Letters are matched case-insensitively (F13: Caps Lock or Shift no longer breaks copy and paste).

/** True when the key goes into a text field: input, textarea, select or contenteditable. */
export function isTypingTarget(el) {
  if (!el || el.nodeType !== 1) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (el.getAttribute('type') || 'text').toLowerCase()
  return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image'].includes(type)
}

/** A search box that drives a list (the node picker): Escape there closes the list instead of only leaving it. */
export function isComboboxTarget(el) {
  return !!el && el.nodeType === 1 && el.getAttribute('role') === 'combobox'
}

const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

/**
 * The action for a keydown, or null.
 *   ctx.typing     the target is a text field (isTypingTarget)
 *   ctx.combobox   the target is a list's search box (isComboboxTarget)
 *   ctx.layerOpen  a dialog, sheet or confirmation is open
 *   ctx.onNode     the focus is on a node of the canvas
 *   ctx.onEdge     the focus is on a connection of the canvas
 *   ctx.onCanvas   the focus is on the canvas (the pane, a node or a connection)
 * Returns { action, dir? } where action is one of: save, add, run, escape-field, escape, undo, redo, copy, cut,
 * paste, duplicate, toggle-off, delete, select-all, tidy, fit, reset-zoom, zoom-in, zoom-out, console, open, rename,
 * neighbour (dir), nudge (dir), shortcuts.
 */
export function resolveShortcut(e, ctx = {}) {
  const mod = e.ctrlKey || e.metaKey
  const key = typeof e.key === 'string' ? e.key : ''
  const k = key.length === 1 ? key.toLowerCase() : key

  if (mod && !e.altKey && k === 's') return { action: 'save' }
  if (mod && !e.altKey && k === 'k') return { action: 'add' }
  if (key === 'Escape') {
    if (ctx.typing && !ctx.combobox) return { action: 'escape-field' }
    return ctx.layerOpen ? null : { action: 'escape' }
  }
  if (ctx.layerOpen) return null
  if (mod && key === 'Enter') return { action: 'run' }
  if (ctx.typing) return null

  if (mod) {
    if (e.altKey) return null
    if (k === 'z') return { action: e.shiftKey ? 'redo' : 'undo' }
    if (k === 'y') return { action: 'redo' }
    if (k === 'c') return { action: 'copy' }
    if (k === 'x') return { action: 'cut' }
    if (k === 'v') return { action: 'paste' }
    if (k === 'd') return { action: 'duplicate' }
    if (k === 'a') return { action: 'select-all' }
    return null
  }
  // ⇧⌥T: the code, because Alt changes the character on a Mac keyboard.
  if (e.shiftKey && e.altKey && e.code === 'KeyT') return { action: 'tidy' }
  if (e.altKey && ARROWS[key]) return { action: 'nudge', dir: ARROWS[key] }
  if (e.altKey) return null
  if (ARROWS[key] && ctx.onNode) return { action: 'neighbour', dir: ARROWS[key] }
  if (key === 'Delete' || key === 'Backspace') return { action: 'delete' }
  if (key === 'Enter' && (ctx.onNode || ctx.onEdge)) return { action: 'open' }
  if (key === 'F2') return { action: 'rename' }
  // Tab adds a step only from the empty canvas itself; everywhere else it keeps moving the focus.
  if (key === 'Tab' && !e.shiftKey && ctx.onCanvas && !ctx.onNode && !ctx.onEdge) return { action: 'add' }
  if (k === 'n') return { action: 'add' }
  if (k === 'd') return { action: 'toggle-off' }
  if (k === 'l') return { action: 'console' }
  if (key === '1') return { action: 'fit' }
  if (key === '0') return { action: 'reset-zoom' }
  if (key === '+' || key === '=') return { action: 'zoom-in' }
  if (key === '-' || key === '_') return { action: 'zoom-out' }
  if (key === '?') return { action: 'shortcuts' }
  return null
}

/**
 * The nearest node in direction `dir` from `fromId`, by the centres of the cards, or null. A node counts as being in
 * a direction when it lies inside the 90° cone that faces it; the nearest one wins.
 */
export function neighbourId(fromId, dir, nodes, sizeOf = () => ({ width: 200, height: 64 })) {
  const from = nodes.find((n) => n.id === fromId)
  if (!from) return null
  const centre = (n) => {
    const s = sizeOf(n) || { width: 200, height: 64 }
    return { x: n.position.x + s.width / 2, y: n.position.y + s.height / 2 }
  }
  const c = centre(from)
  let best = null
  let bestDist = Infinity
  for (const n of nodes) {
    if (n.id === fromId) continue
    const p = centre(n)
    const dx = p.x - c.x
    const dy = p.y - c.y
    const inCone = dir === 'right' ? dx > 0 && Math.abs(dy) <= dx
      : dir === 'left' ? dx < 0 && Math.abs(dy) <= -dx
        : dir === 'down' ? dy > 0 && Math.abs(dx) <= dy
          : dy < 0 && Math.abs(dx) <= -dy
    if (!inCone) continue
    const dist = dx * dx + dy * dy
    if (dist < bestDist) { bestDist = dist; best = n.id }
  }
  return best
}

export const NUDGE = { up: [0, -16], down: [0, 16], left: [-16, 0], right: [16, 0] }

// The Shortcuts sheet (plan §3.5). `mod` is shown as ⌘ on a Mac and Ctrl elsewhere.
export function shortcutGroups(mod = 'Ctrl') {
  return [
    { title: 'Add and open', rows: [
      [['N'], 'Add a step'], [['Tab'], 'Add a step (from the empty canvas)'], [[mod, 'K'], 'Add a step'],
      [['Enter'], 'Open the focused step'], [['Double-click'], 'Open a step'],
    ] },
    { title: 'Edit', rows: [
      [['F2'], 'Rename the selected step'], [[mod, 'Z'], 'Undo'], [[mod, 'Shift', 'Z'], 'Redo'],
      [[mod, 'C'], 'Copy'], [[mod, 'X'], 'Cut'], [[mod, 'V'], 'Paste'], [[mod, 'D'], 'Duplicate'],
      [['D'], 'Turn the selected steps off or on'],
      [['Delete'], 'Delete every selected item'], [[mod, 'A'], 'Select all'],
      [['Alt', 'Arrow'], 'Move the selected steps by one grid square'],
    ] },
    { title: 'View', rows: [
      [['Shift', 'Alt', 'T'], 'Tidy up'], [['1'], 'Fit the workflow'], [['0'], 'Zoom to 100%'],
      [['+'], 'Zoom in'], [['−'], 'Zoom out'], [['Arrow'], 'Go to the neighbouring step'],
    ] },
    { title: 'Run and panels', rows: [
      [['L'], 'Show or hide the console'], [[mod, 'Enter'], 'Run'], [[mod, 'S'], 'Save'], [['?'], 'These shortcuts'],
    ] },
    { title: 'Escape', rows: [
      [['Esc'], 'In a field: leave the field. Otherwise close the top panel, then clear the selection.'],
    ] },
  ]
}
