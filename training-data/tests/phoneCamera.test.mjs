// A phone's own camera sent to AADML from its browser (CLOUD_STREAMING_PLAN.md §16; src/api/phoneCamera.js): the WHIP
// call, H.264 first, the session address, and what the camera's page shows of its phone link.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraConstraints, codecOrder, preferCodecs, sessionUrlOf, whipUrlOk, publish, retryDelay, PublishError, REFUSED_TEXT,
  swapCamera, shapeOf, canHoldLandscape, holdLandscape, releaseLandscape, hasMicrophone, soundWhipUrlOk, SOUND_CONSTRAINTS,
} from '../src/api/phoneCamera.js';
import { phoneCamSecret, phoneCameraApi, recordingOf, elapsedText } from '../src/api/phone.js';
import { phoneLinkDetails, phoneLinkUntil, sourceBody, canWatch, sourceKindLabel, PHONE_STEPS } from '../src/api/streaming.js';

const SECRET = 'Ab_cd-0123456789abcdefghijklmnopqrstuvwxyzAB';
const SESSION = '0b6c1a2e-1111-4222-8333-944455556666';

test('the camera is asked for the back camera at 720p and 25 frames a second, and no sound', () => {
  assert.deepEqual(cameraConstraints(), { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 25 } }, audio: false });
  assert.equal(cameraConstraints('user').video.facingMode.ideal, 'user');
  assert.equal(cameraConstraints('anything').video.facingMode.ideal, 'environment');
});

test('H.264 goes first (packetization-mode 1 before 0), then VP9 and AV1, never VP8 ahead of them', () => {
  const vp8 = { mimeType: 'video/VP8' }; const rtx = { mimeType: 'video/rtx' };
  const vp9 = { mimeType: 'video/VP9', sdpFmtpLine: 'profile-id=0' }; const av1 = { mimeType: 'video/AV1' };
  const h0 = { mimeType: 'video/H264', sdpFmtpLine: 'packetization-mode=0;profile-level-id=42e01f' };
  const h1 = { mimeType: 'video/H264', sdpFmtpLine: 'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f' };
  assert.deepEqual(codecOrder([vp8, rtx, av1, vp9, h0, h1]), [h1, h0, vp9, av1, vp8, rtx]);
  assert.deepEqual(codecOrder([vp8, rtx, av1, vp9]), [vp9, av1, vp8, rtx]);      // a browser with no H.264 encoder
  assert.deepEqual(codecOrder([vp8, rtx]), [vp8, rtx]);
  assert.deepEqual(codecOrder(null), []);
  let chosen = null;
  const transceiver = { setCodecPreferences: c => { chosen = c; } };
  assert.equal(preferCodecs(transceiver, { getCapabilities: () => ({ codecs: [vp8, h1] }) }), 'H264');
  assert.deepEqual(chosen, [h1, vp8]);
  assert.equal(preferCodecs(transceiver, { getCapabilities: () => ({ codecs: [vp8, vp9] }) }), 'VP9');
  assert.deepEqual(chosen, [vp9, vp8]);
  chosen = null;
  assert.equal(preferCodecs(transceiver, { getCapabilities: () => ({ codecs: [vp8] }) }), '');    // what it offers
  assert.equal(chosen, null);
  assert.equal(preferCodecs({}, { getCapabilities: () => ({ codecs: [h1] }) }), '');              // no setCodecPreferences
  assert.equal(preferCodecs(transceiver, undefined), '');
});

test('the session address is always under /live-publish/ on this site, for the same camera only', () => {
  const whip = '/live-publish/src12/whip';
  assert.equal(sessionUrlOf(`/live-publish/src12/whip/${SESSION}`, whip), `/live-publish/src12/whip/${SESSION}`);
  assert.equal(sessionUrlOf(`/src12/whip/${SESSION}`, whip), `/live-publish/src12/whip/${SESSION}`);
  assert.equal(sessionUrlOf(`https://aadml.com/live-publish/src12/whip/${SESSION}?x=1`, whip), `/live-publish/src12/whip/${SESSION}`);
  assert.equal(sessionUrlOf(`/live-publish/src13/whip/${SESSION}`, whip), '');                  // another camera
  assert.equal(sessionUrlOf('/live-publish/src12/whep/' + SESSION, whip), '');
  assert.equal(sessionUrlOf('https://evil.example/x', whip), '');
  assert.equal(sessionUrlOf(null, whip), '');
  assert.equal(whipUrlOk(whip), true);
  for (const bad of ['https://evil.example/live-publish/src1/whip', '/live-publish/src0/whip', '/live/src1/index.m3u8', '/live-publish/src1/whep', '']) {
    assert.equal(whipUrlOk(bad), false, bad);
  }
});

function fakes({ status = 201, location = `/live-publish/src12/whip/${SESSION}`, answer = 'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 H264/90000\r\n', throws = false } = {}) {
  const calls = []; const pcs = [];
  class PC {
    constructor(config) { this.config = config; this.iceGatheringState = 'complete'; this.connectionState = 'new'; this.closed = false; this.listeners = {}; pcs.push(this); }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    removeEventListener() {}
    addTransceiver(track, init) { this.track = track; this.init = init; this.transceiver = { sender: { track }, setCodecPreferences: c => { this.codecs = c; } }; return this.transceiver; }
    async createOffer() { return { type: 'offer', sdp: 'OFFER' }; }
    async setLocalDescription(d) { this.localDescription = d; }
    async setRemoteDescription(d) { this.remoteDescription = d; }
    close() { this.closed = true; }
  }
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (throws) throw new TypeError('network');
    return { status, text: async () => answer, headers: { get: name => (name === 'Location' ? location : null) } };
  };
  const Sender = { getCapabilities: () => ({ codecs: [{ mimeType: 'video/VP8' }, { mimeType: 'video/H264', sdpFmtpLine: 'packetization-mode=1' }] }) };
  const track = { kind: 'video' };
  const stream = { getVideoTracks: () => [track] };
  return { calls, pcs, PC, fetchImpl, Sender, stream, track };
}

test('publishing POSTs the offer to the WHIP address with the link as Bearer, sets the answer, and Stop DELETEs the session', async () => {
  const f = fakes();
  const made = await publish({ whipUrl: '/live-publish/src12/whip', secret: SECRET, stream: f.stream, fetchImpl: f.fetchImpl, PeerConnection: f.PC, Sender: f.Sender });
  const [pc] = f.pcs;
  assert.equal(pc.init.direction, 'sendonly');
  assert.equal(pc.codecs[0].mimeType, 'video/H264');
  const [post] = f.calls;
  assert.equal(post.url, '/live-publish/src12/whip');
  assert.equal(post.init.method, 'POST');
  assert.equal(post.init.body, 'OFFER');
  assert.deepEqual(post.init.headers, { 'Content-Type': 'application/sdp', Authorization: `Bearer ${SECRET}` });
  assert.equal(post.init.credentials, 'omit');                // never the AADML session cookie
  assert.equal(post.init.redirect, 'error');
  assert.ok(!post.url.includes(SECRET));                      // the secret is never in an address
  assert.equal(pc.remoteDescription.type, 'answer');
  assert.equal(made.sessionUrl, `/live-publish/src12/whip/${SESSION}`);
  assert.equal(made.codec, 'H264');
  assert.equal(made.asked, 'H264');
  assert.equal(made.sender.track, f.track);
  await made.stop();
  assert.equal(pc.closed, true);
  assert.deepEqual([f.calls[1].url, f.calls[1].init.method, f.calls[1].init.keepalive], [`/live-publish/src12/whip/${SESSION}`, 'DELETE', true]);
  assert.equal(f.calls[1].init.headers, undefined);           // the session's own address is its authority
});

test('a refused link is said and not retried; the relay or the network being away is tried again', async () => {
  for (const status of [401, 403, 404]) {
    const f = fakes({ status });
    await assert.rejects(publish({ whipUrl: '/live-publish/src12/whip', secret: SECRET, stream: f.stream, fetchImpl: f.fetchImpl, PeerConnection: f.PC, Sender: f.Sender }),
      e => e instanceof PublishError && e.code === 'refused' && e.message === REFUSED_TEXT);
    assert.equal(f.pcs[0].closed, true);
  }
  const refusedByRelay = fakes({ status: 400 });          // MediaMTX 1.15.4's answer to an offer its hook refused
  await assert.rejects(publish({ whipUrl: '/live-publish/src12/whip', secret: SECRET, stream: refusedByRelay.stream, fetchImpl: refusedByRelay.fetchImpl, PeerConnection: refusedByRelay.PC, Sender: refusedByRelay.Sender }), { code: 'relay', status: 400 });
  const busy = fakes({ status: 500 });
  await assert.rejects(publish({ whipUrl: '/live-publish/src12/whip', secret: SECRET, stream: busy.stream, fetchImpl: busy.fetchImpl, PeerConnection: busy.PC, Sender: busy.Sender }), { code: 'relay' });
  const offline = fakes({ throws: true });
  await assert.rejects(publish({ whipUrl: '/live-publish/src12/whip', secret: SECRET, stream: offline.stream, fetchImpl: offline.fetchImpl, PeerConnection: offline.PC, Sender: offline.Sender }), { code: 'network' });
  const elsewhere = fakes();
  await assert.rejects(publish({ whipUrl: 'https://evil.example/whip', secret: SECRET, stream: elsewhere.stream, fetchImpl: elsewhere.fetchImpl, PeerConnection: elsewhere.PC }), { code: 'refused' });
  assert.equal(elsewhere.calls.length, 0);                    // nothing is sent anywhere else
  const noVideo = fakes();
  await assert.rejects(publish({ whipUrl: '/live-publish/src12/whip', secret: SECRET, stream: { getVideoTracks: () => [] }, fetchImpl: noVideo.fetchImpl, PeerConnection: noVideo.PC }), { code: 'camera' });
  assert.deepEqual([1, 2, 3, 4, 9].map(retryDelay), [2000, 4000, 8000, 15000, 15000]);
});

test('the phone link secret is read from the address only when it looks like one, and sent as Bearer only', async () => {
  assert.equal(phoneCamSecret(`#phonecam=${SECRET}`), SECRET);
  assert.equal(phoneCamSecret(`?phonecam=${SECRET}`), '');                  // never from the query: servers log it
  assert.equal(phoneCamSecret('#phonecam=short'), '');
  assert.equal(phoneCamSecret(`#phonecam=${SECRET}<x>`), '');
  assert.equal(phoneCamSecret(`?camera=${SECRET}`), '');
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, init }); return { ok: true, json: async () => ({ name: 'Dock', whip: '/live-publish/src3/whip' }) }; };
  assert.deepEqual(await phoneCameraApi.info(SECRET, { fetchImpl }), { name: 'Dock', whip: '/live-publish/src3/whip' });
  assert.equal(seen[0].url, '/api/training-data/v1/phone-camera/');
  assert.equal(seen[0].init.headers.Authorization, `Bearer ${SECRET}`);
  assert.equal(seen[0].init.credentials, 'omit');
});

test('the camera page shows a phone link only as the server made it, and when it ends', () => {
  const url = `https://aadml.com/dashboard/training-data/#phonecam=${SECRET}`;
  const shown = phoneLinkDetails({ url, expires_at: '2026-11-25T12:00:00+00:00', link_set_at: '2026-11-18T12:00:00+00:00', expired: false, available: true, lifetime_days: 7 });
  assert.equal(shown.url, url);
  assert.equal(shown.expired, false);
  assert.match(phoneLinkUntil(shown, 'en-GB'), /^The link works until .*25.*, or until you make a new one\.$/);
  for (const bad of ['javascript:alert(1)', `http://aadml.com/dashboard/training-data/#phonecam=${SECRET}`, `https://aadml.com/x#phonecam=${SECRET}`, 'https://aadml.com/dashboard/training-data/#phonecam=short', `https://aadml.com/dashboard/training-data/?phonecam=${SECRET}`]) {
    assert.equal(phoneLinkDetails({ url: bad }).url, '', bad);
  }
  assert.equal(phoneLinkDetails({ expires_at: 'nope' }).expiresAt, '');
  assert.match(phoneLinkUntil(phoneLinkDetails({ expired: true })), /has ended/);
  assert.equal(phoneLinkDetails(null), null);
  assert.equal(PHONE_STEPS.length, 3);
});

test('a phone camera is added by its name, project and consent only, and is watched through the relay', () => {
  assert.deepEqual(sourceBody({ name: ' Dock ', address: 'rtsp://x', username: 'u', password: 'p', project: 'leads', consent: true }, { pushing: true, kind: 'phone' }),
    { name: 'Dock', kind: 'phone', project: 'leads', consent: true });
  assert.deepEqual(sourceBody({ name: 'Drone', consent: true }, { pushing: true }), { name: 'Drone', kind: 'rtmp', consent: true });
  assert.equal(canWatch({ kind: 'phone', address: 'Phone browser (WebRTC)' }), true);
  assert.equal(sourceKindLabel({ kind: 'phone' }), 'Phone camera');
});

// A phone that opens one camera at a time: asking for a second while one is open fails as a phone does.
function oneCameraPhone({ failFacing = null } = {}) {
  const open = new Set(); const log = [];
  const getUserMedia = async constraints => {
    const facing = constraints.video.facingMode.ideal;
    log.push(['ask', facing, open.size]);
    if (open.size) throw Object.assign(new Error('Could not start video source'), { name: 'NotReadableError' });
    if (facing === failFacing) throw Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' });
    const track = { facing, stop: () => { open.delete(track); log.push(['stop', facing]); } };
    open.add(track);
    return { getVideoTracks: () => [track], getTracks: () => [track] };
  };
  return { getUserMedia, open, log };
}

test('switching camera lets the open one go before the other is asked for, and brings it back when the other fails', async () => {
  const phone = oneCameraPhone();
  const back = await phone.getUserMedia(cameraConstraints('environment'));
  const front = await swapCamera({ stream: back, facing: 'user', back: 'environment', getUserMedia: phone.getUserMedia });
  assert.equal(front.getVideoTracks()[0].facing, 'user');
  assert.deepEqual(phone.log.slice(1), [['stop', 'environment'], ['ask', 'user', 0]]);   // nothing open when it asks
  assert.equal(phone.open.size, 1);

  const noFront = oneCameraPhone({ failFacing: 'user' });
  const was = await noFront.getUserMedia(cameraConstraints('environment'));
  await assert.rejects(swapCamera({ stream: was, facing: 'user', back: 'environment', getUserMedia: noFront.getUserMedia }), e => {
    assert.equal(e.name, 'NotFoundError');
    assert.equal(e.reopened.getVideoTracks()[0].facing, 'environment');                  // the phone keeps sending
    return true;
  });
  const neither = async () => { throw Object.assign(new Error('busy'), { name: 'NotReadableError' }); };
  await assert.rejects(swapCamera({ stream: null, facing: 'user', back: 'environment', getUserMedia: neither }), e => e.reopened === null);
});

test('a picture is landscape or portrait by its size, and the screen is held sideways only where the browser can', async () => {
  assert.deepEqual([shapeOf(1280, 720), shapeOf(720, 1280), shapeOf(0, 0), shapeOf(undefined, 5)], ['landscape', 'portrait', '', '']);
  const calls = [];
  const doc = { fullscreenEnabled: true, fullscreenElement: null, documentElement: { requestFullscreen: async () => { calls.push('full'); doc.fullscreenElement = {}; } },
    exitFullscreen: async () => { calls.push('exit'); doc.fullscreenElement = null; } };
  const scr = { orientation: { lock: async kind => { calls.push(`lock ${kind}`); }, unlock: () => { calls.push('unlock'); } } };
  assert.equal(canHoldLandscape(doc, scr), true);
  assert.equal(await holdLandscape(doc, scr), true);
  await releaseLandscape(doc, scr);
  assert.deepEqual(calls, ['full', 'lock landscape', 'unlock', 'exit']);
  const iphone = { orientation: { lock: async () => { throw Object.assign(new Error('not supported'), { name: 'NotSupportedError' }); } } };
  assert.equal(canHoldLandscape({ fullscreenEnabled: false, documentElement: {} }, iphone), false);   // no page full screen
  calls.length = 0; doc.fullscreenElement = null;
  assert.equal(await holdLandscape(doc, iphone), false);                                   // refused: full screen left again
  assert.deepEqual(calls, ['full', 'exit']);
  assert.equal(await holdLandscape(undefined, undefined), false);
});

test('Record asks the server with the link as Bearer, and the page shows only what the server answered', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, init }); return { ok: true, json: async () => ({ said: 'Recording.', recording: { on: true, unpaid: false, may: true, said: '', seconds: 4, days: 30 } }) }; };
  const answer = await phoneCameraApi.record(SECRET, true, { fetchImpl });
  assert.equal(seen[0].url, '/api/training-data/v1/phone-camera/recording/');
  assert.equal(seen[0].init.method, 'POST');
  assert.equal(seen[0].init.headers.Authorization, `Bearer ${SECRET}`);
  assert.equal(seen[0].init.credentials, 'omit');
  assert.deepEqual(JSON.parse(seen[0].init.body), { on: true });
  await phoneCameraApi.record(SECRET, 'yes', { fetchImpl });
  assert.deepEqual(JSON.parse(seen[1].init.body), { on: false });                         // only true starts it
  assert.deepEqual(recordingOf(answer.recording, 1000), { on: true, unpaid: false, may: true, said: '', days: 30, seconds: 4, at: 1000 });
  assert.equal(recordingOf(undefined), null);                                              // an older server: no Record
  assert.equal(recordingOf({ may: true }), null);
  const refused = async () => ({ ok: false, status: 403, json: async () => ({ error: 'Recording is off for this camera: an Admin turns it on in Cloud Streaming.', code: 'recording_off', recording: { on: false, may: false, said: 'x', seconds: null } }) });
  await assert.rejects(phoneCameraApi.record(SECRET, true, { fetchImpl: refused }), e => {
    assert.equal(e.status, 403); assert.equal(e.code, 'recording_off');
    assert.match(e.message, /an Admin turns it on in Cloud Streaming/);
    assert.equal(recordingOf(e.recording).may, false);
    return true;
  });
  assert.deepEqual([elapsedText(0), elapsedText(65.9), elapsedText(3729), elapsedText(-3)], ['0:00', '1:05', '1:02:09', '0:00']);
});

test('a tab remembers its camera and that it was sending, so a reload resumes, never after Stop and never hours later', async () => {
  const { cameraMemory, rememberCamera, CAMERA_STATE_KEY, RESUME_MS } = await import('../src/api/phone.js');
  const box = new Map();
  const storage = { getItem: k => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, String(v)) };
  assert.deepEqual(cameraMemory(storage, 1000), { facing: 'environment', resume: false });       // nothing kept
  rememberCamera({ facing: 'user' }, storage, 1000);
  assert.deepEqual(cameraMemory(storage, 2000), { facing: 'user', resume: false });              // chosen, not sending
  rememberCamera({ sending: true }, storage, 3000);
  assert.deepEqual(cameraMemory(storage, 4000), { facing: 'user', resume: true });               // the camera is kept
  assert.equal(cameraMemory(storage, 3000 + RESUME_MS).resume, false);                           // too long ago
  rememberCamera({ sending: false }, storage, 5000);                                             // Stop
  assert.equal(cameraMemory(storage, 6000).resume, false);
  box.set(CAMERA_STATE_KEY, '{not json');
  assert.deepEqual(cameraMemory(storage, 6000), { facing: 'environment', resume: false });
  box.set(CAMERA_STATE_KEY, JSON.stringify({ facing: 'x', sending: 'yes', at: 6000 }));
  assert.deepEqual(cameraMemory(storage, 6001), { facing: 'environment', resume: false });       // only true resumes
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(cameraMemory(broken, 1), { facing: 'environment', resume: false });
  rememberCamera({ sending: true }, broken, 1);                                                  // no storage: no throw
});

test('the page knows whether the phone has a microphone without asking, and asks for sound alone', async () => {
  assert.equal(await hasMicrophone({ enumerateDevices: async () => [{ kind: 'videoinput' }, { kind: 'audioinput' }] }), true);
  assert.equal(await hasMicrophone({ enumerateDevices: async () => [{ kind: 'videoinput' }] }), false);
  assert.equal(await hasMicrophone({ enumerateDevices: async () => { throw new Error('not allowed'); } }), false);
  assert.equal(await hasMicrophone({}), false);
  assert.equal(await hasMicrophone(undefined), false);
  assert.equal(SOUND_CONSTRAINTS.video, false);
  assert.equal(SOUND_CONSTRAINTS.audio.echoCancellation, true);
});

test("the phone's sound goes only to its camera's own sound path, never to the video's, and alone", async () => {
  assert.equal(soundWhipUrlOk('/live-publish/src12a/whip'), true);
  for (const bad of ['/live-publish/src12/whip', '/live-publish/src12b/whip', '/live-publish/src0a/whip',
    'https://evil.example/live-publish/src12a/whip', '']) assert.equal(soundWhipUrlOk(bad), false, bad);
  assert.equal(whipUrlOk('/live-publish/src12a/whip'), false);          // the video never goes to the sound path
  assert.equal(sessionUrlOf(`/src12a/whip/${SESSION}`, '/live-publish/src12a/whip'), `/live-publish/src12a/whip/${SESSION}`);
  assert.equal(sessionUrlOf(`/src12/whip/${SESSION}`, '/live-publish/src12a/whip'), '');      // the video's session
  const f = fakes({ location: `/live-publish/src12a/whip/${SESSION}`, answer: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n' });
  const audio = { kind: 'audio' };
  const stream = { getAudioTracks: () => [audio], getVideoTracks: () => [f.track] };
  await assert.rejects(publish({ whipUrl: '/live-publish/src12/whip', secret: SECRET, stream, sound: true, fetchImpl: f.fetchImpl, PeerConnection: f.PC, Sender: f.Sender }),
    e => e instanceof PublishError && e.code === 'refused');
  const made = await publish({ whipUrl: '/live-publish/src12a/whip', secret: SECRET, stream, sound: true, fetchImpl: f.fetchImpl, PeerConnection: f.PC, Sender: f.Sender });
  const [pc] = f.pcs;
  assert.equal(pc.track, audio);                                          // the microphone alone, no video
  assert.equal(pc.codecs, undefined);                                    // no video codec chosen for sound
  assert.equal((made.codec || '').toLowerCase(), 'opus');
  assert.equal(made.sessionUrl, `/live-publish/src12a/whip/${SESSION}`);
  await assert.rejects(publish({ whipUrl: '/live-publish/src12a/whip', secret: SECRET, stream: { getAudioTracks: () => [] }, sound: true,
    fetchImpl: f.fetchImpl, PeerConnection: f.PC, Sender: f.Sender }), e => e.code === 'camera');
});

test('the phone says whether it has a microphone, with its link as Bearer', async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => { seen.push({ url, init }); return new Response(JSON.stringify({ has_sound: true, sound_whip: '/live-publish/src12a/whip' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  const answer = await phoneCameraApi.sound(SECRET, true);
  assert.equal(answer.sound_whip, '/live-publish/src12a/whip');
  assert.ok(seen[0].url.endsWith('/phone-camera/sound/'));
  assert.equal(seen[0].init.method, 'POST');
  assert.equal(JSON.parse(seen[0].init.body).microphone, true);
});

