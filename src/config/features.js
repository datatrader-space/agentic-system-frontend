// Frontend feature flags (build-time, via Vite env). Mirrors the backend rollout flags so a feature
// only lights up when BOTH sides are enabled.
//
// INLINE_PLAN_ARTIFACT — the inline live plan artifact (durable message anchor + pushed exact-version
// snapshots over the WebSocket). When OFF (default), the chat falls back to the legacy detached plan
// card + snapshot polling. Enable with VITE_INLINE_PLAN_ARTIFACT=true, alongside the backend
// INLINE_PLAN_ARTIFACT_ENABLED flag.

function boolEnv(v) {
  return String(v == null ? '' : v).toLowerCase() === 'true'
}

export const INLINE_PLAN_ARTIFACT = boolEnv(import.meta.env.VITE_INLINE_PLAN_ARTIFACT)
