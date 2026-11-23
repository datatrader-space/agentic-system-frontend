// A stand-in for the parts of Monaco the inline edit (ADM-1315) uses, for its tests: a text model, an editor with
// decorations, view zones and overlay widgets, and the namespace's Range and options. Test code only.
import { vi } from 'vitest'

export class Range {
  constructor(sl, sc, el, ec) {
    this.startLineNumber = sl; this.startColumn = sc; this.endLineNumber = el; this.endColumn = ec
  }
}

export function fakeMonaco() {
  return {
    Range,
    KeyMod: { CtrlCmd: 2048 },
    KeyCode: { KeyK: 41, KeyL: 42 },
    editor: {
      setTheme() {}, setModelLanguage() {},
      TrackedRangeStickiness: { NeverGrowsWhenTypingAtEdges: 1 },
      EditorOption: { fontInfo: 50, lineHeight: 66 },
    },
    languages: { getLanguages: () => [] },
  }
}

export function fakeModel(text) {
  let value = text
  const lines = () => value.split('\n')
  const offset = (line, col) => lines().slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0) + col - 1
  return {
    getValue: () => value,
    setValue: (v) => { value = v },
    getEOL: () => '\n',
    getLineCount: () => lines().length,
    getLineContent: (n) => lines()[n - 1],
    getLineMaxColumn: (n) => lines()[n - 1].length + 1,
    getLanguageId: () => 'plaintext',
    updateOptions() {},
    getValueInRange: (r) => value.slice(offset(r.startLineNumber, r.startColumn), offset(r.endLineNumber, r.endColumn)),
    applyEdit(r, t) {
      value = value.slice(0, offset(r.startLineNumber, r.startColumn)) + t + value.slice(offset(r.endLineNumber, r.endColumn))
    },
  }
}

export function fakeEditor(model, { selection } = {}) {
  const zones = new Map()
  const overlays = new Set()
  const actions = {}
  const decorations = []
  let nextZone = 1
  const ev = () => () => ({ dispose() {} })
  const ed = {
    zones, overlays, actions, decorations,
    getModel: () => model,
    getSelection: () => selection,
    setSelection(s) { selection = s },
    focus: vi.fn(),
    getAction: (id) => actions[id] && { run: () => actions[id].run(ed) },
    addAction(a) { actions[a.id] = a; return { dispose() { delete actions[a.id] } } },
    createDecorationsCollection(list) {
      const c = { list: [...list], getRanges: () => c.list.map((d) => d.range), clear() { c.list = [] }, set(l) { c.list = [...l] } }
      decorations.push(c)
      return c
    },
    addOverlayWidget: (w) => overlays.add(w),
    removeOverlayWidget: (w) => overlays.delete(w),
    changeViewZones(cb) {
      cb({
        addZone(z) { const id = nextZone++; zones.set(id, z); z.onDomNodeTop?.(40 * id); return id },
        removeZone(id) { zones.delete(id) },
      })
    },
    getLayoutInfo: () => ({ contentLeft: 60, width: 900, verticalScrollbarWidth: 14, minimap: { minimapWidth: 0 } }),
    getOption: (o) => (o === 50 ? { fontFamily: 'Consolas', fontSize: 14 } : 19),
    pushUndoStop: vi.fn(),
    executeEdits: vi.fn((_src, edits) => { for (const e of edits) model.applyEdit(e.range, e.text) }),
    onDidLayoutChange: ev(), onDidFocusEditorWidget: ev(), onDidBlurEditorWidget: ev(), onDidChangeCursorPosition: ev(),
    onDidDispose: ev(),
  }
  return ed
}
