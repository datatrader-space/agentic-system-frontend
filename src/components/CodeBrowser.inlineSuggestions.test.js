// @vitest-environment jsdom
// Inline suggestions in the Let's Code editor (ADM-1316): the page registers one Monaco inline-completions provider for
// its own editors, which asks the server for the file open in the editor typed in; the status line under the editor
// says when suggestions are on (and today's spend) or stopped and why, with Resume. A read-only browser never asks.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineAsyncComponent, h } from 'vue'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

const m = vi.hoisted(() => {
  const text = { value: '' }
  const lines = () => text.value.split('\n')
  const off = (l, c) => lines().slice(0, l - 1).reduce((n, s) => n + s.length + 1, 0) + (c - 1)
  const model = {
    lang: 'plaintext', getLanguageId() { return this.lang },
    getLineCount: () => lines().length,
    getLineMaxColumn: (l) => lines()[l - 1].length + 1,
    getLineContent: (l) => lines()[l - 1],
    getValueInRange: (r) => text.value.slice(off(r.startLineNumber, r.startColumn), off(r.endLineNumber, r.endColumn)),
  }
  return {
    text, model, providers: [], disposed: 0,
    editor: { getModel: () => model, revealLineInCenter() {}, setPosition() {}, focus() {} },
  }
})

vi.mock('@/utils/lazyComponent', () => ({ lazyComponent: (loader) => defineAsyncComponent(loader) }))
vi.mock('@/utils/monacoWorkers', () => ({}))
vi.mock('monaco-editor', () => ({
  typescript: undefined,
  editor: { setTheme: vi.fn(), setModelLanguage: vi.fn((model, lang) => { model.lang = lang }) },
  languages: {
    getLanguages: () => [{ id: 'typescript', extensions: ['.ts'] }, { id: 'python', extensions: ['.py'] }],
    registerInlineCompletionsProvider: vi.fn((selector, provider) => {
      m.providers.push({ selector, provider })
      return { dispose: () => { m.disposed += 1 } }
    }),
  },
}))
vi.mock('monaco-editor-vue3', () => {
  const Editor = {
    props: ['value', 'language', 'theme', 'options', 'path'],
    emits: ['editorDidMount', 'change'],
    mounted() { this.$emit('editorDidMount', m.editor) },
    render() { return h('div', { class: 'monaco-stub' }, this.value) },
  }
  return { default: Editor, DiffEditor: { render: () => h('div') } }
})
vi.mock('../services/api', () => ({
  default: {
    getRepositoryFiles: vi.fn(),
    getFileContent: vi.fn(),
    getSourceControlStatus: vi.fn(),
    saveFileContent: vi.fn(),
    getInlineCompletionSettings: vi.fn(),
    saveInlineCompletionSettings: vi.fn(),
    requestInlineCompletion: vi.fn(),
  },
}))
// Ctrl+K and the inline suggestions call through services/inlineEditorApi: the same mocked functions.
vi.mock('../services/inlineEditorApi', async () => ({ default: (await import('../services/api')).default }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

import api from '../services/api'
import { projectCache } from '@/services/projectCache'
import { _resetInlineSuggestions } from '@/composables/useInlineSuggestions'

let w
async function browser(props = {}) {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  w = mount(CodeBrowser, {
    attachTo: document.body,
    props: { repositoryId: 4, systemId: 5, editable: true, ...props },
    global: { stubs: { Icon: true, RouterLink: RouterLinkStub, SourceControlPanel: { template: '<div />' } } },
  })
  await settle()
  return w
}
const settle = async () => { for (let i = 0; i < 4; i++) { await flushPromises(); await new Promise((r) => setTimeout(r, 0)) } }
const open = async (name) => {
  await w.findAll('.tree-node').find((n) => n.find('.node-name').exists() && n.find('.node-name').text() === name).trigger('click')
  await settle()
}
const token = () => ({ isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) })

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()
  localStorage.clear()
  _resetInlineSuggestions()
  m.providers.length = 0
  m.disposed = 0
  m.text.value = 'function add(a: number, b: number) {\n  \n}\n'
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
  api.getRepositoryFiles.mockResolvedValue({ data: { entries: [
    { name: 'app.ts', path: 'src/app.ts', type: 'file' },
    { name: '.env', path: '.env', type: 'file' },
  ] } })
  api.getFileContent.mockImplementation((_s, _r, p) => Promise.resolve({ data: { path: p, content: m.text.value } }))
  api.getInlineCompletionSettings.mockResolvedValue({ data: { enabled: true, daily_limit_usd: '1.00',
    spent_today_usd: '0.0300', model: { name: 'Codestral 2508' } } })
  api.requestInlineCompletion.mockResolvedValue({ data: { suggestion: 'return a + b', spent_today_usd: '0.0304',
    daily_limit_usd: '1.00' } })
})
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

describe('inline suggestions in the editor', () => {
  it('one provider asks the server for the file typed in, in this project, and shows ghost text', async () => {
    await browser()
    await open('app.ts')
    expect(m.providers).toHaveLength(1)
    expect(m.providers[0].selector).toBe('*')
    const out = await m.providers[0].provider.provideInlineCompletions(m.model, { lineNumber: 2, column: 3 }, {}, token())
    expect(api.requestInlineCompletion).toHaveBeenCalledTimes(1)
    const [repoId, body] = api.requestInlineCompletion.mock.calls[0]
    expect(repoId).toBe(4)
    expect(body).toMatchObject({ path: 'src/app.ts', language: 'typescript', suffix: '\n}\n' })
    expect(out.items[0].insertText).toBe('return a + b')
  })

  it('the status line shows today\'s spend, then a stop with its reason and Resume', async () => {
    await browser()
    await open('app.ts')
    const bar = () => w.find('[data-test="cb-inline-status"]')
    expect(bar().attributes('role')).toBe('status')
    expect(bar().text()).toContain('Inline suggestions on: $0.03 of $1.00 today')
    expect(bar().text()).toContain('Tab accepts, Esc dismisses')

    api.requestInlineCompletion.mockRejectedValueOnce({ response: { status: 429, data: { code: 'daily_limit',
      error: "Today's inline suggestions reached your daily limit of $1.00." } } })
    await m.providers[0].provider.provideInlineCompletions(m.model, { lineNumber: 2, column: 3 }, {}, token())
    await settle()
    expect(w.find('[data-test="cb-inline-stopped"]').text()).toContain('reached your daily limit of $1.00')
    // While stopped, nothing more is asked.
    await m.providers[0].provider.provideInlineCompletions(m.model, { lineNumber: 2, column: 3 }, {}, token())
    expect(api.requestInlineCompletion).toHaveBeenCalledTimes(1)

    await w.find('[data-test="cb-inline-resume"]').trigger('click')
    await settle()
    expect(w.find('[data-test="cb-inline-stopped"]').exists()).toBe(false)
  })

  it('a protected file says no suggestions are made there, and asks nothing', async () => {
    m.text.value = 'API_KEY=sk-live-'
    await browser()
    await open('.env')
    expect(w.find('[data-test="cb-inline-status"]').text()).toContain('No inline suggestions in a protected file')
    await m.providers[0].provider.provideInlineCompletions(m.model, { lineNumber: 1, column: 17 }, {}, token())
    expect(api.requestInlineCompletion).not.toHaveBeenCalled()
  })

  it('off: no status line and nothing asked', async () => {
    api.getInlineCompletionSettings.mockResolvedValue({ data: { enabled: false, daily_limit_usd: '1.00', spent_today_usd: '0' } })
    await browser()
    await open('app.ts')
    expect(w.find('[data-test="cb-inline-status"]').exists()).toBe(false)
    expect(await m.providers[0].provider.provideInlineCompletions(m.model, { lineNumber: 2, column: 3 }, {}, token())).toBeNull()
    expect(api.requestInlineCompletion).not.toHaveBeenCalled()
  })

  it('a read-only browser never registers a provider; closing the editor removes it', async () => {
    await browser({ editable: false })
    await open('app.ts')
    expect(m.providers).toHaveLength(0)
    w.unmount()
    w = null
    await browser()
    await open('app.ts')
    expect(m.providers).toHaveLength(1)
    w.unmount()
    w = null
    expect(m.disposed).toBe(1)
  })
})
