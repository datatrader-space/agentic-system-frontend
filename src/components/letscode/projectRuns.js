// The phone view's chats of ONE Let's Code project and what each is doing (ADM-1330).
//
// The rows come from the person's sessions (backend run_coordinator/services/run_sessions.py, the same list the
// Sessions page reads): a chat that is working or waiting for the person is one of its rows, and its `chat_url` names
// the project it belongs to. Only the person's own runs are listed; the server filters them. The project's other chats
// come from its chat history (`getConversations({ repository })`). Nothing here decides an approval: a waiting card is
// answered in its chat, with the chat's own card, and the server checks who answers.
//
// The browser notification for a chat that starts waiting lives here, with the phone view, and not in
// composables/useRunNotifications.js: that module is part of the first-load bundle (the chat store imports it), and
// this one loads only with Let's Code. It uses that module's `pageIsFocused`, the one test of "the person is looking".
import { pageIsFocused } from '@/composables/useRunNotifications'

export const RUNNING_STATES = ['needs_input', 'working']

// The project a session row belongs to: its `chat_url` is `/dashboard/lets-code?project=<id>` for a project's chat.
export function projectOfChatUrl(url) {
  const s = String(url || '')
  if (!s.startsWith('/dashboard/lets-code')) return ''
  const q = s.indexOf('?')
  if (q < 0) return ''
  try { return new URLSearchParams(s.slice(q + 1)).get('project') || '' } catch { return '' }
}

// Every running row of the person's sessions that belongs to this project: { [conversationId]: row }. Each state's
// list is read to its end (no page is skipped). `chatIds`: the project's chats from its history, for a row whose
// address names no project.
export async function loadRunningRows(api, repoId, chatIds = new Set()) {
  const repo = String(repoId)
  const out = {}
  for (const state of RUNNING_STATES) {
    let cursor = ''
    const seen = new Set()
    do {
      const { data } = await api.getSessions({ state, ...(cursor ? { cursor } : {}) })
      for (const row of data?.sessions || []) {
        const cid = String(row?.conversation_id ?? '')
        if (!cid) continue
        if (projectOfChatUrl(row.chat_url) === repo || chatIds.has(cid)) out[cid] = row
      }
      const next = data?.next_cursor || ''
      if (!next || seen.has(next)) break
      seen.add(next)
      cursor = next
    } while (cursor)
  }
  return out
}

// What a chat is doing, as the phone view shows it. The chat open on screen says so itself (its card, its stream);
// another chat is what the server's row says, or what its socket left running in this page said last.
export function chatState(id, { chat, running }) {
  const cid = String(id)
  if (chat && cid === String(chat.conversationId || '')) {
    if ((chat.hitlRequests || []).length) return 'needs_input'
    if (chat.isBusy) return 'working'
  }
  const row = running && running[cid]
  if (row && RUNNING_STATES.includes(row.state)) return row.state
  const parked = chat && chat.parkedRuns && chat.parkedRuns[cid]
  if (parked) return parked
  return 'idle'
}

// The project's chats for the list: those that need the person first, then those working, then the rest in the
// history's own order (newest first). A running chat the history did not list (a newer page) is still shown.
export function projectChats({ conversations = [], running = {}, chat = null, title = (c) => c.title || '' }) {
  const byId = new Map()
  for (const c of conversations) if (c && c.id != null) byId.set(String(c.id), { id: String(c.id), title: title(c), updatedAt: c.updated_at || '' })
  for (const [cid, row] of Object.entries(running)) {
    if (!byId.has(cid)) byId.set(cid, { id: cid, title: row.title || '', updatedAt: row.updated_at || '' })
  }
  const order = { needs_input: 0, working: 1 }
  const list = [...byId.values()].map((c, i) => {
    const state = chatState(c.id, { chat, running })
    const row = running[c.id]
    return { ...c, state, summary: row && RUNNING_STATES.includes(state) ? String(row.summary || '') : '', at: i }
  })
  return list.sort((a, b) => ((order[a.state] ?? 2) - (order[b.state] ?? 2)) || (a.at - b.at))
}

// The browser's permission for notifications: 'granted' | 'denied' | 'default', or '' with no Notification API.
export function notifyPermission() {
  try { return typeof Notification === 'undefined' ? '' : String(Notification.permission || '') } catch { return '' }
}

// The person pressed "Turn on": ask the browser (it shows its own question, never ours). Resolves to the permission.
export async function requestNotifyPermission() {
  try {
    if (typeof Notification === 'undefined') return ''
    if (Notification.permission === 'default') await Notification.requestPermission()
  } catch { /* the browser refused to ask: the permission says so */ }
  return notifyPermission()
}

// The browser notification for a Let's Code chat that now WAITS for the person (an approval, a question), raised while
// the page is not in front of them. The server's own notification (the bell, and an e-mail when the person allows it)
// is sent either way; this one reaches a phone whose page is open in the background. Clicking it opens that chat in
// its project. `title` / `body`: the caller's words (the editor's catalogue).
export function notifyChatNeedsYou({ title, body = '', conversationId, repoId }) {
  try {
    if (notifyPermission() !== 'granted' || !conversationId || !repoId || pageIsFocused()) return
    const n = new Notification(String(title || ''), { body: String(body || '').replace(/\s+/g, ' ').trim().slice(0, 140),
      tag: `needs-${conversationId}`, icon: '/icon-192.png' })
    n.onclick = () => {
      try { window.focus() } catch { /* */ }
      try {
        const target = `/dashboard/lets-code?project=${encodeURIComponent(repoId)}&chat=${encodeURIComponent(conversationId)}`
        if (window.location.pathname + window.location.search !== target) window.location.assign(target)
      } catch { /* */ }
      try { n.close() } catch { /* */ }
    }
  } catch { /* best-effort: the server's notification still reaches the person */ }
}
