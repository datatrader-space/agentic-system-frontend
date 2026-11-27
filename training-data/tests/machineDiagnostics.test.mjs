// Machine diagnostics on the Your machines page (agent 1.9.7, ADM-1394; backend machine_diagnostics.py): the words and
// the wait for the machine's answer. The backend checks every request; these helpers only show it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diagnoseWhy, runDiagnostic, diagnosticWords, containerState, containerWhat, endedLine, systemLines, DIAGNOSE_AGENT,
  DIAGNOSE_LINES, DIAGNOSE_DEFAULT_LINES,
} from '../src/api/machines.js';

const online = { id: 9, name: 'machine 9', state: 'online', agent_version: '1.9.7', diagnostics: true, diagnostics_agent: '1.9.7' };

test('a machine is asked only when it is online and its agent answers diagnostics', () => {
  assert.equal(diagnoseWhy(online), '');
  assert.match(diagnoseWhy({ ...online, state: 'offline' }), /^machine 9 is offline/);
  assert.equal(diagnoseWhy({ ...online, agent_version: '1.9.6', diagnostics: false }),
    'Diagnostics need agent 1.9.7. machine 9 runs 1.9.6; it updates itself when it is idle.');
  // A row from before the backend said it: the version decides.
  assert.equal(diagnoseWhy({ name: 'x', state: 'online', agent_version: '1.10.0' }), '');
  assert.match(diagnoseWhy({ name: 'x', state: 'online', agent_version: '' }), /runs an older agent/);
  assert.equal(DIAGNOSE_AGENT, '1.9.7');
  assert.ok(DIAGNOSE_LINES.includes(DIAGNOSE_DEFAULT_LINES) && Math.max(...DIAGNOSE_LINES) === 2000);
});

test('the page asks once, reads the request until the machine answered, and stops waiting in time', async () => {
  const calls = [];
  const answers = [{ request: { state: 'pending' } }, { request: { state: 'answered', answer: { containers: [] } } }];
  const api = {
    diagnose: async (id, action, args) => { calls.push(['diagnose', id, action, args]); return { request_id: 'r1', request: { id: 'r1', state: 'pending' } }; },
    diagnosis: async (id, rid) => { calls.push(['diagnosis', id, rid]); return answers.shift(); },
  };
  const request = await runDiagnostic(api, 9, 'logs', { container: 'aadml-try-292', lines: 50 }, { sleep: async () => {} });
  assert.equal(request.state, 'answered');
  assert.deepEqual(calls, [['diagnose', 9, 'logs', { container: 'aadml-try-292', lines: 50 }], ['diagnosis', 9, 'r1'], ['diagnosis', 9, 'r1']]);
  const slow = { diagnose: async () => ({ request_id: 'r2', request: { state: 'pending' } }), diagnosis: async () => ({ request: { state: 'pending' } }) };
  let looks = 0;
  const still = await runDiagnostic(slow, 9, 'system', {}, { sleep: async () => { looks += 1; }, tries: 3 });
  assert.equal(looks, 3);
  assert.equal(still.state, 'pending');
  assert.match(diagnosticWords(still), /not answered yet/);
  let gone = false;
  const left = await runDiagnostic(slow, 9, 'system', {}, { sleep: async () => { gone = true; }, isGone: () => gone });
  assert.equal(left.state, 'pending');                            // the page closed: no more reads
});

test('a refused or expired request says the backend words; an answered one says nothing', () => {
  assert.equal(diagnosticWords({ state: 'answered', said: '' }), '');
  assert.equal(diagnosticWords({ state: 'refused', said: '"postgres" is not one of AADML\'s containers on this machine.' }),
    '"postgres" is not one of AADML\'s containers on this machine.');
  assert.match(diagnosticWords({ state: 'expired', said: '' }), /did not answer in time/);
});

test('a container is said by its state, what it is for, and how it ended', () => {
  assert.deepEqual(containerState({ state: 'running' }), ['green', 'Running']);
  assert.deepEqual(containerState({ state: 'exited', exit_code: 137, oom_killed: true }), ['neutral', 'Out of memory']);
  assert.deepEqual(containerState({ state: 'exited', exit_code: 1 }), ['neutral', 'Exited (1)']);
  assert.deepEqual(containerState({ state: 'created' }), ['neutral', 'Created']);
  assert.equal(containerWhat({ labels: { 'aadml.kind': 'try', 'aadml.job': '292' } }), 'Model server, job 292');
  assert.equal(containerWhat({ labels: {} }), 'AADML container');
  assert.equal(endedLine({ said: 'The machine ran out of memory, so Docker stopped the job (exit code 137).', container: { exit_code: 137 } }),
    'The machine ran out of memory, so Docker stopped the job (exit code 137).');
  assert.equal(endedLine({ container: { exit_code: 0 } }), 'It ended normally (exit code 0).');
  assert.equal(endedLine({ container: { exit_code: 2 } }), 'It ended with exit code 2.');
  assert.equal(endedLine({}), 'Docker did not say how it ended.');
});

test("the machine's figures are said in lines, and a Docker that does not answer says why", () => {
  const lines = systemLines({
    gpus: [{ name: 'NVIDIA GeForce RTX 3070', memory_gb: 8, free_gb: 6.6, utilization_percent: 87 }],
    disk: { free_gb: 120.5, total_gb: 500 }, memory: { total_gb: 32, available_gb: 20.1 }, cpus: 16,
    agent: { version: '1.9.7' }, docker: { answers: true, version: { Version: '27.3.1' }, info: { OperatingSystem: 'Docker Desktop' } },
  });
  assert.deepEqual(lines, [
    ['GPU', 'NVIDIA GeForce RTX 3070, 6.6 GB free of 8 GB, 87% busy'], ['Disk', '120.5 GB free of 500 GB'],
    ['Memory', '20.1 GB available of 32 GB'], ['CPUs', '16'], ['Agent', '1.9.7'], ['Docker', 'Answers, version 27.3.1 on Docker Desktop'],
  ]);
  const down = systemLines({ gpus: [], docker: { answers: false, error: 'Docker answered 500: down' } });
  assert.deepEqual(down, [['GPU', 'None the agent can use'], ['Docker', 'Does not answer: Docker answered 500: down']]);
  assert.deepEqual(systemLines(null), []);
});

test('the two calls go to the machine\'s own routes, the request with the CSRF token', async () => {
  const { machinesApi } = await import('../src/api/machines.js');
  const seen = [];
  globalThis.document = { cookie: 'csrftoken=tok' };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return { ok: true, status: 202, headers: { get: () => 'application/json' }, json: async () => ({}) };
  };
  try {
    await machinesApi.diagnose(9, 'logs', { container: 'aadml-try-292', lines: 200 });
    await machinesApi.diagnosis(9, '4a3b2c1d-0000-4000-8000-000000000001');
  } finally { globalThis.fetch = original; delete globalThis.document; }
  assert.deepEqual(seen.map(s => [s.init.method, s.url]), [
    ['POST', '/api/training-data/app/workspace/machines/9/diagnose/'],
    ['GET', '/api/training-data/app/workspace/machines/9/diagnose/4a3b2c1d-0000-4000-8000-000000000001/'],
  ]);
  assert.deepEqual(JSON.parse(seen[0].init.body), { action: 'logs', arguments: { container: 'aadml-try-292', lines: 200 } });
  assert.equal(seen[0].init.headers['X-CSRFToken'], 'tok');
});
