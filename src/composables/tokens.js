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
  // THE WHOLE TURN, WHEN THE BACKEND SENT IT.
  //
  // `prompt_tokens`/`total_tokens` describe the MAIN model call. A turn also pays for the routing call,
  // any embeddings and the assurance pass, and none of those were ever in this number — so the figure
  // under an answer was the part of the bill that happened to flow through one path.
  //
  // MEASURED, production conv 1777 (2026-09-19): the UI read "159.7k tokens · $0.004" for a turn that
  // made 17 model calls, 201,640 prompt tokens and $0.008. Understating by half is worse than showing
  // nothing, because the missing half is exactly the internal work a user cannot see or predict.
  //
  // `turn_*` is emitted by `turn_usage_ledger.display_totals()` and preferred whenever present; the old
  // keys remain the fallback, so an older message or a surface that never sent them renders as before.
  const whole = u.turn_total_tokens != null
  const prompt = whole ? u.turn_prompt_tokens
    : (u.prompt_tokens != null ? u.prompt_tokens : u.input_tokens)
  const completion = whole ? u.turn_completion_tokens
    : (u.completion_tokens != null ? u.completion_tokens : u.output_tokens)
  const total = whole ? u.turn_total_tokens
    : (u.total_tokens != null ? u.total_tokens : ((prompt || 0) + (completion || 0)) || null)
  if (!total) return null
  const cached = whole && u.turn_cached_tokens != null ? u.turn_cached_tokens
    : (u.cached_tokens != null ? u.cached_tokens : null)
  const cost = whole && u.turn_cost_usd != null ? u.turn_cost_usd
    : (u.cost_usd != null ? u.cost_usd : null)
  return {
    total,
    prompt: prompt != null ? prompt : null,
    completion: completion != null ? completion : null,
    cached,
    cost,
    // How many model calls the figure covers, so the tooltip can say "17 calls" rather than implying one.
    calls: u.turn_model_calls != null ? u.turn_model_calls : null,
  }
}
