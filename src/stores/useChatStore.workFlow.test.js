// A refresh must not remount the thread (production conv 1578, 2026-09-16), parallel calls keep their step, and a
// run's plan events draw no plan card (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md) but still name the run of their message. (Work mode's iterations, which this file also pinned, went with Work mode in LONG_RUN phase 5.)
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../services/api', () => ({ default: { getConversationMessages: vi.fn() } }))

import api from '../services/api'
import { useChatStore } from './useChatStore'


describe('A refresh of the thread', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('a refresh keeps each message’s identity, so nothing remounts', async () => {
    const s = useChatStore()
    s.conversationId = '1578'
    s.messages = [
      { id: 'x1', role: 'user', content: 'do it' },
      { id: 'x2', role: 'assistant', content: 'attempt one', runId: 'run_x' },
      { id: 'x3', role: 'assistant', content: 'attempt two', runId: 'run_x',
        timeline: { steps: [{ stepId: 's', label: 'Reading a web page' }] } },
    ]
    api.getConversationMessages.mockResolvedValue({ data: { has_more: false, results: [
      { id: 11, role: 'user', content: 'do it' },
      { id: 12, role: 'assistant', content: 'attempt one', model_info: {} },
      { id: 13, role: 'user', content: 'DO THE NEXT PIECE OF WORK', model_info: { authored_by: 'system' } },
      { id: 14, role: 'assistant', content: 'attempt two', model_info: {} },
    ] } })
    expect(await s._refreshHistory()).toBe(true)
    const ids = s.messages.map((m) => m.id)
    expect(ids[0]).toBe('x1')
    expect(ids[1]).toBe('x2')
    expect(ids[3]).toBe('x3')
    expect(ids[2]).not.toMatch(/^x[123]$/)
    // What only the live stream knew survives until the server carries it.
    expect(s.messages[3].runId).toBe('run_x')
    expect(s.messages[3].timeline.steps[0].label).toBe('Reading a web page')
  })

  it('a refresh never lends a message another one’s run when the two sides do not line up', async () => {
    const s = useChatStore()
    s.conversationId = '1578'
    s.messages = [
      { id: 'm1', role: 'user', content: 'latest question' },
      { id: 'm2', role: 'assistant', content: 'partial', runId: 'run_x' },
    ]
    api.getConversationMessages.mockResolvedValue({ data: { has_more: false, results: [
      { id: 1, role: 'user', content: 'older question' },
      { id: 2, role: 'assistant', content: 'older answer', model_info: {} },
      { id: 3, role: 'user', content: 'latest question' },
      { id: 4, role: 'assistant', content: 'final answer', model_info: {} },
    ] } })
    await s._refreshHistory()
    expect(s.messages[1].runId).toBe('')
    expect(s.messages[2].id).toBe('m1')
  })

})

describe('Parallel calls in the store', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('keeps the step the server attributed a call to, and puts its media on that call’s row', () => {
    const s = useChatStore()
    s.conversationId = '1588'
    s._beginAssistant()
    for (const [id, step] of [['c1', 'op_1'], ['c2', 'op_2']]) {
      s._onEvent({ type: 'agent_step_started', step_id: `step_${id}`, tool_call_id: id, plan_step_id: step,
                   phase: 'using_tools', label: 'Generating an image' })
    }
    s._onEvent({ type: 'tool_result', tool: 'GENERATE_IMAGE', success: true, tool_call_id: 'c2', plan_step_id: 'op_2',
                 media_artifacts: [{ type: 'image', url: '/media/chilli.png', abs_url: 'https://x/media/chilli.png' }] })
    const rows = s.liveSteps.filter((r) => r.toolCallId)
    expect(rows.map((r) => r.planStepId)).toEqual(['op_1', 'op_2'])
    expect(rows[1].media).toEqual([{ url: '/media/chilli.png', type: 'image' }])
    expect(rows[0].media).toBeUndefined()
  })

  it('an ordinary chat turn still shows generated media live in its answer', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'tool_result', tool: 'GENERATE_IMAGE', success: true,
                 media_artifacts: [{ type: 'image', abs_url: 'https://x/media/a.png' }] })
    expect(s.messages.at(-1).content).toContain('https://x/media/a.png')
  })
})

describe('A run’s plan events', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('draw no plan card and add no rail row, but name the run of each message they reach', () => {
    const s = useChatStore()
    s.conversationId = '1627'
    s.setTurnMode('work')
    s._beginAssistant()
    s._onEvent({ type: 'plan_event', conversation_id: '1627', run_id: 'r1', plan_id: 'r1', event_id: 'e1' })
    s._onEvent({ type: 'assistant_message_complete', full_message: 'one' })
    s._beginAssistant()
    s._onEvent({ type: 'plan_event', conversation_id: '1627', run_id: 'r1', plan_id: 'plan-real', event_id: 'e2' })
    const answers = s.messages.filter((m) => m.role === 'assistant')
    expect(answers.map((m) => m.runId)).toEqual(['r1', 'r1'])
    expect(answers.some((m) => 'planArtifacts' in m)).toBe(false)
    expect(s.liveSteps.some((r) => r.isPlan)).toBe(false)
  })

  it('a plan event of another conversation names nothing here', () => {
    const s = useChatStore()
    s.conversationId = '1627'
    s._beginAssistant()
    s._onEvent({ type: 'plan_event', conversation_id: '99', run_id: 'r9', plan_id: 'p9', event_id: 'e9' })
    expect(s.messages.at(-1).runId).toBeUndefined()
  })
})
