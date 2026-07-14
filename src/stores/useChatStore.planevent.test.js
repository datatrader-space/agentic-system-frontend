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
