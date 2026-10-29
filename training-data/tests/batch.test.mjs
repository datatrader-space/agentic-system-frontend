import test from 'node:test';
import assert from 'node:assert/strict';
import {
  photoChoices, sourceOf, photosText, limitProblem, startProblem, batchSummary, batchState, isActive, anyActive,
  progressParts, progressText, changeNotes, fileNameFrom, resultsPath, downloadResults, modelLabel, DEFAULT_LIMIT, POLL_MS,
} from '../src/api/batch.js';

const project = {
  ref: 'leads', name: 'Leads', photos: 640, running: false,
  models: [{ number: 2, name: 'walls', version: '2.0.0', smoke: false }, { number: 1, name: 'walls', version: '1.0.0', smoke: true }],
  versions: [{ name: 'test-v1', title: '', kind_label: 'Test', photos: 120 }, { name: 'train_val-v3', title: 'Spring homes', kind_label: 'Train and validation', photos: 480 }],
};

test('the photo choices are all photos, then each dataset version, with their counts', () => {
  assert.deepEqual(photoChoices(project).map(c => [c.value, c.label, c.photos]), [
    ['all', 'All photos', 640], ['version:test-v1', 'Test test-v1', 120], ['version:train_val-v3', 'Spring homes (train_val-v3)', 480],
  ]);
  assert.deepEqual(photoChoices(null), []);
  assert.deepEqual(photoChoices({ name: 'Empty' }).map(c => c.photos), [0]);
});

test('a choice is sent as the backend reads it', () => {
  assert.deepEqual(sourceOf('all'), { source: 'all', version: '' });
  assert.deepEqual(sourceOf('version:train_val-v3'), { source: 'version', version: 'train_val-v3' });
  assert.deepEqual(sourceOf(undefined), { source: 'all', version: '' });
});

test('the limit is 500 photos: more is refused with the count, none is refused too', () => {
  assert.equal(DEFAULT_LIMIT, 500);
  assert.equal(limitProblem(500), '');
  assert.equal(limitProblem(1), '');
  assert.equal(limitProblem(640), 'This choice has 640 photos, and a batch takes at most 500 for now. Choose a dataset version with fewer photos.');
  assert.equal(limitProblem(1200, 1000), 'This choice has 1,200 photos, and a batch takes at most 1,000 for now. Choose a dataset version with fewer photos.');
  assert.equal(limitProblem(0), 'There are no photos in this choice.');
  assert.equal(photosText(1), '1 photo');
  assert.equal(photosText(2500), '2,500 photos');
});

test('why Start is off is said in the order a person fixes it', () => {
  const [model] = project.models;
  const choices = photoChoices(project);
  assert.equal(startProblem({ may: { start: false, reason: 'Batches are off here.' }, project, model, choice: choices[1] }), 'Batches are off here.');
  assert.equal(startProblem({ may: { start: false } , project, model, choice: choices[1] }), 'Batches cannot start here right now.');
  assert.equal(startProblem({ may: { start: true }, project: null }), 'Choose a project.');
  assert.match(startProblem({ may: {}, project: { ...project, running: true }, model, choice: choices[1] }), /Leads already has a batch running/);
  assert.equal(startProblem({ may: {}, project: { ...project, models: [] } }), 'Leads has no trained model yet.');
  assert.equal(startProblem({ may: {}, project, model: null }), 'Choose a model.');
  assert.equal(startProblem({ may: {}, project, model, choice: null }), 'Choose the photos.');
  assert.match(startProblem({ may: {}, project, model, choice: choices[0] }), /has 640 photos/);
  assert.equal(startProblem({ may: {}, project, model, choice: choices[2] }), '');
});

test('the summary says what will happen in one sentence', () => {
  const choices = photoChoices(project);
  assert.equal(batchSummary(project, project.models[0], choices[2]), 'walls 2.0.0 will look at the 480 photos of train_val-v3, one at a time, and save what it finds in each.');
  assert.equal(batchSummary({ ...project, photos: 3 }, project.models[1], photoChoices({ ...project, photos: 3 })[0]),
    'walls 1.0.0 (smoke test) will look at all 3 photos of Leads, one at a time, and save what it finds in each.');
  assert.equal(batchSummary(project, null, choices[0]), '');
  assert.equal(modelLabel(null), '');
});

test('a state reads with its tone, and a queued or running batch keeps the list reloading', () => {
  assert.deepEqual(batchState({ state: 'running', state_label: 'Running' }), ['purple', 'Running']);
  assert.deepEqual(batchState({ state: 'done' }), ['green', 'Done']);
  assert.deepEqual(batchState({ state: 'failed' }), ['red', 'Failed']);
  assert.deepEqual(batchState({ state: 'cancelled' }), ['neutral', 'Cancelled']);
  assert.deepEqual(batchState({ state: 'queued' }), ['neutral', 'Queued']);
  assert.equal(isActive({ state: 'queued' }), true);
  assert.equal(isActive({ state: 'done' }), false);
  assert.equal(anyActive([{ state: 'done' }, { state: 'running' }]), true);
  assert.equal(anyActive([{ state: 'done' }, { state: 'cancelled' }]), false);
  assert.equal(anyActive(undefined), false);
  assert.equal(POLL_MS, 3000);
});

test('the meter splits answered and failed photos and never passes 100%', () => {
  assert.deepEqual(progressParts({ total: 200, done: 150, failed: 10 }), { done: 75, failed: 5, processed: 160, total: 200, percent: 80 });
  assert.deepEqual(progressParts({ total: 3, done: 1, failed: 2 }), { done: 33, failed: 66, processed: 3, total: 3, percent: 100 });
  assert.deepEqual(progressParts({ total: 0, done: 0, failed: 0 }), { done: 0, failed: 0, processed: 0, total: 0, percent: 0 });
  const odd = progressParts({ total: 10, done: 12, failed: 5 });          // counts that do not add up are held to the total
  assert.equal(odd.done + odd.failed <= 100, true);
  assert.equal(odd.processed, 10);
});

test('the counts read as words', () => {
  assert.equal(progressText({ state: 'queued', total: 40 }), 'Waiting to start, 40 photos');
  assert.equal(progressText({ state: 'running', stage: 'placing', total: 40, done: 0, failed: 0 }), 'Starting the model, 40 photos');
  assert.equal(progressText({ state: 'running', stage: 'predicting', total: 40, done: 12, failed: 0 }), '12 of 40 photos');
  assert.equal(progressText({ state: 'done', total: 40, done: 38, failed: 2 }), '40 of 40 photos, 2 without an answer');
});

test('a change of state is said once, and an unchanged list says nothing', () => {
  const before = [{ id: 1, state: 'running', project: { name: 'Leads' } }, { id: 2, state: 'running', project: { name: 'Doors' } }];
  const after = [{ id: 1, state: 'done', total: 5, done: 5, failed: 0, project: { name: 'Leads' } },
    { id: 2, state: 'failed', error: 'The model was rejected.', project: { name: 'Doors' } }];
  assert.equal(changeNotes(before, after), 'The batch of Leads is done: 5 of 5 photos. The batch of Doors failed. The model was rejected.');
  assert.equal(changeNotes(after, after), '');
  assert.equal(changeNotes(undefined, after), '');
});

test('the results file name comes from the server, with unsafe characters dropped', () => {
  assert.equal(fileNameFrom('attachment; filename="batch-7-model-2-results.jsonl"'), 'batch-7-model-2-results.jsonl');
  assert.equal(fileNameFrom("attachment; filename*=UTF-8''batch-7%2F..%2Fx.jsonl"), 'batch-7..x.jsonl');
  assert.equal(fileNameFrom(null), '');
  assert.equal(resultsPath(7), '/api/training-data/app/workspace/batches/7/results/');
});

test('downloading sends the selected workspace and saves the file the server named', async () => {
  const asked = [];
  const clicked = [];
  const store = { getItem: key => ({ activeWorkspaceId: '42', activeWorkspace: JSON.stringify({ id: 42, name: 'Main' }) })[key] ?? null };
  const doc = { body: { appendChild() {} }, createElement: () => ({ click() { clicked.push(this.download); }, remove() {} }) };
  const fetchImpl = async (url, options) => {
    asked.push([url, options.headers['X-Workspace-ID'], options.credentials]);
    return { ok: true, status: 200, blob: async () => new Blob(['{}\n']), headers: { get: () => 'attachment; filename="batch-7-model-2-results.jsonl"' } };
  };
  const name = await downloadResults(7, { fetchImpl, doc, store });
  assert.equal(name, 'batch-7-model-2-results.jsonl');
  assert.deepEqual(asked, [['/api/training-data/app/workspace/batches/7/results/', '42', 'same-origin']]);
  assert.deepEqual(clicked, ['batch-7-model-2-results.jsonl']);
});

test('a refused download shows only the server\'s short message', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({ error: 'This batch has no results yet.', code: 'not_ready' }), headers: { get: () => '' } });
  await assert.rejects(downloadResults(7, { fetchImpl, store: null }), { message: 'This batch has no results yet.', status: 404 });
  const broken = async () => ({ ok: false, status: 500, json: async () => { throw new Error('html'); }, headers: { get: () => '' } });
  await assert.rejects(downloadResults(7, { fetchImpl: broken, store: null }), { message: 'The results could not be downloaded.' });
  const offline = async () => { throw new TypeError('failed'); };
  await assert.rejects(downloadResults(7, { fetchImpl: offline, store: null }), { code: 'network' });
});
