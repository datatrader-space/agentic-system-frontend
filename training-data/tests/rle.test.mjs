import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { area, bbox, check, decode, encode, resize, runsToString, stringToRuns, MAX_PIXELS } from '../src/rle.js';

// 11 masks written by pycocotools 2.0.11 (mask.encode on a Fortran-ordered uint8 array, counts decoded to str).
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/rle_pycocotools_2_0_11.json', import.meta.url), 'utf8'));

// The same formulas that made the fixtures (x the column, y the row, both from 0).
const KINDS = {
  empty: () => false,
  full: () => true,
  one_pixel: (y, x, h, w) => y === Math.floor(h / 2) && x === Math.floor(w / 3),
  corner_pixel: (y, x) => y === 0 && x === 0,
  ring: (y, x, h, w) => { const r = Math.hypot(y - h / 2, x - w / 2), m = Math.min(h, w); return r < m * 0.45 && r > m * 0.2; },
  two_parts: (y, x, h, w) => ((x < w * 0.3) && (y > h * 0.2)) || ((x > w * 0.6) && (y < h * 0.7) && (y > h * 0.1)),
  stripes: (y, x) => (x + 2 * y) % 7 < 3,
  checker: (y, x) => (x + y) % 2 === 0,
  floor: (y, x, h, w) => y > (h * 0.55 + (x - w / 2) * 0.05),
};
function made({ kind, h, w }) {
  const mask = new Uint8Array(h * w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = KINDS[kind](y, x, h, w) ? 1 : 0;
  return mask;
}

test('there are 11 pycocotools fixtures of 9 kinds', () => {
  assert.equal(fixtures.length, 11);
  assert.deepEqual([...new Set(fixtures.map(f => f.kind))].sort(), Object.keys(KINDS).sort());
});

for (const [i, f] of fixtures.entries()) {
  test(`fixture ${i + 1} (${f.kind}, ${f.w} x ${f.h}): encode is byte-identical, decode, area and bbox match pycocotools`, () => {
    const mask = made(f);
    const rle = encode(mask, f.h, f.w);
    assert.equal(rle.counts, f.counts);
    assert.deepEqual(rle.size, f.size);
    assert.deepEqual(decode({ size: f.size, counts: f.counts }), mask);
    assert.equal(area(f), f.area);
    assert.deepEqual(bbox(f), f.bbox);
    assert.equal(check(f, { size: [f.h, f.w] }), '');
    assert.equal(runsToString(stringToRuns(f.counts)), f.counts);
  });
}

test('decode then encode gives the same string back for every fixture', () => {
  for (const f of fixtures) assert.equal(encode(decode(f), f.h, f.w).counts, f.counts);
});

test('check refuses a mask of another size than the photo, in words', () => {
  const f = fixtures.find(x => x.kind === 'ring');
  assert.match(check(f, { size: [f.h + 1, f.w] }), /^The mask is 37 x 40 pixels but the photo is 37 x 41\.$/);
});

test('check refuses bad characters, a cut-off number and runs that do not add up', () => {
  assert.match(check({ size: [3, 3], counts: '01 8' }), /character that is not allowed \(" " at position 3\)/);
  assert.match(check({ size: [3, 3], counts: '0p' }), /character that is not allowed/);   // "p" is above "o"
  assert.match(check({ size: [3, 3], counts: '01h' }), /end in the middle of a number/);  // "h" carries "more follows"
  assert.match(check({ size: [3, 3], counts: '017' }), /runs add up to 8 pixels, but its size is 3 x 3 \(9 pixels\)/);
  assert.match(check({ size: [3, 3], counts: '0190' }), /add up to/);
  assert.match(check({ size: [3, 3], counts: '0O' }), /less than 0 pixels/);                // "O" is -1
});

test('check refuses a missing mask, a bad size and one above the pixel bound', () => {
  assert.equal(check(null), 'The mask is missing.');
  assert.match(check({ counts: 'S1' }), /no size/);
  assert.match(check({ size: [0, 5], counts: '' }), /whole numbers above 0/);
  assert.match(check({ size: [2.5, 5], counts: 'S1' }), /whole numbers above 0/);
  assert.match(check({ size: [5, 7], counts: '' }), /no counts/);
  assert.match(check({ size: [20000, 20000], counts: 'S1' }), /too large/);
  assert.ok(MAX_PIXELS < 20000 * 20000);
  assert.match(check({ size: [5, 7], counts: 'S1' }, { maxPixels: 10 }), /too large/);
  assert.throws(() => decode({ size: [3, 3], counts: '017' }), /add up to/);
  assert.throws(() => area({ size: [3, 3], counts: '#' }), /not allowed/);
});

test('encode refuses a mask whose length is not its size', () => {
  assert.throws(() => encode(new Uint8Array(5), 2, 3), /holds 5 pixels, not 2 x 3/);
});

test('a large run and negative deltas round trip (multi-character numbers)', () => {
  const h = 300, w = 400, mask = new Uint8Array(h * w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = (x > 100 && x < 300 && y > 10) || (x === 350 && y < 3) ? 1 : 0;
  const rle = encode(mask, h, w);
  assert.equal(check(rle), '');
  assert.deepEqual(decode(rle), mask);
  assert.ok(stringToRuns(rle.counts).every(n => n >= 0));
});

test('resize keeps the size it is asked for and picks the nearest pixel by centres', () => {
  const big = { size: [4, 4], counts: encode(Uint8Array.from([1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1]), 4, 4).counts };
  const small = resize(big, 2, 2);
  assert.deepEqual(small.size, [2, 2]);
  assert.deepEqual(decode(small), Uint8Array.from([1, 0, 0, 1]));
  const back = resize(small, 4, 4);
  assert.equal(back.counts, big.counts);
  const f = fixtures.find(x => x.kind === 'floor' && x.w === 400);
  const up = resize(f, 1200, 1600);
  assert.equal(check(up, { size: [1200, 1600] }), '');
  assert.ok(Math.abs(area(up) - f.area * 16) / (f.area * 16) < 0.01);
  assert.equal(resize(f, f.h, f.w).counts, f.counts);
});
