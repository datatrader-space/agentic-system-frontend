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

  it('ticks live from a streaming turn’s timeline tokens, then prefers exact usage', () => {
    const chat = useChatStore()
    // a prior completed turn with exact usage…
    chat.messages = [
      { id: 'a1', role: 'assistant', content: 'done', status: 'done', usage: { total_tokens: 4000, cost_usd: 0.01 } },
    ]
    // …plus a live streaming turn: no usage yet, but the shared timeline's token counter ticks via a
    // token_usage event routed through the real _onEvent pipeline.
    chat._beginAssistant()
    chat._onEvent({ type: 'token_usage', total_tokens: 1200, cost_usd: 0.004 })
    expect(chat.sessionTokens).toBe(5200)            // 4000 exact + 1200 live
    expect(chat.sessionCost).toBeCloseTo(0.014, 5)
    // when the turn completes, exact usage wins over the (now stale) live counter
    const cur = chat.messages[chat.messages.length - 1]
    cur.usage = { total_tokens: 1300, cost_usd: 0.005 }
    cur.status = 'done'
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

describe('useChatStore — run_usage replaces the answer rounds with everything the run paid for', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('conv 1689: 86.9k shown becomes the billed total, on the message it names', () => {
    const chat = useChatStore()
    chat.messages = [
      { id: 'a0', serverId: 900, role: 'assistant', content: 'earlier', usage: { total_tokens: 10, cost_usd: 0.001 } },
      { id: 'a1', serverId: 901, runId: 'run-1', role: 'assistant', content: 'table', status: 'done',
        usage: { total_tokens: 86908, cost_usd: 0.18 } },
    ]
    chat._onEvent({ type: 'run_usage', run_id: 'run-1', message_id: 901,
      usage: { total_tokens: 1021000, cost_usd: 1.77, model_calls: 58, billed: true } })
    expect(chat.messages[1].usage.total_tokens).toBe(1021000)
    expect(chat.messages[1].usage.cost_usd).toBeCloseTo(1.77, 5)
    expect(chat.messages[0].usage.total_tokens).toBe(10)          // another turn is untouched
    expect(chat.sessionCost).toBeCloseTo(1.771, 5)
  })

  it('finds the message by run when the row id is not known yet', () => {
    const chat = useChatStore()
    chat.messages = [{ id: 'a1', runId: 'run-2', role: 'assistant', content: 'x', usage: { total_tokens: 5 } }]
    chat._onEvent({ type: 'run_usage', run_id: 'run-2', usage: { total_tokens: 500, billed: true } })
    expect(chat.messages[0].usage.total_tokens).toBe(500)
  })
})
