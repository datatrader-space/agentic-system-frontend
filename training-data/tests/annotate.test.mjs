import test from 'node:test';
import assert from 'node:assert/strict';
import { toUnits, toPixels, fromBackend, toBackend, photoState, loadSource } from '../src/api/annotate.js';

test('a label survives the round trip to the editor and back, to the tenth of a pixel', () => {
  const W = 4032, H = 3024;
  const backend = [{ kind: 'wall', points: [[100.5, 200.2], [3900, 210], [3890.7, 2900.1], [120, 2950]], corner_types: ['room', 'image_edge', 'room', 'room'] },
                   { kind: 'window', points: [[500, 600], [900, 600], [900, 1000]] }];
  const shapes = fromBackend(backend, W, H);
  assert.equal(shapes[0].corner, 'image_edge');                       // one corner touches the edge: the shape says so
  assert.equal(shapes[1].corner, 'room');
  const back = toBackend(shapes, W, H);
  assert.deepEqual(back[0].points, backend[0].points);
  assert.deepEqual(back[0].corner_types, backend[0].corner_types);   // untouched corners keep their types
  assert.equal(back[1].corner_types, undefined);                      // windows and doors carry none
});

test('a wall whose corners changed in number lets the backend decide its corner types', () => {
  const [wall] = fromBackend([{ kind: 'wall', points: [[0, 0], [10, 0], [10, 10]], corner_types: ['image_edge', 'image_edge', 'room'] }], 600, 300);
  wall.points.push([0, 10]);
  assert.equal(toBackend([wall], 600, 300)[0].corner_types, undefined);
  const drawn = { kind: 'wall', points: [[1, 1], [2, 1], [2, 2]] };   // drawn in the editor: no types of its own
  assert.equal(toBackend([drawn], 600, 300)[0].corner_types, undefined);
});

test('units and pixels convert both ways on a photo of any shape', () => {
  assert.deepEqual(toUnits([[2016, 1512]], 4032, 3024), [[300, 150]]);
  assert.deepEqual(toPixels([[300, 150]], 4032, 3024), [[2016, 1512]]);
  assert.deepEqual(toPixels([[123.45, 67.89]], 1000, 1000), [[205.8, 226.3]]);
});

test('where a photo stands, in the screens\' words', () => {
  assert.equal(photoState('to_label', ''), 'Unlabeled');
  assert.equal(photoState('to_label', 'draft'), 'Unlabeled');
  assert.equal(photoState('labelled', 'done'), 'In review');
  assert.equal(photoState('labelled', 'accepted'), 'Accepted');
});

test('a photo card shows the small picture; its click and the editor keep the photo itself', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ photos: [
    { id: 'p1', name: 'a.jpg', image: '/training-data/leads/photos/p1/file/', thumbnail: '/api/training-data/app/projects/leads/photos/p1/thumbnail/', width: 800, height: 600 },
    { id: 'p2', name: 'b.jpg', image: '/training-data/leads/photos/p2/file/', width: 800, height: 600 },
  ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const store = { ref: 'leads', images: [] };
    await loadSource(store, { id: 'u1', source: 'app' });
    assert.deepEqual(store.images.map(i => [i.url, i.thumb]), [
      ['/training-data/leads/photos/p1/file/', '/api/training-data/app/projects/leads/photos/p1/thumbnail/'],
      ['/training-data/leads/photos/p2/file/', ''],                  // none: the card shows the photo itself
    ]);
  } finally { globalThis.fetch = real; }
});

// ── ADM-1210 phase C: take back, one photo back to "to label", bulk approve, a send-back of some photos ──
function fake(reply = {}, status = 200) {
  const asked = [];
  const fetchImpl = async (url, options) => {
    asked.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, csrf: options.headers['X-CSRFToken'] });
    return { ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => reply };
  };
  return { asked, opts: { fetchImpl, store: null, cookies: 'csrftoken=tok' } };
}

test('take back, reopen and approve several post to their addresses with the CSRF token', async () => {
  const { api } = await import('../src/api/annotate.js');
  const { asked, opts } = fake({});
  await api.takeBack('walls', 'l-1', opts);
  await api.reopen('walls', 4, 'p-2', opts);
  await api.approveMany('walls', ['l-1', 'l-2'], opts);
  assert.deepEqual(asked, [
    { url: '/api/training-data/app/projects/walls/labels/l-1/take-back/', method: 'POST', body: {}, csrf: 'tok' },
    { url: '/api/training-data/app/projects/walls/assignments/4/photos/p-2/reopen/', method: 'POST', body: {}, csrf: 'tok' },
    { url: '/api/training-data/app/projects/walls/review/approve/', method: 'POST', body: { labels: ['l-1', 'l-2'] }, csrf: 'tok' },
  ]);
});

test('a take-back of a label that is not approved is refused with why (409)', async () => {
  const { api } = await import('../src/api/annotate.js');
  const { opts } = fake({ error: 'This label is not approved, so there is no approval to take back.', code: 'conflict' }, 409);
  await assert.rejects(api.takeBack('walls', 'l-1', opts), e => e.status === 409 && /not approved/.test(e.message));
});

test('approving is refused while the data-use answers do not allow it (409 data_use_refused), with that sentence', async () => {
  const { api } = await import('../src/api/annotate.js');
  const { opts } = fake({ error: 'The data-use answers of this project do not allow labelling for training.', code: 'data_use_refused' }, 409);
  await assert.rejects(api.approveMany('walls', ['l-1'], opts), e => e.status === 409 && e.serverCode === 'data_use_refused' && /data-use answers/.test(e.message));
});

test('a send-back names only the photos chosen, or none for every photo not approved yet', async () => {
  const { sendBackBody } = await import('../src/api/annotate.js');
  assert.deepEqual(sendBackBody('Walls missing'), { reason: 'Walls missing' });
  assert.deepEqual(sendBackBody('Walls missing', []), { reason: 'Walls missing' });
  assert.deepEqual(sendBackBody('Walls missing', ['p1', 'p2', 'p1', '']), { reason: 'Walls missing', photos: ['p1', 'p2'] });
});

test('a bulk approval and a take-back are said in words, with the versions that keep what they froze', async () => {
  const { approvedWords, takenBackWords } = await import('../src/api/annotate.js');
  assert.equal(approvedWords({ approved: 3, refused: [] }), '3 labels approved.');
  assert.equal(approvedWords({ approved: 1, refused: [{ label: 'x', why: 'This label is approved already.' }] }), '1 label approved. 1 was not, and why is listed below.');
  assert.equal(takenBackWords({ affected_versions: [], warning: '' }), 'The approval is taken back: the label waits for approval again.');
  assert.equal(takenBackWords({ affected_versions: ['train_val-v2'], warning: 'train_val-v2 keeps the label it froze. A new version takes the label approved next.' }),
    'The approval is taken back: the label waits for approval again. train_val-v2 keeps the label it froze. A new version takes the label approved next.');
  assert.equal(takenBackWords({ affected_versions: ['a-v1', 'b-v2'] }), 'The approval is taken back: the label waits for approval again. a-v1, b-v2 keep the label they froze.');
});

test('the review queue keeps why approving is refused, so "Approve selected" is off from the start', async () => {
  const { loadReview } = await import('../src/api/annotate.js');
  const real = globalThis.fetch;
  const answer = refused => async () => new Response(JSON.stringify({ photos: [{ id: 'p1', name: 'a.jpg', image: '/i', label: 'l1', author: 'Ana' }], approve_refused: refused }), { headers: { 'content-type': 'application/json' } });
  try {
    const store = { ref: 'walls', images: [] };
    globalThis.fetch = answer('The data-use answers forbid training.'); await loadReview(store);
    assert.equal(store.approveRefused, 'The data-use answers forbid training.');
    assert.equal(store.images[0].label, 'l1');
    globalThis.fetch = answer(''); await loadReview(store);
    assert.equal(store.approveRefused, '');
  } finally { globalThis.fetch = real; }
});
