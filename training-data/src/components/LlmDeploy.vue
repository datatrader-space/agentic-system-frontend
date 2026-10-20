<script setup>
// The Deploy page's LLM form (plan §2.1, §10, LLM-POC 28-32). Where each chat model version answers (staging,
// production): approving a version, deploying it, cancelling a start, going back, stopping. The chat API's address
// and a call in three languages. "Use in AADML": the live model in the person's own AADML model list. For the
// project's Owner: the apps that may call it with their keys, and the downloads (the adapter, or the merged weights
// made by a job). Backend: llm/app_api.py (deploy/, models/<v>/approvals|merge|download).
import { computed, onUnmounted, ref, watch } from 'vue';
import { Ban, Bot, Check, Copy, Download, KeyRound, Layers, Plus, RotateCcw, ShieldCheck, Square, Upload, X } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { llmApi, chatSnippet, chatLiveTag, downloadUrl, verdictLabel, verdictTone } from '../api/llm.js';
import { bytesText } from '../api/analytics.js';
import './llm.css';

const props = defineProps({ project: { type: Object, required: true } });
const emit = defineEmits(['navigate']);
const ref_ = computed(() => props.project.ref);
const data = ref(null); const error = ref(''); const told = ref(''); const busy = ref(false);
const chosen = ref({}); const allowEnv = ref({}); const newKey = ref(null); const copied = ref('');

// The page's body, from the page itself or from an action's answer (which carries the whole page).
function take(body) {
  data.value = body;
  for (const env of body.environments) {
    const ready = env.deployable.filter(m => !m.refused);
    if (!ready.some(m => m.version === chosen.value[env.key])) chosen.value[env.key] = ready[0]?.version ?? null;
  }
  for (const app of body.apps || []) if (!allowEnv.value[app.id]) allowEnv.value[app.id] = 'staging';
}
async function load() {
  try { take(await llmApi.deploy(ref_.value)); error.value = ''; }
  catch (e) { error.value = e.message; }
}
// A deployment that is starting, or merged weights being made, are asked about again 4 s after each answer.
let timer = null; let alive = true;
const waiting = computed(() => (data.value?.environments || []).some(e => e.starting)
  || (data.value?.models || []).some(m => m.merged?.state === 'preparing'));
function follow() { clearTimeout(timer); timer = alive && waiting.value ? setTimeout(async () => { await load(); follow(); }, 4000) : null; }
watch(waiting, follow);
watch(ref_, () => { data.value = null; load(); }, { immediate: true });
onUnmounted(() => { alive = false; clearTimeout(timer); });

async function run(call, after) {
  busy.value = true; error.value = ''; told.value = '';
  try { const answer = await call(); take(answer); told.value = answer.said; after?.(answer); return true; }
  catch (e) {
    if (e.status === 0) { await load(); error.value = 'No answer came back, so the page read it again: check below whether it was done before trying again.'; }
    else error.value = e.message;
    return false;
  } finally { busy.value = false; follow(); }
}

// ── environments ──
const deploy = env => run(() => llmApi.deployAct(ref_.value, env.key, 'deploy', { model: chosen.value[env.key] }));
const cancel = env => run(() => llmApi.deployAct(ref_.value, env.key, 'cancel'));
const goingBack = ref(null); const backTo = ref(null); const stopping = ref(null);
function askBack(env) { goingBack.value = env; backTo.value = env.earlier.find(m => !m.refused)?.version ?? null; }
async function goBack() { const env = goingBack.value; if (await run(() => llmApi.deployAct(ref_.value, env.key, 'rollback', { model: backTo.value }))) goingBack.value = null; }
async function stopEnv() { const env = stopping.value; if (await run(() => llmApi.deployAct(ref_.value, env.key, 'stop'))) stopping.value = null; }
const linking = ref(null); const unlinking = ref(null);
async function link() { const env = linking.value; if (await run(() => llmApi.deployAct(ref_.value, env.key, 'link'))) linking.value = null; }
async function unlink() { const env = unlinking.value; if (await run(() => llmApi.deployAct(ref_.value, env.key, 'unlink'))) unlinking.value = null; }

// ── approvals ──
const approving = ref(null); const kind = ref('demo'); const note = ref(''); const reason = ref('');
function askApprove(model) { approving.value = { type: 'approve', model }; kind.value = model.release_refused ? 'demo' : 'release'; note.value = ''; }
function askRevoke(model, approval) { approving.value = { type: 'revoke', model, approval }; reason.value = ''; }
async function decide() {
  const { type, model, approval } = approving.value;
  const call = type === 'approve' ? () => llmApi.approve(ref_.value, model.version, { kind: kind.value, note: note.value.trim() })
    : () => llmApi.revokeApproval(ref_.value, model.version, approval.id, reason.value.trim());
  if (await run(call)) approving.value = null;
}

// ── downloads ──
const merge = model => run(() => llmApi.merge(ref_.value, model.version));

// ── apps (the project's Owner) ──
const appName = ref(''); const revoking = ref(null); const deletingApp = ref(null); const deleteName = ref('');
async function addApp() { if (await run(() => llmApi.addApp(ref_.value, appName.value.trim()))) appName.value = ''; }
const makeKey = app => run(() => llmApi.app(ref_.value, app.id, 'key', {}), answer => { newKey.value = answer.made; });
const grant = app => run(() => llmApi.app(ref_.value, app.id, 'grant', { environment: allowEnv.value[app.id] }));
const ungrant = (app, row) => run(() => llmApi.app(ref_.value, app.id, 'ungrant', {}, row.id));
const setAppOn = (app, on) => run(() => llmApi.app(ref_.value, app.id, on ? 'enable' : 'disable', {}));
async function revokeKey() { const { app, key } = revoking.value; if (await run(() => llmApi.app(ref_.value, app.id, 'key-revoke', {}, key.id))) revoking.value = null; }
async function deleteApp() {
  const app = deletingApp.value;
  if (await run(() => llmApi.app(ref_.value, app.id, 'delete', { confirm: deleteName.value.trim() }))) { deletingApp.value = null; deleteName.value = ''; }
}

// ── the chat call ──
const LANGUAGES = ['Python', 'JavaScript', 'HTTP / cURL'];
const language = ref('Python'); const callEnv = ref('staging');
const code = computed(() => (data.value ? chatSnippet(language.value, data.value.chat_url, callEnv.value) : ''));
const responsesUrl = computed(() => (data.value ? data.value.responses_url.replace('{environment}', callEnv.value) : ''));
async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); copied.value = what; setTimeout(() => { if (copied.value === what) copied.value = ''; }, 2000); }
  catch { error.value = 'The browser did not allow copying. Select the text and copy it.'; }
}

const when = iso => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const stateTone = s => ({ live: 'green', failed: 'red', retired: 'neutral', starting: 'purple' }[s] || 'neutral');
const mergedTone = s => ({ ready: 'green', failed: 'red', preparing: 'purple' }[s] || 'neutral');
const METHOD = { sft: 'Supervised fine-tuning', cpt: 'Continued pre-training', dpo: 'DPO', kto: 'KTO' };
const active = m => m.approvals.filter(a => a.active);
const revoked = m => m.approvals.filter(a => !a.active);
</script>

<template>
  <div class="studio llm-deploy">
    <div v-if="told" class="notice" role="status"><Check :size="16" /><span>{{ told }}</span><button class="icon-button" aria-label="Dismiss" @click="told = ''"><X :size="14" /></button></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="!data && !error" class="llm-loading">Loading…</p>
    <section v-else-if="data && !data.models.length" class="panel empty-state">
      <Layers :size="28" /><h2>No chat model to deploy yet</h2>
      <p>A model version appears here when a training run has succeeded. Test it, evaluate it, approve it, and deploy it from this page.</p>
      <UiButton variant="primary" @click="emit('navigate', 'train')">Go to training</UiButton>
    </section>
    <div v-else-if="data" class="deploy-main">
      <p v-if="data.serving_refused" class="deploy-warning">{{ data.serving_refused }}</p>

      <!-- Where the chat model answers -->
      <section>
        <h2>Where the chat model answers</h2>
        <p class="deploy-intro">Staging is for demos and tests; production is what your customers' apps call. A version is deployed only with an approval, and becomes live only when its chat server has loaded the model and answered. A replaced version is kept and can be gone back to.</p>
        <div class="env-grid">
          <article v-for="env in data.environments" :key="env.key" class="panel env-card">
            <header><h3>{{ env.label }}</h3><UiBadge :tone="chatLiveTag(env)[0]">{{ chatLiveTag(env)[1] }}</UiBadge></header>
            <template v-if="env.live">
              <p class="env-model"><strong>{{ env.live.model }}</strong></p>
              <p class="deploy-meta">Revision {{ env.live.number }}<template v-if="env.live.rollback_of"> · going back from revision {{ env.live.rollback_of }}</template> · live since {{ when(env.live.live_at) }}</p>
            </template>
            <p v-else class="deploy-meta">No chat model answers in {{ env.label.toLowerCase() }} yet.</p>
            <p v-if="env.starting" class="deploy-starting"><span class="spinner" aria-hidden="true"></span>Revision {{ env.starting.number }} with {{ env.starting.model }} is loading on the CPU; this takes a minute or two.<template v-if="env.live"> Until then revision {{ env.live.number }} keeps answering.</template></p>
            <p v-else-if="env.failed" class="deploy-error"><strong>Revision {{ env.failed.number }} did not go live.</strong> {{ env.failed.failure }}<template v-if="env.live"> Revision {{ env.live.number }} is still answering.</template></p>
            <div v-if="data.may.train" class="env-actions">
              <UiButton v-if="env.starting" :disabled="busy" @click="cancel(env)"><Ban :size="14" /> Cancel revision {{ env.starting.number }}</UiButton>
              <template v-else>
                <template v-if="env.deployable.some(m => !m.refused)">
                  <select v-model.number="chosen[env.key]" class="text-input compact" :aria-label="`Version to deploy to ${env.label.toLowerCase()}`">
                    <option v-for="m in env.deployable.filter(x => !x.refused)" :key="m.version" :value="m.version">{{ m.name }}</option>
                  </select>
                  <UiButton variant="primary" :disabled="busy || !!data.serving_refused || chosen[env.key] == null" @click="deploy(env)"><Upload :size="14" /> Deploy to {{ env.label.toLowerCase() }}</UiButton>
                </template>
                <span v-else class="deploy-meta">No version has an approval for {{ env.label.toLowerCase() }}.{{ env.key === 'production' ? ' Production needs a release approval.' : ' A demo approval is enough.' }}</span>
                <UiButton v-if="env.earlier.length" :disabled="busy" @click="askBack(env)"><RotateCcw :size="14" /> Go back to an earlier version…</UiButton>
                <UiButton v-if="env.live" class="danger" :disabled="busy" @click="stopping = env"><Square :size="13" /> Stop {{ env.label.toLowerCase() }}…</UiButton>
              </template>
            </div>
            <div v-if="data.may.manage" class="aadml-link">
              <h4><Bot :size="13" /> Use in AADML</h4>
              <template v-if="env.link">
                <p class="deploy-meta">“{{ env.link.model_name }}” is in {{ env.link.user || 'your' }}'s AADML model list: an agent or a workflow can choose it. Its calls are counted with the apps' calls.</p>
                <UiButton class="small" :disabled="busy" @click="unlinking = env">Remove from AADML…</UiButton>
              </template>
              <template v-else>
                <p class="deploy-meta">{{ env.live ? 'Put this model in your AADML model list, so your agents and workflows can use it.' : 'Possible once a version is live here.' }}</p>
                <UiButton class="small" :disabled="busy || !env.live" @click="linking = env"><Bot :size="13" /> Use in AADML…</UiButton>
              </template>
            </div>
            <details v-if="env.history.length" class="history">
              <summary>Revisions of {{ env.label.toLowerCase() }} ({{ env.history.length }})</summary>
              <div class="table-wrap"><table>
                <thead><tr><th>Revision</th><th>Version</th><th>State</th><th>By</th><th>Started</th><th>What happened</th></tr></thead>
                <tbody><tr v-for="r in env.history" :key="r.number">
                  <td><strong>{{ r.number }}</strong><span v-if="r.rollback_of" class="deploy-meta"> · back from {{ r.rollback_of }}</span></td>
                  <td>{{ r.model }}</td><td><UiBadge :tone="stateTone(r.state)">{{ r.state_label }}</UiBadge></td>
                  <td>{{ r.created_by || '—' }}</td><td>{{ when(r.created_at) }}</td><td>{{ r.failure || '—' }}</td></tr></tbody>
              </table></div>
            </details>
          </article>
        </div>
      </section>

      <!-- Approvals -->
      <section class="panel">
        <h2>Approvals</h2>
        <p class="deploy-intro">An approval is a person's recorded decision that a version may be deployed, bound to exactly the file that was approved. A demo approval reaches staging. A release approval reaches production, and needs an evaluation of the version that passed the project's acceptance criteria (Analytics page).</p>
        <div v-for="m in data.models" :key="m.version" class="approval-row">
          <div>
            <strong>{{ m.name }}</strong>
            <span class="deploy-meta"> · {{ METHOD[m.method] || m.method }} on {{ m.base_model }}</span>
            <UiBadge v-if="m.newest_evaluation" :tone="verdictTone(m.newest_evaluation.verdict)">Evaluation {{ m.newest_evaluation.number }}: {{ verdictLabel(m.newest_evaluation.verdict) }}</UiBadge>
            <UiBadge v-else tone="neutral">Not evaluated</UiBadge>
            <UiBadge v-if="m.research_only" tone="amber">Research only</UiBadge>
            <ul>
              <li v-for="a in active(m)" :key="a.id"><ShieldCheck :size="13" /><span><strong>{{ a.kind_label }}</strong> — {{ a.approved_by }}, {{ when(a.approved_at) }}: {{ a.note }}</span>
                <button v-if="data.may.train" class="link-button" :disabled="busy" @click="askRevoke(m, a)">Revoke…</button></li>
              <li v-if="!active(m).length" class="deploy-meta">Not approved.</li>
            </ul>
            <p v-if="m.release_refused" class="deploy-meta">For a release: {{ m.release_refused }}</p>
            <details v-if="revoked(m).length" class="history">
              <summary>Earlier approvals, revoked ({{ revoked(m).length }})</summary>
              <ul><li v-for="a in revoked(m)" :key="a.id" class="revoked"><span>{{ a.kind_label }} — {{ a.approved_by }}, {{ when(a.approved_at) }}: {{ a.note }}. Revoked {{ when(a.revoked_at) }}<template v-if="a.revoked_by"> by {{ a.revoked_by }}</template><template v-if="a.revoke_reason">: {{ a.revoke_reason }}</template></span></li></ul>
            </details>
          </div>
          <UiButton v-if="data.may.train" :disabled="busy" @click="askApprove(m)">Approve…</UiButton>
        </div>
      </section>

      <!-- The chat call -->
      <section class="panel">
        <div class="call-head"><h2>How an app talks to the model</h2>
          <label class="deploy-meta call-env">Environment <select v-model="callEnv" class="text-input compact"><option value="staging">Staging</option><option value="production">Production</option></select></label></div>
        <p class="deploy-intro">The address speaks OpenAI's chat completions, whole or streamed, so the OpenAI client libraries work as they are. The answer names the version and the revision that answered. No prompt and no answer is kept: each call leaves a usage record of its tokens and how it ended. An app needs a key and access to the environment (below).</p>
        <div class="studio-tabs" role="tablist" aria-label="Language"><button v-for="l in LANGUAGES" :key="l" role="tab" :aria-selected="language === l" :class="{ active: language === l }" @click="language = l">{{ l }}</button></div>
        <pre class="code-block">{{ code }}</pre>
        <UiButton @click="copy(code, 'code')"><Copy :size="15" /> {{ copied === 'code' ? 'Copied' : 'Copy' }}</UiButton>
        <p class="deploy-meta">The same model also answers OpenAI's Responses API at <code class="address">{{ responsesUrl }}</code>. A stage 1 model answers at most 512 tokens and reads text only.</p>
      </section>

      <!-- Apps -->
      <section v-if="data.apps" class="panel">
        <h2>Apps that may call the model</h2>
        <p class="deploy-intro">An app is a system outside AADML, such as your own support site. Per environment it can be allowed to talk to the model, and nothing else: it can never start a training run or read the project's examples.</p>
        <div v-if="newKey" class="new-key" role="status">
          <strong>A key for {{ newKey.app }}: copy it now.</strong> It is shown only this once; AADML keeps its fingerprint, not the key.
          <pre>{{ newKey.key }}</pre>
          <div class="env-actions"><UiButton @click="copy(newKey.key, 'key')"><Copy :size="14" /> {{ copied === 'key' ? 'Copied' : 'Copy key' }}</UiButton><UiButton @click="newKey = null">I have copied it</UiButton></div>
        </div>
        <form class="env-actions" @submit.prevent="addApp">
          <input v-model="appName" class="text-input grow" maxlength="120" placeholder="App name, e.g. Support site" aria-label="Name of the new app">
          <UiButton type="submit" variant="primary" :disabled="busy || !appName.trim()"><Plus :size="14" /> Add an app</UiButton>
        </form>
        <p v-if="!data.apps.length" class="deploy-meta">No app yet. Add one, allow it an environment, then make it a key.</p>
        <article v-for="app in data.apps" :key="app.id" class="app-block">
          <header><h3>{{ app.name }}</h3><UiBadge v-if="app.disabled" tone="amber">Turned off</UiBadge>
            <span v-if="app.can_manage" class="app-head-actions">
              <UiButton class="small" :disabled="busy" @click="setAppOn(app, app.disabled)">{{ app.disabled ? 'Turn on' : 'Turn off' }}</UiButton>
              <UiButton class="small danger" :disabled="busy" @click="deletingApp = app; deleteName = ''">Delete…</UiButton>
            </span></header>
          <p v-if="app.disabled" class="deploy-meta">Turned off: every key of this app is refused until it is turned on again.</p>
          <div class="app-cols">
            <div>
              <h4>Access to this project</h4>
              <p v-if="!app.grants.length" class="deploy-meta">None yet.</p>
              <span v-for="g in app.grants" :key="g.id" class="chip">{{ g.environment_label }} · {{ g.scope === 'invoke' ? 'talk to the model' : g.scope_label }}
                <button v-if="app.can_manage" class="icon-button" :aria-label="`Take away ${g.environment_label.toLowerCase()}`" :disabled="busy" @click="ungrant(app, g)"><X :size="12" /></button></span>
              <div v-if="app.can_manage" class="env-actions">
                <select v-model="allowEnv[app.id]" class="text-input compact" aria-label="Environment"><option value="staging">Staging</option><option value="production">Production</option></select>
                <UiButton :disabled="busy" @click="grant(app)">Allow</UiButton>
              </div>
            </div>
            <div>
              <h4>Keys</h4>
              <p v-if="!app.can_manage" class="deploy-meta">This app also has access outside the projects you manage. Its keys and its access are changed by a person who manages all of those projects, or by an Admin of the workspace.</p>
              <template v-else>
                <p v-if="!app.keys.length" class="deploy-meta">No key yet.</p>
                <div v-for="k in app.keys" :key="k.id" class="key-row"><code>{{ k.hint }}</code>
                  <UiBadge v-if="k.revoked">Revoked</UiBadge>
                  <template v-else><span class="deploy-meta">{{ k.last_used_at ? `used ${when(k.last_used_at)} · ${k.request_count} calls` : 'never used' }}</span>
                    <UiButton class="danger small" :disabled="busy" @click="revoking = { app, key: k }"><Ban :size="13" /> Revoke</UiButton></template>
                </div>
                <UiButton :disabled="busy" @click="makeKey(app)"><KeyRound :size="14" /> Make a key</UiButton>
              </template>
            </div>
          </div>
        </article>
      </section>

      <!-- Downloads -->
      <section v-if="data.may.manage" class="panel">
        <h2>Download a version</h2>
        <p class="deploy-intro">The adapter is the small file training made; it runs on top of its base model. The merged weights are the base model with the adapter folded in, made once by a job on this server. Each download is recorded with who took it, when, and the licence it carries: the base model's licence applies to what you download.</p>
        <div v-for="m in data.models" :key="m.version" class="download-row">
          <div><strong>{{ m.name }}</strong><span class="deploy-meta"> · {{ m.licence || 'licence unknown' }}</span>
            <p v-if="m.download_refused" class="deploy-meta">{{ m.download_refused }}</p>
            <p v-else-if="m.merged" class="deploy-meta"><UiBadge :tone="mergedTone(m.merged.state)">Merged weights: {{ m.merged.state_label }}</UiBadge>
              <template v-if="m.merged.state === 'ready'"> {{ bytesText(m.merged.size) }}</template>
              <template v-else-if="m.merged.state === 'preparing' && m.merged.packing"> The job has finished; its files are being checked and packed. For a large model this takes a few minutes; the page asks again on its own.</template>
              <template v-else-if="m.merged.state === 'preparing'"> The merge job is running. This takes a few minutes; the page asks again on its own.</template>
              <template v-else-if="m.merged.failure"> {{ m.merged.failure }}</template></p>
          </div>
          <div v-if="!m.download_refused" class="env-actions">
            <a class="button" :href="downloadUrl(ref_, m.version, 'adapter')" download><Download :size="14" /> Adapter</a>
            <a v-if="m.merged?.state === 'ready'" class="button" :href="downloadUrl(ref_, m.version, 'merged')" download><Download :size="14" /> Merged weights</a>
            <UiButton v-else :disabled="busy || m.merged?.state === 'preparing'" @click="merge(m)">{{ m.merged?.state === 'failed' ? 'Make the merged weights again' : 'Make the merged weights' }}</UiButton>
          </div>
        </div>
      </section>
    </div>

    <UiDialog :open="!!approving" :title="approving?.type === 'revoke' ? 'Revoke this approval' : 'Approve this version'" @close="approving = null">
      <template v-if="approving?.type === 'approve'">
        <p class="dialog-description">You record that {{ approving.model.name }} may be deployed. The approval covers exactly this version's file.</p>
        <fieldset class="kind-choice"><legend class="field-label">What it may reach</legend>
          <label><input v-model="kind" type="radio" value="demo"> <span><strong>Demo</strong> — staging only</span></label>
          <label :class="{ off: !!approving.model.release_refused }"><input v-model="kind" type="radio" value="release" :disabled="!!approving.model.release_refused"> <span><strong>Release</strong> — production too</span></label>
          <p v-if="approving.model.release_refused" class="deploy-meta">{{ approving.model.release_refused }}</p>
        </fieldset>
        <label class="field-label" for="llm-approve-note">What was checked</label>
        <textarea id="llm-approve-note" v-model="note" class="text-input" rows="3" maxlength="1000" placeholder="For example: tried 20 customer questions on the Test page; evaluation 3 passed."></textarea>
        <div class="dialog-actions"><UiButton @click="approving = null">Cancel</UiButton><UiButton variant="primary" :disabled="busy || !note.trim()" @click="decide">Approve</UiButton></div>
      </template>
      <template v-else-if="approving?.type === 'revoke'">
        <p class="dialog-description">The {{ approving.approval.kind_label.toLowerCase() }} approval of {{ approving.model.name }} stops covering it: it can no longer be deployed with it. What is already live stays live until another version replaces it.</p>
        <label class="field-label" for="llm-revoke-reason">Why</label>
        <textarea id="llm-revoke-reason" v-model="reason" class="text-input" rows="2" maxlength="1000"></textarea>
        <div class="dialog-actions"><UiButton @click="approving = null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy || !reason.trim()" @click="decide">Revoke</UiButton></div>
      </template>
    </UiDialog>
    <UiDialog :open="!!goingBack" title="Go back to an earlier version" @close="goingBack = null">
      <template v-if="goingBack">
        <p class="dialog-description">The version you choose is started again in {{ goingBack.label.toLowerCase() }}. It replaces the live revision once its chat server has answered; until then what answers now keeps answering.</p>
        <label v-for="m in goingBack.earlier" :key="m.version" class="back-choice" :class="{ off: !!m.refused }">
          <input v-model.number="backTo" type="radio" name="back-to" :value="m.version" :disabled="!!m.refused">
          <span><strong>{{ m.name }}</strong> · was live as revision {{ m.was_live }}<span v-if="m.refused" class="deploy-meta"> — {{ m.refused }}</span></span>
        </label>
        <div class="dialog-actions"><UiButton @click="goingBack = null">Cancel</UiButton><UiButton variant="primary" :disabled="busy || backTo === null" @click="goBack">Go back</UiButton></div>
      </template>
    </UiDialog>
    <UiDialog :open="!!stopping" title="Stop this environment" @close="stopping = null">
      <template v-if="stopping">
        <p class="dialog-description">{{ stopping.live.model }} stops answering on {{ stopping.label.toLowerCase() }} at once; apps calling it get "no chat model is deployed" until you deploy a version or go back to one. Nothing is deleted.</p>
        <div class="dialog-actions"><UiButton @click="stopping = null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy" @click="stopEnv">Stop {{ stopping.label.toLowerCase() }}</UiButton></div>
      </template>
    </UiDialog>
    <UiDialog :open="!!linking" title="Use this model in AADML" @close="linking = null">
      <template v-if="linking">
        <p class="dialog-description">“{{ project.name }} · {{ linking.key }}” is added to your AADML model list, answering through {{ linking.key }}: an app with its own key, allowed only this project's {{ linking.key }}, is made for it. Its calls are recorded like an app's. Remove it here whenever you want; its key is revoked then.</p>
        <div class="dialog-actions"><UiButton @click="linking = null">Cancel</UiButton><UiButton variant="primary" :disabled="busy" @click="link"><Bot :size="14" /> Add to my model list</UiButton></div>
      </template>
    </UiDialog>
    <UiDialog :open="!!unlinking" title="Remove from AADML" @close="unlinking = null">
      <template v-if="unlinking">
        <p class="dialog-description">“{{ unlinking.link?.model_name }}” leaves the AADML model list and its key is revoked: an agent or a workflow that uses it gets an error until it is given another model.</p>
        <div class="dialog-actions"><UiButton @click="unlinking = null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy" @click="unlink">Remove</UiButton></div>
      </template>
    </UiDialog>
    <UiDialog :open="!!revoking" title="Revoke this key" @close="revoking = null">
      <template v-if="revoking">
        <p class="dialog-description">{{ revoking.key.hint }} of “{{ revoking.app.name }}” stops working at once: every request with it is refused from now on. This cannot be undone; make a new key if the app still needs one.</p>
        <div class="dialog-actions"><UiButton @click="revoking = null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy" @click="revokeKey">Revoke key</UiButton></div>
      </template>
    </UiDialog>
    <UiDialog :open="!!deletingApp" title="Delete this app" @close="deletingApp = null">
      <template v-if="deletingApp">
        <p class="dialog-description">"{{ deletingApp.name }}" is deleted with all its keys and its access in every project. Its past calls stay in the usage history. This cannot be undone; to stop it for a while, turn it off instead. Type the app's name to confirm.</p>
        <input v-model="deleteName" class="text-input" :aria-label="`Type ${deletingApp.name} to confirm`" :placeholder="deletingApp.name">
        <div class="dialog-actions"><UiButton @click="deletingApp = null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy || deleteName.trim() !== deletingApp.name" @click="deleteApp">Delete the app</UiButton></div>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.deploy-main{display:flex;flex-direction:column;gap:20px;min-width:0}
.deploy-main>section>h2,.panel>h2{margin-top:0}
.deploy-intro{font-size:13px!important;line-height:1.55;margin:4px 0 14px!important;max-width:820px;color:#475569}
.deploy-meta{font-size:12px!important;color:#475569!important;margin:4px 0!important}
.deploy-error{font-size:12px!important;color:#b42318!important;background:#fff6f5;border:1px solid #fbcfca;border-radius:7px;padding:8px 10px;margin:8px 0!important}
.deploy-warning{font-size:12px;background:#fff8e6;border:1px solid #f5dfa6;color:#7a5a00!important;padding:10px 14px;border-radius:7px;margin:0}
.deploy-starting{display:flex;align-items:center;gap:8px;font-size:12px!important;color:var(--aadml-primary)!important;background:var(--aadml-tint);border-radius:7px;padding:8px 10px;margin:8px 0!important}
.spinner{width:13px;height:13px;border-radius:50%;border:2px solid var(--aadml-soft);border-top-color:var(--aadml-primary);animation:spin 1s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
.env-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.env-card{min-width:0}
.env-card header,.app-block header{display:flex;justify-content:space-between;align-items:center;gap:10px}
.env-card h3,.app-block h3{margin:0}
.env-model{display:flex;align-items:center;gap:8px;margin:12px 0 0!important;font-size:14px}
.env-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}
.text-input.compact{width:auto;padding:8px 10px;font-size:13px;min-height:40px}
.text-input.grow{flex:1;min-width:200px}
.aadml-link{border-top:1px solid #eef0f4;margin-top:14px;padding-top:12px}
.aadml-link h4,.app-cols h4{display:flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#475569;margin:0 0 6px;font-weight:600}
.history{margin-top:12px}
.history summary{cursor:pointer;font-size:12px;color:var(--aadml-primary);min-height:32px;display:flex;align-items:center}
.history td,.history th{padding:8px 10px;font-size:12px}
.approval-row,.download-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-top:1px solid #eef0f4;padding:12px 0}
.approval-row>div:first-child,.download-row>div:first-child{min-width:0;flex:1}
.approval-row .badge,.download-row .badge{margin-left:8px}
.approval-row ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:12px;color:#33415c}
.approval-row li{display:flex;align-items:flex-start;gap:6px}
.approval-row li>svg{color:#27765a;margin-top:3px;flex-shrink:0}
.approval-row li>span{flex:1;min-width:0;overflow-wrap:anywhere}
.approval-row li.revoked{color:#64748b}
.download-row .env-actions{margin-top:0}
.download-row .deploy-meta .badge{margin-left:0;margin-right:6px}
.link-button{background:none;border:0;color:var(--aadml-primary);font-size:12px;padding:4px;text-decoration:underline;cursor:pointer;min-height:28px}
.call-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.call-env{display:flex;align-items:center;gap:8px}
.code-block{white-space:pre;overflow:auto;max-width:100%}
.address{overflow-wrap:anywhere;word-break:break-all;font-size:12px}
.new-key{background:#f3fbf7;border:1px solid #b9e3cf;border-radius:8px;padding:12px 14px;font-size:12px;color:#1f5b45;margin-bottom:12px}
.new-key pre{background:white;border:1px solid #d6eadf;border-radius:6px;padding:10px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;user-select:all}
.app-block{border-top:1px solid #eef0f4;padding-top:14px;margin-top:14px}
.app-head-actions{margin-left:auto;display:flex;gap:6px}
.app-block header .badge{margin-left:8px}
.app-cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px}
.chip{display:inline-flex;align-items:center;gap:4px;background:var(--aadml-soft);color:var(--aadml-primary);border-radius:6px;padding:3px 4px 3px 8px;font-size:12px;margin:0 6px 6px 0}
.chip .icon-button{min-width:24px;min-height:24px;padding:2px}
.key-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;font-size:12px}
.small{min-height:32px;padding:5px 10px;font-size:12px}
.danger{color:#b42318;border-color:#fda29b}
.danger-fill{background:#d92d20;border-color:#d92d20}
.back-choice,.kind-choice label{display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid #e3e6ed;border-radius:7px;margin:8px 0;font-size:13px;cursor:pointer}
.back-choice.off,.kind-choice label.off{opacity:.6;cursor:not-allowed}
.kind-choice{border:0;padding:0;margin:0 0 12px}
a.button{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:8px 14px;border:1px solid #d5dbe5;border-radius:8px;background:white;color:#162139;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;transition:border-color .15s ease,background-color .15s ease}
a.button:hover{border-color:var(--aadml-primary);background:var(--aadml-tint)}
a.button:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.badge--red{color:#b42318;background:#fef3f2}
.badge--amber{color:#93610b;background:#fff4dc}
.empty-state{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
@media(max-width:900px){.env-grid,.app-cols{grid-template-columns:1fr}}
@media(max-width:600px){.approval-row,.download-row{flex-direction:column}.app-head-actions{margin-left:0}.env-card header,.app-block header{flex-wrap:wrap}}
</style>
