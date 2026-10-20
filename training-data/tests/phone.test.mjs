import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneSecret, inBatches, qrOf, phoneApi } from '../src/api/phone.js';

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
