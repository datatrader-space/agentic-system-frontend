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

  it('dismiss/skip clear without sending', () => {
    const chat = useChatStore()
    const sendHitlResponse = vi.fn()
    chat._conn = { sendHitlResponse }
    chat._onEvent({ type: 'hitl_request', request_id: 'r1' })
    chat._onEvent({ type: 'hitl_request', request_id: 'r2' })
    chat.dismissHitl('r1')
    chat.skipHitl('r2')
    expect(chat.hitlRequests).toHaveLength(0)
    expect(sendHitlResponse).not.toHaveBeenCalled()
  })
})
