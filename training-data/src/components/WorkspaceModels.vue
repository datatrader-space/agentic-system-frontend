<script setup>
// The workspace's Models page: the models trained in its projects (a Labeller's projects are left out), the published
// models with trying one as it is published, and how often each project's deployed model was called. Every rule is
// the backend's (app_api.py workspace/models/, published/<key>/…, workspace/deployments/).
import { computed, onUnmounted, ref, watch } from 'vue';
import { Boxes, Box, WandSparkles, ChartNoAxesCombined, Plus, Upload, Search, Play, Square, X, Check } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import PredictionResult from './PredictionResult.vue';
import { catalogue } from '../api/models.js';
import { PHOTO_TYPES, percent } from '../api/trial.js';
import { workspaceApi, publishedApi, projectLink, trySteps, modelName, timeAgo } from '../api/workspace.js';

const emit = defineEmits(['create', 'navigate']);
const tabs = [{ name: 'My models', icon: Boxes }, { name: 'Open source models', icon: WandSparkles }, { name: 'Usage', icon: ChartNoAxesCombined }];
const active = ref('My models');
const data = ref(null); const error = ref('');
const words = ref(''); const project = ref(''); const kindFilter = ref('');

async function load() {
  try { data.value = await workspaceApi.models(); error.value = ''; }
  catch (e) { error.value = e.message; data.value = data.value || { models: [], catalogue: [], may: { try: false } }; }
}
load();

const projects = computed(() => [...new Map((data.value?.models || []).map(m => [m.project.ref, m.project.name])).entries()]);
const models = computed(() => (data.value?.models || []).filter(m => (!project.value || m.project.ref === project.value)
  && `${m.name} ${m.version} ${m.project.name} ${m.trains}`.toLowerCase().includes(words.value.trim().toLowerCase())));
const kinds = computed(() => [...new Set(catalogue(data.value?.catalogue).map(row => row.kind))]);
const shown = computed(() => catalogue(data.value?.catalogue, words.value, kindFilter.value));
const day = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
watch(active, () => { words.value = ''; kindFilter.value = ''; project.value = ''; if (active.value === 'Usage' && !usage.value) loadUsage(); });

// ── trying a published model ─────────────────────────────────────────────────────────────────────
const trying = ref(null); const state = ref(null); const busy = ref(false); const said = ref(''); const tryError = ref('');
const file = ref(null); const photoUrl = ref(''); const answer = ref(null); const asking = ref(false); const least = ref(0);
const steps = computed(() => trySteps(state.value));
async function loadState() {
  const key = trying.value?.key;
  if (!key) return;
  try { const now = await publishedApi.state(key); if (trying.value?.key === key) state.value = now; } catch (e) { tryError.value = e.message; }
}
// While it is being made ready or its test server starts, it is asked about again 3 s after each answer.
let timer = null; let alive = true;
function follow() { clearTimeout(timer); timer = alive && ['preparing', 'starting'].includes(state.value?.phase) ? setTimeout(async () => { await loadState(); follow(); }, 3000) : null; }
// What an action said stays while the model is where the action left it: "is starting" goes once it is ready.
let saidFor = '';
watch(() => state.value?.phase, now => { follow(); if (said.value && now !== saidFor) said.value = ''; });
function forget() { if (photoUrl.value) URL.revokeObjectURL(photoUrl.value); photoUrl.value = ''; file.value = null; answer.value = null; }
onUnmounted(() => { alive = false; clearTimeout(timer); forget(); });
function startTrying(row) {
  forget(); trying.value = row; state.value = null; said.value = ''; tryError.value = ''; least.value = 0; loadState();
  const calm = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => document.getElementById('try-published')?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }));
}
function close() { trying.value = null; state.value = null; clearTimeout(timer); forget(); load(); }
async function act(action) {
  busy.value = true; tryError.value = ''; said.value = '';
  try { const now = await publishedApi.act(trying.value.key, action); said.value = now.said; saidFor = now.phase; state.value = now; }
  catch (e) { tryError.value = e.message; await loadState(); } finally { busy.value = false; }
}
async function choose(event) {
  const picked = event.target.files?.[0]; event.target.value = '';
  tryError.value = '';
  if (!picked) return;
  if (!PHOTO_TYPES.includes(picked.type)) { tryError.value = 'Choose a JPEG, PNG or WebP photo.'; return; }
  if (picked.size > (state.value?.max_mb || 15) * 1024 * 1024) { tryError.value = `The photo is larger than ${state.value?.max_mb || 15} MB.`; return; }
  forget(); file.value = picked; photoUrl.value = URL.createObjectURL(picked);
  asking.value = true;
  try { answer.value = await publishedApi.predict(trying.value.key, picked); }
  catch (e) { tryError.value = e.message; await loadState(); } finally { asking.value = false; }
}
const ready = computed(() => state.value?.phase === 'ready');
function publishedBadge(row) {
  const now = row.published?.state;
  return now === 'ready' ? ['green', 'Ready to try'] : now === 'preparing' ? ['purple', 'Being made ready'] : now === 'failed' ? ['amber', 'Making it ready failed'] : null;
}

// ── usage of the deployed models ─────────────────────────────────────────────────────────────────
const usage = ref(null); const usageError = ref('');
async function loadUsage() {
  try { usage.value = (await workspaceApi.deployments()).projects.filter(row => row.deployed || row.usage); usageError.value = ''; }
  catch (e) { usageError.value = e.message; usage.value = usage.value || []; }
}
const liveModels = row => row.environments.filter(e => e.live).map(e => `${e.label}: ${modelName(e.live.model)}`);
</script>

<template>
  <div class="models-workspace studio">
    <nav class="models-tabs" aria-label="Models views"><button v-for="item in tabs" :key="item.name" :aria-pressed="active===item.name" @click="active=item.name"><component :is="item.icon" :size="17"/>{{ item.name }}</button></nav>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <template v-if="active==='My models'">
      <p v-if="!data" class="models-loading">Loading models…</p>
      <section v-else-if="!data.models.length" class="models-empty">
        <span class="models-empty-icon"><Boxes :size="34"/></span>
        <h2>No trained models yet</h2>
        <p>A model is trained in a project from a frozen dataset version.<br class="wide-only"> Every model trained in a project you can see is listed here.</p>
        <div class="models-actions"><UiButton variant="primary" @click="emit('create')"><Plus :size="17"/>Create a project</UiButton><UiButton disabled title="Coming soon"><Upload :size="16"/>Upload weights · Coming soon</UiButton></div>
      </section>
      <template v-else>
        <div class="studio-actions">
          <div class="search-field"><Search :size="16"/><input v-model="words" aria-label="Search models" placeholder="Search models…"></div>
          <select v-model="project" class="compact-select" aria-label="Project"><option value="">All projects</option><option v-for="[ref, name] in projects" :key="ref" :value="ref">{{ name }}</option></select>
          <UiButton disabled title="Coming soon"><Upload :size="15"/>Upload weights · Coming soon</UiButton>
        </div>
        <div class="table-wrap">
          <table class="ws-table">
            <thead><tr><th>Model</th><th>Project</th><th>State</th><th>Answers in</th><th>Trained</th><th><span class="sr-only">Open</span></th></tr></thead>
            <tbody>
              <tr v-for="m in models" :key="`${m.project.ref}-${m.number}`">
                <td data-label="Model"><strong>{{ m.name }} {{ m.version }}</strong> <UiBadge v-if="m.smoke">Smoke test</UiBadge><small v-if="m.trains">{{ m.trains }}</small></td>
                <td data-label="Project">{{ m.project.name }}</td>
                <td data-label="State"><UiBadge :tone="m.state==='rejected'?'neutral':'green'">{{ m.state_label }}</UiBadge></td>
                <td data-label="Answers in"><template v-if="m.live_in.length"><UiBadge v-for="env in m.live_in" :key="env" tone="purple">{{ env === 'production' ? 'Production' : 'Staging' }}</UiBadge></template><span v-else class="muted">Not deployed</span></td>
                <td data-label="Trained">{{ day(m.created_at) }}</td>
                <td class="row-actions"><a class="button" :href="projectLink(m.project.ref,'models')">Open</a><a v-if="m.may.try" class="button" :href="projectLink(m.project.ref,'test')">Test</a></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!models.length" class="muted">No model matches your search.</p>
        <p v-if="data.models.length>=data.shown" class="muted">The newest {{ data.shown }} models are shown.</p>
      </template>
    </template>

    <template v-else-if="active==='Open source models'">
      <section v-if="trying" id="try-published" class="panel try-panel" aria-live="polite">
        <header class="try-head"><div><h2>Try {{ trying.name }} as it is published</h2><p>No training here first: the published model answers your photo. It marks walls, windows and doors.</p></div>
          <button class="icon-button" aria-label="Close trying this model" @click="close"><X :size="18"/></button></header>
        <div v-if="said" class="notice" role="status"><Check :size="16"/><span>{{ said }}</span></div>
        <p v-if="tryError" class="field-error" role="alert">{{ tryError }}</p>
        <div class="try-layout">
          <div>
            <ol class="try-steps">
              <li v-for="(step, i) in steps" :key="step.key" :class="step.state">
                <span class="step-mark" aria-hidden="true"><Check v-if="step.state==='done'" :size="14"/><template v-else>{{ i + 1 }}</template></span>
                <div><strong>{{ step.label }}</strong><small>{{ step.state==='failed' ? 'Making it ready failed.' : step.hint }}</small></div>
              </li>
            </ol>
            <p v-if="!state" class="muted">Looking at where it stands…</p>
            <template v-else>
              <p v-if="state.phase==='preparing'||state.phase==='starting'" class="waiting"><span class="spinner" aria-hidden="true"></span>{{ state.phase==='preparing' ? 'Being made ready' : 'Its test server is starting' }}<template v-if="state.since"> since {{ timeAgo(state.since) }}</template>.</p>
              <p v-if="state.phase==='failed'&&state.published?.failure_reason" class="field-error">{{ state.published.failure_reason }}</p>
              <details v-if="state.log" class="json"><summary>The end of its log</summary><pre>{{ state.log }}</pre></details>
              <p v-if="state.refused" class="field-error">{{ state.refused }}</p>
              <p v-if="ready" class="muted">Its test server is ready. {{ state.trial?.photos_tried || 0 }} photo{{ state.trial?.photos_tried===1?'':'s' }} tried. It stops by itself after {{ state.idle_minutes }} minutes without a photo.</p>
              <div class="try-actions">
                <UiButton v-if="state.may.start" variant="primary" :disabled="busy" @click="act('start')"><Play :size="14"/> {{ state.published?.state==='ready' ? 'Start its test server' : 'Make it ready and start' }}</UiButton>
                <UiButton v-if="state.may.stop" :disabled="busy" @click="act('stop')"><Square :size="14"/> Stop its test server</UiButton>
              </div>
              <label class="test-input" :class="{off:!ready}">
                <Upload :size="26"/>
                <strong>{{ asking ? 'Asking the model…' : file ? 'Choose another photo' : 'Choose a photo' }}</strong>
                <span>JPEG, PNG or WebP, up to {{ state.max_mb }} MB, one at a time. The photo is not kept.</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="!ready||asking" aria-label="Choose a photo to try" @change="choose">
              </label>
              <label class="field-label">Show what reaches {{ percent(Number(least)) }} confidence
                <input v-model="least" type="range" min="0" max="1" step="0.05" aria-label="Confidence threshold"></label>
            </template>
          </div>
          <div><PredictionResult :answer="answer" :photo-url="photoUrl" :asking="asking" :least="Number(least)" waiting-text="Once its test server is ready, choose a photo: what the model finds is drawn on it."/></div>
        </div>
      </section>
      <div class="studio-actions">
        <div class="search-field"><Search :size="16"/><input v-model="words" aria-label="Search models" placeholder="Search models…"></div>
        <select v-model="kindFilter" class="compact-select" aria-label="Model task"><option value="">All tasks</option><option v-for="k in kinds" :key="k" :value="k">{{ k }}</option></select>
      </div>
      <p v-if="!data" class="models-loading">Loading models…</p>
      <div v-else class="model-catalog">
        <article v-for="row in shown" :key="row.name" class="panel catalog-card">
          <div class="catalog-head"><Box :size="22"/><UiBadge>{{ row.kind }}</UiBadge><UiBadge v-if="row.coming" tone="purple">Coming soon</UiBadge><UiBadge v-if="publishedBadge(row)" :tone="publishedBadge(row)[0]">{{ publishedBadge(row)[1] }}</UiBadge></div>
          <h3>{{ row.name }}</h3>
          <p class="model-meta">{{ row.publisher }}<template v-if="row.licence">. {{ row.licence }}</template></p>
          <p>{{ row.description }}</p>
          <p v-if="row.coming&&!row.soon" class="model-meta">{{ row.why_not }}</p>
          <div class="catalog-tags">
            <UiBadge v-if="row.trainable" tone="green">Can be trained here</UiBadge>
            <UiBadge v-if="row.tried_as_published" tone="green">Can be tried as published</UiBadge>
            <UiBadge v-if="row.research_only">Research or evaluation use only</UiBadge>
          </div>
          <p v-if="row.tried_as_published&&row.not_tried" class="model-meta">{{ row.not_tried }}</p>
          <UiButton v-if="row.tried_as_published" :disabled="!data.may.try||!!row.not_tried" :title="!data.may.try ? 'Your role in this workspace reads only: it starts nothing.' : ''" @click="startTrying(row)"><Play :size="14"/> Try it</UiButton>
          <UiButton v-else-if="row.trainable" @click="emit('navigate','projects')">Train it in a project</UiButton>
          <UiButton v-else disabled>Coming soon</UiButton>
        </article>
      </div>
      <p v-if="data&&!shown.length" class="muted">No models match your selection.</p>
      <p v-if="data&&!data.may.try" class="muted">Your role in this workspace reads only, so it starts no model here.</p>
    </template>

    <template v-else>
      <p class="muted intro">Calls to each project's deployed model in the last 7 days. A project's own Models page has the full usage by app, environment and model version.</p>
      <p v-if="usageError" class="field-error" role="alert">{{ usageError }}</p>
      <p v-if="!usage" class="models-loading">Loading usage…</p>
      <section v-else-if="!usage.length" class="models-empty">
        <span class="models-empty-icon"><ChartNoAxesCombined :size="34"/></span>
        <h2>No model is deployed yet</h2>
        <p>Calls appear here once an app asks a project's deployed model for predictions.</p>
      </section>
      <div v-else class="table-wrap">
        <table class="ws-table">
          <thead><tr><th>Project</th><th>Answering now</th><th>Calls</th><th>Answered</th><th>Last call</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>
            <tr v-for="row in usage" :key="row.project.ref">
              <td data-label="Project"><strong>{{ row.project.name }}</strong></td>
              <td data-label="Answering now"><template v-if="liveModels(row).length"><span v-for="line in liveModels(row)" :key="line" class="line">{{ line }}</span></template><span v-else class="muted">Nothing live</span></td>
              <td data-label="Calls">{{ row.usage?.calls ?? 0 }}</td>
              <td data-label="Answered">{{ row.usage ? `${row.usage.answered} (${Math.round(100 * row.usage.answered / row.usage.calls)}%)` : '—' }}</td>
              <td data-label="Last call">{{ row.usage ? timeAgo(row.usage.last) : '—' }}</td>
              <td class="row-actions"><a class="button" :href="projectLink(row.project.ref,'models')">Open usage</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.models-workspace{color:#152237}
.models-tabs{display:flex;gap:16px;border-bottom:1px solid #e1e4ec;margin-bottom:22px}
.models-tabs button{display:flex;align-items:center;gap:8px;background:none;border:0;border-bottom:2px solid transparent;padding:14px 16px;color:#5f6d82;font-size:14px}
.models-tabs button[aria-pressed=true]{color:var(--aadml-primary);border-bottom-color:var(--aadml-primary)}
.models-tabs button:focus-visible{outline:2px solid var(--aadml-outline);outline-offset:2px}
.models-empty{min-height:340px;border:1px solid var(--aadml-outline);border-radius:7px;background:radial-gradient(ellipse at 60% 0,var(--aadml-soft) 0,transparent 55%),linear-gradient(30deg,#e1eafa,#fff 55%,var(--aadml-tint));display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:42px 24px;gap:18px;margin-bottom:30px}
.models-empty-icon{width:80px;height:80px;border:1px dashed var(--aadml-outline);color:var(--aadml-focus);display:grid;place-items:center;border-radius:8px}
.models-empty h2{font-size:24px;letter-spacing:-.4px}
.models-empty p{font-size:14px;line-height:1.6}
.models-actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.models-loading,.muted{font-size:12px!important;color:#5f6d82!important}
.intro{margin:0 0 16px!important}
.compact-select{padding:9px 12px!important;font-size:12px}
.ws-table td{vertical-align:top;font-size:13px}
.ws-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:4px;max-width:420px}
.ws-table td .badge{margin-right:4px}
.ws-table .line{display:block}
.row-actions{white-space:nowrap;text-align:right}
.row-actions .button{min-height:32px;padding:6px 12px;margin-left:6px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.catalog-card{display:flex;flex-direction:column;gap:6px}
.catalog-card h3{margin:6px 0 0}
.catalog-card>p{min-height:0!important;margin:0!important}
.catalog-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.catalog-head>svg{color:var(--aadml-focus)}
.catalog-tags{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
.catalog-card .button{margin-top:auto}
.model-meta{font-size:12px!important;color:#5f6d82!important}
.badge--amber{color:#93610b;background:#fff4dc}
.try-panel{margin-bottom:26px;border-color:var(--aadml-outline)}
.try-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}
.try-head h2{margin:0 0 6px!important}
.try-head p{margin:0;font-size:13px}
.try-layout{display:grid;grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:28px}
.try-steps{list-style:none;padding:0;margin:0 0 16px;display:flex;flex-direction:column;gap:2px}
.try-steps li{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #eef0f4}
.try-steps li:last-child{border-bottom:0}
.try-steps strong{display:block;font-size:13px}
.try-steps small{display:block;font-size:12px;color:#5f6d82;line-height:1.5;margin-top:3px}
.step-mark{flex-shrink:0;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:600;border:1px solid #d4d9e3;color:#5f6d82;background:#fff}
.try-steps li.now .step-mark{border-color:var(--aadml-primary);color:var(--aadml-primary);background:var(--aadml-tint);box-shadow:0 0 0 4px var(--aadml-soft)}
.try-steps li.done .step-mark{border-color:#27765a;background:#27765a;color:#fff}
.try-steps li.failed .step-mark{border-color:#b42318;color:#b42318}
.try-steps li.next{opacity:.75}
.waiting{display:flex;align-items:center;gap:8px;font-size:13px!important;color:var(--aadml-primary)!important;margin:4px 0 12px!important}
.spinner{width:14px;height:14px;border-radius:50%;border:2px solid var(--aadml-soft);border-top-color:var(--aadml-primary);animation:spin 1s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
.try-actions{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
.test-input{position:relative;cursor:pointer;margin:14px 0}
.test-input.off{opacity:.5;cursor:not-allowed}
.test-input input{position:absolute;inset:0;opacity:0;cursor:inherit}
.test-input span{font-size:11px;color:#5f6d82}
.json summary{cursor:pointer;font-size:12px;color:var(--aadml-primary);margin-top:8px}
.json pre{max-height:240px;overflow:auto;background:#f8f9fb;border-radius:7px;padding:12px}
@media(max-width:1000px){.try-layout{grid-template-columns:1fr}}
@media(max-width:650px){
  .models-tabs{gap:0;overflow:auto}.models-tabs button{padding:12px 10px;font-size:12px;white-space:nowrap}
  .wide-only{display:none}.models-empty h2{font-size:21px}
  .ws-table thead{display:none}
  .ws-table,.ws-table tbody,.ws-table tr,.ws-table td{display:block;width:100%}
  .ws-table tr{border-bottom:1px solid #e9eaf0;padding:10px 0}
  .ws-table td{border:0!important;padding:6px 14px!important}
  .ws-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:2px}
  .row-actions{text-align:left}.row-actions .button{margin:0 6px 0 0}
}
</style>
