// Owner, 2026-11-16 (ADM-1182), three things found on the live site: Try SAM 3 on the RunPod GPU had no Stop; SAM 3
// was asked only for walls, windows and doors; Auto Label's preview showed "1 preview · 26 in batch" with no way to step
// to the next photo.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../src/components/WorkspaceModels.vue');
const result = read('../src/components/PredictionResult.vue');
const api = read('../src/api/workspace.js');
const auto = read('../src/components/AutoLabel.vue');

// Since 2026-11-19 (ADM-1182) SAM 3 is hosted by AADML: the Try page offers no Start, Stop or machine for it (the
// hosted panel, readyModelsHosted.test.mjs). Its old GPU words are gone.
test('Try SAM 3 offers no Start or Stop of a GPU server, and never says the walls words', () => {
  assert.doesNotMatch(page, /Start its GPU server|Stop its GPU server|Stop it on \$\{state\.machine\.name\}/);
  assert.doesNotMatch(page, /used_by_others|others are using it too|Nobody else is using it now/);
  assert.doesNotMatch(page, /finds the walls, windows and doors of your photo/);
});

// ADM-1344 part F: Aadml-Vision-seg-A0 is hosted like SAM 3, but it answers walls (call "walls"): its Try intro
// says what it marks, never "finds what you name".
test('a hosted walls model\'s Try says what it marks; only a segment model finds what you name', () => {
  assert.match(page, /findsByName \? `\$\{trying\.name\} finds what you name in your photo\.` : `\$\{trying\.name\} marks \$\{trying\.marks \|\| 'walls, windows and doors'\} in your photo\.`/);
});

test('the person names what SAM 3 finds, and those names are sent with the photo', () => {
  // Nothing is filled in (ADM-1182, 2026-11-19): the person names every thing to find.
  assert.match(page, /const classes = ref\(\[\]\);/);
  assert.doesNotMatch(page, /DEFAULT_CLASSES|\['wall', 'window', 'door'\]/);
  assert.match(page, /Name at least one thing to find\./);
  assert.match(page, /const MAX_CLASSES = 8;/);
  assert.match(page, /findsByName = computed\(\(\) => onPlatform\.value && state\.value\?\.call === 'segment'\)/);
  assert.match(page, /publishedApi\.predict\(trying\.value\.key, picked, findsByName\.value \? classes\.value : \[\]\)/);
  assert.match(page, /Find these in the same photo/);
  // A comma would split one name into two on the server.
  assert.match(page, /classText\.value\.replace\(\/,\/g, ' '\)/);
  assert.match(api, /if \(classes\.length\) form\.append\('classes', classes\.join\(','\)\)/);
});

test('an answer by name says what was found by name, and a trained model keeps the walls words', () => {
  assert.match(result, /const byName = computed\(\(\) => Array\.isArray\(props\.answer\?\.objects\)\)/);
  assert.match(result, /\['neutral', 'Nothing found', `The model found none of: \$\{asked \|\| 'what you named'\}\.`\]/);
  assert.match(result, /return VERDICTS\[props\.answer\?\.status\]/);
  assert.match(result, /\{\{ nameOf\(o\.type\) \}\}<\/td>/);
  assert.doesNotMatch(result, /o\.type==='door' \? 'Door' : 'Window'/);
  // Live, 2026-11-16: SAM 3 on AADML's GPU was said to answer "on its test server".
  assert.match(result, /answer\.served_by==='platform' \? 'on AADML\\'s GPU server'/);
});

test('Auto Label steps through the whole batch, and asks only about a photo it opens once previewing', () => {
  assert.match(auto, /aria-label="Previous photo"/);
  assert.match(auto, /aria-label="Next photo"/);
  assert.match(auto, /\{\{ at\+1 \}\} of \{\{ media\.length \}\}/);
  const go = auto.slice(auto.indexOf('function goTo(index) {'), auto.indexOf('// The left and right arrow keys'));
  assert.match(go, /if \(!previews\.value\.length\) \{ picked\.value = \[image\.id\]; return; \}/);   // nothing asked yet
  assert.match(go, /ask\(previews\.value\[i\]\)/);
  assert.match(auto, /\['INPUT', 'TEXTAREA', 'SELECT'\]\.includes\(t\.tagName\)/);                     // typing is not stepping
  assert.doesNotMatch(auto, /preview\{\{ picked\.length===1\?'':'s' \}\} · \{\{ media\.length \}\} in batch/);
  // Live, 2026-11-16: centred with overflow, a tall photo's top (and the refusal above it) was cut off out of reach.
  assert.match(auto, /\.auto-canvas\{[^}]*align-items:safe center;justify-content:safe center;[^}]*overflow:auto\}/);
  assert.match(auto, /<p v-if="shown\.state==='refused'" class="auto-refused" role="alert">/);
});
