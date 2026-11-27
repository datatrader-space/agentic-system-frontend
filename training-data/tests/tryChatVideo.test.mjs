// ADM-1365 phase 2c: a video-understanding model's Try chat takes one MP4 (up to 20 MB) with a message, shown as a
// small video chip; every other chat takes photos only, as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addUserMessage, emptyChat, sortPicked, ATTACH_MAX_BYTES, MAX_PHOTOS } from '../src/api/assistantChat.js';

const chatVue = readFileSync(new URL('../src/components/AssistantChat.vue', import.meta.url), 'utf8');
const modelsVue = readFileSync(new URL('../src/components/WorkspaceModels.vue', import.meta.url), 'utf8');
const file = (name, type, size = 1000) => ({ name, type, size });

test('a chat that does not take a video refuses an MP4 in words, as before', () => {
  const picked = sortPicked([file('clip.mp4', 'video/mp4'), file('a.jpg', 'image/jpeg')], {}, false);
  assert.equal(picked.video, null);
  assert.equal(picked.photos.length, 1);
  assert.match(picked.error, /clip\.mp4 is not a photo: send a JPEG, PNG or WebP image\./);
});

test('a chat that takes a video takes one MP4 beside the photos', () => {
  const clip = file('clip.mp4', 'video/mp4');
  const picked = sortPicked([file('a.png', 'image/png'), clip], {}, true);
  assert.equal(picked.video, clip);
  assert.equal(picked.photos.length, 1);
  assert.equal(picked.error, '');
});

test('a second video, a bigger one or another kind of video is left out and said, never cut', () => {
  assert.match(sortPicked([file('b.mp4', 'video/mp4')], { video: true }, true).error, /One video goes with one message/);
  const two = sortPicked([file('a.mp4', 'video/mp4'), file('b.mp4', 'video/mp4')], {}, true);
  assert.equal(two.video.name, 'a.mp4');
  assert.match(two.error, /One video/);
  const big = sortPicked([file('big.mp4', 'video/mp4', ATTACH_MAX_BYTES + 1)], {}, true);
  assert.equal(big.video, null);
  assert.match(big.error, /big\.mp4 is larger than 20 MB/);
  assert.equal(ATTACH_MAX_BYTES, 20 * 1024 * 1024);
  const mov = sortPicked([file('c.mov', 'video/quicktime')], {}, true);
  assert.equal(mov.video, null);
  assert.match(mov.error, /not a photo or an MP4 video/);
});

test('photos stay at most four, and a video still fits beside four photos', () => {
  const four = Array.from({ length: MAX_PHOTOS }, (_, i) => file(`${i}.jpg`, 'image/jpeg'));
  const picked = sortPicked([...four, file('5.jpg', 'image/jpeg'), file('clip.mp4', 'video/mp4')], {}, true);
  assert.equal(picked.photos.length, MAX_PHOTOS);
  assert.equal(picked.video.name, 'clip.mp4');
  assert.match(picked.error, /Up to 4 photos/);
});

test('the sent message keeps its video to show', () => {
  const chat = addUserMessage(emptyChat(), 'what happens?', [], { url: 'blob:x', name: 'clip.mp4' });
  assert.deepEqual(chat.messages[0].video, { url: 'blob:x', name: 'clip.mp4' });
  assert.equal(addUserMessage(emptyChat(), 'hi').messages[0].video, null);
});

test('the chat takes a video only when told, shows it as a chip, and uploads it with the photos', () => {
  assert.match(chatVue, /acceptsVideo: \{ type: Boolean, default: false \}/);
  assert.match(chatVue, /const accept = computed\(\(\) => `image\/jpeg,image\/png,image\/webp\$\{props\.acceptsVideo \? `,\$\{VIDEO_TYPE\}` : ''\}`\)/);
  assert.match(chatVue, /<input v-if="acceptsPhotos" ref="picker" class="sr-only" type="file" :accept="accept"/);
  assert.match(chatVue, /<li v-if="video" :key="video\.url" class="pending-video" data-test="pending-video">\s*<video :src="video\.url" muted/);
  assert.match(chatVue, /if \(clip\) attachmentIds\.push\(await assistantChat\.upload\(chat\.conversationId, clip\.file\)\)/);
  assert.match(chatVue, /<video v-if="m\.role === 'user' && m\.video" class="msg-video"/);
});

test('a text-only chat model offers no photos and does not say it sees them (owner, 2026-11-27)', () => {
  assert.match(chatVue, /acceptsPhotos: \{ type: Boolean, default: true \}/);
  assert.match(chatVue, /<button v-if="acceptsPhotos" class="attach"/);
  assert.match(chatVue, /function onPaste\(event\) \{\r?\n {2}if \(!props\.acceptsPhotos\) return;/);
  assert.match(chatVue, /if \(props\.acceptsPhotos\) addPhotos\(\[\.\.\.\(event\.dataTransfer\?\.files/);
  assert.match(modelsVue, /const chatTakesPhotos = computed\(\(\) => readyChat\.value && \(\(state\.value\?\.vision \?\? trying\.value\?\.vision\) === true \|\| chatTakesVideo\.value\)\)/);
  assert.match(modelsVue, /:accepts-photos="chatTakesPhotos"/);
  assert.doesNotMatch(modelsVue, /answers your messages, and sees the photos you add when it reads images/);
  assert.match(modelsVue, /chatTakesPhotos \? ', and sees the photos you add' : ''/);
});

test('the Try panel tells the chat it takes a video for a model whose row or state says video', () => {
  assert.match(modelsVue, /const chatTakesVideo = computed\(\(\) => readyChat\.value && \(state\.value\?\.video \?\? trying\.value\?\.video\) === true\)/);
  assert.match(modelsVue, /<AssistantChat v-if="state && readyChat"[^>]*:accepts-video="chatTakesVideo"/);
});
