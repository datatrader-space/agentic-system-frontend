// Where Video Studio lives in the app (CR-2, owner, 2026-11-19): under the main dashboard's address, with its own
// shell (VideoStudioShell), never inside the AppShell layout. Every Studio link is built from STUDIO_BASE; the old
// address (LEGACY_STUDIO_BASE) only redirects, because links to it are already in chats, emails and notifications.
export const STUDIO_BASE = '/dashboard/video-studio'
export const LEGACY_STUDIO_BASE = '/video-studio'

/** The Studio address of a page: studioPath() is Discover, studioPath('library') is the Library. */
export function studioPath(page = '') {
  const clean = String(page || '').replace(/^\/+/, '')
  return clean ? `${STUDIO_BASE}/${clean}` : STUDIO_BASE
}

function under(path, base) { return path === base || path === `${base}/` || String(path).startsWith(`${base}/`) }

/** True for every Studio address, the current one and the old one. */
export function isStudioPath(path = '') { return under(path, STUDIO_BASE) || under(path, LEGACY_STUDIO_BASE) }

/** The current address of an old /video-studio/... path (an already-current path comes back unchanged). */
export function currentStudioPath(path = '') {
  if (!under(path, LEGACY_STUDIO_BASE)) return path
  const rest = String(path).slice(LEGACY_STUDIO_BASE.length).replace(/^\/+/, '')
  return studioPath(rest)
}

/** Discover: the Studio's home page (with or without a trailing slash). */
export function isStudioHome(path = '') { return path === STUDIO_BASE || path === `${STUDIO_BASE}/` }
