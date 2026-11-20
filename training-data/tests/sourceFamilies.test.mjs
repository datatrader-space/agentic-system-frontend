import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSources, familyOfId, idFor, labelsOfId, waysOf, fillOpacityOf, sameAnswer } from '../src/sourceFamilies.js';

// As views._detect_sources + auto_label.sources send them (owner, 2026-11-09: GPT-6.1 Terra and Gemini 4 Argon, each
// alone and with SAM 3, beside SAM 3 and the project's own models).
const SOURCES = [
  { id: 'm2', name: 'fmw-walls 2.0.0', trained_here: true, labels: 'polygons' },
  { id: 'psegformer-b0', name: 'Aadml-Vision-seg-A0 as published', mode: 'Model Only', labels: 'polygons' },
  { id: 'sam3', name: 'SAM 3 (Polygons)', family: 'SAM 3', maker: 'Meta', labels: 'polygons', unavailable: '' },
  { id: 'sam3-masks', name: 'SAM 3 (Masks)', family: 'SAM 3', maker: 'Meta', labels: 'masks', unavailable: '' },
  { id: 'vision:openai/gpt-6.1-terra', name: 'GPT-6.1 Terra (Polygons)', family: 'GPT-6.1 Terra', maker: 'OpenAI', labels: 'polygons', unavailable: '' },
  { id: 'vision-masks:openai/gpt-6.1-terra', name: 'GPT-6.1 Terra (Masks)', family: 'GPT-6.1 Terra', maker: 'OpenAI', labels: 'masks', unavailable: '' },
  { id: 'vision-sam3:openai/gpt-6.1-terra', name: 'GPT-6.1 Terra + SAM 3 (Polygons)', family: 'GPT-6.1 Terra + SAM 3', maker: 'OpenAI', labels: 'polygons', unavailable: '' },
  { id: 'vision-sam3-masks:openai/gpt-6.1-terra', name: 'GPT-6.1 Terra + SAM 3 (Masks)', family: 'GPT-6.1 Terra + SAM 3', maker: 'OpenAI', labels: 'masks', unavailable: '' },
  { id: 'vision-sam3:google/gemini-4-argon', name: 'Gemini 4 Argon + SAM 3 (Polygons)', family: 'Gemini 4 Argon + SAM 3', maker: 'Google', labels: 'polygons',
    unavailable: 'Gemini 4 Argon is not available on the platform now' },
];

test('the models are grouped by maker in a fixed order, one row per model or pair', () => {
  const groups = groupSources(SOURCES);
  assert.deepEqual(groups.map(g => g.maker), ['OpenAI', 'Google', 'Meta', 'AADML', 'My Models']);
  assert.deepEqual(groups[0].families.map(f => f.name), ['GPT-6.1 Terra', 'GPT-6.1 Terra + SAM 3']);
  assert.deepEqual(groups[0].families[1].ids, { polygons: 'vision-sam3:openai/gpt-6.1-terra', masks: 'vision-sam3-masks:openai/gpt-6.1-terra' });
  assert.equal(groups[3].families[0].name, 'Model Only: Aadml-Vision-seg-A0 as published');   // a published detector
  assert.equal(groups[4].families[0].name, 'fmw-walls 2.0.0');                                 // trained in the project
});

test('a model the platform cannot run keeps its reason, so the picker shows it and does not offer it', () => {
  const argon = groupSources(SOURCES).find(g => g.maker === 'Google').families[0];
  assert.equal(argon.unavailable, 'Gemini 4 Argon is not available on the platform now');
});

test('the Masks / Polygons switch moves between the two sources of one family', () => {
  const groups = groupSources(SOURCES);
  const family = familyOfId(groups, 'vision-sam3:openai/gpt-6.1-terra');
  assert.equal(family.name, 'GPT-6.1 Terra + SAM 3');
  assert.equal(labelsOfId(SOURCES, 'vision-sam3:openai/gpt-6.1-terra'), 'polygons');
  assert.equal(idFor(family, 'masks'), 'vision-sam3-masks:openai/gpt-6.1-terra');
  assert.deepEqual(waysOf(family), ['polygons', 'masks']);
  const single = familyOfId(groups, 'm2');                       // a model with one way of showing: no switch
  assert.deepEqual(waysOf(single), ['polygons']);
  assert.equal(idFor(single, 'masks'), 'm2');
  assert.equal(familyOfId(groups, 'vision-boxes'), null);       // an id no longer offered belongs to no row
});

test('only a model on a server that is started says it may take a moment to start', async () => {
  const { startsServer } = await import('../src/sourceFamilies.js');
  // A hosted model (SAM 3, a vision + SAM 3 pair) is started by AADML only, never by a call (ADM-1182, 2026-11-19).
  assert.equal(startsServer({ id: 'sam3', hosted: { state: 'on', price: '$0.002 an image' } }), false);
  assert.equal(startsServer({ id: 'vision-sam3:openai/gpt-6.1-terra', hosted: { state: 'off', price: '' } }), false);
  assert.equal(startsServer({ id: 'vision:google/gemini-4-argon' }), false);
  assert.equal(startsServer({ id: 'vision-masks:openai/gpt-6.1-terra' }), false);
  assert.equal(startsServer({ id: 'm2' }), true);
});

test('the AI is asked for every class at first; an unticked one stays out, and a class added later is asked for', async () => {
  const kept = new Map();
  globalThis.localStorage = { getItem: k => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)) };
  const { askedClasses, keepAskedClasses } = await import('../src/api/annotate.js');
  const names = ['wall', 'window', 'door'];
  assert.deepEqual(askedClasses('p1', names), names);
  keepAskedClasses('p1', names, ['door']);                                    // wall and window unticked
  assert.deepEqual(askedClasses('p1', [...names, 'sofa']), ['door', 'sofa']); // sofa, added later, is asked for
  assert.deepEqual(askedClasses('p2', names), names);                         // another project keeps its own
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(askedClasses('p1', names), names);                         // a browser that keeps nothing asks all
  keepAskedClasses('p1', names, ['door']);                                    // and does not fail
  delete globalThis.localStorage;
});

// Nobody chooses where a model runs (ADM-1182, 2026-11-19): a source that still lists machines (``where``) is grouped
// without them, so no page can offer one.
test('a family keeps no machines to run on, even when its source lists some', () => {
  const machine = { id: 'machine:7', name: 'garage box', gpu: 'NVIDIA GeForce RTX 3070 (8.0 GB)', price: '$0.10 an hour', unavailable: '' };
  const own = groupSources([{ id: 'm2', name: 'Walls v2', trained_here: true, labels: 'polygons', unavailable: '', where: [machine] }])
    .find(g => g.maker === 'My Models').families[0];
  assert.equal('where' in own, false);
  assert.deepEqual(own.ids, { polygons: 'm2' });
});

// Live, 2026-11-17: the Label Batch dialog said "Each photo is charged to you:" followed by where a published model came
// from, and Find Objects read "...the model drew.As AADML published it".
test('only a price follows "charged to you"; a model\'s words and its detail read as two sentences', async () => {
  const { costOf, aboutOf } = await import('../src/sourceFamilies.js');
  const published = { id: 'psegformer-b0-tidy', name: 'Aadml-Vision-seg-A0 + tidy-up', platform: false, what: 'The walls it finds, tidied by the rules a person uses on what the model drew.', detail: 'As AADML published it, before any training here, made ready here Nov 1, 2026' };
  const sam3 = { id: 'sam3', name: 'SAM 3 (Polygons)', platform: true, what: 'SAM 3 finds every object of each class by its name and draws its outline.', detail: 'Runs on AADML, always on, $0.002 an image', where: [], hosted: { state: 'on', price: '$0.002 an image' } };
  assert.equal(costOf(published), '');
  assert.equal(costOf(sam3), sam3.detail);
  assert.equal(costOf(null), '');
  assert.equal(aboutOf(published), 'The walls it finds, tidied by the rules a person uses on what the model drew. As AADML published it, before any training here, made ready here Nov 1, 2026.');
  assert.equal(aboutOf({ detail: 'Trained in this project' }), 'Trained in this project.');
  assert.equal(aboutOf({ what: 'Finds walls' }), 'Finds walls.');
  assert.equal(aboutOf(null), '');
});

// Live, 2026-11-20: Auto Label threw SAM 3's preview away when Polygons was switched to Masks (asking and charging again),
// and the editor drew both ways alike. Polygons and Masks of one model are the same answer; a mask is drawn filled.
test('Polygons and Masks of one model are the same answer, drawn lighter and filled', () => {
  const byId = id => SOURCES.find(s => s.id === id);
  assert.equal(sameAnswer(byId('sam3'), byId('sam3-masks')), true);
  assert.equal(sameAnswer(byId('vision:openai/gpt-6.1-terra'), byId('sam3')), false);   // another model
  assert.equal(sameAnswer(byId('m2'), byId('psegformer-b0')), false);
  assert.equal(sameAnswer(byId('sam3'), null), false);
  assert.equal(fillOpacityOf('masks'), 0.55);
  assert.equal(fillOpacityOf('polygons'), 0.25);
  assert.equal(fillOpacityOf(undefined), 0.25);
});
