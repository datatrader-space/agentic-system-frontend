import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneSecret, inBatches, qrOf, phoneApi, cameraSecret, cameraPhoneApi, scanFormats, SCAN_FORMATS } from '../src/api/phone.js';

test('a phone link secret is read from the address only when it looks like one', () => {
  const secret = 'Ab_cd-0123456789abcdefghijklmnopqrstuvwxyzAB';
  assert.equal(phoneSecret(`?phone=${secret}`), secret);
  assert.equal(phoneSecret('?phone=short'), '');
  assert.equal(phoneSecret('?phone=<script>alert(1)</script>aaaaaaaaaaaaaaaaaaaaaaa'), '');
  assert.equal(phoneSecret('?join=abc'), '');
});

test('photos go in parts, and the QR code is drawn here', () => {
  assert.deepEqual(inBatches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(inBatches([]), []);
  const qr = qrOf('https://aadml.com/dashboard/training-data/?phone=abc');
  assert.ok(qr.size > 20 && qr.path.startsWith('M'));
  assert.equal(qrOf(''), null);
});

test('the phone sends the secret as the Bearer credential, never in the address, and no cookie', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push([url, init.headers.Authorization, init.credentials]); return new Response('{"project":"Leads"}', { status: 200 }); };
  assert.deepEqual(await phoneApi.info('s3cret', { fetchImpl }), { project: 'Leads' });
  assert.deepEqual(seen, [['/api/training-data/v1/phone/', 'Bearer s3cret', 'omit']]);
  const refused = async () => new Response('{"error":"This link has expired. Ask for a new one.","code":"link_ended"}', { status: 403 });
  await assert.rejects(phoneApi.info('s3cret', { fetchImpl: refused }), { status: 403, message: 'This link has expired. Ask for a new one.' });
});

test('a camera pairing secret is read from its own parameter only when it looks like one', () => {
  const secret = 'Ab_cd-0123456789abcdefghijklmnopqrstuvwxyzAB';
  assert.equal(cameraSecret(`?camera=${secret}`), secret);
  assert.equal(cameraSecret(`?phone=${secret}`), '');
  assert.equal(phoneSecret(`?camera=${secret}`), '');
  assert.equal(cameraSecret('?camera=short'), '');
  assert.equal(cameraSecret('?camera=<img src=x onerror=alert(1)>aaaaaaaaaaaaaaaaaaaaaaaaaa'), '');
});

test('the phone sends the one value it scanned as JSON, with the pairing as the Bearer and no cookie', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, init }); return new Response('{"said":"Sent."}', { status: 200 }); };
  assert.deepEqual(await cameraPhoneApi.send('s3cret', 'rtsp://cam/live', { fetchImpl }), { said: 'Sent.' });
  await cameraPhoneApi.info('s3cret', { fetchImpl });
  assert.deepEqual(seen.map(s => [s.url, s.init.method, s.init.headers.Authorization, s.init.credentials]), [
    ['/api/training-data/v1/camera-pairing/', 'POST', 'Bearer s3cret', 'omit'], ['/api/training-data/v1/camera-pairing/', 'GET', 'Bearer s3cret', 'omit'],
  ]);
  assert.equal(seen[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(seen[0].init.body), { value: 'rtsp://cam/live' });
  const used = async () => new Response('{"error":"This pairing code was used already. Show a new one on the computer.","code":"pairing_ended"}', { status: 403 });
  await assert.rejects(cameraPhoneApi.send('s3cret', 'x', { fetchImpl: used }), { status: 403, message: /used already/ });
});

test('the browser\'s own reader is asked for the codes it says it reads, and none without a reader', async () => {
  assert.deepEqual(await scanFormats(undefined), []);
  class Reader { static async getSupportedFormats() { return ['qr_code', 'ean_13', 'unknown_kind']; } }
  assert.deepEqual(await scanFormats(Reader), ['qr_code', 'ean_13']);
  class Broken { static async getSupportedFormats() { throw new Error('no'); } }
  assert.deepEqual(await scanFormats(Broken), []);
  class Plain {}
  assert.deepEqual(await scanFormats(Plain), SCAN_FORMATS);
});
