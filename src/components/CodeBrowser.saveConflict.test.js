// @vitest-environment jsdom
// Save never replaces a change the person has not seen (ADM-1323). The editor's Save was last-writer-wins: a file the
// Coding Agent, a command or the terminal changed after it was opened was silently replaced. Each file tab now keeps
// the sha of the version it opened (`diskSha`); the server refuses a save of an older version (409 CHANGED_ON_DISK)
// and the person chooses: overwrite with theirs, or compare first.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/utils/lazyComponent', () => ({
  lazyComponent: () => ({ props: ['value', 'original', 'language'], template: '<div class="monaco-stub">{{ value }}</div>' }),
}))
vi.mock('../services/api', () => ({
  default: {
    getRepositoryFiles: vi.fn(),
    getFileContent: vi.fn(),
    getSourceControlStatus: vi.fn(),
    getSourceControlDiff: vi.fn(),
    saveFileContent: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { projectCache } from '@/services/projectCache'

const ROOT = [{ name: 'src', path: 'src', type: 'directory' }, { name: 'README.md', path: 'README.md', type: 'file' }]
const SRC = [{ name: 'page.tsx', path: 'src/page.tsx', type: 'file' }]
const SHA1 = '1'.repeat(64)
const SHA2 = '2'.repeat(64)
const SHA3 = '3'.repeat(64)
const SHA4 = '4'.repeat(64)
const CHANGED = { response: { status: 409, data: { error: 'README.md changed in the project since you opened it.', code: 'CHANGED_ON_DISK', sha: SHA3 } } }

async function browser() {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  const w = mount(CodeBrowser, {
    props: { repositoryId: 4, systemId: 5, editable: true },
    global: { stubs: { Icon: true, SourceControlPanel: { template: '<div class="scm-stub" />', emits: ['open-diff', 'count'] } } },
  })
  await flushPromises()
  return w
}
const fileTab = (st, path = 'README.md') => st.openTabs.find((t) => t.type === 'file' && t.path === path)
const lastSave = () => api.saveFileContent.mock.calls.at(-1)

async function editedReadme() {
  const w = await browser()
  const st = w.vm.$.setupState
  await st.openFile('README.md')
  st.onEditorChange('mine')
  return { w, st }
}

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()
  api.getRepositoryFiles.mockImplementation((_s, _r, { path }) =>
    Promise.resolve({ data: { entries: path === 'src' ? SRC : ROOT } }))
  api.getFileContent.mockResolvedValue({ data: { content: 'v1', sha: SHA1 } })
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
  api.saveFileContent.mockResolvedValue({ data: { success: true, path: 'README.md', size: 4, sha: SHA2 } })
})

describe('CodeBrowser: Save names the version it opened (ADM-1323)', () => {
  it('a save sends the sha read with the file and keeps the sha the save answers', async () => {
    const { w, st } = await editedReadme()
    expect(fileTab(st).diskSha).toBe(SHA1)
    await st.saveActive()
    expect(lastSave()).toEqual([5, 4, 'README.md', 'mine', SHA1])
    expect(fileTab(st).diskSha).toBe(SHA2)
    expect(st.isDirty(fileTab(st))).toBe(false)
    expect(notify.success).toHaveBeenCalledWith('Saved README.md')
    st.onEditorChange('mine again')
    await st.saveActive()
    expect(lastSave()[4]).toBe(SHA2)                                         // the next save names the version saved
    w.unmount()
  })

  it('a file changed on disk is asked about; "Overwrite with mine" saves again without a sha', async () => {
    const { w, st } = await editedReadme()
    api.saveFileContent.mockRejectedValueOnce(CHANGED).mockResolvedValueOnce({ data: { success: true, sha: SHA4 } })
    confirm.mockResolvedValueOnce(true)
    await st.saveActive()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'README.md changed in the project',
      message: expect.stringContaining('The Coding Agent, a command or the terminal changed'),
      confirmText: 'Overwrite with mine', cancelText: 'Compare first', danger: true,
    }))
    expect(api.saveFileContent).toHaveBeenCalledTimes(2)
    expect(api.saveFileContent.mock.calls[0][4]).toBe(SHA1)
    expect(lastSave()).toEqual([5, 4, 'README.md', 'mine', undefined])
    expect(fileTab(st).diskSha).toBe(SHA4)
    expect(fileTab(st).original).toBe('mine')
    expect(projectCache.file.get(4, 'README.md')).toBe('mine')
    expect(notify.error).not.toHaveBeenCalled()
    w.unmount()
  })

  it('"Compare first" shows the disk beside the unsaved text, keeps it, and the next save names the disk version', async () => {
    const { w, st } = await editedReadme()
    api.saveFileContent.mockRejectedValueOnce(CHANGED)
    confirm.mockResolvedValueOnce(false)
    api.getFileContent.mockResolvedValueOnce({ data: { content: 'theirs', sha: SHA3 } })
    await st.saveActive()
    expect(api.saveFileContent).toHaveBeenCalledTimes(1)                     // nothing was written
    expect(st.openTabs.map((t) => t.name)).toEqual(['README.md', 'README.md (on disk ↔ yours)'])
    const cmp = st.openTabs[1]
    expect(cmp).toMatchObject({ type: 'diff', compare: true, path: 'README.md', originalText: 'theirs', modified: 'mine', loading: false })
    expect(st.activeTabId).toBe(cmp.id)
    expect(api.getSourceControlDiff).not.toHaveBeenCalled()
    const tab = fileTab(st)
    expect(tab.content).toBe('mine')
    expect(st.isDirty(tab)).toBe(true)
    expect(tab.diskSha).toBe(SHA3)
    expect(notify.info).toHaveBeenCalledWith(expect.stringContaining('unchanged'))

    st.showFile(tab.id)
    await st.saveActive()
    expect(lastSave()).toEqual([5, 4, 'README.md', 'mine', SHA3])
    expect(st.isDirty(fileTab(st))).toBe(false)
    w.unmount()
  })

  it('a second "Compare first" refreshes the one compare tab, and Source control still opens its own diff', async () => {
    const { w, st } = await editedReadme()
    api.saveFileContent.mockRejectedValue(CHANGED)
    confirm.mockResolvedValue(false)
    api.getFileContent.mockResolvedValueOnce({ data: { content: 'theirs', sha: SHA3 } })
    await st.saveActive()
    st.showFile(fileTab(st).id)
    api.getFileContent.mockResolvedValueOnce({ data: { content: 'theirs again', sha: SHA4 } })
    await st.saveActive()
    expect(st.openTabs.filter((t) => t.compare).map((t) => t.originalText)).toEqual(['theirs again'])
    expect(fileTab(st).diskSha).toBe(SHA4)
    api.getSourceControlDiff.mockResolvedValueOnce({ data: { original: 'a', modified: 'b' } })
    await st.openDiff({ path: 'README.md' })
    expect(st.openTabs.map((t) => t.name)).toEqual(['README.md', 'README.md (on disk ↔ yours)', 'README.md (changes)'])
    w.unmount()
  })

  it('a copy kept from before that is older than the disk, with unsaved edits, is asked about on Save', async () => {
    ;(await editedReadme()).w.unmount()
    const w = await browser()
    const st = w.vm.$.setupState
    let resolve
    api.getFileContent.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const opening = st.openFile('README.md')                                // opens at once with the kept 'v1'
    st.onEditorChange('my edit')
    resolve({ data: { content: 'theirs', sha: SHA3 } })
    await opening
    const tab = fileTab(st)
    expect(tab.content).toBe('my edit')
    expect(tab.diskSha).not.toBe(SHA3)                                       // never the version not seen
    expect(tab.diskSha).toMatch(/^[0-9a-f]{64}$/)                            // well-formed: the server answers 409, not 400
    expect(notify.warning).toHaveBeenCalledWith('README.md changed in the project since you opened it. Saving will ask which version to keep.')
    w.unmount()
  })

  it('a copy kept from before that is still the disk takes the sha read', async () => {
    ;(await editedReadme()).w.unmount()
    const w = await browser()
    const st = w.vm.$.setupState
    await st.openFile('README.md')
    expect(fileTab(st).diskSha).toBe(SHA1)
    w.unmount()
  })
})

describe('CodeBrowser: a background read updates the version only of a tab without unsaved edits', () => {
  it('the project said what changed: the clean tab takes the new sha, the edited one keeps its own', async () => {
    const w = await browser()
    const st = w.vm.$.setupState
    await st.openFile('README.md')
    await st.expandDir(st.rootNodes[0])
    await st.openFile('src/page.tsx')
    st.onEditorChange('my edit')                                             // page.tsx is the active tab
    vi.useFakeTimers()
    try {
      api.getFileContent.mockResolvedValue({ data: { content: 'v2', sha: SHA4 } })
      w.vm.onFilesChanged({ dirs: ['', 'src'] })
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      expect(fileTab(st)).toMatchObject({ content: 'v2', diskSha: SHA4 })
      expect(fileTab(st, 'src/page.tsx')).toMatchObject({ content: 'my edit', diskSha: SHA1 })
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('reading every open tab again does the same', async () => {
    const w = await browser()
    const st = w.vm.$.setupState
    await st.openFile('README.md')
    await st.openFile('src/page.tsx')
    st.onEditorChange('my edit')
    api.getFileContent.mockResolvedValue({ data: { content: 'v2', sha: SHA4 } })
    await st.reloadOpenTabs()
    expect(fileTab(st)).toMatchObject({ content: 'v2', diskSha: SHA4 })
    expect(fileTab(st, 'src/page.tsx')).toMatchObject({ content: 'my edit', diskSha: SHA1 })
    w.unmount()
  })

  it('a compare tab is never read again by either reload', async () => {
    const { w, st } = await editedReadme()
    api.saveFileContent.mockRejectedValueOnce(CHANGED)
    confirm.mockResolvedValueOnce(false)
    api.getFileContent.mockResolvedValueOnce({ data: { content: 'theirs', sha: SHA3 } })
    await st.saveActive()
    api.getSourceControlDiff.mockResolvedValue({ data: { original: 'x', modified: 'y' } })
    await st.reloadOpenTabs()
    vi.useFakeTimers()
    try {
      w.vm.onFilesChanged({ dirs: [''] })
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
    } finally {
      vi.useRealTimers()
    }
    expect(api.getSourceControlDiff).not.toHaveBeenCalled()
    expect(st.openTabs.find((t) => t.compare)).toMatchObject({ originalText: 'theirs', modified: 'mine', note: '' })
    w.unmount()
  })
})
