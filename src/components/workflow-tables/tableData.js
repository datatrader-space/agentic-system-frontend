// The Tables page's rules (ADM-1363), pure: no Vue, no requests. The server is the authority on every one of them
// (it refuses a bad key, a bad value, a write while storage is unpaid); these only say so before the person sends.

export const COLUMN_TYPES = Object.freeze([
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'True / false' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date and time' },
  { value: 'json', label: 'JSON' },
])
export const typeLabel = (type) => COLUMN_TYPES.find((t) => t.value === type)?.label || type

export const RESERVED_KEYS = Object.freeze(['id', 'created_at', 'updated_at'])

// The row filter operators (the API's names) and their words.
export const FILTER_OPS = Object.freeze([
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
])
export const NO_VALUE_OPS = Object.freeze(['is_empty', 'is_not_empty'])

/** '' when `key` is a column key the server accepts, else why not (1-63 characters, letter first, no "__"). */
export function columnKeyProblem(key, { taken = [] } = {}) {
  const k = String(key || '')
  if (!k) return 'Give the column a key.'
  if (k.length > 63) return 'A key has 63 characters at most.'
  if (!/^[A-Za-z]/.test(k)) return 'A key starts with a letter.'
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(k)) return 'A key has only letters, digits and _.'
  if (k.includes('__')) return 'A key cannot have two _ in a row.'
  if (RESERVED_KEYS.includes(k.toLowerCase())) return `${k} is kept for every row; choose another key.`
  if (taken.map((t) => String(t).toLowerCase()).includes(k.toLowerCase())) return `The table already has a column ${k}.`
  return ''
}

/** A key made from a label: "Email address" -> "email_address" (the person may change it). */
export function keyFromLabel(label) {
  let k = String(label || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  if (k && !/^[a-z]/.test(k)) k = `c_${k}`
  return k.slice(0, 63).replace(/_+$/, '')
}

const pad = (n) => String(n).padStart(2, '0')

/** The text an edit field starts with for a stored value. */
export function editText(type, value) {
  if (value === null || value === undefined) return ''
  if (type === 'json') return JSON.stringify(value)
  if (type === 'boolean') return value ? 'true' : 'false'
  if (type === 'datetime') {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return String(value)
}

/**
 * An edit field's text -> the value sent: { value } or { error }. Empty text is null (the value is cleared).
 * A datetime is the person's local time (a datetime-local field), sent as ISO with its offset.
 */
export function parseCell(type, text) {
  const t = String(text ?? '')
  if (t.trim() === '') return { value: null }
  switch (type) {
    case 'number': {
      const n = Number(t.trim())
      return Number.isFinite(n) ? { value: n } : { error: 'Not a number.' }
    }
    case 'boolean':
      if (['true', 'false'].includes(t)) return { value: t === 'true' }
      return { error: 'Choose true or false.' }
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(t.trim()) ? { value: t.trim() } : { error: 'A date is YYYY-MM-DD.' }
    case 'datetime': {
      const d = new Date(t)
      return Number.isNaN(d.getTime()) ? { error: 'Not a date and time.' } : { value: d.toISOString() }
    }
    case 'json':
      try { return { value: JSON.parse(t) } } catch { return { error: 'Not valid JSON.' } }
    default:
      return { value: t }
  }
}

/** A stored value as the grid shows it. */
export function displayCell(type, value) {
  if (value === null || value === undefined || value === '') return ''
  if (type === 'json') return JSON.stringify(value)
  if (type === 'boolean') return value ? 'true' : 'false'
  if (type === 'datetime') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
  }
  return String(value)
}

/**
 * The values of an edited row that differ from the stored ones: { values, errors }. `texts` is { key: text } of the
 * edit fields; a cleared field sends null. `errors` is { key: message } for a text that is not a value of its type.
 */
export function rowChanges(columns, row, texts) {
  const values = {}
  const errors = {}
  for (const c of columns || []) {
    if (!(c.key in (texts || {}))) continue
    const parsed = parseCell(c.type, texts[c.key])
    if (parsed.error) { errors[c.key] = parsed.error; continue }
    if (c.required && parsed.value === null) { errors[c.key] = 'Required.'; continue }
    const before = row ? row[c.key] ?? null : null
    if (JSON.stringify(parsed.value) !== JSON.stringify(before)) values[c.key] = parsed.value
  }
  return { values, errors }
}

/** 1536 -> "1.5 KB" (1 KB = 1024 bytes, as storage is measured). */
export function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n
  let i = -1
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1 }
  return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} ${units[i]}`
}

/** "$0.04" (four places under a cent, so a small daily charge is not shown as $0.00). */
export function formatUsd(amount) {
  const n = Number(amount) || 0
  if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

/**
 * The usage meter's state: 'paused' (writes refused: the balance could not pay), 'charging' (over the free amount),
 * 'warn' (at the warning line, 80% of the free amount), else 'ok'.
 */
export function usageLevel(usage) {
  const u = usage || {}
  if (u.writes_refused) return 'paused'
  if (Number(u.over_free_bytes) > 0) return 'charging'
  if (u.warn_at_bytes != null && Number(u.bytes) >= Number(u.warn_at_bytes)) return 'warn'
  return 'ok'
}

/** A CSV import's errors, in file order, as lines a person reads: "Row 3, email: not an email". Row 1 is the header. */
export function csvErrorLines(errors) {
  return [...(errors || [])]
    .sort((a, b) => (Number(a.row) || 0) - (Number(b.row) || 0))
    .map((e) => {
      const where = [e.row != null ? (Number(e.row) === 1 ? 'Header' : `Row ${e.row}`) : '', e.column ? `column ${e.column}` : '']
        .filter(Boolean).join(', ')
      return where ? `${where}: ${e.message}` : String(e.message || '')
    })
}

/** The sentence for a failed request: the server's own words, with what to do when writes are paused. */
export function apiErrorText(err, fallback) {
  const d = err?.response?.data
  if (d?.code === 'storage_unpaid') return d.error || 'Writes are paused: the balance could not pay for storage. Top up, or delete rows.'
  if (d && (d.error || d.detail)) {
    const text = String(d.error || d.detail)
    // A message that already names its column ("Column 'email' is unique ...") is not told it again (ADM-1367).
    const named = !!d.column && text.includes(`'${d.column}'`)
    const where = [d.row != null ? `row ${d.row}` : '', d.column && !named ? `column ${d.column}` : ''].filter(Boolean).join(', ')
    return where ? `${text} (${where})` : text
  }
  if (err?.response) return `${fallback} (error ${err.response.status}).`
  return `${fallback}. Check your connection.`
}
