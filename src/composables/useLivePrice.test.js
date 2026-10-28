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
    expect(state().price.value).toEqual({ estimate: 0.04, most: 0.08, status: 'estimated' })
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
})
