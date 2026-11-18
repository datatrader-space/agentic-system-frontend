import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

describe('useChatStore — HITL approval queue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('queues hitl_request events and de-dupes', () => {
    const chat = useChatStore()
    chat._onEvent({ type: 'hitl_request', request_id: 'r1', summary: 'Approve write?' })
    chat._onEvent({ type: 'hitl_request', request_id: 'r1' }) // dup
    chat._onEvent({ type: 'hitl_request', request_id: 'r2' })
    expect(chat.hitlRequests.map((r) => r.request_id)).toEqual(['r1', 'r2'])
  })

  it('clears a request on hitl_response_ack', () => {
    const chat = useChatStore()
    chat._onEvent({ type: 'hitl_request', request_id: 'r1' })
    chat._onEvent({ type: 'hitl_response_ack', request_id: 'r1' })
    expect(chat.hitlRequests).toHaveLength(0)
  })

  it('respondHitl sends over the connection and clears the queue', () => {
    const chat = useChatStore()
    const sendHitlResponse = vi.fn()
    chat._conn = { sendHitlResponse } // inject a mock connection
    chat._onEvent({ type: 'hitl_request', request_id: 'r1' })
    chat.respondHitl({ request_id: 'r1', response_value: true, feedback: 'go' })
    expect(sendHitlResponse).toHaveBeenCalledWith('r1', true, 'go')
    expect(chat.hitlRequests).toHaveLength(0)
  })

  // ADM-1283: Skip and Dismiss used to drop a live card without telling the server, so its run waited on nothing.
  it('skip keeps the card at the back; dismiss drops only a card with nothing to answer; neither sends', () => {
    const chat = useChatStore()
    const sendHitlResponse = vi.fn()
    chat._conn = { sendHitlResponse }
    chat._onEvent({ type: 'hitl_request', request_id: 'r1', response_type: 'binary' })
    chat._onEvent({ type: 'hitl_request', request_id: 'r2', response_type: 'binary' })
    chat._onEvent({ type: 'hitl_request', request_id: 'n1', response_type: 'none' })
    chat.skipHitl('r1')
    expect(chat.hitlRequests.map((r) => r.request_id)).toEqual(['r2', 'n1', 'r1'])
    chat.dismissHitl('r2')
    chat.dismissHitl('n1')
    expect(chat.hitlRequests.map((r) => r.request_id)).toEqual(['r2', 'r1'])
    expect(chat.awaitingApproval).toBe(true)
    expect(sendHitlResponse).not.toHaveBeenCalled()
  })

  it('keeps the live state, working copy and risk the server sends', () => {
    const chat = useChatStore()
    chat._onEvent({ type: 'hitl_request', request_id: 'r1', state: 'pending', working_copy: 'chat/42', risk: 'high' })
    expect(chat.hitlRequests[0]).toMatchObject({ state: 'pending', working_copy: 'chat/42', risk: 'high' })
  })

  it('a replaced card reads so and no longer holds the turn, then goes', () => {
    vi.useFakeTimers()
    try {
      const chat = useChatStore()
      chat._conn = { sendHitlResponse: vi.fn() }
      chat._onEvent({ type: 'hitl_request', request_id: 'r1', response_type: 'binary' })
      chat._onEvent({ type: 'hitl_request', request_id: 'r2', response_type: 'binary' })
      chat.respondHitl({ request_id: 'r2', response_value: true, feedback: '' })
      chat._onEvent({ type: 'hitl_resolved', request_id: 'r1', status: 'superseded' })
      chat._onEvent({ type: 'hitl_resolved', request_id: 'r2', status: 'superseded' })
      expect(chat.hitlRequests.map((r) => [r.request_id, r.state])).toEqual([['r1', 'superseded'], ['r2', 'superseded']])
      expect(chat.awaitingApproval).toBe(false)
      vi.advanceTimersByTime(8000)
      expect(chat.hitlRequests).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
