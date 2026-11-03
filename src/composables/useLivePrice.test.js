// @vitest-environment jsdom
// The price of a draft shown as its settings change (UX pass, 2026-10-28): asked for once the settings rest, never
// for an incomplete draft, and only the newest answer is shown.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('../services/api', () => ({ default: { getStudioQuote: vi.fn() } }))
import api from '../services/api'
import { useLivePrice } from './useLivePrice'

function host(body) {
  let state
  const w = mount(defineComponent({ setup() { state = useLivePrice(body, { wait: 500 }); return () => null } }))
  return { w, state: () => state }
}

describe('useLivePrice', () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('asks once the settings rest, and shows the newest answer only', async () => {
    vi.useFakeTimers()
    const text = ref('a mug')
    api.getStudioQuote.mockImplementation(body => Promise.resolve({ data: { estimate_usd: body.request.prompt === 'a cup' ? '0.040000' : '0.020000', max_usd: '0.080000', pricing_status: 'estimated' } }))
    const { w, state } = host(() => ({ kind: 'media', operation: 'image', request: { prompt: text.value } }))
    expect(state().loading.value).toBe(true)
    text.value = 'a bowl'; await nextTick(); text.value = 'a cup'; await nextTick()
    await vi.advanceTimersByTimeAsync(499)
    expect(api.getStudioQuote).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(api.getStudioQuote).toHaveBeenCalledTimes(1)
    expect(state().price.value).toEqual({ estimate: 0.04, most: 0.08, status: 'estimated', reason: '', adjustments: [], needsAcceptance: false })
    expect(state().loading.value).toBe(false)
    w.unmount()
  })

  it('an incomplete draft asks nothing, and a refusal is said in words', async () => {
    vi.useFakeTimers()
    const ready = ref(false)
    api.getStudioQuote.mockRejectedValue({ response: { data: { error: { message: 'That model is not available to you.' } } } })
    const { w, state } = host(() => ready.value ? { kind: 'media' } : null)
    await vi.advanceTimersByTimeAsync(1000)
    expect(api.getStudioQuote).not.toHaveBeenCalled()
    expect((state().price.value, state().loading.value)).toBe(false)
    ready.value = true; await nextTick(); await vi.advanceTimersByTimeAsync(600)
    expect(state().problem.value).toBe('That model is not available to you.')
    w.unmount()
  })

  it('adjustments that need acceptance block until accepted, and a new answer asks again', async () => {
    vi.useFakeTimers()
    const text = ref('a mug')
    api.getStudioQuote.mockResolvedValue({ data: { estimate_usd: '0.5', max_usd: '0.5', pricing_status: 'exact', adjustments: [{ field: 'duration', requested: 7, proposed: 5 }], needs_acceptance: true } })
    const { w, state } = host(() => ({ kind: 'video', prompt: text.value }))
    await vi.advanceTimersByTimeAsync(500)
    expect(state().blocked.value).toBe(true); expect(state().acceptFields.value).toEqual([])
    state().accepted.value = true
    expect(state().blocked.value).toBe(false); expect(state().acceptFields.value).toEqual(['duration'])
    text.value = 'a cup'; await nextTick()
    expect(state().accepted.value).toBe(false)
    w.unmount()
  })

  it('a model that cannot be charged for blocks; an unknown max is no price, not $0; a 429 says when to try again', async () => {
    vi.useFakeTimers()
    const which = ref('a')
    api.getStudioQuote.mockImplementation(body => body.model_id === 'a'
      ? Promise.reject({ response: { status: 400, data: { error: { code: 'not_priced', field: 'model_id', message: 'This model cannot be charged for.' } } } })
      : body.model_id === 'b' ? Promise.resolve({ data: { estimate_usd: '0', max_usd: null, pricing_status: 'unknown', reason: 'priced per token' } })
        : Promise.reject({ response: { status: 429, data: { error: { code: 'rate_limited', message: 'Slow down.', retry_after: 90 } } } }))
    const { w, state } = host(() => ({ kind: 'image', model_id: which.value }))
    await vi.advanceTimersByTimeAsync(500)
    expect(state().code.value).toBe('not_priced'); expect(state().blocked.value).toBe(true)
    which.value = 'b'; await nextTick(); await vi.advanceTimersByTimeAsync(500)
    expect(state().price.value).toMatchObject({ status: 'unknown', most: null, reason: 'priced per token' }); expect(state().blocked.value).toBe(false)
    which.value = 'c'; await nextTick(); await vi.advanceTimersByTimeAsync(500)
    expect(state().problem.value).toBe('Slow down. Try again in 2 minutes.')
    w.unmount()
  })
})
