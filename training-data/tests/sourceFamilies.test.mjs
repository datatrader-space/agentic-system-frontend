import test from 'node:test';
import assert from 'node:assert/strict';
import { blockedAt, detailAt, groupSources, familyOfId, idFor, labelsOfId, licenceAccepted, placeOf, waysOf } from '../src/sourceFamilies.js';

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

// SAM 3 on the person's own machine (agentic-docs/SAM3_ON_MY_MACHINE_PLAN.md): a source with SAM 3 lists the machines
// it may run on (auto_label.sources ``where``); the others list none.
const MACHINE = { id: 'machine:7', kind: 'own_machine', name: 'garage box', gpu: 'NVIDIA GeForce RTX 3070 (8.0 GB)',
  state: 'licence', price: '$0.10 an hour, on your machine', unavailable: '', licence: { name: 'SAM License', url: 'https://github.com/facebookresearch/sam3/blob/main/LICENSE' }, running: null };
const ON_MACHINE = [
  { id: 'sam3', name: 'SAM 3 (Polygons)', family: 'SAM 3', maker: 'Meta', labels: 'polygons', unavailable: '',
    detail: "Meta's SAM 3 on AADML's GPU server (up to $1.20 an hour of GPU, charged by the second a call takes), started when it is needed", where: [{ ...MACHINE }] },
  { id: 'sam3-masks', name: 'SAM 3 (Masks)', family: 'SAM 3', maker: 'Meta', labels: 'masks', unavailable: '', where: [{ ...MACHINE }] },
  { id: 'vision-sam3:openai/gpt-6.1-terra', name: 'GPT-6.1 Terra + SAM 3 (Polygons)', family: 'GPT-6.1 Terra + SAM 3', maker: 'OpenAI', labels: 'polygons', unavailable: '',
    detail: "OpenAI's GPT-6.1 Terra at an outside AI provider, charged per photo at its token price, then Meta's SAM 3 on AADML's GPU server", where: [{ ...MACHINE }] },
  { id: 'vision:openai/gpt-6.1-terra', name: 'GPT-6.1 Terra (Polygons)', family: 'GPT-6.1 Terra', maker: 'OpenAI', labels: 'polygons', unavailable: '', where: [] },
];

test('a family with SAM 3 carries the machines it may run on, and only such a family', () => {
  const groups = groupSources(ON_MACHINE);
  const sam = groups.find(g => g.maker === 'Meta').families[0];
  assert.deepEqual(sam.where.map(p => p.id), ['machine:7']);
  assert.deepEqual(groups.find(g => g.maker === 'OpenAI').families.find(f => f.name === 'GPT-6.1 Terra').where, []);
  assert.equal(placeOf(ON_MACHINE[0], 'machine:7').name, 'garage box');
  assert.equal(placeOf(ON_MACHINE[0], ''), null);                       // AADML's GPU server
  assert.equal(placeOf(ON_MACHINE[3], 'machine:7'), null);              // a vision model alone never runs on a machine
});

test('a machine waiting for the SAM License blocks the run until it is accepted for the workspace', () => {
  const sources = JSON.parse(JSON.stringify(ON_MACHINE));
  assert.equal(blockedAt(sources[0], placeOf(sources[0], 'machine:7')), true);
  assert.equal(blockedAt(sources[0], null), false);                     // AADML's server needs no licence step
  licenceAccepted(sources);
  assert.deepEqual(sources.flatMap(s => s.where.map(p => p.state)), ['ready', 'ready', 'ready']);
  assert.equal(blockedAt(sources[0], placeOf(sources[0], 'machine:7')), false);
  assert.equal(blockedAt(sources[0], { ...MACHINE, state: 'ready', unavailable: 'The fee is not set.' }), true);
  assert.equal(blockedAt({ ...sources[0], unavailable: 'Not now.' }, null), true);
});

test('where it runs and its price are said with the machine, a vision model keeping its own words', () => {
  const place = { ...MACHINE, state: 'ready' };
  assert.equal(detailAt(ON_MACHINE[0], place), 'SAM 3 on garage box (NVIDIA GeForce RTX 3070 (8.0 GB)): $0.10 an hour, on your machine, charged by the second from your balance');
  assert.equal(detailAt(ON_MACHINE[2], place), "OpenAI's GPT-6.1 Terra at an outside AI provider, charged per photo at its token price, then SAM 3 on garage box (NVIDIA GeForce RTX 3070 (8.0 GB)): $0.10 an hour, on your machine, charged by the second from your balance");
  assert.equal(detailAt(ON_MACHINE[0], null), ON_MACHINE[0].detail);
});
