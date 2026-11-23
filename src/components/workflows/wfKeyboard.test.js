// @vitest-environment jsdom
// The builder's keyboard model (ADM-1333 plan §3.5, F13).
import { describe, it, expect } from 'vitest'
import { resolveShortcut, isTypingTarget, isComboboxTarget, neighbourId, shortcutGroups } from './wfKeyboard'

const key = (k, extra = {}) => ({ key: k, code: extra.code || '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra })
const act = (e, ctx) => resolveShortcut(e, ctx)?.action ?? null

describe('resolveShortcut', () => {
  it('reads letters case-insensitively, so Caps Lock or Shift never breaks copy and paste (F13)', () => {
    expect(act(key('c', { ctrlKey: true }))).toBe('copy')
    expect(act(key('C', { ctrlKey: true }))).toBe('copy')
    expect(act(key('V', { metaKey: true }))).toBe('paste')
    expect(act(key('X', { ctrlKey: true }))).toBe('cut')
    expect(act(key('D', { ctrlKey: true }))).toBe('duplicate')
    expect(act(key('a', { metaKey: true }))).toBe('select-all')
  })

  it('turns the selected steps off or on with D (ADM-1343); mod+D stays Duplicate, and typing D types', () => {
    expect(act(key('d'))).toBe('toggle-off')
    expect(act(key('D', { shiftKey: true }))).toBe('toggle-off')
    expect(act(key('d', { ctrlKey: true }))).toBe('duplicate')
    expect(act(key('d'), { typing: true })).toBeNull()
    expect(act(key('d'), { layerOpen: true })).toBeNull()
    expect(act(key('d', { altKey: true }))).toBeNull()
    expect(shortcutGroups('Ctrl').flatMap((g) => g.rows).some(([keys, what]) => keys.join('+') === 'D' && /off or on/.test(what))).toBe(true)
  })

  it('undoes with mod+Z and redoes with mod+Shift+Z or mod+Y', () => {
    expect(act(key('z', { ctrlKey: true }))).toBe('undo')
    expect(act(key('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo')
    expect(act(key('y', { metaKey: true }))).toBe('redo')
  })

  it('adds a step with N, mod+K, and Tab from the empty canvas only', () => {
    expect(act(key('n'))).toBe('add')
    expect(act(key('N'))).toBe('add')
    expect(act(key('k', { ctrlKey: true }))).toBe('add')
    expect(act(key('Tab'), { onCanvas: true })).toBe('add')
    expect(act(key('Tab'))).toBeNull()                                   // a toolbar button keeps Tab for focus
    expect(act(key('Tab'), { onCanvas: true, onNode: true })).toBeNull()
    expect(act(key('Tab', { shiftKey: true }), { onCanvas: true })).toBeNull()
  })

  it('ignores every canvas key while typing, but keeps save, add, run and Escape', () => {
    const typing = { typing: true }
    for (const e of [key('n'), key('Delete'), key('Backspace'), key('l'), key('1'), key('c', { ctrlKey: true }), key('z', { ctrlKey: true }), key('a', { ctrlKey: true })]) {
      expect(act(e, typing)).toBeNull()
    }
    expect(act(key('s', { ctrlKey: true }), typing)).toBe('save')
    expect(act(key('k', { metaKey: true }), typing)).toBe('add')
    expect(act(key('Enter', { ctrlKey: true }), typing)).toBe('run')
  })

  it('Escape in a field only leaves the field; in a list search box it closes the list', () => {
    expect(act(key('Escape'), { typing: true })).toBe('escape-field')
    expect(act(key('Escape'), { typing: true, layerOpen: true })).toBe('escape-field')
    expect(act(key('Escape'), { typing: true, combobox: true, layerOpen: true })).toBeNull()   // the dialog closes itself
  })

  it('Escape closes the top layer first (left to the layer), then clears the selection', () => {
    expect(act(key('Escape'), { layerOpen: true })).toBeNull()
    expect(act(key('Escape'))).toBe('escape')
  })

  it('does nothing but save and add while a dialog or sheet is open', () => {
    const layer = { layerOpen: true }
    expect(act(key('n'), layer)).toBeNull()
    expect(act(key('Delete'), layer)).toBeNull()
    expect(act(key('z', { ctrlKey: true }), layer)).toBeNull()
    expect(act(key('Enter', { ctrlKey: true }), layer)).toBeNull()
    expect(act(key('s', { ctrlKey: true }), layer)).toBe('save')
    expect(act(key('k', { ctrlKey: true }), layer)).toBe('add')
  })

  it('maps the view keys', () => {
    expect(act(key('T', { shiftKey: true, altKey: true, code: 'KeyT' }))).toBe('tidy')
    expect(act(key('†', { shiftKey: true, altKey: true, code: 'KeyT' }))).toBe('tidy')   // Mac: Alt changes the character
    expect(act(key('1'))).toBe('fit')
    expect(act(key('0'))).toBe('reset-zoom')
    expect(act(key('+'))).toBe('zoom-in')
    expect(act(key('='))).toBe('zoom-in')
    expect(act(key('-'))).toBe('zoom-out')
    expect(act(key('l'))).toBe('console')
    expect(act(key('L'))).toBe('console')
    expect(act(key('?'))).toBe('shortcuts')
  })

  it('opens the focused step with Enter, renames with F2, deletes with Delete or Backspace', () => {
    expect(act(key('Enter'), { onNode: true })).toBe('open')
    expect(act(key('Enter'))).toBeNull()                                 // Enter on a button stays the button's
    expect(act(key('F2'))).toBe('rename')
    expect(act(key('Delete'))).toBe('delete')
    expect(act(key('Backspace'))).toBe('delete')
  })

  it('arrows go to a neighbour from a focused step; Alt+arrow nudges', () => {
    expect(resolveShortcut(key('ArrowRight'), { onNode: true })).toEqual({ action: 'neighbour', dir: 'right' })
    expect(act(key('ArrowRight'))).toBeNull()
    expect(resolveShortcut(key('ArrowUp', { altKey: true }))).toEqual({ action: 'nudge', dir: 'up' })
  })

  it('leaves the shell its own mod+B and mod+J', () => {
    expect(act(key('b', { ctrlKey: true }))).toBeNull()
    expect(act(key('j', { ctrlKey: true }))).toBeNull()
  })
})

describe('isTypingTarget / isComboboxTarget', () => {
  const el = (tag, attrs = {}) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e }
  it('counts text fields, not buttons or checkboxes', () => {
    expect(isTypingTarget(el('input'))).toBe(true)
    expect(isTypingTarget(el('input', { type: 'search' }))).toBe(true)
    expect(isTypingTarget(el('textarea'))).toBe(true)
    expect(isTypingTarget(el('select'))).toBe(true)
    expect(isTypingTarget(el('input', { type: 'checkbox' }))).toBe(false)
    expect(isTypingTarget(el('button'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
  it('knows a list search box', () => {
    expect(isComboboxTarget(el('input', { role: 'combobox' }))).toBe(true)
    expect(isComboboxTarget(el('input'))).toBe(false)
  })
})

describe('neighbourId', () => {
  const nodes = [
    { id: 'a', position: { x: 0, y: 0 } },
    { id: 'b', position: { x: 300, y: 10 } },
    { id: 'c', position: { x: 600, y: 0 } },
    { id: 'd', position: { x: 10, y: 200 } },
  ]
  it('finds the nearest step in the direction', () => {
    expect(neighbourId('a', 'right', nodes)).toBe('b')
    expect(neighbourId('b', 'right', nodes)).toBe('c')
    expect(neighbourId('c', 'left', nodes)).toBe('b')
    expect(neighbourId('a', 'down', nodes)).toBe('d')
    expect(neighbourId('d', 'up', nodes)).toBe('a')
  })
  it('returns null at the edge of the graph or for an unknown step', () => {
    expect(neighbourId('a', 'left', nodes)).toBeNull()
    expect(neighbourId('a', 'up', nodes)).toBeNull()
    expect(neighbourId('zz', 'up', nodes)).toBeNull()
  })
})

describe('shortcutGroups', () => {
  it('lists every action with the platform modifier', () => {
    const rows = shortcutGroups('⌘').flatMap((g) => g.rows)
    expect(rows.some(([keys, what]) => keys.join('+') === '⌘+Z' && what === 'Undo')).toBe(true)
    expect(rows.some(([keys]) => keys.includes('Ctrl'))).toBe(false)
  })
})
