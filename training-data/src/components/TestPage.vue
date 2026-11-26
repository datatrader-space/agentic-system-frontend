<script setup>
// A project's Test page: one of its models is sent one photo and what it finds is drawn on it. The model's test server
// (a process on this server) starts only when the person presses Start, stops when they press Stop, and stops by
// itself after a while without a photo. The confidence slider filters the answer here; the model is not asked again.
// Backend: app_api.py test/ and models/<n>/try/… (trials.py) — every step is checked there.
import { computed, onUnmounted, ref, watch } from 'vue';
import { Check, Gauge, Play, Square, Upload, X } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import MachinePicker from './MachinePicker.vue';
import DownloadBar from './DownloadBar.vue';
import PredictionResult from './PredictionResult.vue';
import PipelineResult from './PipelineResult.vue';
import { isLoraModel, loraBody, loraMedia, LORA_SCALE, tryGenerateApi } from '../api/anyModel.js';
import { generateBody, makesVideo, needsPhoto, SIZE_PRESETS, VIDEO_SECONDS, VIDEO_FPS } from '../api/workspace.js';
import { trialApi, PHOTO_TYPES, percent, confidenceFloor } from '../api/trial.js';
import { unanswered } from '../api/models.js';

const props = defineProps({ projectRef: { type: String, required: true } });
const emit = defineEmits(['navigate']);

const models = ref(null); const chosen = ref(null); const state = ref(null);
// The GPU and location the test server starts on (MachinePicker); the server reads the choice again.
const machine = ref('');
const picker = ref(null);
const startOn = () => (picker.value ? picker.value.confirm(() => act('start')) : act('start'));
const loadMachines = computed(() => { const ref_ = props.projectRef, number = chosen.value; return () => trialApi.machines(ref_, number); });
const error = ref(''); const notice = ref(''); const busy = ref(false);
const file = ref(null); const photoUrl = ref(''); const answer = ref(null); const asking = ref(false); const photoError = ref('');
const least = ref(0);
// The slider starts at the least confidence the model sends back (trial.js confidenceFloor).
const floor = computed(() => confidenceFloor(state.value));
watch(floor, f => { if (Number(least.value) < f) least.value = f; }, { immediate: true });

async function loadModels() {
  try {
    models.value = (await trialApi.models(props.projectRef)).models;
    if (!models.value.some(m => m.number === chosen.value)) chosen.value = models.value[0]?.number ?? null;
  } catch (e) { error.value = e.message; models.value = []; }
}
async function loadState() {
  if (chosen.value === null) { state.value = null; return; }
  const asked = chosen.value;
  try { const now = await trialApi.state(props.projectRef, asked); if (asked === chosen.value) state.value = now; } catch (e) { error.value = e.message; }
}
// A test server that is starting is asked about again, 3 s after each answer, until it is ready (or failed). Asking
// only after the answer came back keeps a slow server from piling requests up.
let timer = null; let alive = true;
function follow() { clearTimeout(timer); timer = alive && state.value?.phase === 'starting' ? setTimeout(async () => { await loadState(); follow(); }, 3000) : null; }
watch(() => state.value?.phase, (phase, before) => { if (before === 'starting' && phase !== 'starting') notice.value = ''; follow(); });   // "is starting" is over
onUnmounted(() => { alive = false; clearTimeout(timer); if (photoUrl.value) URL.revokeObjectURL(photoUrl.value); });
watch(() => props.projectRef, async () => { chosen.value = null; state.value = null; await loadModels(); }, { immediate: true });
watch(chosen, () => { state.value = null; answer.value = null; notice.value = ''; error.value = ''; actError.value = ''; loadState(); });

const acting = ref('');
// A start or stop refused is said under the button that was pressed (live, 2026-11-18: "The vision-serve image of
// this code is not built yet" was only at the top of the page, out of sight, so Start seemed to do nothing).
const actError = ref('');
async function act(action) {
  busy.value = true; acting.value = action; error.value = ''; actError.value = ''; notice.value = '';
  try { const now = await trialApi.act(props.projectRef, chosen.value, action, action === 'start' ? machine.value : ''); notice.value = now.said; state.value = now; }
  catch (e) {
    // No answer is not a refusal: the test server may be starting. The page reads it again and says so.
    actError.value = unanswered(e) ? 'No answer came back in time, so the page read the test server again: check below whether it is starting before you press Start again.' : e.message;
    await loadState();
  } finally { busy.value = false; acting.value = ''; }
}

const model = computed(() => (models.value || []).find(m => m.number === chosen.value) || null);
const ready = computed(() => state.value?.phase === 'ready');
async function choose(event) {
  const picked = event.target.files?.[0]; event.target.value = '';
  photoError.value = '';
  if (!picked) return;
  if (!PHOTO_TYPES.includes(picked.type)) { photoError.value = 'Choose a JPEG, PNG or WebP photo.'; return; }
  if (picked.size > (state.value?.max_mb || 15) * 1024 * 1024) { photoError.value = `The photo is larger than ${state.value?.max_mb || 15} MB.`; return; }
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value);
  file.value = picked; photoUrl.value = URL.createObjectURL(picked); answer.value = null;
  asking.value = true;
  try { answer.value = await trialApi.predict(props.projectRef, chosen.value, picked); loadState(); }   // the count of photos tried includes this one
  catch (e) { photoError.value = e.message; await loadState(); } finally { asking.value = false; }
}

// ── a generation model's LoRA (served_form diffusers-lora; ADM-1365): asked with a prompt on the person's own machine,
// with how strongly the LoRA counts (``lora_scale``, 0 to 2). The answer is the machine's own (base64 PNG or MP4),
// shown as it came (anyModel.loraMedia); nothing asked or made is kept. ``served_form`` and ``task`` on the test/ list or
// the try state are hooks the backend fills; a model without them is tried with a photo as before.
const lora = computed(() => isLoraModel(model.value) || isLoraModel(state.value));
const loraTask = computed(() => model.value?.task || state.value?.task || 'text-to-image');
const isVideo = computed(() => makesVideo(loraTask.value));
const gen = ref({ prompt: '', negative: '', size: 'square', seconds: VIDEO_SECONDS.start, fps: VIDEO_FPS.start, seed: '', scale: LORA_SCALE.start, photo: null });
const sizes = computed(() => SIZE_PRESETS[isVideo.value ? 'video' : 'image']);
watch(isVideo, () => { gen.value.size = sizes.value[0].id; });
const genError = ref(''); const generating = ref(false); const made = ref(null); const genPrompt = ref(''); const genSeconds = ref(0); let genTimer = null;
onUnmounted(() => clearInterval(genTimer));
watch(chosen, () => { made.value = null; genError.value = ''; });
function photoBase64(file) {
  return new Promise((resolve, reject) => {
    if (!PHOTO_TYPES.includes(file.type)) { reject(new Error('Choose a JPEG, PNG or WebP photo.')); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('The photo could not be read.'));
    reader.readAsDataURL(file);
  });
}
async function generate() {
  if (generating.value || !ready.value) return;
  genError.value = '';
  let image = '';
  try { if (needsPhoto(loraTask.value) && gen.value.photo) image = await photoBase64(gen.value.photo); } catch (e) { genError.value = e.message; return; }
  const size = sizes.value.find(item => item.id === gen.value.size) || null;
  const asked = loraBody(generateBody({ ...gen.value, image, size }, loraTask.value), gen.value.scale);
  if (asked.error) { genError.value = asked.error; document.getElementById(`lora-${asked.field}`)?.focus(); return; }
  generating.value = true; genSeconds.value = 0; clearInterval(genTimer); genTimer = setInterval(() => { genSeconds.value += 1; }, 1000);
  const number = chosen.value;
  try {
    const answer = await tryGenerateApi.generate(props.projectRef, number, asked.body);
    if (number !== chosen.value) return;
    made.value = loraMedia(answer); genPrompt.value = asked.body.prompt;
    loadState();
  } catch (e) { if (number === chosen.value) { genError.value = e.message; await loadState(); } }
  finally { clearInterval(genTimer); generating.value = false; }
}

const when = iso => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '');
</script>

<template>
  <div class="test-page">
    <div v-if="notice" class="notice" role="status"><Check :size="16"/><span>{{ notice }}</span><button class="icon-button" aria-label="Dismiss" @click="notice=''"><X :size="14"/></button></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="models===null">Loading…</p>
    <div v-else-if="!models.length" class="model-empty">
      <Gauge :size="42"/><h2>No model to test yet</h2>
      <p>A model can be tested once a training run of this project has made one.</p>
      <UiButton variant="primary" @click="emit('navigate','train')">Train a model</UiButton>
    </div>
    <div v-else class="test-layout">
      <section class="panel">
        <h2>Test a model</h2>
        <label class="field-label">Model
          <select v-model.number="chosen" class="text-input"><option v-for="m in models" :key="m.number" :value="m.number">{{ m.name }} {{ m.version }}{{ m.smoke ? ' · smoke test' : '' }}</option></select></label>
        <p v-if="model?.trains" class="test-meta">{{ model.trains }}</p>

        <div class="server" :class="state?.phase">
          <p v-if="!state" class="test-meta">Looking at its test server…</p>
          <template v-else-if="state.via==='staging'">
            <p><strong>Live on staging.</strong> Photos go to the staging endpoint; no test server is needed.</p>
          </template>
          <template v-else-if="state.phase==='ready'">
            <p v-if="state.machine"><strong>{{ state.machine.label }}.</strong> {{ state.machine.price_text || 'The platform fee for your machine' }}, charged by the second it runs. Each photo you try goes to {{ state.machine.name }} and is not kept.</p>
            <p><strong>The test server is ready.</strong> {{ state.trial.photos_tried }} photo{{ state.trial.photos_tried===1?'':'s' }} tried<template v-if="state.trial.started_by"> · started by {{ state.trial.started_by }}</template> at {{ when(state.trial.started_at) }}. It stops by itself after {{ state.idle_minutes }} minutes without a photo.</p>
            <UiButton :disabled="busy" @click="act('stop')"><Square :size="14"/> {{ acting==='stop' ? 'Stopping…' : 'Stop test server' }}</UiButton>
          </template>
          <template v-else-if="state.phase==='starting'">
            <p v-if="state.machine" class="starting"><span class="spinner" aria-hidden="true"></span><strong>{{ state.machine.label }}…</strong> The first time, {{ state.machine.name }} downloads AADML's model server (a few minutes, once), then the model.</p>
            <DownloadBar v-if="state.machine" :download="state.machine.download"/>
            <p v-else class="starting"><span class="spinner" aria-hidden="true"></span><strong>Starting the test server…</strong> The machine you chose is started and the model is loaded on it. This can take a few minutes; the page follows it.</p>
            <UiButton :disabled="busy" @click="act('stop')"><Square :size="14"/> {{ acting==='stop' ? 'Stopping…' : 'Stop' }}</UiButton>
          </template>
          <template v-else>
            <p v-if="state.trial?.state==='failed'" class="test-error">The last test server failed: {{ state.trial.failure_reason }}</p>
            <p v-else-if="state.trial?.state==='stopped'&&state.trial.failure_reason" class="test-meta">The last test server stopped: {{ state.trial.failure_reason }}</p>
            <p>To try a photo, the model needs its test server, on a GPU you choose below. Nothing starts until you press Start; starting it stops any other test server of this project, and it stops by itself after {{ state.idle_minutes }} minutes without a photo.</p>
            <p v-if="state.refused" class="test-error">{{ state.refused }}</p>
            <MachinePicker v-if="state.may.start" ref="picker" v-model="machine" :load="loadMachines" :disabled="busy"/>
            <UiButton variant="primary" :disabled="busy||!state.may.start||!machine" @click="startOn"><Play :size="14"/> {{ acting==='start' ? 'Starting…' : 'Start test server' }}</UiButton>
            <p v-if="acting==='start'" class="test-meta" role="status">Starting the test server: getting the machine you chose can take 20 to 30 seconds before AADML answers.</p>
          </template>
          <p v-if="actError" class="test-error" role="alert">{{ actError }}</p>
          <p v-if="state?.staging_down" class="test-meta">Its staging endpoint is not answering and is being started again.</p>
        </div>

        <form v-if="lora" class="lora-form" novalidate :aria-busy="generating" data-test="lora-form" @submit.prevent="generate">
          <p class="test-meta">A LoRA of a generation model is tried on one of your own machines with an NVIDIA GPU: choose Your machine above. What you ask and what it makes are not kept.</p>
          <label class="field-label" for="lora-prompt">Prompt<textarea id="lora-prompt" v-model="gen.prompt" class="text-input" rows="3" maxlength="2000" :disabled="!ready" placeholder="Use the trigger words it learnt, e.g. sks mug on a beach at sunset"/></label>
          <label class="field-label" for="lora-negative_prompt">Leave out (optional)<input id="lora-negative_prompt" v-model="gen.negative" class="text-input" maxlength="2000" :disabled="!ready"></label>
          <label v-if="needsPhoto(loraTask)" class="field-label" for="lora-image">Photo to start from<input id="lora-image" type="file" class="text-input" accept="image/jpeg,image/png,image/webp" :disabled="!ready" @change="gen.photo=$event.target.files?.[0]||null"></label>
          <label class="field-label" for="lora-size">Shape<select id="lora-size" v-model="gen.size" class="text-input" :disabled="!ready"><option v-for="z in sizes" :key="z.id" :value="z.id">{{ z.label }}, {{ z.width }} × {{ z.height }}</option></select></label>
          <div v-if="isVideo" class="lora-pair">
            <label class="field-label" for="lora-seconds">Seconds<input id="lora-seconds" v-model.number="gen.seconds" class="text-input" type="number" :min="VIDEO_SECONDS.min" :max="VIDEO_SECONDS.max" :disabled="!ready"></label>
            <label class="field-label" for="lora-fps">Frames a second<input id="lora-fps" v-model.number="gen.fps" class="text-input" type="number" :min="VIDEO_FPS.min" :max="VIDEO_FPS.max" :disabled="!ready"></label>
          </div>
          <label class="field-label" for="lora-seed">Seed (optional)<input id="lora-seed" v-model="gen.seed" class="text-input" type="number" min="0" inputmode="numeric" :disabled="!ready"></label>
          <label class="field-label" for="lora-lora_scale">How strongly the LoRA counts: {{ Number(gen.scale).toFixed(2) }}
            <input id="lora-lora_scale" v-model.number="gen.scale" type="range" :min="LORA_SCALE.min" :max="LORA_SCALE.max" :step="LORA_SCALE.step" :disabled="!ready" :aria-valuetext="`${Number(gen.scale).toFixed(2)}: 0 is the base model alone, 1 the LoRA as trained, 2 twice as strong`"></label>
          <p class="test-meta">0 is the base model alone, 1 the LoRA as it was trained, 2 twice as strong.</p>
          <p v-if="genError" class="field-error" role="alert">{{ genError }}</p>
          <UiButton type="submit" variant="primary" :disabled="!ready||generating"><Play :size="14" aria-hidden="true"/> {{ generating ? 'Making it…' : isVideo ? 'Make the video' : 'Make the image' }}</UiButton>
          <p v-if="!ready&&state" class="test-meta">Start the test server first.</p>
        </form>
        <template v-else>
        <label class="test-input" :class="{off:!ready}">
          <Upload :size="28"/>
          <strong>{{ asking ? 'Asking the model…' : file ? 'Choose another photo' : 'Choose a photo' }}</strong>
          <span>JPEG, PNG or WebP · up to {{ state?.max_mb || 15 }} MB · one photo at a time. The photo is not kept.</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="!ready||asking" aria-label="Choose a photo to test" @change="choose">
        </label>
        <p v-if="!ready&&state" class="test-meta">Start the test server first.</p>
        <p v-if="photoError" class="field-error" role="alert">{{ photoError }}</p>

        <label class="field-label">Show what reaches {{ percent(Number(least)) }} confidence
          <input v-model="least" type="range" :min="floor" max="1" step="0.05" aria-label="Confidence threshold"></label>
        <p class="test-meta">This filters the answer on this page; the model is not asked again.<template v-if="floor"> The model sends back only what reaches {{ percent(floor) }}, so the slider starts there.</template></p>
        </template>
      </section>

      <section class="panel">
        <h2>{{ lora ? 'What it made' : 'Prediction results' }}</h2>
        <div v-if="lora" class="lora-result" aria-live="polite" data-test="lora-result">
          <p v-if="generating" class="test-meta" role="status">{{ isVideo ? `Making the video on your machine… this can take a few minutes (${genSeconds} s so far).` : `Making the image on your machine… (${genSeconds} s so far)` }}</p>
          <template v-else-if="made && (made.images.length || made.video)">
            <figure v-if="made.video" class="lora-media"><video :src="made.video.url" controls playsinline preload="metadata" :width="made.video.width" :height="made.video.height" :aria-label="`The video made from: ${genPrompt}`"></video>
              <figcaption>{{ made.video.seconds ? `${made.video.seconds} s` : '' }}{{ made.video.fps ? ` at ${made.video.fps} frames a second` : '' }}</figcaption></figure>
            <figure v-for="(img, i) in made.images" :key="i" class="lora-media"><img :src="img.url" :width="img.width" :height="img.height" :alt="`Image ${i + 1} made from: ${genPrompt}`"></figure>
            <p v-if="made.seed !== null" class="test-meta">Seed {{ made.seed }}</p>
          </template>
          <p v-else-if="made" class="test-error">The machine answered, but with no image or video this page can show.</p>
          <p v-else class="test-meta">Write a prompt and make {{ isVideo ? 'a video' : 'an image' }}: what the LoRA makes is shown here.</p>
        </div>
        <PipelineResult v-else-if="answer?.hf_task" :answer="answer" :photo-url="photoUrl"/>
        <PredictionResult v-else :answer="answer" :photo-url="photoUrl" :asking="asking" :least="Number(least)"/>
      </section>
    </div>
  </div>
</template>

<style scoped>
.test-meta{font-size:12px!important;color:#6d7c92!important;margin:6px 0!important}
.test-error{font-size:12px!important;color:#b42318!important;margin:6px 0!important}
.server{border:1px solid #e3e6ed;border-radius:8px;padding:14px 16px;margin:16px 0;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.server.ready{border-color:#b9e3cf;background:#f3fbf7}
.server.starting{border-color:var(--aadml-outline);background:var(--aadml-tint)}
.server p{margin:0;font-size:12px;line-height:1.6}
.starting{display:flex;align-items:center;gap:8px}
.spinner{width:14px;height:14px;border-radius:50%;border:2px solid var(--aadml-soft);border-top-color:var(--aadml-primary);animation:spin 1s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
.test-input{position:relative;cursor:pointer;margin:10px 0}
.test-input.off{opacity:.5;cursor:not-allowed}
.test-input input{position:absolute;inset:0;opacity:0;cursor:inherit}
.test-input span{font-size:11px;color:#6d7c92}
@media(max-width:900px){.test-layout{grid-template-columns:1fr}}
.lora-form{display:grid;gap:4px;margin-top:10px}
.lora-form .text-input{min-height:44px}
.lora-form :deep(.button){min-height:44px;justify-self:start}
.lora-form input[type=range]{width:100%;min-height:44px;accent-color:var(--aadml-focus)}
.lora-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lora-media{margin:0 0 12px}
.lora-media img,.lora-media video{width:100%;height:auto;border-radius:8px;background:#f6f7f9;display:block}
.lora-media figcaption{font-size:12px;color:#4b5565;margin-top:4px}
@media(max-width:550px){.lora-pair{grid-template-columns:1fr}}
</style>
