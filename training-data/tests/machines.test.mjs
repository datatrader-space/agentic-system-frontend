import test from 'node:test';
import assert from 'node:assert/strict';
import {
  machinesApi, machineState, capabilityLine, lastSeen, secondsLeft, expiryLine, containsSecret, commandFor, projectsLine,
  jobState, isActive,
} from '../src/api/machines.js';

const IMAGE = 'public.ecr.aws/r2c3x3w0/aadml-machine@sha256:' + 'a'.repeat(64);
const CODE = 'aadml_join_Zx9-abc';
// What POST workspace/machines/ answers (machines_api.py).
const added = {
  code: CODE,
  command: `docker run -d --name aadml-machine --restart unless-stopped --gpus all -v aadml-machine:/var/lib/aadml -v /var/run/docker.sock:/var/run/docker.sock -e AADML_URL=https://aadml.com -e AADML_JOIN=${CODE} ${IMAGE}`,
  command_cpu: `docker run -d --name aadml-machine --restart unless-stopped -v aadml-machine:/var/lib/aadml -v /var/run/docker.sock:/var/run/docker.sock -e AADML_URL=https://aadml.com -e AADML_JOIN=${CODE} ${IMAGE}`,
  expires_at: '2026-10-28T10:10:00Z', minutes: 10,
};

test('the command is shown with or without the GPU, and never when it would hold a key', () => {
  assert.ok(commandFor(added, true).includes('--gpus all'));
  assert.ok(!commandFor(added, false).includes('--gpus all'));
  assert.ok(commandFor(added).includes(`-e AADML_JOIN=${CODE}`));
  assert.equal(containsSecret(commandFor(added)), false);
  for (const leak of [' -e KEY=aadml_mk_abc', ' -e T=aadml_job_x', ' -H "Authorization: Bearer x"', ' AKIAABCDEFGHIJKLMNOP']) {
    assert.equal(commandFor({ ...added, command: added.command + leak }), '', leak);
  }
  assert.equal(commandFor({ command: 'curl https://x | sh' }), '');
  assert.equal(commandFor({ command: 'docker run x' }), '');                   // no join code: not the command
  assert.equal(commandFor(null), '');
});

test('the join code says how long it still works, once', () => {
  const now = Date.parse('2026-10-28T10:00:00Z');
  assert.equal(secondsLeft(added.expires_at, now), 600);
  assert.equal(expiryLine(added.expires_at, now), 'This code works for 10 more minutes, once.');
  assert.equal(expiryLine('2026-10-28T10:00:30Z', now), 'This code works for less than a minute more, once.');
  assert.equal(expiryLine('2026-10-28T09:59:00Z', now), 'This code has expired. Make a new one to add the machine.');
  assert.equal(secondsLeft('not a time', now), 0);
});

test('a machine is shown by its state, what it has and when it was last seen', () => {
  assert.deepEqual(machineState({ state: 'online' }), ['green', 'Online']);
  assert.deepEqual(machineState({ state: 'offline' }), ['neutral', 'Offline']);
  assert.equal(capabilityLine({ cpus: 8, memory_gb: 32, disk_gb: 200.5, gpus: [{ name: 'NVIDIA RTX 4090', memory_gb: 24 }] }),
    '8 CPUs, 32 GB memory, 200.5 GB free disk, NVIDIA RTX 4090 (24 GB)');
  assert.equal(capabilityLine({ cpus: 1, gpus: [] }), '1 CPU, no GPU');
  assert.equal(capabilityLine(null), 'no GPU');
  const now = Date.parse('2026-10-28T10:00:00Z');
  assert.equal(lastSeen('2026-10-28T09:59:40Z', now), 'Seen just now');
  assert.equal(lastSeen('2026-10-28T09:57:00Z', now), 'Seen 3 minutes ago');
  assert.equal(lastSeen('2026-10-28T08:59:00Z', now), 'Seen 1 hour ago');
  assert.equal(lastSeen(null, now), 'Not seen yet');
  assert.equal(projectsLine({ projects: [] }), 'Every project');
  assert.equal(projectsLine({ projects: [{ id: 1, name: 'Leads' }, { id: 2, name: 'Walls' }] }), 'Only Leads, Walls');
});

test('a job is shown in words', () => {
  assert.deepEqual(jobState({ state: 'queued', kind: 'serve' }), ['purple', 'Waiting for the machine']);
  assert.deepEqual(jobState({ state: 'running', kind: 'serve', health: { ok: true } }), ['green', 'Running']);
  assert.deepEqual(jobState({ state: 'running', kind: 'serve', health: { ok: false } }), ['neutral', 'Not answering']);
  assert.deepEqual(jobState({ state: 'running', kind: 'train' }), ['green', 'Training']);
  assert.deepEqual(jobState({ state: 'running', stopping: true }), ['neutral', 'Stopping']);
  assert.deepEqual(jobState({ state: 'uploaded' }), ['purple', 'Checking the result']);
  assert.equal(isActive({ state: 'running' }), true);
  assert.equal(isActive({ state: 'failed' }), false);
});

test('the calls: list, add, remove, projects, each to its own route with the CSRF token on writes', async () => {
  const seen = [];
  globalThis.document = { cookie: 'csrftoken=tok' };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}) };
  };
  try {
    await machinesApi.list();
    await machinesApi.add();
    await machinesApi.remove(7);
    await machinesApi.setProjects(7, [3]);
  } finally { globalThis.fetch = original; delete globalThis.document; }
  assert.deepEqual(seen.map(s => [s.init.method, s.url]), [
    ['GET', '/api/training-data/app/workspace/machines/'],
    ['POST', '/api/training-data/app/workspace/machines/'],
    ['POST', '/api/training-data/app/workspace/machines/7/remove/'],
    ['POST', '/api/training-data/app/workspace/machines/7/projects/'],
  ]);
  assert.deepEqual(JSON.parse(seen[1].init.body), { projects: [] });
  assert.deepEqual(JSON.parse(seen[3].init.body), { projects: [3] });
  assert.equal(seen[2].init.headers['X-CSRFToken'], 'tok');
});
