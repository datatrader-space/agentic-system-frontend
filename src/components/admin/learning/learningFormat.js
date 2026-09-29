// Formatting shared by the Learning Monitor's tabs. One place, so a rate reads the same everywhere.

export function formatNumber (value) {
  return Number(value || 0).toLocaleString()
}

export function percent (value) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

// A change between two rates, in percentage points: "+12 pts".
export function signedPoints (value) {
  if (value == null) return '—'
  const points = Math.round(value * 100)
  return `${points > 0 ? '+' : ''}${points} pts`
}

export function formatMoney (value) {
  return Number(value || 0).toLocaleString(undefined, {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4,
  })
}

export function shortTime (value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// "2026-09-29" -> "Sep 29", read as a calendar day (no timezone shift).
export function dayLabel (iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m || !d) return String(iso || '')
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function sameId (left, right) {
  return left != null && right != null && String(left) === String(right)
}

// A change in a count per run: "-0.22".
export function signedDecimal (value) {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

// The change from `before` to `now`, and whether it is good news. `goodWhenUp` says which way is better; `format`
// writes the difference in the figure's own unit (points for a rate, a plain number for a per-run count).
export function change (now, before, { goodWhenUp = true, format = signedPoints } = {}) {
  if (now == null || before == null) return { text: 'no earlier data', tone: 'flat' }
  const delta = now - before
  if (Math.abs(delta) < 0.005) return { text: 'no change', tone: 'flat' }
  const better = goodWhenUp ? delta > 0 : delta < 0
  return { text: format(delta), tone: better ? 'good' : 'bad' }
}

export const TREND = {
  improving: { label: 'Improving', tone: 'good', icon: 'lucide:trending-up' },
  steady: { label: 'Steady', tone: 'flat', icon: 'lucide:minus' },
  needs_attention: { label: 'Needs attention', tone: 'bad', icon: 'lucide:trending-down' },
  too_little_data: { label: 'Too little data', tone: 'quiet', icon: 'lucide:hourglass' },
}

export function trendMeta (status) {
  return TREND[status] || TREND.too_little_data
}
