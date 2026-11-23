// @vitest-environment jsdom
// Inline edit on a selection (ADM-1315): what one press sends, where the prompt and the suggested lines go in the
// editor, and how Accept puts the change in (one undoable edit, only over the lines it was made for).
import { describe, it, expect } from 'vitest'
import { inlineEditRequest, requestForLines, changeSummary, mountInlineEdit, applyInlineEdit, CONTEXT_LINES } from './inlineEdit'
import { fakeMonaco, fakeModel, fakeEditor, Range } from './inlineEdit.testkit'

const TAB = { type: 'file', path: 'src/app.ts', language: 'typescript' }
const sel = (sl, sc, el, ec) => ({ startLineNumber: sl, startColumn: sc, endLineNumber: el, endColumn: ec })

describe('inlineEditRequest', () => {
  const model = fakeModel('import x\n\nlet a = 1\nlet b = 2\nexport { a, b }')
  it('sends the selected lines whole, the lines around them, the language and the words', () => {
    expect(inlineEditRequest(model, sel(3, 5, 4, 3), TAB, '  Use const ')).toEqual({
      path: 'src/app.ts', start_line: 3, end_line: 4, text: 'let a = 1\nlet b = 2',
      before: 'import x\n\n', after: 'export { a, b }\n', language: 'typescript', instruction: 'Use const',
    })
  })
  it('takes the cursor line when nothing is selected, an empty line too (write code there)', () => {
    expect(inlineEditRequest(model, sel(2, 1, 2, 1), TAB)).toMatchObject({ start_line: 2, end_line: 2, text: '' })
  })
  it('nothing for a tab that is not a file', () => {
    expect(inlineEditRequest(model, sel(1, 1, 1, 1), { type: 'diff', path: 'x' })).toBeNull()
  })
  it('the context is the nearest lines only', () => {
    const many = fakeModel(Array.from({ length: 200 }, (_, i) => `l${i + 1}`).join('\n'))
    const req = requestForLines(many, 100, 100, TAB)
    expect(req.before.split('\n').filter(Boolean)).toHaveLength(CONTEXT_LINES)
    expect(req.before.startsWith(`l${100 - CONTEXT_LINES}\n`)).toBe(true)
    expect(req.after.split('\n').filter(Boolean)).toHaveLength(CONTEXT_LINES)
  })
})

describe('changeSummary', () => {
  it('says how many lines become how many', () => {
    expect(changeSummary('a\nb', 'x\ny\nz')).toBe('2 lines become 3 lines')
    expect(changeSummary('a', 'b')).toBe('1 line becomes 1 line')
    expect(changeSummary('a\nb', '')).toBe('2 lines removed')
  })
})

describe('mountInlineEdit', () => {
  it('keeps room above the lines for the prompt, moves the widget onto it, and shows the change as text', () => {
    const m = fakeMonaco()
    const model = fakeModel('one\ntwo\nthree\nfour')
    const ed = fakeEditor(model)
    const host = document.createElement('div')
    const ie = mountInlineEdit(m, ed, { startLine: 2, endLine: 3, host })
    expect(ed.overlays.size).toBe(1)
    const [prompt] = [...ed.zones.values()]
    expect(prompt.afterLineNumber).toBe(1)
    expect(host.style.top).toBe('40px')                       // the zone's top, as Monaco reports it
    expect(host.style.left).toBe('60px')
    ie.setPromptHeight(90)
    expect([...ed.zones.values()][0].heightInPx).toBe(90)

    ie.showSuggestion('<img src=x onerror=alert(1)>\nTWO')
    const added = [...ed.zones.values()].find((z) => z.afterLineNumber === 3)
    expect(added.heightInLines).toBe(2)
    expect(added.domNode.querySelector('img')).toBeNull()      // the model's answer is text, never HTML
    expect(added.domNode.textContent).toBe('<img src=x onerror=alert(1)>TWO')
    expect(added.domNode.getAttribute('aria-hidden')).toBe('true')
    expect(ed.decorations.some((d) => d.list.some((x) => x.options.className === 'lc-ie-removed'))).toBe(true)

    ie.dispose()
    expect(ed.zones.size).toBe(0)
    expect(ed.overlays.size).toBe(0)
    expect(ed.decorations.every((d) => d.list.length === 0)).toBe(true)
  })
})

describe('applyInlineEdit', () => {
  const m = fakeMonaco()
  it('replaces the lines as one undoable edit', () => {
    const model = fakeModel('a\nlet x = 1\nlet y = 2\nz')
    const ed = fakeEditor(model)
    expect(applyInlineEdit(m, ed, new Range(2, 1, 3, 10), 'let x = 1\nlet y = 2', 'const x = 1\nconst y = 2')).toBe(true)
    expect(model.getValue()).toBe('a\nconst x = 1\nconst y = 2\nz')
    expect(ed.pushUndoStop).toHaveBeenCalledTimes(2)
    expect(ed.executeEdits).toHaveBeenCalledTimes(1)
  })
  it('refuses when the lines changed meanwhile, and changes nothing', () => {
    const model = fakeModel('a\nlet x = 99\nz')
    const ed = fakeEditor(model)
    expect(applyInlineEdit(m, ed, new Range(2, 1, 2, 11), 'let x = 1', 'const x = 1')).toBe(false)
    expect(model.getValue()).toBe('a\nlet x = 99\nz')
    expect(ed.executeEdits).not.toHaveBeenCalled()
  })
  it('an empty answer removes the lines with their line break', () => {
    const model = fakeModel('a\nb\nc')
    expect(applyInlineEdit(m, fakeEditor(model), new Range(2, 1, 2, 2), 'b', '')).toBe(true)
    expect(model.getValue()).toBe('a\nc')
    const last = fakeModel('a\nb')
    expect(applyInlineEdit(m, fakeEditor(last), new Range(2, 1, 2, 2), 'b', '')).toBe(true)
    expect(last.getValue()).toBe('a')
  })
})
