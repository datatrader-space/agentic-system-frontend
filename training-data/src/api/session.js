// Read-only Phase 4 entry point. No credentials are stored or supplied by this client.
import { apiFetch, activeWorkspace, ApiError } from './client.js';

export function initialsOf(name) {
  const letters = String(name || '').trim().split(/\s+/).filter(Boolean).map(w => [...w][0]).slice(0, 2).join('');
  return letters.toUpperCase() || '?';
}

// Who is signed in to AADML, and in which workspace. Called once before the page shows.
// Signed out (the API answers 401, or 403 from DRF session auth without a session) -> { signedIn: false }.
// Only the id and a display name are kept: e-mail and admin flags are not, because who you are is not
// what you may do in a project. The server decides that on every call.
export async function loadSession({ fetchImpl = fetch, timeoutMs = 8000, store } = {}) {
  let body;
  try {
    body = await apiFetch('/auth/me', { fetchImpl, timeoutMs, store });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return { signedIn: false };
    throw error;
  }
  const user = body?.user;
  if (!user || !Number.isSafeInteger(user.id) || user.id < 1) throw new ApiError(200, 'schema', 'AADML returned an unexpected answer about your sign-in.');
  const pick = v => (typeof v === 'string' ? v.trim().slice(0, 120) : '');
  const name = pick(user.full_name) || pick(user.username) || 'Signed-in user';
  const workspace = activeWorkspace(store);
  const workspaceName = workspace ? (workspace.name || 'Workspace') : 'Personal Mode';
  return {
    signedIn: true,
    user: { id: user.id, name, initials: initialsOf(name) },
    workspace: { id: workspace?.id || null, name: workspaceName, initials: initialsOf(workspaceName) },
  };
}

// The same sign-out as AADML (src/app.vue): end the server session, clear what AADML keeps in the browser,
// and go to the login page. If the server does not confirm, nothing is cleared and the error is thrown.
export async function signOut({ fetchImpl = fetch, store, session = globalThis.sessionStorage, go = url => globalThis.location.assign(url) } = {}) {
  await apiFetch('/auth/logout', { method: 'POST', fetchImpl, store });
  try { (store || globalThis.localStorage)?.clear(); session?.clear(); } catch { /* storage blocked: nothing to clear */ }
  go('/login');
}

export class ConnectionError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export async function checkSession(fetchImpl = fetch, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('/api/auth/me', {
      method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    if (response.redirected) throw new ConnectionError('redirect', 'The session endpoint redirected. Sign in through the existing application.');
    if ([401, 403].includes(response.status)) throw new ConnectionError('auth', 'No accessible session. Sign in through the existing application on the same hostname, then retry.');
    if (!response.ok) throw new ConnectionError('server', 'The local backend is unavailable or refused the request.');
    if (!(response.headers.get('content-type') || '').split(';')[0].trim().match(/^application\/(json|[\w.+-]+\+json)$/i)) {
      throw new ConnectionError('format', 'The backend returned a page instead of session data.');
    }
    let body;
    try { body = await response.json(); } catch { throw new ConnectionError('format', 'The session response could not be read.'); }
    const user = body?.user;
    if (!user || !Number.isSafeInteger(user.id) || user.id < 1) throw new ConnectionError('schema', 'The backend returned an unsupported session response.');
    // Deliberately discard email, external account IDs and admin flags. Identity is not project permission.
    return { displayName: typeof user.full_name === 'string' && user.full_name.trim() ? user.full_name.trim().slice(0, 120) : 'Signed-in user' };
  } catch (error) {
    if (error instanceof ConnectionError) throw error;
    throw new ConnectionError(controller.signal.aborted ? 'timeout' : 'network', controller.signal.aborted ? 'The session check timed out. Try again.' : 'Could not reach the local session endpoint. Check the backend and existing sign-in.');
  } finally { clearTimeout(timer); }
}
