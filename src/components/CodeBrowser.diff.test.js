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
