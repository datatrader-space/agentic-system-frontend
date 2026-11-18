import { describe, it, expect, vi } from 'vitest'
import { useHitl } from './useHitl'

function makeReq(id, extra = {}) {
  return { type: 'hitl_request', request_id: id, interaction_type: 'approval', response_type: 'binary', summary: `s-${id}`, ...extra }
}

describe('useHitl', () => {
  it('queues a hitl_request', () => {
    const { hitlRequests, handleHitlEvent } = useHitl(() => {})
    expect(handleHitlEvent(makeReq('r1'))).toBe(true)
    expect(hitlRequests.value).toHaveLength(1)
    expect(hitlRequests.value[0].request_id).toBe('r1')
    expect(hitlRequests.value[0].summary).toBe('s-r1')
  })

  it('does not duplicate the same request', () => {
    const { hitlRequests, handleHitlEvent } = useHitl(() => {})
    handleHitlEvent(makeReq('r1'))
    handleHitlEvent(makeReq('r1'))
    expect(hitlRequests.value).toHaveLength(1)
  })

  it('queues multiple distinct requests in order', () => {
    const { hitlRequests, handleHitlEvent } = useHitl(() => {})
    handleHitlEvent(makeReq('r1'))
    handleHitlEvent(makeReq('r2'))
    expect(hitlRequests.value.map((r) => r.request_id)).toEqual(['r1', 'r2'])
  })

  it('removes a request on hitl_response_ack', () => {
    const { hitlRequests, handleHitlEvent } = useHitl(() => {})
    handleHitlEvent(makeReq('r1'))
    handleHitlEvent(makeReq('r2'))
    expect(handleHitlEvent({ type: 'hitl_response_ack', request_id: 'r1' })).toBe(true)
    expect(hitlRequests.value.map((r) => r.request_id)).toEqual(['r2'])
  })

  it('ignores non-HITL events', () => {
    const { handleHitlEvent } = useHitl(() => {})
    expect(handleHitlEvent({ type: 'tool_call' })).toBe(false)
    expect(handleHitlEvent(null)).toBe(false)
  })

  it('respond sends a hitl_response and clears the queue (approve)', () => {
    const send = vi.fn()
    const { hitlRequests, handleHitlEvent, respondHitl } = useHitl(send)
    handleHitlEvent(makeReq('r1'))
    respondHitl({ request_id: 'r1', response_value: true, feedback: 'ok' })
    expect(send).toHaveBeenCalledWith({ type: 'hitl_response', request_id: 'r1', response_value: true, feedback: 'ok' })
    expect(hitlRequests.value).toHaveLength(0)
  })

  it('respond relays a rejection (response_value=false)', () => {
    const send = vi.fn()
    const { handleHitlEvent, respondHitl } = useHitl(send)
    handleHitlEvent(makeReq('r1'))
    respondHitl({ request_id: 'r1', response_value: false })
    expect(send).toHaveBeenCalledWith({ type: 'hitl_response', request_id: 'r1', response_value: false, feedback: '' })
  })

  // ADM-1283: Skip and Dismiss used to drop a live card without telling the server, so its run waited on nothing.
  it('skip moves a card to the back and keeps it; dismiss only drops a card with nothing to answer', () => {
    const send = vi.fn()
    const { hitlRequests, handleHitlEvent, dismissHitl, skipHitl } = useHitl(send)
    handleHitlEvent(makeReq('r1'))
    handleHitlEvent(makeReq('r2'))
    handleHitlEvent(makeReq('n1', { response_type: 'none' }))
    skipHitl('r1')
    expect(hitlRequests.value.map((r) => r.request_id)).toEqual(['r2', 'n1', 'r1'])
    dismissHitl('r2')
    expect(hitlRequests.value.map((r) => r.request_id)).toEqual(['r2', 'n1', 'r1'])
    dismissHitl('n1')
    expect(hitlRequests.value.map((r) => r.request_id)).toEqual(['r2', 'r1'])
    expect(send).not.toHaveBeenCalled()
  })

  it('a replaced card reads so, then goes; an answered one comes back to say so', () => {
    vi.useFakeTimers()
    try {
      const send = vi.fn()
      const { hitlRequests, handleHitlEvent, respondHitl } = useHitl(send)
      handleHitlEvent(makeReq('r1'))
      handleHitlEvent(makeReq('r2'))
      handleHitlEvent({ type: 'hitl_resolved', request_id: 'r1', status: 'superseded' })
      expect(hitlRequests.value.find((r) => r.request_id === 'r1').state).toBe('superseded')
      respondHitl({ request_id: 'r2', response_value: true })
      handleHitlEvent({ type: 'hitl_resolved', request_id: 'r2', status: 'superseded' })
      expect(hitlRequests.value.map((r) => [r.request_id, r.state])).toEqual([['r1', 'superseded'], ['r2', 'superseded']])
      vi.advanceTimersByTime(8000)
      expect(hitlRequests.value).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
