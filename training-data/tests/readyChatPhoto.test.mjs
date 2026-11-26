// ADM-1365 phase 2b: the admin's chat and photo models in the Ready to use tab. Try them free up to their tries a day,
// with the same chat box and photo answer as a workspace's open model; Use model gives a chat model's code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { useSnippet } from '../src/api/models.js';

const vue = readFileSync(new URL('../src/components/WorkspaceModels.vue', import.meta.url), 'utf8');

test('a ready chat or photo model is tried with the chat box or the photo answer, not the outline finder', () => {
  assert.match(vue, /const readyChat = computed\(\(\) => onPlatform\.value && state\.value\?\.call === 'chat'\)/);
  assert.match(vue, /const readyPipeline = computed\(\(\) => onPlatform\.value && state\.value\?\.call === 'pipeline'\)/);
  assert.match(vue, /<template v-if="state && readyChat">/);
  assert.match(vue, /<template v-else-if="state && readyPipeline">/);
  assert.match(vue, /<div v-else-if="!readyChat"><PredictionResult/);
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
