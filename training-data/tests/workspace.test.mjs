import test from 'node:test';
import assert from 'node:assert/strict';
import { query, trySteps, environmentState, modelName, timeAgo, bytesText, projectLink, openLink, workflowLink, workspaceApi, publishedApi } from '../src/api/workspace.js';
import { readDeepLink } from '../src/api/notifications.js';

test('a query string carries only the values that are set', () => {
  assert.equal(query({ kind: 'received', project: '', before: null }), 'kind=received');
  assert.equal(query({ kind: 'predictions', project: '~5', before: '2026-10-20T06:00:00+00:00' }), 'kind=predictions&project=%7E5&before=2026-10-20T06%3A00%3A00%2B00%3A00');
  assert.equal(query({}), '');
});

test('a project page is opened by the address App.vue follows', () => {
  assert.deepEqual(readDeepLink(projectLink('~5', 'models')), { ref: '~5', page: 'models', assignment: null });
  assert.deepEqual(readDeepLink(projectLink('leads', 'deploy')), { ref: 'leads', page: 'deploy', assignment: null });
  assert.equal(workflowLink(12), '/dashboard/workflow-builder/12');
});

test('the steps of trying a published model follow where it stands', () => {
  const states = phase => trySteps(phase).map(step => step.state);
  assert.deepEqual(states({ phase: 'idle', published: null }), ['next', 'next', 'next']);
  assert.deepEqual(states({ phase: 'idle', published: { state: 'ready' } }), ['done', 'next', 'next']);   // made ready before
  assert.deepEqual(states({ phase: 'preparing', published: { state: 'preparing' } }), ['now', 'next', 'next']);
  assert.deepEqual(states({ phase: 'starting', published: { state: 'ready' } }), ['done', 'now', 'next']);
  assert.deepEqual(states({ phase: 'ready', published: { state: 'ready' } }), ['done', 'done', 'done']);
  assert.deepEqual(states({ phase: 'failed', published: { state: 'failed' } }), ['failed', 'next', 'next']);
  assert.deepEqual(states(null), ['next', 'next', 'next']);
});

test('an environment is said as what it does now', () => {
  assert.deepEqual(environmentState({ live: { healthy: true } }), ['green', 'Live']);
  assert.deepEqual(environmentState({ live: { healthy: null } }), ['green', 'Live']);            // not checked yet
  assert.deepEqual(environmentState({ live: { healthy: false } }), ['amber', 'Not answering']);
  assert.deepEqual(environmentState({ live: null, starting: { number: 2 } }), ['purple', 'Starting']);
  assert.deepEqual(environmentState({ live: null, starting: null, stopped: true }), ['neutral', 'Stopped']);
  assert.deepEqual(environmentState({ live: null, starting: null, stopped: false }), ['neutral', 'Not deployed']);
  assert.equal(modelName({ name: 'fmw-walls', version: '1.0.0', smoke: true }), 'fmw-walls 1.0.0 (smoke test)');
  assert.equal(modelName(null), '');
});

test('times and sizes are said as a person says them', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  assert.equal(timeAgo('2026-10-20T11:59:30Z', now), 'just now');
  assert.equal(timeAgo('2026-10-20T11:59:00Z', now), '1 minute ago');
  assert.equal(timeAgo('2026-10-20T09:00:00Z', now), '3 hours ago');
  assert.equal(timeAgo('2026-10-18T12:00:00Z', now), '2 days ago');
  assert.match(timeAgo('2026-09-01T12:00:00Z', now), /2026/);
  assert.equal(timeAgo('', now), '');
  assert.deepEqual([bytesText(500), bytesText(2048), bytesText(3 * 1024 * 1024), bytesText(null)], ['500 B', '2 KB', '3.0 MB', '']);
});

test('a link of this page changes only the hash; any other is followed', () => {
  const visits = [];
  const where = { pathname: '/dashboard/training-data/', hash: '', assign: url => visits.push(url) };
  openLink('/dashboard/training-data/#project/~5/annotate/2', where);
  assert.equal(where.hash, 'project/~5/annotate/2');
  openLink('#notifications', where);
  assert.equal(where.hash, 'notifications');
  openLink('/dashboard/billing', where);
  openLink('', where);
  assert.deepEqual(visits, ['/dashboard/billing']);
});

test('the pages ask the backend at its own addresses, and workflows at AADML\'s', async () => {
  const asked = [];
  const fetchImpl = async (url, init) => { asked.push([init.method, url]); return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    await workspaceApi.models();
    await workspaceApi.events({ kind: 'predictions', project: '~5' });
    await workspaceApi.audit({ outcome: 'denied' });
    await workspaceApi.workflows();
    await publishedApi.state('segformer-b0');
    await publishedApi.act('segformer-b0', 'start');
  } finally { globalThis.fetch = original; }
  assert.deepEqual(asked, [
    ['GET', '/api/training-data/app/workspace/models/'],
    ['GET', '/api/training-data/app/workspace/events/?kind=predictions&project=%7E5'],
    ['GET', '/api/training-data/app/workspace/audit/?outcome=denied'],
    ['GET', '/api/workflow-graphs/'],
    ['GET', '/api/training-data/app/published/segformer-b0/'],
    ['POST', '/api/training-data/app/published/segformer-b0/start/'],
  ]);
});
