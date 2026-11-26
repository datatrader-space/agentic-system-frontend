// ADM-1365 phase 2b: the admin's chat and photo models in the Ready to use tab. Try them free up to their tries a day,
// with the same chat box and photo answer as a workspace's open model; Use model gives a chat model's code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { useSnippet } from '../src/api/models.js';

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
  assert.match(vue, /function onPanelKey\(event\) \{ if \(event\.key === 'Escape'\)/);
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
