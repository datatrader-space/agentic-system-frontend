import { describe, it, expect } from 'vitest'
import { mentionAt, mentionedPaths, codeSelection } from './codeMentions'

describe('mentionAt', () => {
  it('finds the @word being typed at the cursor', () => {
    expect(mentionAt('fix @vie', 8)).toEqual({ start: 4, query: 'vie' })
    expect(mentionAt('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionAt('fix @views.py now', 8)).toEqual({ start: 4, query: 'vie' })
  })
  it('an email, a finished word or no @ is not a mention', () => {
    expect(mentionAt('mail me@site.com', 16)).toBeNull()
    expect(mentionAt('@views done', 11)).toBeNull()
    expect(mentionAt('plain', 5)).toBeNull()
  })
})

describe('mentionedPaths', () => {
  it('keeps the picked paths still in the text, in pick order, once', () => {
    expect(mentionedPaths('see @src/a.py and @b.js, then @src/a.py', ['src/a.py', 'b.js', 'gone.py', 'src/a.py']))
      .toEqual(['src/a.py', 'b.js'])
    expect(mentionedPaths('see @src/a.pyc', ['src/a.py'])).toEqual([])
  })
})

describe('codeSelection', () => {
  const lines = ['line one', 'line two', 'line three']
  const model = {
    getLineContent: (n) => lines[n - 1],
    getLineMaxColumn: (n) => lines[n - 1].length + 1,
    getValueInRange: (r) => lines.slice(r.startLineNumber - 1, r.endLineNumber).join('\n'),
  }
  const tab = { type: 'file', path: 'src/a.py' }
  it('the selected lines, whole', () => {
    expect(codeSelection(model, { startLineNumber: 1, startColumn: 3, endLineNumber: 2, endColumn: 4 }, tab))
      .toEqual({ path: 'src/a.py', start_line: 1, end_line: 2, text: 'line one\nline two' })
  })
  it('a selection ending at the start of a line does not take that line; no selection is the cursor line', () => {
    expect(codeSelection(model, { startLineNumber: 1, startColumn: 1, endLineNumber: 3, endColumn: 1 }, tab).end_line).toBe(2)
    expect(codeSelection(model, { startLineNumber: 3, startColumn: 2, endLineNumber: 3, endColumn: 2 }, tab))
      .toEqual({ path: 'src/a.py', start_line: 3, end_line: 3, text: 'line three' })
  })
  it('nothing for a diff tab or an empty line', () => {
    expect(codeSelection(model, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }, { type: 'diff', path: 'x' })).toBeNull()
    expect(codeSelection({ ...model, getLineContent: () => '   ' }, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }, tab)).toBeNull()
  })
})
