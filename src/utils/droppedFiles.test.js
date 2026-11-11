import { describe, it, expect } from 'vitest'
import { filesFromDrop, filesFromPicker, uploadParts, tooLarge, MAX_FILES_PER_PART, MAX_BYTES_PER_PART } from './droppedFiles'

const file = (name, size = 1) => ({ name, size })
const fileEntry = (name) => ({ isFile: true, isDirectory: false, name, file: (ok) => ok(file(name)) })
const dirEntry = (name, children) => {
  const batches = [children, []]                  // readEntries answers in batches, then an empty one
  return { isFile: false, isDirectory: true, name, createReader: () => ({ readEntries: (ok) => ok(batches.shift() || []) }) }
}

describe('filesFromDrop', () => {
  it('a dropped folder keeps its layout', async () => {
    const dt = { items: [
      { kind: 'file', webkitGetAsEntry: () => dirEntry('site', [fileEntry('index.html'), dirEntry('css', [fileEntry('main.css')])]) },
      { kind: 'file', webkitGetAsEntry: () => fileEntry('logo.png') },
    ] }
    const got = await filesFromDrop(dt)
    expect(got.map((f) => f.path)).toEqual(['site/index.html', 'site/css/main.css', 'logo.png'])
    expect(got[2].file.name).toBe('logo.png')
  })

  it('without the entries API the files arrive by name', async () => {
    const got = await filesFromDrop({ items: [], files: [file('a.txt'), file('b.txt')] })
    expect(got.map((f) => f.path)).toEqual(['a.txt', 'b.txt'])
  })

  it('the picker uses a folder pick path when there is one', () => {
    expect(filesFromPicker([{ name: 'x', webkitRelativePath: 'dir/x' }, { name: 'y', webkitRelativePath: '' }])
      .map((f) => f.path)).toEqual(['dir/x', 'y'])
  })
})

describe('uploadParts', () => {
  it('splits by count and by size, never dropping a file', () => {
    const many = Array.from({ length: MAX_FILES_PER_PART * 2 + 3 }, (_, i) => ({ file: file(`f${i}`), path: `f${i}` }))
    const parts = uploadParts(many)
    expect(parts.map((p) => p.length)).toEqual([MAX_FILES_PER_PART, MAX_FILES_PER_PART, 3])
    const big = [{ file: file('a', MAX_BYTES_PER_PART - 10) }, { file: file('b', 20) }, { file: file('c', 5) }]
    expect(uploadParts(big).map((p) => p.map((f) => f.file.name))).toEqual([['a'], ['b', 'c']])
    expect(uploadParts([])).toEqual([])
  })

  it('names a file larger than one request can carry', () => {
    expect(tooLarge([{ file: file('huge', MAX_BYTES_PER_PART + 1) }, { file: file('ok', 3) }]).map((f) => f.file.name))
      .toEqual(['huge'])
  })
})
