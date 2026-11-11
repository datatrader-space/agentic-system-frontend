// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { parseQuery, searchTerm, rank, mark, recentFiles, noteOpened, forgetRecent } from './quickOpen'

const files = (...paths) => paths.map((path) => ({ path, name: path.split('/').pop(), type: 'file' }))

describe('parseQuery', () => {
  it('reads a line after a colon', () => {
    expect(parseQuery('app.py:42')).toEqual({ text: 'app.py', line: 42 })
    expect(parseQuery('  views ')).toEqual({ text: 'views', line: null })
    expect(parseQuery('a:b')).toEqual({ text: 'a:b', line: null })
  })
  it('asks the server for the last part of a path', () => {
    expect(searchTerm('api/views')).toBe('views')
    expect(searchTerm('views')).toBe('views')
    expect(searchTerm('')).toBe('')
  })
})

describe('rank', () => {
  it('the name itself, then a name that starts with it, then one that contains it, then the path', () => {
    const got = rank(files('src/old_views.py', 'lib/views/x.py', 'views.py', 'src/views_test.py', 'app/views.py'), 'views')
    expect(got.map((f) => f.path)).toEqual(['views.py', 'app/views.py', 'src/views_test.py', 'src/old_views.py', 'lib/views/x.py'])
  })
  it('text with a slash matches the path, and every match is kept', () => {
    const many = files(...Array.from({ length: 700 }, (_, i) => `pkg${i}/api/views.py`), 'web/views.py')
    const got = rank(many, 'api/views')
    expect(got).toHaveLength(700)
    expect(got.some((f) => f.path === 'web/views.py')).toBe(false)
  })
  it('case does not matter, nothing typed lists nothing', () => {
    expect(rank(files('README.md'), 'readme').map((f) => f.path)).toEqual(['README.md'])
    expect(rank(files('README.md'), '')).toEqual([])
  })
})

describe('mark', () => {
  it('marks the first place the text occurs', () => {
    expect(mark('old_views.py', 'Views')).toEqual([
      { text: 'old_', hit: false }, { text: 'views', hit: true }, { text: '.py', hit: false }])
    expect(mark('a.py', 'zz')).toEqual([{ text: 'a.py', hit: false }])
  })
})

describe('recently opened', () => {
  beforeEach(() => localStorage.clear())
  it('newest first, each once, per project; a deleted file or folder leaves the list', () => {
    noteOpened(7, 'a.py'); noteOpened(7, 'src/b.py'); noteOpened(7, 'a.py'); noteOpened(8, 'other.py')
    expect(recentFiles(7)).toEqual(['a.py', 'src/b.py'])
    forgetRecent(7, 'src')
    expect(recentFiles(7)).toEqual(['a.py'])
    expect(recentFiles(8)).toEqual(['other.py'])
  })
  it('a broken store is an empty list', () => {
    localStorage.setItem('lets-code:recent:7', 'nope')
    expect(recentFiles(7)).toEqual([])
  })
})
