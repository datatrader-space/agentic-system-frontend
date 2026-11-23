// Ready-to-use models hosted by AADML (owner, 2026-11-19, ADM-1182; agentic-docs/FIND_OBJECTS_AND_OWN_CLASSES_PLAN.md
// section 10): SAM 3, and SAM 3 inside a vision + SAM 3 pair, are started and stopped by the admin only. People never
// choose where they run: no place list, no place sent, no Start/Stop or machine on Try. Try is free, 20 images a person a
// day; every other use is charged per image ("$X an image", never "by the second"). No model in the editor, Auto Label or
// a labeling workflow has a place to choose either: the person's own models never ran on their machine from there.
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { aboutOf, costOf, groupSources, reasonOnly, sentence, startsServer } from '../src/sourceFamilies.js';
import { freeLeftAfter, freeTriesUsed, hostedTry } from '../src/api/workspace.js';

// Line endings read as LF: the sources are kept with CRLF in git, and a pattern below spans a line break.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const picker = read('../src/components/ModelSourcePicker.vue');
const editor = read('../src/components/AnnotationEditor.vue');
const autoLabel = read('../src/components/AutoLabel.vue');
const models = read('../src/components/WorkspaceModels.vue');
const samSelection = read('../src/useSamSelection.js');
const annotate = read('../src/api/annotate.js');
const unassigned = read('../src/components/UnassignedMedia.vue');
const workflow = read('../src/components/LabelingWorkflow.vue');

// As editor.detect / auto_label.sources send them (10.5): a hosted source has ``where: []``, ``hosted`` and ``detail``.
const ON = { id: 'sam3', name: 'SAM 3 (Polygons)', family: 'SAM 3', maker: 'Meta', labels: 'polygons', platform: true, unavailable: '',
  detail: 'Runs on AADML, always on, $0.002 an image', where: [], hosted: { state: 'on', price: '$0.002 an image' } };
const OFF = { ...ON, unavailable: 'SAM 3 is not running now. AADML starts it; try again later.', detail: 'Not running now: AADML starts it.',
  hosted: { state: 'off', price: '$0.002 an image' } };
// A source that (wrongly) still listed a machine is never given a place: the page has no place at all.
const STRAY = { ...ON, where: [{ id: 'machine:7', name: 'garage box', gpu: 'RTX 3070', price: '$0.10 an hour', unavailable: '' }] };

test('no model has a place: none is kept in a family, offered, chosen or sent', async () => {
  const family = groupSources([STRAY]).find(g => g.maker === 'Meta').families[0];
  assert.equal('where' in family, false);
  assert.deepEqual(family.hosted, { state: 'on', price: '$0.002 an image' });
  const helpers = await import('../src/sourceFamilies.js');
  for (const gone of ['placeOf', 'whereFor', 'blockedAt', 'detailAt', 'costAt', 'aboutAt', 'licenceAccepted']) assert.equal(helpers[gone], undefined, gone);
});

test('a hosted model says where it runs and its price an image, and is never "started" by a call', () => {
  assert.equal(costOf(ON), 'Runs on AADML, always on, $0.002 an image');
  assert.equal(costOf(STRAY), ON.detail);
  assert.equal(aboutOf(ON), 'Runs on AADML, always on, $0.002 an image.');
  assert.equal(startsServer(ON), false);
  assert.equal(startsServer({ id: 'm2' }), true);                       // a trained model is still started when needed
  assert.equal(sentence(ON.detail), 'Runs on AADML, always on, $0.002 an image.');
  assert.equal(sentence(OFF.detail), 'Not running now: AADML starts it.');
});

test('a hosted model AADML is not running cannot be chosen or run', () => {
  const family = groupSources([OFF]).find(g => g.maker === 'Meta').families[0];
  assert.equal(family.unavailable, OFF.unavailable);                  // listed with its reason, not offered
  assert.match(editor, /!samSources\.value\.length\|\|!!samSources\.value\[0\]\.unavailable\);/);
  assert.match(editor, /:disabled="!!findBlocked\|\|!pickedSource\|\|!!pickedSource\.unavailable"/);
  assert.match(autoLabel, /const blocked = computed\(\(\) => !current\.value \|\| !!current\.value\.unavailable\);/);
});

test('the picker has no place list: one line says where the chosen model runs', () => {
  assert.doesNotMatch(picker, /\bwhere\b:|update:where|v-model:where|places|setWhere|source-place|:aria-labelledby="`\$\{uid\}-where`"/);
  assert.doesNotMatch(picker, /AADML GPU · RunPod|by the second|Your machine|Also on your machine|>Where it runs</);
  assert.doesNotMatch(picker, /usesSam3|Where SAM 3 runs|accept-licence|stop-machine|SAM License|placeError|licenceBusy/);
  assert.match(picker, /const emit = defineEmits\(\['update:modelValue'\]\);/);
  assert.match(picker, /<template v-if="f\.hosted\?\.price"> · \{\{ f\.hosted\.price \}\}<\/template><\/small>/);
  assert.match(picker, /<div v-if="current" class="source-where"><span class="source-where-label">Where this model runs<\/span>/);
  // A model that cannot be chosen now says why there instead (its reason alone, not also its detail).
  assert.match(picker, /:role="current\.hosted \? 'status' : undefined">\{\{ current\.unavailable \|\| current\.detail/);
});

test('the editor sends no place with Find Objects, its preference or click-to-label', () => {
  assert.doesNotMatch(editor, /v-model:where|detectWhere|pickedPlace|preferredWhere|whereFor|placeOf|\.where\b/);
  assert.doesNotMatch(editor, /samWhere|samPlace|acceptLicence|stopOnMachine|licenceBusy|placeError/);
  assert.match(editor, /<ModelSourcePicker v-model="detectPick" :sources="meta\?\.detect\?\.sources\|\|\[\]"\/>/);
  assert.match(editor, /<ModelSourcePicker v-model="samModel" :sources="samSources" :disabled="samBusy"\/>/);
  // The model used is still remembered silently, without a place.
  assert.match(editor, /liveApi\.detectPreference\(props\.state\.ref,body\.started_model\)\.then\(kept=>\{meta\.value\.detect\.preference=kept\.preference;\}\)/);
  assert.match(editor, /Each new click asks SAM 3 for a new outline\$\{samPrice \? `, charged \$\{samPrice\}` : ''\}, paid from your balance\./);
  assert.match(samSelection, /message\.value = captured\.why \|\| 'SAM 3 cannot outline this photo now\.'/);
  assert.doesNotMatch(samSelection, /captured\.where|run location/);
});

test('the API sends no place: detect, detect-preference and segment-point take none', () => {
  assert.match(annotate, /detect: \(ref, photo, source, classes, find = null\) =>/);
  assert.match(annotate, /body: \{ source, \.\.\.\(find \? \{ find \} : classes \? \{ classes \} : \{\}\) \}/);
  assert.match(annotate, /detectPreference: \(ref, detect\) => json\(`\$\{base\(ref\)\}\/detect-preference\/`, 'POST', \{ detect \}\)/);
  // Smart Select and Box to outline (contract C4): the class, the points and, for Box to outline, the box; no place.
  assert.match(annotate, /segmentPoint: \(ref, photo, name, points, box = null, hover = false\) =>/);
  // ``hover`` (SMART_SELECT_HOVER_PLAN.md): the object under the mouse, shown only; still no place.
  assert.match(annotate, /body: \{ class: name, points, \.\.\.\(box \? \{ box: box\.map\(v => Math\.round\(v \* 10\) \/ 10\) \} : \{\}\), \.\.\.\(hover \? \{ hover: true \} : \{\}\) \}/);
  assert.doesNotMatch(annotate, /\bwhere\b:|where = ''|\{ where \}|acceptSamLicence|sam-licence/);
  assert.match(unassigned, /async function autoLabel\(source\)\{[^}]*api\.detectPreference\(props\.state\.ref,source\);/);
});

test('Auto Label chooses no place, says its price an image, and keeps no place in its workflow', () => {
  assert.doesNotMatch(autoLabel, /sentWhere|v-model:where|placeOf|whereFor|\bwhere\.value|config\.where|body\.where|place\.value|place\.price/);
  assert.match(autoLabel, /const definition = computed\(\(\) => \(\{ schema: 'aadml\.labeling-workflow\.v1', source: chosen\.value,\n {2}classes:/);
  assert.match(autoLabel, /api\.detect\(props\.state\.ref, preview\.image\.id, chosen\.value, asked\.value\)/);
  assert.match(autoLabel, /emit\('autolabel', chosen\.value\)/);
  assert.match(autoLabel, /<span>\{\{ current\.hosted\?\.price \|\| 'Uses balance' \}\}<\/span>/);
  assert.match(autoLabel, /AADML starts and stops it; each photo it answers is charged as one image\./);
  assert.doesNotMatch(autoLabel, /acceptLicence|stopOnMachine|SAM License|stopped after 15 minutes/);
  // Live, 2026-11-20: a "Find objects" project of plain classes was told to "check every corner"; corners are a
  // wall's only. The person checks every shape the model drew.
  assert.doesNotMatch(autoLabel, /every corner/);
  assert.match(autoLabel, /you check every shape it drew and send the photo to review\./);
  // The workflow's first node is the model alone, with no run-location line.
  assert.match(workflow, /<small>1 · Model<\/small><h4>/);
  assert.doesNotMatch(workflow, /run location|shown\.where|On one of your machines/);
});

test('the Try panel of a hosted model says its phase, the free tries left and the price an image', () => {
  assert.equal(hostedTry({ hosted: false }), null);
  assert.equal(hostedTry(null), null);
  const on = hostedTry({ served: 'platform', hosted: true, phase: 'ready', price_per_image: '$0.002 an image', free_per_day: 20, free_left: 17 });
  assert.deepEqual(on, { on: true, phase: 'Always on', free: 'Free: 17 of 20 tries left today',
    price: 'In a project it is $0.002 an image, paid from your balance.' });
  const off = hostedTry({ hosted: true, phase: 'off', price_per_image: '', free_per_day: 20, free_left: 20 });
  assert.equal(off.on, false);
  assert.equal(off.phase, 'Not running now: AADML starts it.');
  assert.equal(off.price, 'It has no price for use in a project yet, so it can only be tried here for now.');
});

test('each answer updates the tries left, and a 429 free_tries_used is told in the server\'s words', () => {
  assert.equal(freeLeftAfter({ free_left: 16 }, 17), 16);
  assert.equal(freeLeftAfter({}, 17), 17);
  assert.equal(freeTriesUsed({ status: 429, serverCode: 'free_tries_used' }), true);
  assert.equal(freeTriesUsed({ status: 429, serverCode: 'throttled' }), false);
  assert.equal(freeTriesUsed({ status: 400, serverCode: 'free_tries_used' }), false);
  assert.match(models, /if \(hosted\.value\) state\.value = \{ \.\.\.state\.value, free_left: freeLeftAfter\(answer\.value, state\.value\.free_left\) \};/);
  assert.match(models, /if \(freeTriesUsed\(e\)\) \{ freeUsed\.value = e\.message;/);
  assert.match(models, /<p v-if="freeUsed" class="field-error" role="alert">\{\{ freeUsed \}\}<\/p>/);
});

test('a hosted model\'s Try has no Start, Stop or machine picker; an open model keeps them', () => {
  const panel = models.slice(models.indexOf('<template v-else-if="hosted">'), models.indexOf('<template v-if="state">'));
  const hostedPart = panel.slice(0, panel.indexOf('<template v-else>'));
  assert.match(hostedPart, /\{\{ hosted\.phase \}\}/);
  assert.match(hostedPart, /\{\{ hosted\.free \}\}\.<\/strong> \{\{ hosted\.price \}\}/);
  assert.doesNotMatch(hostedPart, /MachinePicker|act\('stop'\)|startOn/);
  assert.match(models, /<ol v-if="!onPlatform" class="try-steps">/);
  assert.doesNotMatch(models, /charged by the second it takes<template v-if="state\.price">|on AADML's GPU server\. Each photo/);
  // The open models' Try (its own panel) keeps its Start/Stop and machine picker.
  const open = models.slice(models.indexOf('<section v-if="trying&&trying.repo" id="try-open"'), models.indexOf('</OpenModels>'));
  assert.match(open, /<MachinePicker v-if="state\.may\.start" ref="picker"/);
  assert.match(open, /Start its server<\/UiButton>/);
  assert.match(open, /Stop its server<\/UiButton>/);
});

// Live, 2026-11-19: the hosted SAM 3 Try said why it was not running three times (heading, a line, a sentence), each
// time ending "Nothing was charged." though nothing had been asked of it.
test('a model AADML is not running says why once, and never "Nothing was charged" when nothing was asked', () => {
  assert.equal(reasonOnly('SAM 3 is not running now. AADML starts it; try again later. Nothing was charged.'),
    'SAM 3 is not running now. AADML starts it; try again later.');
  assert.equal(reasonOnly('SAM 3 could not be reached. Nothing was charged; try again shortly.'), 'SAM 3 could not be reached. Try again shortly.');
  assert.equal(reasonOnly(''), '');
  assert.equal(reasonOnly(undefined), '');
  // The Try panel: the server's reason once, as its phase.
  const off = hostedTry({ hosted: true, phase: 'off', said: 'Not running now: AADML starts it.', free_per_day: 20, free_left: 20,
    refused: 'SAM 3 is not running now: the machine it runs on is not online. AADML starts it; try again later. Nothing was charged.' });
  assert.equal(off.phase, 'SAM 3 is not running now: the machine it runs on is not online. AADML starts it; try again later.');
  const starting = hostedTry({ hosted: true, phase: 'starting', said: 'Being started by AADML.', refused: '', free_per_day: 20, free_left: 3 });
  assert.equal(starting.phase, 'Being started by AADML.');
  const panel = models.slice(models.indexOf('<template v-else-if="hosted">'), models.indexOf('<template v-else>', models.indexOf('<template v-else-if="hosted">')));
  assert.equal((panel.match(/hosted\.phase|state\.said|state\.refused/g) || []).length, 1, panel);
  assert.doesNotMatch(panel, /Nothing was charged/);
  // The picker: a model that cannot be chosen shows its reason alone, also as its "where" line.
  const family = groupSources([{ ...OFF, unavailable: `${OFF.unavailable} Nothing was charged.` }]).find(g => g.maker === 'Meta').families[0];
  assert.equal(family.unavailable, OFF.unavailable);
  assert.match(picker, /\{\{ current\.unavailable \|\| current\.detail \|\| /);
  assert.match(picker, /<small v-if="f\.unavailable" class="source-off">\{\{ f\.unavailable \}\}<\/small>/);
  // Auto Label says it in its status bar only, not again under the picker.
  assert.doesNotMatch(autoLabel, /<p v-else-if="current\?\.unavailable"/);
});
