<script setup>
// "Workflows apps can call" (VISION_WORKFLOWS_PLAN.md 5.3, ADM-1351 phase 3): the access the workspace's connected apps
// have to its workflows' endpoint, a form to give an app access to a workflow, and how an app calls it. Taking access
// away is confirmed first. Backend: workflow_apps_api.py (api/workflowApps.js). An app's key is never fetched or shown.
import { computed, ref } from 'vue';
import { Ban, Check, Copy, ExternalLink, KeyRound, LoaderCircle, Plus, RefreshCw, Workflow } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { WORKFLOW_BUILDER } from '../api/workspace.js';
import {
  workflowAppsApi, pageOf, workflowLabel, appLabel, emptyReason, giveProblem, inferPathOf, curlExample, grantedText,
} from '../api/workflowApps.js';

const page = ref(null); const error = ref(''); const loading = ref(false); const said = ref('');
const view = computed(() => pageOf(page.value));
const reason = computed(() => (page.value ? emptyReason(view.value) : null));
async function load() {
  if (loading.value) return;
  loading.value = true;
  try { take(await workflowAppsApi.load()); error.value = ''; }
  catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}
function take(body) {
  page.value = body;
  const v = pageOf(body);
  if (!v.apps.some(a => String(a.id) === form.value.app)) form.value.app = v.apps[0] ? String(v.apps[0].id) : '';
  if (!v.workflows.some(w => String(w.id) === form.value.workflow)) form.value.workflow = v.workflows[0] ? String(v.workflows[0].id) : '';
}

// ── give an app access ──────────────────────────────────────────────────────────────────────────────
const form = ref({ app: '', workflow: '' });
const giving = ref(false); const fieldErrors = ref({}); const formError = ref('');
const why = computed(() => (page.value ? giveProblem(view.value, form.value) : ''));
const chosenWorkflow = computed(() => view.value.workflows.find(w => String(w.id) === form.value.workflow) || null);
async function give() {
  fieldErrors.value = {}; formError.value = '';
  if (why.value || giving.value) return;
  giving.value = true;
  try {
    const body = await workflowAppsApi.give(form.value);
    take(body); said.value = body?.said || 'The app may call the workflow.';
  } catch (e) {
    if (e.field === 'app' || e.field === 'workflow') fieldErrors.value = { [e.field]: e.message };
    else formError.value = e.message;
    if (e.code === 'timeout' || e.code === 'network') load();
  } finally { giving.value = false; }
}

// ── take it away, confirmed first ───────────────────────────────────────────────────────────────────
const revoking = ref(null); const revokeBusy = ref(false); const revokeError = ref('');
function askRevoke(grant) { revoking.value = grant; revokeError.value = ''; }
async function confirmRevoke() {
  if (!revoking.value || revokeBusy.value) return;
  revokeBusy.value = true;
  try {
    const body = await workflowAppsApi.revoke(revoking.value.id);
    take(body); said.value = body?.said || 'The access is taken away.';
    revoking.value = null;
  } catch (e) {
    revokeError.value = e.message;
    if (e.code === 'timeout' || e.code === 'network') load();
  } finally { revokeBusy.value = false; }
}

// ── how an app calls it ─────────────────────────────────────────────────────────────────────────────
// The example names the workflow chosen in the form, else the first one an app may call, else the endpoint's pattern.
const exampleWorkflow = computed(() => chosenWorkflow.value?.id ?? view.value.grants[0]?.workflow?.id ?? '');
const examplePath = computed(() => inferPathOf(view.value, exampleWorkflow.value));
const origin = typeof location !== 'undefined' ? location.origin : '';
const example = computed(() => curlExample(origin, examplePath.value));
const copied = ref(false); const copyError = ref('');
async function copy() {
  copyError.value = '';
  try { await navigator.clipboard.writeText(example.value); copied.value = true; setTimeout(() => { copied.value = false; }, 2000); }
  catch { copyError.value = 'The example could not be copied here. Select it in the box and copy it.'; }
}
load();
</script>

<template>
  <section class="wa panel" aria-labelledby="wa-h" :aria-busy="loading" data-test="workflow-apps">
    <header class="wa-head">
      <div>
        <h2 id="wa-h"><KeyRound :size="17" aria-hidden="true"/> Workflows apps can call</h2>
        <p>An app outside AADML, such as your own server, sends an image to a workflow that starts with "Each camera frame" and gets back what the workflow found. It calls only the workflows given to it here, with its own key.</p>
      </div>
      <UiButton :disabled="loading" @click="load"><RefreshCw :size="14" aria-hidden="true"/> Refresh</UiButton>
    </header>

    <div v-if="error" class="wa-error" role="alert">
      <span>{{ error }}</span>
      <UiButton :disabled="loading" data-test="wa-retry" @click="load"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
    </div>
    <p v-if="!page && !error" class="wa-muted" role="status">Loading the apps and workflows…</p>

    <template v-if="page">
      <div v-if="said" class="notice" role="status"><Check :size="16" aria-hidden="true"/><span>{{ said }}</span></div>

      <!-- the access given -->
      <h3 class="wa-sub">Access given</h3>
      <p v-if="!view.grants.length" class="wa-muted" data-test="wa-no-grants">No app may call a workflow yet.</p>
      <ul v-else class="wa-list" aria-label="Apps that may call a workflow">
        <li v-for="g in view.grants" :key="g.id" class="wa-row" data-test="wa-grant">
          <div class="wa-what">
            <strong>{{ g.app?.name }} <span class="wa-arrow" aria-hidden="true">→</span><span class="sr-only"> may call </span> {{ g.workflow?.name }}</strong>
            <small>Given {{ grantedText(g) }}</small>
            <small v-if="g.app?.disabled" class="wa-off"><UiBadge tone="amber">Turned off</UiBadge> Every key of this app is refused until it is turned on again.</small>
          </div>
          <UiButton v-if="g.may && g.may.revoke" :aria-label="`Take away the access of ${g.app?.name} to ${g.workflow?.name}`" data-test="wa-revoke" @click="askRevoke(g)">
            <Ban :size="14" aria-hidden="true"/> Revoke</UiButton>
        </li>
      </ul>

      <!-- give access -->
      <h3 class="wa-sub">Give an app access</h3>
      <div v-if="reason" class="wa-empty" data-test="wa-empty">
        <p>{{ reason.text }}</p>
        <a v-if="reason.kind === 'apps'" class="button" href="#deployments"><Plus :size="14" aria-hidden="true"/> Open Deployments</a>
        <a v-else class="button" :href="WORKFLOW_BUILDER" target="_blank" rel="noopener noreferrer"><Workflow :size="14" aria-hidden="true"/> Open the Workflow Builder<span class="sr-only"> (opens in a new tab)</span><ExternalLink :size="13" aria-hidden="true"/></a>
      </div>
      <form v-else class="wa-form" novalidate @submit.prevent="give">
        <div class="wa-field">
          <label for="wa-app">App</label>
          <select id="wa-app" v-model="form.app" class="text-input" :aria-invalid="!!fieldErrors.app" aria-describedby="wa-app-error" data-test="wa-app">
            <option v-for="a in view.apps" :key="a.id" :value="String(a.id)">{{ appLabel(a) }}</option>
          </select>
          <p id="wa-app-error" class="field-error" aria-live="polite">{{ fieldErrors.app }}</p>
        </div>
        <div class="wa-field">
          <label for="wa-workflow">Workflow</label>
          <select id="wa-workflow" v-model="form.workflow" class="text-input" :aria-invalid="!!fieldErrors.workflow" aria-describedby="wa-workflow-help wa-workflow-error" data-test="wa-workflow">
            <option v-for="w in view.workflows" :key="w.id" :value="String(w.id)">{{ workflowLabel(w) }}</option>
          </select>
          <p id="wa-workflow-help" class="wa-help">{{ chosenWorkflow && !chosenWorkflow.published_version ? 'Its calls are refused until a version of it is published.' : 'The published version answers each call.' }}</p>
          <p id="wa-workflow-error" class="field-error" aria-live="polite">{{ fieldErrors.workflow }}</p>
        </div>
        <div class="wa-actions">
          <p v-if="why" id="wa-why" class="wa-why">{{ why }}</p>
          <p v-if="formError" class="field-error" role="alert">{{ formError }}</p>
          <UiButton type="submit" variant="primary" :disabled="!!why || giving" :aria-describedby="why ? 'wa-why' : undefined" data-test="wa-give">
            <LoaderCircle v-if="giving" class="wa-spin" :size="14" aria-hidden="true"/><Plus v-else :size="14" aria-hidden="true"/> {{ giving ? 'Giving access…' : 'Give access' }}
          </UiButton>
        </div>
      </form>

      <!-- how to call it -->
      <h3 class="wa-sub">How to call it</h3>
      <p v-if="view.infer.note" class="wa-note">{{ view.infer.note }}</p>
      <p class="wa-muted">Address: <code translate="no">{{ examplePath }}</code></p>
      <pre class="wa-code" tabindex="0" aria-label="Example call with curl" data-test="wa-curl"><code translate="no">{{ example }}</code></pre>
      <div class="wa-copy">
        <UiButton data-test="wa-copy" @click="copy"><Check v-if="copied" :size="14" aria-hidden="true"/><Copy v-else :size="14" aria-hidden="true"/> {{ copied ? 'Copied' : 'Copy the example' }}</UiButton>
        <small>Put the app's own key where it says aadml_app_…: a key is shown only once, when it is made.</small>
      </div>
      <p v-if="copyError" class="field-error" role="alert">{{ copyError }}</p>
      <p class="sr-only" aria-live="polite">{{ copied ? 'The example is copied.' : '' }}</p>
    </template>

    <UiDialog :open="!!revoking" title="Take this access away?" @close="revoking=null">
      <template v-if="revoking">
        <p class="dialog-description">{{ revoking.app?.name }} can no longer call {{ revoking.workflow?.name }}: its next call with any of its keys is refused. The app and its keys stay, and access can be given again.</p>
        <p v-if="revokeError" class="field-error" role="alert">{{ revokeError }}</p>
        <div class="dialog-actions">
          <UiButton @click="revoking=null">Keep it</UiButton>
          <UiButton variant="primary" class="wa-danger" :disabled="revokeBusy" data-test="wa-confirm-revoke" @click="confirmRevoke"><Ban :size="14" aria-hidden="true"/> {{ revokeBusy ? 'Taking it away…' : 'Revoke access' }}</UiButton>
        </div>
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.wa{margin-top:24px}
.wa-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.wa-head h2{display:flex;align-items:center;gap:8px;margin:0 0 6px}
.wa-head h2 svg{color:var(--aadml-primary)}
.wa-head p{margin:0;max-width:680px;font-size:13px;color:#4c5d74}
.wa-head .button,.wa .button{min-height:44px}
.wa-sub{margin:22px 0 10px;font-size:14px;color:#162139}
.wa-muted{margin:0!important;font-size:13px!important;color:#5f6d82!important;overflow-wrap:anywhere}
.wa-muted code,.wa-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.wa-error{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:16px 0 0;padding:10px 14px;border:1px solid #efc5ce;border-radius:10px;background:#fff5f6;color:#ad3449;font-size:13px}
.wa .notice{margin:16px 0 0}
.wa-list{list-style:none;margin:0;padding:0;border:1px solid #e3e8f1;border-radius:10px}
.wa-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid #eef0f4}
.wa-row:last-child{border-bottom:0}
.wa-what{display:flex;flex-direction:column;gap:3px;min-width:0}
.wa-what strong{font-size:14px;color:#162139;overflow-wrap:anywhere}
.wa-arrow{color:#5f6d82;font-weight:400}
.wa-what small{font-size:12px;color:#5f6d82;line-height:1.5}
.wa-off{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.wa-off :deep(.badge--amber),.wa-off .badge{color:#93610b;background:#fff4dc}
.wa-empty{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px;border:1px dashed #c3ccda;border-radius:10px;background:#f8f9fb}
.wa-empty p{margin:0;max-width:620px;font-size:13px;color:#33415a}
.wa-empty .button{gap:7px}
.wa-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr)) ;gap:0 14px;align-items:start}
.wa-field{min-width:0}
.wa-field label{display:block;margin:0 0 8px;font-size:13px;font-weight:600;color:#1d2a42}
.wa-field .text-input{min-height:44px;padding:10px 12px;font-size:14px}
.wa-field .field-error:empty{margin:0}
.wa-help{margin:6px 0 0!important;font-size:12px!important;line-height:1.5!important;color:#5f6d82!important}
.wa-actions{grid-column:1 / -1;display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:12px}
.wa-why{margin:0 auto 0 0!important;flex:1 1 220px;font-size:12px!important;line-height:1.5!important;color:#6f4500!important}
.wa-note{margin:0 0 8px!important;max-width:760px;font-size:13px!important;line-height:1.55!important;color:#33415a!important}
.wa-code{margin:8px 0 0;padding:12px 14px;border-radius:9px;background:#0f1729;color:#e6ebf5;font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.wa-code:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px}
.wa-copy{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
.wa-copy small{font-size:12px;color:#5f6d82}
.wa-spin{animation:wa-spin 1.1s linear infinite}
@keyframes wa-spin{to{transform:rotate(360deg)}}
.button--primary.wa-danger{background:#b42318;border-color:#b42318}
.button--primary.wa-danger:hover:not(:disabled){background:#912018;border-color:#912018}
.dialog-actions .button{min-height:44px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:640px){
  .wa-form{grid-template-columns:1fr}
  .wa-actions .button,.wa-row .button{flex:1 1 auto}
  .wa-why{flex-basis:100%}
}
@media(prefers-reduced-motion:reduce){.wa-spin{animation:none}}
</style>
