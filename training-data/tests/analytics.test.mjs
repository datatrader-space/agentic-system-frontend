import test from 'node:test';
import assert from 'node:assert/strict';
import { csvUrl, share, bytesText, scatter } from '../src/api/analytics.js';

test('the CSV is the project\'s own address, asked for with the session', () => {
  assert.equal(csvUrl('~7'), '/api/training-data/app/projects/~7/analytics/photos.csv');
  assert.equal(csvUrl('my project'), '/api/training-data/app/projects/my%20project/analytics/photos.csv');
});

test('shares and sizes read as a person reads them', () => {
  assert.equal(share(1, 3), '33.3%');
  assert.equal(share(1, 0), '—');
  assert.deepEqual([bytesText(512), bytesText(2048), bytesText(5 * 1024 ** 2), bytesText(null)], ['512 B', '2 KB', '5.0 MB', '—']);
});

test('the size scatter puts the largest photo at the far corner and never hides a single photo', () => {
  const { dots, maxW, maxH } = scatter([{ width: 4000, height: 3000, count: 10 }, { width: 2000, height: 1500, count: 1 }]);
  assert.deepEqual([maxW, maxH], [4000, 3000]);
  assert.deepEqual([dots[0].x, dots[0].y], [470, 50]);          // 520 x 260, 36 px around it, dots 14 px clear of the axes
  assert.ok(dots[1].r >= 4 && dots[0].r > dots[1].r);
  assert.deepEqual(scatter([]).dots, []);
});
