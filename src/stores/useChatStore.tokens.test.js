import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

describe('useChatStore — session token totals', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('sums total_tokens + cost_usd across metered turns; ignores turns without usage', () => {
    const chat = useChatStore()
    chat.messages = [
      { id: 'u1', role: 'user', content: 'hi' },
      { id: 'a1', role: 'assistant', content: 'hello', usage: { total_tokens: 4215, cost_usd: 0.012 } },
      { id: 'u2', role: 'user', content: 'more' },
      { id: 'a2', role: 'assistant', content: 'sure', usage: { total_tokens: 4200, cost_usd: 0.068 } },
      { id: 'a3', role: 'assistant', content: 'no-usage turn' }, // contributes 0
    ]
    expect(chat.sessionTokens).toBe(8415)
    expect(chat.sessionCost).toBeCloseTo(0.08, 5)
  })

  it('ticks live from a streaming turn’s activity tokens, then prefers exact usage', () => {
    const chat = useChatStore()
    // mid-stream: no usage yet, but the live activity counter is set
    chat.messages = [
      { id: 'a1', role: 'assistant', content: 'done', usage: { total_tokens: 4000, cost_usd: 0.01 } },
      { id: 'a2', role: 'assistant', content: '', activity: { tokens: { total: 1200, cost: 0.004 } } },
    ]
    expect(chat.sessionTokens).toBe(5200)            // 4000 exact + 1200 live
    expect(chat.sessionCost).toBeCloseTo(0.014, 5)
    // when the turn completes, exact usage wins over the (now stale) live counter
    chat.messages[1].usage = { total_tokens: 1300, cost_usd: 0.005 }
    expect(chat.sessionTokens).toBe(5300)
  })

  it('is zero on an empty thread and after reset', () => {
    const chat = useChatStore()
    expect(chat.sessionTokens).toBe(0)
    expect(chat.sessionCost).toBe(0)
    chat.messages = [{ id: 'a1', role: 'assistant', usage: { total_tokens: 10, cost_usd: 1 } }]
    expect(chat.sessionTokens).toBe(10)
    chat.reset()
    expect(chat.sessionTokens).toBe(0)
  })
})
