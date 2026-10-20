import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaPath, usable, sizeText, addedSaid, libraryApi } from '../src/api/library.js';

test('a Library file is asked from this site, by its path only', () => {
  assert.equal(mediaPath('http://192.168.18.10:8000/media/context_files/2026/10/20/room.jpg'), '/media/context_files/2026/10/20/room.jpg');
  assert.equal(mediaPath('https://aadml.com/media/media_artifacts/a.png?t=abc'), '/media/media_artifacts/a.png?t=abc');
  assert.equal(mediaPath('https://evil.example/steal.png'), '');
  assert.equal(mediaPath(''), '');
});

test('photos and videos go into a project; sounds and documents do not', () => {
  assert.deepEqual(['image', 'video', 'audio', 'document'].map(media_type => usable({ media_type })), [true, true, false, false]);
  assert.deepEqual([sizeText(0), sizeText(2048), sizeText(5 * 1024 * 1024)], ['', '2 KB', '5.0 MB']);
  assert.equal(addedSaid({ counts: { added: 2, already: 1, stored: 0, rejected: 1 } }, 'Walls'), '2 photos added to “Walls”, 1 already there, 1 file not taken.');
});

test('the Library lists Training\'s own files only, and uploads go to Training\'s Library', async () => {
  const asked = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { asked.push([init.method, url]); return new Response('{"items":[],"page":1,"has_more":false}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    await libraryApi.list({ type: 'video', q: ' room ', page: 2 });
    await libraryApi.upload(new File([new Uint8Array([1, 2])], 'room.jpg', { type: 'image/jpeg' }));
  } finally { globalThis.fetch = original; }
  assert.deepEqual(asked, [['GET', '/api/library/?origin=training&type=video&q=room&page=2&limit=40'],
    ['POST', '/api/training-data/app/library/']]);
});

test('an error of AADML\'s other APIs is read too', async () => {
  const { apiFetch } = await import('../src/api/client.js');
  const fetchImpl = async () => new Response('{"error":{"code":"not_found","message":"No file with that id is in your Library.","field":"attachment_id"}}', { status: 404, headers: { 'content-type': 'application/json' } });
  await assert.rejects(apiFetch('/video/library/', { fetchImpl }), { message: 'No file with that id is in your Library.', field: 'attachment_id' });
});
