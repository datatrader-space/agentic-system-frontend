<script setup>
// A project's Deploy page. Cloud API is real: where each model answers (staging, production), deploying an approved
// model, cancelling a start, going back to an earlier version, approvals, the predict call with the project's own
// address, and — for the project's Owner — the apps that may call it with their keys and access. MCP, batch
// processing, dedicated deployment and dependent workflows have no backend yet and say so.
// Backend: app_api.py deploy/… (deployments.py, connected_apps.py); approvals are the Models page's calls.
import { computed, onUnmounted, ref, watch } from 'vue';
import { Ban, Check, Copy, KeyRound, Plus, RotateCcw, ShieldCheck, Square, Upload, X } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import ApprovalDialog from './ApprovalDialog.vue';
import { deployApi, snippet, liveTag } from '../api/deploy.js';
import { modelsApi, unanswered } from '../api/models.js';

const props = defineProps({ projectRef: { type: String, required: true } });
const emit = defineEmits(['navigate']);
const MODES = ['Cloud API', 'MCP', 'Batch processing', 'Dedicated deployment'];
const mode = ref('Cloud API');
const data = ref(null); const models = ref([]); const error = ref(''); const notice = ref(''); const busy = ref(false);
const chosen = ref({}); const allow = ref({}); const newKey = ref(null); const copied = ref('');

// The page's body, from the page itself or from an action's answer (which carries the whole page).
function take(deploy) {
  data.value = deploy;
  for (const env of deploy.environments) if (!env.deployable.some(m => m.number === chosen.value[env.key])) chosen.value[env.key] = env.deployable[0]?.number ?? null;
  for (const app of deploy.apps || []) if (!allow.value[app.id]) allow.value[app.id] = { environment: 'staging', scope: 'invoke' };
}
async function load() {
  try {
    const [deploy, listed] = await Promise.all([deployApi.load(props.projectRef), modelsApi.load(props.projectRef)]);
    take(deploy); models.value = listed.models.filter(m => m.state === 'registered');
  } catch (e) { error.value = e.message; }
}
// A deployment that is starting is asked about again, 4 s after each answer, until it is live or failed.
let timer = null; let alive = true;
const starting = computed(() => (data.value?.environments || []).some(e => e.starting));
function follow() { clearTimeout(timer); timer = alive && starting.value ? setTimeout(async () => { await load(); follow(); }, 4000) : null; }
watch(starting, follow);
watch(() => props.projectRef, () => { data.value = null; load(); }, { immediate: true });
onUnmounted(() => { alive = false; clearTimeout(timer); });

async function run(call, after) {
  busy.value = true; error.value = ''; notice.value = '';
  try { const answer = await call(); take(answer); notice.value = answer.said; after?.(answer); return true; }
  catch (e) {
    if (unanswered(e)) { await load(); error.value = 'No answer came back, so the page read it again: check below whether it was done before trying again.'; }
    else error.value = e.message;
    return false;
  } finally { busy.value = false; }
}
const deploy = env => run(() => deployApi.act(props.projectRef, env.key, 'deploy', { model: chosen.value[env.key] }));
const cancel = env => run(() => deployApi.act(props.projectRef, env.key, 'cancel'));
const goingBack = ref(null); const backTo = ref(null); const stopping = ref(null);
async function stopEnv() { const env = stopping.value; if (await run(() => deployApi.act(props.projectRef, env.key, 'stop'))) stopping.value = null; }
function askBack(env) { goingBack.value = env; backTo.value = env.earlier.find(m => !m.refused)?.number ?? null; }
async function goBack() { const env = goingBack.value; if (await run(() => deployApi.act(props.projectRef, env.key, 'rollback', { model: backTo.value }))) goingBack.value = null; }

// Approvals (the Models page's calls, through the shared dialog).
const approving = ref(null);
async function approved(answer) { approving.value = null; notice.value = answer.said; error.value = ''; await load(); }
async function approvalUnanswered() { approving.value = null; await load(); error.value = 'No answer came back, so the page read it again: check below whether it was done before trying again.'; }

// Apps (the project's Owner).
const appName = ref(''); const revoking = ref(null); const deletingApp = ref(null); const deleteName = ref('');
const setAppOn = (app, on) => run(() => deployApi.app(props.projectRef, app.id, on ? 'enable' : 'disable', {}));
async function deleteApp() {
  const app = deletingApp.value;
  if (await run(() => deployApi.app(props.projectRef, app.id, 'delete', { confirm: deleteName.value.trim() }))) { deletingApp.value = null; deleteName.value = ''; }
}
async function addApp() { if (await run(() => deployApi.addApp(props.projectRef, appName.value.trim()))) appName.value = ''; }
const makeKey = app => run(() => deployApi.app(props.projectRef, app.id, 'key', {}), answer => { newKey.value = answer.new_key; });
const grant = app => run(() => deployApi.app(props.projectRef, app.id, 'grant', allow.value[app.id]));
const ungrant = (app, row) => run(() => deployApi.app(props.projectRef, app.id, 'ungrant', {}, row.id));
async function revokeKey() { const { app, key } = revoking.value; if (await run(() => deployApi.app(props.projectRef, app.id, 'key-revoke', {}, key.id))) revoking.value = null; }

// The predict call.
const language = ref('Python'); const callEnv = ref('staging');
const code = computed(() => (data.value ? snippet(language.value, data.value.predict_url, callEnv.value) : ''));
async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); copied.value = what; setTimeout(() => { if (copied.value === what) copied.value = ''; }, 2000); }
  catch { error.value = 'The browser did not allow copying. Select the text and copy it.'; }
}
const when = iso => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const stateTone = s => ({ live: 'green', failed: 'red', retired: 'neutral', starting: 'purple' }[s] || 'neutral');
</script>

<template>
  <div class="deploy-page">
    <div v-if="notice" class="notice" role="status"><Check :size="16"/><span>{{ notice }}</span><button class="icon-button" aria-label="Dismiss" @click="notice=''"><X :size="14"/></button></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="!data&&!error">Loading…</p>
    <div v-else-if="data" class="deploy-layout">
      <nav aria-label="Ways to deploy">
        <button v-for="m in MODES" :key="m" :class="{active:mode===m}" @click="mode=m">{{ m }}<UiBadge v-if="m!=='Cloud API'" tone="purple">Coming soon</UiBadge></button>
      </nav>
      <div v-if="mode!=='Cloud API'" class="panel soon">
        <h2>{{ mode }}</h2><UiBadge tone="purple">Coming soon</UiBadge>
        <p>{{ mode }} is not available in AADML yet. The Cloud API is how an app asks a model of this project for predictions today.</p>
        <UiButton @click="mode='Cloud API'">Open Cloud API</UiButton>
      </div>
      <div v-else class="deploy-main">
        <p v-if="data.serving_refused" class="deploy-warning">{{ data.serving_refused }}</p>
        <section>
          <h2>Where the model answers</h2>
          <p class="deploy-intro">A model answers an app only from a deployment. Staging is for demos and tests; production is what a customer's app calls. A model is deployed only with an approval, and it becomes live only once its endpoint passes a health check. A version that is replaced is kept, and can be gone back to.</p>
          <div class="env-grid">
            <article v-for="env in data.environments" :key="env.key" class="panel env-card">
              <header><h3>{{ env.label }}</h3><UiBadge :tone="liveTag(env)[0]">{{ liveTag(env)[1] }}</UiBadge></header>
              <template v-if="env.live">
                <p class="env-model"><strong>{{ env.live.model.name }} {{ env.live.model.version }}</strong><UiBadge v-if="env.live.model.smoke" tone="amber">Smoke test</UiBadge></p>
                <p class="deploy-meta">Revision {{ env.live.number }}<template v-if="env.live.rollback_of"> · going back from revision {{ env.live.rollback_of }}</template> · live since {{ when(env.live.live_at) }}</p>
              </template>
              <p v-else class="deploy-meta">No model answers in {{ env.label.toLowerCase() }} yet.</p>
              <p v-if="env.live_rejected" class="deploy-error"><strong>The model that answers here was rejected.</strong> {{ env.live_rejected_reason }} It keeps answering until another version replaces it.</p>
              <p v-if="env.starting" class="deploy-starting"><span class="spinner" aria-hidden="true"></span>Revision {{ env.starting.number }} with {{ env.starting.model.name }} {{ env.starting.model.version }} is starting. It becomes live when its endpoint passes the health check<template v-if="env.live">; until then revision {{ env.live.number }} keeps answering</template>.</p>
              <p v-else-if="env.failed" class="deploy-error"><strong>Revision {{ env.failed.number }} did not go live.</strong> {{ env.failed.failure_reason }}<template v-if="env.live"> Revision {{ env.live.number }} is still answering.</template></p>
              <div v-if="data.may.train" class="env-actions">
                <UiButton v-if="env.starting" :disabled="busy" @click="cancel(env)"><Ban :size="14"/> Cancel revision {{ env.starting.number }}</UiButton>
                <template v-else>
                  <template v-if="env.deployable.length">
                    <select v-model.number="chosen[env.key]" class="text-input compact" :aria-label="`Model to deploy to ${env.label.toLowerCase()}`"><option v-for="m in env.deployable" :key="m.number" :value="m.number">{{ m.name }} {{ m.version }}{{ m.smoke ? ' (smoke)' : '' }}</option></select>
                    <UiButton variant="primary" :disabled="busy||!!data.serving_refused" @click="deploy(env)"><Upload :size="14"/> Deploy to {{ env.label.toLowerCase() }}</UiButton>
                  </template>
                  <span v-else class="deploy-meta">No model has an approval for {{ env.label.toLowerCase() }}.{{ env.key==='production' ? ' Production needs a release approval.' : '' }}</span>
                  <UiButton v-if="env.earlier.length" :disabled="busy" @click="askBack(env)"><RotateCcw :size="14"/> Go back to an earlier version…</UiButton>
                  <UiButton v-if="env.live" class="danger" :disabled="busy" @click="stopping=env"><Square :size="13"/> Stop {{ env.label.toLowerCase() }}…</UiButton>
                </template>
              </div>
              <details v-if="env.history.length" class="history">
                <summary>Revisions of {{ env.label.toLowerCase() }} ({{ env.history.length }})</summary>
                <div class="table-wrap"><table>
                  <thead><tr><th>Revision</th><th>Model</th><th>State</th><th>By</th><th>Started</th><th>What happened</th></tr></thead>
                  <tbody><tr v-for="r in env.history" :key="r.number">
                    <td><strong>{{ r.number }}</strong><span v-if="r.rollback_of" class="deploy-meta"> · back from {{ r.rollback_of }}</span></td>
                    <td>{{ r.model.name }} {{ r.model.version }}</td><td><UiBadge :tone="stateTone(r.state)">{{ r.state_label }}</UiBadge></td>
                    <td>{{ r.by || '—' }}</td><td>{{ when(r.created_at) }}</td><td>{{ r.failure_reason || '—' }}</td></tr></tbody>
                </table></div>
              </details>
            </article>
          </div>
        </section>

        <section class="panel">
          <h2>Approvals</h2>
          <p class="deploy-intro">An approval is a person's recorded decision that a model may be deployed. It covers exactly the file that was approved. A demo approval reaches staging; only a release approval reaches production.</p>
          <p v-if="!models.length" class="deploy-meta">No model to approve yet. A model appears here when a training run has succeeded.</p>
          <div v-for="m in models" :key="m.number" class="approval-row">
            <div><strong>{{ m.name }} {{ m.version }}</strong><UiBadge v-if="m.smoke" tone="amber">Smoke test</UiBadge>
              <ul>
                <li v-for="a in m.approvals.filter(x => x.active)" :key="a.id"><ShieldCheck :size="13"/><span><strong>{{ a.kind_label }}</strong> — {{ a.by }}, {{ when(a.at) }}: {{ a.note }}</span>
                  <button v-if="m.may.act" class="link-button" :disabled="busy" @click="approving={type:'revoke', model:m, approval:a}">Revoke…</button></li>
                <li v-if="!m.approvals.some(x => x.active)" class="deploy-meta">Not approved.</li>
              </ul>
              <details v-if="m.approvals.some(x => !x.active)" class="history">
                <summary>Earlier approvals, revoked ({{ m.approvals.filter(x => !x.active).length }})</summary>
                <ul><li v-for="a in m.approvals.filter(x => !x.active)" :key="a.id" class="revoked"><span>{{ a.kind_label }} — {{ a.by }}, {{ when(a.at) }}: {{ a.note }}. Revoked {{ when(a.revoked_at) }}<template v-if="a.revoked_by"> by {{ a.revoked_by }}</template><template v-if="a.revoke_reason">: {{ a.revoke_reason }}</template></span></li></ul>
              </details>
            </div>
            <UiButton v-if="m.may.act" :disabled="busy" @click="approving={type:'approve', model:m}">Approve…</UiButton>
          </div>
        </section>

        <section class="panel">
          <div class="call-head"><h2>How an app asks for a prediction</h2>
            <label class="deploy-meta">Environment <select v-model="callEnv" class="text-input compact"><option value="staging">Staging</option><option value="production">Production</option></select></label></div>
          <div class="studio-tabs"><button v-for="l in ['Python','JavaScript','HTTP / cURL']" :key="l" :class="{active:language===l}" @click="language=l">{{ l }}</button></div>
          <pre class="code-block">{{ code }}</pre>
          <UiButton @click="copy(code,'code')"><Copy :size="15"/> {{ copied==='code' ? 'Copied' : 'Copy' }}</UiButton>
          <p class="deploy-meta">The file is a JPEG, PNG or WebP room photo of at most {{ data.max_mb }} MB; the photo is not kept. The answer is an fmw-predict.v1 document that names the model version and revision that made it. An app needs a key and access to the environment (below).</p>
        </section>

        <section v-if="data.apps" class="panel">
          <h2>Apps that may call the model</h2>
          <p class="deploy-intro">An app is a system outside AADML, such as a customer's own server. Per environment it can be allowed two things only: to ask for predictions, and to send corrections back. It can never start a training run or read the project's photos.</p>
          <div v-if="newKey" class="new-key" role="status">
            <strong>A key for {{ newKey.app }}: copy it now.</strong> It is shown only this once; AADML keeps its fingerprint, not the key.
            <pre>{{ newKey.key }}</pre>
            <div class="env-actions"><UiButton @click="copy(newKey.key,'key')"><Copy :size="14"/> {{ copied==='key' ? 'Copied' : 'Copy key' }}</UiButton><UiButton @click="newKey=null">I have copied it</UiButton></div>
          </div>
          <form class="env-actions" @submit.prevent="addApp">
            <input v-model="appName" class="text-input grow" maxlength="120" placeholder="App name, e.g. FitMyWall backend" aria-label="Name of the new app">
            <UiButton type="submit" variant="primary" :disabled="busy||!appName.trim()"><Plus :size="14"/> Add an app</UiButton>
          </form>
          <p v-if="!data.apps.length" class="deploy-meta">No app yet. Add one, allow it what it needs, then make it a key.</p>
          <article v-for="app in data.apps" :key="app.id" class="app-block">
            <header><h3>{{ app.name }}</h3><UiBadge v-if="app.disabled" tone="amber">Turned off</UiBadge>
              <span v-if="app.can_manage" class="app-head-actions">
                <UiButton class="small" :disabled="busy" @click="setAppOn(app, app.disabled)">{{ app.disabled ? 'Turn on' : 'Turn off' }}</UiButton>
                <UiButton class="small danger" :disabled="busy" @click="deletingApp=app;deleteName=''">Delete…</UiButton>
              </span></header><p v-if="app.other_projects" class="deploy-meta">Also used by {{ app.other_projects }} other project{{ app.other_projects === 1 ? '' : 's' }} of this workspace: turning it off or deleting it stops it there too.</p>
            <p v-if="app.disabled" class="deploy-meta">Turned off: every key of this app is refused until it is turned on again.</p>
            <div class="app-cols">
              <div>
                <h4>Access to this project</h4>
                <p v-if="!app.grants.length" class="deploy-meta">None yet.</p>
                <span v-for="g in app.grants" :key="g.id" class="chip">{{ g.environment_label }} · {{ g.scope_label }}
                  <button v-if="app.can_manage" class="icon-button" :aria-label="`Take away ${g.scope_label.toLowerCase()} in ${g.environment_label.toLowerCase()}`" :disabled="busy" @click="ungrant(app,g)"><X :size="12"/></button></span>
                <div v-if="app.can_manage" class="env-actions">
                  <select v-model="allow[app.id].environment" class="text-input compact" aria-label="Environment"><option value="staging">Staging</option><option value="production">Production</option></select>
                  <select v-model="allow[app.id].scope" class="text-input compact" aria-label="What it may do"><option v-for="s in data.scopes" :key="s.value" :value="s.value">{{ s.label }}</option></select>
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
                    <template v-else><span class="deploy-meta">{{ k.last_used_at ? `used ${when(k.last_used_at)} · ${k.request_count} call${k.request_count===1?'':'s'}` : 'never used' }}</span>
                      <UiButton class="danger small" :disabled="busy" @click="revoking={app, key:k}"><Ban :size="13"/> Revoke</UiButton></template>
                  </div>
                  <UiButton :disabled="busy" @click="makeKey(app)"><KeyRound :size="14"/> Make a key</UiButton>
                </template>
              </div>
            </div>
          </article>
        </section>

        <section class="panel">
          <h2>Dependent workflows</h2><UiBadge tone="purple">Coming soon</UiBadge>
          <p class="deploy-intro">Workflows that run when a model of this project answers are not available yet.</p>
        </section>
      </div>
    </div>

    <UiDialog :open="!!goingBack" title="Go back to an earlier version" @close="goingBack=null">
      <template v-if="goingBack">
        <p class="dialog-description">The version you choose is started again in {{ goingBack.label.toLowerCase() }}. It replaces the live revision once its endpoint passes the health check; until then what answers now keeps answering.</p>
        <label v-for="m in goingBack.earlier" :key="m.number" class="back-choice" :class="{off:!!m.refused}">
          <input v-model.number="backTo" type="radio" name="back-to" :value="m.number" :disabled="!!m.refused">
          <span><strong>{{ m.name }} {{ m.version }}</strong> · was live as revision {{ m.was_live }}<span v-if="m.refused" class="deploy-meta"> — {{ m.refused }}</span></span>
        </label>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <div class="dialog-actions"><UiButton @click="goingBack=null">Cancel</UiButton><UiButton variant="primary" :disabled="busy||backTo===null" @click="goBack">Go back</UiButton></div>
      </template>
    </UiDialog>
    <UiDialog :open="!!revoking" title="Revoke this key" @close="revoking=null">
      <template v-if="revoking">
        <p class="dialog-description">{{ revoking.key.hint }} of “{{ revoking.app.name }}” stops working at once: every request with it is refused from now on. This cannot be undone; make a new key if the app still needs one.</p>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <div class="dialog-actions"><UiButton @click="revoking=null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy" @click="revokeKey">Revoke key</UiButton></div>
      </template>
    </UiDialog>
    <UiDialog :open="!!stopping" title="Stop this environment" @close="stopping=null">
      <template v-if="stopping">
        <p class="dialog-description">{{ stopping.live.model.name }} {{ stopping.live.model.version }} stops answering on {{ stopping.label.toLowerCase() }} at once; apps calling it get "no model is deployed" until you deploy a version or go back to one. Nothing is deleted.</p>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <div class="dialog-actions"><UiButton @click="stopping=null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy" @click="stopEnv">Stop {{ stopping.label.toLowerCase() }}</UiButton></div>
      </template>
    </UiDialog>
    <UiDialog :open="!!deletingApp" title="Delete this app" @close="deletingApp=null">
      <template v-if="deletingApp">
        <p class="dialog-description">"{{ deletingApp.name }}" is deleted with all its keys and its access in every project. Its past calls stay in the usage history. This cannot be undone; to stop it for a while, turn it off instead. Type the app's name to confirm.</p><p v-if="deletingApp.other_projects" class="field-error">It also serves {{ deletingApp.other_projects }} other project{{ deletingApp.other_projects === 1 ? '' : 's' }} of this workspace, which stop working with it.</p>
        <input v-model="deleteName" class="text-input" :aria-label="`Type ${deletingApp.name} to confirm`" :placeholder="deletingApp.name">
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <div class="dialog-actions"><UiButton @click="deletingApp=null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy||deleteName.trim()!==deletingApp.name" @click="deleteApp">Delete the app</UiButton></div>
      </template>
    </UiDialog>
    <ApprovalDialog :asked="approving" :project-ref="projectRef" @close="approving=null" @done="approved" @unanswered="approvalUnanswered"/>
  </div>
</template>

<style scoped>
.deploy-layout{align-items:start}
.deploy-layout nav button{display:flex;align-items:center;justify-content:space-between;gap:6px}
.deploy-main{display:flex;flex-direction:column;gap:20px;min-width:0}
.deploy-main>section>h2,.panel>h2{margin-top:0}
.deploy-intro{font-size:12px!important;margin:4px 0 14px!important;max-width:820px}
.deploy-meta{font-size:12px!important;color:#6d7c92!important;margin:4px 0!important}
.deploy-error{font-size:12px!important;color:#b42318!important;background:#fff6f5;border:1px solid #fbcfca;border-radius:7px;padding:8px 10px;margin:8px 0!important}
.deploy-warning{font-size:12px;background:#fff8e6;border:1px solid #f5dfa6;color:#7a5a00!important;padding:10px 14px;border-radius:7px;margin:0}
.deploy-starting{display:flex;align-items:center;gap:8px;font-size:12px!important;color:var(--aadml-primary)!important;background:var(--aadml-tint);border-radius:7px;padding:8px 10px;margin:8px 0!important}
.spinner{width:13px;height:13px;border-radius:50%;border:2px solid var(--aadml-soft);border-top-color:var(--aadml-primary);animation:spin 1s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
.env-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.env-card header,.app-block header{display:flex;justify-content:space-between;align-items:center;gap:10px}
.env-card h3,.app-block h3{margin:0}
.env-model{display:flex;align-items:center;gap:8px;margin:12px 0 0!important;font-size:13px}
.env-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}
.text-input.compact{width:auto;padding:8px 10px;font-size:12px}
.text-input.grow{flex:1;min-width:200px}
.history{margin-top:12px}
.history summary,.json summary{cursor:pointer;font-size:12px;color:var(--aadml-primary)}
.history td,.history th{padding:8px 10px;font-size:12px}
.approval-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-top:1px solid #eef0f4;padding:12px 0}
.approval-row ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:12px;color:#33415c}
.approval-row li{display:flex;align-items:flex-start;gap:6px}
.approval-row li>svg{color:#27765a;margin-top:3px}
.approval-row li>span{flex:1;min-width:0}
.approval-row li.revoked{color:#8a94a6}
.approval-row .history ul{margin-top:6px}
.approval-row .badge{margin-left:8px}
.link-button{background:none;border:0;color:var(--aadml-primary);font-size:12px;padding:0 4px;text-decoration:underline}
.call-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.code-block{white-space:pre;overflow:auto}
.new-key{background:#f3fbf7;border:1px solid #b9e3cf;border-radius:8px;padding:12px 14px;font-size:12px;color:#1f5b45;margin-bottom:12px}
.new-key pre{background:white;border:1px solid #d6eadf;border-radius:6px;padding:10px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;user-select:all}
.app-block{border-top:1px solid #eef0f4;padding-top:14px;margin-top:14px}
.app-head-actions{margin-left:auto;display:flex;gap:6px}
.app-block header .badge{margin-left:8px}
.app-cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px}
.app-cols h4{font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#6d7c92;margin:0 0 6px;font-weight:600}
.chip{display:inline-flex;align-items:center;gap:4px;background:var(--aadml-soft);color:var(--aadml-primary);border-radius:6px;padding:3px 4px 3px 8px;font-size:11px;margin:0 6px 6px 0}
.chip .icon-button{min-width:20px;min-height:20px;padding:2px}
.key-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;font-size:12px}
.small{min-height:28px;padding:5px 9px;font-size:11px}
.danger{color:#b42318;border-color:#fda29b}
.danger-fill{background:#d92d20;border-color:#d92d20}
.back-choice{display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid #e3e6ed;border-radius:7px;margin:8px 0;font-size:12px;cursor:pointer}
.back-choice.off{opacity:.6;cursor:not-allowed}
.soon{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.badge--red{color:#b42318;background:#fef3f2}
.badge--amber{color:#93610b;background:#fff4dc}
@media(max-width:900px){.env-grid,.app-cols{grid-template-columns:1fr}.deploy-layout{grid-template-columns:1fr}.deploy-layout nav{border-right:0;display:flex;overflow:auto}}
</style>
