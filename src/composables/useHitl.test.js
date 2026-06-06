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

  it('dismiss and skip remove from the queue without sending', () => {
    const send = vi.fn()
    const { hitlRequests, handleHitlEvent, dismissHitl, skipHitl } = useHitl(send)
    handleHitlEvent(makeReq('r1'))
    handleHitlEvent(makeReq('r2'))
    dismissHitl('r1')
    skipHitl('r2')
    expect(hitlRequests.value).toHaveLength(0)
    expect(send).not.toHaveBeenCalled()
  })
})
