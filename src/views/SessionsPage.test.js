// @vitest-environment jsdom
//
// The sessions screen (LONG_RUN_LIKE_CLAUDE_CODE_PLAN.md 3.6): every state in words and colour, the summary line,
// the open card answered in place with the chat's own card, Stop asked first in the app's own dialog, the link to the
// chat, and the loading, empty and error states.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../services/chatService', () => ({
  ChatConnection: class { connect() {} close() {} send() {} sendHitlResponse() {} },
}))
vi.mock('../services/api', () => ({
  default: { getSessions: vi.fn(), getSessionNeedsInputCount: vi.fn(), getSessionForConversation: vi.fn(),
    getPendingApprovals: vi.fn(), answerApproval: vi.fn() },
}))
vi.mock('../composables/useConfirm', () => ({ confirm: vi.fn() }))

import api from '../services/api'
import { confirm } from '../composables/useConfirm'
import SessionsPage from './SessionsPage.vue'
import { useSessionsStore } from '../stores/useSessionsStore'

const HITLStub = {
  name: 'HITLModal',
  props: ['requests', 'inline', 'showStop'],
  emits: ['respond', 'stop', 'dismiss', 'skip'],
  template: '<div class="hitl-stub">{{ requests[0].summary }}<button class="ok" @click="$emit(\'respond\', { request_id: requests[0].request_id, response_value: true })" /></div>',
}

const card = { request_id: 'q1', interaction_type: 'question', response_type: 'text', summary: 'Which colour?', payload: {}, conversation_id: '11' }
const rows = [
  { run_id: 'a', conversation_id: 11, state: 'needs_input', state_label: 'Needs input', title: 'Shop', agent_name: 'Coder', summary: 'Which colour?', request: card, started_at: '2026-11-12T10:00:00Z', updated_at: '2026-11-12T10:00:00Z', chat_url: '/dashboard/chat/11', price_usd: '0.12' },
  { run_id: 'b', conversation_id: 12, state: 'working', state_label: 'Working', title: 'Research', agent_name: 'Analyst', summary: 'Searching the web', request: null, started_at: '2026-11-12T09:00:00Z', updated_at: '2026-11-12T09:00:00Z', chat_url: '/dashboard/chat/12', price_usd: null },
  { run_id: 'c', conversation_id: 13, state: 'failed', state_label: 'Failed', title: 'Deploy', agent_name: 'Ops', summary: 'The key was refused.', request: null, started_at: '2026-11-12T08:00:00Z', updated_at: '2026-11-12T08:00:00Z', chat_url: '/dashboard/lets-code?project=4', price_usd: null },
]

async function mountPage(path = '/dashboard/sessions') {
  setActivePinia(createPinia())
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/dashboard/sessions', component: SessionsPage },
    { path: '/:rest(.*)*', component: { template: '<div />' } },
  ] })
  router.push(path)
  await router.isReady()
  const w = mount(SessionsPage, { global: { plugins: [router], stubs: { HITLModal: HITLStub, LoadError: { template: '<div class="load-error" />' } } } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  api.getSessions.mockReset().mockResolvedValue({ data: { sessions: rows, next_cursor: null } })
  api.getSessionNeedsInputCount.mockReset().mockResolvedValue({ data: { count: 1 } })
  confirm.mockReset()
  api.getPendingApprovals.mockReset().mockResolvedValue({ data: { approvals: [] } })
  api.answerApproval.mockReset()
})

describe('SessionsPage', () => {
  it('shows each state in words, its summary, and a link to its chat', async () => {
    const { w } = await mountPage()
    const pills = w.findAll('[data-test="state-pill"]').map((p) => p.text())
    expect(pills).toEqual(['Needs input', 'Working', 'Failed'])
    expect(w.findAll('[data-test="summary"]').map((p) => p.text())).toEqual(['Which colour?', 'Searching the web', 'The key was refused.'])
    expect(w.find('[data-test="session-13"] [data-test="open"]').attributes('href')).toBe('/dashboard/lets-code?project=4')
    expect(w.find('[data-test="session-13"] [data-test="stop"]').exists()).toBe(false)
    expect(w.find('[data-test="filter-needs_input"]').text()).toContain('1')
  })

  it('answers the open card in place with the chat\'s card', async () => {
    const { w } = await mountPage()
    const store = useSessionsStore()
    const spy = vi.spyOn(store, 'respond')
    expect(w.find('[data-test="inline-card"]').exists()).toBe(false)
    await w.find('[data-test="session-11"] [data-test="answer"]').trigger('click')
    expect(w.find('[data-test="inline-card"]').text()).toContain('Which colour?')
    await w.find('.hitl-stub .ok').trigger('click')
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ conversation_id: 11 }), { request_id: 'q1', response_value: true })
  })

  it('asks before stopping, in the app\'s dialog, and stops only on yes', async () => {
    const { w } = await mountPage()
    const store = useSessionsStore()
    const spy = vi.spyOn(store, 'stop')
    confirm.mockResolvedValueOnce(false)
    await w.find('[data-test="session-12"] [data-test="stop"]').trigger('click')
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
    confirm.mockResolvedValueOnce(true)
    await w.find('[data-test="session-12"] [data-test="stop"]').trigger('click')
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('the filter is in the URL', async () => {
    const { w, router } = await mountPage('/dashboard/sessions?state=failed')
    expect(api.getSessions).toHaveBeenLastCalledWith({ state: 'failed' })
    await w.find('[data-test="filter-all"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.state).toBeUndefined()
    expect(api.getSessions).toHaveBeenLastCalledWith({})
  })

  it('says when there is nothing, per filter', async () => {
    api.getSessions.mockResolvedValue({ data: { sessions: [], next_cursor: null } })
    const { w } = await mountPage('/dashboard/sessions?state=needs_input')
    expect(w.find('[data-test="empty"]').text()).toContain('Nothing needs you')
  })

  it('a failed load is an error with Retry, not an empty list', async () => {
    api.getSessions.mockRejectedValue(new Error('down'))
    const { w } = await mountPage()
    expect(w.find('.load-error').exists()).toBe(true)
    expect(w.find('[data-test="empty"]').exists()).toBe(false)
  })

  it('shows rows shaped like the real ones while loading', async () => {
    let release
    api.getSessions.mockReturnValue(new Promise((r) => { release = r }))
    const { w } = await mountPage()
    expect(w.find('[data-test="loading"]').attributes('aria-busy')).toBe('true')
    release({ data: { sessions: rows, next_cursor: null } })
    await flushPromises()
    expect(w.find('[data-test="loading"]').exists()).toBe(false)
  })
})

const ap = (id, extra = {}) => ({
  id, summary: `Summary ${id}`, tool_name: 'EMAIL_SEND', kind: 'tool', source: 'mcp', conversation_id: 21,
  agent_name: 'Reporter', created_at: new Date().toISOString(), timeout_at: null, options: null, ...extra,
})

describe('SessionsPage: waiting for you', () => {
  it('is not shown when nothing waits', async () => {
    const { w } = await mountPage()
    expect(w.find('[data-test="waiting"]').exists()).toBe(false)
    w.unmount()
  })

  it('reads the approvals on coming back to the page, and never on a timer', async () => {
    const spy = vi.spyOn(globalThis, 'setInterval')
    const { w } = await mountPage()
    const calls = api.getPendingApprovals.mock.calls.length
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    // (Pages mounted by earlier tests and never unmounted listen too, so the count only has to grow.)
    expect(api.getPendingApprovals.mock.calls.length).toBeGreaterThan(calls)
    // No poll: the only interval the page may start is the 1 s countdown clock, for a row with a clock.
    expect(spy.mock.calls.some(([, ms]) => ms === 30000)).toBe(false)
    spy.mockRestore()
    w.unmount()
  })

  it('renders each approval with its agent, where it came from, and its actions', async () => {
    api.getPendingApprovals.mockResolvedValue({ data: { approvals: [
      ap('a1'),
      ap('a2', { source: 'parked', conversation_id: null }),
      ap('a3', { source: 'chat' }),
    ] } })
    const { w } = await mountPage()
    expect(w.find('[data-test="waiting"]').text()).toContain('Waiting for you')
    const r1 = w.find('[data-test="approval-a1"]')
    expect(r1.text()).toContain('Summary a1')
    expect(r1.text()).toContain('Reporter')
    expect(r1.find('[data-test="approval-source"]').text()).toBe('From an MCP client')
    expect(r1.find('[data-test="approval-approve"]').exists()).toBe(true)
    expect(r1.find('[data-test="approval-decline"]').exists()).toBe(true)
    expect(r1.find('[data-test="approval-open"]').attributes('href')).toBe('/dashboard/chat/21')
    const r2 = w.find('[data-test="approval-a2"]')
    expect(r2.find('[data-test="approval-source"]').text()).toBe('From a scheduled or background run')
    expect(r2.find('[data-test="approval-open"]').exists()).toBe(false)
    expect(w.find('[data-test="approval-a3"] [data-test="approval-source"]').text()).toBe('From a chat')
    w.unmount()
  })

  it('a plan or a question is answered in its chat, not here; with no chat only the summary shows', async () => {
    api.getPendingApprovals.mockResolvedValue({ data: { approvals: [
      ap('p1', { kind: 'plan' }), ap('q1', { kind: 'question', conversation_id: null }),
    ] } })
    const { w } = await mountPage()
    const p1 = w.find('[data-test="approval-p1"]')
    expect(p1.find('[data-test="approval-approve"]').exists()).toBe(false)
    expect(p1.find('[data-test="approval-decline"]').exists()).toBe(false)
    expect(p1.find('[data-test="approval-open"]').text()).toContain('Open the chat')
    const q1 = w.find('[data-test="approval-q1"]')
    expect(q1.find('button').exists()).toBe(false)
    expect(q1.find('a').exists()).toBe(false)
    expect(q1.find('[data-test="approval-summary"]').text()).toBe('Summary q1')
    w.unmount()
  })

  it("names a Let's Code step's working copy and risk, from the card the server sends (ADM-1283)", async () => {
    api.getPendingApprovals.mockResolvedValue({ data: { approvals: [
      ap('c1', { request: { request_id: 'c1', waiting: true, working_copy: 'chat/9', risk: 'high' } }),
      ap('c2', { request: { request_id: 'c2', waiting: true, working_copy: '', risk: 'high' } }),
      ap('o1', { request: { request_id: 'o1', waiting: true, working_copy: null, risk: null } }),
    ] } })
    const { w } = await mountPage()
    expect(w.find('[data-test="approval-c1"] [data-test="approval-coding"]').text()).toBe("This chat's branch chat/9 · high risk")
    expect(w.find('[data-test="approval-c2"] [data-test="approval-coding"]').text()).toBe("The project's shared copy · high risk")
    expect(w.find('[data-test="approval-o1"] [data-test="approval-coding"]').exists()).toBe(false)
    w.unmount()
  })

  it('shows a countdown only for an approval with timeout_at', async () => {
    api.getPendingApprovals.mockResolvedValue({ data: { approvals: [
      ap('n1'), ap('t1', { timeout_at: new Date(Date.now() + 10 * 60000).toISOString() }),
    ] } })
    const { w } = await mountPage()
    expect(w.find('[data-test="approval-n1"] [data-test="approval-time-left"]').exists()).toBe(false)
    expect(w.find('[data-test="approval-t1"] [data-test="approval-time-left"]').text()).toMatch(/Answer within \d+ min/)
    w.unmount()
  })

  it('approving disables the buttons while sending, then the row goes', async () => {
    api.getPendingApprovals.mockResolvedValueOnce({ data: { approvals: [ap('a1')] } })
      .mockResolvedValue({ data: { approvals: [] } })
    let done
    api.answerApproval.mockReturnValue(new Promise((r) => { done = r }))
    const { w } = await mountPage()
    await w.find('[data-test="approval-approve"]').trigger('click')
    expect(w.find('[data-test="approval-approve"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="approval-decline"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="approval-approve"]').text()).toContain('Approving…')
    done({ data: { ok: true, status: 'completed' } })
    await flushPromises()
    expect(w.find('[data-test="waiting"]').exists()).toBe(false)
    w.unmount()
  })

  it('a refused answer is said beside its row', async () => {
    api.getPendingApprovals.mockResolvedValue({ data: { approvals: [ap('a1')] } })
    api.answerApproval.mockRejectedValue({ response: { status: 400, data: { error: 'Not yours to answer.' } } })
    const { w } = await mountPage()
    await w.find('[data-test="approval-decline"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="approval-a1"] [data-test="approval-error"]').text()).toContain('Not yours to answer.')
    expect(w.find('[data-test="approval-decline"]').attributes('disabled')).toBeUndefined()
    w.unmount()
  })
})
