import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

describe('useChatStore — full-document cost gate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const gateEvent = (over = {}) => ({
    type: 'full_doc_cost_approval',
    conversation_id: 'c1',
    question: 'give me every requirement in Spec.pdf',
    reason: 'context_overflow',
    cost: { enumerated_tokens: 180000, context_window_tokens: 40000, batch_count: 15,
            chunk_count: 120, est_cost_usd: 0.42 },
    actions: [{ id: 'approve' }, { id: 'reject' }, { id: 'focus' }],
    ...over,
  })

  it('surfaces the cost gate on full_doc_cost_approval (scoped to this conversation)', () => {
    const chat = useChatStore()
    chat.conversationId = 'c1'
    chat._onEvent(gateEvent())
    expect(chat.fullDocCostGate).toBeTruthy()
    expect(chat.fullDocCostGate.cost.batch_count).toBe(15)
    expect(chat.fullDocCostGate.question).toContain('Spec.pdf')
  })

  it('ignores a cost gate meant for a different conversation', () => {
    const chat = useChatStore()
    chat.conversationId = 'c1'
    chat._onEvent(gateEvent({ conversation_id: 'other' }))
    expect(chat.fullDocCostGate).toBeNull()
  })

  it('approve re-sends the original question with an approve decision and clears the gate', () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.conversationId = 'c1'
    chat.selectedAgentId = 7
    chat._onEvent(gateEvent())
    chat.resolveFullDocCost('approve')
    expect(chat.fullDocCostGate).toBeNull()
    expect(sendMessage).toHaveBeenCalledWith(
      'give me every requirement in Spec.pdf', 7, null,
      { ragCostDecision: { decision: 'approve', focus_query: undefined } },
    )
  })

  it('reject re-sends the original question with a reject decision (targeted downgrade)', () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.conversationId = 'c1'
    chat.selectedAgentId = 7
    chat._onEvent(gateEvent())
    chat.resolveFullDocCost('reject')
    expect(sendMessage).toHaveBeenCalledWith(
      'give me every requirement in Spec.pdf', 7, null,
      { ragCostDecision: { decision: 'reject', focus_query: undefined } },
    )
  })

  it('focus shows the focused question as a user turn and sends it as the decision', () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.conversationId = 'c1'
    chat.selectedAgentId = 7
    chat._onEvent(gateEvent())
    chat.resolveFullDocCost('focus', 'what is the refund window?')
    expect(chat.messages.some((m) => m.role === 'user' && m.content === 'what is the refund window?')).toBe(true)
    expect(sendMessage).toHaveBeenCalledWith(
      'what is the refund window?', 7, null,
      { ragCostDecision: { decision: 'focus', focus_query: 'what is the refund window?' } },
    )
  })

  it('reset clears the cost gate', () => {
    const chat = useChatStore()
    chat.fullDocCostGate = { question: 'x', cost: {} }
    chat.reset()
    expect(chat.fullDocCostGate).toBeNull()
  })
})
