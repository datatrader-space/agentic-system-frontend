// The ASS port against the shared cases (contract section 8): the expected strings are what the export's
// video_studio/services/editor_ass.py writes for the same tracks; the two must be identical, byte for byte.
import { describe, expect, it } from 'vitest'
import file from '../__cases__/ass.json'
import { assScript, assTime, fontFiles, num2 } from './assScript'

const cases = Array.isArray(file) ? file : file.cases

describe('assScript: shared cases (identical to editor_ass.py)', () => {
  it('has cases', () => { expect(cases.length).toBeGreaterThan(10) })
  for (const c of cases) {
    it(c.id || c.name, () => { expect(assScript(c.doc, c.track, c.width, c.height)).toBe(c.expected) })
  }
})

describe('assScript: helpers', () => {
  it('numbers like Python\'s .2f, ties to even', () => {
    expect([0.125, 0.375, 1.5, -0.001, 2.675, 10, 3.14159].map(num2)).toEqual(['0.12', '0.38', '1.5', '0', '2.67', '10', '3.14'])
  })
  it('times in centiseconds, rounded half up', () => {
    expect(assTime(0)).toBe('0:00:00.00')
    expect(assTime(33)).toBe('0:00:00.03')
    expect(assTime(35)).toBe('0:00:00.04')
    expect(assTime(3725155)).toBe('1:02:05.16')
  })
  it('every font file is in public/fonts/editor', async () => {
    const { existsSync } = await import('node:fs')
    for (const url of Object.values(fontFiles())) expect(existsSync(`public${url}`), url).toBe(true)
  })
})
