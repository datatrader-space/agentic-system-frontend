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
