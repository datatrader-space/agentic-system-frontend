import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeApi, choiceKey, modelLabel, sortedChoices, whyNot, machinesFor, portProblem, answerAt } from '../src/api/edge.js';

test('the models that may run come first, and the others say why not', () => {
  const rows = [
    { project: { ref: 'walls', id: 1 }, number: 3, name: 'fmw-walls', version: '3.0.0', may_serve: false, why_not: 'It has no approval.', refusals: [{ code: 'approval', message: 'It has no approval.' }] },
    { project: { ref: '~7', id: 7 }, number: 2, name: 'fmw-walls', version: '2.0.0', may_serve: true, environments: ['staging', 'production'], why_not: '', refusals: [] },
    { project: { ref: 'walls', id: 1 }, number: 1, name: 'fmw-walls', version: '1.0.0', may_serve: false, refusals: [{ code: 'research_only', message: 'Research use only.' }] },
  ];
  assert.deepEqual(sortedChoices(rows).map(choiceKey), ['~7#2', 'walls#3', 'walls#1']);
  assert.equal(whyNot(rows[0]), 'It has no approval.');
  assert.equal(whyNot(rows[1]), '');
  assert.equal(whyNot(rows[2]), 'Research use only.');
  assert.equal(whyNot({ may_serve: false }), 'This model cannot leave AADML.');
  assert.equal(modelLabel(rows[1]), 'fmw-walls 2.0.0');
  assert.deepEqual(sortedChoices(null), []);
  assert.equal(choiceKey(null), '');
});

test('a model is offered only the online machines that may work for its project', () => {
  const machines = [
    { id: 1, name: 'garage', state: 'online', projects: [] },
    { id: 2, name: 'lab', state: 'online', projects: [{ id: 9, name: 'Other' }] },
    { id: 3, name: 'away', state: 'offline', projects: [] },
    { id: 4, name: 'leads box', state: 'online', projects: [{ id: 7, name: 'Leads' }] },
  ];
  assert.deepEqual(machinesFor(machines, 7).map(m => m.id), [1, 4]);
  assert.deepEqual(machinesFor(machines, 9).map(m => m.id), [1, 2]);
  assert.deepEqual(machinesFor(null, 7), []);
});

test('the port is checked before anything is sent', () => {
  assert.equal(portProblem(8080), '');
  assert.equal(portProblem('8081'), '');
  for (const bad of [80, 0, 70000, 'x', 8080.5, '']) assert.notEqual(portProblem(bad), '', String(bad));
  assert.equal(answerAt(8081), 'http://<machine address>:8081/invocations');
});

test('running a model is one POST to its machine with only the project, model, environment and port', async () => {
  const seen = [];
  globalThis.document = { cookie: 'csrftoken=tok' };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}) };
  };
  try {
    await edgeApi.serve(5, { project: '~7', model: 2, environment: 'production', port: '8081', extra: 'dropped' });
    await edgeApi.stop(11);
    await edgeApi.list();
  } finally { globalThis.fetch = original; delete globalThis.document; }
  assert.equal(seen[0].url, '/api/training-data/app/workspace/machines/5/serve/');
  assert.equal(seen[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(seen[0].init.body), { project: '~7', model: 2, environment: 'production', port: 8081 });
  assert.equal(seen[0].init.headers['X-CSRFToken'], 'tok');
  assert.equal(seen[1].url, '/api/training-data/app/workspace/machine-jobs/11/stop/');
  assert.equal(seen[2].url, '/api/training-data/app/workspace/edge/');
  assert.equal(seen[2].init.method, 'GET');
  // No download route and no command exist any more.
  assert.equal(edgeApi.download, undefined);
});
