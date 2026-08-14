// runtimeMetrics.js — pure display-logic helpers behind AdminRuntimeMetrics.vue.
//
// The endpoint (GET /api/admin/ops/runtime-metrics/, agent/ops_dashboard_views.py -> runtime_metrics(),
// data layer agent/services/runtime_metrics.py :: snapshot()) hands back raw, PROCESS-LOCAL counters/
// gauges/pool internals — it does no threshold math or formatting of its own (a metrics read must never
// fail on a display concern). Every "is this saturated?" / "how long has this been up?" judgment call
// therefore lives here, as pure functions, so the tier boundaries and uptime formatting are unit-testable
// without mounting the SFC or mocking the API client.
//
// Kept deliberately dependency-free (no Vue import) — these are plain data-in/data-out functions.

// Saturation tiers read at a glance: green (healthy headroom) -> amber (getting tight) -> red (at/over
// the edge). Boundaries are inclusive on the upper tier (>=70 is already amber, not "69.99 rounds up") so
// a tile's color and its printed percentage can never disagree.
export const TIER_THRESHOLDS = { amber: 70, red: 90 }

/**
 * Utilization percent for anything shaped like {active, max} — a thread pool or a backpressure node.
 * Returns null (never 0, never Infinity/NaN) when there is nothing sane to divide by: a missing/zero/
 * negative max means the pool was never sized (or never started), which is a DIFFERENT fact than "0%
 * used" and must render as "n/a", not a fake healthy reading. Negative `active` is clamped to 0 (defensive
 * only — the executor internals this is read from should never produce one). Result is capped at 100 and
 * rounded to one decimal so it lines up with a percent-width CSS bar without hairline overflow.
 */
export function utilizationPct(active, max) {
  const a = Number(active)
  const m = Number(max)
  if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(a)) return null
  const pct = (Math.max(0, a) / m) * 100
  return Math.min(100, Math.round(pct * 10) / 10)
}

/** Tier for a raw percent (as returned by utilizationPct). null/NaN -> 'unknown' — distinct from 'green',
 * because "we don't know" must never paint the same color as "confirmed healthy". */
export function utilizationTier(pct) {
  const p = Number(pct)
  if (pct == null || !Number.isFinite(p)) return 'unknown'
  if (p >= TIER_THRESHOLDS.red) return 'red'
  if (p >= TIER_THRESHOLDS.amber) return 'amber'
  return 'green'
}

/**
 * Tier for one pool row (agent/services/runtime_metrics.py :: _executor_stats shape: {started, active,
 * max_workers, queued, threads, idle}). A pool that was never created in this process ({started: false})
 * is 'unknown', not 'green' — an idle-because-never-touched pool and a confirmed-healthy one are different
 * facts. Any non-zero `queued` (submitted work sitting behind a full pool) escalates a green reading to
 * amber even before thread occupancy crosses the threshold — a queue forming is the earlier warning sign.
 */
export function poolTier(pool) {
  if (!pool || pool.started === false) return 'unknown'
  const tier = utilizationTier(utilizationPct(pool.active, pool.max_workers))
  const queued = Number(pool.queued)
  if (tier === 'green' && Number.isFinite(queued) && queued > 0) return 'amber'
  return tier
}

/** Tier for a live circuit-breaker state string (agent/runtime/backpressure.py CLOSED/OPEN/HALF_OPEN). */
export function breakerTier(state) {
  switch (String(state || '').toLowerCase()) {
    case 'closed': return 'green'
    case 'half_open': return 'amber'
    case 'open': return 'red'
    default: return 'unknown'
  }
}

/**
 * Humanize a process-uptime duration in seconds into its two most significant units ("2d 3h", "14m",
 * "45s"), the same convention used for uptime displays elsewhere in the admin shell — precise enough to
 * be useful, coarse enough to skim. Junk input (negative, NaN, non-numeric, null/undefined) -> '—', never
 * a fabricated "0s" (a metrics read failing open must be visibly absent, not silently zero).
 */
export function humanizeUptime(seconds) {
  if (seconds == null) return '—'          // Number(null) is 0 — guard explicitly, don't let it pass as "0s"
  const s = Number(seconds)
  if (!Number.isFinite(s) || s < 0) return '—'
  const total = Math.floor(s)
  if (total < 60) return `${total}s`
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

/** {total, closed, open, half_open} over a `breakers` map ({name: state}). Unrecognized state strings
 * count toward `total` only, never silently folded into 'closed' — an unknown state must not read as healthy. */
export function countBreakerStates(breakers) {
  const out = { total: 0, closed: 0, open: 0, half_open: 0 }
  if (!breakers || typeof breakers !== 'object') return out
  for (const state of Object.values(breakers)) {
    out.total += 1
    const s = String(state || '').toLowerCase()
    if (s === 'closed' || s === 'open' || s === 'half_open') out[s] += 1
  }
  return out
}

/** Overall tone for the breaker KPI tile: any OPEN breaker is 'red' (fail-fast is actively engaged
 * somewhere), else any HALF_OPEN is 'amber' (a probe is in flight), else 'green'. Zero breakers registered
 * yet is 'unknown', not 'green' — nothing has been observed either way. */
export function breakerSummaryTier(counts) {
  if (!counts || counts.total === 0) return 'unknown'
  if (counts.open > 0) return 'red'
  if (counts.half_open > 0) return 'amber'
  return 'green'
}

/**
 * Sum of every `bp.<node>.rejected` counter (agent/runtime/backpressure.py :: Backpressure.try_acquire —
 * admission is non-blocking by design, so a rejection IS the wait; there is no separate blocking-wait
 * counter to add on top). Mirrors agent/services/ops_metrics-adjacent runtime_metrics.compact()'s
 * `rejected_total` fold exactly, so the two dashboards can never silently disagree on the same number.
 */
export function sumBackpressureRejected(counters) {
  if (!counters || typeof counters !== 'object') return 0
  let total = 0
  for (const [k, v] of Object.entries(counters)) {
    if (k.startsWith('bp.') && k.endsWith('.rejected')) total += Number(v) || 0
  }
  return total
}

/** Sum of `active` across every registered backpressure node (`backpressure` map, name -> {active,
 * queue_depth, max_concurrent}) — how much concurrent work is admitted right now, platform-wide-in-process. */
export function sumBackpressureActive(backpressure) {
  if (!backpressure || typeof backpressure !== 'object') return 0
  let total = 0
  for (const node of Object.values(backpressure)) total += Number(node && node.active) || 0
  return total
}

/**
 * Sum of the executors' real work queues (`pools[*].queued` — ThreadPoolExecutor._work_queue.qsize(),
 * items submitted but not yet picked up by a worker). This is the honest "queued depth" figure: unlike a
 * Backpressure node's `queue_depth` (which reverts to 0 the instant a rejected try_acquire() returns — see
 * try_acquire()'s docstring — so it reads live as ~0 outside a race window), a full thread-pool queue is a
 * durable, currently-true fact. Pools with `queued: null` (introspection failed, guarded not raised) are
 * skipped rather than treated as 0, so a partial read never masquerades as "nothing queued".
 */
export function sumPoolQueued(pools) {
  if (!pools || typeof pools !== 'object') return 0
  let total = 0
  for (const pool of Object.values(pools)) {
    const q = Number(pool && pool.queued)
    if (Number.isFinite(q)) total += q
  }
  return total
}

/**
 * Aggregate utilization across every pool that both started and has a known max_workers — the headline
 * "pool utilization %" KPI. Pools that never started, or whose max_workers introspection failed, are
 * excluded from the ratio (their weight would be undefined, not zero) but counted in `excluded` so the
 * page can say honestly "N of M pools contributing" rather than implying full coverage.
 */
export function aggregatePoolUtilization(pools) {
  if (!pools || typeof pools !== 'object') return { pct: null, tier: 'unknown', included: 0, excluded: 0 }
  let activeSum = 0
  let maxSum = 0
  let included = 0
  let excluded = 0
  for (const pool of Object.values(pools)) {
    const max = Number(pool && pool.max_workers)
    if (!pool || pool.started === false || !Number.isFinite(max) || max <= 0) { excluded += 1; continue }
    activeSum += Math.max(0, Number(pool.active) || 0)
    maxSum += max
    included += 1
  }
  const pct = included > 0 ? utilizationPct(activeSum, maxSum) : null
  return { pct, tier: utilizationTier(pct), included, excluded }
}
