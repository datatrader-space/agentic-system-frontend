// Display-logic behind AdminRuntimeMetrics.vue — utilization math, tier thresholds, uptime humanizing,
// and the counter/gauge folds, all exercised without mounting the SFC or touching the network.
import { describe, it, expect } from 'vitest'
import {
  TIER_THRESHOLDS,
  utilizationPct,
  utilizationTier,
  poolTier,
  breakerTier,
  humanizeUptime,
  countBreakerStates,
  breakerSummaryTier,
  sumBackpressureRejected,
  sumBackpressureActive,
  sumPoolQueued,
  aggregatePoolUtilization,
} from './runtimeMetrics'

describe('utilizationPct', () => {
  it('computes a normal ratio, rounded to one decimal', () => {
    expect(utilizationPct(3, 5)).toBe(60)
    expect(utilizationPct(1, 3)).toBe(33.3)
  })

  it('is null — never 0 or Infinity/NaN — on divide-by-zero or missing max', () => {
    expect(utilizationPct(3, 0)).toBeNull()
    expect(utilizationPct(0, 0)).toBeNull()
    expect(utilizationPct(3, null)).toBeNull()
    expect(utilizationPct(3, undefined)).toBeNull()
    expect(utilizationPct(3, -5)).toBeNull()
  })

  it('tolerates junk active/max without throwing', () => {
    expect(utilizationPct('abc', 5)).toBeNull()
    expect(utilizationPct(NaN, 5)).toBeNull()
    expect(utilizationPct(undefined, undefined)).toBeNull()
    expect(utilizationPct({}, [])).toBeNull()
  })

  it('clamps negative active to 0 and caps the result at 100', () => {
    expect(utilizationPct(-4, 10)).toBe(0)
    expect(utilizationPct(20, 10)).toBe(100) // active > max should never happen, but must not read >100%
  })
})

describe('utilizationTier', () => {
  it('is green strictly below the amber threshold', () => {
    expect(utilizationTier(0)).toBe('green')
    expect(utilizationTier(TIER_THRESHOLDS.amber - 0.1)).toBe('green')
  })

  it('flips to amber exactly AT the amber threshold (inclusive upper tier)', () => {
    expect(utilizationTier(TIER_THRESHOLDS.amber)).toBe('amber')
  })

  it('stays amber up to just below red, flips to red exactly at the red threshold', () => {
    expect(utilizationTier(TIER_THRESHOLDS.red - 0.1)).toBe('amber')
    expect(utilizationTier(TIER_THRESHOLDS.red)).toBe('red')
    expect(utilizationTier(100)).toBe('red')
  })

  it('is unknown — not green — for null/NaN/undefined', () => {
    expect(utilizationTier(null)).toBe('unknown')
    expect(utilizationTier(undefined)).toBe('unknown')
    expect(utilizationTier(NaN)).toBe('unknown')
    expect(utilizationTier('nope')).toBe('unknown')
  })
})

describe('poolTier', () => {
  it('is unknown for a pool that never started in this process', () => {
    expect(poolTier({ started: false, active: 0, max_workers: 5 })).toBe('unknown')
    expect(poolTier(null)).toBe('unknown')
    expect(poolTier(undefined)).toBe('unknown')
  })

  it('reads active/max_workers when started', () => {
    expect(poolTier({ started: true, active: 1, max_workers: 5, queued: 0 })).toBe('green') // 20%
    expect(poolTier({ started: true, active: 4, max_workers: 5, queued: 0 })).toBe('amber') // 80%
    expect(poolTier({ started: true, active: 5, max_workers: 5, queued: 0 })).toBe('red')   // 100%
  })

  it('escalates a green reading to amber the instant work is queued behind a full pool', () => {
    expect(poolTier({ started: true, active: 0, max_workers: 5, queued: 1 })).toBe('amber')
    // An occupancy tier that is already amber/red is unaffected either way — escalation only fires
    // from a green base, so it can never claim to "downgrade" a reading that was already worse.
    expect(poolTier({ started: true, active: 4, max_workers: 5, queued: 2 })).toBe('amber')
    expect(poolTier({ started: true, active: 5, max_workers: 5, queued: 2 })).toBe('red')
  })

  it('tolerates a missing queued field (no escalation, no throw)', () => {
    expect(poolTier({ started: true, active: 1, max_workers: 5 })).toBe('green')
  })
})

describe('breakerTier', () => {
  it('maps the three live states', () => {
    expect(breakerTier('closed')).toBe('green')
    expect(breakerTier('half_open')).toBe('amber')
    expect(breakerTier('open')).toBe('red')
  })

  it('is case-insensitive and unknown for anything else', () => {
    expect(breakerTier('OPEN')).toBe('red')
    expect(breakerTier('HALF_OPEN')).toBe('amber')
    expect(breakerTier('')).toBe('unknown')
    expect(breakerTier(null)).toBe('unknown')
    expect(breakerTier(42)).toBe('unknown')
  })
})

describe('humanizeUptime', () => {
  it('shows plain seconds under a minute', () => {
    expect(humanizeUptime(0)).toBe('0s')
    expect(humanizeUptime(45)).toBe('45s')
    expect(humanizeUptime(59.9)).toBe('59s')
  })

  it('flips to minutes exactly at the 60s boundary', () => {
    expect(humanizeUptime(59)).toBe('59s')
    expect(humanizeUptime(60)).toBe('1m')
    expect(humanizeUptime(61)).toBe('1m')
  })

  it('shows minutes only (no seconds) under an hour', () => {
    expect(humanizeUptime(3599)).toBe('59m')
  })

  it('flips to hours exactly at the 3600s boundary and drops to hours+minutes', () => {
    expect(humanizeUptime(3600)).toBe('1h')
    expect(humanizeUptime(3661)).toBe('1h 1m')
    expect(humanizeUptime(86399)).toBe('23h 59m')
  })

  it('flips to days exactly at the 86400s boundary and drops minutes entirely', () => {
    expect(humanizeUptime(86400)).toBe('1d')
    expect(humanizeUptime(90000)).toBe('1d 1h') // 1d 1h 0m -> minutes dropped once at day scale
    expect(humanizeUptime(172800)).toBe('2d')
  })

  it('is an em dash — never a fabricated 0s — for junk input', () => {
    expect(humanizeUptime(-5)).toBe('—')
    expect(humanizeUptime(NaN)).toBe('—')
    expect(humanizeUptime(undefined)).toBe('—')
    expect(humanizeUptime(null)).toBe('—')
    expect(humanizeUptime('a long time')).toBe('—')
  })
})

describe('countBreakerStates / breakerSummaryTier', () => {
  it('tallies a mixed breaker map', () => {
    const counts = countBreakerStates({ 'tool:a': 'closed', 'tool:b': 'open', 'tool:c': 'half_open', 'tool:d': 'closed' })
    expect(counts).toEqual({ total: 4, closed: 2, open: 1, half_open: 1 })
    expect(breakerSummaryTier(counts)).toBe('red') // any open wins
  })

  it('is amber when nothing is open but something is half_open', () => {
    const counts = countBreakerStates({ a: 'closed', b: 'half_open' })
    expect(breakerSummaryTier(counts)).toBe('amber')
  })

  it('is green when every breaker is closed', () => {
    const counts = countBreakerStates({ a: 'closed', b: 'closed' })
    expect(breakerSummaryTier(counts)).toBe('green')
  })

  it('is unknown (not green) when no breakers have been instantiated', () => {
    expect(countBreakerStates({})).toEqual({ total: 0, closed: 0, open: 0, half_open: 0 })
    expect(breakerSummaryTier(countBreakerStates({}))).toBe('unknown')
    expect(breakerSummaryTier(countBreakerStates(null))).toBe('unknown')
  })

  it('tolerates junk input without throwing', () => {
    expect(countBreakerStates(null)).toEqual({ total: 0, closed: 0, open: 0, half_open: 0 })
    expect(countBreakerStates(undefined)).toEqual({ total: 0, closed: 0, open: 0, half_open: 0 })
    expect(countBreakerStates('nope')).toEqual({ total: 0, closed: 0, open: 0, half_open: 0 })
    const weird = countBreakerStates({ a: 'sideways', b: null })
    expect(weird.total).toBe(2)
    expect(weird.closed + weird.open + weird.half_open).toBe(0) // unrecognized states counted, not misfiled
  })
})

describe('sumBackpressureRejected', () => {
  it('sums only bp.*.rejected counters, ignoring everything else', () => {
    const counters = {
      'bp.llm_stream.rejected': 3, 'bp.llm_stream.admitted': 40,
      'bp.tool:foo.rejected': 2,
      'breaker.tool:foo.opened': 1, 'tool.executions': 500,
    }
    expect(sumBackpressureRejected(counters)).toBe(5)
  })

  it('tolerates junk/empty counters', () => {
    expect(sumBackpressureRejected({})).toBe(0)
    expect(sumBackpressureRejected(null)).toBe(0)
    expect(sumBackpressureRejected(undefined)).toBe(0)
    expect(sumBackpressureRejected({ 'bp.a.rejected': 'not-a-number' })).toBe(0)
  })
})

describe('sumBackpressureActive', () => {
  it('sums active across every node', () => {
    expect(sumBackpressureActive({ a: { active: 2 }, b: { active: 3 } })).toBe(5)
  })
  it('tolerates junk', () => {
    expect(sumBackpressureActive({})).toBe(0)
    expect(sumBackpressureActive(null)).toBe(0)
    expect(sumBackpressureActive({ a: { active: 'x' }, b: null })).toBe(0)
  })
})

describe('sumPoolQueued', () => {
  it('sums queued across pools, skipping a null (failed-introspection) reading', () => {
    expect(sumPoolQueued({
      llm_stream: { queued: 2 }, asgi_default: { queued: 0 }, tool_registry: { queued: null },
    })).toBe(2)
  })
  it('tolerates junk', () => {
    expect(sumPoolQueued({})).toBe(0)
    expect(sumPoolQueued(null)).toBe(0)
  })
})

describe('aggregatePoolUtilization', () => {
  it('folds active/max across started pools with a known size', () => {
    const pools = {
      llm_stream: { started: true, active: 2, max_workers: 4 },
      asgi_default: { started: true, active: 1, max_workers: 4 },
      tool_registry: { started: false, active: 0, max_workers: 5 },
    }
    const r = aggregatePoolUtilization(pools)
    expect(r.pct).toBe(37.5) // (2+1)/(4+4)
    expect(r.tier).toBe('green')
    expect(r.included).toBe(2)
    expect(r.excluded).toBe(1)
  })

  it('is null/unknown when nothing is started or sized', () => {
    const r = aggregatePoolUtilization({ a: { started: false }, b: { started: true, max_workers: null } })
    expect(r.pct).toBeNull()
    expect(r.tier).toBe('unknown')
    expect(r.included).toBe(0)
    expect(r.excluded).toBe(2)
  })

  it('tolerates an empty or junk pools object', () => {
    expect(aggregatePoolUtilization({})).toMatchObject({ pct: null, included: 0, excluded: 0 })
    expect(aggregatePoolUtilization(null)).toMatchObject({ pct: null, tier: 'unknown' })
  })
})
