// A Work run's later iterations must not overwrite earlier ones, a refresh must not remount the thread,
// and the composer must be released when the run is over. All three recorded live on production conv
// 1578 (2026-09-16).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../services/api', () => ({ default: { getConversation: vi.fn() } }))

import api from '../services/api'
import { useChatStore } from './useChatStore'
import { usePlanStore } from './usePlanStore'

const seg = (segment, max = 3) => ({ type: 'work_segment', status: 'running', segment, max })

describe('Work run flow', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('an iteration arriving after the previous bubble closed gets its OWN message', () => {
    const s = useChatStore()
    s.messages.push({ id: 'u1', role: 'user', content: 'do it' })
    s._beginAssistant()
    s._onEvent(seg(1))
    s._onEvent({ type: 'assistant_message_complete', full_message: 'attempt one' })
    // Segment 2 runs in the worker; its frames reach this tab with no live bubble.
    s._onEvent(seg(2))
    s._onEvent({ type: 'assistant_message_chunk', chunk: 'attempt ' })
    s._onEvent({ type: 'assistant_message_complete', full_message: 'attempt two' })
    const answers = s.messages.filter((m) => m.role === 'assistant').map((m) => m.content)
    expect(answers).toEqual(['attempt one', 'attempt two'])
    expect(s.messages.filter((m) => m.role === 'assistant').map((m) => m.workIteration.segment)).toEqual([1, 2])
  })

  it('a message is marked as a Work turn the moment its segment is announced', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent(seg(1))
    expect(s.messages.at(-1).turnModeResolved).toBe('work')
  })

  it('the new iteration inherits the run it belongs to', () => {
    const s = useChatStore()
    s._beginAssistant()
    s.messages.at(-1).runId = 'run_x'
    s._onEvent(seg(1))
    s._onEvent({ type: 'assistant_message_complete', full_message: 'one' })
    s._onEvent(seg(2))
    expect(s.messages.at(-1).runId).toBe('run_x')
  })

  it('a refresh keeps each message’s identity, so nothing remounts', async () => {
    const s = useChatStore()
    s.conversationId = '1578'
    s.messages = [
      { id: 'm1', role: 'user', content: 'do it' },
      { id: 'm2', role: 'assistant', content: 'attempt one', runId: 'run_x',
        planArtifacts: [{ plan_id: 'p', run_id: 'run_x' }], workIteration: { segment: 1, max: 3 } },
      { id: 'm3', role: 'assistant', content: 'attempt two', runId: 'run_x', workIteration: { segment: 2, max: 3 },
        timeline: { steps: [{ stepId: 's', label: 'Reading a web page' }] } },
    ]
    api.getConversation.mockResolvedValue({ data: { messages: [
      { id: 11, role: 'user', content: 'do it' },
      { id: 12, role: 'assistant', content: 'attempt one', model_info: {} },
      { id: 13, role: 'user', content: 'DO THE NEXT PIECE OF WORK', model_info: { authored_by: 'system' } },
      { id: 14, role: 'assistant', content: 'attempt two', model_info: {} },
    ] } })
    expect(await s._refreshHistory()).toBe(true)
    const ids = s.messages.map((m) => m.id)
    expect(ids[0]).toBe('m1')
    expect(ids[1]).toBe('m2')
    expect(ids[3]).toBe('m3')
    expect(ids[2]).not.toMatch(/^m[123]$/)
    // What only the live stream knew survives until the server carries it.
    expect(s.messages[1].planArtifacts).toEqual([{ plan_id: 'p', run_id: 'run_x' }])
    expect(s.messages[3].runId).toBe('run_x')
    expect(s.messages[3].workIteration).toEqual({ segment: 2, max: 3 })
    expect(s.messages[3].timeline.steps[0].label).toBe('Reading a web page')
  })

  it('a refresh never lends a message another one’s run when the two sides do not line up', async () => {
    const s = useChatStore()
    s.conversationId = '1578'
    s.messages = [
      { id: 'm1', role: 'user', content: 'latest question' },
      { id: 'm2', role: 'assistant', content: 'partial', runId: 'run_x' },
    ]
    api.getConversation.mockResolvedValue({ data: { messages: [
      { id: 1, role: 'user', content: 'older question' },
      { id: 2, role: 'assistant', content: 'older answer', model_info: {} },
      { id: 3, role: 'user', content: 'latest question' },
      { id: 4, role: 'assistant', content: 'final answer', model_info: {} },
    ] } })
    await s._refreshHistory()
    expect(s.messages[1].runId).toBe('')
    expect(s.messages[2].id).toBe('m1')
  })

  it('a plan snapshot showing the goal closed releases the Stop button', () => {
    const s = useChatStore()
    s.conversationId = '1578'
    s._beginAssistant()
    s._onEvent(seg(2))
    expect(s.isBusy).toBe(true)
    s._onEvent({ type: 'assistant_message_complete', full_message: 'done' })
    expect(s.isBusy).toBe(true)
    const plan = usePlanStore()
    plan.applyPlanEvent = (msg) => plan._applySnapshot(msg.plan_view)
    s._onEvent({ type: 'plan_event', conversation_id: '1578', run_id: 'run_x',
                 plan_view: { run_id: 'run_x', conversation_id: '1578', work_goal: { state: 'ACHIEVED' } } })
    expect(s.isBusy).toBe(false)
  })

  it('a late snapshot of an EARLIER run does not release the run going now', () => {
    const s = useChatStore()
    s.conversationId = '1578'
    const plan = usePlanStore()
    plan._applySnapshot({ run_id: 'old', conversation_id: '1578', work_goal: { state: 'ACHIEVED' } })
    plan._applySnapshot({ run_id: 'new', conversation_id: '1578', work_goal: { state: 'ACTIVE' } })
    s._beginAssistant()
    s._onEvent(seg(1))
    plan.applyPlanEvent = () => {}
    s._onEvent({ type: 'plan_event', conversation_id: '1578', run_id: 'old',
                 plan_view: { run_id: 'old', conversation_id: '1578', work_goal: { state: 'ACHIEVED' } } })
    expect(s.isBusy).toBe(true)
  })
})

describe('Parallel calls in the store', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('keeps the step the server attributed a call to, and puts its media on that call’s row', () => {
    const s = useChatStore()
    s.conversationId = '1588'
    const plan = usePlanStore()
    plan._applySnapshot({ run_id: 'r', conversation_id: '1588', run_status: 'executing', current_step_id: 'op_1',
                         work_goal: { state: 'ACTIVE' } })
    s._beginAssistant()
    s._onEvent({ type: 'work_segment', segment: 1, max: 3 })
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
    // A Work message does not grow an early "answer" out of the images; the final answer embeds them.
    expect(s.messages.at(-1).content).toBe('')
  })

  it('an ordinary chat turn still shows generated media live in its answer', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'tool_result', tool: 'GENERATE_IMAGE', success: true,
                 media_artifacts: [{ type: 'image', abs_url: 'https://x/media/a.png' }] })
    expect(s.messages.at(-1).content).toContain('https://x/media/a.png')
  })
})
