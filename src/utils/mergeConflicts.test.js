// A merge's conflict blocks and VS Code's per-block actions (ADM-1205): found in the text, resolved to one side or
// both, and in the editor: three actions above each block, the sides coloured, one undoable edit per click.
import { describe, it, expect, vi } from 'vitest'
import { findConflicts, resolveConflict, resolvedText, bindConflictActions, CHOICES } from './mergeConflicts'

const TWO = [
  'import a',
  '<<<<<<< HEAD',
  'const x = 1',
  '=======',
  'const x = 2',
  'const y = 3',
  '>>>>>>> origin/main',
  'middle',
  '<<<<<<< HEAD',
  'mine',
  '||||||| base',
  'old',
  '=======',
  'theirs',
  '>>>>>>> origin/main',
  'end',
  '',
].join('\n')

describe('conflict blocks', () => {
  it('every complete block, with and without a base section', () => {
    expect(findConflicts(TWO)).toEqual([
      { start: 2, base: null, sep: 4, end: 7, currentLabel: 'HEAD', incomingLabel: 'origin/main' },
      { start: 9, base: 11, sep: 13, end: 15, currentLabel: 'HEAD', incomingLabel: 'origin/main' },
    ])
  })
  it('an unclosed block, a longer run of signs and text that only looks alike are not blocks', () => {
    expect(findConflicts('<<<<<<< HEAD\na\n=======\nb\n')).toEqual([])
    expect(findConflicts('<<<<<<<< x\na\n========\nb\n>>>>>>>> y\n')).toEqual([])
    expect(findConflicts('a <<<<<<< b\n=======\n')).toEqual([])
  })
  it('current, incoming or both; the base section is dropped', () => {
    const [first, second] = findConflicts(TWO)
    expect(resolveConflict(TWO, first, 'current').split('\n').slice(0, 3)).toEqual(['import a', 'const x = 1', 'middle'])
    expect(resolveConflict(TWO, first, 'incoming').split('\n').slice(0, 4)).toEqual(['import a', 'const x = 2', 'const y = 3', 'middle'])
    expect(resolveConflict(TWO, first, 'both').split('\n').slice(0, 5)).toEqual(['import a', 'const x = 1', 'const x = 2', 'const y = 3', 'middle'])
    expect(resolveConflict(TWO, second, 'both').split('\n').slice(-4)).toEqual(['middle', 'mine', 'theirs', 'end', ''].slice(-4))
    expect(resolvedText(TWO, second, 'current')).toBe('mine\n')
  })
  it('Windows line breaks are kept', () => {
    const crlf = TWO.replace(/\n/g, '\r\n')
    const [first] = findConflicts(crlf)
    expect(resolveConflict(crlf, first, 'current').startsWith('import a\r\nconst x = 1\r\nmiddle\r\n')).toBe(true)
    expect(resolvedText(crlf, first, 'incoming')).toBe('const x = 2\r\nconst y = 3\r\n')
  })
})

// A stand-in for the parts of Monaco the actions use, over a plain text.
function fakeEditor(text) {
  class Range { constructor(a, b, c, d) { Object.assign(this, { startLineNumber: a, startColumn: b, endLineNumber: c, endColumn: d }) } }
  let value = text
  const lines = () => value.split('\n')
  const model = {
    getValue: () => value,
    getLineCount: () => lines().length,
    getLineMaxColumn: (n) => lines()[n - 1].length + 1,
  }
  const offset = (line, col) => lines().slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0) + col - 1
  const listeners = []
  let handler = null
  const providers = []
  const deco = { set: vi.fn(), clear: vi.fn() }
  const ed = {
    getModel: () => model,
    addCommand: vi.fn((_kb, h) => { handler = h; return 'cmd-1' }),
    executeEdits: vi.fn((_src, edits) => {
      for (const { range, text: t } of edits) {
        value = value.slice(0, offset(range.startLineNumber, range.startColumn)) + t + value.slice(offset(range.endLineNumber, range.endColumn))
      }
      listeners.forEach((f) => f())
    }),
    pushUndoStop: vi.fn(),
    focus: vi.fn(),
    createDecorationsCollection: vi.fn(() => deco),
    onDidChangeModelContent: (f) => { listeners.push(f); return { dispose: vi.fn() } },
    onDidChangeModel: () => ({ dispose: vi.fn() }),
  }
  const monaco = {
    Range,
    Emitter: class { constructor() { this.event = () => ({ dispose() {} }); this.fire = vi.fn(); this.dispose = vi.fn() } },
    languages: { registerCodeLensProvider: vi.fn((_sel, p) => { providers.push(p); return { dispose: vi.fn() } }) },
  }
  return { ed, monaco, model, providers, deco, run: (...a) => handler(null, ...a), text: () => value }
}

describe('in the editor', () => {
  it('three actions above each block, each runs its choice', () => {
    const f = fakeEditor(TWO)
    bindConflictActions({ monaco: () => f.monaco, editor: () => f.ed })
    const { lenses } = f.providers[0].provideCodeLenses(f.model)
    expect(lenses.map((l) => [l.range.startLineNumber, l.command.title, l.command.arguments])).toEqual([
      [2, 'Accept current change', [2, 'current']], [2, 'Accept incoming change', [2, 'incoming']], [2, 'Accept both changes', [2, 'both']],
      [9, 'Accept current change', [9, 'current']], [9, 'Accept incoming change', [9, 'incoming']], [9, 'Accept both changes', [9, 'both']],
    ])
    expect(CHOICES.map((c) => c.title)).toEqual(['Accept current change', 'Accept incoming change', 'Accept both changes'])
    expect(f.providers[0].provideCodeLenses({ other: true }).lenses).toEqual([])   // another editor's file
  })
  it('a click is one undoable edit; the block below is found again where it moved to', () => {
    const f = fakeEditor(TWO)
    bindConflictActions({ monaco: () => f.monaco, editor: () => f.ed })
    f.run(2, 'incoming')
    expect(f.ed.pushUndoStop).toHaveBeenCalledTimes(2)
    expect(f.ed.executeEdits).toHaveBeenCalledTimes(1)
    expect(f.text().split('\n').slice(0, 4)).toEqual(['import a', 'const x = 2', 'const y = 3', 'middle'])
    const [moved] = findConflicts(f.text())
    expect(moved.start).toBe(5)
    f.run(5, 'both')
    expect(f.text()).toBe('import a\nconst x = 2\nconst y = 3\nmiddle\nmine\ntheirs\nend\n')
    f.run(5, 'current')                                     // no block starts there any more: nothing changes
    expect(f.ed.executeEdits).toHaveBeenCalledTimes(2)
  })
  it('a block that ends the file keeps no extra line break', () => {
    const f = fakeEditor('a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> x')
    bindConflictActions({ monaco: () => f.monaco, editor: () => f.ed })
    f.run(2, 'current')
    expect(f.text()).toBe('a\nb')
  })
  it('each side is coloured, the markers a stronger tint', () => {
    const f = fakeEditor(TWO)
    bindConflictActions({ monaco: () => f.monaco, editor: () => f.ed })
    const deco = f.ed.createDecorationsCollection.mock.calls[0][0]
    expect(deco.map((d) => [d.range.startLineNumber, d.options.className])).toEqual([
      [2, 'lc-conflict-current-head'], [3, 'lc-conflict-current'], [4, 'lc-conflict-sep'], [5, 'lc-conflict-incoming'],
      [6, 'lc-conflict-incoming'], [7, 'lc-conflict-incoming-head'],
      [9, 'lc-conflict-current-head'], [10, 'lc-conflict-current'], [11, 'lc-conflict-base'], [12, 'lc-conflict-base'],
      [13, 'lc-conflict-sep'], [14, 'lc-conflict-incoming'], [15, 'lc-conflict-incoming-head'],
    ])
  })
  it('released, nothing is left registered', () => {
    const f = fakeEditor(TWO)
    const release = bindConflictActions({ monaco: () => f.monaco, editor: () => f.ed })
    release()
    expect(f.monaco.languages.registerCodeLensProvider.mock.results[0].value.dispose).toHaveBeenCalled()
    expect(f.deco.clear).toHaveBeenCalled()
  })
})
