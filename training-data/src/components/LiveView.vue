<script setup>
// A saved camera's live view (CLOUD_STREAMING_PLAN.md 3.3): AADML's media relay reads the camera and serves it as
// low-latency HLS under /live/, behind a short-lived token from workspace/video-sources/<id>/live/. The token goes in
// an Authorization header on every playlist and segment request (never in a link), and a new one replaces it before
// it runs out, without reloading the player. hls.js is loaded only when someone watches. The video starts muted.
// ``inline``: the player in a page (a source's own page, VideoSourcePage.vue) instead of a dialog; ``state`` tells the
// page how it stands, and the page may ask for it full screen.
import { onUnmounted, ref, watch } from 'vue';
import { LoaderCircle, RefreshCw, VideoOff } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import { videoSources, liveAnswer, liveErrorText, sourceShown, LIVE_NO_ANSWER, LIVE_NOT_PLAYABLE } from '../api/streaming.js';

const props = defineProps({ source: { type: Object, default: null }, inline: { type: Boolean, default: false } });
const emit = defineEmits(['close', 'state']);

const video = ref(null);
// connecting | playing | failed (the camera or the relay stopped answering) | refused (the API said no)
const state = ref('connecting'); const message = ref('');
watch(state, value => emit('state', value), { immediate: true });
let hls = null; let renewTimer = null; let token = ''; let run = 0;
const RETRY_MS = 15000;
// A connector camera (CLOUD_STREAMING_PLAN.md §12): its machine is asked to send it, and the page asks again every
// START_POLL_MS (following that live job) until the video has reached the relay, for at most START_MOST_MS. An RTMP
// stream (§14) is waited for the same way: nobody can be asked to send it, its camera or encoder pushes when it starts.
const START_POLL_MS = 3000; const START_MOST_MS = 6 * 60 * 1000;
let followJob = null;
const pause = ms => new Promise(resolve => { setTimeout(resolve, ms); });

function stop() {
  run += 1;
  clearTimeout(renewTimer); renewTimer = null;
  token = '';
  if (hls) { hls.destroy(); hls = null; }
  const el = video.value;
  if (el) { el.pause(); el.removeAttribute('src'); el.load?.(); }
}

function fail(kind, text) {
  stop();
  state.value = kind; message.value = text;
}

// A new token before the current one runs out; the player keeps going and its next request carries the new one.
// When asking fails, it is asked again shortly while the old token may still last.
function scheduleRenew(ms, mine) {
  clearTimeout(renewTimer);
  renewTimer = setTimeout(async () => {
    try {
      const next = liveAnswer(await videoSources.live(props.source.id, followJob, { again: true }));
      if (mine !== run) return;
      if (!next) { fail('failed', LIVE_NO_ANSWER); return; }
      token = next.token;
      scheduleRenew(next.renewInMs, mine);
    } catch (e) {
      if (mine !== run) return;
      if (e?.serverCode || e?.status === 404 || e?.status === 403) fail('refused', liveErrorText(e));
      else scheduleRenew(RETRY_MS, mine);
    }
  }, ms);
}

async function start() {
  stop();
  const mine = run;
  const id = props.source?.id;
  if (id === undefined || id === null) return;
  state.value = 'connecting'; message.value = ''; followJob = null;
  let live;
  try {
    live = liveAnswer(await videoSources.live(id));
  } catch (e) {
    if (mine === run) fail('refused', liveErrorText(e));
    return;
  }
  if (mine !== run) return;
  if (!live) { fail('failed', LIVE_NO_ANSWER); return; }
  followJob = live.job;
  const began = Date.now();
  const pushed = props.source?.kind === 'rtmp';
  while (!live.ready) {
    state.value = 'starting';
    message.value = live.said || (pushed ? 'Waiting for your camera or encoder to send its video…' : 'Starting the camera on its machine…');
    await pause(START_POLL_MS);
    if (mine !== run) return;
    if (Date.now() - began > START_MOST_MS) {
      fail('failed', pushed
        ? 'Nothing was sent to the AADML address of this camera within 6 minutes. Start the stream on your camera or encoder with its server and stream key, then try again.'
        : 'The machine did not start sending the camera within 6 minutes. Check that it is running, then try again.');
      return;
    }
    try {
      live = liveAnswer(await videoSources.live(id, followJob, { again: true }));
    } catch (e) {
      if (mine === run) fail('refused', liveErrorText(e));
      return;
    }
    if (mine !== run) return;
    if (!live) { fail('failed', LIVE_NO_ANSWER); return; }
    followJob = live.job || followJob;
  }
  state.value = 'connecting'; message.value = '';
  let Hls;
  try { ({ default: Hls } = await import('hls.js')); }
  catch { if (mine === run) fail('failed', 'The video player could not be loaded. Check your connection and try again.'); return; }
  if (mine !== run || !video.value) return;
  // Native HLS (Safari without Media Source) cannot send the token header, so only hls.js plays it.
  if (!Hls.isSupported()) { fail('refused', 'This browser cannot play live video. Try a recent Chrome, Edge, Firefox or Safari.'); return; }
  token = live.token;
  const player = new Hls({
    lowLatencyMode: true,
    xhrSetup: xhr => { xhr.setRequestHeader('Authorization', `Bearer ${token}`); },
  });
  hls = player;
  let parsed = false;                                     // the relay reached the camera and served its playlist
  player.on(Hls.Events.MANIFEST_PARSED, () => { parsed = true; if (hls === player) video.value?.play().catch(() => { /* the controls can start it */ }); });
  player.on(Hls.Events.ERROR, (_event, data) => { if (data?.fatal && hls === player) fail('failed', parsed ? LIVE_NOT_PLAYABLE : LIVE_NO_ANSWER); });
  player.loadSource(live.playlist);
  player.attachMedia(video.value);
  scheduleRenew(live.renewInMs, mine);
}

function playing() { if (hls) { state.value = 'playing'; message.value = ''; } }
function close() { stop(); emit('close'); }
function fullscreen() { video.value?.requestFullscreen?.().catch?.(() => { /* the browser said no: nothing to do */ }); }
defineExpose({ start, stop, fullscreen });

watch(() => props.source?.id, (id) => { if (id !== undefined && id !== null) start(); else stop(); }, { immediate: true });
onUnmounted(stop);
</script>

<template>
  <div v-if="inline && source" class="lv-inline">
    <div class="lv-stage lv-stage-inline">
      <video ref="video" class="lv-video" muted playsinline controls :aria-label="`Live video from ${source.name}`" @playing="playing"></video>
      <div v-if="state !== 'playing'" class="lv-over" :role="state === 'connecting' || state === 'starting' ? 'status' : 'alert'">
        <template v-if="state === 'connecting' || state === 'starting'"><LoaderCircle class="spin" :size="22" aria-hidden="true"/><span>{{ state === 'starting' ? message : 'Connecting to the camera…' }}</span></template>
        <template v-else>
          <VideoOff :size="22" aria-hidden="true"/><span>{{ message }}</span>
          <UiButton class="small" @click="start"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
        </template>
      </div>
    </div>
    <p class="lv-sr" aria-live="polite">{{ state === 'playing' ? 'Playing live.' : '' }}</p>
  </div>
  <UiDialog v-else-if="!inline" class="lv-dialog" :open="!!source" :title="source ? `${source.name}, live` : 'Live view'" @close="close">
    <template v-if="source">
      <p class="dialog-description">{{ sourceShown(source) }}. The sound is off until you turn it on.</p>
      <div class="lv-stage">
        <video ref="video" class="lv-video" muted playsinline controls :aria-label="`Live video from ${source.name}`" @playing="playing"></video>
        <div v-if="state !== 'playing'" class="lv-over" :role="state === 'connecting' || state === 'starting' ? 'status' : 'alert'">
          <template v-if="state === 'connecting' || state === 'starting'"><LoaderCircle class="spin" :size="22" aria-hidden="true"/><span>{{ state === 'starting' ? message : 'Connecting to the camera…' }}</span></template>
          <template v-else><VideoOff :size="22" aria-hidden="true"/><span>{{ message }}</span></template>
        </div>
      </div>
      <p class="lv-sr" aria-live="polite">{{ state === 'playing' ? 'Playing live.' : '' }}</p>
      <div class="dialog-actions">
        <UiButton v-if="state === 'failed' || state === 'refused'" @click="start"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
        <UiButton variant="primary" @click="close">Close</UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<style scoped>
.lv-dialog{width:min(860px,calc(100% - 32px))}
.lv-inline{position:relative}
.lv-stage-inline{margin-top:0;border-radius:0}
.lv-stage{position:relative;margin-top:14px;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#0d1320}
.lv-video{display:block;width:100%;height:100%;background:#0d1320}
.lv-over{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;text-align:center;background:#0d1320e6;color:#e6ebf3;font-size:14px;line-height:1.5}
.lv-over :deep(.button){background:#fff;color:#17243b;border-color:#fff}
.lv-over :deep(.button:hover){background:#e6ebf3}
.lv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.dialog-actions .button{min-height:44px}
.spin{animation:lv-spin 1.1s linear infinite}
@keyframes lv-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}}
</style>
