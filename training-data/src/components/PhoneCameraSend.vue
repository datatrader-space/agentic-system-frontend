<script setup>
// The page a phone opens from a phone camera's link (CLOUD_STREAMING_PLAN.md §16; backend phone_camera.py): it sends the
// phone's own camera to AADML from the browser, no app and no sign-in. The link's secret is its only authority (the
// server checks it on every call, and the media relay again when the phone sends); it leaves the address at once
// (main.js). Start opens the camera (the back one first), sends it over WebRTC (api/phoneCamera.js: WHIP), keeps the
// screen on where the browser can (Screen Wake Lock), and tries again by itself when the connection drops. Stop ends
// the session at once. Nothing is recorded or kept here: what AADML does with the video is the camera's own settings.
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Camera, CircleAlert, RefreshCw, Square, SwitchCamera, Video } from 'lucide-vue-next';
import { phoneCameraApi } from '../api/phone.js';
import { cameraConstraints, publish, retryDelay, whipUrlOk, REFUSED_TEXT } from '../api/phoneCamera.js';

const props = defineProps({ secret: { type: String, required: true } });
const info = ref(null); const error = ref('');
// idle | starting | live | reconnecting | stopped | ended
const state = ref('idle'); const problem = ref(''); const facing = ref('environment');
const preview = ref(null); const codec = ref(''); const busy = ref(false);
let stream = null; let session = null; let wakeLock = null; let retryTimer = null; let watchTimer = null;
let failures = 0; let run = 0; let gone = false;

const supported = typeof globalThis.RTCPeerConnection === 'function' && !!globalThis.navigator?.mediaDevices?.getUserMedia;
const until = computed(() => (info.value?.expires_at
  ? new Date(info.value.expires_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''));
const sending = computed(() => ['starting', 'live', 'reconnecting'].includes(state.value));
const STATES = {
  idle: ['quiet', 'Not sending'], starting: ['wait', 'Connecting…'], live: ['live', 'Live: sending to AADML'],
  reconnecting: ['wait', 'Reconnecting…'], stopped: ['quiet', 'Stopped'], ended: ['bad', 'This link no longer works'],
};
const pill = computed(() => STATES[state.value] || STATES.idle);

onMounted(async () => {
  try {
    const answer = await phoneCameraApi.info(props.secret);
    if (!whipUrlOk(answer?.whip)) throw new Error('This phone link does not lead to an AADML camera.');
    info.value = answer;
  } catch (e) { error.value = e.message; }
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pagehide', onLeave);
});

function cameraProblem(e) {
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return 'The camera was not allowed. Allow the camera for this site in the browser\'s settings, then tap Start again.';
  if (e?.name === 'NotReadableError') return 'The camera is in use by another app. Close it, then tap Start again.';
  return 'The phone\'s camera could not be opened. Tap Start to try again.';
}
async function openCamera() {
  const next = await navigator.mediaDevices.getUserMedia(cameraConstraints(facing.value));
  const old = stream; stream = next;
  if (preview.value) { preview.value.srcObject = next; try { await preview.value.play(); } catch { /* muted preview */ } }
  next.getVideoTracks()[0]?.addEventListener('ended', () => { if (sending.value && !gone) onVisible(); });
  if (old && old !== next) old.getTracks().forEach(t => t.stop());
  return next;
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
      whipUrl: info.value.whip, secret: props.secret, stream,
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
    session = made; codec.value = made.codec;
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

async function start() {
  if (busy.value || !info.value || !supported) return;
  busy.value = true; problem.value = ''; failures = 0;
  const mine = ++run;
  state.value = 'starting';
  try { await openCamera(); }
  catch (e) { state.value = 'idle'; problem.value = cameraProblem(e); busy.value = false; return; }
  busy.value = false;
  keepScreenOn();
  connect(mine);
}
function release() {
  run += 1;
  clearTimeout(retryTimer); retryTimer = null;
  closeSession();
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (preview.value) preview.value.srcObject = null;
  letScreenSleep();
}
function stop() { release(); state.value = 'stopped'; problem.value = ''; }
function end(message) { release(); state.value = 'ended'; problem.value = message; }

async function switchCamera() {
  if (busy.value || !sending.value) return;
  busy.value = true;
  const was = facing.value;
  facing.value = was === 'environment' ? 'user' : 'environment';
  try {
    const next = await openCamera();
    const track = next.getVideoTracks()[0];
    if (session?.sender && track) await session.sender.replaceTrack(track);
  } catch (e) { facing.value = was; problem.value = cameraProblem(e); }
  finally { busy.value = false; }
}

// Back on the page: the screen lock is asked for again (a browser drops it when the page is hidden), and a camera the
// phone stopped while the page was hidden is opened again.
async function onVisible() {
  if (document.visibilityState !== 'visible' || !sending.value || gone) return;
  keepScreenOn();
  if (stream?.getVideoTracks()[0]?.readyState === 'ended') {
    try {
      const track = (await openCamera()).getVideoTracks()[0];
      if (session?.sender && track) await session.sender.replaceTrack(track);
    } catch (e) { problem.value = cameraProblem(e); }
  }
}
function onLeave() { if (session) closeSession(); }

onUnmounted(() => {
  gone = true;
  document.removeEventListener('visibilitychange', onVisible);
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
      <p class="status" :class="pill[0]" role="status" aria-live="polite"><span class="dot" aria-hidden="true"></span>{{ pill[1] }}<small v-if="state === 'live' && codec"> · {{ codec }}</small></p>
      <div class="frame">
        <video v-show="sending" ref="preview" class="viewfinder" muted playsinline autoplay aria-label="What this phone sends"></video>
        <div v-if="!sending" class="still"><Camera :size="34" aria-hidden="true"/></div>
      </div>
      <p v-if="!supported" class="note" role="alert">This browser cannot send the camera. Open the link in a recent Chrome (Android) or Safari (iPhone).</p>
      <p v-if="problem" class="problem" role="alert">{{ problem }}</p>
      <template v-if="state !== 'ended'">
        <button v-if="!sending" class="go" type="button" :disabled="busy || !supported" @click="start"><Camera :size="20" aria-hidden="true"/> {{ state === 'stopped' ? 'Start again' : 'Start' }}</button>
        <div v-else class="acts">
          <button class="pick" type="button" :disabled="busy" @click="switchCamera"><SwitchCamera :size="18" aria-hidden="true"/> {{ facing === 'environment' ? 'Front camera' : 'Back camera' }}</button>
          <button class="pick stop" type="button" @click="stop"><Square :size="16" aria-hidden="true"/> Stop</button>
        </div>
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
.status{display:inline-flex;align-items:center;gap:8px;margin:0 0 12px;padding:6px 12px;border-radius:999px;font-size:14px;font-weight:600;background:#f1f4f8;color:#33415a}
.status .dot{width:9px;height:9px;border-radius:50%;background:currentColor}
.status.live{background:#ecfdf3;color:#05603a}
.status.wait{background:#fffaeb;color:#7a4b00}
.status.bad{background:#fff5f6;color:#a12c3c}
.status small{font-weight:500}
.frame{position:relative;margin-bottom:14px}
.viewfinder,.still{width:100%;aspect-ratio:16/9;border-radius:12px;background:#0d1320;object-fit:cover;display:block}
.still{display:grid;place-items:center;color:#8a97ab}
.go,.pick{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:56px;padding:12px;border-radius:12px;font:inherit;font-weight:600;cursor:pointer}
.go{border:0;background:var(--aadml-primary,#2563eb);color:#fff;font-size:17px}
.go:disabled{opacity:.55;cursor:default}
.acts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pick{border:1px solid #d4d9e3;color:#24324a;background:#f8fafc}
.pick.stop{border-color:#e5b8bf;color:#a12c3c;background:#fff5f6}
.go:focus-visible,.pick:focus-visible{outline:2px solid var(--aadml-focus,#2563eb);outline-offset:2px}
.note{margin:0 0 14px;padding:10px 12px;border-radius:10px;background:#fffaeb;color:#7a4b00;font-size:14px}
.problem{color:#a12c3c;font-size:14px;margin:8px 0}
.ended{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:12px;background:#fff5f6;color:#a12c3c}
.ended p{margin:4px 0 0}
</style>
