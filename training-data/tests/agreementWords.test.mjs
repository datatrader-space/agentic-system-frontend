// How closely two labellers agreed, in plain words (agreementWords.js): the corner figure and the mask overlap, each
// only when it was measured, a percent with at most one decimal, and the photos it comes from when the row says.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreementLines, agreementOf, percentOf } from '../src/agreementWords.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('a percent has at most one decimal', () => {
  assert.equal(percentOf(0.0081), '0.8');
  assert.equal(percentOf(0.78), '78');
  assert.equal(percentOf(0.7856), '78.6');
  assert.equal(percentOf(0.00004), '0');
  assert.equal(percentOf(1), '100');
});

test('both figures, one of them, or nothing', () => {
  const both = agreementLines(agreementOf({ agreement: 0.0081, agreement_mask_iou: 0.78, agreement_photos: 4 }));
  assert.deepEqual(both, ["Labellers agree: corners within 0.8 % of the photo's diagonal (4 photos)", 'Masks overlap 78 % (4 photos)']);
  assert.deepEqual(agreementLines(agreementOf({ agreement: 0.02, agreement_photos: 1 })), ["Labellers agree: corners within 2 % of the photo's diagonal (1 photo)"]);
  assert.deepEqual(agreementLines(agreementOf({ agreement_mask_iou: 0.5 })), ['Masks overlap 50 %']);   // a version sends no photo count
  assert.deepEqual(agreementLines(agreementOf({ agreement: null, agreement_mask_iou: null, agreement_photos: 0 })), []);
  assert.deepEqual(agreementLines(agreementOf({})), []);
  assert.deepEqual(agreementLines(agreementOf(null)), []);
  assert.deepEqual(agreementLines(), []);
  assert.deepEqual(agreementLines({ agreement: 0, maskIou: null, photos: 3 }), ["Labellers agree: corners within 0 % of the photo's diagonal (3 photos)"]);   // 0 is a figure
});

test('the batch page and the version card show the lines, with no filler', () => {
  const job = read('../src/components/AnnotationJob.vue');
  const studio = read('../src/components/ProjectStudio.vue');
  const annotate = read('../src/api/annotate.js');
  assert.match(job, /<div v-if="agreement\.length" class="job-section"><h3>Agreement<\/h3>/);
  assert.match(studio, /<p v-for="line in agreementLines\(agreementOf\(v\)\)" :key="line" class="version-agreement">\{\{ line \}\}<\/p>/);
  assert.match(annotate, /agreement: agreementOf\(row\),/);
  for (const text of [job, studio]) assert.doesNotMatch(text, /agreement[^\n]*'—'/);
});
