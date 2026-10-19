<script setup>
// A project's Test page: one of its models is sent one photo and what it finds is drawn on it. The model's test server
// (a process on this server) starts only when the person presses Start, stops when they press Stop, and stops by
// itself after a while without a photo. The confidence slider filters the answer here; the model is not asked again.
// Backend: app_api.py test/ and models/<n>/try/… (trials.py) — every step is checked there.
import { computed, onUnmounted, ref, watch } from 'vue';
import { Check, Gauge, Images, Play, Square, Upload, X } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { trialApi, PHOTO_TYPES, VERDICTS, filtered, middle, percent } from '../api/trial.js';

const props = defineProps({ projectRef: { type: String, required: true } });
const emit = defineEmits(['navigate']);
const WALL_COLOURS = ['#2563eb', '#f59e0b', '#12b76a', '#c11574', '#7c3aed', '#0e9384', '#b54708', '#363f72'];
const KIND_COLOUR = { window: '#0ea5e9', door: '#f97316' };

const models = ref(null); const chosen = ref(null); const state = ref(null);
const error = ref(''); const notice = ref(''); const busy = ref(false);
const file = ref(null); const photoUrl = ref(''); const answer = ref(null); const asking = ref(false); const photoError = ref('');
const least = ref(0);

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
watch(() => state.value?.phase, follow);
onUnmounted(() => { alive = false; clearTimeout(timer); if (photoUrl.value) URL.revokeObjectURL(photoUrl.value); });
watch(() => props.projectRef, async () => { chosen.value = null; state.value = null; await loadModels(); }, { immediate: true });
watch(chosen, () => { state.value = null; answer.value = null; notice.value = ''; error.value = ''; loadState(); });

async function act(action) {
  busy.value = true; error.value = ''; notice.value = '';
  try { const now = await trialApi.act(props.projectRef, chosen.value, action); notice.value = now.said; state.value = now; }
  catch (e) { error.value = e.message; await loadState(); } finally { busy.value = false; }
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
  try { answer.value = await trialApi.predict(props.projectRef, chosen.value, picked); }
  catch (e) { photoError.value = e.message; await loadState(); } finally { asking.value = false; }
}

const shown = computed(() => filtered(answer.value, Number(least.value)));
const verdict = computed(() => VERDICTS[answer.value?.status] || ['neutral', answer.value?.status || '', '']);
const box = computed(() => (answer.value ? `0 0 ${answer.value.image.width} ${answer.value.image.height}` : '0 0 1 1'));
const dot = computed(() => (answer.value ? Math.max(answer.value.image.width, answer.value.image.height) / 150 : 1));
const font = computed(() => (answer.value ? Math.max(answer.value.image.width, answer.value.image.height) / 48 : 1));
const pointsOf = points => points.map(p => p.join(',')).join(' ');
const seconds = ms => (ms === null || ms === undefined ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
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
            <p><strong>The test server is ready.</strong> {{ state.trial.photos_tried }} photo{{ state.trial.photos_tried===1?'':'s' }} tried<template v-if="state.trial.started_by"> · started by {{ state.trial.started_by }}</template> at {{ when(state.trial.started_at) }}. It stops by itself after {{ state.idle_minutes }} minutes without a photo.</p>
            <UiButton :disabled="busy" @click="act('stop')"><Square :size="14"/> Stop test server</UiButton>
          </template>
          <template v-else-if="state.phase==='starting'">
            <p class="starting"><span class="spinner" aria-hidden="true"></span><strong>Starting the test server…</strong> It loads the model on this server; this can take a minute.</p>
            <UiButton :disabled="busy" @click="act('stop')"><Square :size="14"/> Stop</UiButton>
          </template>
          <template v-else>
            <p v-if="state.trial?.state==='failed'" class="test-error">The last test server failed: {{ state.trial.failure_reason }}</p>
            <p v-else-if="state.trial?.state==='stopped'&&state.trial.failure_reason" class="test-meta">The last test server stopped: {{ state.trial.failure_reason }}</p>
            <p>To try a photo, the model needs its test server: a process on this server. Nothing starts until you press Start; starting it stops any other test server of this project, and it stops by itself after {{ state.idle_minutes }} minutes without a photo.</p>
            <p v-if="state.refused" class="test-error">{{ state.refused }}</p>
            <UiButton variant="primary" :disabled="busy||!state.may.start" @click="act('start')"><Play :size="14"/> Start test server</UiButton>
          </template>
          <p v-if="state?.staging_down" class="test-meta">Its staging endpoint is not answering and is being started again.</p>
        </div>

        <label class="test-input" :class="{off:!ready}">
          <Upload :size="28"/>
          <strong>{{ asking ? 'Asking the model…' : file ? 'Choose another photo' : 'Choose a photo' }}</strong>
          <span>JPEG, PNG or WebP · up to {{ state?.max_mb || 15 }} MB · one photo at a time. The photo is not kept.</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="!ready||asking" aria-label="Choose a photo to test" @change="choose">
        </label>
        <p v-if="!ready&&state" class="test-meta">Start the test server first.</p>
        <p v-if="photoError" class="field-error" role="alert">{{ photoError }}</p>

        <label class="field-label">Show what reaches {{ percent(Number(least)) }} confidence
          <input v-model="least" type="range" min="0" max="1" step="0.05" aria-label="Confidence threshold"></label>
        <p class="test-meta">This filters the answer on this page; the model is not asked again.</p>
      </section>

      <section class="panel">
        <h2>Prediction results</h2>
        <div v-if="!answer" class="empty-state">
          <Images :size="40"/>
          <h3>{{ asking ? 'The model is looking at the photo…' : 'Ready when you are' }}</h3>
          <p>{{ asking ? 'This can take a few seconds on this server.' : 'Start the test server and choose a photo: what the model finds is drawn on it.' }}</p>
        </div>
        <template v-else>
          <p class="verdict"><UiBadge :tone="verdict[0]">{{ verdict[1] }}</UiBadge><span>{{ verdict[2] }}</span></p>
          <div class="stage">
            <img :src="photoUrl" alt="The photo you chose, with what the model found drawn on it">
            <svg :viewBox="box" preserveAspectRatio="none" aria-hidden="true">
              <g v-for="(wall, i) in shown.walls" :key="'w'+i">
                <polygon :points="pointsOf(wall.corners)" :fill="WALL_COLOURS[i%WALL_COLOURS.length]" fill-opacity=".18" :stroke="WALL_COLOURS[i%WALL_COLOURS.length]" stroke-width="3" vector-effect="non-scaling-stroke" :stroke-dasharray="wall.below_threshold?'8 6':null"/>
                <circle v-for="(c, j) in wall.corners" :key="j" :cx="c[0]" :cy="c[1]" :r="dot" fill="#fff" :stroke="WALL_COLOURS[i%WALL_COLOURS.length]" stroke-width="2" vector-effect="non-scaling-stroke"/>
                <text :x="middle(wall.corners)[0]" :y="middle(wall.corners)[1]" :font-size="font" text-anchor="middle" fill="#fff" stroke="#162139" stroke-width="3" paint-order="stroke" vector-effect="non-scaling-stroke">Wall {{ i+1 }} · {{ percent(wall.confidence) }}</text>
              </g>
              <polygon v-for="(o, i) in shown.openings" :key="'o'+i" :points="pointsOf(o.polygon)" fill="none" :stroke="KIND_COLOUR[o.type]||'#0ea5e9'" stroke-width="3" vector-effect="non-scaling-stroke"/>
            </svg>
          </div>
          <dl class="facts">
            <div><dt>Walls</dt><dd>{{ shown.walls.length }}</dd></div>
            <div><dt>Windows and doors</dt><dd>{{ shown.openings.length }}</dd></div>
            <div><dt>Model time</dt><dd>{{ seconds(answer.timing_ms?.model) }}</dd></div>
            <div><dt>Whole answer</dt><dd>{{ seconds(answer.timing_ms?.total) }}</dd></div>
          </dl>
          <p v-if="shown.hidden" class="test-meta">{{ shown.hidden }} found below {{ percent(Number(least)) }} {{ shown.hidden===1?'is':'are' }} hidden by the slider.</p>
          <div v-if="shown.walls.length||shown.openings.length" class="table-wrap">
            <table><thead><tr><th>Found</th><th>Confidence</th><th>Corners</th></tr></thead>
              <tbody>
                <tr v-for="(wall, i) in shown.walls" :key="'w'+i"><td><span class="swatch" :style="{background:WALL_COLOURS[i%WALL_COLOURS.length]}"></span>Wall {{ i+1 }}{{ wall.below_threshold ? ' (not sure)' : '' }}</td><td>{{ percent(wall.confidence) }}</td><td>{{ wall.corners.length }}</td></tr>
                <tr v-for="(o, i) in shown.openings" :key="'o'+i"><td><span class="swatch" :style="{background:KIND_COLOUR[o.type]||'#0ea5e9'}"></span>{{ o.type==='door' ? 'Door' : 'Window' }}</td><td>{{ percent(o.confidence) }}</td><td>{{ o.polygon.length }}</td></tr>
              </tbody></table>
          </div>
          <p v-if="answer.warnings?.length" class="test-meta">Notes from the model: {{ answer.warnings.join(', ') }}.</p>
          <p class="test-meta">Answered by {{ answer.model?.name }} {{ answer.model?.version }} on its {{ answer.served_by==='staging' ? 'staging endpoint' : 'test server' }}.</p>
          <details class="json"><summary>The answer as shown (JSON{{ shown.hidden ? ', filtered by the slider' : '' }})</summary><pre>{{ JSON.stringify({ ...shown, hidden: undefined }, null, 2) }}</pre></details>
        </template>
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
.verdict{display:flex;align-items:center;gap:10px;font-size:12px;margin:0 0 12px}
.stage{position:relative;line-height:0;border-radius:8px;overflow:hidden;background:#f6f7f9}
.stage img{width:100%;height:auto;display:block}
.stage svg{position:absolute;inset:0;width:100%;height:100%}
.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}
.facts>div{border:1px solid #e6e8ee;border-radius:7px;padding:8px 10px}
.facts dt{font-size:11px;color:#6d7c92}
.facts dd{margin:4px 0 0;font-size:15px;font-weight:600}
.swatch{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;vertical-align:middle}
.json summary{cursor:pointer;font-size:12px;color:var(--aadml-primary);margin-top:12px}
.json pre{max-height:320px;overflow:auto;background:#f8f9fb;border-radius:7px;padding:12px}
.badge--amber{color:#93610b;background:#fff4dc}
@media(max-width:900px){.test-layout{grid-template-columns:1fr}.facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
