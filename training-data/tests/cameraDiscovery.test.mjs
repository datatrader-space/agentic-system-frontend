// "Find cameras" in the Connect a camera form (backend: machines.camera_discover / discovery_row, agent 1.6.0).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  machinesApi, agentAtLeast, discoverWhy, foundAddress, foundLine, FOUND_NEXT, DISCOVER_AGENT,
} from '../src/api/machines.js';

test('a search is started on one machine and its answer is read from that machine', async () => {
  const seen = [];
  const original = globalThis.fetch;
  globalThis.document = { cookie: 'csrftoken=tok' };
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({ discovery: { id: 9, state: 'looking', cameras: [] } }),
      { status: 202, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await machinesApi.discover(7);
    await machinesApi.discovery(7, 9);
  } finally { globalThis.fetch = original; delete globalThis.document; }
  assert.deepEqual(seen.map(s => [s.init.method, s.url]), [
    ['POST', '/api/training-data/app/workspace/machines/7/discover/'],
    ['GET', '/api/training-data/app/workspace/machines/7/discover/9/'],
  ]);
  assert.equal(seen[0].init.headers['X-CSRFToken'], 'tok');
});

test('a machine that cannot look says why before anything is asked', () => {
  assert.equal(DISCOVER_AGENT, '1.6.0');
  assert.equal(agentAtLeast('1.6.0', '1.6.0'), true);
  assert.equal(agentAtLeast('1.10.0', '1.6.0'), true);
  assert.equal(agentAtLeast('2.0.0', '1.6.0'), true);
  assert.equal(agentAtLeast('1.5.9', '1.6.0'), false);
  assert.equal(agentAtLeast('', '1.6.0'), false);
  assert.equal(agentAtLeast('1.6', '1.6.0'), false);
  assert.equal(discoverWhy({ name: 'Office PC', state: 'online', agent_version: '1.6.0' }), '');
  assert.equal(discoverWhy({ name: 'Office PC', state: 'offline', agent_version: '1.6.0' }),
    'Office PC is offline: start it, then look for cameras.');
  assert.match(discoverWhy({ name: 'Office PC', state: 'online', agent_version: '1.5.0' }),
    /^Office PC runs agent 1\.5\.0: looking for cameras needs 1\.6\.0 or later\..*type the camera's address\.$/);
  assert.equal(discoverWhy(null), '');
});

test('a camera found fills the address with its host on the RTSP port, nothing else', () => {
  assert.equal(foundAddress({ host: '192.168.1.20' }), 'rtsp://192.168.1.20:554/');
  assert.equal(foundAddress({ host: 'Cam-1.Local' }), 'rtsp://cam-1.local:554/');
  for (const host of ['', '999.1.1.1', 'admin:pw@192.168.1.20', '192.168.1.20/x', 'a b', 'javascript:alert(1)', null, 42]) {
    assert.equal(foundAddress({ host }), '', String(host));
  }
  assert.equal(foundAddress(null), '');
  assert.equal(foundLine({ host: '192.168.1.20', name: 'Front door', hardware: 'DS-2CD2042WD' }), 'Front door · DS-2CD2042WD (192.168.1.20)');
  assert.equal(foundLine({ host: '192.168.1.21', name: '', hardware: '' }), '192.168.1.21');
  assert.match(FOUND_NEXT, /stream path/);
  assert.match(FOUND_NEXT, /user name and password/);
});
