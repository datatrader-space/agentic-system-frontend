<script setup>
// A kept recording's video card picture (the owner, 2026-11-23: "a video card preview like YouTube", in Cloud
// Streaming's Recordings and on a camera's own page): one frame of it (``thumbnail_url``; a camera icon while it has
// none or it cannot be shown), its length in the corner, a play mark, and while pointed at or focused a silent preview
// of it. Clicking it emits ``play``. ``fresh()`` says whether its signed links are still good to preview (the list asks
// for new ones before playing).
import { ref } from 'vue';
import { Cctv, Play } from 'lucide-vue-next';

const props = defineProps({
  recording: { type: Object, required: true },
  label: { type: String, default: 'Play the recording' },
  fresh: { type: Function, default: () => true },
});
const emit = defineEmits(['play']);
const previewing = ref(false); const noPicture = ref(false);

// "5:00", "1:02:03": a recording's length as a video card says it.
function lengthText(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}
function startPreview() { if (props.recording.play_url && props.fresh()) previewing.value = true; }
function endPreview() { previewing.value = false; }
// Started once it has loaded: a video added on hover is not always started by `autoplay` (live, 2026-11-23: loaded,
// not playing). Muted first, so the browser allows it without a tap.
function playPreview(event) { const v = event.target; v.muted = true; v.play?.()?.catch?.(() => {}); }
</script>

<template>
  <button type="button" class="recs-thumb" :disabled="!recording.play_url" :aria-label="label"
          @click="emit('play')" @mouseenter="startPreview" @mouseleave="endPreview" @focus="startPreview" @blur="endPreview">
    <img v-if="recording.thumbnail_url && !noPicture" :src="recording.thumbnail_url" alt="" loading="lazy" data-test="rec-picture" @error="noPicture = true">
    <span v-else class="recs-nopic" aria-hidden="true"><Cctv :size="28"/></span>
    <video v-if="previewing" :src="recording.play_url" muted autoplay loop playsinline preload="metadata"
           class="recs-preview" aria-hidden="true" data-test="rec-preview" @loadeddata="playPreview"></video>
    <span class="recs-length" data-test="rec-length">{{ lengthText(recording.seconds) }}</span>
    <span class="recs-playmark" aria-hidden="true"><Play :size="18"/></span>
  </button>
</template>

<style scoped>
.recs-thumb{position:relative;display:block;width:100%;aspect-ratio:16/9;padding:0;border:0;background:#0d1320;cursor:pointer;overflow:hidden}
.recs-thumb:disabled{cursor:default}
.recs-thumb img,.recs-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.recs-nopic{position:absolute;inset:0;display:grid;place-items:center;color:#8a97ad}
.recs-length{position:absolute;right:8px;bottom:8px;padding:1px 6px;border-radius:4px;background:rgba(0,0,0,.78);color:#fff;font-size:12px;font-weight:600}
.recs-playmark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;opacity:0;transition:opacity .15s}
.recs-thumb:hover .recs-playmark,.recs-thumb:focus-visible .recs-playmark{opacity:1}
.recs-thumb:focus-visible{outline:2px solid var(--aadml-primary);outline-offset:-2px}
@media (prefers-reduced-motion: reduce){.recs-playmark{transition:none}}
</style>
