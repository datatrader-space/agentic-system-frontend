// The AI providers a person may pick from, derived from the models they may use. Provider rows (keys, settings) are
// platform-administrator only (backend PAYMENTS_TOPUP_PLAN.md §7); every model row names its provider.
export function providersFromModels(models) {
  const seen = new Map()
  for (const m of models || []) {
    const id = m.provider ?? m.provider_id
    if (id == null || seen.has(id)) continue
    seen.set(id, { id, name: m.provider_name || m.provider_type || 'AI provider', provider_type: m.provider_type || '' })
  }
  return [...seen.values()]
}
