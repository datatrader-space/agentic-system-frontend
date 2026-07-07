// Regression: a TASK/CRS run streams an `assistant_message_complete` after EVERY ReAct step, so the
// turn must NOT end on those — only on the real terminal signal (agent_session_complete /
// agent_event session_complete). Guards against the "Done · 2 steps while the agent is still running"
// bug. Also verifies the normal chat path still ends on assistant_message_complete.
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

describe('task-run turn completion', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('does NOT end the turn on per-step assistant_message_complete during a task run', () => {
    const s = useChatStore()
    s._beginAssistant()
    expect(s.isStreaming).toBe(true)

    // a multi-step task run begins (plan generated)
    s._onEvent({ type: 'agent_plan_generated', step_count: 13, plan: { steps: [] } })
    expect(s._taskRunActive).toBe(true)

    // step-0 narration "completes" — must keep the turn alive
    s._onEvent({ type: 'assistant_message_complete', full_message: 'Let me check the KB...' })
    expect(s.isStreaming).toBe(true)

    // another intermediate step — still alive
    s._onEvent({ type: 'assistant_message_complete', full_message: 'Now fetching the page...' })
    expect(s.isStreaming).toBe(true)

    // the REAL terminal signal ends the turn
    s._onEvent({ type: 'agent_event', event: 'session_complete', data: {} })
    expect(s.isStreaming).toBe(false)
    expect(s._taskRunActive).toBe(false)
  })

  it('ends the turn on the agent_session_complete type too', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'agent_planning', message: 'planning…' })
    expect(s._taskRunActive).toBe(true)
    s._onEvent({ type: 'assistant_message_complete', full_message: 'step text' })
    expect(s.isStreaming).toBe(true)
    s._onEvent({ type: 'agent_session_complete' })
    expect(s.isStreaming).toBe(false)
  })

  it('shows the LAST streamed message as the final answer', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'agent_plan_generated', step_count: 2, plan: { steps: [] } })
    s._onEvent({ type: 'assistant_message_complete', full_message: 'intermediate' })
    s._onEvent({ type: 'assistant_message_complete', full_message: 'FINAL ANSWER' })
    s._onEvent({ type: 'agent_session_complete' })
    const last = s.messages[s.messages.length - 1]
    expect(last.content).toBe('FINAL ANSWER')
    expect(last.status).toBe('done')
  })

  it('normal chat path (no task run) still ends on assistant_message_complete', () => {
    const s = useChatStore()
    s._beginAssistant()
    expect(s._taskRunActive).toBe(false)
    s._onEvent({ type: 'assistant_message_complete', full_message: 'Hi there!' })
    expect(s.isStreaming).toBe(false)
  })

  it('a new turn resets the task-run flag', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'agent_plan_generated', step_count: 1, plan: { steps: [] } })
    s._onEvent({ type: 'agent_session_complete' })
    expect(s._taskRunActive).toBe(false)
    s._beginAssistant()
    expect(s._taskRunActive).toBe(false)
    // now a plain chat turn must end normally
    s._onEvent({ type: 'assistant_message_complete', full_message: 'done' })
    expect(s.isStreaming).toBe(false)
  })
})
