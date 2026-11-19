// @vitest-environment jsdom
// Format on save and a language server's changes to open tabs (ADM-1319). With the editor setting on (off by default),
// Save formats a TypeScript, JavaScript or Python file first and saves the result, still naming the version it opened
// (ADM-1323); a formatter that fails never stops the save. A rename or a quick fix changes a file open in a tab through
// `editOpenFile`: the tab's text changes and it becomes unsaved.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
import { projectCache } from '@/services/projectCache'
import { useEditorSettings, _reloadEditorSettings } from '@/composables/useEditorSettings'
import { LANGUAGE_SERVERS } from '@/stores/useLanguageServers'

const ROOT = [{ name: 'app.py', path: 'app.py', type: 'file' }, { name: 'README.md', path: 'README.md', type: 'file' }]
const SHA1 = '1'.repeat(64)
const SHA2 = '2'.repeat(64)
const all = (text, newText) => [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: text.length } }, newText }]

let languages
async function browser() {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  const w = mount(CodeBrowser, {
    props: { repositoryId: 4, systemId: 5, editable: true },
    global: {
      stubs: { Icon: true, SourceControlPanel: { template: '<div class="scm-stub" />', emits: ['open-diff', 'count'] } },
      provide: { [LANGUAGE_SERVERS]: languages },
    },
  })
  await flushPromises()
  return w
}
const fileTab = (st, path) => st.openTabs.find((t) => t.type === 'file' && t.path === path)
const lastSave = () => api.saveFileContent.mock.calls.at(-1)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  _reloadEditorSettings()
  projectCache.clearAll()
  languages = {
    bind: vi.fn(() => () => {}),
    canFormat: (path) => /\.(py|ts|tsx|js)$/.test(path),
    formatEdits: vi.fn(),
  }
  api.getRepositoryFiles.mockResolvedValue({ data: { entries: ROOT } })
  api.getFileContent.mockResolvedValue({ data: { content: 'x=1', sha: SHA1 } })
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
  api.saveFileContent.mockResolvedValue({ data: { success: true, sha: SHA2 } })
})
afterEach(() => { localStorage.clear(); _reloadEditorSettings() })

async function editedPython() {
  const w = await browser()
  const st = w.vm.$.setupState
  await st.openFile('app.py')
  st.onEditorChange('x=2')
  return { w, st }
}

describe('CodeBrowser: format on save (ADM-1319)', () => {
  it('is off by default: Save writes the text as it is, naming the version opened', async () => {
    expect(useEditorSettings().settings.formatOnSave).toBe(false)
    const { w, st } = await editedPython()
    await st.saveActive()
    expect(languages.formatEdits).not.toHaveBeenCalled()
    expect(lastSave()).toEqual([5, 4, 'app.py', 'x=2', SHA1])
    w.unmount()
  })

  it('on: the file is formatted, then the formatted text is saved with the sha it opened at', async () => {
    useEditorSettings().settings.formatOnSave = true
    languages.formatEdits.mockResolvedValueOnce(all('x=2', 'x = 2\n'))
    const { w, st } = await editedPython()
    await st.saveActive()
    expect(languages.formatEdits).toHaveBeenCalledWith('app.py', 'x=2')
    expect(lastSave()).toEqual([5, 4, 'app.py', 'x = 2\n', SHA1])
    expect(fileTab(st, 'app.py')).toMatchObject({ content: 'x = 2\n', original: 'x = 2\n', diskSha: SHA2 })
    expect(notify.warning).not.toHaveBeenCalled()
    w.unmount()
  })

  it('a formatter that fails never stops the save: the text is saved as it is and one notification says why', async () => {
    useEditorSettings().settings.formatOnSave = true
    languages.formatEdits.mockRejectedValueOnce(new Error('Cannot parse app.py: line 1.'))
    const { w, st } = await editedPython()
    await st.saveActive()
    expect(lastSave()).toEqual([5, 4, 'app.py', 'x=2', SHA1])
    expect(notify.warning).toHaveBeenCalledTimes(1)
    expect(notify.warning).toHaveBeenCalledWith('app.py was saved without formatting: Cannot parse app.py: line 1.')
    expect(notify.success).toHaveBeenCalledWith('Saved app.py')
    w.unmount()
  })

  it('Python formatting still being set up never holds the save: saved unformatted with its sha, one notification', async () => {
    useEditorSettings().settings.formatOnSave = true
    languages.formatEdits.mockRejectedValueOnce(Object.assign(
      new Error('Python formatting is being set up in your project (first time only). Try again in a minute.'),
      { preparing: true, retryAfter: 30 }))
    const { w, st } = await editedPython()
    await st.saveActive()
    expect(lastSave()).toEqual([5, 4, 'app.py', 'x=2', SHA1])
    expect(fileTab(st, 'app.py')).toMatchObject({ content: 'x=2', original: 'x=2', diskSha: SHA2 })
    expect(notify.info).toHaveBeenCalledTimes(1)
    expect(notify.info).toHaveBeenCalledWith('app.py was saved without formatting: Python formatting is being set up in '
      + 'your project (first time only). It will format once setup finishes.')
    expect(notify.warning).not.toHaveBeenCalled()
    expect(notify.error).not.toHaveBeenCalled()
    expect(notify.success).toHaveBeenCalledWith('Saved app.py')
    w.unmount()
  })

  it('Python formatting that could not be set up never stops the save: saved with its sha, one notification with the log', async () => {
    useEditorSettings().settings.formatOnSave = true
    languages.formatEdits.mockRejectedValueOnce(Object.assign(
      new Error("Python formatting could not be set up in your project's sandbox."), { setupLog: 'ERROR: no ruff\n' }))
    const { w, st } = await editedPython()
    await st.saveActive()
    expect(lastSave()).toEqual([5, 4, 'app.py', 'x=2', SHA1])
    expect(notify.warning).toHaveBeenCalledTimes(1)
    expect(notify.warning).toHaveBeenCalledWith("app.py was saved without formatting: Python formatting could not be set "
      + "up in your project's sandbox. Click this notification to copy the setup log.",
    expect.objectContaining({ onClick: expect.any(Function) }))
    expect(notify.error).not.toHaveBeenCalled()
    expect(notify.success).toHaveBeenCalledWith('Saved app.py')
    w.unmount()
  })

  it('a file with no formatter is saved without asking for one', async () => {
    useEditorSettings().settings.formatOnSave = true
    const w = await browser()
    const st = w.vm.$.setupState
    await st.openFile('README.md')
    st.onEditorChange('# hi')
    await st.saveActive()
    expect(languages.formatEdits).not.toHaveBeenCalled()
    expect(lastSave()).toEqual([5, 4, 'README.md', '# hi', SHA1])
    w.unmount()
  })
})

describe("CodeBrowser: a language server's change to a file open in a tab (ADM-1319)", () => {
  it('a tab not shown takes the edits in its text and becomes unsaved; a file not open answers null', async () => {
    const w = await browser()
    const st = w.vm.$.setupState
    await st.openFile('app.py')
    await st.openFile('README.md')                                           // app.py is now in the background
    const edits = [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, newText: 'y' }]
    expect(st.editOpenFile('app.py', edits)).toBe('y=1')
    expect(st.isDirty(fileTab(st, 'app.py'))).toBe(true)
    expect(st.editOpenFile('lib/other.py', edits)).toBeNull()
    expect(api.saveFileContent).not.toHaveBeenCalled()                      // the person saves it
    w.unmount()
  })

  it('the tab shown changes through the editor, so Undo takes it back', async () => {
    const w = await browser()
    const st = w.vm.$.setupState
    await st.openFile('app.py')
    let text = 'x=1'
    const editor = {
      getModel: () => ({ getValue: () => text }),
      executeEdits: vi.fn((_src, edits) => { text = edits[0].text + text.slice(edits[0].range.endColumn - 1); return true }),
      pushUndoStop: vi.fn(),
    }
    st.onEditorMount(editor)
    expect(languages.bind).toHaveBeenCalledWith(expect.objectContaining({ editOpenFile: st.editOpenFile }))
    const out = st.editOpenFile('app.py', [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, newText: 'z' }])
    expect(editor.executeEdits).toHaveBeenCalledWith('lets-code-language-server', [expect.objectContaining({
      range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 2 }, text: 'z' })])
    expect(editor.pushUndoStop).toHaveBeenCalled()
    expect(out).toBe('z=1')
    expect(fileTab(st, 'app.py').content).toBe('z=1')
    w.unmount()
  })
})
