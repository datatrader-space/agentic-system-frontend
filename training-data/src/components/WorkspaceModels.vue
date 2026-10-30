<script setup>
// The workspace's Models page: the models trained in its projects (a Labeller's projects are left out), the published
// models with trying one as it is published, and how often each project's deployed model was called. Every rule is
// the backend's (app_api.py workspace/models/, published/<key>/…, workspace/deployments/).
import { computed, onUnmounted, ref, watch } from 'vue';
import { Activity, RefreshCw, ShieldCheck, Rocket, Boxes, Box, WandSparkles, ChartNoAxesCombined, Plus, Upload, Search, Play, Square, X, Check, Code, Copy, Clock, KeyRound, Globe, Wallet } from 'lucide-vue-next';
import '../models-workspace.css';
import DeploymentHeader from './DeploymentHeader.vue';
import DeploymentMetrics from './DeploymentMetrics.vue';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import PredictionResult from './PredictionResult.vue';
import OpenModels from './OpenModels.vue';
import { callCostText, catalogue, useSnippet, USE_LANGUAGES, SDK_INSTALL } from '../api/models.js';
import { PHOTO_TYPES, percent } from '../api/trial.js';
import { workspaceApi, publishedApi, projectLink, trySteps, modelName, timeAgo } from '../api/workspace.js';

const emit = defineEmits(['create', 'navigate']);
// "Ready-to-use models" are AADML's own: used as they are, never trained here (a base model a run trains from is in
// its project's Train tab; the owner, 2026-10-28).
const tabs = [{ id: 'mine', name: 'My models', icon: Boxes }, { id: 'ready', name: 'Ready-to-use models', icon: WandSparkles }, { id: 'open', name: 'Open models', icon: Globe }, { id: 'usage', name: 'Usage', icon: ChartNoAxesCombined }];
const active = ref('My models');
const data = ref(null); const error = ref(''); const loading = ref(false); const statusFilter = ref('');
const words = ref(''); const project = ref(''); const kindFilter = ref(''); const familyFilter = ref('');

async function load() {
  if (loading.value) return;
  loading.value = true;
  try { data.value = await workspaceApi.models(); error.value = ''; }
  catch (e) { error.value = e.message; data.value = data.value || { models: [], catalogue: [], may: { try: false } }; }
  finally { loading.value = false; }
}
load();

const projects = computed(() => [...new Map((data.value?.models || []).map(m => [m.project.ref, m.project.name])).entries()]);
const models = computed(() => (data.value?.models || []).filter(m => (!project.value || m.project.ref === project.value) && (!statusFilter.value || m.state === statusFilter.value)
  && `${m.name} ${m.version} ${m.project.name} ${m.trains}`.toLowerCase().includes(words.value.trim().toLowerCase())));
const kinds = computed(() => [...new Set(catalogue(data.value?.catalogue).map(row => row.kind))]);
const shown = computed(() => catalogue(data.value?.catalogue, words.value, kindFilter.value, familyFilter.value));
// Ready now first and in full; coming soon apart and compact: what can be used today is what the page is for.
const readyRows = computed(() => shown.value.filter(row => !row.coming));
const comingRows = computed(() => shown.value.filter(row => row.coming));
const familyName = row => ((row.family || 'vision') === 'llm' ? 'Chat' : 'Photo');
const day = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
watch(active, () => { statusFilter.value = ''; words.value = ''; kindFilter.value = ''; familyFilter.value = ''; project.value = ''; if (active.value === 'Usage' && !usage.value) loadUsage(); });

function moveTab(event) {
  let index = tabs.findIndex(item => item.name === active.value);
  if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = tabs.length - 1;
  else if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
  else return;
  event.preventDefault(); active.value = tabs[index].name;
  event.currentTarget.parentElement.children[index]?.focus();
}
function clearFilters() { words.value = ''; project.value = ''; statusFilter.value = ''; kindFilter.value = ''; familyFilter.value = ''; }
const registryStates = computed(() => [...new Map((data.value?.models || []).map(m => [m.state, m.state_label])).entries()]);
const registryMetrics = computed(() => [
  { label: 'Trained models', value: data.value?.models?.length || 0, hint: 'In the current registry view', icon: Boxes },
  { label: 'Deployed versions', value: (data.value?.models || []).filter(m => m.live_in?.length).length, hint: 'Live in staging or production', icon: Rocket },
  { label: 'Projects', value: projects.value.length, hint: 'With registered models', icon: Box },
]);
const catalogMetrics = computed(() => [
  { label: 'Available now', value: catalogue(data.value?.catalogue).filter(row => !row.coming).length, hint: 'Published models to explore', icon: WandSparkles },
  { label: 'Model tasks', value: kinds.value.length, hint: 'Across the full catalogue', icon: Boxes },
  { label: 'Coming soon', value: catalogue(data.value?.catalogue).filter(row => row.coming).length, hint: 'Preview future capabilities', icon: Clock },
]);

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

// ── "Use model": how an app calls a ready-to-use model ─────────────────────────────────────────────
// Every call the model answers is charged per call to the app's maker (platform_api.py): the dialog says what a call costs.
const using = ref(null); const language = ref(USE_LANGUAGES[0]); const copied = ref(''); const useError = ref('');
const useUrl = computed(() => (using.value?.use ? `${location.origin}${using.value.use.path}` : ''));
const useCode = computed(() => (useUrl.value ? useSnippet(language.value, useUrl.value, using.value.use.model) : ''));
const COPIED_WORDS = { install: 'the install command', code: 'the code', model: 'the model key' };
let copiedTimer = null;
function openUse(row) { using.value = row; copied.value = ''; useError.value = ''; }
// "Copied" shows on the button that was used and is read out once; it goes back to "Copy" after 2 seconds.
async function copyUse(text, what) {
  try {
    await navigator.clipboard.writeText(text); copied.value = what; useError.value = '';
    clearTimeout(copiedTimer); copiedTimer = setTimeout(() => { copied.value = ''; }, 2000);
  } catch { useError.value = 'Copying was blocked by the browser. Select the text and copy it with Ctrl+C.'; }
}
onUnmounted(() => clearTimeout(copiedTimer));

// ── usage of the deployed models ─────────────────────────────────────────────────────────────────
const usage = ref(null); const usageError = ref(''); const usageLoading = ref(false); const usageQuery = ref('');
async function loadUsage() {
  if (usageLoading.value) return;
  usageLoading.value = true;
  try { usage.value = (await workspaceApi.deployments()).projects.filter(row => row.deployed || row.usage); usageError.value = ''; }
  catch (e) { usageError.value = e.message; usage.value = usage.value || []; }
  finally { usageLoading.value = false; }
}
const liveModels = row => row.environments.filter(e => e.live).map(e => `${e.label}: ${modelName(e.live.model)}`);
const visibleUsage = computed(() => (usage.value || []).filter(row => `${row.project.name} ${liveModels(row).join(' ')}`.toLowerCase().includes(usageQuery.value.trim().toLowerCase())));
const usageTotals = computed(() => (usage.value || []).reduce((sum, row) => ({ calls: sum.calls + (Number(row.usage?.calls) || 0), answered: sum.answered + (Number(row.usage?.answered) || 0) }), { calls: 0, answered: 0 }));
const usageMetrics = computed(() => [
  { label: 'Total calls', value: usageTotals.value.calls.toLocaleString(), hint: 'Last 7 days', icon: Activity },
  { label: 'Successful calls', value: usageTotals.value.answered.toLocaleString(), hint: 'Predictions returned', icon: Check },
  { label: 'Success rate', value: usageTotals.value.calls ? `${Math.round(1000 * usageTotals.value.answered / usageTotals.value.calls) / 10}%` : '—', hint: usageTotals.value.calls ? 'Across listed projects' : 'No calls in this period', icon: ChartNoAxesCombined },
]);
const usagePeak = computed(() => Math.max(1, ...(usage.value || []).map(row => Number(row.usage?.calls) || 0)));
const usageBars = computed(() => [...visibleUsage.value].sort((a, b) => (b.usage?.calls || 0) - (a.usage?.calls || 0)).slice(0, 8));
</script>

<template>
  <div class="models-workspace models-redesigned studio">
    <nav class="models-tabs" role="tablist" aria-label="Models views"><button v-for="item in tabs" :key="item.id" type="button" role="tab" :id="`models-tab-${item.id}`" :aria-controls="`models-panel-${item.id}`" :aria-selected="active===item.name" :tabindex="active===item.name ? 0 : -1" @keydown="moveTab" @click="active=item.name"><component :is="item.icon" :size="16" aria-hidden="true"/>{{ item.name }}</button></nav>
    <div v-if="error && active !== 'Open models' && active !== 'Usage'" class="models-error" role="alert"><span>{{ error }}</span><UiButton :disabled="loading" @click="load"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton></div>

    <section v-if="active==='My models'" id="models-panel-mine" role="tabpanel" aria-labelledby="models-tab-mine" :aria-busy="loading">
      <DeploymentHeader title="My Models" heading-id="registry-heading" eyebrow="YOUR MODELS. READY FOR WHAT'S NEXT." :icon="Boxes" description="Find trained versions, check their status, and move from testing to deployment.">
        <UiButton variant="primary" @click="emit('create')"><Plus :size="16" aria-hidden="true"/> Create project</UiButton>
      </DeploymentHeader>
      <DeploymentMetrics :items="registryMetrics" :loaded="!!data && !error"/>
      <p v-if="!data" class="models-loading">Loading models…</p>
      <section v-else-if="!data.models.length && !error" class="models-empty">
        <span class="models-empty-icon"><Boxes :size="34"/></span>
        <h2>No trained models yet</h2>
        <p>A model is trained in a project from a frozen dataset version.<br class="wide-only"> Every model trained in a project you can see is listed here.</p>
        <div class="models-actions"><UiButton variant="primary" @click="emit('create')"><Plus :size="17"/>Create a project</UiButton><UiButton disabled title="Coming soon"><Upload :size="16"/>Upload weights · Coming soon</UiButton></div>
      </section>
      <template v-else-if="data.models.length">
        <div class="models-list-head"><div><h3>Model registry <span class="models-count">{{ models.length }} of {{ data.models.length }}</span></h3><p>Versions trained in projects you can access.</p></div><UiButton :disabled="loading" @click="load"><RefreshCw :size="14" aria-hidden="true"/> Refresh</UiButton></div>
        <div class="studio-actions models-filterbar">
          <div class="search-field"><Search :size="16"/><input v-model="words" aria-label="Search models" placeholder="Search models…"></div>
          <select v-model="project" class="compact-select" aria-label="Project"><option value="">All projects</option><option v-for="[ref, name] in projects" :key="ref" :value="ref">{{ name }}</option></select>
          <select v-model="statusFilter" class="compact-select" aria-label="Model status"><option value="">All statuses</option><option v-for="[value, label] in registryStates" :key="value" :value="value">{{ label }}</option></select>
          <UiButton v-if="words || project || statusFilter" @click="clearFilters">Clear filters</UiButton>
          <span class="models-upload-note"><Upload :size="14" aria-hidden="true"/> Weight uploads coming soon</span>
        </div>
        <div v-if="models.length" class="table-wrap registry-table">
          <table class="ws-table">
            <thead><tr><th>Model</th><th>Project</th><th>State</th><th>Answers in</th><th>Trained</th><th><span class="sr-only">Open</span></th></tr></thead>
            <tbody>
              <tr v-for="m in models" :key="`${m.project.ref}-${m.number}`">
                <td data-label="Model"><div class="model-name"><span class="model-row-icon"><Box :size="17" aria-hidden="true"/></span><strong>{{ m.name }} <span class="model-version">{{ m.version }}</span></strong></div> <UiBadge v-if="m.smoke">Smoke test</UiBadge><small v-if="m.trains">{{ m.trains }}</small></td>
                <td data-label="Project">{{ m.project.name }}</td>
                <td data-label="State"><UiBadge :tone="m.state==='rejected'?'neutral':'green'">{{ m.state_label }}</UiBadge></td>
                <td data-label="Answers in"><template v-if="m.live_in.length"><UiBadge v-for="env in m.live_in" :key="env" tone="purple">{{ env === 'production' ? 'Production' : 'Staging' }}</UiBadge></template><span v-else class="muted">Not deployed</span></td>
                <td data-label="Trained">{{ day(m.created_at) }}</td>
                <td class="row-actions"><a class="button" :href="projectLink(m.project.ref,'models')">Open</a><a v-if="m.may.try" class="button" :href="projectLink(m.project.ref,'test')">Test</a></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!models.length" class="models-no-results" role="status"><Search :size="23" aria-hidden="true"/><h3>No matching models</h3><p>Try a different model name, project, or status.</p><UiButton @click="clearFilters">Clear filters</UiButton></div>
        <p v-if="data.models.length>=data.shown" class="muted">The newest {{ data.shown }} models are shown.</p>
      </template>
    </section>

    <section v-else-if="active==='Ready-to-use models'" id="models-panel-ready" role="tabpanel" aria-labelledby="models-tab-ready" :aria-busy="loading">
      <DeploymentHeader title="Ready-to-use Models" heading-id="catalog-heading" eyebrow="EXPLORE. TRY. INTEGRATE." :icon="WandSparkles" description="Explore AADML's published models. Try supported models or connect them to your apps."/>
      <DeploymentMetrics :items="catalogMetrics" :loaded="!!data && !error"/>
      <div class="models-info"><ShieldCheck :size="17" aria-hidden="true"/><p>Published models are used as provided. Models you train are managed in <button class="models-text-button" type="button" @click="active='My models'">My models</button>.</p></div>
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
      <div class="studio-actions models-filterbar">
        <div class="search-field"><Search :size="16"/><input v-model="words" aria-label="Search models" placeholder="Search models…"></div>
        <select v-model="familyFilter" class="compact-select" aria-label="Kind of model"><option value="">Photo and chat</option><option value="vision">Photo models</option><option value="llm">Chat models</option></select>
        <select v-model="kindFilter" class="compact-select" aria-label="Model task"><option value="">All tasks</option><option v-for="k in kinds" :key="k" :value="k">{{ k }}</option></select>
        <UiButton v-if="words || familyFilter || kindFilter" @click="clearFilters">Clear filters</UiButton>
      </div>
      <p v-if="!data" class="models-loading">Loading models…</p>
      <template v-else>
        <section v-if="readyRows.length" class="catalog-section" aria-labelledby="ready-now">
          <h2 id="ready-now">Ready now <span class="count">{{ readyRows.length }}</span></h2>
          <div class="model-catalog">
            <article v-for="row in readyRows" :key="row.name" class="panel catalog-card">
              <div class="catalog-head"><Box :size="22" aria-hidden="true"/><UiBadge>{{ familyName(row) }}</UiBadge><UiBadge>{{ row.kind }}</UiBadge><UiBadge v-if="publishedBadge(row)" :tone="publishedBadge(row)[0]">{{ publishedBadge(row)[1] }}</UiBadge></div>
              <h3>{{ row.name }}</h3>
              <p class="model-meta">{{ row.publisher }}</p>
              <p>{{ row.description }}</p>
              <p class="licence-line"><span>Licence</span>{{ row.licence }}</p>
              <div v-if="row.research_only" class="catalog-tags"><UiBadge>Research or evaluation use only</UiBadge></div>
              <p v-if="row.not_tried" class="model-meta">{{ row.not_tried }}</p>
              <div class="catalog-buttons">
                <UiButton v-if="row.use" variant="primary" @click="openUse(row)"><Code :size="15" aria-hidden="true"/> Use model</UiButton>
                <UiButton :disabled="!data.may.try||!!row.not_tried" :title="!data.may.try ? 'Your role in this workspace reads only: it starts nothing.' : ''" @click="startTrying(row)"><Play :size="15" aria-hidden="true"/> Try it</UiButton>
              </div>
            </article>
          </div>
        </section>
        <details v-if="comingRows.length" class="coming-section">
          <summary class="coming-summary"><span>Coming soon <span class="count">{{ comingRows.length }}</span></span><span>Explore upcoming models</span></summary>
          <p class="section-note">Listed so you can plan around them. They can't be used or tried yet.</p>
          <ul class="coming-grid">
            <li v-for="row in comingRows" :key="row.name" class="coming-card">
              <div class="coming-head"><strong>{{ row.name }}</strong><UiBadge>{{ familyName(row) }}</UiBadge></div>
              <p class="coming-what" :title="row.description">{{ row.description }}</p>
              <p class="coming-meta">{{ row.publisher }}<br>{{ row.licence }}</p>
            </li>
          </ul>
        </details>
      </template>
      <div v-if="data&&!shown.length&&!error" class="models-no-results" role="status"><Search :size="23" aria-hidden="true"/><h3>No matching models</h3><p>Try another name, model family, or task.</p><UiButton @click="clearFilters">Clear filters</UiButton></div>
      <p v-if="data&&!data.may.try" class="muted">Your role in this workspace reads only, so it starts no model here.</p>
    </section>

    <OpenModels v-else-if="active==='Open models'" id="models-panel-open" role="tabpanel" aria-labelledby="models-tab-open"/>

    <section v-else id="models-panel-usage" role="tabpanel" aria-labelledby="models-tab-usage" :aria-busy="usageLoading">
      <DeploymentHeader title="Model Usage" heading-id="usage-heading" eyebrow="UNDERSTAND YOUR INFERENCE ACTIVITY." :icon="ChartNoAxesCombined" description="Monitor calls and successful predictions across your projects over the last 7 days.">
        <UiButton :disabled="usageLoading" @click="loadUsage"><RefreshCw :size="14" aria-hidden="true"/> Refresh usage</UiButton>
      </DeploymentHeader>
      <DeploymentMetrics :items="usageMetrics" :loaded="!!usage && !usageError"/>
      <div v-if="usageError" class="models-error" role="alert"><span>{{ usageError }}</span><UiButton :disabled="usageLoading" @click="loadUsage">Try again</UiButton></div>
      <p v-if="!usage" class="models-loading">Loading usage…</p>
      <section v-else-if="!usage.length && !usageError" class="models-empty">
        <span class="models-empty-icon"><ChartNoAxesCombined :size="34"/></span>
        <h2>No model is deployed yet</h2>
        <p>Calls appear here once an app asks a project's deployed model for predictions.</p>
      </section>
      <template v-else-if="usage.length">
        <div class="models-list-head"><div><h3>Usage by project</h3><p>Open a project for usage by app, environment, and model version.</p></div><label class="search-field"><Search :size="16" aria-hidden="true"/><input v-model="usageQuery" type="search" aria-label="Search usage" placeholder="Search projects…"/></label></div>
        <figure v-if="usageBars.length && usageTotals.calls" class="usage-distribution"><figcaption>Call volume <span>Top {{ usageBars.length }} matching projects · last 7 days</span></figcaption><ol><li v-for="row in usageBars" :key="row.project.ref"><span class="usage-bar-name">{{ row.project.name }}</span><span class="usage-track"><span :style="{ width: `${100 * (row.usage?.calls || 0) / usagePeak}%` }"></span></span><strong>{{ (row.usage?.calls || 0).toLocaleString() }}<span class="sr-only"> calls</span></strong></li></ol></figure>
        <div v-if="!visibleUsage.length" class="models-no-results" role="status"><h3>No matching projects</h3><p>Try another project or model name.</p><UiButton @click="usageQuery=''">Clear search</UiButton></div>
        <div v-else class="table-wrap usage-table">
        <table class="ws-table">
          <thead><tr><th>Project</th><th>Answering now</th><th>Calls</th><th>Answered</th><th>Last call</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>
            <tr v-for="row in visibleUsage" :key="row.project.ref">
              <td data-label="Project"><strong>{{ row.project.name }}</strong></td>
              <td data-label="Answering now"><template v-if="liveModels(row).length"><span v-for="line in liveModels(row)" :key="line" class="line">{{ line }}</span></template><span v-else class="muted">Nothing live</span></td>
              <td data-label="Calls">{{ (row.usage?.calls ?? 0).toLocaleString() }}</td>
              <td data-label="Answered">{{ row.usage?.calls ? `${row.usage.answered.toLocaleString()} (${Math.round(1000 * row.usage.answered / row.usage.calls) / 10}%)` : '—' }}</td>
              <td data-label="Last call">{{ row.usage ? timeAgo(row.usage.last) : '—' }}</td>
              <td class="row-actions"><a class="button" :href="projectLink(row.project.ref,'models')">Open usage</a></td>
            </tr>
          </tbody>
        </table>
        </div>
      </template>
    </section>
    <UiDialog class="use-dialog" :open="!!using" :title="using ? `Use ${using.name}` : ''" @close="using=null">
      <template v-if="using">
        <p class="dialog-description">Call {{ using.name }} from your own code. Each call is one photo, answered with what the model found.</p>
        <p v-if="using.use.cost_note" class="use-cost"><Wallet :size="16" aria-hidden="true"/><span>{{ callCostText(using.use) }}</span></p>
        <p v-if="using.use.serving_note" class="use-cost"><Clock :size="16" aria-hidden="true"/><span>{{ using.use.serving_note }}</span></p>
        <ol class="use-steps">
          <li>
            <h3><span class="use-step-no" aria-hidden="true">1</span>Choose your language</h3>
            <div class="segmented" role="radiogroup" aria-label="Language">
              <button v-for="l in USE_LANGUAGES" :key="l" type="button" role="radio" :aria-checked="language===l" :class="{on:language===l}" @click="language=l">{{ l }}</button>
            </div>
          </li>
          <li>
            <h3><span class="use-step-no" aria-hidden="true">2</span>Install</h3>
            <div v-if="language==='Python SDK'" class="command-row">
              <code>{{ SDK_INSTALL }}</code>
              <button type="button" class="copy-chip" :aria-label="copied==='install' ? 'Install command copied' : 'Copy the install command'" @click="copyUse(SDK_INSTALL,'install')"><Check v-if="copied==='install'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copied==='install' ? 'Copied' : 'Copy' }}</button>
            </div>
            <p v-else class="step-note">Nothing to install: {{ language==='JavaScript' ? 'browsers and Node.js 18 or newer have fetch built in.' : 'curl comes with macOS, Linux and Windows 10 or newer.' }}</p>
          </li>
          <li>
            <h3><span class="use-step-no" aria-hidden="true">3</span>Copy and run the code</h3>
            <div class="use-code">
              <button type="button" class="copy-chip on-dark" :aria-label="copied==='code' ? 'Code copied' : 'Copy the code'" @click="copyUse(useCode,'code')"><Check v-if="copied==='code'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copied==='code' ? 'Copied' : 'Copy' }}</button>
              <pre class="code-block" tabindex="0" :aria-label="`Code to call ${using.name} with ${language}`"><code>{{ useCode }}</code></pre>
            </div>
          </li>
        </ol>
        <dl class="use-facts">
          <div><dt>Model key</dt><dd><code>{{ using.use.model }}</code><button type="button" class="copy-icon" :aria-label="copied==='model' ? 'Model key copied' : 'Copy the model key'" @click="copyUse(using.use.model,'model')"><Check v-if="copied==='model'" :size="14" aria-hidden="true"/><Copy v-else :size="14" aria-hidden="true"/></button></dd></div>
          <div><dt>App key</dt><dd><KeyRound :size="14" aria-hidden="true"/>Make one on a project's Deploy page, under Connected apps.</dd></div>
          <div><dt>Licence</dt><dd>{{ using.licence }}</dd></div>
        </dl>
        <p class="sr-only" aria-live="polite">{{ copied ? `Copied ${COPIED_WORDS[copied]}.` : '' }}</p>
        <p v-if="useError" class="field-error" role="alert">{{ useError }}</p>
        <div class="use-actions">
          <UiButton @click="using=null">Close</UiButton>
          <UiButton variant="primary" disabled title="Coming soon">Test API · Coming soon</UiButton>
        </div>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.models-workspace{color:#152237}
.catalog-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto;padding-top:16px}
.catalog-buttons > :only-child{grid-column:1 / -1}
.catalog-section{margin-top:28px}
.catalog-section > h2{display:flex;align-items:center;gap:10px;font-size:16px;margin:0}
.section-note{margin:6px 0 0;font-size:13px;color:#5f6d82}
.licence-line{display:flex;flex-direction:column;gap:2px;padding-top:6px;font-size:13px;color:#33415a}
.licence-line span{font-size:12px;color:#6b778c}
.coming-grid{list-style:none;padding:0;margin:16px 0 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;align-items:start}
.coming-card{padding:14px 16px;border:1px dashed #cfd5e1;border-radius:10px;background:#fafbfc}
.coming-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.coming-head strong{font-size:14px;color:#22304a}
.coming-what{margin:6px 0 8px;font-size:13px;color:#4d5a70;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.coming-meta{margin:0;font-size:12px;color:#6b778c;line-height:1.5}
.use-dialog{width:min(680px,calc(100% - 32px))}
.use-cost{display:flex;gap:8px;align-items:flex-start;margin:12px 0 4px;font-size:13px;line-height:1.55;color:#33415a}
.use-cost svg{flex-shrink:0;margin-top:2px;color:#5f6d82}
.use-steps{list-style:none;padding:0;margin:20px 0 0;display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
.use-steps li{min-width:0}
.use-steps h3{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:14px;color:#1d2a42}
.use-step-no{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#1d2a42;color:#fff;font-size:12px;font-weight:600}
.use-steps li > :not(h3){margin-left:34px}
.segmented{display:inline-flex;padding:3px;border-radius:9px;background:#f1f3f7;gap:2px;flex-wrap:wrap}
.segmented button{min-height:36px;padding:7px 14px;border:0;border-radius:7px;background:transparent;color:#4d5a70;font-size:13px;font-weight:550;transition:background-color .15s,color .15s}
.segmented button.on{background:#fff;color:var(--aadml-primary);box-shadow:0 1px 3px #1d2a4224}
.segmented button:hover:not(.on){color:#1d2a42}
.command-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 8px 8px 14px;border:1px solid #dfe3eb;border-radius:9px;background:#f8f9fb}
.command-row code{font-size:13px;color:#1d2a42;overflow-wrap:anywhere}
.step-note{margin:0;font-size:13px;color:#5f6d82}
.copy-chip{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:6px 12px;border:1px solid #dfe3eb;border-radius:7px;background:#fff;color:#33415a;font-size:12px;font-weight:550;transition:background-color .15s,border-color .15s}
.copy-chip:hover{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.copy-chip.on-dark{position:absolute;top:10px;right:10px;background:#2c3a50;border-color:#3e4d65;color:#e3e8f1}
.copy-chip.on-dark:hover{background:#38475f;border-color:#53637d}
.use-code{position:relative;min-width:0}
.use-code .code-block{margin:0;min-height:0;max-height:300px;overflow:auto;padding:52px 22px 20px;white-space:pre;font-size:12.5px;line-height:1.7}
.use-code .code-block:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px}
.use-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:22px 0 0}
.use-facts > div{padding:12px 14px;border:1px solid #e3e6ed;border-radius:9px;min-width:0}
.use-facts dt{font-size:12px;color:#6b778c;margin-bottom:6px}
.use-facts dd{margin:0;display:flex;align-items:flex-start;gap:6px;font-size:13px;color:#22304a;overflow-wrap:anywhere;line-height:1.45}
.use-facts dd svg{margin-top:2px;color:#6b778c}
.use-facts code{font-size:13px}
.copy-icon{display:inline-grid;place-items:center;min-width:28px;min-height:28px;margin:-4px -4px -4px auto;border:0;border-radius:6px;background:transparent;color:#6b778c}
.copy-icon:hover{background:var(--aadml-tint);color:var(--aadml-primary)}
.use-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:24px;flex-wrap:wrap}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion: reduce){.segmented button,.copy-chip{transition:none}}
@media (max-width:640px){
  .use-facts{grid-template-columns:1fr}
  .use-steps li > :not(h3){margin-left:0}
  .catalog-buttons{grid-template-columns:1fr}
  .segmented{display:flex;flex-wrap:nowrap}
  .segmented button{flex:1 1 0;min-width:0;padding:7px 6px}
  .command-row{flex-wrap:wrap}
  .use-code .code-block{font-size:12px;padding:52px 16px 16px}
}
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
