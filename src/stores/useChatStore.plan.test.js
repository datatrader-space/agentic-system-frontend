import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore, PLAN_APPROVED_CONTINUE } from './useChatStore'

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

  it('plan_approved resumes by carrying out the approved plan, not by repeating the request', () => {
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
    expect(sendMessage).toHaveBeenCalledWith(PLAN_APPROVED_CONTINUE, 7, null, { continuation: 'plan_approval' })
    expect(sendMessage).not.toHaveBeenCalledWith('Deploy the new script', 7)
  })

  it('one approval starts the plan once, and shows as an approval, not a user bubble', () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.conversationId = 'c1'
    chat.selectedAgentId = 7
    chat.messages = [
      { id: 'm1', role: 'user', content: 'Count the issues' },
      { id: 'm2', role: 'assistant', content: '' },
    ]
    chat.pendingPlan = { title: 'plan' }
    chat._onEvent({ type: 'plan_approved', plan: {} })
    chat._onEvent({ type: 'plan_approved', plan: {} })     // the same approval announced again
    expect(sendMessage).toHaveBeenCalledTimes(1)
    const approvals = chat.messages.filter((m) => m.kind === 'plan_approval')
    expect(approvals).toHaveLength(1)
  })

  it('a refused resume takes back the approval row and the empty bubble it opened', () => {
    const chat = useChatStore()
    chat._conn = { sendMessage: vi.fn() }
    chat.conversationId = 'c1'
    chat.messages = [{ id: 'm1', role: 'user', content: 'Count the issues' },
                     { id: 'm2', role: 'assistant', content: '' }]
    chat._onEvent({ type: 'plan_approved', plan: {} })
    expect(chat.messages).toHaveLength(4)
    chat._onEvent({ type: 'plan_resume_refused', conversation_id: 'c1' })
    expect(chat.messages.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(chat.isStreaming).toBe(false)
  })

  it('a paused plan reads as awaiting approval, and a running one does not', () => {
    const chat = useChatStore()
    chat.pendingPlan = { title: 'plan' }
    expect(chat.planAwaitingApproval).toBe(true)
    chat.pendingPlan = null
    expect(chat.planAwaitingApproval).toBe(false)
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
