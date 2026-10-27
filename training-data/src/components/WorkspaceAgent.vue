<script setup>
// The Agent page: the Training Assistant, an AADML agent that does Training work with the person's own role in each
// project and asks before it spends compute or changes what is deployed. The conversation happens here, in this app
// (AssistantChat; agentic-docs/TRAINING_DATA_AGENT_CHAT_PLAN.md): nothing sends the person to AADML's chat.
import { nextTick, ref } from 'vue';
import { Sparkles, MessageSquare } from 'lucide-vue-next';
import AssistantChat from './AssistantChat.vue';
import { workspaceApi } from '../api/workspace.js';
import { assistantChat } from '../api/assistantChat.js';

const data = ref(null); const error = ref(''); const draft = ref(''); const chatRef = ref(null);
const earlier = ref([]);
async function loadEarlier() {
  if (!data.value?.agent_id) return;
  try { earlier.value = (await assistantChat.conversations(data.value.agent_id)).slice(0, 12); } catch { earlier.value = []; }
}
workspaceApi.assistant().then(body => { data.value = body; loadEarlier(); }).catch(e => { error.value = e.message; });

// What a person might ask first: a click puts it in the message box, ready to send or change.
const asks = [
  'Which of my projects is ready to train, and what is missing in the others?',
  'Give the next 50 unlabelled photos of my project to a labeller.',
  'Freeze a new dataset version of my project and start a training run on it.',
  'Compare the newest model of my project with the one deployed in staging.',
];
function ask(text) { draft.value = text; nextTick(() => chatRef.value?.focus()); }
// A conversation the server named only after the agent is told apart by its time.
const titleOf = c => (c.title && !/^Chat with /i.test(c.title) ? c.title
  : `Conversation at ${new Date(c.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`);
const when = iso => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
// Each of its tools as a person reads it (the notes the backend sends are written for the model). A tool added later
// shows its own note until it is named here.
const CAN = {
  TRAINING_PROJECTS: 'Find your projects and say where each one stands.',
  TRAINING_STATUS: 'Read everything about one project: photos, batches, dataset versions, runs, models, evaluations and what is deployed.',
  TRAINING_BATCH_CREATE: 'Give photos to a person to label, by their e-mail address.',
  TRAINING_DATASET_PUBLISH: 'Freeze the next dataset version from photos whose labels were accepted.',
  TRAINING_RUN_START: 'Start a training run on a frozen dataset version. It asks you first: a run spends compute.',
  TRAINING_RUN_CONTROL: 'Cancel a run or an evaluation, or try a failed one again. It asks you first.',
  TRAINING_EVALUATION_START: 'Measure a model on photos it was never trained on. It asks you first.',
  TRAINING_MODEL_APPROVE: 'Approve a model for staging or production, or reject it. It asks you first.',
  TRAINING_DEPLOY: 'Deploy an approved model, or go back to an earlier one. It asks you first.',
};
const sentence = tool => CAN[tool.name] || (tool.does ? tool.does.charAt(0).toUpperCase() + tool.does.slice(1) : '');
</script>

<template>
  <div class="studio ws-agent">
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <section class="agent-card panel">
      <div class="agent-head">
        <span class="agent-icon"><Sparkles :size="26"/></span>
        <div>
          <h2>{{ data?.name || 'Training Assistant' }}</h2>
          <p>{{ data?.description || 'Plans and does model-training work in your Training projects.' }}</p>
        </div>
      </div>
      <p v-if="!data" class="muted">Loading…</p>
      <p v-else-if="!data.agent_id" class="muted" role="status">The Training Assistant is not offered to your account right
        now. An administrator of AADML can switch it on for you.</p>
    </section>

    <div v-if="data?.agent_id" class="agent-layout">
      <AssistantChat ref="chatRef" v-model:draft="draft" :agent-id="data.agent_id" @started="loadEarlier" />
      <aside class="agent-aside">
        <section class="panel">
          <h3>Earlier conversations</h3>
          <p v-if="!earlier.length" class="muted">Your conversations with the assistant appear here.</p>
          <ul v-else class="earlier">
            <li v-for="c in earlier" :key="c.id"><button type="button" @click="chatRef?.openConversation(c.id)">
              <MessageSquare :size="14" aria-hidden="true"/><span>{{ titleOf(c) }}</span><small>{{ when(c.updated_at || c.created_at) }}</small></button></li>
          </ul>
        </section>
        <section class="panel">
          <h3>Things to ask</h3>
          <p class="muted">Pick one: it goes into the message box, ready to send or change.</p>
          <ul class="asks"><li v-for="text in asks" :key="text"><button type="button" @click="ask(text)">{{ text }}</button></li></ul>
        </section>
        <section class="panel">
          <h3>What it can do</h3>
          <p class="muted">It works with your own role in each project: what your role may not do, it may not do either.</p>
          <ul class="does"><li v-for="tool in data.tools" :key="tool.name">{{ sentence(tool) }}</li></ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.agent-card{display:flex;flex-direction:column;gap:20px;background:radial-gradient(ellipse at 90% 0,var(--aadml-soft),transparent 60%),#fff;border-color:var(--aadml-outline)}
.agent-head{display:flex;gap:18px;align-items:flex-start}
.agent-head h2{margin:0 0 6px!important;font-size:22px!important}
.agent-head p{margin:0;max-width:68ch;font-size:14px;color:#4c5d74!important}
.agent-icon{width:54px;height:54px;border-radius:14px;display:grid;place-items:center;background:var(--aadml-primary);color:#fff;flex-shrink:0}
.muted{font-size:12px!important;color:#5f6d82!important}
.agent-card{gap:10px;padding:22px 24px}
.agent-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;margin-top:20px;align-items:start}
.agent-aside{display:flex;flex-direction:column;gap:16px}
.agent-aside .panel{padding:18px}
.agent-aside h3{margin:0 0 6px;font-size:14px}
.does,.asks,.earlier{list-style:none;padding:0;margin:10px 0 0}
.does li{padding:8px 0;border-bottom:1px solid #eef0f4;font-size:12px;line-height:1.55;color:#24324a}
.does li:last-child,.asks li:last-child,.earlier li:last-child{border-bottom:0}
.asks li,.earlier li{border-bottom:1px solid #eef0f4}
.asks button,.earlier button{width:100%;text-align:left;border:0;background:transparent;padding:10px 6px;min-height:44px;font-size:13px;line-height:1.45;color:#24324a;border-radius:6px}
.asks button:hover,.earlier button:hover{background:var(--aadml-soft)}
.earlier button{display:flex;align-items:center;gap:8px}
.earlier button span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.earlier button small{font-size:11px;color:#6b778a}
.earlier svg{color:var(--aadml-primary)}
@media(max-width:1100px){.agent-layout{grid-template-columns:1fr}}
@media(max-width:800px){.agent-head{flex-direction:column}}
</style>
