// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the API client before importing the store (hoisted so it exists at mock time).
const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../services/api', () => ({ default: mockApi }))

import { usePlanStore } from './usePlanStore'

const snap = (over = {}) => ({
  run_id: 'system_b:5', conversation_id: 5, revision: 4, latest_sequence: 4,
  plan_version_id: '5:v1', version_number: 1, title: 'P', plan_status: 'pending_approval',
  approval_status: 'pending', approval_required: true, execution_allowed: false,
  available_actions: ['approve', 'reject', 'request_changes'],
  steps: [{ step_id: 'a', status: 'pending' }, { step_id: 'b', status: 'pending' }],
  total_step_count: 2, completed_step_count: 0, current_step_id: 'a', ...over,
})

describe('usePlanStore', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = usePlanStore()
    mockApi.get.mockReset(); mockApi.post.mockReset()
  })

  it('hydrates a run and tracks it by conversation', async () => {
    mockApi.get.mockResolvedValueOnce({ data: snap() })
    await store.hydrateRun('system_b:5')
    expect(store.planFor('system_b:5').title).toBe('P')
    expect(store.hydrationStatusByRunId['system_b:5']).toBe('ready')
    expect(store.activeRunIdsByConversation['5']).toContain('system_b:5')
  })

  it('supports multiple runs in one conversation', async () => {
    mockApi.get.mockResolvedValueOnce({ data: snap({ run_id: 'system_a:1', conversation_id: 7 }) })
    mockApi.get.mockResolvedValueOnce({ data: snap({ run_id: 'system_b:2', conversation_id: 7 }) })
    await store.hydrateRun('system_a:1')
    await store.hydrateRun('system_b:2')
    expect(store.runsForConversation(7).length).toBe(2)
  })

  it('applies a newer event and dedups repeats', () => {
    store._applySnapshot(snap())
    expect(store.applyEvent({ type: 'plan_step_started', step_uid: 'a', sequence_number: 5 }, 'system_b:5')).toBe('applied')
    // duplicate delivery
    expect(store.applyEvent({ type: 'plan_step_started', step_uid: 'a', sequence_number: 5 }, 'system_b:5')).toBe('duplicate')
    expect(store.latestSequenceByRunId['system_b:5']).toBe(5)
  })

  it('ignores older events (snapshot already reflects them)', () => {
    store._applySnapshot(snap({ latest_sequence: 10 }))
    expect(store.applyEvent({ type: 'plan_step_completed', step_uid: 'a', sequence_number: 3 }, 'system_b:5')).toBe('duplicate')
  })

  it('detects a sequence gap and refetches the snapshot', async () => {
    mockApi.get.mockResolvedValue({ data: snap({ latest_sequence: 9 }) })
    store._applySnapshot(snap({ latest_sequence: 4 }))
    const r = store.applyEvent({ type: 'plan_step_completed', step_uid: 'b', sequence_number: 9 }, 'system_b:5')
    expect(r).toBe('gap')
    expect(mockApi.get).toHaveBeenCalled() // rehydrate triggered
  })

  it('reduces step completion optimistically', () => {
    store._applySnapshot(snap({ plan_status: 'executing', approval_status: 'approved' }))
    store.applyEvent({ type: 'plan_step_completed', step_uid: 'a', sequence_number: 5 }, 'system_b:5')
    const p = store.planFor('system_b:5')
    expect(p.steps.find((s) => s.step_id === 'a').status).toBe('completed')
    expect(p.completed_step_count).toBe(1)
    expect(p.current_step_id).toBe('b')
  })

  it('decide() posts version+revision+idempotency and applies returned snapshot', async () => {
    store._applySnapshot(snap())
    mockApi.post.mockResolvedValueOnce({ data: { ok: true, plan_view: snap({ plan_status: 'executing', approval_status: 'approved', available_actions: [] }) } })
    const res = await store.decide('system_b:5', 'approve')
    expect(res.ok).toBe(true)
    const body = mockApi.post.mock.calls[0][1]
    expect(body.expected_revision).toBe(4)
    expect(body.plan_version_id).toBe('5:v1')
    expect(body.idempotency_key).toContain('approve')
    expect(store.planFor('system_b:5').approval_status).toBe('approved')
  })

  it('decide() 409 conflict refreshes the snapshot instead of applying', async () => {
    store._applySnapshot(snap())
    const err = { response: { status: 409, data: { conflict: true, plan_view: snap({ revision: 8, approval_status: 'approved', available_actions: [] }) } } }
    mockApi.post.mockRejectedValueOnce(err)
    const res = await store.decide('system_b:5', 'approve')
    expect(res.conflict).toBe(true)
    expect(store.planFor('system_b:5').revision).toBe(8) // refreshed
  })

  it('ingestWsEvent applies when the event carries a run_id', () => {
    store._applySnapshot(snap({ plan_status: 'executing', approval_status: 'approved' }))
    const r = store.ingestWsEvent({ type: 'plan_step_completed', step_uid: 'a', sequence_number: 5, run_id: 'system_b:5' }, 5)
    expect(r).toBe('applied')
  })

  it('ingestWsEvent schedules a hydrate for legacy events lacking a run_id', () => {
    mockApi.get.mockResolvedValue({ data: { runs: [] } })
    const r = store.ingestWsEvent({ type: 'plan_approved' }, 5)
    expect(r).toBe('hydrate_scheduled')
  })

  it('ingestWsEvent ignores non-plan events', () => {
    expect(store.ingestWsEvent({ type: 'assistant_message_chunk' }, 5)).toBe('ignored')
  })

  it('prevents double submission while a decision is pending', async () => {
    store._applySnapshot(snap())
    let resolve
    mockApi.post.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const p1 = store.decide('system_b:5', 'approve')
    const r2 = await store.decide('system_b:5', 'approve') // second while first pending
    expect(r2.status).toBe('busy')
    resolve({ data: { ok: true, plan_view: snap() } })
    await p1
  })
})
