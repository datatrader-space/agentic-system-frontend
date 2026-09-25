// @vitest-environment jsdom
//
// Approvals a connected app (MCP) raised. They belong to no chat, so the in-chat approval card never showed
// them — and the Canvas gate refuses an approval given by the very app that asked. This page is where the
// person answers.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { api, notify, confirm } = vi.hoisted(() => ({
  api: { getPendingApprovals: vi.fn(), decideApproval: vi.fn() },
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  confirm: vi.fn(),
}))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('../composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('../composables/useConfirm', () => ({ useConfirm: () => confirm }))

import ApprovalsPage from './ApprovalsPage.vue'

const ROW = {
  id: 'a1', summary: 'Start the canvas agent in canvas mode from Claude?', action: 'canvas mode: bakery page',
  tool: 'aadml_run_start', agent: 'canvas agent', risk: 'builds in a sandbox', reason: '',
  requested_by_client: 'Claude', urgency: 'medium',
  requested_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600e3).toISOString(),
}

beforeEach(() => {
  api.getPendingApprovals.mockReset().mockResolvedValue({ data: { items: [ROW], count: 1 } })
  api.decideApproval.mockReset().mockResolvedValue({ data: { decision: 'approve' } })
  confirm.mockReset().mockResolvedValue(true)
  Object.values(notify).forEach((fn) => fn.mockClear())
})

const mountPage = async () => {
  const w = mount(ApprovalsPage, { global: { stubs: { Icon: true } } })
  await flushPromises()
  return w
}

describe('ApprovalsPage', () => {
  it('lists what is waiting, naming the app that asked and what it wants', async () => {
    const w = await mountPage()
    const card = w.find('[data-test="approval-a1"]')
    expect(card.text()).toContain('Claude')
    expect(card.text()).toContain('canvas mode: bakery page')
  })

  it('says so when nothing is waiting', async () => {
    api.getPendingApprovals.mockResolvedValue({ data: { items: [], count: 0 } })
    const w = await mountPage()
    expect(w.find('[data-test="approvals-empty"]').exists()).toBe(true)
  })

  it('approving sends the decision and removes the card', async () => {
    const w = await mountPage()
    await w.find('[data-test="approve-a1"]').trigger('click')
    await flushPromises()
    expect(api.decideApproval).toHaveBeenCalledWith('a1', 'approve')
    expect(w.find('[data-test="approval-a1"]').exists()).toBe(false)
    expect(notify.success).toHaveBeenCalled()
  })

  it('rejecting asks first, in the app\'s own dialog', async () => {
    const w = await mountPage()
    await w.find('[data-test="reject-a1"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(api.decideApproval).toHaveBeenCalledWith('a1', 'reject')
  })

  it('a rejection the person backs out of sends nothing', async () => {
    confirm.mockResolvedValue(false)
    const w = await mountPage()
    await w.find('[data-test="reject-a1"]').trigger('click')
    await flushPromises()
    expect(api.decideApproval).not.toHaveBeenCalled()
  })

  it('a decision that fails is reported and the list reloaded', async () => {
    api.decideApproval.mockRejectedValue({ response: { data: { error: 'That approval is not waiting on you any more.' } } })
    const w = await mountPage()
    await w.find('[data-test="approve-a1"]').trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('That approval is not waiting on you any more.')
    expect(api.getPendingApprovals).toHaveBeenCalledTimes(2)
  })
})
