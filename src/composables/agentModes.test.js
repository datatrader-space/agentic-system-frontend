import { describe, it, expect } from 'vitest'
import {
  RUN_MODES, normalizeRunMode, isAutonomous, isPlanReview,
  modeKey, modeLabel, modeDotClass, MODE_OPTIONS,
} from './agentModes'

describe('agentModes — the single canonical agent_run_mode field', () => {
  it('exposes exactly the four product run modes', () => {
    expect(RUN_MODES).toEqual(['manual', 'autonomous', 'plan_review_manual', 'plan_review_autonomous'])
  })

  it('normalizes unknown / legacy values to manual', () => {
    expect(normalizeRunMode('manual')).toBe('manual')
    expect(normalizeRunMode('plan_review_autonomous')).toBe('plan_review_autonomous')
    expect(normalizeRunMode('assisted')).toBe('manual')
    expect(normalizeRunMode(undefined)).toBe('manual')
    expect(normalizeRunMode(null)).toBe('manual')
  })

  it('classifies autonomy correctly', () => {
    expect(isAutonomous('manual')).toBe(false)
    expect(isAutonomous('autonomous')).toBe(true)
    expect(isAutonomous('plan_review_manual')).toBe(false)
    expect(isAutonomous('plan_review_autonomous')).toBe(true)
  })

  it('classifies plan-review correctly', () => {
    expect(isPlanReview('manual')).toBe(false)
    expect(isPlanReview('autonomous')).toBe(false)
    expect(isPlanReview('plan_review_manual')).toBe(true)
    expect(isPlanReview('plan_review_autonomous')).toBe(true)
  })

  it('labels each mode', () => {
    expect(modeLabel('manual')).toBe('Manual')
    expect(modeLabel('autonomous')).toBe('Autonomous')
    expect(modeLabel('plan_review_manual')).toBe('Plan review → Manual')
    expect(modeLabel('plan_review_autonomous')).toBe('Plan review → Autonomous')
  })

  it('picks a distinct dot color per family', () => {
    expect(modeDotClass('manual')).toBe('amp-dot-manual')
    expect(modeDotClass('plan_review_manual')).toBe('amp-dot-plan')
    expect(modeDotClass('autonomous')).toBe('amp-dot-auto')
    expect(modeDotClass('plan_review_autonomous')).toBe('amp-dot-auto')  // auto color wins
  })

  it('each menu option persists exactly the single agent_run_mode field', () => {
    const byKey = Object.fromEntries(MODE_OPTIONS.map((o) => [o.key, o.patch]))
    expect(byKey.manual).toEqual({ agent_run_mode: 'manual' })
    expect(byKey.autonomous).toEqual({ agent_run_mode: 'autonomous' })
    expect(byKey.plan_review_manual).toEqual({ agent_run_mode: 'plan_review_manual' })
    expect(byKey.plan_review_autonomous).toEqual({ agent_run_mode: 'plan_review_autonomous' })
  })

  it('the option a mode resolves to round-trips back to that mode', () => {
    for (const o of MODE_OPTIONS) {
      expect(modeKey(o.patch.agent_run_mode)).toBe(o.key)
    }
  })
})
