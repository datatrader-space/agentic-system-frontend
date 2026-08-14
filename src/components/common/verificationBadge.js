// verificationBadge.js — pure helpers behind VerificationBadge.vue (Phase 4, verification-tier badges).
// Deterministic delegation verification already exists in the data (DelegationRecord.verified +
// .verification + .status, and the DELEGATE_TO_AGENT / DELEGATE_PARALLEL tool-result JSON). This module
// turns those raw fields into a badge tier and parses tool-result payloads — pure functions only, so the
// tier logic is unit-testable without mounting the SFC.

// Delegation tools whose results carry a verification verdict.
const DELEGATION_TOOLS = new Set(['DELEGATE_TO_AGENT', 'DELEGATE_PARALLEL'])

export function isDelegationTool(name) {
  return DELEGATION_TOOLS.has(String(name || '').trim().toUpperCase())
}

// The three badge tiers. Precedence: a failed delegation is FAILED regardless of anything else
// (the verifier can never mark a non-completed task verified, so the order is safe); a true
// `verified` is VERIFIED; anything that completed without a true verdict is UNVERIFIED — this
// includes verified=false AND verified=null/undefined, because "we could not confirm it" must
// never render as a green check.
export function badgeTier(verified, status) {
  const s = String(status || '').toLowerCase()
  if (s === 'failed' || s === 'error') return 'failed'
  if (verified === true) return 'verified'
  return 'unverified'
}

// Parse a DELEGATE_TO_AGENT / DELEGATE_PARALLEL tool-result payload (object or JSON string) into
// { verified, status, note?, parallel, verification? } — or null when the payload does not
// SELF-IDENTIFY as a delegation result. Never guesses: unrecognizable input → null (no badge),
// because a wrong badge is worse than none.
export function parseDelegationResult(raw) {
  if (raw == null) return null
  let v = raw
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s || s[0] !== '{') return null
    try {
      v = JSON.parse(s)
    } catch {
      // Truncated JSON (e.g. the timeline's 300-char step summary) — regex-sniff instead.
      return sniffTruncated(s)
    }
  }
  if (typeof v !== 'object' || Array.isArray(v)) return null

  // Parallel envelope: {delegated, completed, verified: <count>, results: [...]}
  if (Array.isArray(v.results) && (v.delegated != null || v.completed != null)) {
    const total = Number(v.delegated != null ? v.delegated : v.results.length) || 0
    const done = Number(v.completed || 0)
    const okCount = Number(v.verified || 0)
    return {
      verified: total > 0 && okCount >= total,
      status: done > 0 ? 'completed' : 'failed',
      note: `${okCount}/${total} verified`,
      parallel: true,
    }
  }

  // Single delegation payload — self-identifies via its delegation_id key (only delegation tools
  // emit one), or via the exact verified+status+sub_agent trio.
  const single = ('delegation_id' in v)
    || ('verified' in v && 'status' in v && ('sub_agent' in v || 'sub_agent_id' in v))
  if (single) {
    return {
      verified: v.verified === true,
      status: String(v.status || ''),
      verification: (v.verification && typeof v.verification === 'object') ? v.verification : null,
      parallel: false,
    }
  }
  return null
}

// Truncated-JSON fallback: only trust strings that carry a delegation marker, and only report what
// is actually visible in the fragment.
function sniffTruncated(s) {
  const isSingle = /"delegation_id"\s*:/.test(s)
  const isParallel = /"delegated"\s*:\s*\d+/.test(s)
  if (!isSingle && !isParallel) return null
  if (isParallel) {
    const total = /"delegated"\s*:\s*(\d+)/.exec(s)
    const done = /"completed"\s*:\s*(\d+)/.exec(s)
    const ok = /"verified"\s*:\s*(\d+)/.exec(s)
    if (!total || !ok) return null
    const t = Number(total[1])
    const okN = Number(ok[1])
    return {
      verified: t > 0 && okN >= t,
      status: done && Number(done[1]) > 0 ? 'completed' : 'failed',
      note: `${okN}/${t} verified`,
      parallel: true,
      truncated: true,
    }
  }
  const ver = /"verified"\s*:\s*(true|false)/.exec(s)
  if (!ver) return null
  const st = /"status"\s*:\s*"([a-z_]+)"/i.exec(s)
  return {
    verified: ver[1] === 'true',
    status: st ? st[1] : '',
    parallel: false,
    truncated: true,
  }
}

// ── Human wording for the verification JSON (the deterministic gate's verdict) ────────────────
// Shape (agent/services/delegation_verifier.py): {verified, method, checks:{...}, reasons:[...]}.

const REASON_LABELS = {
  task_not_completed: 'The sub-task did not complete',
  empty_response: 'The sub-agent returned an empty response',
  no_tool_evidence: 'Claimed action but produced no tool evidence',
}

export function humanizeReason(code) {
  const c = String(code || '')
  if (REASON_LABELS[c]) return REASON_LABELS[c]
  if (c.startsWith('failure_marker:')) {
    return `The response contains a failure marker ("${c.slice('failure_marker:'.length)}")`
  }
  return c.replace(/_/g, ' ')
}

export const CHECK_LABELS = {
  completed: 'Completed',
  nonempty_response: 'Non-empty response',
  no_failure_marker: 'No failure markers',
  tool_evidence: 'Used tools',
}
