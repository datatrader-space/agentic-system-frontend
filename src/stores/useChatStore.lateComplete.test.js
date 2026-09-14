// Regression: a turn can send `assistant_message_complete` more than once, and the LAST one carries the
// real answer.
//
// `AssistantMessageComplete` is emitted from EIGHT places in the runtime — the finalize node, the
// stopped-turn node, the planning gate, the assistance path, execute_tools and three points in
// graph_runtime. A turn that crosses two of them sends the frame twice. The first call runs
// `_endAssistant()`, which sets `_assistantId = null`; `_cur()` then returns undefined and the SECOND
// frame was written into nothing.
//
// MEASURED, production conv 1524: a repair loop rendered twice over six model rounds, and the thread
// showed intermediate text until the user reloaded the page — at which point the real answer appeared
// instantly, because it had been in the database all along. `_endAssistant` already records the same
// symptom from conv 1466 and mitigates it, but only when the bubble is EMPTY; here the first frame had
// left stale text in it, so that rescue never fired.
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

describe('a second assistant_message_complete still lands', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const lastAssistant = (s) => [...s.messages].reverse().find((m) => m.role === 'assistant')

  it('overwrites intermediate text with the final answer', () => {
    const s = useChatStore()
    s._beginAssistant()

    s._onEvent({ type: 'assistant_message_complete', full_message: 'Rendering the walls…' })
    expect(lastAssistant(s).content).toBe('Rendering the walls…')
    expect(s.isStreaming).toBe(false)          // the turn ended, as it did before

    // The finalize node's frame, arriving after the bubble was released.
    s._onEvent({ type: 'assistant_message_complete', full_message: '{"status":"ok","walls":[…]}' })
    expect(lastAssistant(s).content).toBe('{"status":"ok","walls":[…]}')
  })

  it('carries the late frame usage and stop reason too', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'assistant_message_complete', full_message: 'first' })
    s._onEvent({
      type: 'assistant_message_complete', full_message: 'final',
      usage: { total_tokens: 4242 }, stop_reason: 'task_completed', confidence: 0.9,
    })
    const m = lastAssistant(s)
    expect(m.usage.total_tokens).toBe(4242)
    expect(m.stopReason).toBe('task_completed')
  })

  it('does not resurrect a turn — the composer stays unlocked', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'assistant_message_complete', full_message: 'first' })
    s._onEvent({ type: 'assistant_message_complete', full_message: 'final' })
    expect(s.isStreaming).toBe(false)
    expect(s._assistantId).toBe(null)
  })

  it('never writes onto an errored bubble', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._errAssistant('provider timed out')
    s._onEvent({ type: 'assistant_message_complete', full_message: 'late text' })
    expect(lastAssistant(s).content || '').not.toContain('late text')
    expect(lastAssistant(s).error).toBe('provider timed out')
  })

  it('the first frame still works normally on an ordinary turn', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'assistant_message_complete', full_message: 'the answer' })
    expect(lastAssistant(s).content).toBe('the answer')
    expect(s.isStreaming).toBe(false)
  })
})
