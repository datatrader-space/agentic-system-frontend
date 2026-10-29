// One model list across every platform provider: each model id once (owner, 2026-10-29). People choose a model,
// never a provider, so a model id served by two connections is one choice. `keep` lists the ids of models already
// chosen (an agent's current pick): when a duplicate is one of them, that row is the one kept, so the pick still
// shows as selected.
export function uniqueModels(models, keep = []) {
  const keepIds = new Set((keep || []).filter((v) => v != null).map(String))
  const byKey = new Map()
  for (const m of models || []) {
    const key = String(m?.model_id || m?.id || '').trim().toLowerCase()
    if (!key) continue
    const had = byKey.get(key)
    if (!had || (keepIds.has(String(m.id)) && !keepIds.has(String(had.id)))) byKey.set(key, m)
  }
  // The first appearance's position, so the list keeps the order it came in.
  const order = new Map()
  ;(models || []).forEach((m, i) => {
    const key = String(m?.model_id || m?.id || '').trim().toLowerCase()
    if (key && !order.has(key)) order.set(key, i)
  })
  return [...byKey.entries()].sort((a, b) => order.get(a[0]) - order.get(b[0])).map(([, m]) => m)
}
