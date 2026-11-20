// The command palette's search (ADM-1322): every typed word in the label, in order; the best match first; nothing cut.
import { describe, it, expect } from 'vitest'
import { filterCommands } from './commandPalette'

const C = [
  { id: 'save', group: 'File', label: 'Save' },
  { id: 'terminal', group: 'View', label: 'Toggle the terminal' },
  { id: 'md', group: 'Markdown', label: 'Show the preview' },
  { id: 'split', group: 'View', label: 'Open to the side' },
  { id: 'settings', group: 'Preferences', label: 'Editor settings' },
]
const ids = (q) => filterCommands(C, q).map((c) => c.id)

describe('filterCommands', () => {
  it('nothing typed lists every command, in order', () => {
    expect(ids('')).toEqual(C.map((c) => c.id))
    expect(ids('   ')).toEqual(C.map((c) => c.id))
  })
  it('words, word starts and the group name all match; case does not matter', () => {
    expect(ids('terminal')).toEqual(['terminal'])
    expect(ids('TOGGLE term')).toEqual(['terminal'])
    expect(ids('md prev')).toEqual(['md'])
    expect(ids('markdown')).toEqual(['md'])
    expect(ids('ots')).toContain('split')                 // Open To the Side
  })
  it('a whole word scores above scattered letters; no match lists nothing', () => {
    expect(ids('s')[0]).toBe('save')
    expect(ids('zzz')).toEqual([])
  })
  it('every match is listed', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ id: `c${i}`, label: `Command ${i}` }))
    expect(filterCommands(many, 'command')).toHaveLength(300)
  })
})
