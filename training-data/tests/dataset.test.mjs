import test from 'node:test';
import assert from 'node:assert/strict';
import { query, recipeOf, FILTERS } from '../src/api/dataset.js';

test('only the filters that are set go to the server; "All" means no filter', () => {
  assert.equal(query({ q: '', status: 'All', page: 1, ...FILTERS }), '?page=1');
  assert.equal(query({ q: 'kitchen', status: 'In review', page: 2, ...FILTERS, golden: 'true', split: 'val' }),
    '?q=kitchen&status=In+review&page=2&split=val&golden=true');
  assert.equal(query({}), '');
});

test('the builder\'s steps 3 and 4 become the version\'s recipe', () => {
  assert.deepEqual(recipeOf({ resize: true, dimension: '640', augmentation: true }), { resize: 640, augment: true });
  assert.deepEqual(recipeOf({ resize: false, dimension: 640, augmentation: false }), { resize: null, augment: false });
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

test('take in posts to the project\'s take-in address', async () => {
  const { datasetApi } = await import('../src/api/dataset.js');
  const { asked, opts } = fake({ added: 3, handled: 4, left: 0 });
  assert.deepEqual(await datasetApi.takeIn('walls', opts), { added: 3, handled: 4, left: 0 });
  assert.deepEqual(asked, [{ url: '/api/training-data/app/projects/walls/photos/take-in/', method: 'POST', body: {}, csrf: 'tok' }]);
});

test('take in calls again while records are left, and says how far it is', async () => {
  const { takeInAll, takeInText } = await import('../src/api/dataset.js');
  const answers = [{ added: 150, handled: 200, left: 250 }, { added: 180, handled: 200, left: 50 }, { added: 40, handled: 50, left: 0 }];
  const seen = [];
  const done = await takeInAll('walls', p => seen.push(takeInText(p)), async () => answers.shift());
  assert.deepEqual(done, { added: 370, left: 0, stuck: 0 });
  assert.deepEqual(seen, ['Taken in 150 photos, 250 records left.', 'Taken in 330 photos, 50 records left.', 'Taken in 370 photos, 0 records left.']);
  assert.equal(takeInText({ added: 1, left: 1 }), 'Taken in 1 photo, 1 record left.');
});

test('take in stops when a call takes nothing in, so records that cannot be taken in never keep it calling', async () => {
  const { takeInAll } = await import('../src/api/dataset.js');
  let calls = 0;
  const done = await takeInAll('walls', () => {}, async () => { calls += 1; return calls === 1 ? { added: 10, handled: 200, left: 30 } : { added: 0, handled: 30, left: 30 }; });
  assert.deepEqual(done, { added: 10, left: 30, stuck: 30 });
  assert.equal(calls, 2);
  const none = await takeInAll('walls', () => {}, async () => ({ added: 0, handled: 0, left: 5 }));
  assert.deepEqual(none, { added: 0, left: 5, stuck: 5 });
});

test('take in stops on a refusal and says what it took in before it', async () => {
  const { takeInAll } = await import('../src/api/dataset.js');
  const { ApiError } = await import('../src/api/client.js');
  let calls = 0;
  await assert.rejects(takeInAll('walls', () => {}, async () => {
    calls += 1;
    if (calls === 1) return { added: 20, handled: 200, left: 100 };
    throw new ApiError(409, 'server', 'The data-use answers do not let these photos train a model.');
  }), error => error.status === 409 && error.added === 20 && /data-use/.test(error.message));
  assert.equal(calls, 2);
});

test('the Dataset page keeps the waiting count, 0 when the server says none', async () => {
  const { loadDataset } = await import('../src/api/dataset.js');
  const real = globalThis.fetch;
  const answer = waiting => async () => new Response(JSON.stringify({ photos: [], total: 0, page: 1, pages: 1, waiting, may: { take_in: true } }), { headers: { 'content-type': 'application/json' } });
  try {
    const store = { ref: 'walls', images: [] };
    globalThis.fetch = answer(12); await loadDataset(store);
    assert.equal(store.dataset.waiting, 12); assert.equal(store.dataset.may.take_in, true);
    globalThis.fetch = answer(undefined); await loadDataset(store);
    assert.equal(store.dataset.waiting, 0);
  } finally { globalThis.fetch = real; }
});

// ── ADM-1210 phase C: the bulk delete's answer, take back on a row, "Deleted on request" ──
test('deleting photos says what went, and the rows that could not are listed apart', async () => {
  const { photosDeletedWords } = await import('../src/api/dataset.js');
  assert.equal(photosDeletedWords({ deleted: 2, affected_versions: [], failed: [] }), '2 photos deleted.');
  assert.equal(photosDeletedWords({ deleted: 1, affected_versions: ['train_val-v2'], failed: [{ photo: 'p9', why: 'Its stored copy could not be removed. Try again.' }] }),
    '1 photo deleted; the versions that held them keep them: train_val-v2. 1 could not be deleted, and why is listed below.');
});

test('more than 500 photos at once comes back refused with the server\'s sentence (400 too_many)', async () => {
  const { datasetApi } = await import('../src/api/dataset.js');
  const { asked, opts } = fake({ error: 'Select at most 500 photos at once; 501 were selected.', code: 'too_many', field: 'photos' }, 400);
  const real = globalThis.fetch;
  globalThis.fetch = opts.fetchImpl;
  try {
    await assert.rejects(datasetApi.remove('walls', Array(501).fill('p'), 'asked'), e => e.status === 400 && e.serverCode === 'too_many' && e.message === 'Select at most 500 photos at once; 501 were selected.');
  } finally { globalThis.fetch = real; }
  assert.equal(asked[0].url, '/api/training-data/app/projects/walls/photos/delete/');
  assert.equal(asked[0].method, 'POST');
});

test('"Deleted on request" is read a page at a time at the project\'s address', async () => {
  const { datasetApi, pageQuery } = await import('../src/api/dataset.js');
  const { asked, opts } = fake({ deletions: [], more: false, next: null });
  await datasetApi.deletions('walls', null, opts);
  await datasetApi.deletions('walls', { before: '2026-11-10T09:00:00+00:00', before_id: 41 }, opts);
  assert.deepEqual(asked.map(a => a.url), ['/api/training-data/app/projects/walls/deletions/',
    '/api/training-data/app/projects/walls/deletions/?before=2026-11-10T09%3A00%3A00%2B00%3A00&before_id=41']);
  assert.equal(pageQuery({ before: 'x' }), '?before=x');
  assert.equal(pageQuery(undefined), '');
});

test('a deletion row shows the sha256 shortened and keeps the whole value for its title; an example row its numbers', async () => {
  const { deletionRow, shortSha } = await import('../src/api/dataset.js');
  const sha = 'ab'.repeat(32);
  const photo = deletionRow({ id: 3, sha256: sha, deleted_at: '2026-11-10T09:00:00+00:00', by: 'Sajid', reason: 'Asked', versions: ['train_val-v2'] });
  assert.deepEqual(photo, { id: 3, at: '2026-11-10T09:00:00+00:00', by: 'Sajid', reason: 'Asked', versions: ['train_val-v2'], what: `${sha.slice(0, 12)}…`, full: sha });
  const example = deletionRow({ id: 4, example_ref: 17, record_ref: 'r-1', reason: '', by: '', at: '2026-11-09T09:00:00+00:00', versions: [] }, 'example');
  assert.deepEqual(example, { id: 4, at: '2026-11-09T09:00:00+00:00', by: 'A person who left', reason: '', versions: [], what: 'Example 17', full: 'From record r-1' });
  assert.equal(shortSha('abc'), 'abc');
});

test('a Dataset row keeps its label\'s state, so an approved label offers "Take back approval"', async () => {
  const { loadDataset } = await import('../src/api/dataset.js');
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ photos: [{ id: 'p1', name: 'a.jpg', image: '/i', status: 'Accepted', label: 'l1', label_state: 'accepted', labels: 3 }], total: 1, page: 1, pages: 1, may: {} }), { headers: { 'content-type': 'application/json' } });
  try {
    const store = { ref: 'walls', images: [] };
    await loadDataset(store);
    assert.equal(store.images[0].labelState, 'accepted');
    assert.equal(store.images[0].label, 'l1');
  } finally { globalThis.fetch = real; }
});
