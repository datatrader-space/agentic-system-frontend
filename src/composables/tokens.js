// Token + cost formatting for the metering UI (live chip, per-response line, session total).
// Matches the mockups: "4.2k tokens", "↑3.2k ↓1.0k", "1.1k cached", "$0.012", "Session 24.6k · $0.08".

// k-notation: 4215 -> "4.2k", 950 -> "950", 24600 -> "24.6k". Drops a trailing ".0".
export function fmtTokens(n) {
  const v = Number(n)
  if (!isFinite(v) || v <= 0) return '0'
  if (v < 1000) return String(Math.round(v))
  return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
}

// Cost in USD. Small amounts get 3 decimals ($0.012); larger ones 2 ($1.20). null -> ''.
export function fmtCost(usd) {
  const v = Number(usd)
  if (usd == null || !isFinite(v)) return ''
  if (v === 0) return '$0.00'
  if (v < 1) return '$' + v.toFixed(3)
  return '$' + v.toFixed(2)
}

// Normalise a usage object (from assistant_message_complete / token_usage) into display fields.
export function normalizeUsage(u) {
  if (!u) return null
  const prompt = u.prompt_tokens != null ? u.prompt_tokens : u.input_tokens
  const completion = u.completion_tokens != null ? u.completion_tokens : u.output_tokens
  const total = u.total_tokens != null ? u.total_tokens
    : ((prompt || 0) + (completion || 0)) || null
  if (!total) return null
  return {
    total,
    prompt: prompt != null ? prompt : null,
    completion: completion != null ? completion : null,
    cached: u.cached_tokens != null ? u.cached_tokens : null,
    cost: u.cost_usd != null ? u.cost_usd : null,
  }
}
