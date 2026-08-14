// Tier + payload-parsing logic behind VerificationBadge.vue (Phase 4 verification badges).
import { describe, it, expect } from 'vitest'
import {
  badgeTier,
  parseDelegationResult,
  isDelegationTool,
  humanizeReason,
} from './verificationBadge'

describe('badgeTier', () => {
  it('is verified only for verified === true', () => {
    expect(badgeTier(true, 'completed')).toBe('verified')
    expect(badgeTier(true, '')).toBe('verified')
  })

  it('is unverified when completed but verified is false OR null/undefined', () => {
    expect(badgeTier(false, 'completed')).toBe('unverified')
    expect(badgeTier(null, 'completed')).toBe('unverified')
    expect(badgeTier(undefined, 'completed')).toBe('unverified')
  })

  it('is failed whenever status is failed/error — failure outranks any verified flag', () => {
    expect(badgeTier(false, 'failed')).toBe('failed')
    expect(badgeTier(null, 'failed')).toBe('failed')
    expect(badgeTier(true, 'failed')).toBe('failed') // defensive: gate can't produce this, UI must not greenwash it
    expect(badgeTier(false, 'error')).toBe('failed')
  })

  it('never greenwashes a truthy-but-not-true verified', () => {
    expect(badgeTier(1, 'completed')).toBe('unverified')
    expect(badgeTier('true', 'completed')).toBe('unverified')
  })
})

describe('isDelegationTool', () => {
  it('matches the two delegation tools, case/space-insensitively', () => {
    expect(isDelegationTool('DELEGATE_TO_AGENT')).toBe(true)
    expect(isDelegationTool('delegate_parallel')).toBe(true)
    expect(isDelegationTool(' DELEGATE_TO_AGENT ')).toBe(true)
  })
  it('rejects everything else', () => {
    expect(isDelegationTool('SEARCH_KNOWLEDGE_BASE')).toBe(false)
    expect(isDelegationTool('')).toBe(false)
    expect(isDelegationTool(null)).toBe(false)
  })
})

describe('parseDelegationResult — single delegation payloads', () => {
  const payload = {
    delegation_id: 'dlg_1',
    sub_agent: 'Researcher',
    sub_agent_id: 7,
    status: 'completed',
    verified: true,
    verification: { verified: true, method: 'deterministic_acceptance_v1', checks: {}, reasons: [] },
    response: 'done',
  }

  it('parses an object payload', () => {
    const r = parseDelegationResult(payload)
    expect(r).toMatchObject({ verified: true, status: 'completed', parallel: false })
    expect(r.verification.method).toBe('deterministic_acceptance_v1')
  })

  it('parses a full JSON string payload', () => {
    const r = parseDelegationResult(JSON.stringify({ ...payload, verified: false }))
    expect(r).toMatchObject({ verified: false, status: 'completed' })
  })

  it('recovers verified/status from a TRUNCATED JSON string (300-char step summary)', () => {
    const full = JSON.stringify(payload)
    const r = parseDelegationResult(full.slice(0, 160)) // cut mid-payload, after status+verified
    expect(r).toMatchObject({ verified: true, status: 'completed', truncated: true })
  })

  it('returns null for a truncated string cut BEFORE the verified key (never guesses)', () => {
    const r = parseDelegationResult('{"delegation_id": "dlg_1", "sub_agent": "Res')
    expect(r).toBeNull()
  })
})

describe('parseDelegationResult — parallel envelope', () => {
  it('is verified only when every delegated task verified', () => {
    const all = parseDelegationResult({ delegated: 2, completed: 2, verified: 2, results: [{}, {}] })
    expect(all).toMatchObject({ verified: true, status: 'completed', parallel: true, note: '2/2 verified' })

    const some = parseDelegationResult({ delegated: 3, completed: 3, verified: 2, results: [{}, {}, {}] })
    expect(some).toMatchObject({ verified: false, status: 'completed', note: '2/3 verified' })
  })

  it('is failed when nothing completed', () => {
    const r = parseDelegationResult({ delegated: 2, completed: 0, verified: 0, results: [{}, {}] })
    expect(r).toMatchObject({ verified: false, status: 'failed' })
  })

  it('recovers counts from a truncated parallel envelope', () => {
    const r = parseDelegationResult('{"delegated": 3, "completed": 3, "verified": 3, "results": [{"delegation')
    expect(r).toMatchObject({ verified: true, status: 'completed', note: '3/3 verified', truncated: true })
  })
})

describe('parseDelegationResult — refuses non-delegation input', () => {
  it('returns null for other tool outputs, plain text, and junk', () => {
    expect(parseDelegationResult(null)).toBeNull()
    expect(parseDelegationResult('')).toBeNull()
    expect(parseDelegationResult('plain text result')).toBeNull()
    expect(parseDelegationResult('{"rows": 5, "status": "completed", "verified": true}')).toBeNull()
    expect(parseDelegationResult({ rows: 5, status: 'completed' })).toBeNull()
    expect(parseDelegationResult(['a'])).toBeNull()
    expect(parseDelegationResult(42)).toBeNull()
  })
})

describe('humanizeReason', () => {
  it('maps known gate reason codes to human wording', () => {
    expect(humanizeReason('task_not_completed')).toBe('The sub-task did not complete')
    expect(humanizeReason('empty_response')).toBe('The sub-agent returned an empty response')
    expect(humanizeReason('no_tool_evidence')).toBe('Claimed action but produced no tool evidence')
  })
  it('unpacks failure_marker codes with the marker quoted', () => {
    expect(humanizeReason('failure_marker:i cannot')).toBe('The response contains a failure marker ("i cannot")')
  })
  it('falls back to de-underscored text for unknown codes', () => {
    expect(humanizeReason('some_new_code')).toBe('some new code')
  })
})
