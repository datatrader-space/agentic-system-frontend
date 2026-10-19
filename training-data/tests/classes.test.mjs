import test from 'node:test';
import assert from 'node:assert/strict';
import { usageText, matching } from '../src/api/classes.js';

test('a class says how many shapes are drawn, and an added class on how many labels', () => {
  assert.equal(usageText({ shapes: 1, labels: null }), '1 shape');
  assert.equal(usageText({ shapes: 12, labels: undefined }), '12 shapes');
  assert.equal(usageText({ shapes: 3, labels: 1 }), '3 shapes · on 1 label');
});

test('the search box keeps the rows whose name contains the words, in any case', () => {
  const rows = [{ name: 'wall' }, { name: 'window' }, { name: 'Radiator' }];
  assert.deepEqual(matching(rows, 'W').map(r => r.name), ['wall', 'window']);
  assert.deepEqual(matching(rows, ' rad ').map(r => r.name), ['Radiator']);
  assert.deepEqual(matching(rows, '').length, 3);
  assert.deepEqual(matching(null, 'x'), []);
});
