import api from './api'

// The models a Studio page may use for these tasks (GET /api/video/routes/), each with its settings schema: one entry
// per model, in the server's order (cheapest known first). '' asks for every task. A video model is a route; an image
// model has no route id and is known by its model id.
export async function loadStudioRoutes(tasks) {
  const answers = await Promise.all(tasks.map(task => api.getStudioRoutes(task)))
  const seen = new Set()
  return answers.flatMap(({ data }) => data?.routes || []).filter(r => {
    const key = r.route_id != null ? `route:${r.route_id}` : `model:${r.model_id}`
    return !seen.has(key) && seen.add(key)
  })
}

// The values a model's schema allows for one setting ([] when it declares none: the provider's default applies).
export function schemaEnum(route, key) {
  return route?.schema?.properties?.[key]?.enum || []
}

// The settings a person sets on a model, from its schema and UI hints, in the schema's own order: never the prompt or
// the files (they have their own inputs), never an advanced field. A list of values, or a small whole-number range, is
// a choice; a yes or no is a toggle. A setting the schema does not declare is not shown.
const OWN_INPUTS = new Set(['prompt', 'references'])
export function schemaFields(route) {
  const props = route?.schema?.properties || {}
  const hints = route?.ui?.fields || {}
  const order = route?.ui?.order || Object.keys(props)
  return order.filter(key => props[key] && !OWN_INPUTS.has(key) && !hints[key]?.advanced).map(key => {
    const p = props[key]
    if (p.type === 'boolean') return { key, kind: 'toggle', title: p.title || key }
    let values = Array.isArray(p.enum) ? p.enum : null
    if (!values && p.type === 'integer' && Number.isInteger(p.minimum) && Number.isInteger(p.maximum) && p.maximum - p.minimum < 20) {
      values = Array.from({ length: p.maximum - p.minimum + 1 }, (_, i) => p.minimum + i)
    }
    return values ? { key, kind: 'choice', title: p.title || key, values, unit: hints[key]?.unit || '', default: p.default } : null
  }).filter(Boolean)
}

// A video model by any of its connections' route ids, or an image model by its model id; null when not listed.
export function routeFor(routes, { routeId = '', modelId = '' } = {}) {
  if (modelId !== '' && modelId != null) return routes.find(r => r.route_id == null && String(r.model_id) === String(modelId)) || null
  if (routeId === '' || routeId == null) return null
  const id = String(routeId)
  return routes.find(r => String(r.route_id) === id || (r.connections || []).some(c => String(c.route_id) === id)) || null
}
