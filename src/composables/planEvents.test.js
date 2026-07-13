import { describe, it, expect } from 'vitest'
import { toFrontendType, normalizeEvent, dedupKey, FRONTEND_EVENT_TYPES } from './planEvents'

describe('planEvents normalization', () => {
  it('maps legacy names to unified frontend types', () => {
    expect(toFrontendType('step_completed')).toBe('plan_step_completed')
    expect(toFrontendType('agent_session_complete')).toBe('run_completed')
    expect(toFrontendType('plan_revise')).toBe('plan_changes_requested')
    expect(toFrontendType('assistant_message_chunk')).toBe(null)
  })

  it('normalizes an event and sanitizes payload', () => {
    const evt = normalizeEvent(
      { type: 'step_completed', step_uid: 's1', sequence_number: 3, payload: { status: 'completed', secret: 'x' } },
      'system_a:12',
    )
    expect(evt.event_type).toBe('plan_step_completed')
    expect(evt.run_id).toBe('system_a:12')
    expect(evt.payload.secret).toBeUndefined()
    expect(evt.dedup_key).toBeTruthy()
  })

  it('returns null for non-plan events', () => {
    expect(normalizeEvent({ type: 'assistant_message_chunk' })).toBe(null)
  })

  it('dedup prefers event_id and is stable without it', () => {
    expect(dedupKey({ event_id: 'a', event_type: 'x' })).toBe(dedupKey({ event_id: 'a', event_type: 'x', sequence_number: 9 }))
    const base = { run_id: 'r', event_type: 'plan_step_completed', step_id: 's1', sequence_number: 2 }
    expect(dedupKey(base)).toBe(dedupKey({ ...base }))
    expect(dedupKey(base)).not.toBe(dedupKey({ ...base, step_id: 's2' }))
  })

  it('every mapped type is a declared frontend type', () => {
    // spot-check a few + the invariant
    expect(FRONTEND_EVENT_TYPES).toContain('plan_approved')
    expect(FRONTEND_EVENT_TYPES).toContain('run_cancelled')
  })
})
