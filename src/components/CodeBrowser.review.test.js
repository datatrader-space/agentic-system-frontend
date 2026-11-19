// @vitest-environment jsdom
// "Review changes" opens the Coding Agent's changes since a message in a Review tab of the editor (ADM-1314): one per
// message, a second ask brings it in front. An undo writes the file; its open tab shows the new text, and a tab with
// unsaved edits is asked about first. The tab's comments go up to the page as one message (ADM-1329).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/utils/lazyComponent', () => ({
  lazyComponent: () => ({ props: ['value', 'original', 'language'], template: '<div class="monaco-stub">{{ value }}</div>' }),
}))
vi.mock('../services/api', () => ({
  default: {
    getRepositoryFiles: vi.fn(),
    getFileContent: vi.fn(),
    getSourceControlStatus: vi.fn(),
    getLetsCodeMessageReview: vi.fn(),
    saveFileContent: vi.fn(),
    deleteRepositoryEntry: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import api from '../services/api'
import { confirm } from '@/composables/useConfirm'
import { projectCache } from '@/services/projectCache'

const SHA = '1'.repeat(64)
const REVIEW = { message_id: 77, files: [
  { path: 'README.md', status: 'modified', before: 'a\nb\n', after: 'a\nB\n', sha: SHA },
  { path: 'new.txt', status: 'added', before: null, after: 'x\n', sha: '2'.repeat(64) },
] }

async function browser() {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  const w = mount(CodeBrowser, {
    props: { repositoryId: 4, systemId: 5, editable: true },
    global: { stubs: { Icon: true, RouterLink: true, SourceControlPanel: { template: '<div />', emits: ['open-diff', 'count'] } } },
  })
  await flushPromises()
  return w
}
const tabNames = (w) => w.findAll('.tab .tab-name').map((t) => t.text())

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  localStorage.clear()
  projectCache.clearAll()
  api.getRepositoryFiles.mockResolvedValue({ data: { entries: [{ name: 'README.md', path: 'README.md', type: 'file' }] } })
  api.getFileContent.mockResolvedValue({ data: { content: 'a\nB\n', sha: SHA } })
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
  api.getLetsCodeMessageReview.mockResolvedValue({ data: REVIEW })
  api.saveFileContent.mockResolvedValue({ data: { success: true, sha: '3'.repeat(64) } })
  confirm.mockResolvedValue(true)
})

describe('CodeBrowser: the Review tab (ADM-1314)', () => {
  it('opens one Review tab per message, named by its files; asked again, that tab comes in front', async () => {
    const w = await browser()
    const st = w.vm.$.setupState
    w.vm.openReview({ messageId: 77, conversationId: 31, count: 1 })
    await flushPromises()
    expect(api.getLetsCodeMessageReview).toHaveBeenCalledWith(4, 77)
    expect(tabNames(w)).toEqual(['Review: 2 files'])                     // the count the review answers
    expect(w.find('[data-test="review"]').exists()).toBe(true)
    const first = st.activeTabId

    await st.openFile('README.md')
    await flushPromises()
    expect(w.find('[data-test="review"]').isVisible()).toBe(false)          // kept, hidden while the file is in front
    w.vm.openReview({ messageId: 77, conversationId: 31, count: 1 })
    await flushPromises()
    expect(st.activeTabId).toBe(first)
    expect(st.openTabs.filter((t) => t.type === 'review')).toHaveLength(1)
    expect(api.getLetsCodeMessageReview).toHaveBeenCalledTimes(1)          // the same tab, not loaded again

    w.vm.openReview({ messageId: 78, conversationId: 31, count: 3 })
    await flushPromises()
    expect(st.openTabs.filter((t) => t.type === 'review').map((t) => t.messageId)).toEqual([77, 78])
    w.unmount()
  })

  it('an undo of a file whose tab has unsaved edits asks first; a written file shows its new text in its tab', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = await browser()
    const st = w.vm.$.setupState
    await st.openFile('README.md')
    await flushPromises()
    st.onEditorChange('mine')
    w.vm.openReview({ messageId: 77, conversationId: 31, count: 2 })
    await flushPromises()
    confirm.mockResolvedValueOnce(false)
    await w.find('[data-test="review-undo"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'README.md has unsaved edits' }))
    expect(api.saveFileContent).not.toHaveBeenCalled()

    // Without unsaved edits: no question, the file is written, and its tab reads it again.
    const reviewId = st.activeTabId
    st.showFile(st.openTabs.find((t) => t.type === 'file').id)
    st.onEditorChange('a\nB\n')
    st.showFile(reviewId)
    await flushPromises()
    api.getFileContent.mockResolvedValue({ data: { content: 'a\nb\n', sha: '3'.repeat(64) } })
    await w.find('[data-test="review-undo"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(api.saveFileContent).toHaveBeenCalledWith(5, 4, 'README.md', 'a\nb\n', SHA)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    const tab = st.openTabs.find((t) => t.type === 'file' && t.path === 'README.md')
    expect(tab.content).toBe('a\nb\n')
    expect(tab.diskSha).toBe('3'.repeat(64))
    vi.useRealTimers()
    w.unmount()
  })

  it("sends the tab's comments up as one message for that chat, and asks before closing a tab with comments", async () => {
    const w = await browser()
    const st = w.vm.$.setupState
    w.vm.openReview({ messageId: 77, conversationId: 31, count: 2 })
    await flushPromises()
    await w.find('[data-test="review-comment"]').trigger('click')
    await w.find('[data-test="review-draft"] textarea').setValue('Why upper case?')
    await w.find('[data-test="review-draft"]').trigger('submit')
    await flushPromises()

    confirm.mockResolvedValueOnce(false)
    await st.closeTab(st.activeTabId)
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard your comments?' }))
    expect(st.openTabs).toHaveLength(1)

    await w.find('[data-test="review-send"]').trigger('click')
    await flushPromises()
    const sent = w.emitted('send-review')
    expect(sent).toHaveLength(1)
    expect(sent[0][0]).toMatchObject({ conversationId: 31, text: expect.stringContaining('README.md:2\nWhy upper case?') })
    sent[0][0].done(true)
    await flushPromises()
    expect(w.find('[data-test="review-tray"]').exists()).toBe(false)
    await st.closeTab(st.activeTabId)
    expect(confirm).toHaveBeenCalledTimes(1)                                 // no comments left: closed at once
    expect(st.openTabs).toHaveLength(0)
    w.unmount()
  })
})
