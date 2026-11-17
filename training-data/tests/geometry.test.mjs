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

// Live, 2026-11-17: a Basic Detector answer tidied into a wall that crossed itself, and the backend then refused to
// send the label to review ("wall 3 crosses itself"). A tidy-up step that would cross a shape is not made.
test('a crossing outline is told from a sound one, as the backend tells them', async () => {
  const { crossesItself } = await import('../src/geometry.js');
  assert.equal(crossesItself(square), false);
  assert.equal(crossesItself([[0, 0], [100, 100], [100, 0], [0, 100]]), true);       // a bow-tie
  assert.equal(crossesItself([[0, 0], [50, 0], [100, 0], [100, 100]]), false);       // edges that only touch at an end
});

test('a cut that would leave a half crossing itself is not made: the wall stays as the model drew it', async () => {
  const { tidyUp, roomCut, crossesItself } = await import('../src/geometry.js');
  // A real case found by search: roomCut cuts this sound wall into a half that crosses itself.
  const wall = [[287, 240], [226, 264], [220, 234], [195, 176], [168, 97], [266, 172], [220, 128], [238, 133], [398, 63], [407, 169]];
  assert.equal(crossesItself(wall), false);
  assert.ok(roomCut(wall).some(crossesItself));                                    // the cut alone makes a bow-tie
  const report = tidyUp([{ kind: 'wall', points: wall, corner_types: wall.map(() => 'room') }]);
  assert.equal(report.cut, 0);
  assert.equal(report.shapes.length, 1);
  assert.deepEqual(report.shapes[0].points, wall);
  assert.deepEqual(report.shapes[0].corner_types, wall.map(() => 'room'));        // untouched: its corner names stay
  assert.equal(report.shapes.some(s => crossesItself(s.points)), false);
});

test('a window brought into its wall is left where it was when the move would make it cross itself', async () => {
  const { tidyUp, crossesItself } = await import('../src/geometry.js');
  const wall = [[279, 230], [269, 242], [209, 300], [172, 299], [187, 208], [261, 184], [140, 114], [166, 112], [419, 105], [364, 184], [498, 191]];
  const window = [[336, 224], [342, 231], [276, 218], [285, 209], [291, 209]];
  assert.equal(crossesItself(window), false);
  const report = tidyUp([{ kind: 'wall', points: wall }, { kind: 'window', points: window }]);
  assert.equal(report.shapes.some(s => crossesItself(s.points)), false);
  assert.deepEqual(report.shapes.find(s => s.kind === 'window').points, window);
});

test('a shape the model drew crossing itself is redrawn round its outline; a tidy-up never returns a bow-tie', async () => {
  const { tidyUp, crossesItself, area } = await import('../src/geometry.js');
  const bowTie = [[100, 50], [400, 250], [400, 50], [100, 250]];
  const report = tidyUp([{ kind: 'wall', points: bowTie, corner_types: ['room', 'room', 'room', 'room'] }, { kind: 'door', points: [[150, 100], [200, 200], [200, 100], [150, 200]] }]);
  assert.equal(report.repaired, 2);
  for (const shape of report.shapes) {
    assert.equal(crossesItself(shape.points), false);
    assert.ok(area(shape.points) > 0);
  }
  assert.equal(report.shapes[0].corner_types, undefined);                          // new corners: the backend names them
  // Many random outlines, sound and scrambled: none comes back crossing itself.
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 3000; n += 1) {
    const points = Array.from({ length: 6 + Math.floor(rnd() * 8) }, () => [rnd() * Math.PI * 2, 40 + rnd() * 160])
      .sort((a, b) => a[0] - b[0]).map(([t, r]) => [Math.round(300 + r * Math.cos(t)), Math.round(200 + r * Math.sin(t) * 0.8)]);
    if (rnd() < 0.3) points.sort(() => rnd() - 0.5);
    for (const shape of tidyUp([{ kind: 'wall', points }]).shapes) assert.equal(crossesItself(shape.points), false, JSON.stringify(points));
  }
});
