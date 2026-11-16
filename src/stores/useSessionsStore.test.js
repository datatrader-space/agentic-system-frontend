// @vitest-environment jsdom
//
// The sessions screen's store (backend run_coordinator/services/run_sessions.py): it lists the rows the server gives,
// reads one chat's row again when a live frame names it (never trusting the frame's content), answers and stops over
// the chat's own frames, and keeps a filtered list honest.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const sent = []
let handlers = null
vi.mock('../services/chatService', () => ({
  ChatConnection: class {
    constructor(_cid, h) { handlers = h }
    connect() {}
    close() {}
    send(obj) { sent.push(obj) }
    sendHitlResponse(request_id, response_value, feedback) { sent.push({ type: 'hitl_response', request_id, response_value, feedback }) }
  },
}))
vi.mock('../services/api', () => ({
  default: {
    getSessions: vi.fn(),
    getSessionNeedsInputCount: vi.fn(),
    getSessionForConversation: vi.fn(),
    getPendingApprovals: vi.fn(),
    answerApproval: vi.fn(),
  },
}))

import api from '../services/api'
import { useSessionsStore } from './useSessionsStore'

const row = (cid, state = 'working', started = '2026-11-12T10:00:00Z', extra = {}) => ({
  run_id: `r${cid}`, conversation_id: cid, state, state_label: state, title: `chat ${cid}`, summary: 's',
  started_at: started, updated_at: started, request: null, chat_url: `/dashboard/chat/${cid}`, ...extra,
})

beforeEach(() => {
  setActivePinia(createPinia())
  sent.length = 0
  handlers = null
  vi.useFakeTimers()
  api.getSessions.mockReset()
  api.getSessionNeedsInputCount.mockReset().mockResolvedValue({ data: { count: 2 } })
  api.getSessionForConversation.mockReset()
  api.getPendingApprovals.mockReset().mockResolvedValue({ data: { approvals: [] } })
  api.answerApproval.mockReset()
})

describe('useSessionsStore', () => {
  it('loads a page, then the next page by its cursor, without repeating a row', async () => {
    const s = useSessionsStore()
    api.getSessions.mockResolvedValueOnce({ data: { sessions: [row(1), row(2)], next_cursor: 'c1' } })
    await s.load()
    expect(s.items.map((r) => r.conversation_id)).toEqual([1, 2])
    api.getSessions.mockResolvedValueOnce({ data: { sessions: [row(2), row(3)], next_cursor: null } })
    await s.loadMore()
    expect(api.getSessions).toHaveBeenLastCalledWith({ cursor: 'c1' })
    expect(s.items.map((r) => r.conversation_id)).toEqual([1, 2, 3])
    expect(s.nextCursor).toBe(null)
  })

  it('a failed first page is an error, not an empty list', async () => {
    const s = useSessionsStore()
    api.getSessions.mockRejectedValueOnce(new Error('down'))
    await s.load()
    expect(s.loadError).toBe(true)
    expect(s.items).toEqual([])
  })

  it('filters through the server', async () => {
    const s = useSessionsStore()
    api.getSessions.mockResolvedValue({ data: { sessions: [], next_cursor: null } })
    await s.setFilter('needs_input')
    expect(api.getSessions).toHaveBeenLastCalledWith({ state: 'needs_input' })
    await s.setFilter('nonsense')
    expect(s.filter).toBe('')
  })

  it('a live frame makes it read that chat row again, once for a burst', async () => {
    const s = useSessionsStore()
    api.getSessions.mockResolvedValueOnce({ data: { sessions: [row(1, 'working')], next_cursor: null } })
    await s.load()
    s.connect()
    api.getSessionForConversation.mockResolvedValue({ data: row(1, 'needs_input', undefined, { summary: 'asks' }) })
    handlers.onEvent({ type: 'run_state', conversation_id: '1', run_id: 'r1' })
    handlers.onEvent({ type: 'hitl_request', conversation_id: '1', request_id: 'q', summary: 'IGNORED' })
    await vi.advanceTimersByTimeAsync(500)
    expect(api.getSessionForConversation).toHaveBeenCalledTimes(1)
    expect(s.items[0].state).toBe('needs_input')
    expect(s.items[0].summary).toBe('asks')
    expect(s.needsInputCount).toBe(2)
    s.disconnect()
  })

  it('a row that no longer matches the filter, or is gone, leaves the list', async () => {
    const s = useSessionsStore()
    api.getSessions.mockResolvedValueOnce({ data: { sessions: [row(1, 'needs_input'), row(2, 'needs_input')], next_cursor: null } })
    await s.setFilter('needs_input')
    api.getSessionForConversation.mockResolvedValueOnce({ data: row(1, 'working') })
    await s.refreshConversation(1)
    api.getSessionForConversation.mockRejectedValueOnce({ response: { status: 404 } })
    await s.refreshConversation(2)
    expect(s.items).toEqual([])
  })

  it('a new chat row is put in order, newest first', async () => {
    const s = useSessionsStore()
    api.getSessions.mockResolvedValueOnce({ data: { sessions: [row(1, 'done', '2026-11-12T09:00:00Z')], next_cursor: null } })
    await s.load()
    api.getSessionForConversation.mockResolvedValueOnce({ data: row(5, 'working', '2026-11-12T11:00:00Z') })
    await s.refreshConversation(5)
    expect(s.items.map((r) => r.conversation_id)).toEqual([5, 1])
  })

  it('answers with the chat\'s hitl_response and stops with its stop_execution, for that chat', () => {
    const s = useSessionsStore()
    s.connect()
    const r = row(7, 'needs_input')
    s.respond(r, { request_id: 'q7', response_value: true, feedback: '' })
    s.stop(r)
    expect(sent).toEqual([
      { type: 'hitl_response', request_id: 'q7', response_value: true, feedback: '' },
      { type: 'stop_execution', conversation_id: '7' },
    ])
    expect(s.busy['7']).toBe('stop')
    s.disconnect()
  })

  it('shows the server\'s refusal of an action', () => {
    const s = useSessionsStore()
    s.connect()
    handlers.onEvent({ type: 'error', error: 'Request already completed' })
    expect(s.actionError).toBe('Request already completed')
    s.disconnect()
  })
})

const approval = (id, extra = {}) => ({
  id, summary: `Send report ${id}`, tool_name: 'EMAIL_SEND', kind: 'tool', source: 'mcp', conversation_id: 7,
  agent_name: 'Reporter', created_at: '2026-11-12T10:00:00Z', timeout_at: null, options: null, ...extra,
})

describe('waiting for you (pending approvals)', () => {
  it('loads the pending approvals', async () => {
    const s = useSessionsStore()
    api.getPendingApprovals.mockResolvedValueOnce({ data: { approvals: [approval('a1'), approval('a2')] } })
    await s.loadApprovals()
    expect(s.approvals.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('a failed read keeps the rows already shown', async () => {
    const s = useSessionsStore()
    s.approvals = [approval('a1')]
    api.getPendingApprovals.mockRejectedValueOnce(new Error('down'))
    await s.loadApprovals()
    expect(s.approvals.map((a) => a.id)).toEqual(['a1'])
  })

  it('answers one: busy while sending, the row goes on success and the list is read again', async () => {
    const s = useSessionsStore()
    s.approvals = [approval('a1'), approval('a2')]
    let done
    api.answerApproval.mockReturnValueOnce(new Promise((r) => { done = r }))
    api.getPendingApprovals.mockResolvedValueOnce({ data: { approvals: [approval('a2')] } })
    const p = s.answerApproval(s.approvals[0], true, '')
    expect(s.approvalBusy.a1).toBe('approve')
    expect(await s.answerApproval(s.approvals[0], true)).toBe(false)   // a second click while sending sends nothing
    expect(api.answerApproval).toHaveBeenCalledTimes(1)
    expect(api.answerApproval).toHaveBeenCalledWith('a1', { approved: true, feedback: '' })
    done({ data: { ok: true, status: 'completed' } })
    expect(await p).toBe(true)
    expect(s.approvalBusy.a1).toBeUndefined()
    expect(s.approvals.map((a) => a.id)).toEqual(['a2'])
    expect(api.getPendingApprovals).toHaveBeenCalled()
  })

  it("a refused answer says the server's words beside the row, which stays", async () => {
    const s = useSessionsStore()
    s.approvals = [approval('a1')]
    api.answerApproval.mockRejectedValueOnce({ response: { status: 409, data: { error: 'This approval was already answered.' } } })
    expect(await s.answerApproval(s.approvals[0], false)).toBe(false)
    expect(s.approvalErrors.a1).toBe('This approval was already answered.')
    expect(s.approvals).toHaveLength(1)
    expect(s.approvalBusy.a1).toBeUndefined()
    api.answerApproval.mockRejectedValueOnce(new Error('offline'))
    await s.answerApproval(s.approvals[0], true)
    expect(s.approvalErrors.a1).toBe("The answer couldn't be sent. Try again.")
  })

  it('a hitl_request frame reads the approvals again', async () => {
    const s = useSessionsStore()
    s.connect()
    handlers.onEvent({ type: 'hitl_request', request_id: 'q9', conversation_id: 7 })
    expect(api.getPendingApprovals).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(api.getPendingApprovals).toHaveBeenCalledTimes(1)
    s.disconnect()
  })

  it("an MCP client's hitl_request re-reads the approvals and reads no session row", async () => {
    const s = useSessionsStore()
    s.connect()
    handlers.onEvent({ type: 'hitl_request', request_id: 'm1', conversation_id: 'mcp:abc' })
    await vi.advanceTimersByTimeAsync(500)
    expect(api.getPendingApprovals).toHaveBeenCalledTimes(1)
    expect(api.getSessionForConversation).not.toHaveBeenCalled()
    s.disconnect()
  })
})
