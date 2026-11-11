// @vitest-environment jsdom
// Every file is coloured in its own language, and Monaco follows the editor's own light or dark (ADM-1205).
//
// The editor component keeps ONE model for every tab and never re-reads its `language` prop (monaco-editor-vue3
// 1.0.5), so a .ts opened after a .json kept JSON colouring. Here the real lazy load runs against a stub Monaco whose
// model records the language it is set to.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineAsyncComponent, h } from 'vue'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

const m = vi.hoisted(() => {
  const model = { lang: 'plaintext', getLanguageId() { return this.lang } }
  const original = { lang: 'plaintext', getLanguageId() { return this.lang } }
  const modified = { lang: 'plaintext', getLanguageId() { return this.lang } }
  return {
    model, original, modified,
    editor: { getModel: () => model, revealLineInCenter() {}, setPosition() {}, focus() {} },
    diff: { getModel: () => ({ original, modified }) },
    themes: [],
  }
})

vi.mock('@/utils/lazyComponent', () => ({ lazyComponent: (loader) => defineAsyncComponent(loader) }))
vi.mock('@/utils/monacoWorkers', () => ({}))
vi.mock('monaco-editor', () => ({
  editor: { setTheme: vi.fn(), setModelLanguage: vi.fn((model, lang) => { model.lang = lang }) },
  languages: { getLanguages: () => [
    { id: 'typescript', extensions: ['.ts', '.tsx'] },
    { id: 'json', extensions: ['.json'] },
    { id: 'python', extensions: ['.py'] },
  ] },
}))
vi.mock('monaco-editor-vue3', () => {
  const Editor = {
    props: ['value', 'language', 'theme', 'options', 'path'],
    emits: ['editorDidMount', 'change'],
    mounted() { m.themes.push(this.theme); this.$emit('editorDidMount', m.editor) },
    watch: { theme(t) { m.themes.push(t) } },
    render() { return h('div', { class: 'monaco-stub', 'data-theme-prop': this.theme }, this.value) },
  }
  const DiffEditor = {
    props: ['value', 'original', 'language', 'theme', 'options'],
    emits: ['editorDidMount'],
    mounted() { this.$emit('editorDidMount', m.diff) },
    render() { return h('div', { class: 'monaco-diff-stub' }) },
  }
  return { default: Editor, DiffEditor }
})
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
import { useIdeTheme, _resetIdeTheme } from '@/composables/useIdeTheme'

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
const settle = async () => { for (let i = 0; i < 4; i++) { await flushPromises(); await new Promise((r) => setTimeout(r, 0)) } }
const open = async (name) => {
  await w.findAll('.tree-node').find((n) => n.find('.node-name').exists() && n.find('.node-name').text() === name).trigger('click')
  await settle()
}

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()
  localStorage.clear()
  _resetIdeTheme()
  m.model.lang = 'plaintext'
  m.original.lang = m.modified.lang = 'plaintext'
  m.themes.length = 0
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
  api.getRepositoryFiles.mockResolvedValue({ data: { entries: [
    { name: 'package.json', path: 'package.json', type: 'file' },
    { name: 'app.ts', path: 'app.ts', type: 'file' },
    { name: 'main.py', path: 'main.py', type: 'file' },
  ] } })
  api.getFileContent.mockImplementation((_s, _r, p) => Promise.resolve({ data: { path: p, content: `// ${p}` } }))
})
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

describe('syntax colouring follows the file shown', () => {
  it('a .ts opened after a .json is coloured as TypeScript, and switching tabs switches the language', async () => {
    await browser()
    await open('package.json')
    expect(m.model.lang).toBe('json')
    await open('app.ts')
    expect(m.model.lang).toBe('typescript')
    await open('main.py')
    expect(m.model.lang).toBe('python')
    await w.findAll('.tab').find((t) => t.text().includes('package.json')).trigger('click')
    await settle()
    expect(m.model.lang).toBe('json')
  })

  it('both sides of a change are coloured in the file\'s language', async () => {
    api.getSourceControlDiff.mockResolvedValue({ data: { path: 'app.ts', original: 'let a = 1', modified: 'let a = 2' } })
    await browser()
    // Open the change as Source control's open-diff does (the panel itself is a stub here).
    await w.vm.$.setupState.openDiff({ path: 'app.ts' })
    await settle()
    expect(w.find('.monaco-diff-stub').exists()).toBe(true)
    expect([m.original.lang, m.modified.lang]).toEqual(['typescript', 'typescript'])
  })
})

describe('Monaco follows the editor\'s own theme', () => {
  it('the toggle turns the code dark without changing the app', async () => {
    await browser()
    await open('app.ts')
    expect(w.find('.monaco-stub').attributes('data-theme-prop')).toBe('vs')
    useIdeTheme().toggle()
    await settle()
    expect(w.find('.monaco-stub').attributes('data-theme-prop')).toBe('vs-dark')
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')
  })
})
