<script setup>
// A project's settings (asked for by the user on 2026-10-16; the old pages had them): its name and address, the five
// data-use answers (data-use/ — each save is a new version, and only the Owner changes them), a language-model project's
// three more answers (llm/data-use/, its own versions; added 2026-10-20 with the user's approval), the apps that send data
// (the Connect app page), and deleting the project. Backend: training_models_data/app_api.py.
import { computed, onMounted, reactive, ref } from 'vue';
import { Check, Copy, ShieldCheck, Trash2, KeyRound } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { getDataUse, saveDataUse, renameProject, trashProject, dataUseAnswers, dataUseForm, getLlmDataUse, saveLlmDataUse, llmDataUseAnswers } from '../api/training.js';

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
});
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
        <fieldset class="policy-card"><legend><span>4</span> Where may the data be stored and processed?</legend><label class="policy-option"><input type="checkbox" checked disabled><div><strong>AADML’s servers</strong><p>Required: this is where the data arrives.</p></div></label><label class="policy-option"><input v-model="form.aws" type="checkbox"><div><strong>Also AADML’s AWS</strong><p>Allow GPU training in AADML’s AWS account.</p></div></label><label class="policy-option"><input v-model="form.ai" type="checkbox"><div><strong>Also an outside AI provider, to draw labels</strong><p>The Training Assistant may send photos to its vision model (OpenAI) to draw first labels. People still review every label.</p></div></label><label class="policy-option"><input v-model="form.local" type="checkbox" disabled><div><strong>Also my own machine for training</strong> <UiBadge>Coming soon</UiBadge><p>Allow data to be sent to a machine you connect yourself.</p></div></label></fieldset>
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
</style>
