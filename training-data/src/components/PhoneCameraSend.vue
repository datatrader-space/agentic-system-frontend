<script setup>
// The page a phone opens from a phone camera's link (CLOUD_STREAMING_PLAN.md §16; backend phone_camera.py): it sends the
// phone's own camera to AADML from the browser, no app and no sign-in. The link's secret is its only authority (the
// server checks it on every call, and the media relay again when the phone sends); it leaves the address at once
// (main.js). The person picks the back or front camera (before Start too; the choice is kept when they Start again),
// Start opens it, sends it over WebRTC (api/phoneCamera.js: WHIP), keeps the screen on where the browser can (Screen
// Wake Lock), and tries again by itself when the connection drops. Switching camera lets the open one go before the
// other is asked for (a phone opens one at a time) and puts the new track on the same sender: the session goes on.
// Stop ends the session at once. The picture is shown in its own shape, landscape or portrait, as AADML gets it; a
// screen that does not turn is said, and held in landscape where the browser can. Record asks the server to start or
// stop the camera's cloud recording: the server decides (an Admin must have let this phone, and every check of
// turning recording on holds), and this page shows what it answered: Recording with its time, or the reason why not.
// A reload of a tab that was sending starts sending again by itself, with the camera it had (api/phone.js
// cameraMemory; never after Stop); where the browser wants a tap first, the page says to tap Start.
// SOUND: the page finds out by itself whether the phone has a microphone (hasMicrophone: no prompt for that). With one,
// and "Send sound" on (the default; the person can turn it off), Start also asks the browser for the microphone and
// sends its sound in a second session to the camera's own sound path (soundWhipUrlOk): AADML never records it and
// nobody watching the camera hears it; only a stream that listens for alarms or breaking glass uses it. The video goes
// on whatever happens to the sound. AADML is told each time whether this phone gives sound (phone-camera/sound/).
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Camera, CircleAlert, Disc, Mic, MicOff, RefreshCw, RotateCw, Smartphone, Square, Video } from 'lucide-vue-next';
import { cameraMemory, elapsedText, phoneCameraApi, recordingOf, rememberCamera } from '../api/phone.js';
import {
  askKey, cameraConstraints, canHoldLandscape, hasMicrophone, holdLandscape, publish, releaseLandscape, retryDelay, shapeOf,
  swapCamera, whipUrlOk, REFUSED_TEXT, SOUND_CONSTRAINTS,
} from '../api/phoneCamera.js';

const props = defineProps({ secret: { type: String, required: true } });
const info = ref(null); const error = ref('');
// idle | starting | live | reconnecting | stopped | ended
const memory = cameraMemory();
const state = ref('idle'); const problem = ref(''); const facing = ref(memory.facing);
const preview = ref(null); const codec = ref(''); const busy = ref(false);
const size = ref({ w: 0, h: 0 }); const held = ref(false);
let stream = null; let session = null; let wakeLock = null; let retryTimer = null; let watchTimer = null;
// The microphone: whether the phone has one (null: not known yet), whether to send it, and what happened to it.
const microphone = ref(null); const sendSound = ref(true); const soundState = ref('off');   // off | sending | refused | failed
let soundStream = null; let soundSession = null;
let failures = 0; let run = 0; let gone = false;
// The shape the session was made with. When the picture turns (the phone turned, so the browser sends the other size),
// the session is made again: the relay's live view keeps the first size's init segment, and Google Chrome showed a
// 720x1280 picture stretched to 2276x1280 through it (local test with MediaMTX 1.15.4 and hls.js, 2026-11-18). A new
// session gives the relay a new stream, and the camera page's player starts again by itself (LiveView.vue).
let sentShape = ''; let turnTimer = null;
// The quality AADML asks this phone to send (backend camera_quality.ask; chosen in the camera's recording settings)
// and the one the open camera was opened with: when an Admin changes it while the phone sends, the camera is opened
// again with it and sent again (a new session, as when the picture turns).
const asked = computed(() => info.value?.video || null);
let openedWith = '';

const supported = typeof globalThis.RTCPeerConnection === 'function' && !!globalThis.navigator?.mediaDevices?.getUserMedia;
const until = computed(() => (info.value?.expires_at
  ? new Date(info.value.expires_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''));
const sending = computed(() => ['starting', 'live', 'reconnecting'].includes(state.value));
const STATES = {
  idle: ['quiet', 'Not sending'], starting: ['wait', 'Connecting…'], live: ['live', 'Live: sending to AADML'],
  reconnecting: ['wait', 'Reconnecting…'], stopped: ['quiet', 'Stopped'], ended: ['bad', 'This link no longer works'],
};
const pill = computed(() => STATES[state.value] || STATES.idle);
const CAMERAS = [['environment', 'Back camera'], ['user', 'Front camera']];

// The picture's shape, from the preview (what is sent): the viewfinder takes it, so nothing is cropped.
const shape = computed(() => shapeOf(size.value.w, size.value.h));
const frameStyle = computed(() => (shape.value && sending.value ? { aspectRatio: `${size.value.w} / ${size.value.h}` } : {}));
const mayHold = canHoldLandscape();
function measure() {
  const el = preview.value; size.value = { w: el?.videoWidth || 0, h: el?.videoHeight || 0 };
  if (session && !sentShape) sentShape = shape.value;              // the browser did not say the track's size
  if (session && sentShape && shape.value && shape.value !== sentShape) {
    clearTimeout(turnTimer);
    const mine = run;
    turnTimer = setTimeout(() => republish(mine), 800);        // a turn can say its size more than once
  }
}
function trackShape() {
  const settings = stream?.getVideoTracks()[0]?.getSettings?.() || {};
  return shapeOf(settings.width, settings.height) || shape.value;
}
async function republish(mine) {
  if (mine !== run || gone || !session || !shape.value || shape.value === sentShape) return;
  clearTimeout(watchTimer); watchTimer = null;
  const was = session; session = null;
  state.value = 'starting';
  try { await was.stop(); } catch { /* the relay ends it by itself */ }   // one publisher a camera: the old one goes first
  connect(mine);
}

// ── recording (the server's answer; null: a server older than the Record button, which is then not shown) ──────────
const rec = ref(null); const recBusy = ref(false); const recProblem = ref(''); const recSaid = ref(''); const tick = ref(Date.now());
let tickTimer = null; let pollTimer = null;
const recording = computed(() => !!rec.value?.on && !rec.value.unpaid);
const recTime = computed(() => (rec.value ? elapsedText(rec.value.seconds + Math.max(0, tick.value - rec.value.at) / 1000) : ''));
function takeRecording(answer) {
  const next = recordingOf(answer);
  if (next) rec.value = next;
  clearInterval(tickTimer); tickTimer = null;
  if (rec.value?.on && !rec.value.unpaid) { tick.value = Date.now(); tickTimer = setInterval(() => { tick.value = Date.now(); }, 1000); }
}
async function record(on) {
  if (recBusy.value || !rec.value) return;
  recBusy.value = true; recProblem.value = ''; recSaid.value = '';
  try {
    const answer = await phoneCameraApi.record(props.secret, on);
    takeRecording(answer?.recording);
    recSaid.value = typeof answer?.said === 'string' ? answer.said.slice(0, 300) : '';
  } catch (e) {
    if (e?.recording) takeRecording(e.recording);
    if (e?.code === 'invalid_link' || e?.code === 'link_ended') { end(e.message || REFUSED_TEXT); return; }
    recProblem.value = e?.message || 'Recording could not be changed. Try again.';
  } finally { recBusy.value = false; }
}
// The recording can be changed elsewhere (an Admin in Cloud Streaming, an unpaid day, the workspace's limit): asked
// again every 30 seconds while this page is open.
async function refresh() {
  if (gone || state.value === 'ended') return;
  if (sending.value) rememberCamera({ facing: facing.value, sending: true });   // still sending: a reload resumes
  try {
    const answer = await phoneCameraApi.info(props.secret);
    takeRecording(answer?.recording);
    if (answer?.video && info.value) info.value = { ...info.value, video: answer.video };
    if (sending.value && !busy.value && openedWith && askKey(asked.value) !== openedWith) { release(); start(); }
  } catch (e) { if (e?.status === 401 || e?.status === 403) end(e.message || REFUSED_TEXT); }
}

onMounted(async () => {
  try {
    const answer = await phoneCameraApi.info(props.secret);
    if (!whipUrlOk(answer?.whip)) throw new Error('This phone link does not lead to an AADML camera.');
    info.value = answer;
    takeRecording(answer.recording);
    microphone.value = await hasMicrophone();
    pollTimer = setInterval(refresh, 30000);
    if (memory.resume && supported) start({ resumed: true });          // this tab was sending when it was reloaded
  } catch (e) { error.value = e.message; }
  document.addEventListener('visibilitychange', onVisible);
  document.addEventListener('fullscreenchange', onFullscreen);
  window.addEventListener('pagehide', onLeave);
});

function cameraProblem(e) {
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return 'The camera was not allowed. Allow the camera for this site in the browser\'s settings, then tap Start again.';
  if (e?.name === 'NotReadableError') return 'The camera is in use by another app. Close it, then tap Start again.';
  if (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError') return 'This phone has no such camera. Choose the other one.';
  return 'The phone\'s camera could not be opened. Tap Start to try again.';
}
function show(next) {
  stream = next;
  if (preview.value) { preview.value.srcObject = next; preview.value.play?.()?.catch?.(() => { /* muted preview */ }); }
  next?.getVideoTracks()[0]?.addEventListener('ended', () => { if (sending.value && !gone) onVisible(); });
}
async function openCamera() {
  const old = stream;
  if (old) { old.getTracks().forEach(t => t.stop()); stream = null; }       // a phone opens one camera at a time
  show(await navigator.mediaDevices.getUserMedia(cameraConstraints(facing.value, asked.value)));
  openedWith = askKey(asked.value);
  reportCamera();
  return stream;
}
// What the open camera sends and the most it can, for the camera's page in AADML (never holds anything up).
function reportCamera() {
  const track = stream?.getVideoTracks()[0];
  if (!track) return;
  try {
    Promise.resolve(phoneCameraApi.video(props.secret, track)).then(answer => {
      if (answer?.video && info.value) info.value = { ...info.value, video: answer.video };
    }).catch(() => { /* an older server, or offline: the picture is sent all the same */ });
  } catch { /* the same */ }
}
async function keepScreenOn() {
  try { if (!wakeLock && navigator.wakeLock?.request) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release', () => { wakeLock = null; }); } }
  catch { wakeLock = null; /* not allowed here: the note asks to keep the screen on */ }
}
function letScreenSleep() { try { wakeLock?.release(); } catch { /* gone */ } wakeLock = null; }

function closeSession() {
  clearTimeout(watchTimer); watchTimer = null;
  const was = session; session = null;
  if (was) was.stop();
}
function closeSound() {
  const was = soundSession; soundSession = null;
  if (was) was.stop();
  if (soundStream) { soundStream.getTracks().forEach(t => t.stop()); soundStream = null; }
  if (soundState.value === 'sending') soundState.value = 'off';
}
// The phone's sound, beside its video: asked for only with a microphone and "Send sound" on; AADML is told whether this
// phone gives sound, and says where to send it. A refusal or a failure never touches the video.
async function startSound(mine) {
  if (mine !== run || soundSession || !info.value) return;
  let given = false;
  if (microphone.value && sendSound.value) {
    try { soundStream = await navigator.mediaDevices.getUserMedia(SOUND_CONSTRAINTS); given = true; }
    catch { soundState.value = 'refused'; }
  }
  if (mine !== run) { closeSound(); return; }
  let answer = null;
  try { answer = await phoneCameraApi.sound(props.secret, given); } catch { answer = null; }
  if (!given || !answer?.sound_whip || mine !== run) { if (given) { closeSound(); soundState.value = 'failed'; } return; }
  try {
    soundSession = await publish({ whipUrl: answer.sound_whip, secret: props.secret, stream: soundStream, sound: true,
      onState: s => { if (mine === run && s === 'failed') { closeSound(); soundState.value = 'failed'; } } });
    if (mine !== run) { closeSound(); return; }
    soundState.value = 'sending';
  } catch { closeSound(); soundState.value = 'failed'; }
}
async function toggleSound() {
  sendSound.value = !sendSound.value;
  if (!sendSound.value) {
    closeSound();
    if (info.value) phoneCameraApi.sound(props.secret, false).catch(() => {});
  } else if (sending.value) startSound(run);
}
const soundText = computed(() => {
  if (microphone.value === false) return 'This phone has no microphone, so only its video is sent.';
  if (!sendSound.value) return 'Sound is off: only the video is sent.';
  return { sending: 'Sending sound too.', refused: 'The browser was not allowed to use the microphone: only the video is sent.',
    failed: 'The sound could not be sent: only the video is sent.' }[soundState.value] || 'Its sound is sent too when you Start.';
});
function retry(mine) {
  if (mine !== run || gone) return;
  closeSession();
  failures += 1;
  state.value = 'reconnecting';
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => connect(mine), retryDelay(failures));
}
async function linkEnded(mine) {
  try { await phoneCameraApi.info(props.secret); return false; }
  catch (e) {
    if (mine !== run) return true;
    if (e?.status === 401 || e?.status === 403) { end(e.message || REFUSED_TEXT); return true; }
    return false;                                       // AADML not reached: the link may still work, try again
  }
}
async function connect(mine) {
  if (mine !== run || gone || !stream || !info.value) return;
  try {
    const made = await publish({
      whipUrl: info.value.whip, secret: props.secret, stream, maxKbps: asked.value?.max_kbps || 0,
      onState: s => {
        if (mine !== run) return;
        if (s === 'connected') { state.value = 'live'; failures = 0; problem.value = ''; clearTimeout(watchTimer); }
        else if (s === 'failed') retry(mine);
        else if (s === 'disconnected') {                // it often comes back by itself: wait a little first
          clearTimeout(watchTimer);
          watchTimer = setTimeout(() => { if (mine === run && made.pc.connectionState !== 'connected') retry(mine); }, 5000);
        }
      },
    });
    if (mine !== run) { made.stop(); return; }
    session = made; codec.value = made.codec; sentShape = trackShape();
    startSound(mine);                                    // the sound, beside it (never holds the video up)
    // The camera was switched while the offer was on its way: the open camera goes on the sender now.
    const open = stream?.getVideoTracks()[0];
    if (open && made.sender && made.sender.track !== open) made.sender.replaceTrack(open).catch(() => { /* the next reconnect sends it */ });
    // The relay answered, but the video must also reach it (its ICE port): not connected in 15 s is a failure.
    watchTimer = setTimeout(() => { if (mine === run && made.pc.connectionState !== 'connected') retry(mine); }, 15000);
  } catch (e) {
    if (mine !== run) return;
    if (e?.code === 'refused') { end(e.message || REFUSED_TEXT); return; }
    // The relay answers a refused link with 400 like a bad offer (MediaMTX 1.15.4): AADML says whether the link still
    // works before it is tried again, so a replaced or ended link is said, not retried for ever.
    if (await linkEnded(mine)) return;
    problem.value = e?.message || '';
    retry(mine);
  }
}

async function start({ resumed = false } = {}) {
  if (busy.value || !info.value || !supported) return;
  busy.value = true; problem.value = ''; failures = 0;
  const mine = ++run;
  state.value = 'starting';
  try { await openCamera(); }
  catch (e) {
    state.value = 'idle'; busy.value = false;
    // A reload that could not open the camera by itself (not allowed without a tap, or refused): the person taps Start.
    problem.value = resumed ? 'Tap Start to send again.' : cameraProblem(e);
    if (resumed) rememberCamera({ sending: false });
    return;
  }
  busy.value = false;
  rememberCamera({ facing: facing.value, sending: true });
  keepScreenOn();
  connect(mine);
}
function release() {
  run += 1;
  clearTimeout(turnTimer); turnTimer = null; sentShape = '';
  clearTimeout(retryTimer); retryTimer = null;
  closeSession();
  closeSound();
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (preview.value) preview.value.srcObject = null;
  size.value = { w: 0, h: 0 };
  letScreenSleep();
  if (held.value) { held.value = false; releaseLandscape(); }
}
function stop() { release(); state.value = 'stopped'; problem.value = ''; rememberCamera({ sending: false }); }
function end(message) {
  release(); state.value = 'ended'; problem.value = message; rememberCamera({ sending: false });
  clearInterval(pollTimer); pollTimer = null; clearInterval(tickTimer); tickTimer = null;
}

// Before Start: the choice only (Start opens it). While sending: the open camera is let go, the other one opened, and
// its track put on the sender already sending; when it cannot be opened, the one that was open comes back.
async function chooseCamera(next) {
  if (busy.value || next === facing.value) return;
  if (!sending.value) { facing.value = next; problem.value = ''; rememberCamera({ facing: next }); return; }
  busy.value = true; problem.value = '';
  const was = facing.value;
  try {
    show(await swapCamera({ stream, facing: next, back: was, getUserMedia: c => navigator.mediaDevices.getUserMedia(c), ask: asked.value || undefined }));
    reportCamera();
    facing.value = next; rememberCamera({ facing: next });
  } catch (e) {
    problem.value = e?.name === 'NotReadableError'
      ? 'The other camera could not be opened: another app may be using it. Close it, then try again.' : cameraProblem(e);
    if (e?.reopened) show(e.reopened);
    else { stream = null; problem.value += ' Tap Stop, then Start.'; }
  }
  try {
    const track = stream?.getVideoTracks()[0];
    if (session?.sender && track) await session.sender.replaceTrack(track);
  } catch { /* the next reconnect sends the open camera */ }
  finally { busy.value = false; }
}

async function landscape() {
  if (held.value) { held.value = false; await releaseLandscape(); return; }
  held.value = await holdLandscape();
  if (!held.value) problem.value = 'This browser cannot hold the screen sideways. Let the phone\'s screen turn (its rotation lock off), then turn the phone.';
}
// Held sideways, the page is full screen; leaving it by the phone's own Back or gesture also lets the screen turn
// (the browser drops the lock with full screen), so the page says so too (live, 2026-11-18: the owner held it sideways
// and found no way back: the button to let it turn was below the picture, out of a landscape screen).
function onFullscreen() {
  if (held.value && !document.fullscreenElement) { held.value = false; releaseLandscape(); }
}

// Back on the page: the screen lock is asked for again (a browser drops it when the page is hidden), and a camera the
// phone stopped while the page was hidden is opened again.
async function onVisible() {
  if (document.visibilityState !== 'visible' || !sending.value || gone) return;
  keepScreenOn();
  refresh();
  if (!stream || stream.getVideoTracks()[0]?.readyState === 'ended') {
    try {
      const track = (await openCamera()).getVideoTracks()[0];
      if (session?.sender && track) await session.sender.replaceTrack(track);
    } catch (e) { problem.value = cameraProblem(e); }
  }
}
function onLeave() { if (session) closeSession(); }

onUnmounted(() => {
  gone = true;
  clearInterval(pollTimer); clearInterval(tickTimer);
  document.removeEventListener('visibilitychange', onVisible);
  document.removeEventListener('fullscreenchange', onFullscreen);
  window.removeEventListener('pagehide', onLeave);
  release();
});
</script>

<template>
  <main class="phone">
    <header><span class="mark"><Video :size="18" aria-hidden="true"/></span><div><small>AADML Cloud Streaming</small><h1>{{ info?.name || 'Phone camera' }}</h1></div></header>
    <p v-if="!info && !error" class="quiet">Opening the camera's link…</p>
    <section v-if="error && !info" class="ended" role="alert"><CircleAlert :size="22" aria-hidden="true"/><p>{{ error }}</p></section>
    <template v-if="info">
      <div class="pills">
        <p class="status" :class="pill[0]" role="status" aria-live="polite"><span class="dot" aria-hidden="true"></span>{{ pill[1] }}<small v-if="state === 'live' && codec"> · {{ codec }}</small></p>
        <p v-if="recording && sending" class="status rec"><span class="dot" aria-hidden="true"></span>Recording <span class="time">{{ recTime }}</span></p>
      </div>
      <div class="frame" :class="shape || 'unknown'" :style="frameStyle">
        <video v-show="sending" ref="preview" class="viewfinder" muted playsinline autoplay aria-label="What this phone sends" @loadedmetadata="measure" @resize="measure"></video>
        <div v-if="!sending" class="still"><Camera :size="34" aria-hidden="true"/></div>
        <!-- Held sideways: the way back stays in the screen's corner, over the picture, however the page is scrolled. -->
        <button v-if="held" class="unhold" type="button" @click="landscape"><Smartphone :size="16" aria-hidden="true"/> Portrait</button>
      </div>
      <p v-if="sending && shape" class="quiet shape">
        Sending a {{ shape }} picture<template v-if="size.w"> ({{ size.w }} × {{ size.h }})</template>.
        <template v-if="shape === 'portrait'"> For a landscape picture, turn the phone sideways. If the picture does not turn with it, the phone's screen is locked upright: turn on Auto-rotate (Android, in the quick settings) or turn off Portrait Orientation Lock (iPhone, in Control Center).</template>
      </p>
      <p v-if="!supported" class="note" role="alert">This browser cannot send the camera. Open the link in a recent Chrome (Android) or Safari (iPhone).</p>
      <p v-if="problem" class="problem" role="alert">{{ problem }}</p>
      <template v-if="state !== 'ended'">
        <div class="cams" role="group" aria-label="Which camera">
          <button v-for="[value, label] in CAMERAS" :key="value" type="button" class="cam" :class="{ on: facing === value }" :aria-pressed="facing === value" :disabled="busy" @click="chooseCamera(value)">{{ label }}</button>
        </div>
        <button v-if="!sending" class="go" type="button" :disabled="busy || !supported" @click="start()"><Camera :size="20" aria-hidden="true"/> {{ state === 'stopped' ? 'Start again' : 'Start' }}</button>
        <!-- Record beside Stop sending while it sends; under Start while it does not (recording can be on either way). -->
        <div class="acts" :class="{ one: !rec || !sending }">
          <template v-if="rec">
            <button v-if="!rec.on" class="pick record" type="button" :disabled="recBusy" @click="record(true)"><Disc :size="18" aria-hidden="true"/> Record</button>
            <button v-else class="pick stoprec" type="button" :disabled="recBusy" @click="record(false)"><Square :size="14" aria-hidden="true"/> Stop recording</button>
          </template>
          <button v-if="sending" class="pick stop" type="button" @click="stop"><Square :size="16" aria-hidden="true"/> Stop sending</button>
        </div>
        <!-- Sound: found by the page itself; sent beside the video, never recorded, heard by nobody watching. -->
        <div v-if="microphone !== null" class="sound" data-test="pc-sound">
          <p class="quiet" data-test="pc-sound-text">{{ soundText }}</p>
          <button v-if="microphone" class="pick wide" type="button" :aria-pressed="sendSound" data-test="pc-sound-toggle"
                  @click="toggleSound"><Mic v-if="sendSound" :size="16" aria-hidden="true"/><MicOff v-else :size="16" aria-hidden="true"/>
            {{ sendSound ? 'Send sound: on' : 'Send sound: off' }}</button>
          <p v-if="microphone && sendSound && info?.sound_note" class="quiet small">{{ info.sound_note }}</p>
        </div>
        <button v-if="sending && mayHold && (shape === 'portrait' || held)" class="pick wide" type="button" @click="landscape"><RotateCw :size="16" aria-hidden="true"/> {{ held ? 'Let the screen turn again' : 'Hold the screen sideways' }}</button>
        <section v-if="rec" class="recbox" aria-label="Recording">
          <p v-if="recProblem" class="problem" role="alert">{{ recProblem }}</p>
          <p v-else-if="rec.said" class="quiet" role="status">{{ rec.said }}</p>
          <p v-else-if="recSaid" class="quiet" role="status">{{ recSaid }}</p>
          <p v-else-if="rec.on && !sending" class="quiet">Recording is on: what this phone sends is recorded. Tap Start to send.</p>
          <p v-else-if="!rec.on && rec.may" class="quiet">Record keeps what this phone sends in AADML<template v-if="rec.days"> for {{ rec.days }} day{{ rec.days === 1 ? '' : 's' }}</template>.</p>
        </section>
        <p v-if="state === 'reconnecting'" class="quiet"><RefreshCw :size="13" aria-hidden="true"/> The connection dropped. This page tries again by itself; keep it open.</p>
        <p class="quiet">Keep this page open and the screen on while it sends. The video goes to AADML only, encrypted. This link works until {{ until }}, or until a new one is made.</p>
      </template>
    </template>
  </main>
</template>

<style scoped>
.phone{max-width:520px;margin:0 auto;padding:24px 16px 48px;font:15px/1.55 Inter,system-ui,sans-serif;color:#162139;background:#fff;min-height:100vh;box-sizing:border-box}
header{display:flex;gap:12px;align-items:center;margin-bottom:14px}
.mark{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--aadml-primary,#2563eb);color:#fff;flex-shrink:0}
header small{display:block;font-size:12px;color:#4c5d74}
h1{font-size:21px;margin:2px 0 0;letter-spacing:-.3px;overflow-wrap:anywhere}
.quiet{color:#4c5d74;font-size:14px;margin:10px 0}
.quiet svg{vertical-align:-2px}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.status{display:inline-flex;align-items:center;gap:8px;margin:0;padding:6px 12px;border-radius:999px;font-size:14px;font-weight:600;background:#f1f4f8;color:#33415a}
.status .dot{width:9px;height:9px;border-radius:50%;background:currentColor}
.status.live{background:#ecfdf3;color:#05603a}
.status.wait{background:#fffaeb;color:#7a4b00}
.status.bad{background:#fff5f6;color:#a12c3c}
.status.rec{background:#fff5f6;color:#b42318}
.status.rec .dot{animation:blink 1.2s steps(2,start) infinite}
.status .time{font-variant-numeric:tabular-nums}
.status small{font-weight:500}
/* The viewfinder takes the picture's own shape (landscape or portrait), so what is sent is shown whole, never cropped. */
.frame{position:relative;margin:0 auto 14px;aspect-ratio:16/9;max-width:100%;max-height:62vh;border-radius:12px;overflow:hidden;background:#0d1320}
.frame.portrait{height:62vh;width:auto}
.viewfinder,.still{width:100%;height:100%;background:#0d1320;object-fit:contain;display:block}
/* Pinned to the screen, not the page: held sideways the page scrolls, and the way back must stay in view. */
.unhold{position:fixed;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));z-index:20;display:flex;align-items:center;gap:6px;min-height:44px;padding:8px 14px;border:0;border-radius:999px;background:rgba(13,19,32,.78);color:#fff;font:inherit;font-weight:600;cursor:pointer;box-shadow:0 2px 10px #0006}
.unhold:focus-visible{outline:2px solid #fff;outline-offset:2px}
.still{display:grid;place-items:center;color:#8a97ab}
.shape{margin-top:-4px}
.cams{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 10px;padding:4px;border-radius:12px;background:#f1f4f8}
.cam{min-height:44px;border:0;border-radius:9px;background:transparent;color:#33415a;font:inherit;font-weight:600;cursor:pointer}
.cam.on{background:#fff;color:#162139;box-shadow:0 1px 2px #0d132033}
.cam:disabled{opacity:.6;cursor:default}
.go,.pick{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:56px;padding:12px;border-radius:12px;font:inherit;font-weight:600;cursor:pointer;box-sizing:border-box}
.go{border:0;background:var(--aadml-primary,#2563eb);color:#fff;font-size:17px}
.go:disabled,.pick:disabled{opacity:.55;cursor:default}
.acts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.acts.one{grid-template-columns:1fr}
.acts:empty{display:none}
.pick{border:1px solid #d4d9e3;color:#24324a;background:#f8fafc}
.pick.wide{margin-top:10px;min-height:48px}
.pick.stop{border-color:#e5b8bf;color:#a12c3c;background:#fff5f6}
.sound{display:grid;gap:6px}.sound .small{font-size:12px}
.pick.record{border-color:#e5b8bf;color:#b42318;background:#fff}
.pick.stoprec{border-color:#b42318;color:#fff;background:#b42318}
.recbox:empty{display:none}
.go:focus-visible,.pick:focus-visible,.cam:focus-visible{outline:2px solid var(--aadml-focus,#2563eb);outline-offset:2px}
.note{margin:0 0 14px;padding:10px 12px;border-radius:10px;background:#fffaeb;color:#7a4b00;font-size:14px}
.problem{color:#a12c3c;font-size:14px;margin:8px 0}
.ended{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:12px;background:#fff5f6;color:#a12c3c}
.ended p{margin:4px 0 0}
@keyframes blink{to{visibility:hidden}}
@media(prefers-reduced-motion:reduce){.status.rec .dot{animation:none}}
/* Held sideways (a landscape screen of a phone): the whole width, and more of the height for the picture. */
@media (orientation:landscape) and (max-height:520px){
  .phone{max-width:none;padding:12px 16px 24px}
  .frame{max-height:72vh}
}
</style>
