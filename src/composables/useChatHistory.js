// Shared helpers for rendering chat history (sidebar list + search modal).
// Keeps preview/title/relative-time/grouping logic in one place.

const DAY = 86400000

/**
 * Markdown as the words a person reads, on one line. An answer that opens with "- **Chat** — ID: **2839**"
 * was shown in the chat lists with its asterisks and list dash.
 */
export function plainText(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')                 // fenced code blocks
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')        // images -> alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')         // links -> their text
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '') // headings, quotes, list markers
    .replace(/(\*\*|__)(.+?)\1/g, '$2')              // bold
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2') // italics
    .replace(/`([^`]+)`/g, '$1')                     // inline code
    .replace(/~~(.+?)~~/g, '$1')                     // strikethrough
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Turn a raw last-message body into a clean one-line preview. Agents that answer in JSON
 * (e.g. PitchPilot's `{"fit_verdict":"go","fit_score":82,...}`) would otherwise dump the raw
 * blob into the sidebar — summarize those into something readable instead.
 */
function humanizePreview(raw) {
  if (!raw) return ''
  const looksJson = raw[0] === '{' || raw[0] === '['
  if (!looksJson) return plainText(raw)

  let obj = null
  try { obj = JSON.parse(raw) } catch { /* possibly truncated — fall through to regex */ }

  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const verdict = obj.fit_verdict || obj.verdict
    if (verdict) {
      const v = String(verdict).toUpperCase().replace(/_/g, '-')
      const score = obj.fit_score ?? obj.score
      return score != null ? `Pitch: ${v} · score ${score}` : `Pitch: ${v}`
    }
    // Otherwise surface the first human-meaningful string field.
    for (const k of ['summary', 'title', 'headline', 'message', 'answer', 'text', 'name', 'result']) {
      if (typeof obj[k] === 'string' && obj[k].trim()) return obj[k].trim()
    }
    return 'Structured result'
  }

  // Truncated/unparseable JSON — pull known fields by regex so it still reads cleanly.
  const vm = raw.match(/"(?:fit_)?verdict"\s*:\s*"([^"]+)"/i)
  if (vm) {
    const v = vm[1].toUpperCase().replace(/_/g, '-')
    const sm = raw.match(/"(?:fit_)?score"\s*:\s*"?([0-9.]+)"?/i)
    return sm ? `Pitch: ${v} · score ${sm[1]}` : `Pitch: ${v}`
  }
  return 'Structured result'
}

/** The text to show as the primary line: last message preview → title → fallback. */
export function previewOf(s) {
  const raw = s && s.last_message && (s.last_message.content || '').trim()
  const title = (s && s.title || '').trim()
  if (raw) {
    const clean = humanizePreview(raw)
    if (clean) return clean
  }
  if (title && !/^chat with /i.test(title)) return title
  return title || 'New conversation'
}

/** A chat's name in a list: the name the person gave it; a default "Chat with <agent>" (or none) falls back to
 *  its last message. The main chat list and Video Studio (recent chats, the Library's "From") use this one rule. */
export function chatName(c) {
  const named = (c && c.title || '').trim()
  return (named && !/^(chat with |new conversation$)/i.test(named)) ? named : (previewOf(c) || 'Chat')
}

/** Agent name for the secondary line. */
export function agentOf(s) {
  return (s && (s.agent_profile_name || s.agent_name)) || 'Agent'
}

/** A timestamp for sorting/grouping (last message → updated → created). */
export function tsOf(s) {
  const d = (s && s.last_message && s.last_message.created_at) || (s && s.updated_at) || (s && s.created_at)
  return d ? new Date(d).getTime() : 0
}

/** Compact relative time: "now", "5m", "3h", "Yesterday", "Mon", "Mar 4". */
export function relTime(s) {
  const t = tsOf(s)
  if (!t) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return 'now'
  if (diff < DAY) {
    const h = Math.floor(diff / 3_600_000)
    if (h >= 1) return `${h}h`
    return `${Math.floor(diff / 60_000)}m`
  }
  if (diff < 2 * DAY) return 'Yesterday'
  const d = new Date(t)
  if (diff < 7 * DAY) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const ORDER = ['Today', 'Yesterday', 'Previous 7 Days', 'Older']

function bucket(s) {
  const t = tsOf(s)
  if (!t) return 'Older'
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const today = start.getTime()
  if (t >= today) return 'Today'
  if (t >= today - DAY) return 'Yesterday'
  if (t >= today - 7 * DAY) return 'Previous 7 Days'
  return 'Older'
}

/**
 * Group sessions into ordered buckets, newest first within each.
 * @returns {Array<{label:string, items:object[]}>}
 */
export function groupSessions(list) {
  const buckets = { Today: [], Yesterday: [], 'Previous 7 Days': [], Older: [] }
  for (const s of list || []) buckets[bucket(s)].push(s)
  for (const k of ORDER) buckets[k].sort((a, b) => tsOf(b) - tsOf(a))
  return ORDER.filter((k) => buckets[k].length).map((label) => ({ label, items: buckets[label] }))
}
