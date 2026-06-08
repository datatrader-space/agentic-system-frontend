import { describe, it, expect } from 'vitest'
import { modeKey, modeLabel, modeDotClass, MODE_OPTIONS, isAutonomous } from './agentModes'

describe('agentModes — the 4 product modes are the 2×2 of (execution_mode, plan_mode_enabled)', () => {
  it('maps every (execution_mode, plan) pair to the right mode key', () => {
    expect(modeKey('manual', false)).toBe('manual')
    expect(modeKey('autonomous', false)).toBe('auto')
    expect(modeKey('manual', true)).toBe('plan')
    expect(modeKey('autonomous', true)).toBe('plan_auto')
  })

  it('treats truthy plan + assisted/unknown execution modes safely', () => {
    expect(isAutonomous('autonomous')).toBe(true)
    expect(isAutonomous('manual')).toBe(false)
    expect(isAutonomous('assisted')).toBe(false)       // only "autonomous" is auto
    expect(modeKey('assisted', true)).toBe('plan')      // non-autonomous + plan => Planning
  })

  it('labels each mode for the picker button', () => {
    expect(modeLabel('manual', false)).toBe('Manual mode')
    expect(modeLabel('autonomous', false)).toBe('Auto mode')
    expect(modeLabel('manual', true)).toBe('Plan mode')
    expect(modeLabel('autonomous', true)).toBe('Plan + Auto')
  })

  it('picks a distinct dot color per family', () => {
    expect(modeDotClass('manual', false)).toBe('amp-dot-manual')
    expect(modeDotClass('manual', true)).toBe('amp-dot-plan')
    expect(modeDotClass('autonomous', false)).toBe('amp-dot-auto')
    expect(modeDotClass('autonomous', true)).toBe('amp-dot-auto')   // auto color wins
  })

  it('each menu option persists exactly the two backend booleans', () => {
    const byKey = Object.fromEntries(MODE_OPTIONS.map((o) => [o.key, o.patch]))
    expect(byKey.manual).toEqual({ execution_mode: 'manual', plan_mode_enabled: false })
    expect(byKey.auto).toEqual({ execution_mode: 'autonomous', plan_mode_enabled: false })
    expect(byKey.plan).toEqual({ execution_mode: 'manual', plan_mode_enabled: true })
    expect(byKey.plan_auto).toEqual({ execution_mode: 'autonomous', plan_mode_enabled: true })
  })

  it('the option a mode resolves to round-trips back to that mode', () => {
    for (const o of MODE_OPTIONS) {
      expect(modeKey(o.patch.execution_mode, o.patch.plan_mode_enabled)).toBe(o.key)
    }
  })
})
