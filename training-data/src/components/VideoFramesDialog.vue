<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import UiDialog from './UiDialog.vue';
import UiButton from './UiButton.vue';

const props = defineProps({ file: Object, busy: Boolean, requestError: String });
const emit = defineEmits(['close', 'extract']);
const url = ref(''); const video = ref(null); const duration = ref(0);
const start = ref(0); const end = ref(0); const interval = ref(1);
const manual = ref(false); const selected = ref([]); const frameRate = ref(30); const position = ref(0);
const thumbnails = ref([]); const error = ref(''); let generation = 0;
const maxFrames = 1000;
const count = computed(() => manual.value ? selected.value.length
  : Math.min(maxFrames + 1, Math.floor((end.value - start.value) / interval.value) + 1));
const valid = computed(() => duration.value > 0 && Number.isFinite(interval.value) && interval.value >= 1 / 30 && interval.value <= 3600
  && start.value >= 0 && end.value > start.value && end.value <= duration.value
  && count.value > 0 && count.value <= maxFrames);
const clock = seconds => new Date(Math.max(0, seconds) * 1000).toISOString().slice(11, 23);
watch(() => props.file, file => {
  generation++;
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = file ? URL.createObjectURL(file) : '';
  duration.value = 0; start.value = 0; end.value = 0; position.value = 0;
  selected.value = []; thumbnails.value = []; manual.value = false; error.value = '';
}, { immediate: true });
function metadata() {
  duration.value = Number.isFinite(video.value?.duration) ? video.value.duration : 0;
  end.value = duration.value;
  if (!duration.value) error.value = 'This browser could not read the video duration.';
  else makeThumbnails();
}
function seek(time) {
  if (video.value && Number.isFinite(time)) video.value.currentTime = Math.min(duration.value, Math.max(0, time));
}
function step(direction) { if (Number.isFinite(frameRate.value) && frameRate.value >= 1 && frameRate.value <= 240) seek(position.value + direction / frameRate.value); }
function addFrame() {
  const time = Math.round(position.value * 1000) / 1000;
  if (time < start.value || time >= end.value || selected.value.includes(time) || selected.value.length >= 100) return;
  selected.value = [...selected.value, time].sort((a, b) => a - b);
}
watch([start, end], () => { selected.value = selected.value.filter(time => time >= start.value && time < end.value); });
async function makeThumbnails() {
  const current = generation; const clip = document.createElement('video'); clip.src = url.value; clip.muted = true;
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 72;
  const context = canvas.getContext('2d');
  if (!context) return;
  try {
    for (let index = 0; index < 12 && current === generation; index++) {
      const time = Math.min(duration.value - 0.001, duration.value * (index + 0.5) / 12);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { clean(); reject(new Error('thumbnail timeout')); }, 3000);
        function clean() { clearTimeout(timeout); clip.onseeked = null; clip.onerror = null; }
        clip.onseeked = () => { clean(); resolve(); };
        clip.onerror = () => { clean(); reject(new Error('video decode')); };
        clip.currentTime = time;
      });
      if (current !== generation) return;
      context.drawImage(clip, 0, 0, 120, 72);
      thumbnails.value.push({ time, url: canvas.toDataURL('image/jpeg', 0.7) });
    }
  } catch { /* The playable video and range controls remain usable without thumbnails. */ }
  finally { clip.removeAttribute('src'); clip.load(); }
}
function extract() {
  if (!valid.value || props.busy) return;
  emit('extract', { start: start.value, end: end.value, interval: interval.value,
    timestamps: manual.value ? selected.value : null });
}
onUnmounted(() => { generation++; if (url.value) URL.revokeObjectURL(url.value); });
</script>

<template>
  <UiDialog :open="!!file" :title="`Extract frames from ${file?.name || 'video'}`" class="video-frames-dialog" @close="!busy && emit('close')">
    <div class="video-extraction">
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="requestError" role="alert">{{ requestError }}</p>
      <video ref="video" :src="url" controls preload="metadata" playsinline @loadedmetadata="metadata" @timeupdate="position = video.currentTime" @error="error = 'This browser cannot preview this video. Try an MP4 with an H.264 video track.'"/>
      <div class="video-range-heading"><span>{{ clock(start) }} / {{ clock(end) }}</span><UiButton @click="manual = !manual">{{ manual ? 'Hide manual selection' : 'Manual selection' }}</UiButton></div>
      <div class="video-filmstrip" aria-label="Video timeline"><button v-for="frame in thumbnails" :key="frame.time" :aria-label="`Seek to ${clock(frame.time)}`" @click="seek(frame.time)"><img :src="frame.url" alt=""/></button></div>
      <div class="video-range"><label>Start <input v-model.number="start" type="range" min="0" :max="duration" step="0.001" aria-label="Video start time"/></label><label>End <input v-model.number="end" type="range" min="0" :max="duration" step="0.001" aria-label="Video end time"/></label></div>
      <section v-if="manual" class="video-sampling"><h3>Select frames to upload</h3><div class="video-frame-actions"><UiButton @click="step(-1)">−1 Frame</UiButton><UiButton @click="addFrame">Add current frame</UiButton><UiButton @click="step(1)">+1 Frame</UiButton><label>Frame rate <input v-model.number="frameRate" type="number" min="1" max="240" aria-label="Frame rate for stepping"/></label></div><p>Selected frames · {{ selected.length }} of 100 maximum. Adjust the frame rate to match your video.</p><div class="video-selected"><button v-for="time in selected" :key="time" :aria-label="`Remove frame at ${clock(time)}`" @click="selected = selected.filter(value => value !== time)">{{ clock(time) }} ×</button></div></section>
      <section v-else class="video-sampling"><h3>How should we sample the video?</h3><label>Output 1 frame every <input v-model.number="interval" type="number" :min="1 / 30" max="3600" step="0.01" aria-label="Seconds between frames"/> seconds</label><p>Up to {{ count }} frames · maximum {{ maxFrames }} per video. The last frame depends on the video’s timestamps.</p></section>
      <div class="dialog-actions"><UiButton :disabled="busy" @click="emit('close')">Skip video</UiButton><UiButton variant="primary" :disabled="busy || !valid" @click="extract">{{ busy ? 'Extracting…' : `Extract ${count} frames` }}</UiButton></div>
    </div>
  </UiDialog>
</template>

<style scoped>
.video-extraction{width:min(760px,80vw);max-width:100%;padding-top:16px}.video-extraction video{display:block;width:100%;max-height:350px;background:#111;border-radius:8px}.video-range-heading,.video-frame-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:14px 0;font-size:12px}.video-filmstrip{display:flex;overflow:hidden;border:2px solid var(--accent);border-radius:5px;min-height:25px}.video-filmstrip button{min-width:0;flex:1;padding:0;border:0;background:transparent;cursor:pointer}.video-filmstrip img{width:100%;height:64px;object-fit:cover;display:block}.video-range{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:12px 0}.video-range label{display:grid;gap:4px;font-size:12px}.video-range input{width:100%}.video-sampling{border:1px solid var(--aadml-outline);padding:16px;border-radius:8px;margin:12px 0}.video-sampling h3{font-size:14px;margin-bottom:12px}.video-sampling p{font-size:12px;margin-top:12px}.video-sampling input[type=number]{width:85px;padding:7px;border:1px solid var(--aadml-outline);border-radius:5px;margin:0 6px}.video-selected{display:flex;flex-wrap:wrap;gap:6px}.video-selected button{padding:6px;border:1px solid var(--aadml-outline);border-radius:4px;background:var(--aadml-soft)}@media(max-width:600px){.video-extraction{width:100%}.video-range{grid-template-columns:1fr}}
</style>
<style>
.dialog.video-frames-dialog{width:min(900px,94vw);max-width:900px}.dialog.format-dialog{width:min(1100px,94vw);max-width:1100px}
</style>
