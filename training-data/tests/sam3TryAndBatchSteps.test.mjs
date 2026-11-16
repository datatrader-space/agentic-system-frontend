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

test('Try SAM 3 on the GPU offers Stop when the server allows it, and says when others use it', () => {
  assert.match(page, /onPlatform && !state\.machine \? 'Stop its GPU server'/);
  assert.match(page, /v-else-if="ready&&onPlatform&&state\.used_by_others"/);
  assert.match(page, /others are using it too, so it can't be stopped now/);
  assert.match(page, /Nobody else is using it now: stop it when you are done/);
  assert.doesNotMatch(page, /finds the walls, windows and doors of your photo/);
});

test('the person names what SAM 3 finds, and those names are sent with the photo', () => {
  assert.match(page, /const DEFAULT_CLASSES = \['wall', 'window', 'door'\]/);
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
