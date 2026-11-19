import { reactive } from 'vue'
import api from './api'
import { studioLooks } from './studioLooks'
// The Image and Video pages' presets are data from the Recipe API (GET /api/video/recipes/?page=image|video, F-D4): one
// source, the backend's catalogue. The other pages' looks are still this app's own data (studioLooks.js).
export const API_PRESET_PAGES = ['image', 'video']
const fromApi = reactive({ image: null, video: null })     // null: not read yet
const reading = {}
// Read a page's presets once (they do not change while the app is open). Resolves with them; rejects when the read
// failed, so a page can say so and offer to read again.
export function loadPresets(feature) {
  if (!API_PRESET_PAGES.includes(feature)) return Promise.resolve(presetsFor(feature))
  if (fromApi[feature]) return Promise.resolve(fromApi[feature])
  if (!reading[feature]) {
    reading[feature] = Promise.resolve().then(() => api.getStudioRecipes(feature))
      .then(({ data }) => { fromApi[feature] = Array.isArray(data?.presets) ? data.presets : []; return fromApi[feature] })
      .finally(() => { delete reading[feature] })
  }
  return reading[feature]
}
// Both pages' presets, for the lists that show every look (Discover, the workspace bar). A failed read leaves them out
// until the next read; it never stops the list.
export function loadAllPresets() { return Promise.allSettled(API_PRESET_PAGES.map(loadPresets)) }
export function presetsLoaded(feature) { return !API_PRESET_PAGES.includes(feature) || fromApi[feature] != null }
export function presetsFor(feature) {
  return API_PRESET_PAGES.includes(feature) ? (fromApi[feature] || []) : studioLooks.filter(preset => preset.feature === feature)
}
// Every look a person can open from Discover, in the catalogue's order: the Image and Video looks (once read), then
// the other pages'.
export function allLooks() { return [...API_PRESET_PAGES.flatMap(feature => (fromApi[feature] || []).filter(p => p.clientOnly)), ...studioLooks] }
// Tests only: forget what was read.
export function forgetPresets() { for (const feature of API_PRESET_PAGES) fromApi[feature] = null }
// A look's text field whose default stands for the person's own thing ("Your product", "Your subject") is a hint, not
// a value (ISSUE-6): its field starts empty with the hint as its placeholder, and the prompt never carries the hint as
// if it were the person's words. Any other default ("Warm ivory", "Slow push-in") is the look's prepared direction.
export function isPlaceholderDefault(variable) { return /^\s*your\b/i.test(String(variable?.default ?? '')) }
// The value a look's field starts with: its prepared direction, or empty when its default is only a hint.
export function initialVariableValue(variable) { return isPlaceholderDefault(variable) ? '' : String(variable?.default ?? '') }
// Only filled values go into the prompt. A field left empty takes the look's prepared direction; a hint left empty is
// named the way an empty reference slot is, so the model asks or reads the person's references instead.
export function composePreset(preset, values = {}, details = '', variant = 0) {
  if (!preset) return details.trim()
  const supplied = Object.values(values || {}).some(value => Array.isArray(value) && value.length)
  const text = preset.promptTemplate.replace(/\{([^}]+)\}/g, (_, id) => {
    const variable = preset.variables?.find(item => item.label.toLowerCase() === id.toLowerCase())
    if (variable) {
      const filled = String(values[variable.id] ?? '').trim()
      if (filled) return filled
      if (!isPlaceholderDefault(variable)) return String(variable.default ?? '').trim()
      return supplied ? 'the subject in the supplied references' : 'the subject described below'
    }
    const chosen = values[id] || []
    return chosen.length ? `the supplied ${preset.slots.find(slot => slot.id === id)?.label.toLowerCase() || 'reference'}` : 'the subject described below'
  })
  return [text, preset.variants[variant % preset.variants.length], details.trim()].filter(Boolean).join(' ')
}
