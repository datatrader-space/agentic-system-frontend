import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { startKeys, trainApi, START_MS, runStateText, machineFeeLine, NO_ANSWER_START } from '../src/api/train.js';

// Live, 2026-11-17: "Start training" said "The request took too long" (15 s) while the run had been made on RunPod,
// and pressing Start again made a new key, so a second paid run.
test('the same start pressed again keeps its key; a changed form or a started run gets a new one', () => {
  let made = 0;
  const keys = startKeys(() => `k${++made}`);
  const form = { version: 'v1', model: 'rf-detr', size: 'Small', epochs: 10, max_runtime: 3600 };
  assert.equal(keys.keyFor(form), 'k1');
  assert.equal(keys.keyFor({ ...form }), 'k1');                       // no answer came back: the retry is the same start
  assert.equal(keys.keyFor({ ...form, epochs: 20 }), 'k2');           // the person changed the form: another start
  assert.equal(keys.keyFor({ ...form, epochs: 20 }), 'k2');
  keys.started();                                                      // a run was made: the next press is a new start
  assert.equal(keys.keyFor({ ...form, epochs: 20 }), 'k3');
  assert.match(NO_ANSWER_START, /does not start a second run/);
});

test('a start waits far longer than a page read before it gives up', async () => {
  assert.ok(START_MS >= 120000);
  mock.timers.enable({ apis: ['setTimeout'] });
  const realFetch = globalThis.fetch;
  let answer; let sent;
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
    sent = { url, options };
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    answer = () => resolve(new Response(JSON.stringify({ number: 7, version: 'v1' }), { status: 201, headers: { 'content-type': 'application/json' } }));
  });
  try {
    const started = trainApi.start('~3', { version: 'v1', key: 'k1' });
    mock.timers.tick(30000);                                           // RunPod took 20 to 30 s: not given up
    answer();
    const run = await started;
    assert.equal(run.number, 7);
    assert.equal(sent.url, '/api/training-data/app/projects/~3/runs/');
    assert.equal(JSON.parse(sent.options.body).key, 'k1');
  } finally { globalThis.fetch = realFetch; mock.timers.reset(); }
});

test('a run whose job has said nothing yet says its real state, not always "Starting…"', () => {
  const run = (over = {}) => ({ unfinished: true, state: 'starting', attempts: [], ...over });
  assert.equal(runStateText(run({ state: 'running' })), 'Training…');
  assert.equal(runStateText(run({ attempts: [{ number: 1, state: 'running' }] })), 'Training…');   // the attempt is ahead
  assert.equal(runStateText(run({ state: 'finalizing' })), 'Checking the result…');
  assert.equal(runStateText(run({ state: 'queued' }), true), 'Waiting for a GPU machine: one run trains at a time.');
  assert.equal(runStateText(run({ state: 'queued' }), false), 'Waiting for the CPU: one run trains at a time.');
  assert.equal(runStateText(run({ on_own_machine: true })), 'Waiting for your machine to take the job…');
  assert.equal(runStateText(run({ on_own_machine: true, state: 'running' })), 'Training…');
  assert.equal(runStateText(run({ attempts: [{ number: 1, state: 'starting', submitted_at: '2026-11-17T10:00:00Z' }] })), 'Starting the machine it trains on…');
  assert.equal(runStateText(run()), 'Starting…');
  // A machine run's own words (run detail's ``machine.label``) come first; without them the states are read.
  assert.equal(runStateText(run({ on_own_machine: true, machine: { id: 4, name: 'X', label: '  Waiting for your machine X: it is running another job (run 3 of Walls). This one starts when it ends.  ' } })),
    'Waiting for your machine X: it is running another job (run 3 of Walls). This one starts when it ends.');
  assert.equal(runStateText(run({ on_own_machine: true, machine: { id: 4, name: 'X', label: '' } })), 'Waiting for your machine to take the job…');
  assert.equal(runStateText(run({ waiting: 'not a field the server sends' })), 'Starting…');
  assert.equal(runStateText({ unfinished: false, state: 'succeeded' }), '');
  assert.equal(runStateText(null), '');
});

test('a run on the person\'s own machine names the platform fee "Where it trains" shows, never "no cost"', () => {
  assert.equal(machineFeeLine({ name: '235e1456c44f', price_text: '$0.10 an hour, on your machine' }),
    'Your machine 235e1456c44f: the platform fee, $0.10 an hour, on your machine, charged by the second it trains');
  assert.equal(machineFeeLine({ name: 'box', price_text: '' }), 'Your machine box: the platform fee for your machine, charged by the second it trains');
  assert.doesNotMatch(machineFeeLine({ name: 'box', price_text: '$0.10 an hour' }), /no .*cost/i);
  assert.equal(machineFeeLine(null), '');
});
