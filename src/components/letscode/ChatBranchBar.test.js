// @vitest-environment jsdom
// The branch bar of a chat on its own branch (ADM-1327): its branch and state, "Open pull request" (pushed first when
// GitHub lacks its commits) on THAT chat's copy (`chat=`), its Vercel preview only when Vercel is connected, the
// links to both, and the refusals said in words.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/services/api', () => ({
  default: { getChatWorktrees: vi.fn(), getVercelConnection: vi.fn(), post: vi.fn(), get: vi.fn() },
}))
// A job's answer is the press's own answer here (the job machinery has its own tests).
vi.mock('@/services/projectJobs', () => ({ runProjectJob: vi.fn((start) => start()) }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))

import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import ChatBranchBar from './ChatBranchBar.vue'

const row = (over = {}) => ({
  chat_id: 42, chat_title: 'Add the cart', chat_exists: true, branch: 'lets-code/42', base: 'main', ahead: 2, behind: 0,
  present: true, changes: 0, working: false, own_branch: true, on_remote: false, unpushed: 2, pull_request_url: '',
  preview: null, ...over,
})
const list = (items) => ({ data: { worktrees: items, count: items.length, into: 'main' } })

async function mountBar(props = {}) {
  const w = mount(ChatBranchBar, { props: { systemId: 5, repoId: 4, chatId: '42', ...props }, global: { stubs: { Icon: true } } })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getChatWorktrees.mockResolvedValue(list([row(), row({ chat_id: 43, branch: 'lets-code/43' })]))
  api.getVercelConnection.mockResolvedValue({ data: { connected: false } })
})

describe('ChatBranchBar', () => {
  it("shows this chat's branch only, with its state, and nothing for a chat without one", async () => {
    const w = await mountBar()
    expect(w.find('.cbb-branch').text()).toBe('lets-code/42')
    expect(w.find('[data-test="cbb-facts"]').text()).toBe('2 commits · Not on GitHub yet')
    expect(w.emitted('branch')[0][0]).toEqual({ chatId: '42', branch: 'lets-code/42' })
    const none = await mountBar({ chatId: '99' })
    expect(none.find('[data-test="chat-branch-bar"]').exists()).toBe(false)
  })

  it('Open pull request pushes the branch first, then opens the pull request, both on this chat’s copy', async () => {
    api.post.mockResolvedValueOnce({ status: 200, data: { pushed: 'lets-code/42' } })
      .mockResolvedValueOnce({ status: 200, data: { url: 'https://github.com/a/b/pull/3', existing: false } })
    const w = await mountBar()
    await w.find('[data-test="cbb-open-pr"]').trigger('click')
    await flushPromises()
    expect(api.post.mock.calls[0]).toEqual(['/systems/5/repositories/4/source-control/push/', {}, { params: { chat: 42 } }])
    expect(api.post.mock.calls[1]).toEqual(['/systems/5/repositories/4/source-control/pull-request/',
      { title: 'Add the cart', body: 'Opened from the Let\'s Code chat "Add the cart".' }, { params: { chat: 42 } }])
    expect(notify.success).toHaveBeenCalledWith('Opened a pull request from lets-code/42')
    expect(api.getChatWorktrees).toHaveBeenCalledTimes(2)              // read again after it opened
  })

  it('a branch GitHub already has is not pushed again', async () => {
    api.getChatWorktrees.mockResolvedValue(list([row({ on_remote: true, unpushed: 0 })]))
    api.post.mockResolvedValueOnce({ status: 200, data: { url: 'https://github.com/a/b/pull/3' } })
    const w = await mountBar()
    await w.find('[data-test="cbb-open-pr"]').trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post.mock.calls[0][0]).toBe('/systems/5/repositories/4/source-control/pull-request/')
  })

  it('cannot open a pull request with nothing committed, and says why', async () => {
    api.getChatWorktrees.mockResolvedValue(list([row({ ahead: 0, changes: 3, unpushed: 0 })]))
    const w = await mountBar()
    const btn = w.find('[data-test="cbb-open-pr"]')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toBe('Nothing is committed on this branch yet. Ask the agent to commit its changes.')
  })

  it('links the pull request once open, and offers to push commits it does not have yet', async () => {
    api.getChatWorktrees.mockResolvedValue(list([row({ on_remote: true, unpushed: 1, pull_request_url: 'https://github.com/a/b/pull/3' })]))
    api.post.mockResolvedValueOnce({ status: 200, data: { pushed: 'lets-code/42' } })
    const w = await mountBar()
    expect(w.find('[data-test="cbb-open-pr"]').exists()).toBe(false)
    const link = w.find('[data-test="cbb-pr-link"]')
    expect(link.attributes('href')).toBe('https://github.com/a/b/pull/3')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    const push = w.find('[data-test="cbb-push"]')
    expect(push.attributes('aria-label')).toBe('Push 1 commit to the pull request')
    await push.trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/systems/5/repositories/4/source-control/push/', {}, { params: { chat: 42 } })
  })

  it('offers a preview only with Vercel connected, deploys THIS chat’s copy, and links it when ready', async () => {
    let w = await mountBar()
    expect(w.find('[data-test="cbb-deploy-preview"]').exists()).toBe(false)
    api.getVercelConnection.mockResolvedValue({ data: { connected: true } })
    api.post.mockResolvedValueOnce({ status: 202, data: { id: 9, state: 'PREPARING' } })
    w = await mountBar()
    const deploy = w.find('[data-test="cbb-deploy-preview"]')
    expect(deploy.attributes('aria-label')).toBe('Deploy a Vercel preview of lets-code/42')
    await deploy.trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/lets-code/projects/4/vercel/deploy/', { target: 'preview', chat_id: 42 })
    api.getChatWorktrees.mockResolvedValue(list([row({ preview: { id: 9, state: 'READY', url: 'https://x-git.vercel.app', active: false } })]))
    await w.setProps({ refreshKey: 1 })
    await flushPromises()
    expect(w.find('[data-test="cbb-preview-link"]').attributes('href')).toBe('https://x-git.vercel.app')
  })

  it('says a refusal in words (GitHub not connected)', async () => {
    api.getChatWorktrees.mockResolvedValue(list([row({ on_remote: true, unpushed: 0 })]))
    api.post.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Connect GitHub first.', code: 'GITHUB_NOT_CONNECTED' } } })
    const w = await mountBar()
    await w.find('[data-test="cbb-open-pr"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="cbb-note"]').text()).toBe('Connect GitHub first, then open the pull request.')
  })
})
