// ADM-1365 phase 2b: the admin's chat and photo models in the Ready to use tab. Try them free up to their tries a day,
// with the same chat box and photo answer as a workspace's open model; Use model gives a chat model's code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { useSnippet } from '../src/api/models.js';
import { generateBody, mediaKindName, SIZE_PRESETS } from '../src/api/workspace.js';

const vue = readFileSync(new URL('../src/components/WorkspaceModels.vue', import.meta.url), 'utf8');

test('a ready chat or photo model is tried with the chat or the photo answer, not the outline finder', () => {
  assert.match(vue, /const readyChat = computed\(\(\) => onPlatform\.value && state\.value\?\.call === 'chat'\)/);
  assert.match(vue, /const readyPipeline = computed\(\(\) => onPlatform\.value && state\.value\?\.call === 'pipeline'\)/);
  assert.match(vue, /<template v-else-if="state && readyPipeline">/);
  assert.match(vue, /<div v-else-if="!readyChat"><PredictionResult/);
});

// ADM-1365 step 4: a hosted chat or vision model is tried in the existing chat, run as every agent runs (the Try agent
// bound to the model); every published model's Try opens in a side panel.
test('a ready chat model is tried in the existing chat, started as its own Try conversation', () => {
  assert.match(vue, /<AssistantChat v-if="state && readyChat"[^>]*:start-conversation="openTryChat"/);
  assert.match(vue, /const openTryChat = \(\) => publishedApi\.tryConversation\(trying\.value\.key\)/);
  assert.doesNotMatch(vue, /ModelChatWidget/);
});

test('every published model is tried in a side panel that closes on Escape and gives focus back', () => {
  assert.match(vue, /id="try-published" class="panel try-panel try-side"[\s\S]*?role="dialog" aria-modal="true" aria-labelledby="try-title"/);
  assert.match(vue, /function onPanelKey\(event\) \{\s+if \(event\.key !== 'Escape'/);
  // Heard on the document while the panel is open, so Escape works wherever focus fell (live check, 2026-11-26).
  assert.match(vue, /if \(open\) document\.addEventListener\('keydown', onPanelKey\); else document\.removeEventListener\('keydown', onPanelKey\)/);
  assert.match(vue, /onUnmounted\(\(\) => document\.removeEventListener\('keydown', onPanelKey\)\)/);
  assert.match(vue, /nextTick\(\(\) => opener\?\.focus\?\.\(\)\)/);
  assert.match(vue, /\.try-side\{position:fixed/);
});

test('its free tries left follow each answer, and today\'s used are said in the server\'s words', () => {
  const chat = vue.slice(vue.indexOf('async function sendChat'), vue.indexOf('async function chooseOpen'));
  assert.match(chat, /freeLeftAfter\(body, state\.value\.free_left\)/);
  assert.match(chat, /freeTriesUsed\(e\)/);
  const photo = vue.slice(vue.indexOf('async function chooseOpen'));
  assert.match(photo, /freeLeftAfter\(openAnswer\.value, state\.value\.free_left\)/);
});

test('Use model gives a ready chat model the chat completions code', () => {
  const url = 'https://aadml.com/api/training-data/v1/models/qwen3-small/v1/chat/completions';
  for (const language of ['Python SDK', 'JavaScript', 'cURL']) {
    const code = useSnippet(language, url, 'qwen3-small', null, 'chat');
    assert.ok(code.includes('/api/training-data/v1/models/qwen3-small/v1'), language);
    assert.ok(!code.includes('room.jpg'), `${language}: a chat model is not sent a photo`);
  }
});

// Admin only (owner, 2026-11-26): listed for everyone in Ready to use, disabled with the reason for anyone but a
// platform administrator (the server decides `usable`).
test('an admin-only model is listed, marked, and its Use model and Try it are disabled for a normal user', () => {
  assert.match(vue, /<UiBadge v-if="row\.admin_only" tone="amber">Admin only<\/UiBadge>/);
  assert.match(vue, /<UiButton v-if="row\.use" variant="primary" :disabled="row\.usable === false"/);
  assert.match(vue, /:disabled="!data\.may\.try\|\|!!row\.not_tried\|\|row\.usable === false"/);
  assert.match(vue, /\{\{ row\.admin_only_said \}\}/);
});

// ADM-1365 phase 2c: a hosted image or video generation model is tried with a form of words (and a photo for an
// image-to-* task) in the same side panel; the image or video it makes is shown with a download.
test('a generation model is tried with the generate form, called with a long timeout', () => {
  const api = readFileSync(new URL('../src/api/workspace.js', import.meta.url), 'utf8');
  assert.match(api, /generate: \(key, body\) => apiFetch\(`\$\{APP\}\/published\/\$\{enc\(key\)\}\/generate\/`, \{ method: 'POST', body, timeoutMs: GENERATE_MS \}\)/);
  assert.match(api, /const GENERATE_MS = 15 \* 60 \* 1000;/);
  assert.match(vue, /const readyMedia = computed\(\(\) => \(state\.value\?\.call \|\| trying\.value\?\.call\) === 'media'\)/);
  assert.match(vue, /<form v-else-if="state && readyMedia" class="gen-form"[^>]*@submit\.prevent="generate">/);
  assert.match(vue, /<textarea id="gen-prompt" v-model="gen\.prompt"/);
  assert.match(vue, /<template v-if="needsPhoto\(mediaTask\)">/);
  assert.match(vue, /<template v-if="isVideo">[\s\S]*?id="gen-seconds"[\s\S]*?id="gen-fps"/);
  assert.match(vue, /:disabled="!ready\|\|generating\|\|!gen\.prompt\.trim\(\)"/);
  assert.match(vue, /class="gen-status" role="status" aria-live="polite"/);
  assert.match(vue, /Generating the video… this can take a few minutes/);
  // The other models keep their own Try.
  assert.match(vue, /<div v-if="readyMedia">[\s\S]*?<div v-else-if="readyPipeline"><PipelineResult/);
});

test('the image or the video is shown with its download, the free tries and the charge in the server\'s words', () => {
  assert.match(vue, /<video :src="genResult\.video\.url" controls/);
  assert.match(vue, /:href="genResult\.video\.url" :download="resultName\('mp4'\)"/);
  assert.match(vue, /<figure v-for="\(img, i\) in genResult\.images \|\| \[\]"/);
  assert.match(vue, /\{\{ genResult\.charged \}\}/);
  const call = vue.slice(vue.indexOf('async function generate'), vue.indexOf('const genWaiting'));
  assert.match(call, /publishedApi\.generate\(key, made\.body\)/);
  assert.match(call, /freeLeftAfter\(body, state\.value\.free_left\)/);
  assert.match(call, /freeTriesUsed\(e\)/);
  assert.match(call, /showGenError\(e\.message, e\.field\)/);
  assert.match(call, /document\.getElementById\('gen-result'\)\?\.focus\(\)/);
});

test('a generation model\'s card says Image generation or Video generation', () => {
  assert.match(vue, /<UiBadge v-if="row\.call === 'media'" tone="purple">\{\{ mediaKindName\(row\.media_task\) \|\| 'Generation' \}\}<\/UiBadge>/);
  assert.equal(mediaKindName('text-to-image'), 'Image generation');
  assert.equal(mediaKindName('image-to-image'), 'Image generation');
  assert.equal(mediaKindName('text-to-video'), 'Video generation');
  assert.equal(mediaKindName('image-to-video'), 'Video generation');
  assert.equal(mediaKindName('chat'), '');
});

test('the generate body is checked before the call and carries only what the task takes', () => {
  const square = SIZE_PRESETS.image[0];
  assert.deepEqual(generateBody({ prompt: '  ' }, 'text-to-image'), { error: 'Describe what to make.', field: 'prompt' });
  assert.deepEqual(generateBody({ prompt: 'a cat', negative: ' blur ', size: square, seed: '7' }, 'text-to-image'),
    { body: { prompt: 'a cat', negative_prompt: 'blur', width: 1024, height: 1024, seed: 7 } });
  assert.equal(generateBody({ prompt: 'a cat' }, 'image-to-image').field, 'image');
  assert.deepEqual(generateBody({ prompt: 'a cat', image: 'QUJD' }, 'image-to-image'), { body: { prompt: 'a cat', image: 'QUJD' } });
  assert.deepEqual(generateBody({ prompt: 'waves', size: SIZE_PRESETS.video[0] }, 'text-to-video'),
    { body: { prompt: 'waves', width: 768, height: 512, seconds: 4, fps: 16 } });
  assert.equal(generateBody({ prompt: 'waves', seconds: 11 }, 'text-to-video').field, 'seconds');
  assert.equal(generateBody({ prompt: 'waves', fps: 7 }, 'image-to-video').field, 'image');
  assert.equal(generateBody({ prompt: 'waves', fps: 7, image: 'QUJD' }, 'image-to-video').field, 'fps');
  assert.equal(generateBody({ prompt: 'a cat', seed: '-1' }, 'text-to-image').field, 'seed');
  assert.ok(!('seconds' in generateBody({ prompt: 'a cat', seconds: 3 }, 'text-to-image').body));
  assert.ok([...SIZE_PRESETS.image, ...SIZE_PRESETS.video].every(s => s.width % 8 === 0 && s.height % 8 === 0 && s.width >= 256 && s.height <= 2048));
});
