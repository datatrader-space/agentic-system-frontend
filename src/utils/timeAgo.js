// "3 days ago" for an ISO time: Source control's history and the editor's blame (ADM-1205, ADM-1321).
export function ago(iso, now = Date.now()) {
  const t = Date.parse(iso)
  if (!t) return ''
  const s = Math.max(0, (now - t) / 1000)
  if (s < 60) return 'just now'
  const [n, u] = s < 3600 ? [s / 60, 'minute'] : s < 86400 ? [s / 3600, 'hour'] : s < 2592000 ? [s / 86400, 'day']
    : s < 31536000 ? [s / 2592000, 'month'] : [s / 31536000, 'year']
  const k = Math.floor(n)
  return `${k} ${u}${k === 1 ? '' : 's'} ago`
}
