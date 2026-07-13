// Event-contract drift protection (frontend side).
// Validates planEvents.js against the SHARED canonical fixtures. This file is byte-identical to the
// backend copy at agentic-system-backend/run_coordinator/tests/fixtures/event_norm_fixtures.json;
// both sides must normalize the same fixtures identically or one of these suites fails.
import { describe, it, expect } from 'vitest'
import fixtures from './__fixtures__/eventNormFixtures.json'
import { toFrontendType, normalizeEvent, FRONTEND_EVENT_TYPES } from './planEvents'

describe('planEvents contract (shared fixtures)', () => {
  it('maps every fixture type as expected', () => {
    for (const c of fixtures.cases) {
      expect(toFrontendType(c.input.type), c.name).toBe(c.expect_type)
    }
  })

  it('normalizeEvent matches the contract (type + safe payload)', () => {
    for (const c of fixtures.cases) {
      const evt = normalizeEvent(c.input, 'system_a:1')
      if (c.expect_type === null) {
        expect(evt, c.name).toBe(null)
        continue
      }
      expect(evt, c.name).not.toBe(null)
      expect(evt.event_type, c.name).toBe(c.expect_type)
      if (c.expect_safe_payload_keys) {
        expect(Object.keys(evt.payload).sort(), c.name).toEqual([...c.expect_safe_payload_keys].sort())
      }
      for (const dropped of c.expect_dropped_payload_keys || []) {
        expect(evt.payload[dropped], c.name).toBeUndefined()
      }
    }
  })

  it('every unified type has a contract fixture', () => {
    const covered = new Set(fixtures.cases.map((c) => c.expect_type).filter(Boolean))
    const missing = FRONTEND_EVENT_TYPES.filter((t) => !covered.has(t))
    expect(missing).toEqual([])
  })
})
