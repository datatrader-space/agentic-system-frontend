import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  openModelsApi, cleanQuery, queryProblem, hubLink, shortCount, bytesText, usesText, stateBadge, anyFetching,
  hiddenSummary, mergePage, resultsSaid, addRefusal, addedFor, KINDS, USES, QUERY_LIMIT,
} from '../src/api/openModels.js';

function fakeStore() {
  const data = { activeWorkspaceId: '7', activeWorkspace: JSON.stringify({ id: 7, name: 'Acme' }) };
  return { getItem: key => data[key] ?? null };
}

async function capture(call) {
  const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { seen.push({ url, init }); return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  try { await call(); } finally { globalThis.fetch = original; }
  return seen;
}

test('the API helpers call the backend paths, with the query and the body the backend reads', async () => {
  const seen = await capture(async () => {
    await openModelsApi.search({ q: '  small   qwen ', kind: 'chat', use: 'train', cursor: 'abc=' });
    await openModelsApi.search();
    await openModelsApi.list();
    await openModelsApi.add('Qwen/Qwen2.5-0.5B-Instruct');
    await openModelsApi.remove(12);
  });
  assert.equal(seen[0].url, '/api/training-data/app/open-models/?q=small+qwen&kind=chat&use=train&cursor=abc%3D');
  assert.equal(seen[1].url, '/api/training-data/app/open-models/?kind=chat&use=train');
  assert.equal(seen[2].url, '/api/training-data/app/workspace/open-models/');
  assert.equal(seen[3].url, '/api/training-data/app/workspace/open-models/');
  assert.equal(seen[3].init.method, 'POST');
  assert.deepEqual(JSON.parse(seen[3].init.body), { repo: 'Qwen/Qwen2.5-0.5B-Instruct' });
  assert.equal(seen[4].url, '/api/training-data/app/workspace/open-models/12/remove/');
  assert.equal(seen[4].init.method, 'POST');
  for (const call of seen) {
    assert.equal(call.init.credentials, 'same-origin');
    assert.equal(call.init.redirect, 'error');
    assert.equal(call.init.headers.Authorization, undefined);
  }
});

test('the words are one line, and at most the limit', () => {
  assert.equal(cleanQuery('  a \n b\t c '), 'a b c');
  assert.equal(cleanQuery(undefined), '');
  assert.equal(queryProblem('x'.repeat(QUERY_LIMIT)), '');
  assert.equal(queryProblem('x'.repeat(QUERY_LIMIT + 1)), `Search with at most ${QUERY_LIMIT} characters.`);
  assert.deepEqual(KINDS.map(k => k.value), ['chat', 'photo']);
  assert.deepEqual(USES.map(u => u.value), ['train', 'deploy']);
});

test('a link to Hugging Face is built only from a checked repository name', () => {
  assert.equal(hubLink('Qwen/Qwen2.5-0.5B-Instruct'), 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct');
  for (const bad of ['javascript:alert(1)', 'https://evil.example.com/x', '../etc/passwd', 'a/../b', 'owner', 'a/b/c',
    'a/b c', '<script>/x', '', null, undefined]) {
    assert.equal(hubLink(bad), '', String(bad));
  }
});

test('counts, sizes and uses read in plain words', () => {
  assert.equal(shortCount(999), '999');
  assert.equal(shortCount(1234), '1.2K');
  assert.equal(shortCount(1000), '1K');
  assert.equal(shortCount(3_400_000), '3.4M');
  assert.equal(shortCount('x'), '0');
  assert.equal(bytesText(988_097_824), '942 MB');
  assert.equal(bytesText(3 * 1024 ** 3), '3 GB');
  assert.equal(bytesText(7000), '7 KB');
  assert.equal(usesText(['train', 'deploy']), 'Train, or deploy as is');
  assert.equal(usesText(['train']), 'Train');
  assert.equal(usesText(['deploy']), 'Deploy as is');
  assert.equal(usesText([]), '');
});

test('an added model says where it stands', () => {
  assert.deepEqual(stateBadge('ready'), ['green', 'Ready to train']);
  assert.deepEqual(stateBadge('fetching'), ['purple', 'Being fetched']);
  assert.deepEqual(stateBadge('failed'), ['amber', 'Fetch failed']);
  assert.deepEqual(stateBadge('other'), ['neutral', 'Not added']);
  assert.equal(anyFetching([{ state: 'ready' }, { state: 'fetching' }]), true);
  assert.equal(anyFetching([{ state: 'ready' }]), false);
  assert.equal(anyFetching(null), false);
});

test('the models left out of a page are said with their reasons, none hidden', () => {
  const reasons = { licence: 'Its licence does not allow commercial use, or it names no licence.', size: 'It is too large.' };
  assert.equal(hiddenSummary({}, reasons), '');
  assert.equal(hiddenSummary({ licence: 0 }, reasons), '');
  assert.equal(hiddenSummary({ size: 1 }, reasons), '1 model on this page is not shown (1: it is too large).');
  assert.equal(hiddenSummary({ size: 1, licence: 3, weights: 2 }, reasons),
    '6 models on this page are not shown (3: its licence does not allow commercial use, or it names no licence; 2: weights; 1: it is too large).');
});

test('the next page adds to the shown results, each model once, and nothing is cut', () => {
  const first = Array.from({ length: 50 }, (_, i) => ({ repo: `a/m${i}` }));
  const second = [{ repo: 'a/m49' }, ...Array.from({ length: 50 }, (_, i) => ({ repo: `b/m${i}` }))];
  const merged = mergePage(first, second);
  assert.equal(merged.length, 100);
  assert.equal(merged[50].repo, 'b/m0');
  assert.equal(resultsSaid(0, false), 'No model matches. Try other words, or switch between Photo and Chat.');
  assert.equal(resultsSaid(1, false), '1 model shown.');
  assert.equal(resultsSaid(100, true), '100 models shown; more can be loaded.');
});

test('the page shows the Hub\'s words as text only and is mounted on the Models page', () => {
  const component = readFileSync(new URL('../src/components/OpenModels.vue', import.meta.url), 'utf8');
  assert.equal(/v-html/.test(component), false, 'no Hub text is ever rendered as HTML');
  assert.equal(/window\.(confirm|alert|prompt)\(|\b(confirm|alert|prompt)\(/.test(component.replace(/<style[\s\S]*<\/style>/, '')), false, 'no native dialog');
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.match(component, /:href="hubLink\(/);
  assert.equal(/:href="row\.link"/.test(component), false, 'a link is never taken from the Hub\'s answer');
  assert.match(component, /@media \(max-width:640px\)/);
  assert.match(component, /prefers-reduced-motion/);
  assert.equal(/\bnotice\b/i.test(component.replace(/<style[\s\S]*<\/style>/, '')), false, 'say notification, never notice');
  const page = readFileSync(new URL('../src/components/WorkspaceModels.vue', import.meta.url), 'utf8');
  assert.match(page, /import OpenModels from '\.\/OpenModels\.vue';/);
  assert.match(page, /\{ name: 'Open models', icon: Globe \}/);
  assert.match(page, /<OpenModels v-else-if="active==='Open models'"\/>/);
});

test('the workspace header goes with every call, so the backend answers for the workspace chosen in AADML', async () => {
  const seen = [];
  const { apiFetch } = await import('../src/api/client.js');
  await apiFetch('/training-data/app/workspace/open-models/', {
    store: fakeStore(),
    fetchImpl: async (url, init) => { seen.push(init); return new Response('{"models":[]}', { status: 200, headers: { 'content-type': 'application/json' } }); },
  });
  assert.equal(seen[0].headers['X-Workspace-ID'], '7');
});

test('a model AADML only serves can be added; a gated one only once AADML\'s access is set up', () => {
  const deployOnly = { repo: 'acme/detr', uses: ['deploy'], gated: false };
  const gated = { repo: 'meta-llama/x', uses: ['train', 'deploy'], gated: true, gated_note: 'AADML adds such a model only once its own Hugging Face access is set up.' };
  assert.equal(addRefusal(deployOnly, { mayAdd: true }), '');
  assert.equal(addRefusal(deployOnly, { mayAdd: false }), 'Adding a model needs the Train right in this workspace.');
  assert.equal(addRefusal(gated, { mayAdd: true, gatedEnabled: false }), gated.gated_note);
  assert.equal(addRefusal(gated, { mayAdd: true, gatedEnabled: true }), '');
  assert.equal(addRefusal({ ...gated, gated_note: '' }, { mayAdd: true }).includes('not set up yet'), true);
  assert.equal(addRefusal({ uses: [] }, { mayAdd: true }), 'AADML can neither train nor serve this model.');
  assert.equal(addedFor({ uses: ['deploy'] }), 'Deployed as is from a dedicated deployment; not offered for training.');
  assert.equal(addedFor({ uses: ['train'] }), 'Offered in the Train tab.');
  assert.equal(addedFor({ uses: ['train', 'deploy'] }), 'Offered in the Train tab, and can be deployed as is.');
  assert.equal(addedFor({}), '');
  for (const text of [addRefusal(deployOnly, { mayAdd: true }), addedFor({ uses: ['deploy'] })]) {
    assert.equal(/cannot be trained/.test(text), false);
  }
});
