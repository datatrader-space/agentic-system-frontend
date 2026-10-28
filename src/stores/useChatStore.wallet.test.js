// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../services/api', () => ({ default: {} }))

import { useChatStore } from './useChatStore'

const lastAssistant = (s) => [...s.messages].reverse().find((m) => m.role === 'assistant')

beforeEach(() => setActivePinia(createPinia()))

// The person's prepaid balance refused the turn (backend PAYMENTS_TOPUP_PLAN.md §6.5): the bubble says so, offers
// "Top up", and never offers Retry (it would fail identically until the person tops up).
describe('a wallet refusal in chat', () => {
  it('marks the bubble with the code and withholds Retry', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'error', error: '⛔ Your balance is $0.00. Top up to continue.', retryable: false, code: 'wallet_empty' })
    const m = lastAssistant(s)
    expect(m.status).toBe('error')
    expect(m.errorCode).toBe('wallet_empty')
    expect(m.retryable).toBe(false)
  })

  it('an ordinary error carries no wallet code', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'error', error: 'provider timed out', retryable: true })
    expect(lastAssistant(s).errorCode).toBeUndefined()
  })
})
