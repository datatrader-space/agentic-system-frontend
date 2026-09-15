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

  it('STREAMING keeps the bubble even on the rail — it is the only place the tokens are yet', () => {
    const w = mountIt(answer({ status: 'streaming', runId: WORK_RUN }))
    expect(w.find('.bubble.assistant').exists()).toBe(true)
  })
})
