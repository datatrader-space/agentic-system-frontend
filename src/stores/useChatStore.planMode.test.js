// @vitest-environment jsdom
// Plan mode (backend phase 4; the plan as a message, owner 2026-11-19): the composer sends `turn_mode: "plan"`, the
// plan comes as the answer's file (`plan_ready`), the person answers it with a message and `plan_reply` says what it
// was, the run's older `plan_approval_required` for the same plan is display-only, and a call plan mode refused
// (`tool_blocked`, reason `plan_mode`) reads "Not run: plan mode only reads", never a failure.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import { usePlanReviewStore } from './usePlanReviewStore'

vi.mock('../services/api', () => ({
  default: {
    uploadConversationFile: vi.fn(() => Promise.resolve({ data: { id: 1 } })),
    startAgentChat: vi.fn(),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
  },
}))

const planReady = (over = {}) => ({
  type: 'plan_ready', message_id: 91, conversation_id: 'c1',
  plan_file: { path: 'docs/plans/2026-11-19-add-a-login-page-1a2b3c4d.md', surface: 'lets_code',
               content: '# Plan\n\n1. Read', run_id: 'run-9', plan_version_id: 'pv-3' },
  ...over,
})

function withAnswer(chat) {
  chat.conversationId = 'c1'
  chat.messages = [{ id: 'u1', role: 'user', content: 'plan it', status: 'done' },
                   { id: 'a1', serverId: 91, role: 'assistant', content: 'Two steps.', status: 'done' }]
}

beforeEach(() => {
  setActivePinia(createPinia())
  try { localStorage.clear() } catch (_e) { /* private */ }
})

describe('plan mode: sending', () => {
  it('a pinned Plan is sent as turn_mode "plan" on the chat_message', async () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.conversationId = 'c1'
    chat.selectedAgentId = 7
    chat.setTurnMode('plan')
    await chat.sendMessage('add a login page')
    expect(sendMessage).toHaveBeenCalledWith('add a login page', 7, null, expect.objectContaining({ turnMode: 'plan' }))
    expect(chat._planModeTurn).toBe(true)
  })

  it("Plan is the conversation's, kept by the server like Chat and Work, not by the browser", () => {
    useChatStore().setTurnMode('plan')
    setActivePinia(createPinia())
    expect(useChatStore().turnMode).toBe('chat')    // a fresh page reads the mode from the conversation it opens
  })
})

describe('plan mode: the plan as a message', () => {
  it('the saved answer gets its plan file, and the plan is shown for review with its run', () => {
    const chat = useChatStore()
    withAnswer(chat)
    chat._onEvent(planReady())
    expect(chat.messages[1].planFile.path).toBe('docs/plans/2026-11-19-add-a-login-page-1a2b3c4d.md')
    expect(chat.hitlRequests).toHaveLength(0)
    const review = usePlanReviewStore().forConversation('c1')
    expect(review).toMatchObject({ runId: 'run-9', path: 'docs/plans/2026-11-19-add-a-login-page-1a2b3c4d.md',
                                   content: '# Plan\n\n1. Read' })
  })

  it('opens the plan beside the chat by itself on a wide screen, not on a phone', () => {
    const wide = (on) => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: on })))
    wide(true)
    const chat = useChatStore()
    withAnswer(chat)
    chat._onEvent(planReady())
    expect(usePlanReviewStore().open).toBe(true)
    setActivePinia(createPinia())
    wide(false)
    const phone = useChatStore()
    withAnswer(phone)
    phone._onEvent(planReady())
    expect(usePlanReviewStore().open).toBe(false)
    expect(usePlanReviewStore().forConversation('c1')).not.toBe(null)   // its file card opens it
    vi.unstubAllGlobals()
  })

  it('a plan of another chat is never taken here', () => {
    const chat = useChatStore()
    withAnswer(chat)
    chat.conversationId = 'c2'
    chat._onEvent(planReady())
    expect(chat.messages[1].planFile).toBeUndefined()
    expect(usePlanReviewStore().forConversation('c1')).toBe(null)
  })

  it('a reloaded answer keeps its plan file (model_info.plan_file)', () => {
    const chat = useChatStore()
    const m = chat._mapServerMessage({ id: 91, role: 'assistant', content: 'Two steps.',
                                       model_info: { plan_file: { path: 'plans/r.md', content: '# P' } } }, 'c1')
    expect(m.planFile).toEqual({ path: 'plans/r.md', content: '# P' })
  })

  it('a reply that approved the plan leaves Plan mode; a change keeps it', () => {
    const chat = useChatStore()
    chat.conversationId = 'c1'
    chat.setTurnMode('plan')
    chat._onEvent({ type: 'plan_reply', decision: 'change', conversation_id: 'c1' })
    expect(chat.turnMode).toBe('plan')
    chat._onEvent({ type: 'plan_reply', decision: 'approve', conversation_id: 'c2' })
    expect(chat.turnMode).toBe('plan')
    chat._onEvent({ type: 'plan_reply', decision: 'approve', conversation_id: 'c1' })
    expect(chat.turnMode).toBe('chat')
  })

  it('the old plan_approval_required for the plan just given is display-only: no pause', () => {
    const chat = useChatStore()
    withAnswer(chat)
    chat._onEvent(planReady())
    chat._beginAssistant()
    chat._onEvent({ type: 'plan_approval_required', plan: { run_id: 'run-9', plan_version_id: 'pv-3', steps: [] } })
    expect(chat.pendingPlan).toBe(null)
    expect(chat.isStreaming).toBe(true)
  })

  it('arriving in a plan-mode turn before the plan it is display-only too', async () => {
    const chat = useChatStore()
    chat._conn = { sendMessage: vi.fn() }
    chat.conversationId = 'c1'
    chat.selectedAgentId = 7
    chat.setTurnMode('plan')
    await chat.sendMessage('plan it')
    chat._onEvent({ type: 'plan_approval_required', plan: { run_id: 'run-9' } })
    expect(chat.pendingPlan).toBe(null)
    expect(chat.isStreaming).toBe(true)
  })

  it('outside plan mode plan_approval_required still pauses the turn on its plan (unchanged)', () => {
    const chat = useChatStore()
    chat.conversationId = 'c1'
    chat._beginAssistant()
    chat._onEvent({ type: 'plan_approval_required', plan: { run_id: 'run-1', steps: [] } })
    expect(chat.pendingPlan).toEqual({ run_id: 'run-1', steps: [] })
    expect(chat.isStreaming).toBe(false)
  })
})

describe('plan mode: a refused call', () => {
  it('tool_blocked with reason plan_mode is a plain "Not run" step, not a failure', () => {
    const chat = useChatStore()
    chat.conversationId = 'c1'
    chat._beginAssistant()
    chat._onEvent({ type: 'agent_step_started', step_id: 'st1', phase: 'tool', label: 'Writing a file', tool: 'CODE_WRITE_FILE' })
    chat._onEvent({ type: 'tool_blocked', tool: 'CODE_WRITE_FILE', reason: 'plan_mode', conversation_id: 'c1' })
    chat._onEvent({ type: 'agent_step_failed', step_id: 'st1', label: 'Writing a file', reason: 'blocked' })
    const row = chat.liveSteps.find((s) => s.stepId === 'st1')
    expect(row.status).toBe('held')
    expect(row.reason).toBe('Not run: plan mode only reads')
    expect(chat._cur().error || '').toBe('')
  })

  it('without a running row for the call, a "Not run" row is added', () => {
    const chat = useChatStore()
    chat.conversationId = 'c1'
    chat._beginAssistant()
    chat._onEvent({ type: 'tool_blocked', tool: 'CODE_RUN_COMMAND', reason: 'plan_mode', conversation_id: 'c1' })
    const held = chat.liveSteps.filter((s) => s.status === 'held')
    expect(held).toHaveLength(1)
    expect(held[0].label).toBe('Not run: plan mode only reads')
  })

  it('a tool_blocked for another reason is a "Not run" row saying why, never a plan-mode one (ADM-1290)', () => {
    const chat = useChatStore()
    chat.conversationId = 'c1'
    chat._beginAssistant()
    chat._onEvent({ type: 'tool_blocked', tool: 'X', reason: 'not_granted', conversation_id: 'c1' })
    chat._onEvent({ type: 'tool_blocked', tool: 'Y', reason: 'blocked_by_policy', outcome: 'declined', conversation_id: 'c1' })
    expect(chat.liveSteps.filter((s) => s.status === 'held').map((s) => s.label))
      .toEqual(['Not run: blocked by a rule', "Not run: you didn't approve it"])
    expect(chat._cur().error || '').toBe('')
  })
})
