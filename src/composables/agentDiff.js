// Which agent fields an editor save must send: only what differs from the server's last confirmed copy.
//
// The Agent Editor used to PATCH the whole object it loaded and kept in memory. A field changed elsewhere
// since — the run mode switched from the chat composer, above all — was written back to its old value by the
// next editor save (2026-09-17: an agent switched to Autonomous in chat came back as Manual).

export const snapshot = (a) => JSON.parse(JSON.stringify(a || {}))

export function changedFields(current, base) {
  const out = {}
  for (const [k, v] of Object.entries(current || {})) {
    if (JSON.stringify(v) !== JSON.stringify(base ? base[k] : undefined)) out[k] = v
  }
  return out
}
