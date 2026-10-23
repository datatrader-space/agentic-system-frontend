// A navigation hint, never authorization. All media/conversation reads still use owner-scoped APIs.
// Only opaque IDs and allowlisted feature IDs are stored; no media URLs, prompts or file content.
import { getStudioFeature } from './studioFeatures'
const keyFor = person => person ? `aadml.studio.origins.${person}` : ''
function read(person) { try { const value = JSON.parse(localStorage.getItem(keyFor(person)) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} } }
export function rememberStudioOrigin(person, type, id, page) {
  if (!person || !id || !['conversation','attachment'].includes(type) || !getStudioFeature(page)) return
  try {
    const items = read(person), key = `${type}:${id}`
    delete items[key]; items[key] = page
    localStorage.setItem(keyFor(person), JSON.stringify(Object.fromEntries(Object.entries(items).slice(-250))))
  } catch { /* navigation still works with the API's available metadata */ }
}
export function studioOrigin(person, type, id) {
  if (!person || !id) return null
  const feature = getStudioFeature(read(person)[`${type}:${id}`])
  return feature && feature.status !== 'soon' ? feature : null
}
