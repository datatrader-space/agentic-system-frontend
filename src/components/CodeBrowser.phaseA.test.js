// @vitest-environment jsdom
// The Let's Code editor's Go to file (Ctrl+P / Ctrl+E) and settings (the gear beside Save) (ADM-1205, phase A).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

vi.mock('@/utils/lazyComponent', () => ({
  lazyComponent: () => ({ props: ['value', 'original', 'language', 'options'], template: '<div class="monaco-stub" :data-font="options && options.fontSize" :data-wrap="options && options.wordWrap" :data-minimap="options && options.minimap && String(options.minimap.enabled)" :data-lines="options && options.lineNumbers">{{ value }}</div>' }),
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
import { _reloadEditorSettings } from '@/composables/useEditorSettings'

let w
async function browser() {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  w = mount(CodeBrowser, {
    attachTo: document.body,
    props: { repositoryId: 4, systemId: 5, editable: true },
    global: { stubs: { Icon: true, RouterLink: RouterLinkStub, SourceControlPanel: { template: '<div />' } } },
  })
  await flushPromises()
  return w
}
const press = (key, extra = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...extra }))
const settle = async () => { for (let i = 0; i < 3; i++) { await flushPromises(); await new Promise((r) => setTimeout(r, 140)) } }

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()
  localStorage.clear()
  _reloadEditorSettings()
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
  api.getRepositoryFiles.mockImplementation((_s, _r, { search } = {}) => Promise.resolve({ data: { entries: search
    ? [{ name: 'views.py', path: 'app/views.py', type: 'file' }, { name: 'old_views.py', path: 'old_views.py', type: 'file' }]
    : [{ name: 'README.md', path: 'README.md', type: 'file' }, { name: 'app', path: 'app', type: 'directory' }] } }))
  api.getFileContent.mockImplementation((_s, _r, p) => Promise.resolve({ data: { path: p, content: `content of ${p}` } }))
})
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

describe('Go to file (Ctrl+P)', () => {
  it('Ctrl+P opens it, typing searches every name, Enter opens the best match', async () => {
    await browser()
    const ev = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true, cancelable: true })
    window.dispatchEvent(ev)
    await flushPromises()
    expect(ev.defaultPrevented).toBe(true)                         // never the browser's print
    const input = document.querySelector('.qo-in')
    expect(document.activeElement).toBe(input)
    input.value = 'views'
    input.dispatchEvent(new Event('input'))
    await settle()
    expect(api.getRepositoryFiles).toHaveBeenCalledWith(5, 4, { search: 'views' })
    expect([...document.querySelectorAll('.qo-item')].map((li) => li.querySelector('.qo-path').textContent + '/' + li.querySelector('.qo-name').textContent))
      .toEqual(['app/views.py', '/old_views.py'])
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await settle()
    expect(document.querySelector('.qo-in')).toBeNull()
    expect(api.getFileContent).toHaveBeenCalledWith(5, 4, 'app/views.py')
  })

  it('"name:line" opens the file at that line; Arrow keys move; Escape closes', async () => {
    await browser()
    press('e')
    await flushPromises()
    const input = document.querySelector('.qo-in')
    input.value = 'views:12'
    input.dispatchEvent(new Event('input'))
    await settle()
    expect(document.querySelector('.qo-status').textContent).toContain('line 12')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await flushPromises()
    expect(document.querySelectorAll('.qo-item')[1].classList.contains('on')).toBe(true)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.querySelector('.qo-in')).toBeNull()
  })

  it('with nothing typed it lists the files opened most recently', async () => {
    await browser()
    await w.findAll('.tree-node').find((n) => n.text().includes('README.md')).trigger('click')
    await flushPromises()
    press('p')
    await flushPromises()
    expect([...document.querySelectorAll('.qo-item .qo-name')].map((n) => n.textContent)).toEqual(['README.md'])
    expect(document.querySelector('.qo-tag').textContent).toBe('recently opened')
  })

  it('Ctrl+Shift+F opens the Search tab', async () => {
    await browser()
    press('F', { shiftKey: true })
    await flushPromises()
    expect(w.find('.sidebar-tab.active').text()).toContain('Search')
  })
})

describe('editor settings (the gear beside Save)', () => {
  it('change at once and are kept', async () => {
    await browser()
    await w.findAll('.tree-node').find((n) => n.text().includes('README.md')).trigger('click')
    await flushPromises()
    expect(w.find('.monaco-stub').attributes()).toMatchObject({ 'data-font': '14', 'data-wrap': 'on', 'data-minimap': 'true', 'data-lines': 'on' })
    await w.find('.tab-gear').trigger('click')
    await flushPromises()
    const font = document.querySelector('.es select')
    font.value = '18'
    font.dispatchEvent(new Event('change'))
    const checks = document.querySelectorAll('.es input[type="checkbox"]')
    checks[0].click()                                            // wrap off
    checks[1].click()                                            // minimap off
    await flushPromises()
    expect(w.find('.monaco-stub').attributes()).toMatchObject({ 'data-font': '18', 'data-wrap': 'off', 'data-minimap': 'false' })
    expect(JSON.parse(localStorage.getItem('lets-code:editor-settings'))).toMatchObject({ fontSize: 18, wordWrap: false, minimap: false })
    document.querySelector('.es-reset').click()
    await flushPromises()
    expect(w.find('.monaco-stub').attributes('data-font')).toBe('14')
  })
})
