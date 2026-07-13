// @vitest-environment jsdom
//
// CANONICAL PLAN API CONTRACT tests for usePlanStore.
//
// Purpose: prove the unified plan UI (usePlanStore + UnifiedPlanCard/Timeline) stays compatible
// with the canonical plan-snapshot contract the backend run_coordinator now emits. These tests
// drive the REAL store actions/mutations with canonical-shaped fixtures and assert resulting store
// state (not internals).
//
// The canonical() factory below emits the backend's canonical field names. The store, however,
// reads a few fields under DIFFERENT names. Rather than silently rename the store's contract
// (forbidden), we make the mismatch explicit and load-bearing via toStoreSnapshot(): it is the
// living spec of what the backend snapshot MUST provide for the current store to work. Any field
// the adapter has to remap is a name the backend must accommodate — see the header comment on
// toStoreSnapshot and the mismatch report returned to the caller.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../services/api', () => ({ default: mockApi }))

import { usePlanStore } from './usePlanStore'

// ── Canonical snapshot per the backend contract (canonical field names) ──────────────────────────
// run_id, conversation_id, plan_id, plan_version_id, version_number, revision, title, summary,
// run_mode, run_status, plan_status, approval_status, approval_required, execution_allowed,
// phases, steps[{ step_uid, id, title, description, status, order_index }], completed_count,
// total_count, current_step, available_actions, latest_sequence (reconnect cursor), timestamps.
const canonicalStep = (uid, over = {}) => ({
  step_uid: uid, id: uid, title: `Step ${uid.toUpperCase()}`, description: `Do ${uid}`,
  status: 'pending', order_index: uid.charCodeAt(0) - 97, ...over,
})

const canonical = (over = {}) => ({
  run_id: 'system_b:5', conversation_id: 5, plan_id: 42, plan_version_id: '42:v1',
  version_number: 1, revision: 4, title: 'Ship feature', summary: 'Do the thing',
  run_mode: 'planned', run_status: 'awaiting_approval', plan_status: 'pending_approval',
  approval_status: 'pending', approval_required: true, execution_allowed: false,
  phases: [],
  steps: [canonicalStep('a'), canonicalStep('b'), canonicalStep('c')],
  completed_count: 0, total_count: 3, current_step: 'a',
  available_actions: ['approve', 'reject', 'request_changes'],
  latest_sequence: 4,
  created_at: '2026-07-13T00:00:00Z', updated_at: '2026-07-13T00:00:00Z',
  ...over,
})

// ── Canonical → store field-name adapter (THE documented mismatch surface) ───────────────────────
// Maps the canonical snapshot onto the field names usePlanStore/UnifiedPlanCard actually read.
// Each remap here is a name the backend must ALSO emit (or rename to) for the current UI to work:
//   canonical.steps[].step_uid / .id  ->  step.step_id      (store _setStep + component :key)
//   canonical.completed_count         ->  completed_step_count
//   canonical.total_count             ->  total_count -> total_step_count
//   canonical.current_step            ->  current_step_id
// All other canonical fields (run_id, conversation_id, revision, latest_sequence, plan_version_id,
// version_number, plan_status, approval_status, execution_allowed, available_actions, title,
// summary) are consumed by the store UNDER THEIR CANONICAL NAMES and pass through untouched.
function toStoreSnapshot(snap) {
  return {
    ...snap,
    steps: (snap.steps || []).map((s) => ({
      step_id: s.step_uid ?? s.id,          // store identifies steps by step_id
      title: s.title, description: s.description, status: s.status,
      order_index: s.order_index,
    })),
    total_step_count: snap.total_count,
    completed_step_count: snap.completed_count,
    current_step_id: snap.current_step,
  }
}

// Live event in the canonical wire shape (carries run_id + sequence_number; step keyed by step_uid).
const evt = (type, over = {}) => ({ type, run_id: 'system_b:5', ...over })

const RID = 'system_b:5'

describe('usePlanStore — canonical plan API contract', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = usePlanStore()
    mockApi.get.mockReset(); mockApi.post.mockReset()
  })

  // hydrate a canonical snapshot into the store via the real hydrateRun action.
  async function hydrate(snap) {
    mockApi.get.mockResolvedValueOnce({ data: toStoreSnapshot(snap) })
    return store.hydrateRun(snap.run_id)
  }

  it('1. initial plan hydration exposes the canonical snapshot to the UI', async () => {
    await hydrate(canonical())
    const p = store.planFor(RID)
    expect(p.title).toBe('Ship feature')
    expect(p.plan_version_id).toBe('42:v1')
    expect(p.version_number).toBe(1)
    expect(store.hydrationStatusByRunId[RID]).toBe('ready')
    expect(store.activeRunIdsByConversation['5']).toContain(RID)
    // reconnect cursor seeded from latest_sequence
    expect(store.latestSequenceByRunId[RID]).toBe(4)
    // steps arrived with the store-consumed identity + ordered
    expect(p.steps.map((s) => s.step_id)).toEqual(['a', 'b', 'c'])
    expect(p.total_step_count).toBe(3)
  })

  it('2. awaiting approval: status + available_actions expose approve affordance', async () => {
    await hydrate(canonical())
    const p = store.planFor(RID)
    expect(p.plan_status).toBe('pending_approval')
    expect(p.approval_status).toBe('pending')
    expect(p.execution_allowed).toBe(false)
    expect(p.available_actions).toContain('approve')
  })

  it('3. approve -> executing transition (decision snapshot applied)', async () => {
    await hydrate(canonical())
    mockApi.post.mockResolvedValueOnce({
      data: { ok: true, plan_view: toStoreSnapshot(canonical({
        plan_status: 'executing', run_status: 'executing', approval_status: 'approved',
        execution_allowed: true, available_actions: [], revision: 5, latest_sequence: 5,
      })) },
    })
    const res = await store.decide(RID, 'approve')
    expect(res.ok).toBe(true)
    const body = mockApi.post.mock.calls[0][1]
    expect(body.decision).toBe('approve')
    expect(body.expected_revision).toBe(4)
    expect(body.plan_version_id).toBe('42:v1')
    expect(body.idempotency_key).toContain('approve')
    const p = store.planFor(RID)
    expect(p.plan_status).toBe('executing')
    expect(p.approval_status).toBe('approved')
    expect(p.execution_allowed).toBe(true)
    expect(p.available_actions).toEqual([])
  })

  it('4. request_changes -> new version increments version_number (new plan_version_id)', async () => {
    await hydrate(canonical())
    const before = store.planFor(RID)
    expect(before.version_number).toBe(1)
    const oldVersionId = before.plan_version_id
    mockApi.post.mockResolvedValueOnce({
      data: { ok: true, plan_view: toStoreSnapshot(canonical({
        version_number: 2, plan_version_id: '42:v2', revision: 6, latest_sequence: 6,
        plan_status: 'pending_approval', approval_status: 'pending',
        steps: [canonicalStep('a'), canonicalStep('b2'), canonicalStep('c'), canonicalStep('d')],
        total_count: 4,
      })) },
    })
    const res = await store.decide(RID, 'request_changes', { comment: 'add a step' })
    expect(res.ok).toBe(true)
    const p = store.planFor(RID)
    expect(p.version_number).toBe(2)                    // incremented
    expect(p.plan_version_id).toBe('42:v2')             // new version id
    expect(p.plan_version_id).not.toBe(oldVersionId)    // old value replaced, not reused
    expect(p.total_step_count).toBe(4)                  // revised plan body
    // NOTE: the store keeps only the CURRENT version snapshot (no client-side version history);
    // "old preserved" is guaranteed server-side by the immutable plan_version_id, not in this store.
  })

  it('5. reject clears actions and marks rejected', async () => {
    await hydrate(canonical())
    mockApi.post.mockResolvedValueOnce({
      data: { ok: true, plan_view: toStoreSnapshot(canonical({
        plan_status: 'rejected', approval_status: 'rejected', available_actions: [],
        revision: 5, latest_sequence: 5,
      })) },
    })
    await store.decide(RID, 'reject')
    const p = store.planFor(RID)
    expect(p.plan_status).toBe('rejected')
    expect(p.approval_status).toBe('rejected')
    expect(p.available_actions).toEqual([])
  })

  it('6. live step updates by sequence (started then completed)', async () => {
    await hydrate(canonical({ plan_status: 'executing', approval_status: 'approved', latest_sequence: 4 }))
    expect(store.applyEvent(evt('step_started', { step_uid: 'a', sequence_number: 5 }), RID)).toBe('applied')
    let p = store.planFor(RID)
    expect(p.steps.find((s) => s.step_id === 'a').status).toBe('started')
    expect(store.applyEvent(evt('step_completed', { step_uid: 'a', sequence_number: 6 }), RID)).toBe('applied')
    p = store.planFor(RID)
    expect(p.steps.find((s) => s.step_id === 'a').status).toBe('completed')
    expect(p.completed_step_count).toBe(1)
    expect(p.current_step_id).toBe('b')                 // advances to next incomplete step
    expect(store.latestSequenceByRunId[RID]).toBe(6)
  })

  it('7. pause then resume flips plan_status', async () => {
    await hydrate(canonical({ plan_status: 'executing', approval_status: 'approved', latest_sequence: 4 }))
    store.applyEvent(evt('run_paused', { sequence_number: 5 }), RID)
    expect(store.planFor(RID).plan_status).toBe('paused')
    store.applyEvent(evt('run_resumed', { sequence_number: 6 }), RID)
    expect(store.planFor(RID).plan_status).toBe('executing')
  })

  it('8. completion marks the run completed', async () => {
    await hydrate(canonical({ plan_status: 'executing', approval_status: 'approved', latest_sequence: 4 }))
    expect(store.applyEvent(evt('run_completed', { sequence_number: 5 }), RID)).toBe('applied')
    expect(store.planFor(RID).plan_status).toBe('completed')
  })

  it('9. failure marks the run failed', async () => {
    await hydrate(canonical({ plan_status: 'executing', approval_status: 'approved', latest_sequence: 4 }))
    store.applyEvent(evt('step_failed', { step_uid: 'a', sequence_number: 5, payload: { reason: 'boom' } }), RID)
    expect(store.planFor(RID).steps.find((s) => s.step_id === 'a').status).toBe('failed')
    store.applyEvent(evt('run_failed', { sequence_number: 6 }), RID)
    expect(store.planFor(RID).plan_status).toBe('failed')
  })

  it('10. cancellation marks the run cancelled', async () => {
    await hydrate(canonical({ plan_status: 'executing', approval_status: 'approved', latest_sequence: 4 }))
    expect(store.applyEvent(evt('run_cancelled', { sequence_number: 5 }), RID)).toBe('applied')
    expect(store.planFor(RID).plan_status).toBe('cancelled')
  })

  it('11. duplicate event (same sequence) is ignored', async () => {
    await hydrate(canonical({ plan_status: 'executing', approval_status: 'approved', latest_sequence: 4 }))
    expect(store.applyEvent(evt('step_completed', { step_uid: 'a', sequence_number: 5 }), RID)).toBe('applied')
    expect(store.applyEvent(evt('step_completed', { step_uid: 'a', sequence_number: 5 }), RID)).toBe('duplicate')
    expect(store.latestSequenceByRunId[RID]).toBe(5)   // cursor not double-advanced
  })

  it('12. sequence gap triggers a durable-snapshot refetch (gap handling)', async () => {
    await hydrate(canonical({ plan_status: 'executing', approval_status: 'approved', latest_sequence: 4 }))
    // snapshot the refetch would return
    mockApi.get.mockResolvedValueOnce({ data: toStoreSnapshot(canonical({
      plan_status: 'executing', approval_status: 'approved', latest_sequence: 9,
      completed_count: 2, steps: [
        canonicalStep('a', { status: 'completed' }), canonicalStep('b', { status: 'completed' }),
        canonicalStep('c'),
      ],
    })) })
    const r = store.applyEvent(evt('step_completed', { step_uid: 'c', sequence_number: 9 }), RID)
    expect(r).toBe('gap')
    expect(store.hydrationStatusByRunId[RID]).not.toBe('ready') // marked stale during refetch
    expect(mockApi.get).toHaveBeenCalled()
  })

  it('13. stale revision refresh: decision 409 refreshes the snapshot instead of applying', async () => {
    await hydrate(canonical())
    const err = { response: { status: 409, data: { conflict: true, plan_view: toStoreSnapshot(canonical({
      revision: 8, latest_sequence: 8, plan_status: 'executing', approval_status: 'approved',
      available_actions: [],
    })) } } }
    mockApi.post.mockRejectedValueOnce(err)
    const res = await store.decide(RID, 'approve')
    expect(res.conflict).toBe(true)
    const p = store.planFor(RID)
    expect(p.revision).toBe(8)                 // refreshed from the authoritative snapshot
    expect(p.plan_status).toBe('executing')
    expect(store.latestSequenceByRunId[RID]).toBe(8)
  })

  it('14. two runs in one conversation are both tracked', async () => {
    await hydrate(canonical({ run_id: 'system_a:1', conversation_id: 9, plan_version_id: '1:v1' }))
    await hydrate(canonical({ run_id: 'system_b:2', conversation_id: 9, plan_version_id: '2:v1' }))
    const runs = store.runsForConversation(9)
    expect(runs.length).toBe(2)
    expect(runs.map((r) => r.run_id).sort()).toEqual(['system_a:1', 'system_b:2'])
    // independent cursors per run_id
    store.applyEvent(evt('run_completed', { run_id: 'system_a:1', sequence_number: 5 }), 'system_a:1')
    expect(store.planFor('system_a:1').plan_status).toBe('completed')
    expect(store.planFor('system_b:2').plan_status).toBe('pending_approval') // unaffected
  })

  it('15. reconnect while awaiting approval rehydrates the awaiting snapshot', async () => {
    // fresh store (simulating a page reload / WS reconnect) hydrates from the durable snapshot API.
    await hydrate(canonical())  // backend still reports awaiting approval
    const p = store.planFor(RID)
    expect(p.plan_status).toBe('pending_approval')
    expect(p.approval_status).toBe('pending')
    expect(p.available_actions).toContain('approve')
    expect(store.hydrationStatusByRunId[RID]).toBe('ready')
  })

  it('16. reconnect while executing rehydrates executing state + progress', async () => {
    await hydrate(canonical({
      plan_status: 'executing', run_status: 'executing', approval_status: 'approved',
      execution_allowed: true, available_actions: [], latest_sequence: 7,
      completed_count: 2, current_step: 'c',
      steps: [
        canonicalStep('a', { status: 'completed' }), canonicalStep('b', { status: 'completed' }),
        canonicalStep('c', { status: 'started' }),
      ],
    }))
    const p = store.planFor(RID)
    expect(p.plan_status).toBe('executing')
    expect(p.execution_allowed).toBe(true)
    expect(p.completed_step_count).toBe(2)
    expect(p.current_step_id).toBe('c')
    expect(store.latestSequenceByRunId[RID]).toBe(7)   // cursor restored → only newer events apply
    // a stale event already covered by the snapshot is ignored after reconnect
    expect(store.applyEvent(evt('step_completed', { step_uid: 'a', sequence_number: 3 }), RID)).toBe('duplicate')
  })
})
