// @vitest-environment jsdom
// Let's Code Search: replace across files with include / exclude patterns (ADM-1320). The server makes each line's
// preview and writes each file only at the version the search read; this panel sends the lines as shown, in batches,
// asks before a file with unsaved edits, and names every file that was not replaced.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/services/api', () => ({
  default: { searchRepositoryContents: vi.fn(), replaceRepositoryContents: vi.fn() },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import ContentSearch from './ContentSearch.vue'

const SHA = 'a'.repeat(64)
const piece = (before, word, repl, after) => [{ text: before }, { text: word, del: true }, { text: repl, ins: true }, { text: after }]
const ANSWER = () => ({ data: {
  q: 'price',
  matches: [
    { path: 'src/app.py', line: 2, column: 5, text: 'x = price * 2', after: 'x = cost * 2', preview: piece('x = ', 'price', 'cost', ' * 2') },
    { path: 'src/app.py', line: 9, column: 1, text: 'price = 1', after: 'cost = 1', preview: piece('', 'price', 'cost', ' = 1') },
    { path: 'web/a.ts', line: 1, column: 7, text: 'const price = 1', after: 'const cost = 1', preview: piece('const ', 'price', 'cost', ' = 1') },
    { path: '.env', line: 1, column: 1, redacted: true },
  ],
  binary: ['img.bin'],
  versions: { 'src/app.py': SHA, 'web/a.ts': 'b'.repeat(64) },
} })

let w
async function mountSearch(props = {}) {
  w = mount(ContentSearch, { props: { systemId: 5, repoId: 4, ...props }, global: { stubs: { Icon: true } } })
  await w.find('button[aria-label="Toggle Replace"]').trigger('click')
  await w.find('input[aria-label="Replace"]').setValue('cost')
  await w.find('.cs-input').setValue('price')
  await w.find('.cs-input').trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  api.searchRepositoryContents.mockResolvedValue(ANSWER())
  api.replaceRepositoryContents.mockResolvedValue({ data: { replaced: [{ path: 'src/app.py', lines: 1, sha: SHA }], skipped: [], count: 1 } })
  confirm.mockResolvedValue(true)
})

describe('Replace in the Search panel', () => {
  it('asks for previews with the Replace text and shows what goes and what comes', async () => {
    await mountSearch()
    expect(api.searchRepositoryContents).toHaveBeenLastCalledWith(5, 4, expect.objectContaining({ q: 'price', replace: 'cost' }))
    expect(w.findAll('.cs-del').map((e) => e.text())).toEqual(['price', 'price', 'price'])
    expect(w.findAll('.cs-ins').map((e) => e.text())).toEqual(['cost', 'cost', 'cost'])
    expect(w.find('.cs-hidden').text()).toContain('never replaced')
    expect(w.text()).toContain('img.bin')
    expect(w.text()).toContain('never shown or replaced')
  })

  it('replaces one line with the line as shown and the version the search read, then the tabs are told', async () => {
    await mountSearch()
    await w.find('button[aria-label="Replace line 2 of src/app.py"]').trigger('click')
    await flushPromises()
    expect(api.replaceRepositoryContents).toHaveBeenCalledWith(5, 4, expect.objectContaining({
      q: 'price', replace: 'cost', matchCase: false,
      files: [{ path: 'src/app.py', sha: SHA, lines: [{ line: 2, text: 'x = price * 2' }] }],
    }))
    expect(w.emitted('written')).toEqual([[['src/app.py']]])
    expect(notify.success).toHaveBeenCalledWith('Replaced 1 line in 1 file')
    expect(api.searchRepositoryContents).toHaveBeenCalledTimes(2)              // searched again: fresh versions
  })

  it('replaces every line of one file', async () => {
    await mountSearch()
    await w.find('button[aria-label="Replace all in src/app.py"]').trigger('click')
    await flushPromises()
    expect(api.replaceRepositoryContents.mock.calls[0][2].files).toEqual([
      { path: 'src/app.py', sha: SHA, lines: [{ line: 2, text: 'x = price * 2' }, { line: 9, text: 'price = 1' }] }])
  })

  it('Replace all asks first and sends a protected file only to be named as never replaced', async () => {
    api.replaceRepositoryContents.mockResolvedValue({ data: {
      replaced: [{ path: 'src/app.py', lines: 2 }],
      skipped: [{ path: 'web/a.ts', code: 'CHANGED_ON_DISK', reason: 'web/a.ts changed since the search.' },
        { path: '.env', code: 'PROTECTED', reason: 'This file holds secrets.' }],
      count: 2,
    } })
    await mountSearch()
    await w.find('button[aria-label="Replace all"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Replace in every file?', confirmText: 'Replace all' }))
    const files = api.replaceRepositoryContents.mock.calls[0][2].files
    expect(files.map((f) => f.path)).toEqual(['src/app.py', 'web/a.ts', '.env'])
    expect(files[2]).toEqual({ path: '.env', sha: '', lines: [] })
    expect(w.find('.cs-note').text()).toContain('Replaced 2 lines in 1 file')
    expect(w.text()).toContain('web/a.ts changed since the search.')
    expect(notify.warning).toHaveBeenCalled()
  })

  it('nothing is replaced when Replace all is cancelled', async () => {
    confirm.mockResolvedValue(false)
    await mountSearch()
    await w.find('button[aria-label="Replace all"]').trigger('click')
    await flushPromises()
    expect(api.replaceRepositoryContents).not.toHaveBeenCalled()
  })

  it('a file with unsaved edits in its tab is asked about first, and nothing goes when the answer is no', async () => {
    confirm.mockResolvedValue(false)
    await mountSearch({ isUnsaved: (p) => p === 'src/app.py' })
    await w.find('button[aria-label="Replace line 2 of src/app.py"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'This file has unsaved edits', confirmText: 'Replace anyway' }))
    expect(api.replaceRepositoryContents).not.toHaveBeenCalled()
  })

  it('a file that changed since the search is named, never overwritten (409)', async () => {
    api.replaceRepositoryContents.mockRejectedValue({ response: { status: 409, data: {
      code: 'CHANGED_ON_DISK', replaced: [], count: 0,
      skipped: [{ path: 'src/app.py', code: 'CHANGED_ON_DISK', reason: 'src/app.py changed since the search.' }] } } })
    await mountSearch()
    await w.find('button[aria-label="Replace line 2 of src/app.py"]').trigger('click')
    await flushPromises()
    expect(w.emitted('written')).toBeUndefined()
    expect(w.text()).toContain('src/app.py changed since the search.')
  })

  it('a pattern the replacement cannot read exactly turns Replace off and says why', async () => {
    api.searchRepositoryContents.mockResolvedValue({ data: { matches: [{ path: 'a.py', line: 1, column: 1, text: 'price' }],
      versions: {}, replace_error: 'With "|" in the pattern, …' } })
    await mountSearch()
    expect(w.find('[role="alert"]').text()).toContain('With "|" in the pattern')
    expect(w.find('button[aria-label="Replace all"]').attributes('disabled')).toBeDefined()
    expect(w.find('.cs-hit').exists()).toBe(true)
  })

  it('a changed Replace text disables Replace until its previews arrive', async () => {
    await mountSearch()
    api.searchRepositoryContents.mockReturnValue(new Promise(() => {}))
    await w.find('input[aria-label="Replace"]').setValue('cost2')
    expect(w.find('button[aria-label="Replace all"]').attributes('disabled')).toBeDefined()
  })

  it('files to include and exclude go to the search', async () => {
    await mountSearch()
    await w.find('button[aria-label="Toggle files to include and exclude"]').trigger('click')
    const [inc, exc] = w.findAll('.cs-details input')
    await inc.setValue('*.ts, src')
    await exc.setValue('node_modules')
    await inc.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(api.searchRepositoryContents).toHaveBeenLastCalledWith(5, 4, expect.objectContaining({ include: '*.ts, src', exclude: 'node_modules' }))
  })
})
