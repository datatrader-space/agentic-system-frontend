import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, measureText, meets, msText, useSnippet } from '../src/api/models.js';

test('a share reads as a percentage and a corner error as a share of the diagonal', () => {
  assert.equal(measureText('wall_recall', 0.9234), '92.3%');
  assert.equal(measureText('median_corner_error', 0.0125), '1.25% of the diagonal');
  assert.equal(measureText('wall_recall', null), '—');
});

test('a measure meets its threshold in its own direction, and says nothing without one', () => {
  const recall = { key: 'wall_recall', direction: 'at_least', threshold: 0.9 };
  const error = { key: 'median_corner_error', direction: 'at_most', threshold: 0.01 };
  assert.equal(meets(recall, 0.95), true);
  assert.equal(meets(recall, 0.85), false);
  assert.equal(meets(error, 0.008), true);
  assert.equal(meets(error, 0.02), false);
  assert.equal(meets(recall, null), null);
  assert.equal(meets({ ...recall, threshold: null }, 0.95), null);
});

test('the catalogue is the backend rows, filtered by words, task and family', () => {
  const rows = [{ name: 'Aadml-Vision-seg-A0', publisher: 'AADML', kind: 'Semantic segmentation', description: 'Every pixel.', family: 'vision' },
                { name: 'SAM 3', publisher: 'Meta AI', kind: 'Instance segmentation', description: 'Masks.', coming: true, family: 'vision' },
                { name: 'Qwen3-8B', publisher: 'Alibaba', kind: 'Chat', description: 'Answers.', coming: true, family: 'llm' }];
  assert.equal(catalogue(rows).length, 3);
  assert.deepEqual(catalogue(rows, 'aadml').map(row => row.name), ['Aadml-Vision-seg-A0']);
  assert.deepEqual(catalogue(rows, '', 'Instance segmentation').map(row => row.name), ['SAM 3']);
  assert.deepEqual(catalogue(rows, '', '', 'llm').map(row => row.name), ['Qwen3-8B']);
  assert.equal(catalogue(rows, '', '', 'vision').length, 2);
});

test('the Use model code names the address and never fills in the key', () => {
  const url = 'https://aadml.com/api/training-data/v1/models/fmw-geometry/predict';
  for (const language of ['Python', 'JavaScript', 'cURL']) {
    const code = useSnippet(language, url);
    assert.ok(code.includes(url), language);
    assert.ok(code.includes('<your app key>'), language);
  }
});

test('a duration reads in milliseconds below a second', () => {
  assert.equal(msText(84.4), '84 ms');
  assert.equal(msText(2350), '2.4 s');
  assert.equal(msText(null), '—');
});

test('every tab of the workspace Models page has its own section (2026-10-28: a renamed tab fell through to Usage)', async () => {
  const { readFile } = await import('node:fs/promises');
  const page = await readFile(new URL('../src/components/WorkspaceModels.vue', import.meta.url), 'utf8');
  const names = [...page.match(/const tabs = \[([^\]]*)\]/)[1].matchAll(/name: '([^']+)'/g)].map(m => m[1]);
  assert.ok(names.length >= 3);
  for (const name of names.slice(0, -1)) assert.ok(page.includes(`active==='${name}'`), name);   // the last tab is the v-else
});
