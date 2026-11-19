// @vitest-environment jsdom
// The Review tab (ADM-1314): the Coding Agent's changes since a message, one change at a time. Keep marks a change
// reviewed (remembered per message); Undo writes the file with that change put back, naming the version read, so a file
// that changed meanwhile is never overwritten. ADM-1329: comments on lines go to the chat as one message.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/services/api', () => ({
  default: { getLetsCodeMessageReview: vi.fn(), saveFileContent: vi.fn(), deleteRepositoryEntry: vi.fn() },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import ReviewChanges from './ReviewChanges.vue'

const SHA = 'a'.repeat(64)
const BEFORE = 'one\ntwo\nthree\nfour\nfive\n'
const AFTER = 'one\nTWO\nthree\nfour\nfive\nsix\n'
const FILES = () => [
  { path: 'src/app.py', status: 'modified', before: BEFORE, after: AFTER, sha: SHA },
  { path: 'src/new.py', status: 'added', before: null, after: 'print(1)\n', sha: 'b'.repeat(64) },
  { path: 'old.txt', status: 'deleted', before: 'gone\n', after: null, sha: null },
  { path: 'logo.png', status: 'modified', before: null, after: null, sha: 'c'.repeat(64), binary: true },
  { path: '.env', status: 'modified', before: null, after: null, sha: 'd'.repeat(64), redacted: true },
]
const CHANGED = { response: { status: 409, data: { code: 'CHANGED_ON_DISK', error: 'changed' } } }

// The editor's diff, reduced to its two sides.
const DiffStub = { props: ['value', 'original', 'language', 'options'], emits: ['editorDidMount'],
  template: '<div class="diff-stub"><pre class="orig">{{ original }}</pre><pre class="mod">{{ value }}</pre></div>' }

function mountReview(props = {}) {
  return mount(ReviewChanges, {
    props: { systemId: 5, repoId: 4, messageId: 77, conversationId: 31, diffEditor: DiffStub, ...props },
    global: { stubs: { Icon: true } },
  })
}
async function loaded(props) {
  const w = mountReview(props)
  await flushPromises()
  return w
}
const fileRow = (w, path) => w.findAll('[data-test="review-file"]').find((b) => b.attributes('title') === path)
async function pick(w, path) { await fileRow(w, path).trigger('click'); await flushPromises() }
const label = (w) => w.find('[data-test="review-hunk-label"]').text()

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  api.getLetsCodeMessageReview.mockImplementation(() => Promise.resolve({ data: { message_id: 77, checkpoint: 'c1', files: FILES() } }))
  api.saveFileContent.mockResolvedValue({ data: { success: true } })
  api.deleteRepositoryEntry.mockResolvedValue({ data: { success: true } })
  confirm.mockResolvedValue(true)
})

describe('ReviewChanges: the files and their sides', () => {
  it('loads the review of that message and lists each file with its status and open changes', async () => {
    const w = await loaded()
    expect(api.getLetsCodeMessageReview).toHaveBeenCalledWith(4, 77)
    expect(w.emitted('loaded')).toEqual([[5]])
    const rows = w.findAll('[data-test="review-file"]')
    expect(rows.map((r) => r.attributes('title'))).toEqual(['src/app.py', 'src/new.py', 'old.txt', 'logo.png', '.env'])
    expect(rows[0].text()).toContain('M')
    expect(rows[0].find('.rv-count').text()).toBe('2')
    expect(rows[1].text()).toContain('A')
    expect(rows[2].text()).toContain('D')
    // The first file is shown: the file before on the left, the file now on the right.
    expect(w.find('.orig').text()).toBe(BEFORE.trim())
    expect(w.find('.mod').text()).toBe(AFTER.trim())
    expect(label(w)).toBe('Change 1 of 2')
    w.unmount()
  })

  it('selecting a file shows its sides; Previous and Next go through its changes', async () => {
    const w = await loaded()
    await w.find('[data-test="review-next"]').trigger('click')
    expect(label(w)).toBe('Change 2 of 2')
    await w.find('[data-test="review-next"]').trigger('click')
    expect(label(w)).toBe('Change 1 of 2')
    await w.find('[data-test="review-prev"]').trigger('click')
    expect(label(w)).toBe('Change 2 of 2')
    await pick(w, 'old.txt')
    expect(w.find('.orig').text()).toBe('gone')
    expect(w.find('.mod').text()).toBe('')
    expect(label(w)).toBe('Change 1 of 1')
    w.unmount()
  })

  it('a binary file says there is no text to compare; a file with secrets offers nothing but Keep', async () => {
    const w = await loaded()
    await pick(w, 'logo.png')
    expect(w.find('[data-test="review-binary"]').text()).toContain('There is no text to compare.')
    expect(w.find('.diff-stub').exists()).toBe(false)
    expect(w.find('[data-test="review-hunkbar"]').exists()).toBe(false)
    expect(w.find('[data-test="review-undo-file"]').exists()).toBe(false)     // its bytes are not here to write back
    await pick(w, '.env')
    expect(w.find('[data-test="review-redacted"]').text()).toBe('This file holds secrets, so its values are not shown.')
    expect(w.find('.diff-stub').exists()).toBe(false)
    expect(w.find('[data-test="review-hunkbar"]').exists()).toBe(false)
    expect(w.find('[data-test="review-undo-file"]').exists()).toBe(false)
    expect(w.find('[data-test="review-comment"]').exists()).toBe(false)
    expect(w.find('[data-test="review-keep-file"]').exists()).toBe(true)
    await w.find('[data-test="review-keep-file"]').trigger('click')
    expect(fileRow(w, '.env').find('.rv-count').exists()).toBe(false)
    w.unmount()
  })

  it("a message whose turn changed nothing says so; another error can be tried again", async () => {
    api.getLetsCodeMessageReview.mockRejectedValueOnce({ response: { status: 409, data: { code: 'NO_CHECKPOINT' } } })
    let w = await loaded()
    expect(w.find('[data-test="review-error"]').text()).toContain('This message changed no files, so there is nothing to review.')
    expect(w.find('[data-test="review-error"] button').exists()).toBe(false)
    w.unmount()
    api.getLetsCodeMessageReview.mockRejectedValueOnce({ response: { status: 503, data: { code: 'SANDBOX_NOT_ANSWERING', error: 'The sandbox did not answer.' } } })
    w = await loaded()
    expect(w.find('[data-test="review-error"]').text()).toContain('The sandbox did not answer.')
    await w.find('[data-test="review-error"] button').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-test="review-file"]')).toHaveLength(5)
    w.unmount()
  })
})

describe('ReviewChanges: Undo', () => {
  it('Undo of one change writes the file now with only that change put back, naming the version read', async () => {
    const w = await loaded()
    await w.find('[data-test="review-next"]').trigger('click')               // change 2: the line "six" added
    await w.find('[data-test="review-undo"]').trigger('click')
    await flushPromises()
    expect(api.saveFileContent).toHaveBeenCalledTimes(1)
    expect(api.saveFileContent).toHaveBeenCalledWith(5, 4, 'src/app.py', 'one\nTWO\nthree\nfour\nfive\n', SHA)
    expect(notify.success).toHaveBeenCalledWith('Change undone')
    expect(w.emitted('written')).toEqual([['src/app.py']])
    expect(api.getLetsCodeMessageReview).toHaveBeenCalledTimes(2)              // the review read again
    expect(w.find('.rv-file.active').attributes('title')).toBe('src/app.py')    // on the same file
    w.unmount()
  })

  it('a file that changed meanwhile is never overwritten: the person is told, the review is read again', async () => {
    api.saveFileContent.mockRejectedValueOnce(CHANGED)
    const w = await loaded()
    await w.find('[data-test="review-undo"]').trigger('click')
    await flushPromises()
    expect(api.saveFileContent).toHaveBeenCalledTimes(1)
    expect(notify.warning).toHaveBeenCalledWith(expect.stringContaining('src/app.py changed in the project after this review was loaded, so nothing was written'))
    expect(notify.success).not.toHaveBeenCalled()
    expect(api.getLetsCodeMessageReview).toHaveBeenCalledTimes(2)
    expect(w.emitted('written')).toBeUndefined()
    w.unmount()
  })

  it('Undo file: a modified file gets its text before (with the sha), an added one is deleted after asking, a deleted one comes back', async () => {
    const w = await loaded()
    await w.find('[data-test="review-undo-file"]').trigger('click')
    await flushPromises()
    expect(api.saveFileContent).toHaveBeenLastCalledWith(5, 4, 'src/app.py', BEFORE, SHA)

    await pick(w, 'src/new.py')
    confirm.mockResolvedValueOnce(false)
    await w.find('[data-test="review-undo-file"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete new.py?', danger: true }))
    expect(api.deleteRepositoryEntry).not.toHaveBeenCalled()
    await w.find('[data-test="review-undo"]').trigger('click')                // its one change is the whole file
    await flushPromises()
    expect(api.deleteRepositoryEntry).toHaveBeenCalledWith(5, 4, 'src/new.py', 'b'.repeat(64))

    await pick(w, 'old.txt')
    await w.find('[data-test="review-undo-file"]').trigger('click')
    await flushPromises()
    expect(api.saveFileContent).toHaveBeenLastCalledWith(5, 4, 'old.txt', 'gone\n', undefined, { newFile: true })
    expect(api.saveFileContent).toHaveBeenCalledTimes(2)
    w.unmount()
  })

  it('a tab of the file with unsaved edits is asked about before an undo', async () => {
    const isUnsaved = vi.fn((p) => p === 'src/app.py')
    const w = await loaded({ isUnsaved })
    confirm.mockResolvedValueOnce(false)
    await w.find('[data-test="review-undo"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'app.py has unsaved edits', confirmText: 'Undo anyway' }))
    expect(api.saveFileContent).not.toHaveBeenCalled()
    confirm.mockResolvedValueOnce(true)
    await w.find('[data-test="review-undo"]').trigger('click')
    await flushPromises()
    expect(api.saveFileContent).toHaveBeenCalledTimes(1)
    w.unmount()
  })
})

describe('ReviewChanges: Keep', () => {
  it('Keep marks a change reviewed and moves on; Keep all ends the review; both outlast a remount, per message', async () => {
    let w = await loaded()
    await w.find('[data-test="review-keep"]').trigger('click')
    expect(label(w)).toBe('Change 2 of 2')
    expect(fileRow(w, 'src/app.py').find('.rv-count').text()).toBe('1')
    w.unmount()

    w = await loaded()
    expect(fileRow(w, 'src/app.py').find('.rv-count').text()).toBe('1')
    expect(label(w)).toBe('Change 2 of 2')                                       // opens on the change still open
    expect(w.find('[data-test="review-all-done"]').exists()).toBe(false)
    await w.find('[data-test="review-keep-all"]').trigger('click')
    expect(w.find('[data-test="review-all-done"]').text()).toBe('All changes reviewed')
    w.unmount()

    w = await loaded()
    expect(w.find('[data-test="review-all-done"]').exists()).toBe(true)
    w.unmount()
    w = await loaded({ messageId: 78 })                                          // another message starts open
    expect(w.find('[data-test="review-all-done"]').exists()).toBe(false)
    w.unmount()
  })

  it('a change still kept after another change of the file is undone', async () => {
    const w = await loaded()
    await w.find('[data-test="review-next"]').trigger('click')
    await w.find('[data-test="review-keep"]').trigger('click')                  // keep "six"
    api.getLetsCodeMessageReview.mockResolvedValueOnce({ data: { files: [
      { ...FILES()[0], after: 'one\ntwo\nthree\nfour\nfive\nsix\n' }] } })
    await w.find('[data-test="review-prev"]').trigger('click')
    await w.find('[data-test="review-undo"]').trigger('click')                  // undo TWO
    await flushPromises()
    expect(label(w)).toBe('Change 1 of 1 · Kept')
    expect(w.find('[data-test="review-all-done"]').exists()).toBe(true)
    w.unmount()
  })
})

describe('ReviewChanges: comments go to the agent as one message (ADM-1329)', () => {
  it('add, edit and remove a comment; an empty one is refused; Send composes one message and clears the tray', async () => {
    const send = vi.fn(() => Promise.resolve(true))
    const w = await loaded({ send })
    await w.find('[data-test="review-comment"]').trigger('click')
    expect(w.find('[data-test="review-draft"] label').text()).toBe('Comment on src/app.py:2')
    await w.find('[data-test="review-draft-add"]').trigger('submit')
    await w.find('[data-test="review-draft"]').trigger('submit')
    expect(w.find('[data-test="review-draft"] .rv-err').text()).toBe('Type a comment first.')
    expect(w.find('[data-test="review-tray"]').exists()).toBe(false)
    await w.find('[data-test="review-draft"] textarea').setValue('Use a constant here.')
    await w.find('[data-test="review-draft"]').trigger('submit')
    expect(w.findAll('[data-test="review-tray-item"]')).toHaveLength(1)
    expect(w.emitted('comments').at(-1)).toEqual([1])

    await w.find('[data-test="review-next"]').trigger('click')
    await w.find('[data-test="review-comment"]').trigger('click')
    await w.find('[data-test="review-draft"] textarea').setValue('Why add this line?')
    await w.find('[data-test="review-draft"]').trigger('submit')
    await w.find('[data-test="review-comment"]').trigger('click')
    await w.find('[data-test="review-draft"] textarea').setValue('To be removed')
    await w.find('[data-test="review-draft"]').trigger('submit')
    expect(w.findAll('[data-test="review-tray-item"]')).toHaveLength(3)

    // Edit: an empty text is refused, a new one is kept.
    await w.findAll('[data-test="review-tray-edit"]')[0].trigger('click')
    await w.find('[data-test="review-tray-input"]').setValue('  ')
    await w.find('[data-test="review-tray-save"]').trigger('submit')
    expect(w.find('.rv-edit .rv-err').text()).toBe('Type a comment, or remove it.')
    expect(w.find('[data-test="review-send"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="review-tray-input"]').setValue('Use the constant MAX_TRIES.')
    await w.find('.rv-edit').trigger('submit')
    // Remove.
    await w.findAll('[data-test="review-tray-remove"]')[2].trigger('click')
    expect(w.findAll('[data-test="review-tray-item"]')).toHaveLength(2)
    expect(w.find('[data-test="review-send"]').text()).toContain('Send to agent (2)')

    await w.find('[data-test="review-send"]').trigger('click')
    await flushPromises()
    expect(send).toHaveBeenCalledTimes(1)
    const { conversationId, text } = send.mock.calls[0][0]
    expect(conversationId).toBe(31)
    expect(text).toBe([
      'I reviewed your changes and left 2 comments. Please address them:',
      'src/app.py:2\nUse the constant MAX_TRIES.\n```\n1 | one\n2 | TWO\n3 | three\n4 | four\n```',
      'src/app.py:6\nWhy add this line?\n```\n4 | four\n5 | five\n6 | six\n```',
    ].join('\n\n'))
    expect(w.find('[data-test="review-tray"]').exists()).toBe(false)
    expect(w.emitted('comments').at(-1)).toEqual([0])
    expect(notify.success).toHaveBeenCalledWith('2 comments sent to the Coding Agent')
    w.unmount()
  })

  it('comments the chat did not take stay in the tray', async () => {
    const send = vi.fn(() => Promise.resolve(false))
    const w = await loaded({ send })
    await w.find('[data-test="review-comment"]').trigger('click')
    await w.find('[data-test="review-draft"] textarea').setValue('Check this')
    await w.find('[data-test="review-draft"]').trigger('submit')
    await w.find('[data-test="review-send"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-test="review-tray-item"]')).toHaveLength(1)
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('were not sent'))
    w.unmount()
  })

  it("comments on the cursor's line in the editor; the editor's changes are the ones counted; the layout toggles", async () => {
    const modified = { getPosition: () => ({ lineNumber: 4 }), revealLineInCenter: vi.fn(), setPosition: vi.fn(), addAction: vi.fn(() => ({ dispose() {} })) }
    const original = { getPosition: () => ({ lineNumber: 1 }), revealLineInCenter: vi.fn(), setPosition: vi.fn(), addAction: vi.fn(() => ({ dispose() {} })) }
    let onDiff = null
    const fake = {
      getModifiedEditor: () => modified, getOriginalEditor: () => original, updateOptions: vi.fn(),
      onDidUpdateDiff: (cb) => { onDiff = cb; return { dispose() {} } },
      getModel: () => ({ original: { getValue: () => BEFORE, getLanguageId: () => 'python' }, modified: { getValue: () => AFTER, getLanguageId: () => 'python' } }),
      // The editor sees one change only (as if it grouped them): that is what the toolbar counts.
      getLineChanges: () => [{ originalStartLineNumber: 2, originalEndLineNumber: 2, modifiedStartLineNumber: 2, modifiedEndLineNumber: 2 }],
    }
    const Mounting = { ...DiffStub, mounted() { this.$emit('editorDidMount', fake) } }
    const monaco = () => ({ KeyMod: { CtrlCmd: 2048, Alt: 512 }, KeyCode: { KeyM: 43 }, languages: { getLanguages: () => [] }, editor: { setModelLanguage: vi.fn() } })
    const w = await loaded({ diffEditor: Mounting, monaco })
    expect(modified.addAction).toHaveBeenCalledWith(expect.objectContaining({ label: 'Comment on this line', keybindings: [2048 | 512 | 43] }))
    onDiff()
    await flushPromises()
    expect(label(w)).toBe('Change 1 of 1')
    await w.find('[data-test="review-comment"]').trigger('click')
    expect(w.find('[data-test="review-draft"] label').text()).toBe('Comment on src/app.py:4')
    await w.find('[data-test="review-layout"]').trigger('click')
    expect(fake.updateOptions).toHaveBeenCalledWith({ renderSideBySide: false })
    w.unmount()
  })
})
