import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { intersect, isEmpty, maskBox, maskToPolygons, rasterize, simplify, subtract, traceRings, union } from '../src/maskShapes.js';
import { decode, encode } from '../src/rle.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/rle_pycocotools_2_0_11.json', import.meta.url), 'utf8'));
const count = mask => mask.reduce((s, v) => s + v, 0);
const square = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
function rows(mask, width) { const out = []; for (let i = 0; i < mask.length; i += width) out.push([...mask.slice(i, i + width)].join('')); return out; }

test('a polygon fills the pixels whose centres are inside it, at the photo size', () => {
  const mask = rasterize(square(1, 1, 4, 3), 6, 4);
  assert.deepEqual(rows(mask, 6), ['000000', '011100', '011100', '000000']);
  const triangle = rasterize([[0, 0], [8, 0], [0, 8]], 8, 8);
  assert.equal(count(triangle), 28);                     // centres strictly under the diagonal x + y < 8: 7+6+...+1
  assert.equal(triangle[0], 1); assert.equal(triangle[7], 0); assert.equal(triangle[7 * 8], 0);
});

test('rasterize uses even-odd: a ring inside another cuts a hole; parts outside the photo are dropped', () => {
  const holed = rasterize([square(0, 0, 6, 6), square(2, 2, 4, 4)], 6, 6);
  assert.equal(count(holed), 32);
  assert.equal(holed[2 * 6 + 2], 0);
  const clipped = rasterize([square(-5, -5, 2, 2)], 4, 4);
  assert.deepEqual(rows(clipped, 4), ['1100', '1100', '0000', '0000']);
  assert.equal(count(rasterize([], 4, 4)), 0);
  assert.deepEqual(rasterize(square(0, 0, 2, 2), 3, 3), rasterize([square(0, 0, 2, 2)], 3, 3));   // one polygon or a list
});

test('a mask with a hole traces to one outline and one hole along the pixel edges', () => {
  const mask = rasterize([square(1, 1, 7, 6), square(3, 2, 5, 4)], 9, 8);
  const rings = traceRings(mask, 9, 8);
  assert.equal(rings.length, 2);
  const [outline, hole] = [rings.find(r => r.outer), rings.find(r => !r.outer)];
  assert.deepEqual(outline.ring, [[7, 1], [7, 6], [1, 6], [1, 1]]);
  assert.equal(outline.area, 30);
  assert.equal(hole.area, 4);
  assert.deepEqual(new Set(hole.ring.map(String)), new Set(['3,2', '5,2', '5,4', '3,4']));
  // Outline + hole drawn back even-odd give exactly the mask.
  assert.deepEqual(rasterize(rings.map(r => r.ring), 9, 8), mask);
  // maskToPolygons gives the outer ring only, unless holes are asked for.
  assert.equal(maskToPolygons(mask, 9, 8).length, 1);
  assert.equal(maskToPolygons(mask, 9, 8, { holes: true }).length, 2);
});

test('two separate parts trace to two outlines; corner-touching pixels are separate regions', () => {
  const mask = rasterize([square(0, 0, 2, 2), square(5, 1, 8, 4)], 8, 5);
  const polygons = maskToPolygons(mask, 8, 5, { tolerance: 0 });
  assert.equal(polygons.length, 2);
  assert.deepEqual(rasterize(polygons, 8, 5), mask);
  const diagonal = Uint8Array.from([1, 0, 0, 1]);
  assert.equal(traceRings(diagonal, 2, 2).length, 2);
});

test('every fixture traces and draws back to exactly its mask (all rings, even-odd)', () => {
  for (const f of fixtures) {
    const mask = decode(f);
    const rings = traceRings(mask, f.w, f.h);
    assert.deepEqual(rasterize(rings.map(r => r.ring), f.w, f.h), mask, f.kind);
    assert.equal(rings.filter(r => r.outer).reduce((s, r) => s + r.area, 0) - rings.filter(r => !r.outer).reduce((s, r) => s + r.area, 0), f.area, f.kind);
  }
  const checker = fixtures.find(f => f.kind === 'checker');
  assert.equal(traceRings(decode(checker), checker.w, checker.h).length, checker.area);   // 4-connected: each pixel alone
});

test('simplified polygons stay close to the mask and use far fewer corners', () => {
  const f = fixtures.find(x => x.kind === 'ring' && x.w === 800);
  const mask = decode(f);
  const exact = traceRings(mask, f.w, f.h).filter(r => r.outer)[0].ring;
  const [outline] = maskToPolygons(mask, f.w, f.h, { tolerance: 1 });
  assert.ok(outline.length < exact.length / 4, `${outline.length} of ${exact.length}`);
  const filled = rasterize(outline, f.w, f.h);
  const outer = rasterize(exact, f.w, f.h);
  const off = filled.reduce((s, v, i) => s + (v !== outer[i] ? 1 : 0), 0);
  assert.ok(off / count(outer) < 0.01, `${off} pixels differ`);
  assert.equal(maskToPolygons(mask, f.w, f.h, { minArea: 10 ** 9 }).length, 0);
  assert.deepEqual(simplify([[0, 0], [5, 0.2], [10, 0], [10, 10], [0, 10]], 1), [[0, 0], [10, 0], [10, 10], [0, 10]]);
});

test('union and subtract add and remove areas (Smart Select add / remove, the eraser); box and empty', () => {
  const w = 6, h = 4;
  const a = rasterize(square(0, 0, 3, 2), w, h), b = rasterize(square(2, 1, 5, 4), w, h);
  const both = union(a, b);
  assert.equal(count(both), 6 + 9 - 1);
  assert.deepEqual(rows(subtract(a, b), w), ['111000', '110000', '000000', '000000']);
  assert.equal(count(intersect(a, b)), 1);
  assert.deepEqual(maskBox(both, w, h), [0, 0, 5, 4]);
  assert.deepEqual(maskBox(b, w, h), [2, 1, 3, 3]);
  assert.equal(maskBox(new Uint8Array(w * h), w, h), null);
  assert.equal(isEmpty(subtract(a, a)), true);
  assert.equal(count(a), 6);                                // inputs are not changed
  assert.throws(() => union(a, new Uint8Array(3)), /not the same size/);
  // The result goes back to RLE as any mask.
  assert.deepEqual(decode(encode(both, h, w)), both);
});

test('a polygon drawn as a mask and traced back is the same polygon (Convert to mask, Convert to polygon)', () => {
  const polygon = [[10, 10], [60, 10], [60, 40], [30, 40], [30, 25], [10, 25]];
  const mask = rasterize(polygon, 80, 50);
  const [back] = maskToPolygons(mask, 80, 50, { tolerance: 0 });
  assert.deepEqual(new Set(back.map(String)), new Set(polygon.map(String)));
});
