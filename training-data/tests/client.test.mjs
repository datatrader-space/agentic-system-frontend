import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, activeWorkspace, readCookie, signInUrl, ApiError } from '../src/api/client.js';
import { loadSession, signOut, initialsOf } from '../src/api/session.js';

const reply = (body, status = 200, type = 'application/json') => new Response(body, { status, headers: { 'Content-Type': type } });
const memory = (entries = {}) => {
  const data = new Map(Object.entries(entries));
  return { getItem: k => (data.has(k) ? data.get(k) : null), clear: () => data.clear(), size: () => data.size };
};
const ws = memory({ activeWorkspaceId: '7', activeWorkspace: JSON.stringify({ id: 7, name: 'Northrays Vision' }) });

test('a read sends the session cookie and the AADML workspace, never a token', async () => {
  await apiFetch('/thing', { store: ws, fetchImpl: async (url, options) => {
    assert.equal(url, '/api/thing');
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['X-Workspace-ID'], '7');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers['X-CSRFToken'], undefined);
    return reply('{"ok":true}');
  } });
});

test('a write carries the CSRF token from the cookie and a JSON body', async () => {
  await apiFetch('/thing', { method: 'post', body: { a: 1 }, store: memory(), cookies: 'x=1; csrftoken=abc%3D; y=2', fetchImpl: async (_, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-CSRFToken'], 'abc=');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(options.body, '{"a":1}');
    assert.equal(options.headers['X-Workspace-ID'], undefined);
    return reply('{}');
  } });
});

test('failures carry the status and only the server short message', async () => {
  await assert.rejects(apiFetch('/x', { store: memory(), fetchImpl: async () => reply('{"error":"Not yours.","field":"project"}', 403) }),
    e => e instanceof ApiError && e.status === 403 && e.code === 'forbidden' && e.message === 'Not yours.' && e.field === 'project');
  await assert.rejects(apiFetch('/x', { store: memory(), fetchImpl: async () => reply('Traceback secret', 500, 'text/plain') }),
    e => e.code === 'server' && !e.message.includes('secret'));
  await assert.rejects(apiFetch('/x', { store: memory(), fetchImpl: async () => reply('<html>login</html>', 200, 'text/html') }), { code: 'format' });
  await assert.rejects(apiFetch('/x', { store: memory(), fetchImpl: async () => { throw new TypeError('redirect'); } }), { code: 'network' });
});

test('workspace comes only from the AADML selection; a stale saved name is not shown', () => {
  assert.deepEqual(activeWorkspace(ws), { id: '7', name: 'Northrays Vision' });
  assert.equal(activeWorkspace(memory()), null);
  assert.deepEqual(activeWorkspace(memory({ activeWorkspaceId: '8', activeWorkspace: JSON.stringify({ id: 7, name: 'Old' }) })), { id: '8', name: '' });
  assert.equal(readCookie('csrftoken', 'csrftokenx=1'), '');
});

test('the login link returns to this exact page', () => {
  assert.equal(signInUrl({ pathname: '/dashboard/training-data/', search: '', hash: '#upload' }), '/login?next=%2Fdashboard%2Ftraining-data%2F%23upload');
});

test('start-up: a signed-in person, with name, initials and workspace; nothing private kept', async () => {
  const s = await loadSession({ store: ws, fetchImpl: async () => reply(JSON.stringify({ user: { id: 3, full_name: 'Sajid ur Rehman', username: 'sajid', email: 'a@b.c', is_platform_admin: true } })) });
  assert.deepEqual(s, { signedIn: true, user: { id: 3, name: 'Sajid ur Rehman', initials: 'SU' }, workspace: { id: '7', name: 'Northrays Vision', initials: 'NV' } });
  const p = await loadSession({ store: memory(), fetchImpl: async () => reply('{"user":{"id":4,"full_name":"","username":"lab1"}}') });
  assert.equal(p.user.name, 'lab1');
  assert.deepEqual(p.workspace, { id: null, name: 'Personal Mode', initials: 'PM' });
});

test('start-up: 401 and 403 mean signed out; other failures are errors', async () => {
  for (const status of [401, 403]) assert.deepEqual(await loadSession({ store: memory(), fetchImpl: async () => reply('{"detail":"x"}', status) }), { signedIn: false });
  await assert.rejects(loadSession({ store: memory(), fetchImpl: async () => reply('{"user":{"id":0}}') }), { code: 'schema' });
  await assert.rejects(loadSession({ store: memory(), fetchImpl: async () => reply('down', 502, 'text/plain') }), { code: 'server' });
});

test('sign out clears the browser only after the server ends the session', async () => {
  const store = memory({ activeWorkspaceId: '7' }); let went = '';
  await signOut({ store, session: memory(), cookies: undefined, go: u => { went = u; }, fetchImpl: async (url, o) => { assert.equal(url, '/api/auth/logout'); assert.equal(o.method, 'POST'); return reply('{"success":true}'); } });
  assert.equal(went, '/login'); assert.equal(store.size(), 0);
  const kept = memory({ activeWorkspaceId: '7' }); went = '';
  await assert.rejects(signOut({ store: kept, session: memory(), go: u => { went = u; }, fetchImpl: async () => reply('{"error":"no"}', 500) }));
  assert.equal(went, ''); assert.equal(kept.size(), 1);
});

test('initials', () => {
  assert.equal(initialsOf('ali'), 'A'); assert.equal(initialsOf('  '), '?'); assert.equal(initialsOf('a b c'), 'AB');
});
