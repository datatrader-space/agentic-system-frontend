// What the Let's Code editor last read for a project: its folders, its files and its Source control status
// (ADM-1196). Shown at once on the next open, then replaced by the fresh answer, as VS Code does: a folder took
// 3.7 s and Source control 4.6 s on prod (2026-11-10), and the person waited for the same answer each time.
//
// Folders and the status are kept for the browser tab's session (sessionStorage), so a reload shows them at once;
// file contents only in memory, for the page's life. Storage can be full or switched off: then this is memory only,
// and nothing else changes.

const mem = new Map()
const PREFIX = 'lc-cache:'

function k(repoId, kind, path = '') {
  return `${PREFIX}${repoId}:${kind}:${path}`
}

function read(key, persist) {
  if (mem.has(key)) return mem.get(key)
  if (!persist) return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const value = JSON.parse(raw)
    mem.set(key, value)
    return value
  } catch {
    return null
  }
}

function write(key, value, persist) {
  mem.set(key, value)
  if (!persist) return
  try { window.sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* full or blocked: memory only */ }
}

export const projectCache = {
  dir: {
    get: (repoId, path) => read(k(repoId, 'dir', path || ''), true),
    set: (repoId, path, entries) => write(k(repoId, 'dir', path || ''), entries, true),
    // Changed in the project (the watch said so): read again on its next open, never shown as it was.
    drop: (repoId, path) => {
      const key = k(repoId, 'dir', path || '')
      mem.delete(key)
      try { window.sessionStorage.removeItem(key) } catch { /* storage blocked */ }
    },
  },
  file: {
    get: (repoId, path) => read(k(repoId, 'file', path), false),
    set: (repoId, path, content) => write(k(repoId, 'file', path), content, false),
  },
  status: {
    get: (repoId) => read(k(repoId, 'status'), true),
    set: (repoId, data) => write(k(repoId, 'status'), data, true),
  },
  // Everything kept, for everyone: a sign-in, a sign-out or a change of credentials (api.js clearApiCache), so a
  // project's file names are never shown to the next person on this browser tab.
  clearAll() {
    mem.clear()
    try {
      for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
        const key = window.sessionStorage.key(i)
        if (key && key.startsWith(PREFIX)) window.sessionStorage.removeItem(key)
      }
    } catch { /* storage blocked */ }
  },
  // Everything kept for one project: it answered "not found" or "not yours", or it was deleted.
  forget(repoId) {
    const p = `${PREFIX}${repoId}:`
    for (const key of [...mem.keys()]) if (key.startsWith(p)) mem.delete(key)
    try {
      for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
        const key = window.sessionStorage.key(i)
        if (key && key.startsWith(p)) window.sessionStorage.removeItem(key)
      }
    } catch { /* storage blocked */ }
  },
}
