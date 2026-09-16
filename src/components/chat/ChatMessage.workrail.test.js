// @vitest-environment jsdom
//
// ORDINARY CHAT MUST RENDER EXACTLY AS IT DID BEFORE THE RAIL EXISTED.
//
// The Work rail replaces three surfaces for a Work run — the activity timeline, the iteration bar and
// the answer bubble all say what the rail now says in one place. The first wiring asked whether the
// CONVERSATION had a rail, and `usePlanStore.activeRunIdsByConversation` is append-only: `_track` adds
// a run and nothing ever removes one. So "this thread has a Work rail" was really "this thread has
// EVER run Work", and it stayed true for the life of the conversation. One Work run silently stripped
// the timeline and the answer off every ordinary chat turn that followed it in the same thread.
//
// These pin the boundary at the RUN, which is where the rail actually lives. The mixed-thread case is
// the regression; the two Work cases are what must keep working while it is fixed.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ChatMessage from './ChatMessage.vue'
import AgentActivityTimeline from '../AgentActivityTimeline.vue'
import { usePlanStore } from '../../stores/usePlanStore'
import { useChatStore } from '../../stores/useChatStore'

const CID = '1543'
const WORK_RUN = 'run_work'
const CHAT_RUN = 'run_chat'

function seedThread () {
  const plan = usePlanStore()
  // A Work run happened in this thread…
  plan.plansByRunId[WORK_RUN] = { run_id: WORK_RUN, steps: [], work_goal: { state: 'MET', outcome: 'x' } }
  // …and an ordinary run followed it in the SAME conversation.
  plan.plansByRunId[CHAT_RUN] = { run_id: CHAT_RUN, steps: [], work_goal: null }
  plan.activeRunIdsByConversation[CID] = [WORK_RUN, CHAT_RUN]
  useChatStore().conversationId = CID
}

function answer (extra = {}) {
  return {
    id: 'm1', role: 'assistant', status: 'complete', content: 'the answer',
    timeline: { steps: [{ label: 'Searching' }] }, toolCalls: [], planArtifacts: [],
    ...extra,
  }
}

const mountIt = (message) => mount(ChatMessage, {
  props: { message },
  global: { stubs: { TokenUsage: true, SourcesList: true, ProvenanceFooter: true } },
})

describe('ChatMessage — the rail claims its own run, and nothing else', () => {
  beforeEach(() => { setActivePinia(createPinia()); seedThread() })

  it('a CHAT turn keeps its activity timeline and its answer, even after a Work run in the same thread', () => {
    const w = mountIt(answer())
    expect(w.findComponent(AgentActivityTimeline).exists()).toBe(true)
    expect(w.find('.bubble.assistant').exists()).toBe(true)
  })

  it('a WORK turn defers to the rail — recognised by its durable plan anchor', () => {
    const w = mountIt(answer({ planArtifacts: [{ plan_id: 'p1', run_id: WORK_RUN }] }))
    expect(w.findComponent(AgentActivityTimeline).exists()).toBe(false)
    expect(w.find('.bubble.assistant').exists()).toBe(false)
  })

  it('a WORK turn from segment 2+ is recognised by work_iteration, which is all a reloaded thread has', () => {
    const w = mountIt(answer({ workIteration: { segment: 2, max: 3 } }))
    expect(w.findComponent(AgentActivityTimeline).exists()).toBe(false)
  })

  it('a WORK turn in flight is recognised by the run id stamped live from plan_event', () => {
    const w = mountIt(answer({ runId: WORK_RUN }))
    expect(w.findComponent(AgentActivityTimeline).exists()).toBe(false)
  })

  it('a message naming the ORDINARY run is left alone, though the thread also ran Work', () => {
    const w = mountIt(answer({ runId: CHAT_RUN, planArtifacts: [{ plan_id: 'p2', run_id: CHAT_RUN }] }))
    expect(w.findComponent(AgentActivityTimeline).exists()).toBe(true)
    expect(w.find('.bubble.assistant').exists()).toBe(true)
  })

  it('STREAMING draws no bubble on the rail either — the rail streams the answer itself', () => {
    // It used to keep the bubble while streaming, and the rail ALSO drew the same growing text, so a
    // Work answer appeared twice on screen until it finished (prod conv 1578, 24.4s).
    const w = mountIt(answer({ status: 'streaming', runId: WORK_RUN }))
    expect(w.find('.bubble.assistant').exists()).toBe(false)
  })
})

describe('ChatMessage — a Work message puts nothing above its rail', () => {
  beforeEach(() => { setActivePinia(createPinia()); seedThread() })

  it('no avatar, token line or actions — those belong at the end of the rail', () => {
    const w = mountIt(answer({ runId: WORK_RUN, usage: { total_tokens: 71400 } }))
    expect(w.find('[data-test="msg-on-rail"]').exists()).toBe(true)
    expect(w.find('.avatar').exists()).toBe(false)
    expect(w.find('.msg-actions').exists()).toBe(false)
    expect(w.findComponent({ name: 'TokenUsage' }).exists()).toBe(false)
  })

  it('shows one live status line until the run’s rail exists', () => {
    const w = mountIt(answer({ status: 'streaming', content: '', turnModeResolved: 'work' }))
    expect(w.find('[data-test="rail-pending"]').exists()).toBe(true)
    expect(w.findComponent(AgentActivityTimeline).exists()).toBe(false)
  })

  it('and nothing once the rail is there', () => {
    const w = mountIt(answer({ status: 'streaming', content: '', runId: WORK_RUN }))
    expect(w.find('[data-test="rail-pending"]').exists()).toBe(false)
  })

  it('a turn the user pinned to Work opens as Work, not as a chat timeline that is swapped out', () => {
    useChatStore().turnMode = 'work'
    const w = mountIt(answer({ status: 'streaming', content: '' }))
    expect(w.findComponent(AgentActivityTimeline).exists()).toBe(false)
  })

  it('an error is still shown', () => {
    const w = mountIt(answer({ runId: WORK_RUN, status: 'error', error: 'provider failed' }))
    expect(w.text()).toContain('provider failed')
  })
})

describe('ChatMessage — preparation is one line, not a card that gets swapped out', () => {
  beforeEach(() => { setActivePinia(createPinia()); seedThread() })

  const live = (rows) => { const c = useChatStore(); c.liveSteps.splice(0, c.liveSteps.length, ...rows) }
  const phase = (label) => ({ stepId: label, isPhase: true, phase: 'reasoning_x', label, status: 'ok' })

  it('while only status rows have arrived, the turn shows a single line', () => {
    live([phase('Analyzing your request'), phase('Loading tools')])
    const w = mountIt(answer({ status: 'streaming', content: '' }))
    expect(w.find('[data-test="preparing-line"]').exists()).toBe(true)
    expect(w.findComponent(AgentActivityTimeline).exists()).toBe(false)
  })

  it('a chat turn becomes the full card once real work starts', () => {
    live([phase('Analyzing your request'),
          { stepId: 't1', isPhase: false, phase: 'using_tools', label: 'Searching the web', status: 'running' }])
    const w = mountIt(answer({ status: 'streaming', content: '' }))
    expect(w.find('[data-test="preparing-line"]').exists()).toBe(false)
    expect(w.findComponent(AgentActivityTimeline).exists()).toBe(true)
  })

  it('reasoning is never hidden behind the line', () => {
    live([{ stepId: 'r', isPhase: true, phase: 'reasoning', label: 'Thinking', status: 'running', reasoningText: 'hmm' }])
    const w = mountIt(answer({ status: 'streaming', content: '' }))
    expect(w.find('[data-test="preparing-line"]').exists()).toBe(false)
  })
})

describe('ChatMessage — a Work answer whose rail never appeared is still shown', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('prod conv 1592: a finished Work-tagged answer with no run on screen renders as a normal bubble', () => {
    useChatStore().conversationId = '1592'
    const w = mountIt(answer({ status: 'done', turnModeResolved: 'work', workIteration: { segment: 1, max: 3 } }))
    expect(w.find('[data-test="msg-on-rail"]').exists()).toBe(false)
    expect(w.find('.bubble.assistant').exists()).toBe(true)
  })

  it('while it is still streaming it waits for the rail', () => {
    useChatStore().conversationId = '1592'
    const w = mountIt(answer({ status: 'streaming', content: 'x', turnModeResolved: 'work' }))
    expect(w.find('[data-test="msg-on-rail"]').exists()).toBe(true)
    expect(w.find('.bubble.assistant').exists()).toBe(false)
  })
})
