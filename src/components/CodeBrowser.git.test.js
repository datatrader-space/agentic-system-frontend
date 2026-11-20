// @vitest-environment jsdom
// More of git in the editor (ADM-1321): a diff tab stages or unstages one change at a time, a conflicted file opens in
// the 3-way merge editor, and blame shows who changed each line, read once, never with unsaved edits. Monaco is not
// loaded: the editors are stubs.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/utils/lazyComponent', () => ({
  lazyComponent: () => ({ props: ['value', 'original', 'language'], template: '<div class="monaco-stub">{{ original }}|{{ value }}</div>' }),
}))
vi.mock('../services/api', () => ({
  default: {
    getRepositoryFiles: vi.fn(() => Promise.resolve({ data: { entries: [] } })),
    getSourceControlDiff: vi.fn(), getSourceControlHunks: vi.fn(), stageSourceControlChange: vi.fn(),
    getSourceControlBlame: vi.fn(), getFileContent: vi.fn(), getMergeSides: vi.fn(() => new Promise(() => {})),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

import api from '../services/api'
import { notify } from '@/composables/useNotify'

const hunk = (n, start) => ({ header: `@@ -${start},3 +${start},3 @@`, patch: `@@ -${start},3 +${start},3 @@\n a\n-b${n}\n+B${n}\n c\n`,
  old_start: start, old_lines: 3, new_start: start, new_lines: 3 })
const HUNKS = { path: 'a.py', index: 'f'.repeat(40), unstaged: { hunks: [hunk(1, 1), hunk(2, 20)], whole: false }, staged: { hunks: [], whole: false } }

async function browser() {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  const w = mount(CodeBrowser, {
    props: { repositoryId: 4, systemId: 5, editable: true },
    global: { stubs: { Icon: true, SourceControlPanel: { template: '<div class="scm-stub" />', emits: ['open-diff', 'count', 'open-merge'] } } },
  })
  await flushPromises()
  return w
}

beforeEach(() => { vi.clearAllMocks() })

describe('CodeBrowser: one change staged from its diff', () => {
  it('lists each change, stages exactly the one chosen, and shows the file\'s changes as the server answers', async () => {
    api.getSourceControlDiff.mockResolvedValue({ data: { path: 'a.py', original: 'x\n', modified: 'y\n' } })
    api.getSourceControlHunks.mockResolvedValue({ data: HUNKS })
    const after = { ...HUNKS, unstaged: { hunks: [hunk(1, 1)], whole: false }, staged: { hunks: [hunk(2, 20)], whole: false } }
    api.stageSourceControlChange.mockResolvedValue({ data: { clean: false, hunks: after } })
    const w = await browser()
    await w.vm.$.setupState.openDiff({ path: 'a.py' })
    await flushPromises()
    expect(api.getSourceControlHunks).toHaveBeenCalledWith(5, 4, 'a.py')
    expect(w.findAll('.hunk-go').map((b) => b.text())).toEqual(['lines 1–3', 'lines 20–22'])
    await w.find('[aria-label="Stage change 2, lines 20–22"]').trigger('click')
    await flushPromises()
    expect(api.stageSourceControlChange).toHaveBeenCalledWith(5, 4, { path: 'a.py', patch: hunk(2, 20).patch, index: 'f'.repeat(40), unstage: false })
    expect(w.find('[aria-label="Unstage change 1, lines 20–22"]').exists()).toBe(true)
    expect(notify.success).toHaveBeenCalledWith('Staged a change in a.py')
    w.unmount()
  })

  it('a refused change says why and shows the changes as they are now', async () => {
    api.getSourceControlDiff.mockResolvedValue({ data: { path: 'a.py', original: 'x\n', modified: 'y\n' } })
    api.getSourceControlHunks.mockResolvedValue({ data: HUNKS })
    api.stageSourceControlChange.mockRejectedValue({ response: { status: 409, data: { code: 'CHANGED', error: 'a.py changed since its changes were read. Look at them again.',
      hunks: { ...HUNKS, unstaged: { hunks: [hunk(1, 1)], whole: false } } } } })
    const w = await browser()
    await w.vm.$.setupState.openDiff({ path: 'a.py' })
    await flushPromises()
    await w.find('[aria-label="Stage change 1, lines 1–3"]').trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('a.py changed since its changes were read. Look at them again.')
    expect(w.findAll('.hunk-go')).toHaveLength(1)
    w.unmount()
  })

  it('a protected file shows no changes to stage one by one', async () => {
    api.getSourceControlDiff.mockResolvedValue({ data: { path: '.env', redacted: true } })
    const w = await browser()
    await w.vm.$.setupState.openDiff({ path: '.env' })
    await flushPromises()
    expect(api.getSourceControlHunks).not.toHaveBeenCalled()
    expect(w.find('.hunk-bar').exists()).toBe(false)
    w.unmount()
  })
})

describe('CodeBrowser: the merge editor and blame', () => {
  it('a conflicted file opens once in its own merge tab', async () => {
    const w = await browser()
    const st = w.vm.$.setupState
    st.openMerge('src/app.py')
    st.openMerge('src/app.py')
    await flushPromises()
    expect(st.openTabs.filter((t) => t.type === 'merge').map((t) => t.name)).toEqual(['app.py (merge)'])
    expect(api.getMergeSides).toHaveBeenCalledWith(5, 4, 'src/app.py')
    // A result not saved yet is never closed unasked.
    const { confirm } = await import('@/composables/useConfirm')
    const tab = st.openTabs.find((t) => t.type === 'merge')
    tab.edited = true
    confirm.mockResolvedValueOnce(false)
    await st.closeTab(tab.id)
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard the merge result?' }))
    expect(st.openTabs.some((t) => t.id === tab.id)).toBe(true)
    w.unmount()
  })

  it('blame is read once per file while on, and never for a tab with unsaved edits', async () => {
    api.getFileContent.mockResolvedValue({ data: { content: 'a\n', sha: 'a'.repeat(64) } })
    api.getSourceControlBlame.mockResolvedValue({ data: { path: 'a.py', lines: ['c'], commits: { c: { short: 'c', author: 'Ada', date: '', subject: 's' } } } })
    const w = await browser()
    const st = w.vm.$.setupState
    await st.openFile('a.py')
    await flushPromises()
    const tab = st.openTabs.find((t) => t.path === 'a.py')
    st.onEditorChange('a\nb\n')                               // unsaved edits: the lines no longer match
    await w.find('[aria-label="Show who changed each line"]').trigger('click')
    await flushPromises()
    expect(api.getSourceControlBlame).not.toHaveBeenCalled()
    expect(w.find('[aria-label="Show who changed each line"]').attributes('aria-pressed')).toBe('true')
    st.onEditorChange('a\n')                                   // as on disk again: read once
    await flushPromises()
    expect(api.getSourceControlBlame).toHaveBeenCalledTimes(1)
    expect(api.getSourceControlBlame).toHaveBeenCalledWith(5, 4, 'a.py')
    st.onEditorChange('a\nc\n')
    await flushPromises()
    st.onEditorChange('a\n')                                   // the blame read before is used, not read again
    await flushPromises()
    expect(api.getSourceControlBlame).toHaveBeenCalledTimes(1)
    expect(tab.content).toBe('a\n')
    await w.find('[aria-label="Show who changed each line"]').trigger('click')   // off
    expect(w.find('[aria-label="Show who changed each line"]').attributes('aria-pressed')).toBe('false')
    w.unmount()
  })
})
