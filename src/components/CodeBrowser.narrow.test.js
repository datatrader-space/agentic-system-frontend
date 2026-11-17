// @vitest-environment jsdom
// The Let's Code editor on a narrow screen (640 px and less; ADM-1128, 2026-11-17): one pane at a time. The sidebar's
// tab row gains an Editor tab; a sidebar tab shows its view, the Editor tab the editor; opening a file shows the
// editor. At 375 px the file list and the editor used to sit side by side (162 px and 198 px). Wide screens unchanged.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

vi.mock('@/utils/lazyComponent', () => ({
  lazyComponent: () => ({ props: ['value', 'original', 'language', 'options'], template: '<div class="monaco-stub">{{ value }}</div>' }),
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
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

import api from '../services/api'
import { projectCache } from '@/services/projectCache'

let w
let listeners
function screen(narrow) {
  listeners = []
  window.matchMedia = vi.fn((q) => ({
    media: q, matches: q === '(max-width: 640px)' ? narrow : false,
    addEventListener: (_e, f) => listeners.push(f), removeEventListener: vi.fn(),
  }))
}
async function browser() {
  vi.resetModules()
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  w = mount(CodeBrowser, {
    attachTo: document.body,
    props: { repositoryId: 4, systemId: 5, editable: true },
    global: { stubs: { Icon: true, RouterLink: RouterLinkStub, SourceControlPanel: { name: 'SourceControlPanel', emits: ['branch'], template: '<div class="scm-stub" />' } } },
  })
  await flushPromises()
  return w
}
const root = () => w.find('.code-browser')
const tabs = () => w.findAll('.sidebar-tab').map((t) => [t.attributes('title'), t.attributes('aria-selected')])
const tab = (title) => w.findAll('.sidebar-tab').find((t) => t.attributes('title') === title)

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()
  localStorage.clear()
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
  api.getRepositoryFiles.mockResolvedValue({ data: { entries: [{ name: 'README.md', path: 'README.md', type: 'file' }] } })
  api.getFileContent.mockImplementation((_s, _r, p) => Promise.resolve({ data: { path: p, content: `content of ${p}` } }))
})
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

describe('a narrow screen', () => {
  it('starts on the editor, with an Editor tab first in the row', async () => {
    screen(true)
    await browser()
    expect(root().classes()).toEqual(expect.arrayContaining(['narrow', 'pane-editor']))
    expect(tabs()[0]).toEqual(['Editor', 'true'])
    expect(tab('Files').attributes('aria-selected')).toBe('false')     // Files is the view behind, not shown
    expect(w.find('.cb-sidebar').attributes('style')).toBeUndefined()  // no fixed 300 px width
  })

  it('a sidebar tab shows its view; opening a file from it shows the editor again', async () => {
    screen(true)
    await browser()
    await tab('Files').trigger('click')
    expect(root().classes()).toContain('pane-side')
    expect(tab('Files').attributes('aria-selected')).toBe('true')
    expect(tab('Editor').attributes('aria-selected')).toBe('false')
    await w.find('.tree-node').trigger('click')                        // README.md
    await flushPromises()
    expect(root().classes()).toContain('pane-editor')
    expect(w.find('.monaco-stub').text()).toBe('content of README.md')
  })

  it('Source control and the Editor tab switch back and forth', async () => {
    screen(true)
    await browser()
    await tab('Source control').trigger('click')
    expect(root().classes()).toContain('pane-side')
    expect(w.find('.scm-stub').exists()).toBe(true)
    await tab('Editor').trigger('click')
    expect(root().classes()).toContain('pane-editor')
    expect(tab('Source control').attributes('aria-selected')).toBe('false')
  })

  it('turning the phone or widening the window follows the screen', async () => {
    screen(true)
    await browser()
    expect(root().classes()).toContain('narrow')
    listeners.forEach((f) => f({ matches: false }))
    await flushPromises()
    expect(root().classes()).not.toContain('narrow')
    expect(tab('Editor')).toBeUndefined()
  })
})

describe('a wide screen', () => {
  it('is unchanged: no Editor tab, the sidebar keeps its width and Files is selected', async () => {
    screen(false)
    await browser()
    expect(root().classes()).not.toContain('narrow')
    expect(tab('Editor')).toBeUndefined()
    expect(w.find('.cb-sidebar').attributes('style')).toContain('width: 300px')
    expect(tab('Files').attributes('aria-selected')).toBe('true')
  })
})
