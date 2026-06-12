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
