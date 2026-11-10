// @vitest-environment jsdom
// The Let's Code editor shows what it last read at once and refreshes it, as VS Code does (ADM-1196: a folder took
// 3.7 s, a file 2.2 s and Source control 4.6 s on prod, 2026-11-10, and the person waited for the same answer again).
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
    saveFileContent: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { projectCache } from '@/services/projectCache'

const ROOT = [{ name: 'src', path: 'src', type: 'directory' }, { name: 'README.md', path: 'README.md', type: 'file' }]
const SRC = [{ name: 'page.tsx', path: 'src/page.tsx', type: 'file' }]
const STATUS = { branch: 'main', clean: false, changes: [{ path: 'a.py', status: 'modified' }], untracked: [{ path: 'b.py' }] }

function listing(map) {
  api.getRepositoryFiles.mockImplementation((_s, _r, { path }) =>
    map[path] ? Promise.resolve({ data: { entries: map[path] } })
      : Promise.reject({ response: { status: 404, data: { error: `Folder not found: ${path}` } } }))
}

async function browser(repositoryId = 4) {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  const w = mount(CodeBrowser, {
    props: { repositoryId, systemId: 5, editable: true },
    global: { stubs: { Icon: true, SourceControlPanel: { template: '<div class="scm-stub" />', emits: ['open-diff', 'count'] } } },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()
  listing({ '': ROOT, src: SRC })
  api.getFileContent.mockResolvedValue({ data: { content: 'v1' } })
  api.getSourceControlStatus.mockResolvedValue({ data: STATUS })
})

describe('CodeBrowser: what was read before shows at once', () => {
  it('the tree shows the last top level at once, then the fresh one', async () => {
    ;(await browser()).unmount()
    let resolve
    api.getRepositoryFiles.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const w = await browser()
    const st = w.vm.$.setupState
    expect(st.rootNodes.map((n) => n.path)).toEqual(['src', 'README.md'])       // before the server answered
    expect(st.loading).toBe(false)
    resolve({ data: { entries: [...ROOT, { name: 'new.ts', path: 'new.ts', type: 'file' }] } })
    await flushPromises()
    expect(st.rootNodes.map((n) => n.path)).toEqual(['src', 'README.md', 'new.ts'])
    w.unmount()
  })

  it('a folder read before opens at once, with no spinner, and is read again', async () => {
    const first = await browser()
    await first.vm.$.setupState.expandDir(first.vm.$.setupState.rootNodes[0])
    first.unmount()
    const w = await browser()
    const st = w.vm.$.setupState
    api.getRepositoryFiles.mockClear()
    let resolve
    api.getRepositoryFiles.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const opening = st.expandDir(st.rootNodes[0])
    expect(st.rootNodes[0].children.map((c) => c.path)).toEqual(['src/page.tsx'])
    expect(st.rootNodes[0].loading).toBe(false)
    resolve({ data: { entries: [...SRC, { name: 'x.ts', path: 'src/x.ts', type: 'file' }] } })
    await opening
    expect(st.rootNodes[0].children.map((c) => c.path)).toEqual(['src/page.tsx', 'src/x.ts'])
    expect(api.getRepositoryFiles).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('a folder the pointer rests on is read once, before the click; the click does not ask again', async () => {
    vi.useFakeTimers()
    try {
      const w = await browser()
      api.getRepositoryFiles.mockClear()
      const row = w.findAll('.tree-node').find((n) => n.text().includes('src'))
      await row.trigger('mouseenter')
      await vi.advanceTimersByTimeAsync(150)
      await flushPromises()
      expect(api.getRepositoryFiles).toHaveBeenCalledTimes(1)
      expect(api.getRepositoryFiles.mock.calls[0][2]).toEqual({ path: 'src' })
      await row.trigger('mouseleave')
      api.getRepositoryFiles.mockClear()
      api.getRepositoryFiles.mockImplementationOnce(() => new Promise(() => {}))     // the refresh never answers
      await row.trigger('click')
      await flushPromises()
      expect(w.vm.$.setupState.rootNodes[0].children.map((c) => c.path)).toEqual(['src/page.tsx'])
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a pointer passing over a folder reads nothing', async () => {
    vi.useFakeTimers()
    try {
      const w = await browser()
      api.getRepositoryFiles.mockClear()
      const row = w.findAll('.tree-node').find((n) => n.text().includes('src'))
      await row.trigger('mouseenter')
      await vi.advanceTimersByTimeAsync(50)
      await row.trigger('mouseleave')
      await vi.advanceTimersByTimeAsync(500)
      expect(api.getRepositoryFiles).not.toHaveBeenCalled()
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a file read before opens at once and shows its new content when it changed', async () => {
    const first = await browser()
    await first.vm.$.setupState.openFile('README.md')
    first.unmount()
    const w = await browser()
    const st = w.vm.$.setupState
    let resolve
    api.getFileContent.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const opening = st.openFile('README.md')
    expect(st.openTabs.find((t) => t.path === 'README.md').content).toBe('v1')     // at once
    resolve({ data: { content: 'v2' } })
    await opening
    expect(st.openTabs.find((t) => t.path === 'README.md').content).toBe('v2')
    w.unmount()
  })

  it('unsaved edits are never replaced by a newer copy: the person is told', async () => {
    const first = await browser()
    await first.vm.$.setupState.openFile('README.md')
    first.unmount()
    const w = await browser()
    const st = w.vm.$.setupState
    let resolve
    api.getFileContent.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const opening = st.openFile('README.md')
    st.onEditorChange('my edit')
    resolve({ data: { content: 'theirs' } })
    await opening
    expect(st.openTabs.find((t) => t.path === 'README.md').content).toBe('my edit')
    expect(notify.warning).toHaveBeenCalledWith(expect.stringContaining('changed in the project'))
    w.unmount()
  })

  it('a file kept from before that is gone now closes its tab and says so', async () => {
    const first = await browser()
    await first.vm.$.setupState.openFile('README.md')
    first.unmount()
    const w = await browser()
    const st = w.vm.$.setupState
    api.getFileContent.mockRejectedValueOnce({ response: { status: 404, data: { error: 'File not found' } } })
    await st.openFile('README.md')
    expect(st.openTabs.find((t) => t.path === 'README.md')).toBeUndefined()
    expect(notify.error).toHaveBeenCalledWith('File not found')
    w.unmount()
  })

  it('a project that answers "not found" shows its error and nothing kept for it', async () => {
    ;(await browser()).unmount()
    api.getRepositoryFiles.mockRejectedValueOnce({ response: { status: 404, data: { error: 'Not found.' } } })
    const w = await browser()
    expect(w.vm.$.setupState.rootNodes).toEqual([])
    expect(w.vm.$.setupState.treeError).toBe('Not found.')
    expect(projectCache.dir.get(4, '')).toBe(null)
    w.unmount()
  })

  it('another project never shows this one\'s files', async () => {
    ;(await browser(4)).unmount()
    api.getRepositoryFiles.mockImplementationOnce(() => new Promise(() => {}))
    const w = await browser(77)
    expect(w.vm.$.setupState.rootNodes).toEqual([])
    w.unmount()
  })

  it('Source control\'s count is read with the tree, before its tab is opened', async () => {
    const w = await browser()
    expect(api.getSourceControlStatus).toHaveBeenCalledTimes(1)
    expect(w.find('.scm-tabcount').text()).toBe('2')
    expect(projectCache.status.get(4)).toEqual(STATUS)
    w.unmount()
  })

  it('a sign-in or sign-out clears everything kept', async () => {
    ;(await browser()).unmount()
    projectCache.clearAll()
    expect(projectCache.dir.get(4, '')).toBe(null)
    expect(projectCache.status.get(4)).toBe(null)
  })
})

describe('CodeBrowser: the project says what changed (ADM-1196, Phase 2)', () => {
  it('an open folder that changed is read again and merged; others are not read', async () => {
    vi.useFakeTimers()
    try {
      const w = await browser()
      const st = w.vm.$.setupState
      await st.expandDir(st.rootNodes[0])
      api.getRepositoryFiles.mockClear()
      listing({ '': ROOT, src: [...SRC, { name: 'new.ts', path: 'src/new.ts', type: 'file' }] })
      w.vm.onFilesChanged({ dirs: ['src'], scm: true })
      w.vm.onFilesChanged({ dirs: ['src'], scm: true })                    // a burst is applied once
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      expect(api.getRepositoryFiles.mock.calls.map((c) => c[2])).toEqual([{ path: 'src' }])
      expect(st.rootNodes[0].expanded).toBe(true)
      expect(st.rootNodes[0].children.map((c) => c.path)).toEqual(['src/page.tsx', 'src/new.ts'])
      expect(api.getSourceControlStatus).toHaveBeenCalledTimes(2)           // mount + the change
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a closed folder that changed is read on its next open, never shown as it was', async () => {
    vi.useFakeTimers()
    try {
      const w = await browser()
      const st = w.vm.$.setupState
      await st.expandDir(st.rootNodes[0])
      await st.expandDir(st.rootNodes[0])                                    // closed again
      api.getRepositoryFiles.mockClear()
      w.vm.onFilesChanged({ dirs: ['src'] })
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      expect(api.getRepositoryFiles).not.toHaveBeenCalled()
      expect(projectCache.dir.get(4, 'src')).toBe(null)
      expect(st.rootNodes[0].loaded).toBe(false)
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('an open file in a changed folder shows its new content; unsaved edits stay', async () => {
    const w = await browser()
    const st = w.vm.$.setupState
    await st.openFile('README.md')
    await st.expandDir(st.rootNodes[0])
    await new Promise((r) => setTimeout(r, 5))                               // tab ids are Date.now()
    await st.openFile('src/page.tsx')
    st.onEditorChange('my edit')                                             // page.tsx is the active tab
    vi.useFakeTimers()
    try {
      api.getFileContent.mockResolvedValue({ data: { content: 'v2' } })
      w.vm.onFilesChanged({ dirs: ['', 'src'] })
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      expect(st.openTabs.find((t) => t.path === 'README.md').content).toBe('v2')
      expect(st.openTabs.find((t) => t.path === 'src/page.tsx').content).toBe('my edit')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a watcher that restarted has everything open read again', async () => {
    vi.useFakeTimers()
    try {
      const w = await browser()
      const st = w.vm.$.setupState
      await st.expandDir(st.rootNodes[0])
      api.getRepositoryFiles.mockClear()
      w.vm.onFilesChanged({ dirs: [], scm: true, reset: true })
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      expect(api.getRepositoryFiles.mock.calls.map((c) => c[2])).toEqual([{ path: '' }, { path: 'src' }])
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
