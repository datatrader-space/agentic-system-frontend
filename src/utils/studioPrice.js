// How the Studio says money and a model in its menus (UX pass, 2026-10-28).
// Cents, with a third digit only when it says something: $0.039, $0.09, $1.20.
export function usd(value) {
  const n = Number(value || 0)
  return `$${n >= 0.1 ? n.toFixed(2) : n.toFixed(3).replace(/0$/, '')}`
}

// A price in words, as the price card, the bottom bar and the job card all say it (one wording, ADM-1170). The person
// pays what the render costs and never more than the most shown (owner, 2026-11-11: the industry's rule), so "at most"
// is a promise: an exact price is just the price, an estimate is "About $x, at most $y".
export function priceAmount(price) {
  if (!price) return ''
  if (price.status === 'unknown') return 'No published price'
  const most = price.most != null ? Number(price.most) : null
  if (most != null && most > Number(price.estimate)) return `About ${usd(price.estimate)}, at most ${usd(most)}`
  return price.status === 'exact' ? usd(price.estimate) : `About ${usd(price.estimate)}`
}

// The rule, said once wherever a price is: what it costs, never more than the most shown, nothing for a failure.
export function priceRule(most) {
  return `You pay what it costs, never more than ${usd(most)}. A failed render costs nothing.`
}

// One line per model in a menu: its name, the connection it runs on, and its price when known.
export function routeOptionLabel(route) {
  return [route?.name || route?.model, route?.connection || 'AADML', route?.price_label].filter(Boolean).join(' · ')
}
