// The changes of a file, one at a time (ADM-1314), and the message review comments become (ADM-1329).
import { describe, it, expect } from 'vitest'
import { diffLines, fromMonaco, revertHunk, hunkKey, snippetAround, reviewMessage } from './reviewHunks'

const BEFORE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', ''].join('\n')
const AFTER = ['a', 'B', 'c', 'd', 'new', 'e', 'g', ''].join('\n')

describe('diffLines', () => {
  it('finds each run of changed lines', () => {
    expect(diffLines(BEFORE, AFTER)).toEqual([
      { oStart: 2, oCount: 1, mStart: 2, mCount: 1 },        // b -> B
      { oStart: 5, oCount: 0, mStart: 5, mCount: 1 },        // + new
      { oStart: 6, oCount: 1, mStart: 7, mCount: 0 },        // - f
    ])
  })

  it('no change, a new file and a removed file', () => {
    expect(diffLines('x\ny', 'x\ny')).toEqual([])
    expect(diffLines('', 'one\ntwo')).toEqual([{ oStart: 1, oCount: 0, mStart: 1, mCount: 2 }])
    expect(diffLines(null, 'one')).toEqual([{ oStart: 1, oCount: 0, mStart: 1, mCount: 1 }])
    expect(diffLines('one\ntwo', '')).toEqual([{ oStart: 1, oCount: 2, mStart: 1, mCount: 0 }])
  })

  it('every change undone, one by one from the last, gives the file before back byte for byte', () => {
    const before = 'x = 1\r\ny = 2\r\nz = 3\r\n'
    const after = 'x = 1\r\ny = 20\r\nw = 9\r\nz = 3\r\nq\r\n'
    let text = after
    for (const h of diffLines(before, after).reverse()) text = revertHunk(text, before, h)
    expect(text).toBe(before)
  })
})

describe('revertHunk', () => {
  it('puts back only that change', () => {
    const [first, second, third] = diffLines(BEFORE, AFTER)
    expect(revertHunk(AFTER, BEFORE, first)).toBe(['a', 'b', 'c', 'd', 'new', 'e', 'g', ''].join('\n'))
    expect(revertHunk(AFTER, BEFORE, second)).toBe(['a', 'B', 'c', 'd', 'e', 'g', ''].join('\n'))
    expect(revertHunk(AFTER, BEFORE, third)).toBe(['a', 'B', 'c', 'd', 'new', 'e', 'f', 'g', ''].join('\n'))
  })
})

describe('fromMonaco', () => {
  it("reads the editor's line changes, an end of 0 being a side with no lines", () => {
    expect(fromMonaco([
      { originalStartLineNumber: 2, originalEndLineNumber: 2, modifiedStartLineNumber: 2, modifiedEndLineNumber: 2 },
      { originalStartLineNumber: 4, originalEndLineNumber: 0, modifiedStartLineNumber: 5, modifiedEndLineNumber: 5 },
      { originalStartLineNumber: 6, originalEndLineNumber: 6, modifiedStartLineNumber: 6, modifiedEndLineNumber: 0 },
    ])).toEqual(diffLines(BEFORE, AFTER))
  })
})

describe('hunkKey', () => {
  it('names a change by its text, so undoing another change of the file keeps its name', () => {
    const [first, second] = diffLines(BEFORE, AFTER)
    const once = revertHunk(AFTER, BEFORE, first)
    const [moved] = diffLines(BEFORE, once)
    expect(hunkKey('f.txt', BEFORE, once, moved)).toBe(hunkKey('f.txt', BEFORE, AFTER, second))
    expect(hunkKey('f.txt', BEFORE, AFTER, first)).not.toBe(hunkKey('f.txt', BEFORE, AFTER, second))
    expect(hunkKey('g.txt', BEFORE, AFTER, first)).not.toBe(hunkKey('f.txt', BEFORE, AFTER, first))
  })
})

describe('snippetAround and reviewMessage', () => {
  it('numbers the lines around the comment', () => {
    expect(snippetAround('l1\nl2\nl3\nl4\nl5\nl6', 4)).toBe(' 2 | l2\n 3 | l3\n 4 | l4\n 5 | l5\n 6 | l6'.replace(/^ /gm, ''))
    expect(snippetAround('only', 1)).toBe('1 | only')
  })

  it('one message: an intro, then each place, its words and the code in a fence; empty comments are left out', () => {
    const text = reviewMessage([
      { path: 'src/app.py', line: 12, side: 'after', text: '  Rename this.  ', snippet: '12 | x = 1' },
      { path: 'src/app.py', line: 3, side: 'after', text: '   ', snippet: '3 | y' },
      { path: 'old.md', line: 2, side: 'before', text: 'Keep this file.', snippet: '2 | has ``` inside' },
    ])
    expect(text).toBe([
      'I reviewed your changes and left 2 comments. Please address them:',
      'src/app.py:12\nRename this.\n```\n12 | x = 1\n```',
      'old.md:2 (in the file before your change)\nKeep this file.\n````\n2 | has ``` inside\n````',
    ].join('\n\n'))
    expect(reviewMessage([{ path: 'a', line: 1, text: '' }])).toBe('')
  })
})
