import test from 'node:test';
import assert from 'node:assert/strict';
import { usageText, matching } from '../src/api/classes.js';

test('a class says how many shapes are drawn, and on how many labels', () => {
  // Every class is the project's own (no "trained" class with no label count): shapes and labels for each.
  assert.equal(usageText({ shapes: 1, labels: 1 }), '1 shape · on 1 label');
  assert.equal(usageText({ shapes: 12, labels: 4 }), '12 shapes · on 4 labels');
  assert.equal(usageText({ shapes: 0, labels: 0 }), '0 shapes · on 0 labels');
});

test('the search box keeps the rows whose name contains the words, in any case', () => {
  const rows = [{ name: 'wall' }, { name: 'window' }, { name: 'Radiator' }];
  assert.deepEqual(matching(rows, 'W').map(r => r.name), ['wall', 'window']);
  assert.deepEqual(matching(rows, ' rad ').map(r => r.name), ['Radiator']);
  assert.deepEqual(matching(rows, '').length, 3);
  assert.deepEqual(matching(null, 'x'), []);
});
