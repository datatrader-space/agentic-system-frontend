import test from 'node:test';
import assert from 'node:assert/strict';
import {
  streamingApi, downloadResults, addressProblem, addressKind, addressShown, privateHost, fileProblem, SCHEMES_HELP,
  NOT_PUBLIC, ADDRESS_LIMIT, streamState, isActive, anyActive, clockText, progressOf, capText, countsSaid, endedText,
  recentBars, megabytes, videoSources, classesOf, totalOf, classNames, countOf, classesText, SOURCE_FILTERS, CONSENT_TEXT,
  SOURCE_SCHEMES_HELP, sourceStateKey, sourceState, sourceCounts, filterSources, sourceShown, sourceKindLabel, thumbnailOf,
  lastFrameText, limitText, summaryItems, sourceAddressProblem, sourceForm, sourceFormProblems, sourceBody, sourceLine, runningText,
  canWatch, liveAnswer, liveErrorText, LIVE_NOT_LIVE, LIVE_UNAVAILABLE, LIVE_GONE, LIVE_NO_ANSWER, LIVE_NOT_PLAYABLE,
  recordingsApi, dayRange, windowText, sizeText, dayPriceText, connectorAddressProblem, CONNECTOR_ADDRESS_HELP,
  historyRows, monthText, spendItems, connectorRows, connectorLine,
  streamWhat, codesRead, frameCodesText, formFromScan, pairingApi, CODE_VALUE_LIMIT,
} from '../src/api/streaming.js';
import { timeAgo } from '../src/api/workspace.js';

test('a camera on a machine: a private rtsp address, its machine, no live view', () => {
  assert.equal(connectorAddressProblem('rtsp://192.168.1.20:554/stream1'), '');
  assert.equal(connectorAddressProblem('rtsps://10.0.0.5/live'), '');
  for (const bad of ['http://192.168.1.20/', 'file:///etc/passwd', 'rtsp://', 'rtsp://a b']) assert.equal(connectorAddressProblem(bad), CONNECTOR_ADDRESS_HELP, bad);
  assert.equal(connectorAddressProblem(''), 'Enter the camera address.');
  const form = { name: 'Loading bay', address: 'rtsp://192.168.1.20/s1', username: '', password: '', project: '', consent: true, machine: '' };
  assert.equal(sourceFormProblems(form, { connector: true }).machine, 'Choose the machine the camera is on.');
  assert.deepEqual(sourceFormProblems({ ...form, machine: '3' }, { connector: true }), {});
  assert.equal(sourceFormProblems({ ...form, machine: '3' }).address !== undefined, true);   // as a camera URL it is private
  assert.deepEqual(sourceBody({ ...form, machine: '3' }), { name: 'Loading bay', kind: 'connector', address: 'rtsp://192.168.1.20/s1', machine: '3', consent: true });
  assert.equal(canWatch({ kind: 'connector', shown_address: 'rtsp://192.168.1.20:554' }), true);   // its machine sends it (§12)
  assert.equal(canWatch({ kind: 'url', shown_address: 'rtsp://cam.example.com' }), true);
});

test('a recordings day is the UTC day the picker names, and a recording reads as its window and size', () => {
  assert.deepEqual(dayRange('2026-11-17'), { from: '2026-11-17T00:00:00Z', to: '2026-11-18T00:00:00Z' });
  assert.deepEqual(dayRange(''), { from: '', to: '' });
  assert.deepEqual(dayRange('17/11/2026'), { from: '', to: '' });
  assert.equal(windowText({ started_at: '2026-11-17T10:05:00+00:00', ended_at: '2026-11-17T10:10:00+00:00' }), '10:05 to 10:10 UTC');
  assert.equal(sizeText(4000), '0.1 MB');
  assert.equal(sizeText(52428800), '50.0 MB');
  assert.equal(sizeText(3 * 1024 ** 3), '3.0 GB');
  assert.match(dayPriceText({ day_price_usd: '0.002000', per_gb_month_usd: '0.0312' }), /^\$0\.031 per GB a month, charged a day ahead \(about \$0\.0020 a day/);
  assert.match(dayPriceText({ day_price_usd: '0', per_gb_month_usd: '0.0312' }), /nothing kept yet/);
  assert.equal(typeof recordingsApi.list, 'function');
});

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
  assert.equal(countsSaid({ frame: 11, t: 11, counts: { walls: 2, windows: 1, doors: 0 } }), 'Frame 12 at 0:11: walls 2, windows 1, doors 0.');
  assert.equal(countsSaid({ frame: 4, t: 2, classes: { person: 3, car: 1 } }), 'Frame 5 at 0:02: person 3, car 1.');
  assert.equal(countsSaid({ frame: 0, t: 0, classes: {} }), 'Frame 1 at 0:00: nothing found.');
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

// ── any model's answers ──────────────────────────────────────────────────────────────────────────
test('an answer is read as the model\'s own classes, and FitMyWall\'s older counts the same way', () => {
  assert.deepEqual(classesOf({ classes: { person: 3, car: 1, bike: 0 } }), [['person', 3], ['car', 1], ['bike', 0]]);
  assert.deepEqual(classesOf({ counts: { walls: 2, windows: 1, doors: 0 } }), [['walls', 2], ['windows', 1], ['doors', 0]]);
  // `classes` wins over `counts` when an answer carries both.
  assert.deepEqual(classesOf({ classes: { person: 1 }, counts: { walls: 9 } }), [['person', 1]]);
  // Nothing that is not a count is shown: negative, text, empty or missing values, or a blank name.
  assert.deepEqual(classesOf({ classes: { a: -1, b: 'x', c: null, d: '', ' ': 4, e: 2.7 } }), [['e', 2]]);
  assert.deepEqual(classesOf(null), []);
  assert.deepEqual(classesOf({ error: 'x' }), []);
  assert.equal(totalOf({ classes: { person: 3, car: 1 } }), 4);
  assert.equal(totalOf({}), 0);
  assert.equal(countOf({ classes: { person: 3 } }, 'person'), 3);
  assert.equal(countOf({ classes: { person: 3 } }, 'car'), 0);
  assert.equal(classesText({ classes: { person: 3, car: 1 } }), 'person 3, car 1');
  assert.equal(classesText({ classes: {} }), 'nothing found');
});

test('a stream\'s classes keep the order they were first seen in, at most eight', () => {
  const stream = {
    recent: [{ frame: 0, classes: { car: 1 } }, { frame: 1, error: 'x' }, { frame: 2, classes: { person: 2, car: 0 } }],
    last: { frame: 3, classes: { dog: 1, person: 1 } },
  };
  assert.deepEqual(classNames(stream), ['car', 'person', 'dog']);
  const many = { last: { classes: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, i])) } };
  assert.equal(classNames(many).length, 8);
  assert.deepEqual(classNames(many, 2), ['c0', 'c1']);
  assert.deepEqual(classNames(null), []);
});

test('the newest frames\' bars count everything each found, of any model', () => {
  const bars = recentBars([{ frame: 0, classes: { person: 2, car: 2 } }, { frame: 1, classes: { person: 1, car: 1 } }, { frame: 2, classes: {} }], 40);
  assert.deepEqual(bars, [{ frame: 0, failed: false, h: 40 }, { frame: 1, failed: false, h: 20 }, { frame: 2, failed: false, h: 2 }]);
});

test('a continuous stream that ends says so, not that a video ended', () => {
  assert.equal(endedText({ state: 'done', continuous: true }), 'The stream ended. Its answers are kept.');
  assert.equal(endedText({ state: 'done' }), 'The video ended.');
});

// ── video sources ────────────────────────────────────────────────────────────────────────────────
test('a source\'s state is said in words, and each chip counts its sources', () => {
  assert.deepEqual(sourceState({ state: 'online' }), ['green', 'Live']);
  assert.deepEqual(sourceState({ state: 'offline' }), ['neutral', 'Offline']);
  assert.deepEqual(sourceState({ state: 'needs_attention' }), ['amber', 'Needs attention']);
  assert.deepEqual(sourceState({ state: 'needs attention' }), ['amber', 'Needs attention']);
  // The backend's states (video_sources.py): new, online, offline, attention. A new source was never checked: it is
  // "Not checked yet", never Offline; a state the page does not know is shown as offline, never as online.
  assert.deepEqual(sourceState({ state: 'new' }), ['neutral', 'Not checked yet']);
  assert.deepEqual(sourceState({ state: 'attention' }), ['amber', 'Needs attention']);
  assert.deepEqual(sourceState({ state: 'no_connector' }), ['neutral', 'No connector']);
  assert.deepEqual(sourceState({ state: 'something new' }), ['neutral', 'Offline']);
  assert.deepEqual(sourceState({}), ['neutral', 'Offline']);
  assert.equal(sourceStateKey({ state: 'ONLINE' }), 'online');
  assert.deepEqual(SOURCE_FILTERS.map(f => f.label), ['All', 'Online', 'Offline', 'No connector', 'Public']);
  const list = [{ id: 1, name: 'Door', state: 'online', shown_address: 'rtsp://door.example.com' }, { id: 2, name: 'Yard', state: 'offline' },
    { id: 3, name: 'Gate', state: 'attention', project: { ref: 'p', name: 'Parcels' } }, { id: 4, name: 'Dock', state: 'online', public: true, shared: true },
    { id: 5, name: 'Lobby', state: 'new' }, { id: 6, name: 'Shed', state: 'no_connector', public: 'yes' }];
  // Public is counted beside the state; only an explicit `true` makes a source public.
  assert.deepEqual(sourceCounts(list), { '': 6, online: 2, offline: 1, no_connector: 1, public: 1, needs_attention: 1, new: 1 });
  assert.deepEqual(sourceCounts(null), { '': 0, online: 0, offline: 0, no_connector: 0, public: 0, needs_attention: 0, new: 0 });
  assert.deepEqual(filterSources(list, { state: 'online' }).map(s => s.id), [1, 4]);
  assert.deepEqual(filterSources(list, { state: 'public' }).map(s => s.id), [4]);
  assert.deepEqual(filterSources(list, { state: 'no_connector' }).map(s => s.id), [6]);
  assert.deepEqual(filterSources(list, { q: 'parcels' }).map(s => s.id), [3]);
  assert.deepEqual(filterSources(list, { q: 'door.example' }).map(s => s.id), [1]);
  assert.equal(filterSources(list).length, 6);
});

test('a source shows its scheme and host only, a signed thumbnail and its newest frame time', () => {
  assert.equal(sourceShown({ shown_address: 'rtsps://cam.example.com:322' }), 'rtsps://cam.example.com:322');
  // Even an answer that carried more is cut to scheme and host.
  assert.equal(sourceShown({ address: 'rtsp://admin:s3cret@cam.example.com/live?x=1' }), 'rtsp://cam.example.com');
  assert.equal(sourceShown({}), '');
  assert.equal(sourceKindLabel({ kind: 'url' }), 'Camera URL');
  assert.equal(sourceKindLabel({ kind: 'url', shown_address: 'rtsps://cam.example.com' }), 'RTSP camera');
  assert.equal(sourceKindLabel({ kind: 'url', shown_address: 'https://video.example.com' }), 'HLS stream');
  assert.equal(sourceKindLabel({ kind: 'verkada' }), 'Verkada camera');
  // A public camera's line names it public and shared, and not its address; any other shows its scheme and host.
  assert.equal(sourceLine({ kind: 'url', shown_address: 'rtsp://street.example.com', public: true, shared: true }), 'RTSP camera · Public · Shared with you');
  assert.equal(sourceLine({ kind: 'url', shown_address: 'rtsp://street.example.com', public: true, shared: false }), 'RTSP camera · Public');
  assert.equal(sourceLine({ kind: 'url', shown_address: 'rtsp://door.example.com:554' }), 'RTSP camera · rtsp://door.example.com:554');
  assert.equal(sourceLine({ kind: 'url' }), 'Camera URL');
  assert.equal(runningText({ streams_running: 2 }), '2 streams running');
  assert.equal(runningText({ active_streams: 1 }), '1 stream running');
  assert.equal(runningText({}), '—');
  assert.equal(thumbnailOf({ thumbnail_url: 'https://media.example.com/t.jpg?sig=1' }), 'https://media.example.com/t.jpg?sig=1');
  assert.equal(thumbnailOf({ thumbnail: '/media/t.jpg' }), '/media/t.jpg');
  for (const bad of ['javascript:alert(1)', 'http://media.example.com/t.jpg', '//evil.example.com/t.jpg', 'data:image/png;base64,AAAA', '']) {
    assert.equal(thumbnailOf({ thumbnail_url: bad }), '', bad);
  }
  const now = Date.parse('2026-11-17T12:00:00Z');
  assert.equal(lastFrameText({ last_frame_at: '2026-11-17T11:55:00Z' }, now), 'Last frame 5 minutes ago');
  assert.equal(lastFrameText({}, now), 'No frame yet');
});

test('the limits and the Summary are said in words', () => {
  assert.equal(limitText(3, 10), '3 of 10 sources');
  assert.equal(limitText(1, 1), '1 of 1 source');
  assert.equal(limitText(1), '1 source');
  assert.equal(limitText(0), '0 sources');
  assert.equal(limitText(2, 2, 'stream', 'streams'), '2 of 2 streams');
  const items = summaryItems({ sources: 3, online: 2, streams_running: 1, need_attention: 1, frames_answered_month: 12345, spend_month_usd: 4.5 }, { sources: 10, streams: 2 });
  assert.deepEqual(items.map(i => [i.label, i.value, i.hint]), [
    ['Video sources', 3, 'of 10 you may save'], ['Online now', 2, 'answered their last check'], ['Active workflows', 1, 'streams running, of 2 at once'],
    ['Need attention', 1, 'check their address or password'], ['Frames processed', '12,345', 'answered this month'], ['Credits used', '$4.50', 'spent this month'],
  ]);
  const empty = summaryItems(null, null);
  assert.deepEqual(empty.map(i => i.value), [0, 0, 0, 0, '0', '$0.00']);
  assert.equal(empty[3].hint, 'none');
});

test('a camera address is rtsp, rtsps or an HLS playlist of a public server', () => {
  for (const good of ['rtsp://cam.example.com:554/stream1', 'rtsps://cam.example.com/live', 'https://video.example.com/live/index.m3u8']) {
    assert.equal(sourceAddressProblem(good), '', good);
  }
  assert.equal(sourceAddressProblem(''), 'Enter the camera address.');
  // A video file is a stream's, not a camera's.
  assert.equal(sourceAddressProblem('https://video.example.com/clip.mp4'), SOURCE_SCHEMES_HELP);
  assert.equal(sourceAddressProblem('http://cam.example.com/live.m3u8'), SOURCE_SCHEMES_HELP);
  assert.equal(sourceAddressProblem('rtmp://cam.example.com/live'), SOURCE_SCHEMES_HELP);
  assert.equal(sourceAddressProblem('rtsp://192.168.1.20/live'), NOT_PUBLIC);
  assert.equal(sourceAddressProblem('rtsp://localhost/live'), NOT_PUBLIC);
});

test('the add form needs a name, a camera address and the consent tick', () => {
  const good = { name: 'Front door', address: 'rtsp://cam.example.com/live', username: '', password: '', project: '', consent: true };
  assert.deepEqual(sourceFormProblems(good), {});
  assert.deepEqual(Object.keys(sourceFormProblems({ ...good, consent: false })), ['consent']);
  assert.equal(sourceFormProblems({ ...good, consent: 'yes' }).consent, 'Confirm you own this camera or have permission to connect to it.');
  assert.equal(sourceFormProblems({ ...good, name: '   ' }).name, 'Give the source a name.');
  assert.equal(sourceFormProblems({ ...good, name: 'x'.repeat(121) }).name, 'A name is at most 120 characters.');
  assert.equal(sourceFormProblems({ ...good, address: '' }).address, 'Enter the camera address.');
  assert.equal(sourceFormProblems({ ...good, address: 'rtsp://10.0.0.5/live' }).address, NOT_PUBLIC);
  assert.equal(sourceFormProblems({ ...good, password: 'p'.repeat(257) }).password, 'A password is at most 256 characters.');
  assert.deepEqual(Object.keys(sourceFormProblems(null)).sort(), ['address', 'consent', 'name']);
  assert.match(CONSENT_TEXT, /^I own this camera or have permission to connect to it, and the people it films are informed/);
});

test('editing keeps a blank address and password, and needs no new consent', () => {
  const editing = { name: 'Front door', address: '', username: '', password: '', project: '', consent: false };
  assert.deepEqual(sourceFormProblems(editing, { editing: true }), {});
  assert.equal(sourceFormProblems({ ...editing, address: 'ftp://cam.example.com/x' }, { editing: true }).address, SOURCE_SCHEMES_HELP);
  assert.equal(sourceFormProblems({ ...editing, name: '' }, { editing: true }).name, 'Give the source a name.');
});

test('the add body carries what was filled and the consent; the edit body only what changes', () => {
  assert.deepEqual(sourceBody({ name: ' Door ', address: ' rtsp://cam.example.com/live ', username: '', password: '', project: '', consent: true }),
    { name: 'Door', kind: 'url', address: 'rtsp://cam.example.com/live', consent: true });
  assert.deepEqual(sourceBody({ name: 'Door', address: 'rtsp://cam.example.com/live', username: 'admin', password: ' p w ', project: 'leads', consent: true }),
    { name: 'Door', kind: 'url', address: 'rtsp://cam.example.com/live', username: 'admin', password: ' p w ', project: 'leads', consent: true });

  const original = { id: 4, name: 'Door', project: { ref: 'leads', name: 'Leads' }, username: 'admin' };
  const form = sourceForm(original);
  assert.deepEqual(form, { name: 'Door', address: '', username: 'admin', password: '', project: 'leads', consent: false, machine: '' });
  assert.deepEqual(sourceBody(form, { editing: true, original }), {});
  assert.deepEqual(sourceBody({ ...form, name: 'Back door', password: 'new' }, { editing: true, original }), { name: 'Back door', password: 'new' });
  assert.deepEqual(sourceBody({ ...form, project: '' }, { editing: true, original }), { project: null });
  assert.deepEqual(sourceBody({ ...form, address: 'rtsps://cam2.example.com/live', username: '' }, { editing: true, original }),
    { address: 'rtsps://cam2.example.com/live', username: '' });
  // An answer that does not carry the user name: a blank one keeps the saved one.
  assert.deepEqual(sourceBody(sourceForm({ name: 'Door' }), { editing: true, original: { name: 'Door' } }), {});
  assert.deepEqual(sourceForm(), { name: '', address: '', username: '', password: '', project: '', consent: false, machine: '' });
});

test('the video sources calls use the contract\'s paths and bodies, with the workspace', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => ({ activeWorkspaceId: '7' })[key] ?? null } });
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    await videoSources.list();
    await videoSources.list({ state: 'online', q: ' door ' });
    await videoSources.add({ name: 'Door', kind: 'url', address: 'rtsp://cam.example.com/live', consent: true });
    await videoSources.get(4);
    await videoSources.update(4, { password: 'new' });
    await videoSources.check(4);
    await videoSources.remove(4);
    await streamingApi.start({ project: 'leads', model: 2, fps: 1, source: 4, continuous: true });
    await streamingApi.start({ project: 'leads', model: 2, fps: 2, source: 4 });
  } finally {
    globalThis.fetch = realFetch;
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage); else delete globalThis.localStorage;
  }
  const base = '/api/training-data/app/workspace/video-sources/';
  assert.deepEqual(calls.map(c => [c.init.method, c.url]), [
    ['GET', base], ['GET', `${base}?state=online&q=door`], ['POST', base], ['GET', `${base}4/`], ['PATCH', `${base}4/`],
    ['POST', `${base}4/check/`], ['DELETE', `${base}4/`],
    ['POST', '/api/training-data/app/workspace/streams/'], ['POST', '/api/training-data/app/workspace/streams/'],
  ]);
  for (const call of calls) assert.equal(call.init.headers['X-Workspace-ID'], '7');
  assert.deepEqual(JSON.parse(calls[2].init.body), { name: 'Door', kind: 'url', address: 'rtsp://cam.example.com/live', consent: true });
  assert.deepEqual(JSON.parse(calls[4].init.body), { password: 'new' });
  assert.deepEqual(JSON.parse(calls[7].init.body), { project: 'leads', model: 2, fps: 1, source: 4, continuous: true });
  assert.deepEqual(JSON.parse(calls[8].init.body), { project: 'leads', model: 2, fps: 2, source: 4, continuous: false });
});

// ── live view ────────────────────────────────────────────────────────────────────────────────────
test('only an rtsp:// or rtsps:// camera can be watched live', () => {
  assert.equal(canWatch({ shown_address: 'rtsp://door.example.com' }), true);
  assert.equal(canWatch({ shown_address: 'RTSPS://door.example.com:322' }), true);
  assert.equal(canWatch({ shown_address: 'https://video.example.com' }), false);
  assert.equal(canWatch({ shown_address: 'not an address' }), false);
  assert.equal(canWatch({}), false);
  assert.equal(canWatch(null), false);
});

test('a connector camera is not played until its machine is sending it, and its live job is followed', () => {
  const waiting = liveAnswer({ playlist: '/live/src9/index.m3u8', token: 'abc', ready: false, job: 37, said: 'Asked 235e to send the camera live.' });
  assert.deepEqual([waiting.ready, waiting.job, waiting.said], [false, 37, 'Asked 235e to send the camera live.']);
  assert.equal(liveAnswer({ playlist: '/live/src9/index.m3u8', token: 'abc', ready: true, job: 37 }).ready, true);
  assert.equal(liveAnswer({ playlist: '/live/src9/index.m3u8', token: 'abc', job: '37; drop' }).job, null);
});

test('the live answer gives the playlist, the token and when to renew it', () => {
  assert.deepEqual(liveAnswer({ playlist: '/live/src4/index.m3u8', token: 'abc', expires_in: 300, renew_after: 240 }),
    { playlist: '/live/src4/index.m3u8', token: 'abc', renewInMs: 240000, ready: true, job: null, said: '' });
  // No renew_after: four fifths of the token's life; never at or past its end, never sooner than 5 seconds.
  assert.equal(liveAnswer({ playlist: '/live/src4/index.m3u8', token: 'abc', expires_in: 100 }).renewInMs, 80000);
  assert.equal(liveAnswer({ playlist: '/live/src4/index.m3u8', token: 'abc', expires_in: 60, renew_after: 600 }).renewInMs, 55000);
  assert.equal(liveAnswer({ playlist: '/live/src4/index.m3u8', token: 'abc', expires_in: 300, renew_after: 1 }).renewInMs, 5000);
  assert.equal(liveAnswer({ playlist: '/live/src4/index.m3u8', token: 'abc' }).renewInMs, 240000);
  // The token is only ever sent to this site: a playlist on another server, or no token, is not used.
  for (const playlist of ['https://evil.example.com/x.m3u8', '//evil.example.com/x.m3u8', '/\\evil.example.com/x.m3u8',
    'live/src4/index.m3u8', 'javascript:alert(1)', '/live/a b.m3u8', '', null]) {
    assert.equal(liveAnswer({ playlist, token: 'abc', renew_after: 240 }), null, String(playlist));
  }
  assert.equal(liveAnswer({ playlist: '/live/src4/index.m3u8', token: '' }), null);
  assert.equal(liveAnswer({ playlist: '/live/src4/index.m3u8' }), null);
  assert.equal(liveAnswer(null), null);
});

test('why live view did not start is said in words, the server\'s own where it gave them', () => {
  assert.equal(liveErrorText({ status: 409, serverCode: 'not_live', message: 'Live view needs an rtsp:// or rtsps:// camera.' }), 'Live view needs an rtsp:// or rtsps:// camera.');
  assert.equal(liveErrorText({ status: 409, serverCode: 'not_live', message: 'The request was refused.' }), LIVE_NOT_LIVE);
  assert.equal(liveErrorText({ status: 503, serverCode: 'relay_unavailable', message: 'AADML did not answer just now. Try again in a moment.' }), LIVE_UNAVAILABLE);
  assert.equal(liveErrorText({ status: 503, serverCode: 'relay_unavailable', message: 'The media relay is restarting.' }), 'The media relay is restarting.');
  assert.equal(liveErrorText({ status: 404, message: 'Not found.' }), LIVE_GONE);
  assert.equal(liveErrorText({ status: 0, code: 'network', message: 'Could not reach AADML. Check your connection and try again.' }), 'Could not reach AADML. Check your connection and try again.');
  assert.equal(liveErrorText(null), LIVE_UNAVAILABLE);
});

test('the live token is asked for on the source\'s live path, with the workspace', async () => {
  let asked;
  const realFetch = globalThis.fetch;
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => ({ activeWorkspaceId: '7' })[key] ?? null } });
  globalThis.fetch = async (url, init) => { asked = { url, init }; return new Response('{"code":"not_live","error":"Live view needs an rtsp:// camera."}', { status: 409, headers: { 'content-type': 'application/json' } }); };
  try {
    await assert.rejects(videoSources.live(4), error => {
      assert.equal(error.status, 409);
      assert.equal(error.serverCode, 'not_live');
      assert.equal(liveErrorText(error), 'Live view needs an rtsp:// camera.');
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage); else delete globalThis.localStorage;
  }
  assert.equal(asked.url, '/api/training-data/app/workspace/video-sources/4/live/');
  assert.equal(asked.init.method, 'GET');
  assert.equal(asked.init.headers['X-Workspace-ID'], '7');
});

test('a camera that answered but whose video could not be played is not said to have not answered', () => {
  // aadml.com, 2026-11-17: the relay served the playlist of an RTSP feed with B-frames, and the page said "The camera
  // did not answer".
  assert.notEqual(LIVE_NOT_PLAYABLE, LIVE_NO_ANSWER);
  assert.match(LIVE_NOT_PLAYABLE, /answered/);
  assert.doesNotMatch(LIVE_NOT_PLAYABLE, /did not answer/);
});

// ── camera management (CLOUD_STREAMING_PLAN.md §3.6) ─────────────────────────────────────────────────────────────
test('a camera\'s state history reads as badges, reasons, what found it and whether the Admins were told', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');
  const rows = historyRows([
    { at: '2026-11-17T11:58:00Z', state: 'online', previous: 'offline', reason: '', cause: 'stream', notice: 'online' },
    { at: '2026-11-17T11:00:00Z', state: 'offline', previous: 'online', reason: 'No frame could be read from the camera.', cause: 'check', notice: 'offline' },
    { at: '2026-11-17T10:00:00Z', state: 'attention', previous: 'offline', reason: 'Not public.', cause: 'machine', notice: '' },
    { at: '2026-11-17T09:00:00Z', state: 'new', previous: 'offline', cause: 'change' },
    { state: 'online' },                                                                   // no time: not listed
  ], now);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(r => r.badge), [['green', 'Live'], ['neutral', 'Offline'], ['amber', 'Needs attention'], ['neutral', 'Not checked yet']]);
  assert.deepEqual(rows.map(r => r.cause), ['Found by a stream on it', 'Found by a check', 'Found by its machine', 'Its address or sign-in was changed']);
  assert.deepEqual(rows.map(r => r.told), ['Admins were told it is back.', 'Admins were told it went offline.', '', '']);
  assert.equal(rows[1].reason, 'No frame could be read from the camera.');
  assert.equal(rows[0].when, timeAgo('2026-11-17T11:58:00Z', now));
  assert.deepEqual(historyRows(undefined), []);
  assert.deepEqual(historyRows('nope'), []);
});

test('this month\'s spend on a camera is its frames, its recording storage and the total', () => {
  assert.equal(monthText('2026-11'), 'November 2026');
  assert.equal(monthText('11/2026'), '');
  const items = spendItems({ month: '2026-11', frames: 1200, frames_usd: '1.4400', recording_days: 1, recording_usd: '0.0300', total_usd: '1.4700' });
  assert.deepEqual(items.map(i => [i.key, i.value, i.hint]), [
    ['frames', '$1.44', '1,200 frames'], ['recording', '$0.03', '1 day charged'], ['total', '$1.47', ''],
  ]);
  assert.deepEqual(spendItems({ frames: 0, frames_usd: '0.0000', recording_days: 0, recording_usd: '0.0000', total_usd: '0.0000' }).map(i => i.value), ['$0.00', '$0.00', '$0.00']);
  assert.deepEqual(spendItems(null), []);
});

test('the Connectors card lists the machines that have cameras, with their state, agent and cameras', () => {
  const machines = [
    { id: 3, name: 'Shop PC', state: 'online', agent_version: '1.5.0' },
    { id: 4, name: 'Spare', state: 'online', agent_version: '1.5.0' },                     // no camera: not listed
    { id: 5, name: 'Back office', state: 'offline', agent_version: '1.4.0' },
  ];
  const sources = [
    { id: 1, kind: 'connector', machine: { id: 3, name: 'Shop PC', state: 'online' } },
    { id: 2, kind: 'connector', machine: { id: 3, name: 'Shop PC', state: 'online' } },
    { id: 6, kind: 'connector', machine: { id: 5, name: 'Back office', state: 'offline' } },
    { id: 7, kind: 'connector', machine: { id: 9, name: 'Old laptop', state: 'removed' } },   // not in the machines list
    { id: 8, kind: 'url', machine: null },
    { id: 10, kind: 'connector', public: true, machine: { id: 3 } },                          // a public camera: not ours
  ];
  const rows = connectorRows(machines, sources);
  assert.deepEqual(rows.map(r => [r.name, r.badge[1], r.agent, r.cameras]), [
    ['Back office', 'Offline', '1.4.0', 1], ['Old laptop', 'Removed', '', 1], ['Shop PC', 'Online', '1.5.0', 2],
  ]);
  assert.equal(connectorLine(rows[2]), '2 cameras · agent 1.5.0');
  assert.equal(connectorLine(rows[1]), '1 camera');
  assert.deepEqual(connectorRows([], []), []);
  assert.deepEqual(connectorRows(undefined, [{ kind: 'connector', machine: { id: 3, name: 'Shop PC', state: 'online' } }]).map(r => r.badge), [['green', 'Online']]);
});

test('removing a camera keeps its recordings unless the person chose to delete them now', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => ({ activeWorkspaceId: '7' })[key] ?? null } });
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    await videoSources.remove(4);
    await videoSources.remove(4, { recordings: 'keep' });
    await videoSources.remove(4, { recordings: 'delete' });
    await videoSources.remove(4, { recordings: 'anything else' });
  } finally {
    globalThis.fetch = realFetch;
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage); else delete globalThis.localStorage;
  }
  const base = '/api/training-data/app/workspace/video-sources/4/';
  assert.deepEqual(calls.map(c => [c.init.method, c.url]), [
    ['DELETE', base], ['DELETE', base], ['DELETE', `${base}?recordings=delete`], ['DELETE', base],
  ]);
});

// ── barcodes (backend barcodes.py) and scan to add (camera_pairing.py) ────────────────────────────
test('what runs on a stream is said: the model, the model and the barcode reader, or the reader alone', () => {
  const model = { number: 1, name: 'walls', version: '1.0.0' };
  assert.equal(streamWhat({ model, read_codes: false }), 'walls 1.0.0');
  assert.equal(streamWhat({ model, read_codes: true }), 'walls 1.0.0 and the barcode reader');
  assert.equal(streamWhat({ model: null, read_codes: true }), 'Barcode reader');
});

test('the codes read are listed newest first as the server gives them, as text, cut to their limit', () => {
  const stream = { codes: [
    { frame: 9, t: 9, type: 'QR Code', value: 'BOX-2' },
    { frame: 3, t: 3.5, type: 'EAN-13', value: '4006381333931' },
    { frame: 1, t: 1, type: 'QR Code', value: '' },
    null,
    { frame: 0, t: 0, type: 'QR Code', value: 'X'.repeat(CODE_VALUE_LIMIT + 50) },
  ] };
  const rows = codesRead(stream);
  assert.deepEqual(rows.slice(0, 2).map(r => [r.type, r.value, r.frame, r.t]), [['QR Code', 'BOX-2', 9, 9], ['EAN-13', '4006381333931', 3, 3.5]]);
  assert.equal(rows.length, 3);                                   // an empty value and a non-row are left out
  assert.equal(rows[2].value.length, CODE_VALUE_LIMIT);
  assert.deepEqual(codesRead({}), []);
  assert.equal(codesRead(stream, 1).length, 1);
});

test('a frame\'s barcodes are read out with its answer, or alone for the reader alone', () => {
  assert.equal(frameCodesText({ codes: [{ type: 'QR Code', value: 'A' }, { type: 'Code 128', value: 'B' }] }), 'QR Code A; Code 128 B');
  assert.equal(frameCodesText({ codes: [] }), 'no code');
  assert.equal(frameCodesText({ codes_error: 'This frame could not be read for barcodes.' }), 'Not read for barcodes: This frame could not be read for barcodes.');
  assert.equal(frameCodesText({ classes: { wall: 1 } }), '');
  assert.equal(countsSaid({ frame: 2, t: 2, codes: [{ type: 'QR Code', value: 'LOT-7' }] }), 'Frame 3 at 0:02: QR Code LOT-7.');
  assert.equal(countsSaid({ frame: 0, t: 0, classes: { wall: 2 }, codes: [] }), 'Frame 1 at 0:00: wall 2; barcodes: no code.');
  assert.equal(countsSaid({ frame: 0, t: 0, classes: { wall: 2 } }), 'Frame 1 at 0:00: wall 2.');
});

test('a start that reads barcodes says so, and one without a model sends none', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response('{"ok":true}', { status: 201, headers: { 'content-type': 'application/json' } }); };
  try {
    await streamingApi.start({ project: 'leads', model: null, fps: 1, address: 'rtsp://cam.example.com/live', readCodes: true });
    await streamingApi.start({ project: 'leads', model: 2, fps: 1, source: 4, continuous: true, readCodes: true });
    const file = new File([new Uint8Array([0, 0, 0, 24])], 'walk.mp4', { type: 'video/mp4' });
    await streamingApi.start({ project: 'leads', model: null, fps: 2, file, readCodes: true });
    await streamingApi.start({ project: 'leads', model: 1, fps: 1, address: 'rtsp://cam.example.com/live', readCodes: false });
  } finally { globalThis.fetch = realFetch; }
  assert.deepEqual(JSON.parse(calls[0].init.body), { project: 'leads', fps: 1, address: 'rtsp://cam.example.com/live', read_codes: true });
  assert.deepEqual(JSON.parse(calls[1].init.body), { project: 'leads', model: 2, fps: 1, source: 4, continuous: true, read_codes: true });
  const form = calls[2].init.body;
  assert.equal(form.get('model'), null);
  assert.equal(form.get('read_codes'), 'true');
  assert.deepEqual(JSON.parse(calls[3].init.body), { project: 'leads', model: 1, fps: 1, address: 'rtsp://cam.example.com/live' });
});

test('what a phone scanned fills the add form: an address with its user and password apart, else the name', () => {
  assert.deepEqual(formFromScan('rtsp://admin:p%40ss@192.168.1.20:554/stream1'),
    { address: 'rtsp://192.168.1.20:554/stream1', username: 'admin', password: 'p@ss' });
  assert.deepEqual(formFromScan('rtsps://cam.example.com/live'), { address: 'rtsps://cam.example.com/live' });
  assert.deepEqual(formFromScan('  SN: AX-99812 '), { name: 'SN: AX-99812' });
  assert.deepEqual(formFromScan('line\none'), { name: 'line one' });
  assert.deepEqual(formFromScan('javascript:alert(1)'), { name: 'javascript:alert(1)' });     // never an address
  assert.deepEqual(formFromScan(''), {});
  assert.ok(formFromScan('S'.repeat(500)).name.length <= 120);
});

test('the pairing calls use the contract\'s paths, with the workspace', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => ({ activeWorkspaceId: '7' })[key] ?? null } });
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response('{"state":"waiting"}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    await pairingApi.make();
    await pairingApi.get(12);
  } finally {
    globalThis.fetch = realFetch;
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage); else delete globalThis.localStorage;
  }
  assert.deepEqual(calls.map(c => [c.init.method, c.url]), [
    ['POST', '/api/training-data/app/workspace/camera-pairing/'], ['GET', '/api/training-data/app/workspace/camera-pairing/12/'],
  ]);
  for (const call of calls) assert.equal(call.init.headers['X-Workspace-ID'], '7');
});
