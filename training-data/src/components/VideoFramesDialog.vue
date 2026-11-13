<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import UiDialog from './UiDialog.vue';
import UiButton from './UiButton.vue';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, SkipBack, SkipForward, BookmarkPlus } from 'lucide-vue-next';

const props = defineProps({ file: Object, busy: Boolean, requestError: String });
const emit = defineEmits(['close', 'extract']);
const url = ref(''); const video = ref(null); const duration = ref(0);
const start = ref(0); const end = ref(0); const interval = ref(1);
const manual = ref(false); const selected = ref([]); const frameRate = ref(30); const position = ref(0);
const thumbnails = ref([]); const error = ref(''); let generation = 0;
const maxFrames = 1000;
const sampledCount = computed(() => Number.isFinite(interval.value) && interval.value > 0 && end.value > start.value
  ? Math.min(maxFrames + 1, Math.floor((end.value - start.value) / interval.value) + 1) : 0);
const count = computed(() => manual.value ? selected.value.length : sampledCount.value);
const slider = computed({ get: () => Number.isFinite(interval.value) && interval.value > 0
  ? Math.log(Math.min(30, Math.max(1 / 30, interval.value))) / Math.log(30) : 0,
  set: value => { interval.value = Math.max(1 / 30, Number(Math.pow(30, Number(value)).toFixed(4))); } });
const trimStyle = computed(() => ({ '--trim-start': `${duration.value ? start.value / duration.value * 100 : 0}%`,
  '--trim-end': `${duration.value ? (1 - end.value / duration.value) * 100 : 0}%` }));
const samplingLabel = computed(() => !Number.isFinite(interval.value) || interval.value <= 0 ? 'Choose an interval'
  : interval.value < 1 ? `${Number((1 / interval.value).toFixed(1))} frames/second`
    : `1 frame every ${Number(interval.value.toFixed(2))} second${interval.value === 1 ? '' : 's'}`);
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
function jumpSelected(direction) {
  const times = selected.value.filter(time => direction < 0 ? time < position.value - .001 : time > position.value + .001);
  if (times.length) seek(direction < 0 ? times[times.length - 1] : times[0]);
}
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
    <template #title><span class="video-title-file" :title="file?.name">Extract frames from {{ file?.name || 'video' }}</span><span v-if="duration" class="video-duration">({{ duration.toFixed(1) }}s)</span></template>
    <div class="video-extraction">
      <p v-if="error" class="video-error" role="alert">{{ error }}</p><p v-if="requestError" class="video-error" role="alert">{{ requestError }}</p>
      <video ref="video" :src="url" controls preload="metadata" playsinline @loadedmetadata="metadata" @timeupdate="position = video.currentTime" @error="error = 'This browser cannot preview this video. Try an MP4 with an H.264 video track.'"/>
      <div class="video-range-heading"><span>{{ clock(start) }} / {{ clock(end) }}</span><UiButton :aria-expanded="manual" @click="manual = !manual"><component :is="manual ? ChevronUp : ChevronDown" :size="14"/>{{ manual ? 'Hide manual selection' : 'Manual selection' }}</UiButton></div>
      <div class="video-timeline" :style="trimStyle">
        <div class="video-filmstrip" aria-label="Video timeline"><button v-for="frame in thumbnails" :key="frame.time" :aria-label="`Seek to ${clock(frame.time)}`" @click="seek(frame.time)"><img :src="frame.url" alt=""/></button></div>
        <div class="trim-shade trim-shade-start" aria-hidden="true"/><div class="trim-shade trim-shade-end" aria-hidden="true"/><div class="trim-outline" aria-hidden="true"/>
        <input class="trim-input trim-start" :value="start" @input="start = Math.min(Number($event.target.value), Math.max(0, end - .001))" type="range" min="0" :max="duration" step="0.001" aria-label="Video start time" :aria-valuetext="clock(start)"/>
        <input class="trim-input trim-end" :value="end" @input="end = Math.max(Number($event.target.value), Math.min(duration, start + .001))" type="range" min="0" :max="duration" step="0.001" aria-label="Video end time" :aria-valuetext="clock(end)"/>
      </div>
      <section v-if="manual" class="video-manual"><h3>Select frames to upload</h3>
        <div class="video-frame-actions"><UiButton :disabled="!selected.some(time => time < position - .001)" @click="jumpSelected(-1)"><SkipBack :size="13"/>Previous</UiButton><UiButton @click="step(-1)"><ChevronLeft :size="13"/>−1 Frame</UiButton><UiButton class="add-frame" @click="addFrame"><BookmarkPlus :size="14"/>Add current frame</UiButton><UiButton @click="step(1)">+1 Frame<ChevronRight :size="13"/></UiButton><UiButton :disabled="!selected.some(time => time > position + .001)" @click="jumpSelected(1)">Next<SkipForward :size="13"/></UiButton></div>
        <div class="selected-summary"><strong>Selected frames</strong><span>{{ selected.length ? selected.length + ' selected · click a timestamp to remove it.' : 'Add frames from the current playhead.' }}</span></div>
        <div v-if="selected.length" class="video-selected"><button v-for="time in selected" :key="time" :aria-label="`Remove frame at ${clock(time)}`" @click="selected = selected.filter(value => value !== time)">{{ clock(time) }} ×</button></div>
        <details class="frame-rate-options"><summary>Frame stepping: {{ frameRate }} fps</summary><label>Match your video’s frame rate <input v-model.number="frameRate" type="number" min="1" max="240" aria-label="Frame rate for stepping"/></label></details>
      </section>
      <section class="video-sampling"><h3>How should we sample the video?</h3>
        <div class="sampling-labels"><span>30 frames/second</span><strong>{{ samplingLabel }}</strong><span>1 frame every 30 seconds</span></div>
        <input v-model.number="slider" class="sampling-slider" type="range" min="-1" max="1" step="0.001" :disabled="manual" aria-label="Video sampling rate" :aria-valuetext="samplingLabel"/>
        <div class="sampling-output"><label>Output 1 frame every <input v-model.number="interval" type="number" :min="1 / 30" max="3600" step="0.01" :disabled="manual" aria-label="Seconds between frames"/> seconds</label><span class="image-estimate">(<output aria-label="Estimated image count">{{ sampledCount }}</output> images)</span></div>
        <p v-if="manual" class="sampling-note">Manual selection is active. Only the {{ selected.length }} selected frames will be extracted.</p><p v-else-if="sampledCount > maxFrames" class="video-error">Choose a slower sampling rate or shorter range. Maximum {{ maxFrames }} frames per video.</p>
      </section>
      <div class="dialog-actions video-extract-actions"><UiButton :disabled="busy" @click="emit('close')">Skip video</UiButton><UiButton variant="primary" :disabled="busy || !valid" @click="extract">{{ busy ? 'Extracting…' : `Extract ${count} frames` }}</UiButton></div>
    </div>
  </UiDialog>
</template>

<style scoped>
.video-extraction{width:100%;padding-top:20px}.video-extraction video{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#111;border-radius:6px}
.video-range-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 0 10px;font-size:11px}.video-range-heading>span{font-family:ui-monospace,Consolas,monospace;color:#334155}.video-range-heading .button{min-height:32px;padding:6px 10px;font-size:11px;gap:7px}
.video-timeline{position:relative;height:86px;margin:0 2px 16px}.video-filmstrip{display:flex;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#141b27 0 8px,#080d16 8px 16px)}.video-filmstrip button{min-width:0;flex:1;padding:0;border:0;background:transparent;cursor:pointer}.video-filmstrip img{width:100%;height:100%;object-fit:cover;display:block}
.trim-outline{position:absolute;inset:0 var(--trim-end) 0 var(--trim-start);border:3px solid var(--accent);pointer-events:none}.trim-shade{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(45deg,#0f172ac9 0 7px,#1e293bc9 7px 14px);pointer-events:none}.trim-shade-start{left:0;width:var(--trim-start)}.trim-shade-end{right:0;width:var(--trim-end)}
.trim-input{position:absolute;top:0;left:-7px;width:calc(100% + 14px);height:100%;margin:0;appearance:none;background:transparent;pointer-events:none;outline:none!important}.trim-input::-webkit-slider-runnable-track{background:transparent}.trim-input::-moz-range-track{background:transparent}.trim-input::-webkit-slider-thumb{appearance:none;width:14px;height:32px;border:3px solid var(--accent);border-radius:5px;background:linear-gradient(90deg,var(--accent) 0 4px,#fff 4px 5px,var(--accent) 5px);box-shadow:0 1px 4px #0f172a30;pointer-events:auto;cursor:ew-resize}.trim-input::-moz-range-thumb{width:9px;height:26px;border:3px solid var(--accent);border-radius:5px;background:#fff;pointer-events:auto;cursor:ew-resize}.trim-input:focus-visible::-webkit-slider-thumb{outline:3px solid #93c5fd;outline-offset:2px}.trim-input:focus-visible::-moz-range-thumb{outline:3px solid #93c5fd;outline-offset:2px}
.video-sampling,.video-manual{border:1px solid #e2e8f0;border-radius:7px;padding:17px 16px;margin:16px 0}.video-sampling h3,.video-manual h3{font-size:13px;font-weight:600;letter-spacing:0;margin-bottom:14px}.sampling-labels{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10px}.sampling-labels span{background:#f1f5f9;padding:2px 4px;border-radius:3px;color:#475569}.sampling-labels strong{background:var(--accent);color:#fff;padding:3px 5px;border-radius:3px;font-weight:600;text-align:center}
.sampling-slider{width:100%;height:4px;margin:20px 0 22px;appearance:none;border-radius:4px;background:#dbeafe;cursor:pointer}.sampling-slider::-webkit-slider-thumb{appearance:none;width:18px;height:18px;border:1px solid #cbd5e1;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0f172a20}.sampling-slider::-moz-range-thumb{width:18px;height:18px;border:1px solid #cbd5e1;border-radius:50%;background:#fff}.sampling-output{display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap;font-size:12px}.sampling-output label{display:flex;align-items:center;gap:6px}.sampling-output input,.sampling-output output{display:inline-block;width:70px;padding:7px;text-align:center;border:1px solid #cbd5e1;border-radius:5px;background:white;color:#334155}.sampling-output output{min-height:32px;margin:0 4px}.sampling-note,.video-error{font-size:11px;line-height:1.6;margin-top:10px}.video-error{color:#b91c1c}.video-extract-actions{display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:18px!important}.video-extract-actions .button{min-height:36px;font-size:12px;padding:8px 14px}
.video-manual{background:#f8fafc;margin-top:10px}.video-frame-actions{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.video-frame-actions .button{padding:6px 8px;min-height:30px;font-size:10px;gap:4px}.video-frame-actions .add-frame{background:#fef3c7;border-color:#fde68a;color:#92400e}.selected-summary{display:flex;gap:8px;font-size:10px;color:#64748b;margin-top:12px;flex-wrap:wrap}.selected-summary strong{color:#334155;font-weight:500}.video-selected{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.video-selected button{padding:5px 7px;border:1px solid #bfdbfe;border-radius:4px;background:#eff6ff;font-size:10px;color:#1d4ed8}.frame-rate-options{font-size:10px;color:#64748b;margin-top:10px}.frame-rate-options summary{cursor:pointer}.frame-rate-options label{display:flex;align-items:center;gap:8px;margin-top:8px}.frame-rate-options input{width:65px;padding:5px;border:1px solid #cbd5e1;border-radius:4px}
@media(max-width:520px){.video-range-heading{gap:6px}.video-range-heading>span{font-size:9px}.video-range-heading .button{font-size:10px;padding:6px}.video-timeline{height:64px}.video-sampling,.video-manual{padding:13px 10px}.sampling-labels{font-size:8px}.sampling-labels>span{max-width:70px;text-align:center}.sampling-output{font-size:11px}.sampling-output input,.sampling-output output{width:50px}.video-extraction{padding-top:15px}}
</style>
<style>
.dialog.video-frames-dialog{width:min(768px,calc(100vw - 32px));max-width:768px;max-height:calc(100dvh - 32px);padding:38px 46px 32px;border:1px solid #e2e8f0;border-radius:9px;box-shadow:0 18px 60px #0f172a30;overflow-y:auto}.dialog.video-frames-dialog::backdrop{background:#0f172a66;backdrop-filter:none}.dialog.video-frames-dialog>header{gap:12px;align-items:center}.dialog.video-frames-dialog>header h2{display:flex;align-items:baseline;gap:7px;min-width:0;font-size:16px;font-weight:600;line-height:1.5;letter-spacing:0}.video-title-file{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.video-duration{font-size:12px;font-weight:400;color:#64748b;white-space:nowrap}.dialog.video-frames-dialog>header .icon-button{width:24px;height:24px;padding:2px;flex-shrink:0;color:#94a3b8}.dialog.format-dialog{width:min(1100px,94vw);max-width:1100px}@media(max-width:520px){.dialog.video-frames-dialog{padding:20px 16px;width:calc(100vw - 20px);max-height:calc(100dvh - 20px)}.dialog.video-frames-dialog>header h2{font-size:13px}}
</style>
