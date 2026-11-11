// @vitest-environment jsdom
// The Let's Code explorer's file actions (ADM-1205): New file / New folder / Rename typed in place, Delete after a
// question, drag to move, drop files to upload, Download, the context menu, and the Search tab that opens a result.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

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
    createRepositoryEntry: vi.fn(),
    renameRepositoryEntry: vi.fn(),
    deleteRepositoryEntry: vi.fn(),
    uploadRepositoryFiles: vi.fn(),
    downloadRepositoryEntry: vi.fn(),
    searchRepositoryContents: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))
vi.mock('@/utils/saveBlob', () => ({ saveBlob: vi.fn() }))

import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { saveBlob } from '@/utils/saveBlob'
import { projectCache } from '@/services/projectCache'

const ROOT = [
  { name: 'src', path: 'src', type: 'directory' },
  { name: 'README.md', path: 'README.md', type: 'file', size: 5 },
]
const SRC = [{ name: 'app.py', path: 'src/app.py', type: 'file', size: 3 }]

let w
async function browser(props = {}) {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  w = mount(CodeBrowser, {
    attachTo: document.body,
    props: { repositoryId: 4, systemId: 5, editable: true, projectName: 'shop', ...props },
    global: { stubs: { Icon: true, RouterLink: RouterLinkStub, SourceControlPanel: { template: '<div />' } } },
  })
  await flushPromises()
  return w
}
const row = (name) => w.findAll('.tree-node').find((n) => n.find('.node-name').exists() && n.find('.node-name').text() === name)
const menuItem = (label) => [...document.querySelectorAll('.xm-item')].find((b) => b.textContent.trim().startsWith(label))
const dt = (extra = {}) => ({ types: [], setData: vi.fn(), getData: vi.fn(() => ''), dropEffect: '', effectAllowed: '', ...extra })

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
  api.getRepositoryFiles.mockImplementation((_s, _r, { path } = {}) =>
    Promise.resolve({ data: { entries: path === 'src' ? SRC : ROOT } }))
  api.getFileContent.mockImplementation((_s, _r, p) => Promise.resolve({ data: { path: p, content: `content of ${p}` } }))
})
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

describe('New file and New folder are typed in place', () => {
  it('creates the file, reads the folder again and opens the file', async () => {
    api.createRepositoryEntry.mockResolvedValue({ data: { path: 'notes.md', type: 'file' } })
    await browser()
    await w.find('button[aria-label="New file"]').trigger('click')
    await flushPromises()
    const input = w.find('.pending-input')
    expect(input.exists()).toBe(true)
    expect(document.activeElement).toBe(input.element)
    await input.setValue('notes.md')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(api.createRepositoryEntry).toHaveBeenCalledWith(5, 4, 'notes.md', 'file')
    expect(api.getFileContent).toHaveBeenCalledWith(5, 4, 'notes.md')
    expect(w.find('.pending-input').exists()).toBe(false)
  })

  it('a name that is taken is said under the box, which stays open; Escape cancels', async () => {
    api.createRepositoryEntry.mockRejectedValue({ response: { status: 409, data: { error: 'README.md already exists.' } } })
    await browser()
    await w.find('button[aria-label="New folder"]').trigger('click')
    await flushPromises()
    await w.find('.pending-input').setValue('README.md')
    await w.find('.pending-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(api.createRepositoryEntry).toHaveBeenCalledWith(5, 4, 'README.md', 'directory')
    expect(w.find('.pending-error').text()).toContain('README.md is already here')
    await w.find('.pending-input').trigger('keydown', { key: 'Escape' })
    expect(w.find('.pending-input').exists()).toBe(false)
  })

  it('refuses a name with .. or .git before asking the server', async () => {
    await browser()
    await w.find('button[aria-label="New file"]').trigger('click')
    await flushPromises()
    await w.find('.pending-input').setValue('../x')
    await w.find('.pending-input').trigger('keydown', { key: 'Enter' })
    expect(w.find('.pending-error').text()).toContain('cannot be')
    expect(api.createRepositoryEntry).not.toHaveBeenCalled()
  })
})

describe('the context menu', () => {
  it('right-click on a file offers its actions; Rename renames in place and the open tab follows', async () => {
    api.renameRepositoryEntry.mockResolvedValue({ data: { path: 'GUIDE.md', old_path: 'README.md' } })
    await browser()
    await row('README.md').trigger('click')                         // open it in a tab first
    await flushPromises()
    await row('README.md').trigger('contextmenu', { clientX: 40, clientY: 60 })
    await flushPromises()
    const labels = [...document.querySelectorAll('.xm-item')].map((b) => b.textContent.trim())
    expect(labels.map((l) => l.replace(/(F2|Del)$/, ''))).toEqual(['Open', 'Download', 'Copy path', 'Rename', 'Delete'])
    menuItem('Rename').click()
    await flushPromises()
    const input = w.find('.pending-input')
    expect(input.element.value).toBe('README.md')
    expect([input.element.selectionStart, input.element.selectionEnd]).toEqual([0, 6])   // the name, not ".md"
    await input.setValue('GUIDE.md')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(api.renameRepositoryEntry).toHaveBeenCalledWith(5, 4, 'README.md', 'GUIDE.md')
    expect(w.find('.tab-name').text()).toBe('GUIDE.md')
  })

  it('Delete on a focused row asks first, deletes, and closes its tab', async () => {
    api.deleteRepositoryEntry.mockResolvedValue({ data: { deleted: 'README.md' } })
    await browser()
    await row('README.md').trigger('click')
    await flushPromises()
    expect(w.findAll('.tab')).toHaveLength(1)
    await row('README.md').trigger('keydown', { key: 'Delete' })
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete README.md?', danger: true }))
    expect(api.deleteRepositoryEntry).toHaveBeenCalledWith(5, 4, 'README.md')
    expect(w.findAll('.tab')).toHaveLength(0)
  })

  it('nothing is deleted when the person keeps it', async () => {
    confirm.mockResolvedValueOnce(false)
    await browser()
    await row('README.md').trigger('keydown', { key: 'Delete' })
    await flushPromises()
    expect(api.deleteRepositoryEntry).not.toHaveBeenCalled()
  })

  it('Download saves a file as itself and a folder as .tar.gz', async () => {
    const blob = new Blob(['x'])
    api.downloadRepositoryEntry.mockResolvedValue({ data: blob })
    await browser()
    await row('src').trigger('contextmenu', { clientX: 10, clientY: 10 })
    await flushPromises()
    menuItem('Download').click()
    await flushPromises()
    expect(api.downloadRepositoryEntry).toHaveBeenCalledWith(5, 4, 'src')
    expect(saveBlob).toHaveBeenCalledWith(blob, 'src.tar.gz')
  })
})

describe('drag and drop', () => {
  it('a row dropped on a folder moves into it', async () => {
    api.renameRepositoryEntry.mockResolvedValue({ data: { path: 'src/README.md', old_path: 'README.md' } })
    await browser()
    const transfer = dt()
    await row('README.md').trigger('dragstart', { dataTransfer: transfer })
    await row('src').trigger('dragover', { dataTransfer: transfer })
    expect(row('src').classes()).toContain('drop-target')
    await row('src').trigger('drop', { dataTransfer: transfer })
    await flushPromises()
    expect(api.renameRepositoryEntry).toHaveBeenCalledWith(5, 4, 'README.md', 'src/README.md')
  })

  it('files from the computer upload into the folder; one already there is replaced only after asking', async () => {
    const file = new File(['hi'], 'app.py')
    api.uploadRepositoryFiles
      .mockRejectedValueOnce({ response: { status: 409, data: { error: 'Already in the project: src/app.py', exists: ['src/app.py'] } } })
      .mockResolvedValueOnce({ data: { uploaded: ['src/app.py'] } })
    await browser()
    const transfer = dt({ types: ['Files'], items: [], files: [file] })
    await row('src').trigger('dragover', { dataTransfer: transfer })
    await row('src').trigger('drop', { dataTransfer: transfer })
    await flushPromises()
    expect(api.uploadRepositoryFiles).toHaveBeenNthCalledWith(1, 5, 4, 'src', [{ file, path: 'app.py' }], { overwrite: false })
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Replace app.py?' }))
    expect(api.uploadRepositoryFiles).toHaveBeenNthCalledWith(2, 5, 4, 'src', [{ file, path: 'app.py' }], { overwrite: true })
    expect(notify.success).toHaveBeenCalledWith('Uploaded 1 file to src')
  })
})

describe('the Search tab', () => {
  it('searches inside the files and opens a result in its file', async () => {
    api.searchRepositoryContents.mockResolvedValue({ data: { matches: [
      { path: 'src/app.py', line: 2, column: 5, text: 'x = price * 2' },
      { path: 'src/app.py', line: 9, column: 1, text: 'price = 1' },
      { path: '.env', line: 1, column: 1, redacted: true },
    ] } })
    await browser()
    await w.findAll('.sidebar-tab').find((t) => t.text().includes('Search')).trigger('click')
    const input = w.find('.cs-input')
    await input.setValue('price')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(api.searchRepositoryContents).toHaveBeenCalledWith(5, 4, expect.objectContaining({ q: 'price', matchCase: false }))
    expect(w.find('.cs-status').text()).toBe('3 results in 2 files')
    expect(w.findAll('.cs-hit').map((m) => m.text())).toEqual(['price', 'price'])
    expect(w.find('.cs-hidden').text()).toContain('holds secrets')
    await w.findAll('.cs-line')[0].trigger('click')
    await flushPromises()
    expect(api.getFileContent).toHaveBeenCalledWith(5, 4, 'src/app.py')
  })

  it('a bad pattern is said, not shown as no results', async () => {
    api.searchRepositoryContents.mockRejectedValue({ response: { status: 400, data: { error: 'Unmatched ( or \\(' } } })
    await browser()
    await w.findAll('.sidebar-tab').find((t) => t.text().includes('Search')).trigger('click')
    await w.find('.cs-input').setValue('price(')
    await w.find('.cs-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(w.find('.cs-error').text()).toBe('Unmatched ( or \\(')
  })
})

describe('what is gone or read-only', () => {
  it('no Artifacts tab, and a name search lists every match with no "first N" note', async () => {
    api.getRepositoryFiles.mockImplementation((_s, _r, { search } = {}) => Promise.resolve({ data: { entries: search
      ? Array.from({ length: 600 }, (_, i) => ({ name: `f${i}.txt`, path: `f${i}.txt`, type: 'file' })) : ROOT } }))
    await browser()
    expect(w.findAll('.sidebar-tab').map((t) => t.text())).not.toContain('Artifacts')
    await w.find('input[aria-label="Find a file by name"]').setValue('f')
    await new Promise((r) => setTimeout(r, 300))
    await flushPromises()
    expect(w.findAll('.search-hit')).toHaveLength(600)
    expect(w.text()).not.toContain('Showing the first')
  })

  it('a read-only browser offers no file actions', async () => {
    await browser({ editable: false })
    expect(w.find('button[aria-label="New file"]').exists()).toBe(false)
    expect(w.find('.node-more').exists()).toBe(false)
    await row('README.md').trigger('contextmenu', { clientX: 1, clientY: 1 })
    expect(document.querySelector('.xm')).toBeNull()
  })
})
