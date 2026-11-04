// Unsent Studio drafts on this device (owner's delegate, 2026-11-04): kept in localStorage so a reload or a closed tab
// on the same browser brings the text back. Never on the server: unsent text is sensitive and short-lived.
// One entry per signed-in person + page + conversation. Only text and plain settings are kept (strings, numbers,
// booleans, and plain objects of those one level deep): no File, no array of references, no URL list, no token.
// An entry older than 7 days is dropped when read. Sign-out removes every entry of the person.
const PREFIX = 'aadml.studio.draft.v1.'
export const STUDIO_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_TEXT = 8000
// '.' separates the parts, so it is encoded inside one.
const part = value => encodeURIComponent(String(value || '')).replace(/\./g, '%2E')
const personPrefix = person => `${PREFIX}${part(person)}.`
export function studioDraftKey(person, page, conversation) {
  if (!person || !page) return ''
  return `${personPrefix(person)}${part(page)}.${part(conversation || 'new')}`
}
function plain(value) {
  if (typeof value === 'string') return value.slice(0, MAX_TEXT)
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean') return value
  return undefined
}
// A File, Blob, Date or array is not a plain object (a Vue reactive object is: it keeps Object's prototype).
const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
// What may be written: plain values, and plain objects of plain values (settings). Anything else is left out.
export function plainDraft(draft) {
  const out = {}
  if (!draft || typeof draft !== 'object') return out
  for (const [key, value] of Object.entries(draft)) {
    const kept = plain(value)
    if (kept !== undefined) { out[key] = kept; continue }
    if (isPlainObject(value)) {
      const inner = {}
      for (const [name, item] of Object.entries(value)) { const v = plain(item); if (v !== undefined) inner[name] = v }
      out[key] = inner
    }
  }
  return out
}
function storage() { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }
function keysOf(prefix) {
  const store = storage(), keys = []
  if (!store) return keys
  try { for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key && key.startsWith(prefix)) keys.push(key) } } catch { /* blocked storage */ }
  return keys
}
function readEntry(key, now) {
  const store = storage()
  if (!store || !key) return null
  try {
    const entry = JSON.parse(store.getItem(key) || 'null')
    if (!entry || typeof entry !== 'object' || typeof entry.at !== 'number' || !entry.draft || typeof entry.draft !== 'object') { store.removeItem(key); return null }
    if (now - entry.at > STUDIO_DRAFT_MAX_AGE_MS || entry.at > now + 60000) { store.removeItem(key); return null }
    return plainDraft(entry.draft)
  } catch { try { store.removeItem(key) } catch { /* blocked storage */ } return null }
}
// The draft kept for this key, or null. Reading also drops this person's other expired drafts.
export function readLocalDraft(key, now = Date.now()) {
  if (!key) return null
  const draft = readEntry(key, now)
  const person = key.slice(0, key.indexOf('.', PREFIX.length) + 1)
  for (const other of keysOf(person)) if (other !== key) readEntry(other, now)
  return draft
}
// Keeps the draft, or removes the entry when the draft has no text (an empty draft is no draft).
export function keepLocalDraft(key, draft, now = Date.now()) {
  const store = storage()
  if (!store || !key) return
  const clean = plainDraft(draft)
  const hasText = Object.values(clean).some(value => typeof value === 'string' && value.trim())
  try { if (hasText) store.setItem(key, JSON.stringify({ at: now, draft: clean })); else store.removeItem(key) } catch { /* the page keeps working */ }
}
export function dropLocalDraft(...keys) {
  const store = storage()
  if (!store) return
  for (const key of keys) if (key) try { store.removeItem(key) } catch { /* blocked storage */ }
}
// Sign-out: every Studio draft of this person on this browser (with no person given: every Studio draft).
export function clearStudioDrafts(person = '') {
  const store = storage()
  if (!store) return
  for (const key of keysOf(person ? personPrefix(person) : PREFIX)) try { store.removeItem(key) } catch { /* blocked storage */ }
}
