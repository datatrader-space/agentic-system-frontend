import { describe, it, expect } from 'vitest'
import * as agentModes from './agentModes'
import {
  RUN_MODES, RETIRED_RUN_MODES, normalizeRunMode, isAutonomous,
  modeKey, modeLabel, modeDotClass, MODE_OPTIONS,
} from './agentModes'

describe('agentModes — the single canonical agent_run_mode field', () => {
  it('exposes exactly the two product run modes (ADM-1306)', () => {
    expect(RUN_MODES).toEqual(['manual', 'autonomous'])
    expect(agentModes.isPlanReview).toBeUndefined()
  })

  it('normalizes unknown / legacy values to manual', () => {
    expect(normalizeRunMode('manual')).toBe('manual')
    expect(normalizeRunMode('autonomous')).toBe('autonomous')
    expect(normalizeRunMode('assisted')).toBe('manual')
    expect(normalizeRunMode(undefined)).toBe('manual')
    expect(normalizeRunMode(null)).toBe('manual')
  })

  it('reads a stored retired plan-review mode as the mode it becomes', () => {
    expect(RETIRED_RUN_MODES).toEqual({ plan_review_manual: 'manual', plan_review_autonomous: 'autonomous' })
    expect(normalizeRunMode('plan_review_manual')).toBe('manual')
    expect(normalizeRunMode('plan_review_autonomous')).toBe('autonomous')
    expect(modeLabel('plan_review_manual')).toBe('Manual')
    expect(modeLabel('plan_review_autonomous')).toBe('Autonomous')
    expect(modeDotClass('plan_review_autonomous')).toBe('amp-dot-auto')
    expect(modeKey('plan_review_autonomous')).toBe('autonomous')
  })

  it('classifies autonomy correctly', () => {
    expect(isAutonomous('manual')).toBe(false)
    expect(isAutonomous('autonomous')).toBe(true)
    expect(isAutonomous('plan_review_manual')).toBe(false)
    expect(isAutonomous('plan_review_autonomous')).toBe(true)
  })

  it('labels each mode', () => {
    expect(modeLabel('manual')).toBe('Manual')
    expect(modeLabel('autonomous')).toBe('Autonomous')
  })

  it('picks a distinct dot color per mode', () => {
    expect(modeDotClass('manual')).toBe('amp-dot-manual')
    expect(modeDotClass('autonomous')).toBe('amp-dot-auto')
  })

  it('each menu option persists exactly the single agent_run_mode field', () => {
    expect(MODE_OPTIONS.map((o) => o.key)).toEqual(['manual', 'autonomous'])
    const byKey = Object.fromEntries(MODE_OPTIONS.map((o) => [o.key, o.patch]))
    expect(byKey.manual).toEqual({ agent_run_mode: 'manual' })
    expect(byKey.autonomous).toEqual({ agent_run_mode: 'autonomous' })
  })

  it('the option a mode resolves to round-trips back to that mode', () => {
    for (const o of MODE_OPTIONS) {
      expect(modeKey(o.patch.agent_run_mode)).toBe(o.key)
    }
  })
})
