// @vitest-environment jsdom
// Chats' branches in Source control (backend phase 7b): each chat that works in its own copy, its changes (read with
// `chat=`), Merge (a message first when it has changes not committed) and Discard (always confirmed, naming what is
// lost), and every refusal by its `code`.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/services/api', () => ({
  default: {
    getChatWorktrees: vi.fn(), mergeChatWorktree: vi.fn(), discardChatWorktree: vi.fn(), getSourceControlStatus: vi.fn(),
    post: vi.fn(), get: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import ChatBranchesSection from './ChatBranchesSection.vue'

const wt = (over = {}) => ({
  chat_id: 77, chat_title: 'Add the cart', chat_exists: true, branch: 'aadml/chat-77', base: 'main', sha: 'abc',
  ahead: 2, behind: 0, present: true, changes: 0, active: true, working: false, has_work: true, ...over,
})
const list = (items) => ({ data: { worktrees: items, count: items.length, into: 'main' } })
const refusal = (data) => ({ response: { status: 409, data } })

async function mountSection() {
  const w = mount(ChatBranchesSection, { props: { systemId: 5, repoId: 4 }, global: { stubs: { Icon: true } } })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getChatWorktrees.mockResolvedValue(list([wt()]))
})

describe('Chats’ branches', () => {
  it('is hidden while no chat has a copy of its own', async () => {
    api.getChatWorktrees.mockResolvedValue(list([]))
    const w = await mountSection()
    expect(w.find('[data-test="chat-branches"]').exists()).toBe(false)
  })

  it('lists each chat with its branch and what it holds, and hands the list to the chat tabs', async () => {
    api.getChatWorktrees.mockResolvedValue(list([wt(), wt({ chat_id: 78, chat_title: '', chat_exists: false, branch: 'aadml/chat-78',
      ahead: 0, behind: 3, changes: 1, working: true })]))
    const w = await mountSection()
    expect(api.getChatWorktrees).toHaveBeenCalledWith(5, 4)
    const rows = w.findAll('.cbs-item')
    expect(rows[0].text()).toContain('Add the cart')
    expect(rows[0].text()).toContain('aadml/chat-77')
    expect(rows[0].text()).toContain('2 commits to merge')
    expect(rows[1].text()).toContain('A deleted chat')
    expect(rows[1].text()).toContain('3 behind main · 1 change not committed')
    expect(rows[1].find('[data-test="cbs-working"]').exists()).toBe(true)
    expect(w.find('[data-test="cbs-merge-78"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="cbs-discard-78"]').attributes('disabled')).toBeDefined()
    expect(w.emitted('branches')[0][0]).toHaveLength(2)
  })

  it('opens a chat’s changes from its own copy (chat=), and a file as that chat’s diff', async () => {
    api.getSourceControlStatus.mockResolvedValue({ data: { chat_id: 77, changes: [{ path: 'cart.ts', status: 'modified' }], untracked: [] } })
    const w = await mountSection()
    await w.find('.cbs-open').trigger('click')
    await flushPromises()
    expect(api.getSourceControlStatus).toHaveBeenCalledWith(5, 4, { chat: 77 })
    await w.find('.cbs-file').trigger('click')
    expect(w.emitted('open-diff')[0][0]).toEqual({ path: 'cart.ts', status: 'modified', chat: '77', chatLabel: 'aadml/chat-77' })
  })

  it('merges a chat’s branch and reads the shared copy again', async () => {
    api.mergeChatWorktree.mockResolvedValue({ data: { merged: true } })
    const w = await mountSection()
    await w.find('[data-test="cbs-merge-77"]').trigger('click')
    await flushPromises()
    expect(api.mergeChatWorktree).toHaveBeenCalledWith(5, 4, 77, undefined)
    expect(notify.success).toHaveBeenCalledWith('Merged aadml/chat-77 into main')
    expect(w.emitted('changed')).toBeTruthy()
  })

  it('a chat with changes not committed asks for a commit message first, and sends it', async () => {
    api.getChatWorktrees.mockResolvedValue(list([wt({ changes: 3 })]))
    api.mergeChatWorktree.mockResolvedValue({ data: { merged: true } })
    const w = await mountSection()
    await w.find('[data-test="cbs-merge-77"]').trigger('click')
    expect(api.mergeChatWorktree).not.toHaveBeenCalled()
    await w.find('form').trigger('submit')                     // empty: refused in words, nothing sent
    expect(api.mergeChatWorktree).not.toHaveBeenCalled()
    expect(w.find('.cbs-form [role="alert"]').text()).toContain('Write a commit message')
    await w.find('[data-test="cbs-message"]').setValue('Add the cart')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(api.mergeChatWorktree).toHaveBeenCalledWith(5, 4, 77, 'Add the cart')
  })

  it('CHAT_HAS_CHANGES from the server opens the message box', async () => {
    api.mergeChatWorktree.mockRejectedValue(refusal({ code: 'CHAT_HAS_CHANGES', error: 'x' }))
    const w = await mountSection()
    await w.find('[data-test="cbs-merge-77"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="cbs-message"]').exists()).toBe(true)
  })

  it.each([
    [{ code: 'CHAT_WORKING' }, 'The chat is working. Try when it stops.'],
    [{ code: 'NOTHING_TO_MERGE' }, 'Nothing to merge: main already has everything on this branch.'],
    [{ code: 'BUSY', held_by: { chat_id: 78, chat_title: 'Fix the footer', person: 'Sam', step: 'merged', since: '' } },
      'Another chat\'s branch is being merged ("Fix the footer", Sam). Try when it ends.'],
  ])('a merge refused (%o) says why in words', async (data, words) => {
    api.mergeChatWorktree.mockRejectedValue(refusal(data))
    const w = await mountSection()
    await w.find('[data-test="cbs-merge-77"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="cbs-note-77"]').text()).toBe(words)
  })

  it('MERGE_CONFLICT names the files and points to the shared copy’s Mark resolved / Commit / Abort merge', async () => {
    api.mergeChatWorktree.mockRejectedValue(refusal({ code: 'MERGE_CONFLICT', conflicts: ['cart.ts', { path: 'app.ts' }] }))
    const w = await mountSection()
    await w.find('[data-test="cbs-merge-77"]').trigger('click')
    await flushPromises()
    const note = w.find('[data-test="cbs-note-77"]').text()
    expect(note).toContain('2 files changed on both sides: cart.ts, app.ts')
    expect(note).toContain('Mark resolved and Commit, or Abort merge')
    expect(w.emitted('merge-conflict')[0][0]).toEqual({ branch: 'aadml/chat-77', conflicts: ['cart.ts', 'app.ts'] })
    expect(w.emitted('changed')).toBeTruthy()
  })

  it('Discard always asks first, naming what is lost, and does nothing when cancelled', async () => {
    api.getChatWorktrees.mockResolvedValue(list([wt({ changes: 1, ahead: 2 })]))
    confirm.mockResolvedValueOnce(false)
    const w = await mountSection()
    await w.find('[data-test="cbs-discard-77"]').trigger('click')
    await flushPromises()
    const asked = confirm.mock.calls[0][0]
    expect(asked.danger).toBe(true)
    expect(asked.message).toContain('1 change not committed and 2 commits not merged into main')
    expect(api.discardChatWorktree).not.toHaveBeenCalled()
  })

  it('Discard confirmed deletes the chat’s copy; its refusals are said in words', async () => {
    api.discardChatWorktree.mockResolvedValueOnce({ data: {} })
    const w = await mountSection()
    await w.find('[data-test="cbs-discard-77"]').trigger('click')
    await flushPromises()
    expect(api.discardChatWorktree).toHaveBeenCalledWith(5, 4, 77)
    expect(notify.success).toHaveBeenCalledWith('Discarded aadml/chat-77')

    api.discardChatWorktree.mockRejectedValueOnce(refusal({ code: 'CHAT_WORKING' }))
    await w.find('[data-test="cbs-discard-77"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="cbs-note-77"]').text()).toBe('The chat is working. Try when it stops.')

    api.discardChatWorktree.mockRejectedValueOnce(refusal({ code: 'NO_WORKTREE' }))
    await w.find('[data-test="cbs-discard-77"]').trigger('click')
    await flushPromises()
    expect(notify.success).toHaveBeenCalledWith('This chat has no copy of its own any more.')
  })
})

describe('Chats’ branches: a pull request from a chat’s branch (ADM-1327)', () => {
  it('opens it on that chat’s copy (pushed first), and links it and the preview once there', async () => {
    api.post.mockResolvedValueOnce({ status: 200, data: { pushed: 'lets-code/77' } })
      .mockResolvedValueOnce({ status: 200, data: { url: 'https://github.com/a/b/pull/8', existing: false } })
    api.getChatWorktrees.mockResolvedValue(list([wt({ branch: 'lets-code/77', own_branch: true, on_remote: false, unpushed: 2 })]))
    const w = await mountSection()
    await w.find('[data-test="cbs-open-pr-77"]').trigger('click')
    await flushPromises()
    expect(api.post.mock.calls.map((c) => [c[0], c[2]])).toEqual([
      ['/systems/5/repositories/4/source-control/push/', { params: { chat: 77 } }],
      ['/systems/5/repositories/4/source-control/pull-request/', { params: { chat: 77 } }]])
    expect(notify.success).toHaveBeenCalledWith('Opened a pull request from lets-code/77')

    api.getChatWorktrees.mockResolvedValue(list([wt({ branch: 'lets-code/77', pull_request_url: 'https://github.com/a/b/pull/8',
      preview: { state: 'READY', url: 'https://w-git.vercel.app' } })]))
    await w.vm.refresh()
    await flushPromises()
    expect(w.find('[data-test="cbs-open-pr-77"]').exists()).toBe(false)
    expect(w.find('[data-test="cbs-pr-link-77"]').attributes('href')).toBe('https://github.com/a/b/pull/8')
    expect(w.find('[data-test="cbs-preview-link-77"]').attributes('href')).toBe('https://w-git.vercel.app')
  })
})
