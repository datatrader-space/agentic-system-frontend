// @vitest-environment jsdom
// Inline plan artifact — chat store routes plan_event to the plan store + attaches a live anchor.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import { useChatStore } from './useChatStore'
import { usePlanStore } from './usePlanStore'

const frame = (over = {}) => ({
  type: 'plan_event', conversation_id: '5', event_id: 'e1', plan_id: 'p1', run_id: 'r1',
  plan_version: 1, sequence: 1, change_type: 'created',
  plan_view: {
    run_id: 'r1', conversation_id: 5, plan_id: 'p1', version_number: 1, latest_sequence: 1,
    title: 'P', plan_status: 'executing', plan_status_user: 'active',
    steps: [{ step_id: 'a', status: 'started', status_user: 'in_progress' }],
    total_step_count: 1, completed_step_count: 0, current_step_id: 'a',
  },
  ...over,
})

describe('useChatStore — plan_event routing', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('applies the snapshot and attaches a live anchor to the current assistant turn', () => {
    const chat = useChatStore()
    chat.conversationId = '5'
    chat.messages = [{ id: 'm2', role: 'assistant', content: '', planArtifacts: [] }]
    chat._onEvent(frame())
    const plan = usePlanStore()
    expect(plan.planFor('r1')).toBeTruthy()
    expect(chat.messages[0].planArtifacts).toEqual([{ plan_id: 'p1', run_id: 'r1', ordinal: 0 }])
    expect(chat.hasDurablePlanAnchors).toBe(true)
  })

  it('does not double-anchor the same plan on repeat frames', () => {
    const chat = useChatStore()
    chat.conversationId = '5'
    chat.messages = [{ id: 'm2', role: 'assistant', content: '', planArtifacts: [] }]
    chat._onEvent(frame())
    chat._onEvent(frame({ event_id: 'e2', sequence: 2 }))
    expect(chat.messages[0].planArtifacts.length).toBe(1)
  })

  it('ignores a plan_event for a different conversation', () => {
    const chat = useChatStore()
    chat.conversationId = '5'
    chat.messages = [{ id: 'm2', role: 'assistant', content: '', planArtifacts: [] }]
    chat._onEvent(frame({ conversation_id: '99' }))
    expect(chat.messages[0].planArtifacts.length).toBe(0)
    expect(usePlanStore().planFor('r1')).toBeNull()
  })
})

// THE DUPLICATE PLAN CARD — reported in conv 1542 and, until now, never reproduced.
//
// It was looked for in the run and the plan data and is not there: the run has ONE plan and one card's
// worth of state. The duplication is created here, on the client. The guard read `cur.planArtifacts` --
// the CURRENT message's own list -- so it could only notice a plan anchored twice to the SAME message.
// A Work run sends a plan_event per segment and each segment produces a NEW assistant message, so on
// segment 2 `cur` is a different message, its list is empty, and the same plan_id is anchored again.
// One plan, two anchors, two cards.
describe('useChatStore — one plan is anchored exactly once', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const anchorsFor = (chat, pid) => chat.messages
    .flatMap((m) => (m.planArtifacts || []))
    .filter((a) => a.plan_id === pid)

  it('does not re-anchor the same plan onto a LATER assistant message', () => {
    const chat = useChatStore()
    chat.conversationId = '5'
    chat.messages = [{ id: 'm1', role: 'assistant', content: '', planArtifacts: [] }]
    chat._onEvent(frame())                      // segment 1 anchors the plan on m1
    expect(anchorsFor(chat, 'p1')).toHaveLength(1)

    // Segment 2: a new assistant message becomes current and the SAME plan is announced again.
    chat.messages.push({ id: 'm2', role: 'assistant', content: '', planArtifacts: [] })
    chat._onEvent(frame({ sequence: 2, change_type: 'step_completed' }))

    expect(anchorsFor(chat, 'p1')).toHaveLength(1)
    expect(chat.messages[1].planArtifacts).toHaveLength(0)
  })

  it('keeps the anchor on the message that first carried it', () => {
    const chat = useChatStore()
    chat.conversationId = '5'
    chat.messages = [{ id: 'm1', role: 'assistant', content: '', planArtifacts: [] }]
    chat._onEvent(frame())
    chat.messages.push({ id: 'm2', role: 'assistant', content: '', planArtifacts: [] })
    chat._onEvent(frame({ sequence: 3 }))
    expect(chat.messages[0].planArtifacts[0].plan_id).toBe('p1')
  })

  it('still anchors a genuinely DIFFERENT plan', () => {
    // The fix must not collapse two real plans into one card.
    const chat = useChatStore()
    chat.conversationId = '5'
    chat.messages = [{ id: 'm1', role: 'assistant', content: '', planArtifacts: [] }]
    chat._onEvent(frame())
    chat._onEvent(frame({ plan_id: 'p2', run_id: 'r2',
                          plan_view: { ...frame().plan_view, plan_id: 'p2', run_id: 'r2' } }))
    expect(anchorsFor(chat, 'p1')).toHaveLength(1)
    expect(anchorsFor(chat, 'p2')).toHaveLength(1)
  })
})
