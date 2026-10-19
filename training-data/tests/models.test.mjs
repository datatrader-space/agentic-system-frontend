import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, measureText, meets, msText, COMING_SOON } from '../src/api/models.js';

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

test('the catalogue lists the backend rows first, then the coming-soon ones it does not already have', () => {
  const rows = [{ name: 'SegFormer-B0', publisher: 'NVIDIA', kind: 'Semantic segmentation', description: 'Every pixel.', trainable: true },
                { name: 'SAM 3', publisher: 'Meta AI', kind: 'Instance segmentation', description: 'From the backend.', coming: true }];
  const all = catalogue(rows);
  assert.equal(all[0].name, 'SegFormer-B0');
  assert.equal(all.filter(row => row.name === 'SAM 3').length, 1);            // the backend's row wins, no duplicate
  assert.equal(all.length, rows.length + COMING_SOON.length - 1);
  assert.ok(all.slice(2).every(row => row.coming));
  assert.deepEqual(catalogue(rows, 'nvidia').map(row => row.name), ['SegFormer-B0']);
  assert.ok(catalogue(rows, '', 'OCR').every(row => row.kind === 'OCR'));
});

test('a duration reads in milliseconds below a second', () => {
  assert.equal(msText(84.4), '84 ms');
  assert.equal(msText(2350), '2.4 s');
  assert.equal(msText(null), '—');
});
