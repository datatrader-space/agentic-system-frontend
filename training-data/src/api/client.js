// The one way this page talks to the AADML backend. Same origin as AADML, so the browser sends the AADML session
// cookie; no token is stored or sent by this code. Writes carry Django's CSRF token, and every call carries the
// workspace selected in AADML, exactly as the AADML app does (src/services/api.js).
export class ApiError extends Error {
  constructor(status, code, message, field) { super(message); this.status = status; this.code = code; this.field = field; }
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function readCookie(name, source = globalThis.document?.cookie || '') {
  for (const part of source.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

// The workspace chosen in the AADML switcher; null in AADML's Personal Mode.
export function activeWorkspace(store = storage()) {
  if (!store) return null;
  try {
    const id = store.getItem('activeWorkspaceId');
    if (!id) return null;
    const saved = JSON.parse(store.getItem('activeWorkspace') || 'null');
    const name = saved && String(saved.id) === id && typeof saved.name === 'string' ? saved.name.trim().slice(0, 120) : '';
    return { id, name };
  } catch { return null; }
}

// The AADML login page, which sends the browser back here after sign-in.
export function signInUrl(where = globalThis.location) {
  return `/login?next=${encodeURIComponent(`${where.pathname}${where.search}${where.hash}`)}`;
}

export async function apiFetch(path, { method = 'GET', body, fetchImpl = fetch, timeoutMs = 15000, store = storage(), cookies } = {}) {
  method = method.toUpperCase();
  const headers = { Accept: 'application/json' };
  const workspace = activeWorkspace(store);
  if (workspace) headers['X-Workspace-ID'] = workspace.id;
  if (UNSAFE.has(method)) headers['X-CSRFToken'] = readCookie('csrftoken', cookies);
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(`/api${path}`, {
      method, headers, body: payload, credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal,
    });
  } catch {
    throw controller.signal.aborted
      ? new ApiError(0, 'timeout', 'The request took too long. Try again.')
      : new ApiError(0, 'network', 'Could not reach AADML. Check your connection and try again.');
  } finally { clearTimeout(timer); }

  if (response.status === 204) return null;
  const type = (response.headers.get('content-type') || '').split(';')[0].trim();
  let data = null;
  if (/^application\/(json|[\w.+-]+\+json)$/i.test(type)) {
    try { data = await response.json(); } catch { data = null; }
  }
  if (!response.ok) {
    // Only the server's own short message is shown; bodies that are not JSON (stack traces, HTML) never are.
    // AADML's other APIs (Video Studio's Library) answer {"error": {"code", "message", "field"}}: read that shape too.
    const nested = data?.error && typeof data.error === 'object' ? data.error : null;
    const message = typeof data?.error === 'string' ? data.error : typeof nested?.message === 'string' ? nested.message
      : typeof data?.detail === 'string' ? data.detail : 'The request was refused.';
    const refused = new ApiError(response.status, response.status === 401 ? 'auth' : response.status === 403 ? 'forbidden' : 'server', message.slice(0, 300), data?.field ?? nested?.field);
    // A refused file or list names each bad line: {line, error}, at most 50, each shown as text.
    if (Array.isArray(data?.errors)) refused.errors = data.errors.slice(0, 50).map(e => ({ line: Number(e?.line) || 0, error: String(e?.error ?? '').slice(0, 200) }));
    throw refused;
  }
  if (data === null) throw new ApiError(response.status, 'format', 'AADML returned a page instead of data.');
  return data;
}
