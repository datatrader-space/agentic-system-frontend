// Images in a workflow's run data (ADM-1351): pure helpers, plus the one cache of viewer links.
//
// An image is { kind: 'image', id } (an uploaded or made image; GET /api/workflow-graphs/images/<id>/ gives a 15-minute
// link) or { kind: 'image', event: n } (a camera frame, which has no viewer link here). Detections are
// { kind: 'detections', image, size: [w, h], items: [{ class, score, box: [x1, y1, x2, y2], polygon }] }.
// The registry's output samples use ids in parentheses ('(image)'): those are shapes, never fetched.
import api from '@/services/api'

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

/** A real image reference (an id, or a camera frame's event); a sample's '(image)' is not one. */
export function isImageRef(v) {
  if (!isObj(v) || v.kind !== 'image') return false
  if (typeof v.id === 'string' && v.id && !/^\(.*\)$/.test(v.id)) return true
  return v.id === undefined && Number.isInteger(v.event)
}

export function isDetections(v) {
  return isObj(v) && v.kind === 'detections' && Array.isArray(v.items)
}

/** "3 objects: cat 2, dog 1" ("No objects found" for none). Classes in order of count, then name. */
export function detectionSummary(det) {
  const items = Array.isArray(det?.items) ? det.items : []
  if (!items.length) return 'No objects found'
  const counts = new Map()
  for (const it of items) {
    const c = String(it?.class ?? 'object')
    counts.set(c, (counts.get(c) || 0) + 1)
  }
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c, n]) => `${c} ${n}`)
  return `${items.length} object${items.length === 1 ? '' : 's'}: ${parts.join(', ')}`
}

const keyOf = (img) => (img.id !== undefined ? `id:${img.id}` : `event:${img.event}`)

/**
 * Every image and detections value inside `value`, in order, as { kind: 'image' | 'detections', path, value }. Nothing
 * is cut. An image already shown as the image of a detections value is not listed again; detections without a real
 * image are not listed.
 */
export function findMedia(value) {
  const found = []
  const walk = (v, path) => {
    // Detections without a real image (a registry sample) have nothing to draw on.
    if (isDetections(v)) { if (isImageRef(v.image)) found.push({ kind: 'detections', path, value: v }); return }
    if (isImageRef(v)) { found.push({ kind: 'image', path, value: v }); return }
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`))
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k)
  }
  walk(value, '')
  const drawn = new Set(found.filter((m) => m.kind === 'detections').map((m) => keyOf(m.value.image)))
  return found.filter((m) => m.kind !== 'image' || !drawn.has(keyOf(m.value)))
}

/** A detection's box as percentages of the image (for labels drawn over it), or null when it cannot be placed. */
export function boxPercent(box, size) {
  const [w, h] = Array.isArray(size) ? size.map(Number) : []
  if (!Array.isArray(box) || box.length !== 4 || !(w > 0) || !(h > 0)) return null
  const [x1, y1, x2, y2] = box.map(Number)
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null
  return { left: (x1 / w) * 100, top: (y1 / h) * 100, width: ((x2 - x1) / w) * 100, height: ((y2 - y1) / h) * 100 }
}

/** An SVG `points` string for a polygon ([[x, y], ...] or [x, y, x, y, ...]), or '' when there is none. */
export function polygonPoints(polygon) {
  if (!Array.isArray(polygon) || !polygon.length) return ''
  const pts = Array.isArray(polygon[0]) ? polygon : polygon.reduce((a, v, i) => (i % 2 ? a : [...a, [v, polygon[i + 1]]]), [])
  return pts.filter((p) => Array.isArray(p) && p.length >= 2 && p.every((n) => Number.isFinite(Number(n)))).map((p) => `${p[0]},${p[1]}`).join(' ')
}

// ── viewer links: one read per image, read again once the link has expired ──
const links = new Map()   // id -> { url, expiresAt } | { pending }
const EARLY_MS = 30_000   // asked again a little before the server's expiry

/** The viewer link of an uploaded or made image. Rejects with a sentence a person can read. */
export async function imageUrl(id, { force = false } = {}) {
  const now = Date.now()
  const c = links.get(id)
  if (!force && c?.pending) return c.pending
  if (!force && c?.url && c.expiresAt > now) return c.url
  const pending = api.getWorkflowImage(id).then(({ data }) => {
    if (!data || typeof data.url !== 'string' || !data.url) throw new Error('The server did not send a link for this image.')
    const ttl = Number(data.expires_in) > 0 ? Number(data.expires_in) * 1000 : 0
    links.set(id, { url: data.url, expiresAt: Date.now() + Math.max(ttl - EARLY_MS, 0) })
    return data.url
  }).catch((e) => {
    links.delete(id)
    const d = e?.response?.data
    if (e?.response) throw new Error((d && (d.error || d.detail)) || `The image could not be loaded (error ${e.response.status}).`)
    throw new Error(e?.message && !/network/i.test(e.message) ? e.message : 'The image could not be loaded. Check your connection.')
  })
  links.set(id, { pending })
  return pending
}

/** For tests: forget every link. */
export function resetImageLinks() { links.clear() }
