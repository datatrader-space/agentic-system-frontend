import test from 'node:test';
import assert from 'node:assert/strict';
import {
  streamingApi, downloadResults, addressProblem, addressKind, addressShown, privateHost, fileProblem, SCHEMES_HELP,
  NOT_PUBLIC, ADDRESS_LIMIT, streamState, isActive, anyActive, clockText, progressOf, capText, countsSaid, endedText,
  recentBars, megabytes,
} from '../src/api/streaming.js';

test('a stream address is rtsp, rtsps or https, and the message says which', () => {
  for (const good of ['rtsp://cam.example.com/live', 'rtsps://user:pass@cam.example.com:8555/stream1',
    'https://video.example.com/live/index.m3u8', 'https://video.example.com/clip.mp4', 'https://video.example.com/a/b.WEBM',
    'https://video.example.com/x.mov', 'rtsp://93.184.216.34:554/live', '  rtsp://cam.example.com/live  ']) {
    assert.equal(addressProblem(good), '', good);
  }
  assert.equal(addressProblem(''), 'Enter the stream address.');
  assert.equal(addressProblem('   '), 'Enter the stream address.');
  assert.equal(addressProblem(undefined), 'Enter the stream address.');
  for (const bad of ['http://cam.example.com/live.m3u8', 'file:///etc/passwd', 'ftp://cam.example.com/a.mp4',
    'rtmp://cam.example.com/live', 'udp://cam.example.com:1234', 'data:video/mp4;base64,AAAA', 'javascript:alert(1)',
    'cam.example.com/live', '//cam.example.com/live']) {
    assert.equal(addressProblem(bad), SCHEMES_HELP, bad);
  }
  assert.equal(addressProblem('rtsp:///live'), 'A stream address names its server: rtsp://camera.example.com/live');
  assert.equal(addressProblem('https://video.example.com/page.html'), 'An https address is an HLS playlist (.m3u8) or a video file (.mp4, .webm or .mov).');
  assert.equal(addressProblem('rtsp://cam.example.com/live stream'), `A stream address is one line of at most ${ADDRESS_LIMIT} characters.`);
  assert.equal(addressProblem(`rtsp://cam.example.com/${'a'.repeat(ADDRESS_LIMIT)}`), `A stream address is one line of at most ${ADDRESS_LIMIT} characters.`);
});

test('an address that names a machine of a private network is refused before it is sent', () => {
  for (const bad of ['rtsp://127.0.0.1/live', 'rtsp://localhost/live', 'rtsps://10.0.0.5/live', 'rtsp://192.168.1.20/live',
    'rtsp://172.16.0.1/live', 'rtsp://172.31.255.1/live', 'https://169.254.169.254/latest/a.m3u8', 'rtsp://0.0.0.0/live',
    'rtsp://100.64.0.9/live', 'rtsp://[::1]/live', 'rtsp://[fd00::1]/live', 'rtsp://[fe80::1]/live', 'rtsp://[::ffff:10.0.0.1]/live']) {
    assert.equal(addressProblem(bad), NOT_PUBLIC, bad);
  }
  for (const fine of ['172.15.0.1', '172.32.0.1', '93.184.216.34', '2001:db8::1', 'cam.example.com']) assert.equal(privateHost(fine), false, fine);
});

test('the kind of an address, and what of it is shown', () => {
  assert.equal(addressKind('rtsp://cam.example.com/live'), 'rtsp');
  assert.equal(addressKind('rtsps://cam.example.com/live'), 'rtsp');
  assert.equal(addressKind('https://video.example.com/live/index.M3U8'), 'hls');
  assert.equal(addressKind('https://video.example.com/clip.mp4'), 'file');
  assert.equal(addressKind('http://video.example.com/clip.mp4'), '');
  assert.equal(addressKind('nonsense'), '');
  assert.equal(addressShown('rtsp://user:s3cret@cam.example.com:8554/live?token=1'), 'rtsp://cam.example.com:8554');
  assert.equal(addressShown('https://video.example.com/a/b.m3u8'), 'https://video.example.com');
  assert.equal(addressShown(''), '');
});

test('an upload is an MP4, WebM or MOV video of at most the limit', () => {
  assert.equal(fileProblem({ name: 'walk.mp4', size: 1024 }), '');
  assert.equal(fileProblem({ name: 'WALK.MOV', size: 1024 }), '');
  assert.equal(fileProblem({ name: 'walk.webm', size: 1024 }), '');
  assert.equal(fileProblem(null), 'Choose a video.');
  assert.equal(fileProblem({ name: 'walk.avi', size: 1024 }), 'Choose an MP4, WebM or MOV video.');
  assert.equal(fileProblem({ name: 'walk', size: 1024 }), 'Choose an MP4, WebM or MOV video.');
  assert.equal(fileProblem({ name: 'walk.mp4', size: 0 }), 'That file is empty.');
  assert.equal(fileProblem({ name: 'walk.mp4', size: 201 * 1024 * 1024 }), 'That video is larger than 200 MB.');
  assert.equal(fileProblem({ name: 'walk.mp4', size: 11 }, { bytes: 10 }), 'That video is larger than 0 MB.');
  assert.equal(megabytes(200 * 1024 * 1024), 200);
});

test('a stream reads its state, its clock and its progress', () => {
  assert.deepEqual(streamState({ state: 'running' }), ['purple', 'Running']);
  assert.deepEqual(streamState({ state: 'done' }), ['green', 'Done']);
  assert.deepEqual(streamState({ state: 'failed' }), ['red', 'Failed']);
  assert.deepEqual(streamState({ state: 'cancelled' }), ['neutral', 'Stopped']);
  assert.equal(isActive({ state: 'queued' }), true);
  assert.equal(isActive({ state: 'done' }), false);
  assert.equal(anyActive([{ state: 'done' }, { state: 'running' }]), true);
  assert.equal(anyActive([]), false);
  assert.equal(clockText(7), '0:07');
  assert.equal(clockText(272.6), '4:32');
  assert.equal(clockText(3723), '1:02:03');
  assert.equal(clockText(null), '0:00');
  assert.equal(progressOf({ frames: 150, max_frames: 600 }), 0.25);
  assert.equal(progressOf({ frames: 900, max_frames: 600 }), 1);
  assert.equal(progressOf({ frames: 3 }), 0);
});

test('the cap is said for the frame rate chosen', () => {
  const cap = { seconds: 600, frames: 600 };
  assert.equal(capText(cap, 1), 'At 1 frame a second, a stream reads at most 10 minutes of video (600 frames).');
  assert.equal(capText(cap, 2), 'At 2 frames a second, a stream reads at most 5 minutes of video (600 frames).');
  assert.equal(capText(null, 1), '');
});

test('a frame\'s answer is read out in words, and why a stream ended', () => {
  assert.equal(countsSaid({ frame: 11, t: 11, counts: { walls: 2, windows: 1, doors: 0 } }), 'Frame 12 at 0:11: 2 walls, 1 window, no doors.');
  assert.equal(countsSaid({ frame: 0, t: 0, error: 'The model is starting.' }), 'Frame 1 at 0:00: no answer. The model is starting.');
  assert.equal(countsSaid(null), '');
  assert.equal(endedText({ state: 'running' }), '');
  assert.equal(endedText({ state: 'done', ended_because: 'ended' }), 'The video ended.');
  assert.equal(endedText({ state: 'done', ended_because: 'cap', max_frames: 600 }), 'Reached the cap of 600 frames.');
  assert.equal(endedText({ state: 'failed', error: 'No frame came from the video for 30 seconds.' }), 'No frame came from the video for 30 seconds.');
  assert.equal(endedText({ state: 'cancelled' }), 'Stopped before the video ended. Its answers so far are kept.');
});

test('the newest frames are drawn as bars of the walls each found', () => {
  const bars = recentBars([{ frame: 0, counts: { walls: 4 } }, { frame: 1, counts: { walls: 2 } }, { frame: 2, error: 'x' }, { frame: 3, counts: { walls: 0 } }], 32);
  assert.deepEqual(bars, [{ frame: 0, failed: false, h: 32 }, { frame: 1, failed: false, h: 16 }, { frame: 2, failed: true, h: 32 }, { frame: 3, failed: false, h: 2 }]);
  assert.deepEqual(recentBars(null), []);
});

test('a start sends an address as JSON and a video as multipart, with the workspace', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response('{"ok":true}', { status: 201, headers: { 'content-type': 'application/json' } }); };
  try {
    await streamingApi.start({ project: 'leads', model: 1, fps: 2, address: 'rtsp://cam.example.com/live' });
    const file = new File([new Uint8Array([0, 0, 0, 24])], 'walk.mp4', { type: 'video/mp4' });
    await streamingApi.start({ project: 'leads', model: 1, fps: 1, file });
  } finally { globalThis.fetch = realFetch; }
  assert.equal(calls[0].url, '/api/training-data/app/workspace/streams/');
  assert.deepEqual(JSON.parse(calls[0].init.body), { project: 'leads', model: 1, fps: 2, address: 'rtsp://cam.example.com/live' });
  assert.ok(calls[1].init.body instanceof FormData);
  assert.equal(calls[1].init.body.get('fps'), '1');
  assert.equal(calls[1].init.body.get('file').name, 'walk.mp4');
});

test('the results are fetched with the selected workspace and a refusal says the server\'s words', async () => {
  const store = { getItem: key => ({ activeWorkspaceId: '7', activeWorkspace: '{"id":7,"name":"Lab"}' })[key] ?? null };
  let asked;
  const refused = async (url, init) => { asked = { url, init }; return new Response('{"error":"Not found.","code":"not_found"}', { status: 404, headers: { 'content-type': 'application/json' } }); };
  await assert.rejects(downloadResults(12, { fetchImpl: refused, store }), { message: 'Not found.', status: 404 });
  assert.equal(asked.url, '/api/training-data/app/workspace/streams/12/results/');
  assert.equal(asked.init.headers['X-Workspace-ID'], '7');
  await assert.rejects(downloadResults(12, { fetchImpl: async () => { throw new TypeError('offline'); }, store }), { code: 'network' });
});
