// Quick open (Ctrl+P) in the Let's Code editor (ADM-1205, phase A): what was typed, and the files in the order a
// person expects, as VS Code's Go to File.
//
// "app.py:42" opens app.py at line 42. Text with a "/" is matched against the path ("api/views"), otherwise against
// the file's name first: the name itself, then a name that starts with it, then one that contains it, then a path
// that contains it. Every match is kept (the server lists every file whose name matches; nothing is cut here).

export function parseQuery(raw) {
  const m = /^(.*?)(?::(\d+))?\s*$/.exec(String(raw || '').trim())
  return { text: (m && m[1]) || '', line: m && m[2] ? Number(m[2]) : null }
}

// The word the server's name search is asked for: the last part of what was typed.
export function searchTerm(text) {
  return String(text || '').split('/').filter(Boolean).pop() || ''
}

export function rank(entries, text) {
  const q = String(text || '').toLowerCase()
  if (!q) return []
  const byPath = q.includes('/')
  const scored = []
  for (const e of entries || []) {
    const name = String(e.name || e.path.split('/').pop()).toLowerCase()
    const path = String(e.path || '').toLowerCase()
    let score = -1
    if (byPath) score = path.endsWith(q) ? 1 : path.includes(q) ? 3 : -1
    else if (name === q) score = 0
    else if (name.startsWith(q)) score = 1
    else if (name.includes(q)) score = 2
    else if (path.includes(q)) score = 3
    if (score >= 0) scored.push({ e, score })
  }
  scored.sort((a, b) => a.score - b.score || a.e.path.length - b.e.path.length || a.e.path.localeCompare(b.e.path))
  return scored.map((s) => s.e)
}

// [{text, hit}] marking the first place `q` occurs in `s` (case-insensitive).
export function mark(s, q) {
  const str = String(s || '')
  const i = q ? str.toLowerCase().indexOf(String(q).toLowerCase()) : -1
  if (i < 0) return [{ text: str, hit: false }]
  return [
    ...(i ? [{ text: str.slice(0, i), hit: false }] : []),
    { text: str.slice(i, i + q.length), hit: true },
    ...(i + q.length < str.length ? [{ text: str.slice(i + q.length), hit: false }] : []),
  ]
}

// The files opened most recently, newest first, per project (a history, kept in this browser).
const RECENT_KEEP = 30
const recentKey = (repo) => `lets-code:recent:${repo}`
export function recentFiles(repo) {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey(repo)) || '[]')
    return Array.isArray(v) ? v.filter((p) => typeof p === 'string' && p) : []
  } catch { return [] }
}
export function noteOpened(repo, path) {
  if (!path) return
  const list = [path, ...recentFiles(repo).filter((p) => p !== path)].slice(0, RECENT_KEEP)
  try { localStorage.setItem(recentKey(repo), JSON.stringify(list)) } catch { /* kept for this visit only */ }
}
export function forgetRecent(repo, path) {
  const list = recentFiles(repo).filter((p) => p !== path && !p.startsWith(`${path}/`))
  try { localStorage.setItem(recentKey(repo), JSON.stringify(list)) } catch { /* nothing kept */ }
}
