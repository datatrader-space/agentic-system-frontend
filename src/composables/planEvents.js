// Frontend event normalization for the unified plan UI (Phase 3).
// Mirrors backend run_coordinator/event_norm.py: maps legacy event names into ONE unified
// frontend event contract and provides a stable dedup key. Legacy event names are NOT removed;
// this only normalizes what the modern timeline consumes.

export const FRONTEND_EVENT_TYPES = [
  'plan_created', 'plan_updated', 'plan_approval_required', 'plan_approved',
  'plan_changes_requested', 'plan_rejected', 'plan_step_started', 'plan_step_completed',
  'plan_step_failed', 'run_paused', 'run_resumed', 'run_completed', 'run_failed', 'run_cancelled',
]

const LEGACY_TO_FRONTEND = {
  plan_approval_required: 'plan_approval_required',
  plan_approved: 'plan_approved',
  plan_rejected: 'plan_rejected',
  plan_revise: 'plan_changes_requested',
  plan_changes_requested: 'plan_changes_requested',
  plan_created: 'plan_created',
  agent_plan_generated: 'plan_created',
  plan_updated: 'plan_updated',
  plan_progress: 'plan_updated',
  step_started: 'plan_step_started',
  plan_step_started: 'plan_step_started',
  step_completed: 'plan_step_completed',
  plan_step_completed: 'plan_step_completed',
  phase_complete: 'plan_step_completed',
  step_failed: 'plan_step_failed',
  plan_step_failed: 'plan_step_failed',
  run_paused: 'run_paused',
  run_resumed: 'run_resumed',
  session_complete: 'run_completed',
  agent_session_complete: 'run_completed',
  run_completed: 'run_completed',
  run_failed: 'run_failed',
  agent_session_error: 'run_failed',
  run_cancelled: 'run_cancelled',
  agent_session_stopped: 'run_cancelled',
}

export function toFrontendType(legacyName) {
  if (!legacyName) return null
  return LEGACY_TO_FRONTEND[String(legacyName).trim().toLowerCase()] || null
}

// Tiny stable string hash (djb2) — for dedup keys when no event_id is present.
function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(16)
}

export function dedupKey(evt) {
  if (evt && evt.event_id) return `id:${evt.event_id}`
  const parts = [
    evt?.run_id ?? '',
    evt?.event_type ?? '',
    evt?.step_id ?? evt?.step_uid ?? '',
    evt?.sequence_number ?? evt?.timestamp ?? '',
  ].join('|')
  return `k:${hash(parts)}`
}

function safePayload(payload) {
  if (!payload || typeof payload !== 'object') return {}
  const out = {}
  for (const k of ['step_uid', 'step_id', 'title', 'status', 'reason', 'version', 'version_id']) {
    if (k in payload) out[k] = payload[k]
  }
  return out
}

// Normalize one raw ws event into the unified contract, or null if it is not a plan event.
export function normalizeEvent(raw, runId = null) {
  const legacyName = raw?.type || raw?.event || raw?.event_type
  const ftype = toFrontendType(legacyName)
  if (!ftype) return null
  const evt = {
    event_id: raw.event_id ?? null,
    run_id: runId || raw.run_id || null,
    plan_version_id: raw.plan_version_id ?? null,
    sequence_number: raw.sequence_number ?? null,
    revision: raw.revision ?? null,
    event_type: ftype,
    timestamp: raw.timestamp ?? raw.ts ?? null,
    step_id: raw.step_id ?? raw.step_uid ?? null,
    // acceptance tier the runner verified a completed step at — drives the "how verified" badge.
    tier: raw.tier ?? (raw.payload && raw.payload.tier) ?? null,
    payload: safePayload(raw.payload || {}),
  }
  evt.dedup_key = dedupKey(evt)
  return evt
}
