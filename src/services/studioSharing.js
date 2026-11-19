// Video Studio team sharing (backend agentic-docs/VIDEO_TEAM_SHARING_PLAN.md, ADM-1248). The server decides every
// permission; the pages only hide what `abilities` says a person cannot do.
import api from './api'

const enc = (v) => encodeURIComponent(String(v))
const P = (id) => `/video/projects/${enc(id)}`

export const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', editor: 'Editor', commenter: 'Commenter', viewer: 'Viewer' }
export const ROLE_HELP = {
  viewer: 'Sees the project, its files and versions',
  commenter: 'Can also comment and approve',
  editor: 'Can also edit and make media, paid from their own balance',
  manager: 'Can also invite people, change roles and make links',
}
export const INVITE_ROLES = ['viewer', 'commenter', 'editor', 'manager']
export const REVIEW_LABELS = { none: 'No review', in_review: 'In review', changes_requested: 'Changes requested', approved: 'Approved' }
export const LINK_PERMISSIONS = { view: 'Can view', comment: 'Can comment', edit: 'Can edit' }
export const LINK_AUDIENCES = { workspace: 'People in this workspace', anyone: 'Anyone signed in' }

/** The Studio's error shape is {error: {code, message, field}}; other APIs answer {error: '...'} or {detail}. */
export function errorText(e, fallback = 'Something went wrong. Please try again.') {
  const d = e?.response?.data
  if (d?.error && typeof d.error === 'object') return d.error.message || fallback
  if (typeof d?.error === 'string') return d.detail && d.error.length < 40 ? d.detail : d.error
  if (typeof d?.detail === 'string') return d.detail
  return fallback
}
export function errorCode(e) {
  const d = e?.response?.data
  return (d?.error && typeof d.error === 'object' ? d.error.code : d?.code) || ''
}

export const sharing = {
  access: (id) => api.get(`${P(id)}/access/`),
  invite: (id, email, role) => api.post(`${P(id)}/members/`, { email, role }),
  setRole: (id, userId, role) => api.patch(`${P(id)}/members/${enc(userId)}/`, { role }),
  remove: (id, userId) => api.delete(`${P(id)}/members/${enc(userId)}/`),
  createLink: (id, body) => api.post(`${P(id)}/links/`, body),
  revokeLink: (id, linkId) => api.delete(`${P(id)}/links/${enc(linkId)}/`),
  redeem: (token) => api.post('/video/share/redeem/', { token }),
  update: (id, body) => api.patch(`${P(id)}/sharing/`, body),
  review: (id, status) => api.post(`${P(id)}/review/`, { status }),
  trash: (id) => api.post(`${P(id)}/trash/`),
  restore: (id) => api.post(`${P(id)}/restore/`),
  purge: (id) => api.delete(`${P(id)}/`),
  transfer: (id, userId) => api.post(`${P(id)}/transfer/`, { user_id: userId }),
  comments: (id, params) => api.get(`${P(id)}/comments/`, { params }),
  comment: (id, body) => api.post(`${P(id)}/comments/`, body),
  editComment: (cid, body) => api.patch(`/video/comments/${enc(cid)}/`, body),
  deleteComment: (cid) => api.delete(`/video/comments/${enc(cid)}/`),
  approvals: (id, params) => api.get(`${P(id)}/approvals/`, { params }),
  decide: (id, body) => api.post(`${P(id)}/approvals/`, body),
  usage: (id) => api.get(`${P(id)}/usage/`),
  folders: (workspaceId) => api.get('/video/folders/', { params: { workspace_id: workspaceId } }),
  createFolder: (body) => api.post('/video/folders/', body),
  editFolder: (fid, body) => api.patch(`/video/folders/${enc(fid)}/`, body),
  deleteFolder: (fid) => api.delete(`/video/folders/${enc(fid)}/`),
  memberSpend: (wsId) => api.get(`/billing/workspaces/${enc(wsId)}/member-spend/`),
  setMemberSpend: (wsId, userId, body) => api.put(`/billing/workspaces/${enc(wsId)}/member-spend/${enc(userId)}/`, body),
}

/** The person's workspaces (GET /api/v2/workspaces/ answers a list). */
export async function myWorkspaces() {
  const { data } = await api.get('/v2/workspaces/')
  return Array.isArray(data) ? data : (data?.results || data?.workspaces || [])
}

// How a person is named in the Studio's project pages (ISSUE-15): "You" for the signed-in person, their display name
// when the server sends one, and their email only as the secondary line. The server's `name` is the person's full
// name, else their username, which is often their email address: an email in `name` is shown once, as the email.
const EMAIL = /^[^\s@]+@[^\s@]+$/
export function isMe(person, me) {
  const mine = me?.id ?? me?.pk, theirs = person?.id ?? person?.user_id
  return mine != null && theirs != null && String(mine) === String(theirs)
}
export function personName(person, me) {
  if (!person) return 'Someone'
  if (isMe(person, me)) return 'You'
  const name = String(person.name || '').trim()
  if (name && !EMAIL.test(name)) return name
  return String(person.email || name || '').trim() || 'Someone'
}
/** The secondary line under a person's name: their email, when it is not already the name shown. */
export function personDetail(person, me) {
  if (!person || isMe(person, me)) return ''
  const name = String(person.name || '').trim(), email = String(person.email || '').trim()
  return email && name && !EMAIL.test(name) && email !== name ? email : ''
}

export function day(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}
export function money(v) {
  const n = Number(v)
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00'
}

/** ws(s)://<host>/ws/video/canvas — the same host the page was served from (the dev proxy forwards /ws). */
export function canvasSocketBase(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return ''
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/ws/video/canvas`
}
