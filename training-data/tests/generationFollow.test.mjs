import test from 'node:test';
import assert from 'node:assert/strict';
import { followGeneration, GENERATION_POLL_MS } from '../src/api/workspace.js';

// Live, 2026-11-27: sd-turbo made its image in 13 s on the server, but the Try panel showed nothing: it took the
// immediate 202 {generation_id, status: 'queued'} as the finished answer and never asked again.
const noWait = { wait: async () => {} };

test('a queued generation is asked for until it is done, and the first answer\'s fields are kept', async () => {
  const states = ['queued', 'running', 'done'];
  const asked = [];
  const done = await followGeneration({ generation_id: 'g1', status: 'queued', free_left: 19, charged: false }, {
    ...noWait,
    ask: async id => { asked.push(id); const status = states.shift(); return { generation_id: id, status, ...(status === 'done' ? { images: [{ url: 'https://x/a.png', width: 1024, height: 1024 }], seed: 7 } : {}) }; },
  });
  assert.deepEqual(asked, ['g1', 'g1', 'g1']);
  assert.equal(done.status, 'done');
  assert.equal(done.images[0].width, 1024);
  assert.equal(done.free_left, 19);                       // the free-tries count of the first answer is kept
  assert.equal(GENERATION_POLL_MS, 2000);
});

test('a refused generation throws the server\'s words and field', async () => {
  await assert.rejects(
    followGeneration({ generation_id: 'g2', status: 'queued' }, { ...noWait, ask: async () => ({ status: 'refused', error: { message: 'The prompt is refused.', field: 'prompt', code: 'moderation' } }) }),
    e => e.message === 'The prompt is refused.' && e.field === 'prompt' && e.code === 'moderation');
});

test('an answer that is already finished (an older server) is returned as it is, nothing asked', async () => {
  let asked = 0;
  const whole = { images: [{ url: 'https://x/b.png' }], seed: 3 };
  assert.equal(await followGeneration(whole, { ...noWait, ask: async () => { asked += 1; return {}; } }), whole);
  assert.equal(asked, 0);
});

test('it gives up after its longest wait with words, never forever', async () => {
  let t = 0;
  await assert.rejects(
    followGeneration({ generation_id: 'g3', status: 'queued' }, { wait: async () => { t += 10 * 60 * 1000; }, now: () => t, ask: async () => ({ status: 'running' }) }),
    /did not finish in time/);
});
