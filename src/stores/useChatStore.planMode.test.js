// @vitest-environment jsdom
// Plan mode (backend phase 4): the composer sends `turn_mode: "plan"`, the plan comes as a `plan_approval` card, it is
// answered with `hitl_response`, the run's older `plan_approval_required` for the same plan is display-only, and a
// call plan mode refused (`tool_blocked`, reason `plan_mode`) reads "Not run: plan mode only reads", never a failure.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import { usePlanStore } from './usePlanStore'

vi.mock('../services/api', () => ({
  default: {
    uploadConversationFile: vi.fn(() => Promise.resolve({ data: { id: 1 } })),
    startAgentChat: vi.fn(),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
  },
}))

const planCard = (over = {}) => ({
  type: 'hitl_request', request_id: 'pr1', conversation_id: 'c1', interaction_type: 'approval', response_type: 'choice',
  payload: {
    kind: 'plan_approval', request_id: 'pr1', run_id: 'run-9', plan_version_id: 'pv-3', conversation_id: 'c1',
    plan_file: { path: '.aadml/plans/plan.md', surface: 'lets_code', content: '# Plan\n\n1. Read' },
    steps: [{ id: 's1', description: 'Read the views' }],
    answers: [{ id: 'run_on_its_own', title: 'Run it on its own' }, { id: 'ask_before_each_change', title: 'Ask before each change' },
              { id: 'keep_planning', title: 'Keep planning' }],
    notes_answer: 'keep_planning', person_only: true,
    ...over,
  },
})

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

describe('plan mode: the card', () => {
  it('queues the plan_approval card with its payload and keeps the turn open', () => {
    const chat = useChatStore()
    chat.conversationId = 'c1'
    chat._beginAssistant()
    chat._onEvent(planCard())
    expect(chat.hitlRequests).toHaveLength(1)
    expect(chat.hitlRequests[0].payload.kind).toBe('plan_approval')
    expect(chat.awaitingApproval).toBe(true)
    expect(chat.isStreaming).toBe(true)
    expect(usePlanStore().isPlanModeRun('run-9')).toBe(true)
    expect(usePlanStore().isPlanModeRun(null, 'pv-3')).toBe(true)
  })

  it('the answer goes back as hitl_response with the answer id and the notes', () => {
    const chat = useChatStore()
    const sendHitlResponse = vi.fn()
    chat._conn = { sendHitlResponse }
    chat.conversationId = 'c1'
    chat._onEvent(planCard())
    chat.respondHitl({ request_id: 'pr1', response_value: 'keep_planning', feedback: 'tests first' })
    expect(sendHitlResponse).toHaveBeenCalledWith('pr1', 'keep_planning', 'tests first')
    expect(chat.hitlRequests).toHaveLength(0)
  })

  it('the old plan_approval_required for the same plan is display-only: no second card, no pause', () => {
    const chat = useChatStore()
    chat.conversationId = 'c1'
    chat._beginAssistant()
    chat._onEvent(planCard())
    chat._onEvent({ type: 'plan_approval_required', plan: { run_id: 'run-9', plan_version_id: 'pv-3', steps: [] } })
    expect(chat.pendingPlan).toBe(null)
    expect(chat.isStreaming).toBe(true)
    expect(chat.hitlRequests).toHaveLength(1)
  })

  it('arriving BEFORE the card in a plan-mode turn it is display-only too, and the card clears it', async () => {
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

  it('a plan card for another conversation is not shown here', () => {
    const chat = useChatStore()
    chat.conversationId = 'c2'
    chat._onEvent(planCard())
    expect(chat.hitlRequests).toHaveLength(0)
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
    expect(chat.liveHasFailures).toBe(false)
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

  it('a tool_blocked for another reason adds no plan-mode row', () => {
    const chat = useChatStore()
    chat.conversationId = 'c1'
    chat._beginAssistant()
    chat._onEvent({ type: 'tool_blocked', tool: 'X', reason: 'not_granted', conversation_id: 'c1' })
    expect(chat.liveSteps.some((s) => s.status === 'held')).toBe(false)
  })
})
