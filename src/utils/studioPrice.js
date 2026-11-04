// How the Studio says money and a model in its menus (UX pass, 2026-10-28).
// Cents, with a third digit only when it says something: $0.039, $0.09, $1.20.
export function usd(value) {
  const n = Number(value || 0)
  return `$${n >= 0.1 ? n.toFixed(2) : n.toFixed(3).replace(/0$/, '')}`
}

// A live quote's price in words, as the price card and the bottom bar both say it (one wording, ADM-1170): the
// listed price is an estimate, so never "at most"; a range when the provider's settings decide it.
export function priceAmount(price) {
  if (!price) return ''
  if (price.status === 'unknown') return 'No published price'
  if (price.status === 'estimated' && price.most != null && price.most > price.estimate) return `About ${usd(price.estimate)} to ${usd(price.most)}`
  return `About ${usd(price.estimate)}`
}

// One line per model in a menu: its name, the connection it runs on, and its price when known.
export function routeOptionLabel(route) {
  return [route?.name || route?.model, route?.connection || 'AADML', route?.price_label].filter(Boolean).join(' · ')
}
