import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

describe('useChatStore — Manual Mode plan approval (v3 Layer 2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('surfaces the pending plan on plan_approval_required', () => {
    const chat = useChatStore()
    const plan = { title: 'Migrate auth', phases: [{ phase_number: 1, title: 'Read config' }] }
    chat._onEvent({ type: 'plan_approval_required', plan })
    expect(chat.pendingPlan).toEqual(plan)
  })

  it('approvePlan sends the decision over the connection and clears the card', () => {
    const chat = useChatStore()
    const sendPlanDecision = vi.fn()
    chat._conn = { sendPlanDecision }
    chat.pendingPlan = { title: 'x' }
    chat.approvePlan()
    expect(sendPlanDecision).toHaveBeenCalledWith('approve')
    expect(chat.pendingPlan).toBeNull()
  })

  it('rejectPlan sends reject and clears the card', () => {
    const chat = useChatStore()
    const sendPlanDecision = vi.fn()
    chat._conn = { sendPlanDecision }
    chat.pendingPlan = { title: 'x' }
    chat.rejectPlan()
    expect(sendPlanDecision).toHaveBeenCalledWith('reject')
    expect(chat.pendingPlan).toBeNull()
  })

  it('plan_approved resumes by re-sending the last user message', () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.conversationId = 'c1'
    chat.selectedAgentId = 7
    chat.messages = [
      { id: 'm1', role: 'user', content: 'Deploy the new script' },
      { id: 'm2', role: 'assistant', content: '' },
    ]
    chat.pendingPlan = { title: 'plan' }
    chat._onEvent({ type: 'plan_approved', plan: {} })
    expect(chat.pendingPlan).toBeNull()
    expect(sendMessage).toHaveBeenCalledWith('Deploy the new script', 7)
  })

  it('plan_rejected clears the card and does not resume', () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.messages = [{ id: 'm1', role: 'user', content: 'do it' }]
    chat.pendingPlan = { title: 'plan' }
    chat._onEvent({ type: 'plan_rejected' })
    expect(chat.pendingPlan).toBeNull()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('revisePlan sends revise + feedback and clears the card', () => {
    const chat = useChatStore()
    const sendPlanDecision = vi.fn()
    chat._conn = { sendPlanDecision }
    chat.pendingPlan = { title: 'x' }
    chat.revisePlan('just connect — skip the health checks')
    expect(sendPlanDecision).toHaveBeenCalledWith('revise', 'just connect — skip the health checks')
    expect(chat.pendingPlan).toBeNull()
  })

  it('plan_revise resumes with the feedback as the next user instruction', () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.conversationId = 'c1'
    chat.selectedAgentId = 7
    chat.messages = [{ id: 'm1', role: 'user', content: 'connect to the ec2 server' }]
    chat.pendingPlan = { title: 'plan' }
    chat._onEvent({ type: 'plan_revise', feedback: 'skip the health checks' })
    expect(chat.pendingPlan).toBeNull()
    // feedback is shown as a user turn AND sent to re-plan
    expect(chat.messages.some((m) => m.role === 'user' && m.content === 'skip the health checks')).toBe(true)
    expect(sendMessage).toHaveBeenCalledWith('skip the health checks', 7)
  })

  it('reset clears any pending plan', () => {
    const chat = useChatStore()
    chat.pendingPlan = { title: 'x' }
    chat.reset()
    expect(chat.pendingPlan).toBeNull()
  })
})
