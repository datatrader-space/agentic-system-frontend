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
