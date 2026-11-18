import { describe, it, expect } from 'vitest'
import { stopReasonBadge } from './stopReason'

describe('stopReasonBadge', () => {
  it('hides the badge for a clean high-confidence completion', () => {
    expect(stopReasonBadge('task_completed', 'high')).toBeNull()
  })

  it('shows a badge for task_completed at lower confidence', () => {
    const b = stopReasonBadge('task_completed', 'medium')
    expect(b).not.toBeNull()
    expect(b.confidence).toBe('medium')
  })

  it('labels each non-trivial reason with a tone', () => {
    const cases = {
      max_iterations_reached: 'low',
      tool_failure: 'low',
      insufficient_information: 'low',
      duplicate_loop_detected: 'low',
      token_budget_reached: 'low',
      stopped_by_user: 'medium',
      user_input_required: 'medium',
      blocked_by_policy: 'medium',
    }
    for (const [reason, conf] of Object.entries(cases)) {
      const b = stopReasonBadge(reason, conf)
      expect(b, reason).not.toBeNull()
      expect(b.label.length).toBeGreaterThan(0)
      expect(b.tone.dot).toMatch(/bg-/)
    }
  })

  it('returns null when no reason', () => {
    expect(stopReasonBadge(null, 'low')).toBeNull()
    expect(stopReasonBadge(undefined, undefined)).toBeNull()
  })

  it('falls back to low tone for an unknown confidence', () => {
    const b = stopReasonBadge('max_iterations_reached', 'weird')
    expect(b.confidence).toBe('low')
  })
})

// ADM-1284: the turn header's words, from how the turn ended.
import { turnHeadline, TURN_WARN } from './stopReason'
describe('turnHeadline', () => {
  it('words every way a turn ends', () => {
    expect(turnHeadline('completed', 'task_completed')).toBe('')
    expect(turnHeadline('completed', 'stopped_by_user')).toBe('Stopped by you')
    expect(turnHeadline('paused', 'balance_empty')).toBe('Paused — balance ran out')
    expect(turnHeadline('paused', 'cost_budget_reached')).toBe('Paused — budget reached')
    expect(turnHeadline('paused', '')).toBe('Paused')
    expect(turnHeadline('waiting', 'approval_wait')).toBe('Waiting for you')
    expect(turnHeadline('not_verified', 'action_obligations_unmet')).toBe('Not verified')
    expect(turnHeadline('not_verified', 'insufficient_information')).toBe('Partial — not enough info')
    expect(turnHeadline('failed', 'provider_failure')).toBe('Could not complete')
    expect(turnHeadline('interrupted')).toBe('Interrupted — connection lost')
    expect(turnHeadline('detached')).toBe('Still running — reopen to follow')
  })

  it('only a plain completion is not a warning', () => {
    expect(TURN_WARN.has('completed')).toBe(false)
    for (const s of ['paused', 'waiting', 'not_verified', 'failed', 'interrupted', 'detached']) expect(TURN_WARN.has(s)).toBe(true)
  })
})
