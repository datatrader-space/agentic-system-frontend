// How the Studio says money and a model in its menus (UX pass, 2026-10-28).
// Cents, with a third digit only when it says something: $0.039, $0.09, $1.20.
export function usd(value) {
  const n = Number(value || 0)
  return `$${n >= 0.1 ? n.toFixed(2) : n.toFixed(3).replace(/0$/, '')}`
}

// One line per model in a menu: its name, the connection it runs on, and its price when known.
export function routeOptionLabel(route) {
  return [route?.name || route?.model, route?.connection || 'AADML', route?.price_label].filter(Boolean).join(' · ')
}
