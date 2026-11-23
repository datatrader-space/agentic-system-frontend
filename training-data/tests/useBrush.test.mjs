import test from 'node:test';
import assert from 'node:assert/strict';
import { cursorEllipse, nextSize, paintSegment, stageToPhoto, useBrush, MAX_BRUSH } from '../src/useBrush.js';
import { area, check, decode, encode } from '../src/rle.js';

const W = 40, H = 20;
const photo = () => ({ width: W, height: H });
const count = mask => mask.reduce((s, v) => s + v, 0);
const key = (k, extra = {}) => ({ key: k, ...extra });

test('a stroke paints a new mask of the chosen class in photo pixels, ready to save', () => {
  const brush = useBrush({ photo, size: 4 });
  assert.equal(brush.begin([10.5, 10.5], { kind: 'crack', id: 'new-1' }), true);
  assert.equal(brush.active.value, true);
  assert.ok(brush.live.value.data[10 * W + 10]);
  brush.move([20.5, 10.5]);
  const result = brush.end();
  assert.equal(result.id, 'new-1'); assert.equal(result.kind, 'crack'); assert.equal(result.before, null);
  assert.equal(check(result.mask, { size: [H, W] }), '');
  const mask = decode(result.mask);
  for (let x = 9; x <= 21; x++) assert.equal(mask[10 * W + x], 1, `pixel ${x}`);
  assert.equal(mask[10 * W + 25], 0);
  assert.equal(brush.active.value, false); assert.equal(brush.live.value, null);
});

test('a fast stroke has no gaps: the segment between two pointer events is painted as a capsule', () => {
  const data = new Uint8Array(W * H);
  paintSegment(data, W, H, [2.5, 2.5], [37.5, 17.5], 1, 1);
  // Every column the line crosses has a painted pixel, and the painted pixels form one 4-connected run.
  for (let x = 3; x <= 37; x++) { let any = false; for (let y = 0; y < H; y++) any ||= !!data[y * W + x]; assert.ok(any, `column ${x}`); }
  const brush = useBrush({ photo, size: 2 });
  brush.begin([1, 1], { kind: 'crack' }); brush.move([39, 19]);
  const painted = decode(brush.end().mask);
  let gaps = 0;
  for (let x = 2; x < 38; x++) { let any = false; for (let y = 0; y < H; y++) any ||= !!painted[y * W + x]; if (!any) gaps++; }
  assert.equal(gaps, 0);
});

test('the eraser removes pixels from the selected mask; erasing all of it answers no mask', () => {
  const start = new Uint8Array(W * H); start.fill(1, 5 * W, 6 * W);          // row 5 fully set
  const shape = { id: 'm1', kind: 'floor', mask: encode(start, H, W) };
  const brush = useBrush({ photo, size: 2 });
  assert.equal(brush.keydown(key('e')), true); assert.equal(brush.erasing.value, true);
  brush.begin([5, 5.5], { shape }); brush.move([15, 5.5]);
  const result = brush.end();
  assert.equal(result.id, 'm1'); assert.deepEqual(result.before, shape.mask);
  assert.equal(area(result.mask), W - 12);
  brush.begin([0, 5.5], { shape: { ...shape, mask: result.mask } }); brush.move([40, 5.5]);
  assert.equal(brush.end().mask, null);
});

test('one undo step per stroke, however many moves; redo puts it back', () => {
  const brush = useBrush({ photo, size: 3 });
  brush.begin([5, 5], { kind: 'crack', id: 'a' }); for (let x = 6; x < 30; x++) brush.move([x, 5]);
  const first = brush.end();
  brush.begin([5, 15], { shape: { id: 'a', kind: 'crack', mask: first.mask } }); brush.move([30, 15]);
  const second = brush.end();
  assert.equal(brush.canUndo(), true);
  assert.deepEqual(brush.undo(), { id: 'a', kind: 'crack', mask: first.mask });
  assert.deepEqual(brush.undo(), { id: 'a', kind: 'crack', mask: null });    // before the first stroke: no shape
  assert.equal(brush.undo(), null);
  assert.deepEqual(brush.redo(), { id: 'a', kind: 'crack', mask: first.mask });
  assert.deepEqual(brush.redo(), { id: 'a', kind: 'crack', mask: second.mask });
  assert.equal(brush.redo(), null);
});

test('a stroke that changes nothing keeps no undo step; cancel drops the stroke', () => {
  const start = new Uint8Array(W * H); start.fill(1);
  const brush = useBrush({ photo, size: 4 });
  brush.begin([10, 10], { shape: { id: 'm', kind: 'floor', mask: encode(start, H, W) } });   // painting where it is set
  assert.equal(brush.end(), null); assert.equal(brush.canUndo(), false);
  brush.begin([10, 10], { kind: 'floor' }); brush.cancel();
  assert.equal(brush.end(), null); assert.equal(brush.active.value, false);
});

test('[ and ] change the size within bounds, E toggles the eraser, typing in a field is left alone', () => {
  const brush = useBrush({ photo: () => ({ width: 4000, height: 3000 }), size: 10 });
  assert.equal(brush.keydown(key(']')), true); assert.equal(brush.size.value, 12);
  assert.equal(brush.keydown(key('[')), true); assert.equal(brush.size.value, 10);
  for (let i = 0; i < 60; i++) brush.keydown(key('['));
  assert.equal(brush.size.value, 1);
  for (let i = 0; i < 80; i++) brush.keydown(key(']'));
  assert.equal(brush.size.value, MAX_BRUSH);
  assert.equal(nextSize(30, true, 32), 32);
  assert.equal(brush.keydown(key('E')), true); assert.equal(brush.erasing.value, true);
  assert.equal(brush.keydown(key('e', { target: { tagName: 'INPUT' } })), false);
  assert.equal(brush.keydown(key('e', { ctrlKey: true })), false);
  assert.equal(brush.keydown(key('x')), false);
  assert.equal(brush.erasing.value, true);
});

test('the brush refuses in words: no class, nothing to erase, a mask of another size', () => {
  const brush = useBrush({ photo, size: 4 });
  assert.equal(brush.begin([1, 1], {}), false); assert.match(brush.message.value, /Choose a class/);
  brush.keydown(key('e'));
  assert.equal(brush.begin([1, 1], { kind: 'crack' }), false); assert.match(brush.message.value, /Select a mask to erase/);
  brush.keydown(key('e'));
  const other = { id: 'x', kind: 'crack', mask: encode(new Uint8Array(4), 2, 2) };
  assert.equal(brush.begin([1, 1], { shape: other }), false); assert.match(brush.message.value, /not the size of the photo/);
  assert.equal(useBrush({ photo: () => null }).begin([1, 1], { kind: 'a' }), false);
});

test('the stage <-> photo helpers and the cursor circle', () => {
  assert.deepEqual(stageToPhoto([300, 150], 4000, 3000), [2000, 1500]);
  assert.deepEqual(cursorEllipse([2000, 1500], 100, 4000, 3000), { cx: 300, cy: 150, rx: 7.5, ry: 5 });
});

test('the live mask names what each move changed, for the mask layer', () => {
  const brush = useBrush({ photo, size: 2 });
  brush.begin([5, 5], { kind: 'crack' });
  const first = brush.live.value;
  brush.move([10, 5]);
  const second = brush.live.value;
  assert.ok(second.version > first.version);
  assert.deepEqual(second.box.slice(0, 2), first.box.slice(0, 2));
  assert.ok(second.dirty[2] >= 9 && second.dirty[0] >= 4);
  assert.equal(count(second.data) > count(new Uint8Array(4)), true);
});
