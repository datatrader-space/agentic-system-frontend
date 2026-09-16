// @vitest-environment jsdom
// A work run's continuation prompt is scaffolding, not something the user said.
//
// PRODUCTION conv 1561 (2026-09-16): a Wall Detection Agent work run spent three segments, and each
// continuation was persisted as a role='user' row. The thread then drew
//   "Continue the task you were working on in this conversation. … DO THE NEXT PIECE OF WORK; …"
// as the operator's own blue bubble — twice — between the answers. The operator typed none of it.
//
// The server now stamps those rows `model_info.authored_by = 'system'` (agent/headless_consumer.py) and
// the store maps it to `authoredBy`. The list declines to draw a bubble for them. Everything else about
// the row survives: a plan anchored to it still renders in place.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../../stores/useChatStore'
import ChatMessageList from './ChatMessageList.vue'

class FakeResizeObserver { observe() {} disconnect() {} }

function mountWith(messages) {
  setActivePinia(createPinia())
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  const chat = useChatStore()
  chat.messages = messages
  return mount(ChatMessageList, {
    global: { stubs: { ChatMessage: true, InlinePlanArtifact: true, WorkIterationBar: true } },
  })
}

const drawnIds = (w) => w.findAllComponents({ name: 'ChatMessage' }).map((c) => c.props('message').id)

describe('ChatMessageList — run scaffolding', () => {
  it('does not draw a system-authored continuation as the user\'s bubble', () => {
    const w = mountWith([
      { id: 'u1', role: 'user', content: 'Detect the walls', status: 'done' },
      { id: 'a1', role: 'assistant', content: 'attempt 1', status: 'done' },
      { id: 'u2', role: 'user', content: 'Continue the task… DO THE NEXT PIECE OF WORK', status: 'done', authoredBy: 'system' },
      { id: 'a2', role: 'assistant', content: 'attempt 2', status: 'done' },
    ])
    const ids = drawnIds(w)
    expect(ids).not.toContain('u2')
    expect(ids).toEqual(['u1', 'a1', 'a2'])
  })

  it('still draws every message the user actually wrote', () => {
    // Absent marker == the user's own words. Rows written before the marker existed carry none, so an
    // old thread must render exactly as it always did.
    const w = mountWith([
      { id: 'u1', role: 'user', content: 'hi', status: 'done' },
      { id: 'u2', role: 'user', content: 'again', status: 'done', authoredBy: 'user' },
    ])
    expect(drawnIds(w)).toEqual(['u1', 'u2'])
  })

  it('only hides USER rows — an assistant row is never suppressed by the marker', () => {
    const w = mountWith([
      { id: 'a1', role: 'assistant', content: 'answer', status: 'done', authoredBy: 'system' },
    ])
    expect(drawnIds(w)).toEqual(['a1'])
  })

  it('keeps a plan anchored to a suppressed row in place', () => {
    const w = mountWith([
      { id: 'u1', role: 'user', content: 'go', status: 'done' },
      {
        id: 'u2', role: 'user', content: 'continue', status: 'done', authoredBy: 'system',
        planArtifacts: [{ plan_id: 'p1', run_id: 'r1' }],
      },
    ])
    expect(drawnIds(w)).not.toContain('u2')
    expect(w.findAllComponents({ name: 'InlinePlanArtifact' })).toHaveLength(1)
  })
})

describe('ChatMessageList — a Work run with no plan anchor still gets its rail', () => {
  it('prod conv 1608 turn 2: the rail is drawn at the run’s first message, once', async () => {
    const { setActivePinia, createPinia } = await import('pinia')
    const { mount } = await import('@vue/test-utils')
    const { useChatStore } = await import('../../stores/useChatStore')
    const { usePlanStore } = await import('../../stores/usePlanStore')
    const ChatMessageList = (await import('./ChatMessageList.vue')).default
    setActivePinia(createPinia())
    const chat = useChatStore()
    const plan = usePlanStore()
    plan.plansByRunId.r2 = { run_id: 'r2', steps: [], work_goal: { state: 'ACHIEVED' } }
    chat.messages = [
      { id: 'u1', role: 'user', content: 'go' },
      { id: 'a1', role: 'assistant', content: 'one', runId: 'r2', turnModeResolved: 'work', status: 'done' },
      { id: 'a2', role: 'assistant', content: 'two', runId: 'r2', turnModeResolved: 'work', status: 'done' },
      { id: 'a3', role: 'assistant', content: 'chat', runId: 'r3', turnModeResolved: 'chat', status: 'done' },
    ]
    const w = mount(ChatMessageList, { global: { stubs: { ChatMessage: true, WorkIterationBar: true,
      InlinePlanArtifact: { props: ['runId'], template: '<div class="stub-rail" :data-run="runId" />' } } } })
    const rails = w.findAll('.stub-rail')
    expect(rails.map((r) => r.attributes('data-run'))).toEqual(['r2'])
  })
})

describe('ChatMessageList — one rail per run, even when its plan id changes', () => {
  it('prod conv 1627: two anchors of one run (placeholder plan id, then the real one) draw ONE rail', async () => {
    const { setActivePinia, createPinia } = await import('pinia')
    const { mount } = await import('@vue/test-utils')
    const { useChatStore } = await import('../../stores/useChatStore')
    const ChatMessageList = (await import('./ChatMessageList.vue')).default
    setActivePinia(createPinia())
    const chat = useChatStore()
    chat.messages = [
      { id: 'u1', role: 'user', content: 'go' },
      { id: 'a1', role: 'assistant', content: 'one', runId: 'r1', status: 'done',
        planArtifacts: [{ run_id: 'r1', plan_id: 'r1' }] },
      { id: 'a2', role: 'assistant', content: 'two', runId: 'r1', status: 'done',
        planArtifacts: [{ run_id: 'r1', plan_id: 'plan-real' }] },
      { id: 'a3', role: 'assistant', content: 'other run', runId: 'r2', status: 'done',
        planArtifacts: [{ run_id: 'r2', plan_id: 'p2' }] },
    ]
    const w = mount(ChatMessageList, { global: { stubs: { ChatMessage: true, WorkIterationBar: true,
      InlinePlanArtifact: { props: ['runId'], template: '<div class="stub-rail" :data-run="runId" />' } } } })
    expect(w.findAll('.stub-rail').map((r) => r.attributes('data-run'))).toEqual(['r1', 'r2'])
  })
})
