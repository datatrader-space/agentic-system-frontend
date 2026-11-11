import test from 'node:test';
import assert from 'node:assert/strict';
import { callCostText, catalogue, measureText, meets, msText, useSnippet, USE_LANGUAGES, SDK_INSTALL } from '../src/api/models.js';

test('a share reads as a percentage and a corner error as a share of the diagonal', () => {
  assert.equal(measureText('wall_recall', 0.9234), '92.3%');
  assert.equal(measureText('median_corner_error', 0.0125), '1.25% of the diagonal');
  assert.equal(measureText('wall_recall', null), '—');
});

test('a measure meets its threshold in its own direction, and says nothing without one', () => {
  const recall = { key: 'wall_recall', direction: 'at_least', threshold: 0.9 };
  const error = { key: 'median_corner_error', direction: 'at_most', threshold: 0.01 };
  assert.equal(meets(recall, 0.95), true);
  assert.equal(meets(recall, 0.85), false);
  assert.equal(meets(error, 0.008), true);
  assert.equal(meets(error, 0.02), false);
  assert.equal(meets(recall, null), null);
  assert.equal(meets({ ...recall, threshold: null }, 0.95), null);
});

test('the catalogue is the backend rows, filtered by words, task and family', () => {
  const rows = [{ name: 'Aadml-Vision-seg-A0', publisher: 'AADML', kind: 'Semantic segmentation', description: 'Every pixel.', family: 'vision' },
                { name: 'SAM 3', publisher: 'Meta AI', kind: 'Instance segmentation', description: 'Masks.', coming: true, family: 'vision' },
                { name: 'Qwen3-8B', publisher: 'Alibaba', kind: 'Chat', description: 'Answers.', coming: true, family: 'llm' }];
  assert.equal(catalogue(rows).length, 3);
  assert.deepEqual(catalogue(rows, 'aadml').map(row => row.name), ['Aadml-Vision-seg-A0']);
  assert.deepEqual(catalogue(rows, '', 'Instance segmentation').map(row => row.name), ['SAM 3']);
  assert.deepEqual(catalogue(rows, '', '', 'llm').map(row => row.name), ['Qwen3-8B']);
  assert.equal(catalogue(rows, '', '', 'vision').length, 2);
});

test('the Use model code calls the SDK in Python and the address otherwise, never with a key', () => {
  const url = 'https://aadml.com/api/training-data/v1/models/fmw-geometry/predict';
  assert.deepEqual(USE_LANGUAGES, ['Python SDK', 'JavaScript', 'cURL']);
  const python = useSnippet('Python SDK', url, 'fmw-geometry');
  assert.ok(python.includes('from aadml_training import Client') && python.includes('client.run("fmw-geometry", "room.jpg")'));
  assert.ok(!python.includes('requests'));
  for (const language of ['JavaScript', 'cURL']) assert.ok(useSnippet(language, url, 'fmw-geometry').includes(url), language);
  for (const language of USE_LANGUAGES) assert.ok(useSnippet(language, url, 'fmw-geometry').includes('<your app key>'), language);
  assert.equal(SDK_INSTALL, 'pip install aadml-training');
});

test('the Use model dialog says what a call costs, and no amount while no price is set', () => {
  const note = 'Each call the model answers is charged as one photo call, from the balance of the person who made the app.';
  assert.equal(callCostText({ usd_per_call: '0.00120000', cost_note: note }), `$0.0012 a call. ${note}`);
  assert.equal(callCostText({ usd_per_call: null, cost_note: note }), note);
  assert.equal(callCostText(null), '');
});

test('no page still says a paid feature waits for charging (2026-10-29: Dedicated, Use model and Cloud Streaming are open)', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const name of ['WorkspaceModels.vue', 'WorkspaceDeployments.vue', 'StreamingTab.vue']) {
    const page = await readFile(new URL(`../src/components/${name}`, import.meta.url), 'utf8');
    assert.ok(!page.includes('not_open'), name);
    assert.ok(!/charging is connected|opens with calls/.test(page), name);
    assert.ok(page.includes('cost_note'), name);
  }
});

test('a duration reads in milliseconds below a second', () => {
  assert.equal(msText(84.4), '84 ms');
  assert.equal(msText(2350), '2.4 s');
  assert.equal(msText(null), '—');
});

test('every tab of the workspace Models page has its own section (2026-10-28: a renamed tab fell through to Usage)', async () => {
  const { readFile } = await import('node:fs/promises');
  const page = await readFile(new URL('../src/components/WorkspaceModels.vue', import.meta.url), 'utf8');
  const names = [...page.match(/const tabs = \[([^\]]*)\]/)[1].matchAll(/name: '([^']+)'/g)].map(m => m[1]);
  assert.ok(names.length >= 3);
  for (const name of names.slice(0, -1)) assert.ok(page.includes(`active==='${name}'`), name);   // the last tab is the v-else
});

// A fake fetch that records every request and answers ``reply`` (JSON) with ``status``; 204 answers nothing.
function fake(reply = {}, status = 200) {
  const asked = [];
  const fetchImpl = async (url, options) => {
    asked.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, csrf: options.headers['X-CSRFToken'] });
    return { ok: status < 400, status, headers: { get: () => (status === 204 ? '' : 'application/json') }, json: async () => reply };
  };
  return { asked, opts: { fetchImpl, store: null, cookies: 'csrftoken=tok' } };
}

test('the evaluation clients ask the project\'s evaluations, one evaluation, and cancel or retry it', async () => {
  const { evaluationsApi } = await import('../src/api/models.js');
  const { asked, opts } = fake({ evaluations: [], more: false });
  await evaluationsApi.list('walls', { model: 3 }, opts);
  await evaluationsApi.list('walls', { model: 3, before: 51 }, opts);
  await evaluationsApi.list('~4', {}, opts);
  await evaluationsApi.get('walls', 7, opts);
  await evaluationsApi.cancel('walls', 7, opts);
  await evaluationsApi.retry('walls', 7, opts);
  assert.deepEqual(asked.map(a => `${a.method} ${a.url}`), [
    'GET /api/training-data/app/projects/walls/evaluations/?model=3',
    'GET /api/training-data/app/projects/walls/evaluations/?model=3&before=51',
    'GET /api/training-data/app/projects/~4/evaluations/',
    'GET /api/training-data/app/projects/walls/evaluations/7/',
    'POST /api/training-data/app/projects/walls/evaluations/7/cancel/',
    'POST /api/training-data/app/projects/walls/evaluations/7/retry/',
  ]);
  assert.deepEqual(asked.slice(4).map(a => [a.body, a.csrf]), [[{}, 'tok'], [{}, 'tok']]);   // writes carry the CSRF token
});

test('a refused retry (a balance that cannot pay) comes back with the server\'s sentence and code', async () => {
  const { evaluationsApi } = await import('../src/api/models.js');
  const { opts } = fake({ error: 'Your balance cannot pay for this evaluation.', code: 'conflict' }, 409);
  await assert.rejects(evaluationsApi.retry('walls', 7, opts), { status: 409, serverCode: 'conflict', message: 'Your balance cannot pay for this evaluation.' });
});

test('a model block opens its running evaluation, else the one that ended, else the newest measured one', async () => {
  const { newestEvaluation } = await import('../src/api/models.js');
  assert.equal(newestEvaluation({ evaluating: { number: 9 }, ended: null, evaluation: { number: 4 } }), 9);
  assert.equal(newestEvaluation({ evaluating: null, ended: { number: 8 }, evaluation: { number: 4 } }), 8);
  assert.equal(newestEvaluation({ evaluating: null, ended: null, evaluation: { number: 4 } }), 4);
  assert.equal(newestEvaluation({ evaluating: null, ended: null, evaluation: null }), null);
});

test('billable time and what an attempt did read as words', async () => {
  const { billableText, attemptText } = await import('../src/api/models.js');
  assert.equal(billableText(null), '—');
  assert.equal(billableText(undefined), '—');
  assert.equal(billableText(0), '0 s');
  assert.equal(billableText(45), '45 s');
  assert.equal(billableText(60), '1 min');
  assert.equal(billableText(725), '12 min 5 s');
  assert.equal(billableText(7380), '2 h 3 min');
  assert.equal(billableText(3600), '1 h');
  assert.equal(attemptText({ state: 'failed', reason: 'could not be started: no GPU' }), 'could not be started: no GPU');
  assert.equal(attemptText({ state: 'queued', reason: '' }), 'Waiting for a machine');
  assert.equal(attemptText({ state: 'succeeded' }), 'Finished');
});

test('the run and evaluation views offer a log only when the attempt has one, and every paid Cancel asks first', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = name => readFile(new URL(`../src/components/${name}`, import.meta.url), 'utf8');
  // Every attempts list is the one table (ADM-1210 §3.9), whose Log link is shown only with a log.
  const table = await read('AttemptsTable.vue');
  assert.ok(table.includes('<a v-if="a.log"'), 'an attempt\'s Log link is shown only with a log');
  const studio = await read('ProjectStudio.vue');
  assert.ok(studio.includes('<AttemptsTable :attempts="runView.attempts'), 'the run view lists its attempts');
  assert.ok(!studio.includes("@click=\"runAct('cancel')\""), 'the run Cancel opens a confirmation');
  for (const name of ['LlmTrain.vue', 'LlmAnalytics.vue']) {
    const page = await read(name);
    assert.ok(!page.includes("@click=\"move('cancel')\""), `${name}: Cancel opens a confirmation`);
    assert.ok(page.includes('<UiDialog') && page.includes('<AttemptsTable :attempts="opened.attempts'), name);
  }
  const view = await read('ModelEvaluations.vue');
  assert.ok(view.includes('<AttemptsTable :attempts="detail.attempts"') && view.includes('@click="act(\'cancel\')"') && view.includes('<UiDialog'));
  for (const name of ['ProjectStudio.vue', 'LlmTrain.vue', 'LlmAnalytics.vue', 'ModelEvaluations.vue', 'RunProvenance.vue', 'AttemptsTable.vue', '../App.vue']) {
    const page = (await read(name)).replace(/\b(confirmCancelRun|confirmCancel|confirmMove)\(/g, '');
    assert.ok(!/(^|[^\w.])(confirm|alert|prompt)\(/m.test(page), `${name}: no native dialog`);
  }
});
