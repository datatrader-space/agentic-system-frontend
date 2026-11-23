// @vitest-environment jsdom
// Inline edit on a selection in the Let's Code editor (ADM-1315): Ctrl+K (and the right-click menu) opens a prompt
// over the selected lines; the change the server's engine turn answers is shown in place; Accept puts it in the tab and
// saves through the normal Save with the version the tab read (a file changed on disk is asked about, never
// overwritten); Reject leaves the file as it was. A .ts and a .py file.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { fakeMonaco, fakeModel, fakeEditor } from '@/utils/inlineEdit.testkit'

vi.mock('@/utils/lazyComponent', () => ({
  lazyComponent: () => ({ props: ['value', 'original', 'language', 'options'], template: '<div class="monaco-stub" />' }),
}))
vi.mock('../services/api', () => ({
  default: {
    getRepositoryFiles: vi.fn(),
    getFileContent: vi.fn(),
    getSourceControlStatus: vi.fn(),
    getSourceControlDiff: vi.fn(),
    saveFileContent: vi.fn(),
    inlineEditSelection: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import api from '../services/api'
import { confirm } from '@/composables/useConfirm'
import { projectCache } from '@/services/projectCache'
import { _reloadEditorSettings } from '@/composables/useEditorSettings'
import { LANGUAGE_SERVERS } from '@/stores/useLanguageServers'

const SHA1 = '1'.repeat(64)
const SHA2 = '2'.repeat(64)
const FILES = {
  'src/app.ts': 'import x from "x"\n\nlet a = 1\nlet b = 2\nexport { a, b }\n',
  'tool.py': 'import os\n\ndef add(a, b):\n    return a+b\n',
}
const ROOT = Object.keys(FILES).map((p) => ({ name: p.split('/').pop(), path: p, type: 'file' }))

let w
async function editorOn(path, selection) {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  w = mount(CodeBrowser, {
    attachTo: document.body,
    props: { repositoryId: 4, systemId: 5, editable: true },
    global: {
      stubs: { Icon: true, SourceControlPanel: { template: '<div class="scm-stub" />', emits: ['open-diff', 'count'] } },
      provide: { [LANGUAGE_SERVERS]: { bind: vi.fn(() => () => {}), canFormat: () => false } },
    },
  })
  await flushPromises()
  const st = w.vm.$.setupState
  await st.openFile(path)
  await flushPromises()
  st.noteMonacoLoaded(fakeMonaco())
  const ed = fakeEditor(fakeModel(FILES[path]), { selection })
  st.onEditorMount(ed, 0)
  return { st, ed, tab: st.openTabs.find((t) => t.type === 'file' && t.path === path) }
}
const lastSave = () => api.saveFileContent.mock.calls.at(-1)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  _reloadEditorSettings()
  projectCache.clearAll()
  window.matchMedia = vi.fn((q) => ({ media: q, matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  api.getRepositoryFiles.mockResolvedValue({ data: { entries: ROOT } })
  api.getFileContent.mockImplementation((_s, _r, path) => Promise.resolve({ data: { content: FILES[path], sha: SHA1 } }))
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
  api.saveFileContent.mockResolvedValue({ data: { success: true, sha: SHA2 } })
})

describe('CodeBrowser: inline edit (ADM-1315)', () => {
  it('is Ctrl+K and in the editor\'s right-click menu, beside "Ask the Coding Agent about this"', async () => {
    const { ed } = await editorOn('src/app.ts', { startLineNumber: 3, startColumn: 1, endLineNumber: 4, endColumn: 10 })
    const a = ed.actions['lets-code.inline-edit']
    expect(a).toMatchObject({ label: 'Edit with the Coding Agent', keybindings: [2048 | 41], contextMenuGroupId: 'navigation' })
    expect(ed.actions['lets-code.ask-coding-agent']).toBeTruthy()
    w.unmount()
  })

  it('.ts: the selection is rewritten through one request, shown in place, and Accept saves with the version read', async () => {
    const { st, ed, tab } = await editorOn('src/app.ts', { startLineNumber: 3, startColumn: 3, endLineNumber: 4, endColumn: 4 })
    ed.actions['lets-code.inline-edit'].run(ed)
    expect(st.inlineEdit).toMatchObject({ state: 'prompt', startLine: 3, endLine: 4, original: 'let a = 1\nlet b = 2' })
    expect(ed.overlays.size).toBe(1)
    api.inlineEditSelection.mockResolvedValueOnce({ data: { replacement: 'const a = 1\nconst b = 2', cost_usd: 0.002,
      price_usd: 0.0024 } })
    await st.sendInlineEdit('Use const')
    const [sys, repo, body] = api.inlineEditSelection.mock.calls[0]
    expect([sys, repo]).toEqual([5, 4])
    expect(body).toMatchObject({ path: 'src/app.ts', start_line: 3, end_line: 4, text: 'let a = 1\nlet b = 2',
      instruction: 'Use const', before: 'import x from "x"\n\n' })
    expect(st.inlineEdit.state).toBe('ready')
    expect([...ed.zones.values()].some((z) => z.domNode?.textContent === 'const a = 1const b = 2')).toBe(true)
    expect(api.saveFileContent).not.toHaveBeenCalled()             // nothing is written before Accept

    await st.acceptInlineEdit()
    await flushPromises()
    const saved = 'import x from "x"\n\nconst a = 1\nconst b = 2\nexport { a, b }\n'
    expect(lastSave()).toEqual([5, 4, 'src/app.ts', saved, SHA1])
    expect(tab).toMatchObject({ content: saved, original: saved, diskSha: SHA2 })
    expect(st.inlineEdit).toBeNull()
    expect(ed.zones.size).toBe(0)
    w.unmount()
  })

  it('.py: Reject leaves the file and the tab as they were; nothing is saved', async () => {
    const { st, ed, tab } = await editorOn('tool.py', { startLineNumber: 4, startColumn: 5, endLineNumber: 4, endColumn: 5 })
    ed.actions['lets-code.inline-edit'].run(ed)
    api.inlineEditSelection.mockResolvedValueOnce({ data: { replacement: '    return a + b', cost_usd: 0.001 } })
    await st.sendInlineEdit('Format it')
    expect(api.inlineEditSelection.mock.calls[0][2]).toMatchObject({ path: 'tool.py', start_line: 4, end_line: 4,
      text: '    return a+b' })
    st.closeInlineEdit()
    expect(ed.getModel().getValue()).toBe(FILES['tool.py'])
    expect(tab.content).toBe(FILES['tool.py'])
    expect(api.saveFileContent).not.toHaveBeenCalled()
    expect(ed.zones.size + ed.overlays.size).toBe(0)
    w.unmount()
  })

  it('a file changed on disk meanwhile is asked about, never overwritten', async () => {
    const { st, ed } = await editorOn('tool.py', { startLineNumber: 4, startColumn: 1, endLineNumber: 4, endColumn: 1 })
    ed.actions['lets-code.inline-edit'].run(ed)
    api.inlineEditSelection.mockResolvedValueOnce({ data: { replacement: '    return a + b' } })
    await st.sendInlineEdit('Format it')
    api.saveFileContent.mockRejectedValueOnce({ response: { status: 409, data: { code: 'CHANGED_ON_DISK', sha: SHA2 } } })
    confirm.mockResolvedValueOnce(false)                          // "Compare first"
    await st.acceptInlineEdit()
    await flushPromises()
    expect(api.saveFileContent).toHaveBeenCalledTimes(1)
    expect(lastSave()[4]).toBe(SHA1)
    expect(confirm).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('lines changed while the change was made: not put in, said, Retry sends the lines as they are now', async () => {
    const { st, ed } = await editorOn('src/app.ts', { startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 1 })
    ed.actions['lets-code.inline-edit'].run(ed)
    api.inlineEditSelection.mockResolvedValueOnce({ data: { replacement: 'const a = 1' } })
    await st.sendInlineEdit('Use const')
    ed.getModel().setValue(FILES['src/app.ts'].replace('let a = 1', 'let a = 7'))
    await st.acceptInlineEdit()
    expect(st.inlineEdit.state).toBe('error')
    expect(st.inlineEdit.error).toContain('changed while the change was being made')
    expect(api.saveFileContent).not.toHaveBeenCalled()
    api.inlineEditSelection.mockResolvedValueOnce({ data: { replacement: 'const a = 7' } })
    await st.sendInlineEdit('Use const')
    expect(api.inlineEditSelection.mock.calls[1][2].text).toBe('let a = 7')
    w.unmount()
  })

  it('a refusal is said in the prompt (a protected file, no model, the agent\'s own words)', async () => {
    const { st, ed } = await editorOn('src/app.ts', { startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 1 })
    ed.actions['lets-code.inline-edit'].run(ed)
    api.inlineEditSelection.mockRejectedValueOnce({ response: { status: 422, data: {
      error: 'The Coding Agent did not return a change. Try again, or say it differently.', code: 'NO_CHANGE',
      message: 'Which variable?', cost_usd: 0.001, price_usd: 0.0012 } } })
    await st.sendInlineEdit('fix')
    expect(st.inlineEdit).toMatchObject({ state: 'error', detail: 'Which variable?' })
    expect(st.inlineEdit.usage.price_usd).toBe(0.0012)
    w.unmount()
  })

  it('switching the tab closes it; an answer that comes after a close is dropped', async () => {
    const { st, ed } = await editorOn('src/app.ts', { startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 1 })
    ed.actions['lets-code.inline-edit'].run(ed)
    let answer
    api.inlineEditSelection.mockReturnValueOnce(new Promise((r) => { answer = r }))
    const sent = st.sendInlineEdit('Use const')
    await st.openFile('tool.py')
    await flushPromises()
    expect(st.inlineEdit).toBeNull()
    answer({ data: { replacement: 'const a = 1' } })
    await sent
    expect(st.inlineEdit).toBeNull()
    expect(ed.zones.size).toBe(0)
    w.unmount()
  })
})
