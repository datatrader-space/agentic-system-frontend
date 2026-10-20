import test from 'node:test';
import assert from 'node:assert/strict';
import { area, contains, split, box } from '../src/geometry.js';

const square = [[0, 0], [100, 0], [100, 100], [0, 100]];

test('a point inside a shape is found inside it, one outside is not', () => {
  assert.equal(contains(square, [50, 50]), true);
  assert.equal(contains(square, [150, 50]), false);
  assert.equal(area(square), 10000);
});

test('a line across a shape cuts it into two that share the cut exactly', () => {
  const [left, right] = split(square, [50, -10], [50, 110]);        // both clicks outside: the cut ends on the outline
  assert.deepEqual(left.length + right.length, 8);
  assert.equal(area(left) + area(right), 10000);
  const shared = left.filter(p => right.some(q => q[0] === p[0] && q[1] === p[1]));
  assert.deepEqual(shared.sort(), [[50, 0], [50, 100]].sort());
});

test('a click inside the shape is the corner itself: the outline bends to it', () => {
  const [a, b] = split(square, [40, 10], [60, 90], 2);
  assert.ok(a.some(p => p[0] === 40 && p[1] === 10) && b.some(p => p[0] === 40 && p[1] === 10));
  assert.ok(a.some(p => p[0] === 60 && p[1] === 90) && b.some(p => p[0] === 60 && p[1] === 90));
});

test('a line that misses the shape, or touches it once, cuts nothing', () => {
  assert.equal(split(square, [150, 0], [150, 100]), null);
  assert.equal(split(square, [10, 10], [10, 10]), null);
});

test('a box is its four corners from the top left, whichever corner was clicked first', () => {
  assert.deepEqual(box([80, 60], [20, 10]), [[20, 10], [80, 10], [80, 60], [20, 60]]);
});

test('a cut touches a shape only when its segment crosses the outline or a click is inside', async () => {
  const { crosses } = await import('../src/geometry.js');
  assert.equal(crosses(square, [50, -10], [50, 110]), true);       // across the shape
  assert.equal(crosses(square, [40, 10], [60, 90]), true);         // both clicks inside: the corner case
  assert.equal(crosses(square, [-50, 50], [-10, 50]), false);      // on the line through the shape, but far from it
  assert.equal(crosses(square, [150, 0], [150, 100]), false);
});

test('two shapes overlap by the share of the place they both cover', async () => {
  const { overlap, bestMatch } = await import('../src/geometry.js');
  assert.ok(Math.abs(overlap(square, square) - 1) < 1e-9);
  assert.equal(overlap(square, [[200, 200], [300, 200], [300, 300], [200, 300]]), 0);
  const half = [[50, 0], [150, 0], [150, 100], [50, 100]];
  assert.ok(Math.abs(overlap(square, half) - 1 / 3) < 0.03, String(overlap(square, half)));
  const drawn = { kind: 'wall', points: [[5, 5], [95, 3], [97, 98], [2, 96]] };
  const found = [{ kind: 'window', points: square }, { kind: 'wall', points: half }, { kind: 'wall', points: square }];
  assert.equal(bestMatch(drawn, found).shape, found[2]);                       // the same kind, most of the same place
  assert.equal(bestMatch({ kind: 'door', points: square }, found), null);      // nothing of its kind
  assert.equal(bestMatch(drawn, [{ kind: 'wall', points: [[90, 90], [200, 90], [200, 200], [90, 200]] }]), null);  // too little
});
