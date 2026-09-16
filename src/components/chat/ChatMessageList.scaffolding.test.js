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
