import test from 'node:test';
import assert from 'node:assert/strict';
import { filtered, middle, percent, VERDICTS } from '../src/api/trial.js';

const answer = {
  status: 'success', image: { width: 800, height: 600 },
  walls: [{ corners: [[0, 60], [400, 120], [400, 480], [0, 540]], confidence: 0.91 }, { corners: [[400, 120], [800, 60], [800, 540], [400, 480]], confidence: 0.42, below_threshold: true }],
  openings: [{ type: 'window', polygon: [[100, 200], [200, 200], [200, 300], [100, 300]], confidence: 0.6 }],
};

test('the slider keeps what reaches it and says how much it hid; the model is not asked again', () => {
  assert.equal(filtered(answer, 0).hidden, 0);
  const half = filtered(answer, 0.5);
  assert.deepEqual([half.walls.length, half.openings.length, half.hidden], [1, 1, 1]);
  const high = filtered(answer, 0.95);
  assert.deepEqual([high.walls.length, high.openings.length, high.hidden], [0, 0, 3]);
  assert.equal(high.status, 'success');                  // what the model said about the photo is kept as it said it
  assert.equal(answer.walls.length, 2);                  // the answer itself is not changed
  assert.equal(filtered(null, 0.5), null);
});

test('a label sits in the middle of its points, and confidence reads as a percentage', () => {
  assert.deepEqual(middle([[0, 0], [10, 0], [10, 20], [0, 20]]), [5, 10]);
  assert.equal(percent(0.914), '91%');
  assert.equal(percent(null), '—');
  assert.deepEqual(Object.keys(VERDICTS), ['success', 'low_confidence', 'no_detection']);
});
