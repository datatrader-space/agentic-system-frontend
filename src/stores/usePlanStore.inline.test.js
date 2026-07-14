// @vitest-environment jsdom
// Inline plan artifact — pushed plan_event application (version+sequence gating, dedup, gap→reconcile).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../services/api', () => ({ default: mockApi }))

import { usePlanStore } from './usePlanStore'

const view = (over = {}) => ({
  run_id: 'system_b:5', conversation_id: 5, plan_id: 'p1', version_number: 1, latest_sequence: 1,
  title: 'P', plan_status: 'executing', plan_status_user: 'active',
  steps: [{ step_id: 'a', status: 'started', status_user: 'in_progress' },
    { step_id: 'b', status: 'pending', status_user: 'pending' }],
  total_step_count: 2, completed_step_count: 0, current_step_id: 'a', ...over,
})
const ev = (over = {}) => {
  const { plan_view: pv, ...rest } = over
  const seq = rest.sequence ?? 1
  return {
    type: 'plan_event', conversation_id: 5, plan_id: 'p1', run_id: 'system_b:5',
    change_type: 'created', plan_version: rest.plan_version ?? 1, sequence: seq,
    event_id: rest.event_id ?? `e${seq}`,
    ...rest,
    // build LAST so the full snapshot is never clobbered; default latest_sequence tracks the event seq
    plan_view: view({ latest_sequence: seq, ...(pv || {}) }),
  }
}

describe('usePlanStore.applyPlanEvent', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = usePlanStore()
    mockApi.get.mockReset(); mockApi.post.mockReset()
  })

  it('applies the full committed snapshot and tracks by conversation', () => {
    expect(store.applyPlanEvent(ev())).toBe('applied')
    const p = store.planFor('system_b:5')
    expect(p.title).toBe('P')
    expect(p.plan_status_user).toBe('active')
    expect(store.activeRunIdsByConversation['5']).toContain('system_b:5')
  })

  it('dedups by event_id', () => {
    store.applyPlanEvent(ev())
    expect(store.applyPlanEvent(ev())).toBe('duplicate')
  })

  it('ignores an older event (never regresses)', () => {
    store.applyPlanEvent(ev({ sequence: 2, plan_view: { completed_step_count: 1 } }))
    // an older sequence for the same version must not overwrite the newer snapshot
    const res = store.applyPlanEvent(ev({ sequence: 1, event_id: 'old', plan_view: { completed_step_count: 0 } }))
    expect(res).toBe('ignored')
    expect(store.planFor('system_b:5').completed_step_count).toBe(1)
  })

  it('applies a newer event within the same version', () => {
    store.applyPlanEvent(ev({ sequence: 1 }))
    const res = store.applyPlanEvent(ev({
      sequence: 2, event_id: 'e2',
      plan_view: { latest_sequence: 2, completed_step_count: 1,
        steps: [{ step_id: 'a', status: 'completed', status_user: 'completed' },
          { step_id: 'b', status: 'started', status_user: 'in_progress' }] },
    }))
    expect(res).toBe('applied')
    expect(store.planFor('system_b:5').completed_step_count).toBe(1)
  })

  it('a sequence gap triggers a reconcile hydrate', () => {
    mockApi.get.mockResolvedValueOnce({ data: view({ latest_sequence: 3, completed_step_count: 2 }) })
    store.applyPlanEvent(ev({ sequence: 1 }))
    const res = store.applyPlanEvent(ev({ sequence: 3, event_id: 'e3', plan_view: { latest_sequence: 3 } }))
    expect(res).toBe('applied')                        // the committed view is still applied
    expect(mockApi.get).toHaveBeenCalledTimes(1)       // …and a reconcile hydrate was fired
    expect(mockApi.get.mock.calls[0][0]).toContain('/run-coordinator/runs/')
  })

  it('reconcileConversation posts to the reconcile endpoint', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { created: 1, anchored_plan_ids: ['p1'] } })
    const r = await store.reconcileConversation(5)
    expect(mockApi.post).toHaveBeenCalledWith('/run-coordinator/conversations/5/reconcile-anchors/')
    expect(r.created).toBe(1)
  })

  it('exposes connState for the reconnecting indicator', () => {
    store.applyPlanEvent(ev())
    expect(store.connStateFor('system_b:5')).toBe('ready')
    expect(store.connStateFor('missing')).toBe('idle')
  })
})
