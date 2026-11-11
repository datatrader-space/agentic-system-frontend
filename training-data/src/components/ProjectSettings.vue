<script setup>
// A project's settings (asked for by the user on 2026-10-16; the old pages had them): its name and address, the five
// data-use answers (data-use/ — each save is a new version, and only the Owner changes them), a language-model project's
// three more answers (llm/data-use/, its own versions; added 2026-10-20 with the user's approval), the apps that send data
// (the Connect app page), and deleting the project. Backend: training_models_data/app_api.py. A vision project's Owner
// also chooses here how a record from an app becomes a training photo: the keys that name its group and the consent text
// kept with it (ADM-1210 §3.2, records_api.py record-fields/).
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { Check, Copy, ShieldCheck, Trash2, KeyRound, Waypoints } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { getDataUse, saveDataUse, renameProject, trashProject, dataUseAnswers, dataUseForm, getLlmDataUse, saveLlmDataUse, llmDataUseAnswers } from '../api/training.js';
import { recordsApi, fieldsBody, fieldsRefusal, placedWords, pathName, takeSettingsFocus } from '../api/records.js';

const props = defineProps({ project: Object });
const emit = defineEmits(['navigate', 'renamed', 'trashed']);
const owner = computed(() => (props.project?.rights || []).includes('manage'));
const name = ref(props.project?.name || ''); const savedName = ref(props.project?.name || '');
const form = reactive({ training: '', access: '', retention: '', aws: false, local: false, ai: false, deletion: false });
const version = ref(0); const loading = ref(true); const error = ref(''); const notice = ref(''); const busy = ref(false);
const deleting = ref(false); const confirmText = ref(''); const copied = ref(false);

// A language-model project's three more answers (llm/data-use/), versioned on their own: personal data, the right to
// train, and whether an AI judge's provider may read its conversations (LLM_TRAINING_POC_PLAN.md §2.1, §9.3).
const llm = computed(() => props.project?.family === 'llm');
const llmForm = reactive({ personal: 'redact', source: '', right: false, judge: false });
const llmVersion = ref(0);

onMounted(async () => {
  if (!owner.value) { loading.value = false; return; }
  try {
    const body = await getDataUse(props.project.ref); Object.assign(form, dataUseForm(body.values)); version.value = body.version;
    if (llm.value) {
      const extra = await getLlmDataUse(props.project.ref);
      Object.assign(llmForm, { personal: extra.values.personal_data, source: extra.values.source, right: extra.values.right_confirmed, judge: extra.values.judge_allowed });
      llmVersion.value = extra.version;
    }
  }
  catch (e) { error.value = e.message; } finally { loading.value = false; }
  if (vision.value) await loadFields();
  if (takeSettingsFocus() === 'record-fields' && fieldsHeading.value) { await nextTick(); fieldsHeading.value.scrollIntoView({ block: 'start' }); fieldsHeading.value.focus({ preventScroll: true }); }
});

// ── From a record to a training photo (a vision project, its Owner) ──
const vision = computed(() => owner.value && props.project?.family === 'vision');
const fields = ref(null); const fieldsLoading = ref(false); const fieldsError = ref(''); const fieldsHeading = ref(null);
const fieldsForm = reactive({ mode: 'keys', paths: [], consent: '' }); const fieldsConfirm = ref(false); const fieldsBusy = ref(false); const fieldsTold = ref('');
const keyLimit = computed(() => fields.value?.limits?.keys ?? 3);
const consentLimit = computed(() => fields.value?.limits?.consent_chars ?? 300);
const consentLength = computed(() => fieldsForm.consent.split(/\s+/).filter(Boolean).join(' ').length);
const fieldsProblem = computed(() => fieldsRefusal(fieldsForm, fields.value?.limits));
function fromFields(body) {
  fields.value = body;
  Object.assign(fieldsForm, { mode: body.group.mode, paths: body.group.mode === 'keys' ? body.group.paths.map(p => [...p]) : [], consent: body.consent.given || '' });
}
async function loadFields() {
  fieldsLoading.value = true; fieldsError.value = '';
  try { fromFields(await recordsApi.fields(props.project.ref)); } catch (e) { fieldsError.value = e.message; } finally { fieldsLoading.value = false; }
}
const chosenAt = key => fieldsForm.paths.findIndex(p => pathName(p) === pathName(key.path));
function toggleKey(key) {
  const at = chosenAt(key);
  if (at >= 0) fieldsForm.paths.splice(at, 1);
  else if (fieldsForm.paths.length < keyLimit.value) fieldsForm.paths.push([...key.path]);
}
function askSaveFields() {
  fieldsError.value = fieldsProblem.value;
  if (!fieldsProblem.value) fieldsConfirm.value = true;
}
async function saveFields() {
  if (fieldsProblem.value) { fieldsError.value = fieldsProblem.value; fieldsConfirm.value = false; return; }
  fieldsBusy.value = true; fieldsError.value = ''; fieldsTold.value = '';
  try { const answer = await recordsApi.saveFields(props.project.ref, fieldsBody(fieldsForm)); fromFields(answer); fieldsTold.value = placedWords(answer); fieldsConfirm.value = false; }
  catch (e) { fieldsError.value = e.message; }
  finally { fieldsBusy.value = false; }
}
async function saveLlmAnswers() {
  const answer = await act(() => saveLlmDataUse(props.project.ref, llmDataUseAnswers(llmForm)), 'The language-model answers are saved as a new version. They apply from now on.');
  if (answer) llmVersion.value = answer.version;
}
async function act(call, said) {
  busy.value = true; error.value = ''; notice.value = '';
  try { const answer = await call(); notice.value = said; return answer; } catch (e) { error.value = e.message; return null; } finally { busy.value = false; }
}
async function rename() {
  const wanted = name.value.trim();
  if (!wanted || wanted === savedName.value) return;
  if (await act(() => renameProject(props.project.ref, wanted), `The project is called “${wanted}” now.`)) { savedName.value = wanted; emit('renamed', wanted); }
}
async function saveAnswers() {
  const answer = await act(() => saveDataUse(props.project.ref, dataUseAnswers(form)), 'The data-use answers are saved as a new version. They apply from now on.');
  if (answer) version.value = answer.version;   // the confirmed rule stays ticked: the saved answers include it
}
async function copyId() {
  try { await navigator.clipboard.writeText(props.project.ref); copied.value = true; setTimeout(() => { copied.value = false; }, 1500); }
  catch { notice.value = `The project id is ${props.project.ref}.`; }
}
async function remove() {
  const answer = await act(() => trashProject(props.project.ref), '');
  if (answer) { deleting.value = false; emit('trashed', savedName.value); }
}
</script>

<template>
  <div class="settings-page">
    <div v-if="notice" class="notice" role="status"><Check :size="16"/><span>{{ notice }}</span></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <section class="panel settings-block">
      <h2>General</h2>
      <form class="settings-row" @submit.prevent="rename">
        <label class="field-label">Project name<input v-model="name" class="text-input" maxlength="150" :readonly="!owner"></label>
        <UiButton v-if="owner" type="submit" :disabled="busy||!name.trim()||name.trim()===savedName">Rename</UiButton>
      </form>
      <div class="settings-row"><label class="field-label">Project id<input class="text-input settings-mono" :value="project.ref" readonly></label><UiButton @click="copyId"><Copy :size="15"/> {{ copied ? 'Copied' : 'Copy' }}</UiButton></div>
      <dl class="settings-facts"><dt>Kind</dt><dd>{{ project.type || '—' }}</dd><dt>Your role</dt><dd>{{ project.role || '—' }}</dd><dt>Visibility</dt><dd>{{ project.details?.visibility || '—' }}</dd></dl>
    </section>

    <section class="panel settings-block">
      <h2><ShieldCheck :size="18"/> Data use <UiBadge v-if="version">Version {{ version }}</UiBadge></h2>
      <p v-if="!owner" class="field-help">Only an Owner of the project sees and changes its data-use answers.</p>
      <p v-else-if="loading">Loading…</p>
      <form v-else class="settings-policy" @submit.prevent="saveAnswers">
        <fieldset class="policy-card"><legend><span>1</span> May this data be used to train models?</legend><label v-for="(choice, index) in ['No', 'Only this project’s own models', 'Also AADML’s shared models']" :key="choice" class="policy-option"><input v-model="form.training" name="training" type="radio" :value="choice"><div><strong>{{ choice }}</strong><p>{{ ['No labeling assignment, dataset version or training run can be made from it.', 'A person must start each step; nothing is trained automatically.', 'Data may also improve models outside this project.'][index] }}</p></div></label></fieldset>
        <fieldset class="policy-card"><legend><span>2</span> How long may AADML keep the data?</legend><div class="retention-options"><label v-for="choice in ['30 days', '90 days', '180 days', '365 days', '730 days', 'Until I delete it']" :key="choice"><input v-model="form.retention" name="retention" type="radio" :value="choice">{{ choice }}</label></div><p>{{ form.retention === 'Until I delete it' ? 'Nothing is deleted automatically under this choice.' : 'Records older than the selected period are removed with their files. This cannot be undone.' }}</p></fieldset>
        <fieldset class="policy-card"><legend><span>3</span> Who may see the data?</legend><label v-for="(choice, index) in ['Only me', 'People I invite to the project', 'Also an outside labeling vendor']" :key="choice" class="policy-option"><input v-model="form.access" name="access" type="radio" :value="choice"><div><strong>{{ choice }}</strong><p>{{ ['Nobody else can be given a role; existing roles would stop working.', 'Invited members can only do what their assigned roles allow.', 'Its data may be given to a labeling company you choose, one assignment at a time.'][index] }}</p></div></label></fieldset>
        <fieldset class="policy-card"><legend><span>4</span> Where may the data be stored and processed?</legend><label class="policy-option"><input type="checkbox" checked disabled><div><strong>AADML’s servers</strong><p>Required: this is where the data arrives.</p></div></label><label class="policy-option"><input v-model="form.aws" type="checkbox"><div><strong>GPU machines AADML rents (RunPod)</strong><p>Allow labelling with SAM 3 and GPU training on RunPod’s servers (Secure Cloud).</p></div></label><label class="policy-option"><input v-model="form.ai" type="checkbox"><div><strong>Also an outside AI provider, to draw labels</strong><p>The Training Assistant may send photos to its vision model (OpenAI) to draw first labels. People still review every label.</p></div></label><label class="policy-option"><input v-model="form.local" type="checkbox" disabled><div><strong>Also my own machine for training</strong> <UiBadge>Coming soon</UiBadge><p>Allow data to be sent to a machine you connect yourself.</p></div></label></fieldset>
        <fieldset class="policy-card"><legend><span>5</span> Deletion on request</legend><p>When a person asks for {{ llm ? 'an example' : 'a photo' }} to be deleted: it is removed within 30 days, left out of every future training, and the models trained on it are listed for you.</p><label class="check-line"><input v-model="form.deletion" type="checkbox"> I confirm this rule</label></fieldset>
        <p class="field-help">Saving makes a new version of the answers; the earlier ones are kept. Choosing “Only me” takes the roles of everyone else away.</p>
        <div class="settings-actions"><UiButton type="submit" variant="primary" :disabled="busy||!form.deletion">Save the answers</UiButton></div>
      </form>
    </section>

    <section v-if="owner && llm && !loading" class="panel settings-block">
      <h2><ShieldCheck :size="18"/> Language-model data use <UiBadge v-if="llmVersion">Version {{ llmVersion }}</UiBadge></h2>
      <form class="settings-policy" @submit.prevent="saveLlmAnswers">
        <fieldset class="policy-card"><legend><span>6</span> Personal data in the text</legend><p>Names, e-mail addresses, phone numbers and similar details found in an example.</p><label v-for="(choice, index) in [['redact', 'Remove it from the text'], ['drop', 'Leave the example out'], ['keep', 'Keep it']]" :key="choice[0]" class="policy-option"><input v-model="llmForm.personal" name="personal" type="radio" :value="choice[0]"><div><strong>{{ choice[1] }}</strong><p>{{ ['It is replaced by a placeholder before anyone reviews or trains on it.', 'An example with personal data is never trained on.', 'I accept that it is used for training. Secrets such as keys and passwords are always removed.'][index] }}</p></div></label></fieldset>
        <fieldset class="policy-card"><legend><span>7</span> Where the data comes from</legend><label class="field-label" for="settings-source">Source<textarea id="settings-source" v-model="llmForm.source" class="text-input settings-text" rows="2" maxlength="2000" placeholder="e.g. Our own support conversations and Help Center articles"></textarea></label><label class="check-line"><input v-model="llmForm.right" type="checkbox"> I confirm we have the right to train on this data</label></fieldset>
        <fieldset class="policy-card"><legend><span>8</span> AI judge</legend><label class="policy-option"><input v-model="llmForm.judge" type="checkbox"><div><strong>Allow an AI judge to read this project’s conversations</strong><p>An AI judge is a bigger AI model (for example Claude or GPT) that marks the trained model’s answers on the Analytics page, within a spending cap. Without this, answers are marked by people only.</p></div></label></fieldset>
        <p class="field-help">Saving makes a new version of these answers; the earlier ones are kept.</p>
        <div class="settings-actions"><UiButton type="submit" variant="primary" :disabled="busy||!llmForm.right">Save the language-model answers</UiButton></div>
      </form>
    </section>

    <section v-if="vision" id="record-fields" class="panel settings-block" aria-labelledby="record-fields-title">
      <h2 id="record-fields-title" ref="fieldsHeading" tabindex="-1"><Waypoints :size="18" aria-hidden="true"/> From a record to a training photo</h2>
      <p class="field-help">When your app sends a photo, its record says which home or place the photo belongs to. Photos of one group always stay on the same side of the split, so a model is never tested on a place it trained on.</p>
      <p v-if="fieldsLoading && !fields">Loading…</p>
      <p v-if="fieldsError" class="field-error" role="alert">{{ fieldsError }}</p>
      <div v-if="fieldsTold" class="notice" role="status"><Check :size="16" aria-hidden="true"/><span>{{ fieldsTold }}</span></div>
      <template v-if="fields">
        <dl class="settings-facts fields-facts">
          <dt>The rule now</dt><dd>{{ fields.rule }}</dd>
          <dt>Records</dt><dd>{{ fields.named }} of {{ fields.records }} record{{ fields.records === 1 ? '' : 's' }} from apps name a group under it.</dd>
          <dt>Unassigned pool</dt><dd>{{ fields.pool }} photo{{ fields.pool === 1 ? '' : 's' }} without a group yet.</dd>
          <dt>Consent kept</dt><dd>{{ fields.consent.in_force }}</dd>
        </dl>
        <form class="settings-policy" @submit.prevent="askSaveFields">
          <fieldset class="policy-card"><legend>How a photo gets its group</legend>
            <label class="policy-option"><input v-model="fieldsForm.mode" name="fields-mode" type="radio" value="keys"><div><strong>From keys of its record</strong><p>Choose up to {{ keyLimit }} keys. The first one the record fills in names the group.</p></div></label>
            <label class="policy-option"><input v-model="fieldsForm.mode" name="fields-mode" type="radio" value="each_photo"><div><strong>Each photo is its own group</strong><p>For an app that names no home or place.</p></div></label>
            <template v-if="fieldsForm.mode === 'keys'">
              <p v-if="!fields.keys.length" class="field-help">No record from an app has arrived yet, so there is no key to choose. The default keys hold until then.</p>
              <ul v-else class="fields-keys" aria-label="Keys found in the records">
                <li v-for="key in fields.keys" :key="pathName(key.path)">
                  <label :class="['fields-key', { 'fields-key--off': chosenAt(key) < 0 && fieldsForm.paths.length >= keyLimit }]">
                    <input type="checkbox" :checked="chosenAt(key) >= 0" :disabled="chosenAt(key) < 0 && fieldsForm.paths.length >= keyLimit" @change="toggleKey(key)">
                    <span class="fields-key-name"><code translate="no">{{ key.name }}</code><small>{{ key.records }} record{{ key.records === 1 ? '' : 's' }}{{ key.example !== '' && key.example != null ? `, for example “${key.example}”` : '' }}</small></span>
                    <UiBadge v-if="chosenAt(key) >= 0" tone="purple">{{ chosenAt(key) + 1 }}</UiBadge>
                  </label>
                </li>
              </ul>
              <p v-if="fieldsForm.paths.length" class="field-help">Read in this order: {{ fieldsForm.paths.map(pathName).join(', then ') }}.</p>
            </template>
          </fieldset>
          <fieldset class="policy-card"><legend>Licence or consent kept with each photo</legend>
            <label class="field-label" for="fields-consent">Text<textarea id="fields-consent" v-model="fieldsForm.consent" class="text-input settings-text" rows="2" name="consent" autocomplete="off" placeholder="e.g. Customer consent given in the FitMyWall app" aria-describedby="fields-consent-count"></textarea></label>
            <p id="fields-consent-count" :class="['field-help', 'fields-count', { 'fields-count--over': consentLength > consentLimit }]" aria-live="polite">{{ consentLength }} of {{ consentLimit }} characters</p>
            <p class="field-help">Left empty, the project keeps the consent of its client, or says none was stated.</p>
          </fieldset>
          <div class="settings-actions"><UiButton type="submit" variant="primary" :disabled="fieldsBusy || !!fieldsProblem">Save how photos get their group</UiButton></div>
        </form>
      </template>
    </section>

    <section class="panel settings-block">
      <h2><KeyRound :size="18"/> Apps that send data</h2>
      <p class="field-help">The keys of the apps that send {{ llm ? 'data' : 'photos' }} to this project, and how to send them.</p>
      <UiButton @click="emit('navigate','connect')">Open Connect app</UiButton>
    </section>

    <section v-if="owner" class="panel settings-block settings-danger">
      <h2><Trash2 :size="18"/> Move this project to the Trash</h2>
      <p class="field-help">It leaves every list at once and its apps can no longer send to it. You can restore it from Workspace Settings → Trash within 30 days; after that it is deleted for good, with its {{ llm ? 'examples' : 'photos' }}, records, labels and files.</p>
      <UiButton class="danger" @click="deleting=true;confirmText=''">Move to Trash</UiButton>
    </section>

    <UiDialog :open="fieldsConfirm" title="Save how photos get their group" @close="fieldsConfirm=false">
      <p class="dialog-description">Groups already given stay as they are. Photos in the unassigned pool get a group now when their record names one under the new rule, and every photo that arrives from now on follows it.</p>
      <p v-if="fieldsError" class="field-error" role="alert">{{ fieldsError }}</p>
      <div class="dialog-actions"><UiButton @click="fieldsConfirm=false">Cancel</UiButton><UiButton variant="primary" :disabled="fieldsBusy" @click="saveFields">{{ fieldsBusy ? 'Saving…' : 'Save' }}</UiButton></div>
    </UiDialog>
    <UiDialog :open="deleting" title="Move this project to the Trash" @close="deleting=false">
      <p class="dialog-description">“{{ savedName }}” leaves every list now and is deleted for good in 30 days unless you restore it. Type the project name to confirm.</p>
      <input v-model="confirmText" class="text-input" :aria-label="`Type ${savedName} to confirm`" :placeholder="savedName">
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <div class="dialog-actions"><UiButton @click="deleting=false">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy||confirmText.trim()!==savedName" @click="remove">Move to Trash</UiButton></div>
    </UiDialog>
  </div>
</template>

<style scoped>
.settings-page{max-width:900px;display:flex;flex-direction:column;gap:18px}
.settings-block h2{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;margin-bottom:12px}
.settings-row{display:flex;align-items:flex-end;gap:10px}
.settings-row .field-label{flex:1;margin:8px 0}
.settings-row .text-input{margin-top:6px}
.settings-mono{font-family:ui-monospace,Consolas,monospace;font-size:12px}
.settings-text{font-weight:400;margin-top:8px;resize:vertical}
.settings-facts{display:grid;grid-template-columns:120px 1fr;gap:6px 12px;font-size:13px;margin-top:10px}
.settings-facts dt{color:#6d7c92}.settings-facts dd{margin:0}
.settings-policy{display:flex;flex-direction:column;gap:12px}
.settings-actions{display:flex;justify-content:flex-end}
.settings-danger{border-color:#fecdca}
/* The question cards, as the New project screen draws them (ProjectCreate.vue). */
.check-line{display:flex;gap:8px;align-items:center;font-size:12px;margin:18px 0}
.policy-card{border:1px solid #e0dfec;border-radius:10px;padding:20px 24px;margin:12px 0 28px}
.policy-card legend{padding:0 8px;font-size:14px;display:flex;align-items:center;gap:10px}
.policy-card legend span{display:grid;place-items:center;width:24px;height:24px;background:var(--aadml-soft);color:var(--accent);border-radius:50%;font-size:11px}
.policy-option{display:flex;align-items:flex-start;gap:10px;padding:10px 0;cursor:pointer}
.policy-option strong{font-size:12px;font-weight:550}
.policy-option p,.policy-card>p{font-size:11px;margin-top:5px}
.retention-options{display:flex;flex-wrap:wrap;gap:20px;font-size:12px;margin-bottom:15px}
.retention-options label{display:flex;gap:7px;align-items:center}
.policy-card{padding:16px}
.policy-card legend{font-size:12px}
.field-label,legend,.check-line{font-size:14px}
.danger{color:#b42318;border-color:#fda29b}
.danger-fill{background:#d92d20;border-color:#d92d20}
.settings-block h2:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:3px;border-radius:4px}
.fields-facts{grid-template-columns:140px 1fr;margin:4px 0 12px}
.fields-keys{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px;max-height:320px;overflow:auto}
.fields-key{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 10px;border:1px solid #e3e8ef;border-radius:8px;cursor:pointer}
.fields-key:focus-within{outline:2px solid var(--aadml-focus);outline-offset:1px}
.fields-key input{flex:none;width:18px;height:18px;margin:0;accent-color:var(--aadml-focus)}
.fields-key--off{cursor:not-allowed;background:#f7f8fb}
.fields-key-name{flex:1;min-width:0}
.fields-key-name code{font-size:12px;color:#24344c;overflow-wrap:anywhere}
.fields-key-name small{display:block;font-size:11px;color:#5f6d82;margin-top:2px;overflow-wrap:anywhere}
.fields-count{font-variant-numeric:tabular-nums;margin:0}
.fields-count--over{color:#b52f40!important}
@media(max-width:600px){.fields-facts{grid-template-columns:1fr}.fields-facts dd{margin-bottom:6px}}
</style>
