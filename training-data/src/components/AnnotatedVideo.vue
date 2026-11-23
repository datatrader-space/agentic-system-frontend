<script setup>
// A stream's annotated video (VISION_WORKFLOWS_PLAN.md 5.3): made for a capped stream on an uploaded video or a kept
// recording whose workflow has a Draw objects step. While the stream runs it says it is being made; when it is ready,
// the person opens it here and AADML is asked for a 15-minute link to it only then (streamingApi.video). A link that
// is over is asked for again: before a play, after the player fails to load it, and for the download.
// The stream row carries { state, frames, error } only, never a link.
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { Download, LoaderCircle, Play, RefreshCw, TriangleAlert } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import { streamingApi, annotatedVideo, videoLinkFresh, videoLinkFrom } from '../api/streaming.js';

const props = defineProps({ stream: { type: Object, required: true } });

const video = computed(() => annotatedVideo(props.stream));
const open = ref(false); const link = ref(null); const busy = ref(false); const error = ref('');
const player = ref(null);
const now = ref(Date.now()); let staleTimer = null;
const fresh = computed(() => videoLinkFresh(link.value, now.value));

function markStaleLater() {
  clearTimeout(staleTimer); staleTimer = null;
  if (!link.value) return;
  const lasts = Math.max(0, link.value.expiresIn * 1000 - 60 * 1000 - (Date.now() - link.value.at));
  staleTimer = setTimeout(() => { now.value = Date.now(); }, lasts + 50);
}
async function fetchLink() {
  if (busy.value) return false;
  busy.value = true; error.value = '';
  try {
    link.value = videoLinkFrom(await streamingApi.video(props.stream.id));
    now.value = Date.now(); markStaleLater();
    return true;
  } catch (e) { error.value = e.message || 'The annotated video could not be opened.'; return false; }
  finally { busy.value = false; }
}
async function openVideo() {
  open.value = true;
  if (!fresh.value) await fetchLink();
}
// A play on a link that is over, or a link the player could not load: a new link, at the same place in the video.
async function renew(play) {
  const at = player.value?.currentTime || 0;
  if (!(await fetchLink())) return;
  await nextTick();                                  // the player has the new link before it loads again
  const el = player.value;
  if (!el) return;
  el.addEventListener('loadedmetadata', () => { try { el.currentTime = at; } catch { /* not seekable yet */ } if (play) el.play().catch(() => {}); }, { once: true });
  el.load();
}
function onPlay() { if (!fresh.value) { player.value?.pause(); renew(true); } }
function onError() { if (link.value && !busy.value) { if (fresh.value) error.value = 'The player could not load the annotated video.'; else renew(false); } }

// Another stream opened in the same place starts closed.
watch(() => props.stream.id, () => { open.value = false; link.value = null; error.value = ''; clearTimeout(staleTimer); });
onUnmounted(() => clearTimeout(staleTimer));
</script>

<template>
  <section v-if="video" class="av" :aria-labelledby="`av-h-${stream.id}`" data-test="annotated-video">
    <h4 :id="`av-h-${stream.id}`" class="av-h">Annotated video</h4>
    <p v-if="video.state === 'making'" class="av-line" role="status"><LoaderCircle class="av-spin" :size="14" aria-hidden="true"/>{{ video.text }}</p>
    <p v-else-if="video.state === 'failed'" class="av-line av-failed" role="status"><TriangleAlert :size="14" aria-hidden="true"/>{{ video.text }}</p>
    <template v-else>
      <p class="av-line">{{ video.text }} The objects the workflow found are drawn on each frame. It has no sound and no captions; the results file lists the same objects as text.</p>
      <UiButton v-if="!open" class="av-open" :disabled="busy" data-test="av-open" @click="openVideo">
        <LoaderCircle v-if="busy" class="av-spin" :size="14" aria-hidden="true"/><Play v-else :size="14" aria-hidden="true"/> Watch the annotated video
      </UiButton>
      <template v-else>
        <p v-if="busy && !link" class="av-line" role="status"><LoaderCircle class="av-spin" :size="14" aria-hidden="true"/>Opening the video…</p>
        <video v-if="link" ref="player" class="av-player" :src="link.url" controls preload="none" playsinline
               :aria-label="`Annotated video of the stream on ${stream.source}, no sound`" data-test="av-player"
               @play="onPlay" @error="onError"></video>
        <div v-if="link" class="av-acts">
          <a v-if="fresh" class="button av-download" :href="link.url" download target="_blank" rel="noopener noreferrer" data-test="av-download">
            <Download :size="14" aria-hidden="true"/> Download the video<span class="sr-only"> (opens in a new tab)</span></a>
          <UiButton v-else :disabled="busy" data-test="av-renew" @click="renew(false)"><RefreshCw :size="14" aria-hidden="true"/> Get a new link to the video</UiButton>
          <small class="av-note">{{ fresh ? 'The link works for 15 minutes.' : 'The link is over: a new one is asked for when you play or download it.' }}</small>
        </div>
      </template>
      <div v-if="error" class="av-error" role="alert">
        <span>{{ error }}</span>
        <UiButton :disabled="busy" data-test="av-retry" @click="link ? renew(false) : openVideo()"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
.av{margin-top:16px;padding-top:12px;border-top:1px solid #dfe5ee}
.av-h{margin:0 0 6px;font-size:13px;color:#162139}
.av-line{display:flex;gap:7px;align-items:flex-start;margin:0 0 10px!important;font-size:13px!important;line-height:1.55!important;color:#33415a!important}
.av-line svg{flex-shrink:0;margin-top:3px;color:#5f6d82}
.av-failed{color:#a12c3c!important}
.av-failed svg{color:#a12c3c}
.av-open,.av-acts .button{min-height:44px}
.av-player{display:block;width:100%;max-width:720px;max-height:420px;border-radius:9px;background:#0d1320}
.av-acts{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
.av-download{display:inline-flex;align-items:center;gap:7px;text-decoration:none}
.av-note{font-size:12px;color:#5f6d82}
.av-error{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:10px;padding:10px 14px;border:1px solid #efc5ce;border-radius:10px;background:#fff5f6;color:#ad3449;font-size:13px}
.av-error .button{min-height:44px}
.av-spin{animation:av-spin 1.1s linear infinite}
@keyframes av-spin{to{transform:rotate(360deg)}}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(prefers-reduced-motion:reduce){.av-spin{animation:none}}
</style>
