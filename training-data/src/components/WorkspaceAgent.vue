<script setup>
// The Agent page: the Training Assistant, an AADML agent that does Training work with the person's own role in each
// project and asks before it spends compute or changes what is deployed. The conversation is AADML's chat; this page
// says what it does and opens it (backend: app_api.py assistant/, assistant.py).
import { ref } from 'vue';
import { Sparkles, Copy, Check, MessageSquare } from 'lucide-vue-next';
import UiBadge from './UiBadge.vue';
import { workspaceApi, AADML_CHAT } from '../api/workspace.js';

const data = ref(null); const error = ref(''); const copied = ref('');
workspaceApi.assistant().then(body => { data.value = body; }).catch(e => { error.value = e.message; });

// What a person might ask first. Copied, then pasted into the chat: the chat starts empty.
const asks = [
  'Which of my projects is ready to train, and what is missing in the others?',
  'Give the next 50 unlabelled photos of my project to a labeller.',
  'Freeze a new dataset version of my project and start a training run on it.',
  'Compare the newest model of my project with the one deployed in staging.',
];
async function copy(text) {
  try { await navigator.clipboard.writeText(text); copied.value = text; setTimeout(() => { if (copied.value === text) copied.value = ''; }, 2500); }
  catch { error.value = 'This browser did not allow copying. Select the text and copy it yourself.'; }
}
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
      <div class="agent-open">
        <template v-if="data">
          <a v-if="data.url" class="button button--primary" :href="data.url"><MessageSquare :size="16"/> Open a conversation</a>
          <template v-else><a class="button button--primary" :href="AADML_CHAT"><MessageSquare :size="16"/> Open AADML chat</a>
            <span class="muted">The Training Assistant is not offered to your account right now; AADML's chat answers instead.</span></template>
        </template>
        <span v-else class="muted">Loading…</span>
        <span v-if="data?.url" class="muted">The conversation opens in AADML's chat, with the assistant chosen.</span>
      </div>
    </section>

    <div class="agent-grid">
      <section class="panel">
        <h3>What it can do</h3>
        <p class="muted">It works with your own role in each project: what your role may not do, it may not do either.</p>
        <ul v-if="data" class="does"><li v-for="tool in data.tools" :key="tool.name">{{ sentence(tool) }}</li></ul>
      </section>
      <section class="panel">
        <h3>Things to ask</h3>
        <p class="muted">Copy one, open the conversation and paste it.</p>
        <ul class="asks">
          <li v-for="text in asks" :key="text"><span>{{ text }}</span>
            <button class="icon-button" :aria-label="copied===text ? 'Copied' : `Copy: ${text}`" @click="copy(text)"><Check v-if="copied===text" :size="16"/><Copy v-else :size="16"/></button></li>
        </ul>
        <UiBadge v-if="copied" tone="green">Copied</UiBadge>
      </section>
    </div>
  </div>
</template>

<style scoped>
.agent-card{display:flex;flex-direction:column;gap:20px;background:radial-gradient(ellipse at 90% 0,var(--aadml-soft),transparent 60%),#fff;border-color:var(--aadml-outline)}
.agent-head{display:flex;gap:18px;align-items:flex-start}
.agent-head h2{margin:0 0 6px!important;font-size:22px!important}
.agent-head p{margin:0;max-width:68ch;font-size:14px;color:#4c5d74!important}
.agent-icon{width:54px;height:54px;border-radius:14px;display:grid;place-items:center;background:var(--aadml-primary);color:#fff;flex-shrink:0}
.agent-open{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.agent-open .button{min-height:42px;padding:10px 18px;font-size:13px}
.muted{font-size:12px!important;color:#5f6d82!important}
.agent-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:20px}
.agent-grid h3{margin:0 0 6px}
.does,.asks{list-style:none;padding:0;margin:12px 0 0}
.does li{padding:9px 0;border-bottom:1px solid #eef0f4;font-size:13px;line-height:1.55;color:#24324a}
.does li:last-child,.asks li:last-child{border-bottom:0}
.asks li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #eef0f4;font-size:13px;color:#24324a}
.asks .icon-button{min-width:40px;min-height:40px;color:var(--aadml-primary)}
@media(max-width:800px){.agent-grid{grid-template-columns:1fr}.agent-head{flex-direction:column}}
</style>
