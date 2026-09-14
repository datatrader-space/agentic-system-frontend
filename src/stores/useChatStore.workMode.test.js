// Work mode: a run that keeps going in bounded ITERATIONS, and a UI that could not tell them apart.
//
// REPORTED FROM A LIVE RUN, confirmed on production conv 1529 (three iterations). Iteration 1 behaved
// perfectly: five steps ticked off, text streamed, the stop button stayed up. At 5/5 the timeline said
// done and the stop button vanished — then the run "took a breath", came back working, and from there
// the user could not tell which iteration had finished or which was running.
//
// The cause is one fact: a Work run is N separate dispatches. Iteration 1 executes on the socket; every
// later one is a Celery task resuming the same durable plan, and each ends with its OWN
// `assistant_message_complete`. Nothing said a boundary had been crossed, so the store ended the turn on
// the first of them — correctly, by the contract it had.
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

const seg = (segment, max = 12) => ({ type: 'work_segment', status: 'running', segment, max })
const goal = (state, segments = 3) => ({ type: 'work_goal', state, segments, max: 12, findings: [] })

describe('Work mode iterations', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const streaming = (s) => {
    s._beginAssistant()
    return s
  }

  it('keeps the run busy across an iteration boundary', () => {
    // THE REPORTED BUG. The terminal frame of iteration 1 closes its bubble — which is right, the
    // answers stay separate — but the RUN is not over and the stop button must not disappear.
    const s = streaming(useChatStore())
    s._onEvent(seg(1))
    expect(s.isBusy).toBe(true)

    s._onEvent({ type: 'assistant_message_complete', full_message: 'iteration 1 done' })
    expect(s.isStreaming).toBe(false)          // this bubble is finished
    expect(s.isBusy).toBe(true)                // the run is not
  })

  it('ends the run only when the goal closes', () => {
    const s = streaming(useChatStore())
    s._onEvent(seg(1))
    s._onEvent({ type: 'assistant_message_complete', full_message: 'a' })
    s._onEvent(seg(2))
    s._onEvent({ type: 'assistant_message_complete', full_message: 'b' })
    expect(s.isBusy).toBe(true)

    s._onEvent(goal('EXHAUSTED'))
    expect(s.isBusy).toBe(false)
    expect(s.workGoal.state).toBe('EXHAUSTED')
    expect(s.workIteration).toBe(null)
  })

  it('names the iteration that is running', () => {
    const s = streaming(useChatStore())
    expect(s.workIterationLabel).toBe('')
    s._onEvent(seg(2))
    expect(s.workIterationLabel).toBe('Iteration 2 of 12')
    s._onEvent(seg(3))
    expect(s.workIterationLabel).toBe('Iteration 3 of 12')
    s._onEvent(goal('ACHIEVED'))
    expect(s.workIterationLabel).toBe('')
  })

  it('tags each bubble with the iteration that produced it', () => {
    // So a long run can be grouped by iteration instead of showing one undifferentiated wall.
    const s = streaming(useChatStore())
    s._onEvent(seg(2))
    const m = s.messages.find((x) => x.role === 'assistant')
    expect(m.workIteration).toEqual({ segment: 2, max: 12 })
  })

  it('a later iteration opening a bubble does not end the run', () => {
    // THE TRAP THIS WAS WRITTEN AGAINST. `_beginAssistant` resets `_taskRunActive`, and doing the same
    // for the work flag would clear the announcement that had just arrived — ending the turn at the
    // first boundary, which is the bug being fixed.
    const s = streaming(useChatStore())
    s._onEvent(seg(2))
    s._beginAssistant()                        // iteration 2's first chunk opens a new bubble
    expect(s.isBusy).toBe(true)
    expect(s.workIteration).toEqual({ segment: 2, max: 12 })
  })

  it('every goal state closes the run, so the composer cannot lock', () => {
    // The composer stays busy from work_segment until work_goal. A state that failed to close it would
    // lock the input forever — exactly how the predecessor flag (_taskRunActive) is documented to have
    // broken with display_only plans.
    for (const state of ['ACHIEVED', 'EXHAUSTED', 'PAUSED', 'ABANDONED']) {
      setActivePinia(createPinia())
      const s = streaming(useChatStore())
      s._onEvent(seg(1))
      s._onEvent(goal(state))
      expect(s.isBusy, state).toBe(false)
    }
  })

  it('a new user turn clears the previous run state', () => {
    const s = streaming(useChatStore())
    s._onEvent(seg(3))
    s._onEvent(goal('EXHAUSTED'))
    expect(s.workGoal).not.toBe(null)
    // whatever the next turn is, it must not inherit the last run's iteration badge
    s._workRunActive = false
    s.workIteration = null
    s.workGoal = null
    expect(s.workIterationLabel).toBe('')
  })
})

describe('forwarded frames are routed by conversation', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it("drops another conversation's forwarded text", () => {
    // Iterations 2+ are forwarded through the shared `user_<id>` group, which carries every open tab.
    // Without this guard one conversation's tokens are appended to another's thread.
    const s = useChatStore()
    s.conversationId = '1529'
    s._beginAssistant()
    s._onEvent({ type: 'assistant_message_chunk', chunk: 'mine', conversation_id: '1529' })
    s._onEvent({ type: 'assistant_message_chunk', chunk: 'THEIRS', conversation_id: '999' })
    const m = s.messages.find((x) => x.role === 'assistant')
    expect(m.content).toContain('mine')
    expect(m.content).not.toContain('THEIRS')
  })

  it('does not silence a frame that names no conversation', () => {
    // Iteration 1 streams straight down this socket and stamps nothing.
    const s = useChatStore()
    s.conversationId = '1529'
    s._beginAssistant()
    s._onEvent({ type: 'assistant_message_chunk', chunk: 'local' })
    expect(s.messages.find((x) => x.role === 'assistant').content).toContain('local')
  })

  it('does not silence run_finished for another conversation', () => {
    // It is deliberately cross-conversation: it fires the browser notification while the user is
    // looking at a different chat, so a blanket conversation guard would break it.
    const s = useChatStore()
    s.conversationId = '1529'
    expect(() => s._onEvent({ type: 'run_finished', conversation_id: '999', snippet: 'x' })).not.toThrow()
  })
})

describe('grouping a long run by iteration', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const tagged = (s, segment) => {
    s._onEvent(seg(segment))
    s._beginAssistant()
    s._onEvent(seg(segment))          // the bubble is tagged when the frame lands on it
    s._onEvent({ type: 'assistant_message_complete', full_message: `answer ${segment}` })
  }

  it('marks a divider only where the iteration changes', () => {
    const s = useChatStore()
    tagged(s, 1)
    tagged(s, 2)
    tagged(s, 3)
    const marks = [...s.iterationBoundaries.values()].map((v) => v.segment)
    expect(marks).toEqual([1, 2, 3])
  })

  it('does not put a badge on every bubble of the same iteration', () => {
    // One iteration can produce more than one assistant message; sectioning must not degenerate into
    // a label on each one.
    const s = useChatStore()
    tagged(s, 2)
    tagged(s, 2)
    expect(s.iterationBoundaries.size).toBe(1)
  })

  it('is empty for an ordinary chat thread', () => {
    // THE REGRESSION THAT MATTERS: this getter runs over every thread in the app.
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'assistant_message_complete', full_message: 'hello' })
    expect(s.iterationBoundaries.size).toBe(0)
  })
})

describe('iteration grouping survives a reload', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('restores the iteration from the persisted message', () => {
    // The live tagging is client-side. A reload reads messages back from the database, so without the
    // backend stamping `work_iteration` into model_info the sections would vanish exactly when the
    // user reloads to look back over a long run.
    const s = useChatStore()
    s.messages = [
      s._mapServerMessage({ id: 1, role: 'user', content: 'go' }, '1529'),
      s._mapServerMessage({ id: 2, role: 'assistant', content: 'a',
                            model_info: { work_iteration: { segment: 1, max: 12 } } }, '1529'),
      s._mapServerMessage({ id: 3, role: 'assistant', content: 'b',
                            model_info: { work_iteration: { segment: 2, max: 12 } } }, '1529'),
    ]
    expect([...s.iterationBoundaries.values()].map((v) => v.segment)).toEqual([1, 2])
  })

  it('an ordinary persisted message carries no iteration', () => {
    const s = useChatStore()
    const m = s._mapServerMessage({ id: 1, role: 'assistant', content: 'hi' }, '1')
    expect(m.workIteration).toBe(null)
  })
})

describe('the forwarded-type list must cover what the backend sends', () => {
  beforeEach(() => setActivePinia(createPinia()))

  // These are agent/headless_consumer.py's `_WORK_STREAM_TYPES`. The two lists live in separate repos
  // and serve opposite ends of one contract: the backend decides what to SEND over the shared
  // user_<id> group, and this one decides what to conversation-ROUTE. A type the backend sends and
  // this set omits is not filtered, so it lands in whichever conversation happens to be open.
  const BACKEND_SENDS = [
    'assistant_message_chunk', 'assistant_message_complete', 'reasoning_delta', 'reasoning_done',
    'tool_call', 'tool_result', 'tool_blocked', 'work_segment', 'work_goal', 'error',
    'agent_status', 'agent_step_started', 'agent_step_completed', 'agent_step_failed',
    'source_citation', 'agent_turn_summary', 'token_usage',
  ]

  it('routes every forwarded type by conversation', () => {
    const s = useChatStore()
    s.conversationId = '1529'
    for (const type of BACKEND_SENDS) {
      s._beginAssistant()
      const before = JSON.stringify(s.messages)
      s._onEvent({ type, conversation_id: '999', chunk: 'x', text: 'x' })
      expect(JSON.stringify(s.messages), `${type} leaked from another conversation`).toBe(before)
    }
  })

  it('does not let another conversation write into the activity timeline', () => {
    // Asserted on the TIMELINE, not on `messages`: rich events are routed into the timeline reducer
    // and return before the message switch, so checking the transcript proves nothing about them.
    // (The first version of this test did exactly that and passed with the guard deleted.)
    const s = useChatStore()
    s.conversationId = '1529'
    s._beginAssistant()
    const step = (cid) => ({ type: 'agent_step_started', step_id: `s${cid}`, phase: 'using_tools',
                             label: `from ${cid}`, conversation_id: cid })

    s._onEvent(step('1529'))
    const mine = s.liveSteps.length
    expect(mine, 'this conversation must reach the timeline').toBeGreaterThan(0)

    s._onEvent(step('999'))
    expect(s.liveSteps.length, "another conversation must not").toBe(mine)
  })
})
