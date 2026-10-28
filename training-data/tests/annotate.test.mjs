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
