// @vitest-environment jsdom
// The Let's Code editor's layout and navigation (ADM-1322): two editor groups side by side (one at a time on a narrow
// screen), tabs that drag, pin and move by keyboard, breadcrumbs and the Outline from the language server, a sanitised
// markdown preview, autosave through the version-checked save, and the command palette on Ctrl+Shift+P.
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
    getFileImage: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { projectCache } from '@/services/projectCache'
import { useEditorSettings, _reloadEditorSettings } from '@/composables/useEditorSettings'
import { LANGUAGE_SERVERS } from '@/stores/useLanguageServers'

const SHA1 = '1'.repeat(64)
const SHA2 = '2'.repeat(64)
const SHA3 = '3'.repeat(64)
const ROOT = [{ name: 'src', path: 'src', type: 'directory' }, { name: 'README.md', path: 'README.md', type: 'file' },
  { name: 'app.py', path: 'app.py', type: 'file' }]
const CHANGED = { response: { status: 409, data: { error: 'changed', code: 'CHANGED_ON_DISK', sha: SHA3 } } }
const r = (sl, sc, el, ec) => ({ start: { line: sl, character: sc }, end: { line: el, character: ec } })
const SYMBOLS = [{ name: 'Cart', kind: 5, range: r(0, 0, 5, 1), selectionRange: r(0, 6, 0, 10), children: [
  { name: 'add', kind: 6, range: r(1, 2, 3, 3), selectionRange: r(1, 2, 1, 5) }] }]

let w
let languages
let listeners
function screen(narrow) {
  listeners = []
  window.matchMedia = vi.fn((q) => ({ media: q, matches: q === '(max-width: 640px)' ? narrow : false,
    addEventListener: (_e, f) => listeners.push(f), removeEventListener: vi.fn() }))
}
async function browser({ provide = true } = {}) {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  w = mount(CodeBrowser, {
    attachTo: document.body,
    props: { repositoryId: 4, systemId: 5, editable: true },
    global: {
      stubs: { Icon: true, RouterLink: RouterLinkStub, SourceControlPanel: { template: '<div class="scm-stub" />', emits: ['open-diff', 'count'] } },
      provide: provide ? { [LANGUAGE_SERVERS]: languages } : {},
    },
  })
  await flushPromises()
  return w.vm.$.setupState
}
const group = (g) => w.find(`[data-test="cb-group-${g}"]`)
const tabNames = (g) => group(g).findAll('.tab:not(.chat-tab)').map((t) => t.find('.tab-name').text())
const fileTab = (st, path) => st.openTabs.find((t) => t.type === 'file' && t.path === path)
const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ctrlKey: true, ...o }))
// A stand-in for a Monaco editor: the events the editor listens to, and what a reveal calls.
function fakeEditor() {
  const on = {}
  const ev = (name) => (fn) => { on[name] = fn; return { dispose() {} } }
  return {
    on, getModel: () => null, focus: vi.fn(), setSelection: vi.fn(), revealRangeInCenter: vi.fn(), getAction: vi.fn(() => ({ run: vi.fn() })),
    onDidFocusEditorWidget: ev('focus'), onDidBlurEditorWidget: ev('blur'), onDidChangeCursorPosition: ev('cursor'), onDidDispose: ev('dispose'),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  screen(false)
  localStorage.clear()
  _reloadEditorSettings()
  projectCache.clearAll()
  languages = {
    bind: vi.fn(() => () => {}),
    canFormat: () => false,
    formatEdits: vi.fn(),
    documentSymbols: vi.fn(async (path) => (path.endsWith('.py') ? { state: 'ready', result: SYMBOLS } : { state: 'none' })),
  }
  api.getRepositoryFiles.mockResolvedValue({ data: { entries: ROOT } })
  api.getFileContent.mockImplementation((_s, _r, p) => Promise.resolve({ data: { content: p.endsWith('.md') ? '# Notes' : 'x=1', sha: SHA1 } }))
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
  api.saveFileContent.mockResolvedValue({ data: { success: true, sha: SHA2 } })
})
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = ''; vi.useRealTimers(); localStorage.clear(); _reloadEditorSettings() })

describe('two editor groups', () => {
  it('"Open to the side" moves the tab to a second group; each group shows its own tab; closing the group ends the split', async () => {
    const st = await browser()
    await st.openFile('README.md')
    await st.openFile('app.py')
    expect(w.findAll('.editor-group')).toHaveLength(1)
    await w.find('[data-test="cb-split"]').trigger('click')
    expect(w.findAll('.editor-group')).toHaveLength(2)
    expect(tabNames(0)).toEqual(['README.md'])
    expect(tabNames(1)).toEqual(['app.py'])
    expect(st.activeTabId).toBe(fileTab(st, 'app.py').id)                    // the new group has the focus
    expect(group(0).find('.tab.active .tab-name').text()).toBe('README.md')  // and the first still shows its tab
    expect(group(1).classes()).toContain('focused')
    // A file opened now goes to the focused group; the first group's tab is untouched.
    await st.openFile('src/b.py')
    expect(tabNames(1)).toEqual(['app.py', 'b.py'])
    await group(0).find('.tab').trigger('click')
    expect(group(0).classes()).toContain('focused')
    expect(group(1).find('.tab.active .tab-name').text()).toBe('b.py')
    confirm.mockResolvedValue(true)
    await w.find('[data-test="cb-close-group"]').trigger('click')
    await flushPromises()
    expect(w.findAll('.editor-group')).toHaveLength(1)
    expect(tabNames(0)).toEqual(['README.md'])
  })

  it("Ctrl+\\ splits; a group's last tab moved out closes it; a Review tab never moves", async () => {
    const st = await browser()
    await st.openFile('README.md')
    expect(w.find('[data-test="cb-split"]').exists()).toBe(false)               // the only tab: nothing would be left
    key('\\')
    await flushPromises()
    expect(st.split).toBe(false)
    await st.openFile('app.py')
    key('\\')
    await flushPromises()
    expect(tabNames(0)).toEqual(['README.md'])
    expect(tabNames(1)).toEqual(['app.py'])
    st.moveToOtherGroup(fileTab(st, 'app.py'))                                   // back into the first
    await flushPromises()
    expect(w.findAll('.editor-group')).toHaveLength(1)
    expect(tabNames(0)).toEqual(['README.md', 'app.py'])
    // The first group's last tab moved to the second: the second becomes the only group.
    st.moveToOtherGroup(fileTab(st, 'app.py'))
    await flushPromises()
    st.moveToOtherGroup(fileTab(st, 'README.md'), 1)
    await flushPromises()
    expect(w.findAll('.editor-group')).toHaveLength(1)
    expect(tabNames(0)).toEqual(['app.py', 'README.md'])
    st.openReview({ messageId: 7 })
    const review = st.openTabs.find((t) => t.type === 'review')
    st.moveToOtherGroup(review)
    expect(st.split).toBe(false)
  })

  it('on a narrow screen one group shows at a time, and a button shows the other', async () => {
    screen(true)
    const st = await browser()
    await st.openFile('README.md')
    await st.openFile('app.py')
    st.moveToOtherGroup(fileTab(st, 'app.py'))
    await flushPromises()
    expect(group(0).classes()).toContain('group-hidden')
    expect(group(1).classes()).not.toContain('group-hidden')
    await group(1).find('[data-test="cb-other-group"]').trigger('click')
    expect(group(1).classes()).toContain('group-hidden')
    expect(group(0).classes()).not.toContain('group-hidden')
  })
})

describe('tabs: pin, reorder, keys and the tab menu', () => {
  it('a pinned tab comes first, shows a pin, and "Close others" leaves it open', async () => {
    const st = await browser()
    for (const p of ['README.md', 'app.py', 'src/b.py']) await st.openFile(p)
    st.togglePin(fileTab(st, 'src/b.py'))
    await flushPromises()
    expect(tabNames(0)).toEqual(['b.py', 'README.md', 'app.py'])
    expect(group(0).find('[data-test="cb-tab-unpin"]').attributes('aria-label')).toBe('Unpin b.py')
    const readme = group(0).findAll('.tab').find((t) => t.text().includes('README.md'))
    await readme.trigger('contextmenu')
    await flushPromises()
    const items = [...document.querySelectorAll('.xm-item .xm-label')].map((b) => b.textContent.trim())
    expect(items).toEqual(expect.arrayContaining(['Pin', 'Open to the side', 'Close', 'Close others', 'Close to the right', 'Show in Files']))
    ;[...document.querySelectorAll('.xm-item')].find((b) => b.textContent.includes('Close others')).click()
    await flushPromises()
    expect(tabNames(0)).toEqual(['b.py', 'README.md'])
  })

  it('a tab dragged onto another lands before it; onto the other group it moves there', async () => {
    const st = await browser()
    for (const p of ['README.md', 'app.py', 'src/b.py']) await st.openFile(p)
    const dt = { setData: vi.fn(), getData: vi.fn(), dropEffect: '', effectAllowed: '' }
    const tabEl = (name) => group(0).findAll('.tab').find((t) => t.text().includes(name))
    await tabEl('b.py').trigger('dragstart', { dataTransfer: dt })
    await tabEl('README.md').trigger('dragover', { dataTransfer: dt })
    expect(tabEl('README.md').classes()).toContain('tab-drop-before')
    await tabEl('README.md').trigger('drop', { dataTransfer: dt })
    expect(tabNames(0)).toEqual(['b.py', 'README.md', 'app.py'])
    // Dropped on the editor with one group: it opens to the side.
    await tabEl('app.py').trigger('dragstart', { dataTransfer: dt })
    await group(0).find('.editor-container').trigger('dragover', { dataTransfer: dt })
    expect(group(0).find('.drop-hint').text()).toBe('Open to the side')
    await group(0).find('.editor-container').trigger('drop', { dataTransfer: dt })
    expect(tabNames(1)).toEqual(['app.py'])
  })

  it('keys on a tab: arrows move the focus, Ctrl+Shift+PageDown moves the tab, Delete closes it', async () => {
    const st = await browser()
    for (const p of ['README.md', 'app.py']) await st.openFile(p)
    const tabs = () => group(0).findAll('.tab')
    tabs()[0].element.focus()
    await tabs()[0].trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tabs()[1].element)
    await tabs()[0].trigger('keydown', { key: 'PageDown', ctrlKey: true, shiftKey: true })
    await flushPromises()
    expect(tabNames(0)).toEqual(['app.py', 'README.md'])
    await tabs()[1].trigger('keydown', { key: 'Delete' })
    await flushPromises()
    expect(tabNames(0)).toEqual(['app.py'])
  })
})

describe('markdown preview', () => {
  it("a picture the file names by a project path is read through the editor's API and shown (live, 2026-11-20)", async () => {
    const made = []
    const realCreate = URL.createObjectURL
    URL.createObjectURL = vi.fn((b) => { made.push(b); return `blob:pic-${made.length}` })
    try {
      api.getFileImage.mockResolvedValue({ data: new Blob(['png']) })
      api.getFileContent.mockResolvedValue({ data: { sha: SHA1, content: '![shot](img/shot.png)\n\n![web](https://example.com/a.png)' } })
      const st = await browser()
      await st.openFile('docs/guide.md')
      await w.find('[data-test="cb-md-preview"]').trigger('click')
      await flushPromises()
      const imgs = w.findAll('[data-test="cb-md-render"] img')
      expect(api.getFileImage).toHaveBeenCalledWith(5, 4, 'docs/img/shot.png')        // resolved from the file's folder
      expect(api.getFileImage).toHaveBeenCalledTimes(1)                                // a web address is not read
      expect(imgs[0].attributes('src')).toBe('blob:pic-1')
      expect(imgs[1].attributes('src')).toBe('https://example.com/a.png')
    } finally {
      URL.createObjectURL = realCreate
    }
  })

  it('beside the text or in its place, sanitised; a link to a project file opens it', async () => {
    api.getFileContent.mockImplementation((_s, _r, p) => Promise.resolve({ data: { sha: SHA1, content: p === 'README.md'
      ? '# Notes\n\n<img src=x onerror="alert(1)">\n\n[setup](docs/setup.md) [web](https://example.com)' : 'setup' } }))
    const st = await browser()
    await st.openFile('README.md')
    expect(w.find('[data-test="cb-md-render"]').exists()).toBe(false)               // the text, unless asked
    await w.find('[data-test="cb-md-side"]').trigger('click')
    const art = w.find('[data-test="cb-md-render"]')
    expect(art.find('h1').text()).toBe('Notes')
    expect(art.find('img').exists()).toBe(false)
    expect(art.findAll('*').some((el) => [...el.element.attributes].some((a) => /^on/i.test(a.name)))).toBe(false)
    expect(w.find('.monaco-stub').isVisible()).toBe(true)
    expect(art.find('a[href="https://example.com"]').attributes()).toMatchObject({ target: '_blank', rel: expect.stringContaining('noopener') })
    await w.find('[data-test="cb-md-preview"]').trigger('click')
    expect(w.find('.monaco-stub').isVisible()).toBe(false)                           // kept mounted under the preview
    await w.find('[data-test="cb-md-render"] a[href="docs/setup.md"]').trigger('click')
    await flushPromises()
    expect(api.getFileContent).toHaveBeenCalledWith(5, 4, 'docs/setup.md')
    expect(st.activeTab.path).toBe('docs/setup.md')
  })

  it('a file that is not markdown has no preview buttons', async () => {
    const st = await browser()
    await st.openFile('app.py')
    expect(w.find('[data-test="cb-md-side"]').exists()).toBe(false)
    expect(w.find('[data-test="cb-md-preview"]').exists()).toBe(false)
  })
})

describe('outline and breadcrumbs', () => {
  it("from the language server's symbols: the Outline lists them, a click reveals one; the breadcrumbs follow the cursor", async () => {
    const st = await browser()
    await st.openFile('src/app.py')
    const ed = fakeEditor()
    st.onEditorMount(ed, 0)
    await new Promise((res) => setTimeout(res, 5))
    await flushPromises()
    expect(languages.documentSymbols).toHaveBeenCalledWith('src/app.py')
    const crumbs = () => w.find('[data-test="breadcrumbs"]')
    expect(crumbs().text()).toContain('src')
    expect(crumbs().text()).toContain('app.py')
    ed.on.cursor({ position: { lineNumber: 2, column: 4 } })
    await flushPromises()
    expect(crumbs().findAll('.bc-sym').map((x) => x.text())).toEqual(['Cart', 'add'])
    await w.find('[data-test="cb-outline-tab"]').trigger('click')
    const rows = w.findAll('[data-test="outline-row"]')
    expect(rows.map((x) => x.find('.ol-name').text())).toEqual(['Cart', 'add'])
    expect(rows[1].attributes('aria-current')).toBe('true')
    await rows[0].trigger('click')
    await flushPromises()
    expect(ed.setSelection).toHaveBeenCalledWith({ startLineNumber: 1, startColumn: 7, endLineNumber: 1, endColumn: 11 })
    expect(ed.revealRangeInCenter).toHaveBeenCalled()
    // A folder of the breadcrumbs shows it in Files.
    await crumbs().find('.bc-btn').trigger('click')
    expect(w.find('.sidebar-tab.active').text()).toContain('Files')
  })

  it('nothing when no language server answers for the file', async () => {
    const st = await browser()
    await st.openFile('README.md')
    await new Promise((res) => setTimeout(res, 5))
    await flushPromises()
    await w.find('[data-test="cb-outline-tab"]').trigger('click')
    expect(w.find('[data-test="outline"]').text()).toContain('No outline: no language server answers for this file.')
    expect(w.find('[data-test="breadcrumbs"]').findAll('.bc-sym')).toHaveLength(0)
  })
})

describe('autosave (off unless chosen)', () => {
  it('after a pause in typing it saves through the version-checked save, quietly; off, it never saves', async () => {
    vi.useFakeTimers()
    const st = await browser()
    await st.openFile('app.py')
    st.onEditorChange('x=2')
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.saveFileContent).not.toHaveBeenCalled()                       // off by default
    useEditorSettings().settings.autoSave = 'afterDelay'
    await vi.advanceTimersByTimeAsync(0)
    st.onEditorChange('x=3')
    await vi.advanceTimersByTimeAsync(500)
    st.onEditorChange('x=4')                                                 // typing again waits again
    await vi.advanceTimersByTimeAsync(900)
    expect(api.saveFileContent).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(api.saveFileContent).toHaveBeenCalledTimes(1)
    expect(api.saveFileContent.mock.calls[0]).toEqual([5, 4, 'app.py', 'x=4', SHA1])
    expect(notify.success).not.toHaveBeenCalled()
    expect(st.isDirty(fileTab(st, 'app.py'))).toBe(false)
  })

  it('a file changed on disk is never overwritten: the conflict question, then autosave waits for the person', async () => {
    vi.useFakeTimers()
    useEditorSettings().settings.autoSave = 'afterDelay'
    const st = await browser()
    await st.openFile('app.py')
    api.saveFileContent.mockRejectedValueOnce(CHANGED)
    confirm.mockResolvedValueOnce(false)                                     // "Compare first"
    api.getFileContent.mockResolvedValueOnce({ data: { content: 'theirs', sha: SHA3 } })
    st.onEditorChange('mine')
    await vi.advanceTimersByTimeAsync(1100)
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ confirmText: 'Overwrite with mine', cancelText: 'Compare first' }))
    expect(api.saveFileContent).toHaveBeenCalledTimes(1)                     // nothing was written
    expect(notify.info).toHaveBeenCalledWith('Autosave is paused for app.py until you save it yourself.')
    st.showFile(fileTab(st, 'app.py').id)
    st.onEditorChange('mine, more')
    await vi.advanceTimersByTimeAsync(3000)
    expect(api.saveFileContent).toHaveBeenCalledTimes(1)                     // held
    await st.saveActive()                                                    // the person saves: it names the version seen
    expect(api.saveFileContent.mock.calls.at(-1)).toEqual([5, 4, 'app.py', 'mine, more', SHA3])
    st.onEditorChange('again')
    await vi.advanceTimersByTimeAsync(1100)
    expect(api.saveFileContent).toHaveBeenCalledTimes(3)                     // autosave goes on again
  })

  it('on focus change: showing another tab saves the one left', async () => {
    useEditorSettings().settings.autoSave = 'onFocusChange'
    const st = await browser()
    await st.openFile('app.py')
    await st.openFile('README.md')
    st.showFile(fileTab(st, 'app.py').id)
    await flushPromises()
    st.onEditorChange('x=9')
    await flushPromises()
    expect(api.saveFileContent).not.toHaveBeenCalled()                      // still in its editor
    st.showFile(fileTab(st, 'README.md').id)
    await flushPromises()
    expect(api.saveFileContent).toHaveBeenCalledWith(5, 4, 'app.py', 'x=9', SHA1)
  })
})

describe('the command palette (Ctrl+Shift+P)', () => {
  it("lists the editor's commands, searches them, and runs one with Enter", async () => {
    const st = await browser()
    await st.openFile('README.md')
    await st.openFile('app.py')
    key('P', { shiftKey: true })
    await flushPromises()
    const input = document.querySelector('[data-test="cp-input"]')
    expect(document.activeElement).toBe(input)
    const labels = () => [...document.querySelectorAll('[data-test="cp-item"] .cp-label')].map((x) => x.textContent)
    expect(labels()).toEqual(expect.arrayContaining(['File: Go to file', 'View: Toggle the terminal', 'View: Open to the side',
      'Editor: Format document', 'Preferences: Turn vim keys on', 'Tab: Pin the tab']))
    expect(labels()).not.toContain('File: Save')                              // nothing to save
    input.value = 'pin tab'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(labels()[0]).toBe('Tab: Pin the tab')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[data-test="cp-input"]')).toBeNull()
    expect(fileTab(st, 'app.py').pinned).toBe(true)
  })

  it('Toggle the terminal sends the Terminal its own shortcut, Ctrl+`', async () => {
    const st = await browser()
    const seen = []
    const spy = (e) => seen.push([e.key, e.code, e.ctrlKey, e.shiftKey])
    window.addEventListener('keydown', spy)
    st.paletteCommands.find((c) => c.id === 'terminal').run()
    st.paletteCommands.find((c) => c.id === 'new-terminal').run()
    window.removeEventListener('keydown', spy)
    expect(seen).toEqual([['`', 'Backquote', true, false], ['~', 'Backquote', true, true]])
  })
})
