// @vitest-environment jsdom
// A change from Source control opens in the editor as a side-by-side diff tab, as VS Code shows it (owner,
// 2026-11-06: "show diff code in file like in VS Code"). Monaco itself is not loaded here: the diff editor is a stub
// that shows what it was given.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/utils/lazyComponent', () => ({
  lazyComponent: () => ({ props: ['value', 'original', 'language'], template: '<div class="monaco-stub">{{ original }}|{{ value }}|{{ language }}</div>' }),
}))
vi.mock('../services/api', () => ({
  default: {
    getRepositoryFiles: vi.fn(() => Promise.resolve({ data: { files: [] } })),
    getSourceControlDiff: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

async function browser() {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  const w = mount(CodeBrowser, {
    props: { repositoryId: 4, systemId: 5, editable: true },
    global: { stubs: { Icon: true, SourceControlPanel: { template: '<div class="scm-stub" />', emits: ['open-diff', 'count'] } } },
  })
  await flushPromises()
  return w
}

describe('CodeBrowser: refresh after a change', () => {
  it('reloads the tree with the same folders open and an open file shows its new content', async () => {
    const api = (await import('../services/api')).default
    api.getRepositoryFiles.mockImplementation((_s, _r, { path }) => Promise.resolve({ data: { entries: path === ''
      ? [{ name: 'src', path: 'src', type: 'directory' }]
      : [{ name: 'page.tsx', path: 'src/page.tsx', type: 'file' }] } }))
    api.getFileContent = vi.fn(() => Promise.resolve({ data: { content: 'v1' } }))
    const w = await browser()
    const st = w.vm.$.setupState
    await st.expandDir(st.rootNodes[0])
    await st.openFile('src/page.tsx')
    api.getFileContent.mockResolvedValue({ data: { content: 'v2' } })
    await w.vm.refresh()
    await flushPromises()
    expect(st.rootNodes[0].expanded).toBe(true)
    expect(st.rootNodes[0].children.map((c) => c.path)).toEqual(['src/page.tsx'])
    expect(st.openTabs.find((t) => t.path === 'src/page.tsx').content).toBe('v2')
    w.unmount()
  })

  it('an open diff tab shows the change as it is after the next turn', async () => {
    const api = (await import('../services/api')).default
    api.getRepositoryFiles.mockImplementation(() => Promise.resolve({ data: { entries: [] } }))
    api.getSourceControlDiff.mockResolvedValueOnce({ data: { path: 'a.py', original: 'x = 1\n', modified: 'x = 2\n' } })
    const w = await browser()
    await w.vm.$.setupState.openDiff({ path: 'a.py' })
    await flushPromises()
    api.getSourceControlDiff.mockResolvedValueOnce({ data: { path: 'a.py', original: 'x = 1\n', modified: 'x = 3\n' } })
    await w.vm.refresh()
    await flushPromises()
    expect(w.find('.monaco-stub').text()).toBe('x = 1\n|x = 3\n|python')
    w.unmount()
  })

  it('says a file has no changes now after it was discarded, instead of two identical sides', async () => {
    const api = (await import('../services/api')).default
    api.getRepositoryFiles.mockImplementation(() => Promise.resolve({ data: { entries: [] } }))
    api.getSourceControlDiff.mockResolvedValueOnce({ data: { path: 'a.py', original: 'x = 1\n', modified: 'x = 2\n' } })
    const w = await browser()
    await w.vm.$.setupState.openDiff({ path: 'a.py' })
    await flushPromises()
    api.getSourceControlDiff.mockResolvedValueOnce({ data: { path: 'a.py', original: 'x = 1\n', modified: 'x = 1\n' } })
    await w.vm.refresh()
    await flushPromises()
    expect(w.text()).toContain('This file has no changes now.')
    expect(w.find('.monaco-stub').exists()).toBe(false)
    w.unmount()
  })

  it('says the sandbox is starting while a diff waits for it', async () => {
    vi.useFakeTimers()
    try {
      const api = (await import('../services/api')).default
      api.getRepositoryFiles.mockImplementation(() => Promise.resolve({ data: { entries: [] } }))
      api.getSourceControlDiff
        .mockRejectedValueOnce({ response: { status: 503, headers: { 'retry-after': '9' }, data: { code: 'RUNNER_STARTING' } } })
        .mockResolvedValueOnce({ data: { path: 'a.py', original: 'x = 1\n', modified: 'x = 2\n' } })
      const w = await browser()
      w.vm.$.setupState.openDiff({ path: 'a.py' })
      await flushPromises()
      expect(w.text()).toContain('Trying again in 9s')
      await vi.advanceTimersByTimeAsync(9000)
      await flushPromises()
      expect(w.find('.monaco-stub').text()).toBe('x = 1\n|x = 2\n|python')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('"View changes" from the chat opens the Source control list', async () => {
    const w = await browser()
    w.vm.showSourceControl()
    await flushPromises()
    expect(w.vm.$.setupState.sidebarTab).toBe('scm')
    expect(w.find('.scm-stub').exists()).toBe(true)
    w.unmount()
  })
})

describe('CodeBrowser: a change opens as a diff tab', () => {
  it('shows the last commit beside the file now, in a "(changes)" tab', async () => {
    const api = (await import('../services/api')).default
    api.getSourceControlDiff.mockResolvedValueOnce({ data: { path: 'src/app.py', original: 'x = 1\n', modified: 'x = 2\n' } })
    const w = await browser()
    await w.vm.$.setupState.openDiff({ path: 'src/app.py' })
    await flushPromises()
    expect(api.getSourceControlDiff).toHaveBeenCalledWith(5, 4, 'src/app.py')
    expect(w.text()).toContain('app.py (changes)')
    expect(w.find('.monaco-stub').text()).toBe('x = 1\n|x = 2\n|python')
    // Opening the same change again goes back to its tab instead of a second one.
    await w.vm.$.setupState.openDiff({ path: 'src/app.py' })
    expect(w.findAll('[role="tab"]').filter((t) => t.text().includes('(changes)'))).toHaveLength(1)
    w.unmount()
  })

  it('never shows a protected file\'s values, and says when the changes cannot be loaded', async () => {
    const api = (await import('../services/api')).default
    api.getSourceControlDiff.mockResolvedValueOnce({ data: { path: '.env.example', redacted: true } })
    const w = await browser()
    await w.vm.$.setupState.openDiff({ path: '.env.example' })
    await flushPromises()
    expect(w.text()).toContain('holds secrets')
    expect(w.find('.monaco-stub').exists()).toBe(false)
    api.getSourceControlDiff.mockRejectedValueOnce({ response: { data: { error: 'Sandbox is starting.' } } })
    await w.vm.$.setupState.openDiff({ path: 'b.py' })
    await flushPromises()
    expect(w.text()).toContain('Sandbox is starting.')
    w.unmount()
  })
})
