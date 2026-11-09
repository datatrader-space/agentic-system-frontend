import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSources, familyOfId, idFor, labelsOfId, waysOf } from '../src/sourceFamilies.js';

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
  assert.equal(startsServer({ id: 'sam3' }), true);
  assert.equal(startsServer({ id: 'vision-sam3:openai/gpt-6.1-terra' }), true);      // SAM 3 is started for the pair
  assert.equal(startsServer({ id: 'vision:google/gemini-4-argon' }), false);
  assert.equal(startsServer({ id: 'vision-masks:openai/gpt-6.1-terra' }), false);
  assert.equal(startsServer({ id: 'm2' }), true);
});
