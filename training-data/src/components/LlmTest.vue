<script setup>
// The test page's LLM form (plan §2.1, §10.3, §9.4). Chat: talk to a model version, or to the base model it was trained
// from, on a test server only AADML can reach (llm/trials.py); nothing typed is kept. Compare answers: the pairs of an
// evaluation given to this person, two answers side by side in an order fixed at random and without names; the
// person says which is better. Backend: llm/app_api.py.
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { Play, Square, Send, RefreshCw, ArrowLeft, ArrowRight, MessageSquarePlus } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import LlmConversation from './LlmConversation.vue';
import { llmApi } from '../api/llm.js';
import './llm.css';

const props = defineProps({ project: Object, openAssignment: Number });
const emit = defineEmits(['navigate', 'opened']);
const TABS = ['Chat', 'Compare answers'];
const tab = ref('Chat'); const error = ref(''); const told = ref(''); const busy = ref(false);

// ── Chat ──
const chatPage = ref(null); const chatRefused = ref(''); const choice = ref('');
const messages = ref([]); const draft = ref(''); const system = ref('');
const maxTokens = ref(256); const temperature = ref(0); const writing = ref(false); const elapsed = ref(0);
const log = ref(null);
let pollTimer = null; let clock = null;

const trial = computed(() => chatPage.value?.trial || null);
const running = computed(() => ['starting', 'ready'].includes(trial.value?.state));
const chosen = computed(() => (chatPage.value?.choices || []).find(c => key(c) === choice.value));
const key = c => (c.kind === 'version' ? `v${c.version}` : `b${c.base_model}`);
const servesChoice = computed(() => running.value && chosen.value && (chosen.value.kind === 'version'
  ? trial.value.model_version === chosen.value.version : trial.value.model_version == null && trial.value.base_model === chosen.value.base_model));
const trialTone = state => ({ ready: 'green', starting: 'purple' }[state] || 'neutral');

async function loadChat() {
  try {
    chatPage.value = await llmApi.trials(props.project.ref);
    chatRefused.value = '';
    if (!choice.value) {
      const current = chatPage.value.choices.find(c => (trial.value && running.value) && (c.kind === 'version' ? c.version === trial.value.model_version : trial.value.model_version == null && c.base_model === trial.value.base_model));
      choice.value = key(current || chatPage.value.choices[0] || { kind: 'none' });
      maxTokens.value = chatPage.value.default_max_tokens;
    }
  } catch (e) {
    if (e.status === 403) chatRefused.value = 'Only the project’s Owner talks to its models here. The answers given to you to compare are on the other tab.';
    else error.value = e.message;
  }
  clearTimeout(pollTimer);
  if (trial.value?.state === 'starting') pollTimer = setTimeout(loadChat, 3000);
}
async function startServer() {
  if (!chosen.value) return;
  busy.value = true; error.value = '';
  try {
    await llmApi.startTrial(props.project.ref, chosen.value.kind === 'version' ? { model_version: chosen.value.version } : { base_model: chosen.value.base_model });
    messages.value = [];
    await loadChat();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function stopServer() {
  busy.value = true; error.value = '';
  try { await llmApi.stopTrial(props.project.ref); await loadChat(); } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function send() {
  const text = draft.value.trim();
  if (!text || writing.value || trial.value?.state !== 'ready') return;
  error.value = '';
  messages.value.push({ role: 'user', content: text });
  draft.value = '';
  writing.value = true; elapsed.value = 0;
  clock = setInterval(() => { elapsed.value += 1; }, 1000);
  await scrollDown();
  try {
    const sent = [...(system.value.trim() ? [{ role: 'system', content: system.value.trim() }] : []), ...messages.value];
    const answer = await llmApi.chat(props.project.ref, { messages: sent, max_tokens: Number(maxTokens.value), temperature: Number(temperature.value) });
    messages.value.push({ role: 'assistant', content: answer.answer, tokens: answer.completion_tokens, seconds: elapsed.value });
  } catch (e) {
    error.value = e.message;
    messages.value.pop();
    draft.value = text;
    await loadChat();
  } finally {
    clearInterval(clock); writing.value = false;
    await scrollDown();
  }
}
function onKey(event) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }
async function scrollDown() { await nextTick(); log.value?.scrollTo?.({ top: log.value.scrollHeight }); }

// ── Compare answers ──
const compareList = ref(null); const opened = ref(null); const index = ref(0); const note = ref(''); const saving = ref(false);
const pair = computed(() => opened.value?.pairs?.[index.value] || null);
const marked = computed(() => (opened.value?.pairs || []).filter(p => p.decision).length);

async function loadCompare() {
  try { compareList.value = await llmApi.compare(props.project.ref); }
  catch (e) { if (e.status !== 403) error.value = e.message; else compareList.value = { evaluations: [] }; }
}
async function openEvaluation(number) {
  error.value = '';
  try {
    opened.value = await llmApi.comparePairs(props.project.ref, number);
    const next = opened.value.pairs.findIndex(p => !p.decision);
    index.value = next >= 0 ? next : 0;
    note.value = pair.value?.note || '';
  } catch (e) { error.value = e.message; }
}
function go(step) {
  index.value = Math.min(Math.max(index.value + step, 0), opened.value.pairs.length - 1);
  note.value = pair.value?.note || '';
}
async function decide(decision) {
  if (!pair.value || saving.value) return;
  saving.value = true; error.value = ''; told.value = '';
  try {
    const saved = await llmApi.decidePair(props.project.ref, opened.value.number, pair.value.id, { decision, note: note.value });
    opened.value.pairs[index.value] = saved;
    const next = opened.value.pairs.findIndex((p, i) => i > index.value && !p.decision);
    const any = opened.value.pairs.findIndex(p => !p.decision);
    if (next >= 0 || any >= 0) { index.value = next >= 0 ? next : any; note.value = pair.value?.note || ''; told.value = 'Saved. Here is the next pair.'; }
    else { told.value = `Every pair given to you in evaluation ${opened.value.number} is marked. Thank you.`; }
  } catch (e) { error.value = e.message; await openEvaluation(opened.value.number); }
  finally { saving.value = false; }
}
async function back() { opened.value = null; told.value = ''; await loadCompare(); }

onMounted(async () => {
  // A notification's link opens its evaluation's pairs at once; the chat's test server is asked about meanwhile.
  if (props.openAssignment) { tab.value = 'Compare answers'; openEvaluation(props.openAssignment).then(() => emit('opened')); }
  await Promise.all([loadChat(), loadCompare()]);
  if (chatRefused.value) tab.value = 'Compare answers';
});
onUnmounted(() => { clearTimeout(pollTimer); clearInterval(clock); });
</script>

<template>
  <div class="studio llm-test">
    <div class="studio-actions">
      <div class="studio-tabs" role="tablist" aria-label="Test">
        <button v-for="t in TABS" :key="t" role="tab" :aria-selected="tab === t" :class="{ active: tab === t }" @click="tab = t; error = ''; told = ''">{{ t }}</button>
      </div>
      <UiButton @click="tab === 'Chat' ? loadChat() : (opened ? openEvaluation(opened.number) : loadCompare())"><RefreshCw :size="15" /> Refresh</UiButton>
    </div>
    <div v-if="told" class="notice" role="status"><span>{{ told }}</span></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <!-- Chat -->
    <template v-if="tab === 'Chat'">
      <section v-if="chatRefused" class="panel"><p>{{ chatRefused }}</p></section>
      <p v-else-if="!chatPage" class="llm-loading">Loading…</p>
      <section v-else-if="!chatPage.choices.length" class="panel empty-state"><h2>No model to talk to yet</h2><p>Train a model version first; then talk to it, and to the base model it was trained from, here.</p><UiButton @click="emit('navigate', 'train')">Go to training</UiButton></section>
      <template v-else>
        <section class="panel">
          <div class="eyebrow">TEST SERVER</div>
          <h2>Talk to a model before it is approved</h2>
          <div class="llm-test-pick">
            <label class="field-label" for="llm-test-model">Model</label>
            <div class="llm-test-pick-row">
              <select id="llm-test-model" v-model="choice" class="text-input"><option v-for="c in chatPage.choices" :key="key(c)" :value="key(c)" :disabled="c.kind === 'base' && c.ready === false">{{ c.label }}</option></select>
              <UiButton v-if="!servesChoice" variant="primary" :disabled="busy || !chosen" @click="startServer"><Play :size="15" /> {{ busy ? 'Starting…' : running ? 'Switch to this model' : 'Start the test server' }}</UiButton>
              <UiButton v-else :disabled="busy" @click="stopServer"><Square :size="14" /> Stop</UiButton>
            </div>
          </div>
          <p v-if="trial" class="field-help" aria-live="polite">
            <UiBadge :tone="trialTone(trial.state)">{{ trial.state_label }}</UiBadge>
            {{ trial.model }}<template v-if="trial.state === 'starting'"> is loading on the CPU; this takes a minute or two.</template>
            <template v-else-if="trial.state === 'ready'"> answers your messages.</template>
            <template v-else-if="trial.failure"> {{ trial.failure }}</template>
          </p>
          <p class="field-help">Nothing you type here is kept: the conversation lives in this page and is gone when you leave it. One test server runs per project; one nobody uses for 15 minutes is stopped.</p>
        </section>

        <section class="panel llm-chat" aria-label="Conversation">
          <div class="studio-actions"><h2>Conversation</h2><UiButton :disabled="!messages.length || writing" @click="messages = []; error = ''"><MessageSquarePlus :size="15" /> New conversation</UiButton></div>
          <details class="llm-chat-settings"><summary>System message and answer settings</summary>
            <label class="field-label" for="llm-test-system">System message (optional)</label>
            <textarea id="llm-test-system" v-model="system" class="text-input" rows="2" placeholder="For example: You are the support assistant of our shop."></textarea>
            <div class="llm-grid">
              <label class="field-label">Longest answer<select v-model="maxTokens" class="text-input"><option v-for="n in chatPage.max_tokens" :key="n" :value="n">{{ n }} tokens</option></select></label>
              <label class="field-label">Temperature<select v-model="temperature" class="text-input"><option :value="0">0: the same answer every time</option><option :value="0.3">0.3: a little varied</option><option :value="0.7">0.7: varied</option></select></label>
            </div>
          </details>
          <div ref="log" class="llm-chat-log" role="log" aria-live="polite" aria-label="Messages">
            <p v-if="!messages.length && !writing" class="llm-loading">{{ trial?.state === 'ready' ? 'Write the first message below.' : 'Start the test server to talk to the model.' }}</p>
            <div v-for="(m, i) in messages" :key="i" :class="['llm-bubble', `llm-bubble--${m.role}`]">
              <span class="llm-turn-label">{{ m.role === 'user' ? 'You' : trial?.model || 'Model' }}</span>
              <p>{{ m.content || '(an empty answer)' }}</p>
              <small v-if="m.role === 'assistant'">{{ m.tokens != null ? `${m.tokens} tokens · ` : '' }}{{ m.seconds }} s</small>
            </div>
            <div v-if="writing" class="llm-bubble llm-bubble--assistant llm-writing"><span class="llm-turn-label">{{ trial?.model || 'Model' }}</span><p>Writing the answer… {{ elapsed }} s</p></div>
          </div>
          <label class="field-label" for="llm-test-draft">Your message</label>
          <div class="llm-chat-input">
            <textarea id="llm-test-draft" v-model="draft" class="text-input" rows="2" :disabled="trial?.state !== 'ready'" placeholder="Ask what your customers ask. Enter sends; Shift+Enter starts a new line." @keydown="onKey"></textarea>
            <UiButton variant="primary" :disabled="writing || !draft.trim() || trial?.state !== 'ready'" @click="send"><Send :size="15" /> {{ writing ? 'Waiting…' : 'Send' }}</UiButton>
          </div>
        </section>
      </template>
    </template>

    <!-- Compare answers -->
    <template v-else>
      <p v-if="!compareList" class="llm-loading">Loading…</p>
      <template v-else-if="!opened">
        <section v-if="!compareList.evaluations.length" class="panel empty-state"><h2>No answers to compare</h2><p>When an evaluation asks people to mark its answers, the pairs given to you appear here, and you are told by a notification.</p></section>
        <section v-else class="panel">
          <h2>Answers given to you to compare</h2>
          <p class="field-help">Each pair is two answers to the same question: one from the trained model and one from its base model, in an order drawn at random. You are not told which is which.</p>
          <table class="llm-table"><thead><tr><th>Evaluation</th><th>Marked</th><th>State</th></tr></thead><tbody>
            <tr v-for="e in compareList.evaluations" :key="e.number" class="llm-row" tabindex="0" @click="openEvaluation(e.number)" @keydown.enter="openEvaluation(e.number)">
              <td>Evaluation {{ e.number }}</td><td>{{ e.marked }} of {{ e.given }}</td><td><UiBadge :tone="e.open ? 'purple' : 'neutral'">{{ e.open ? 'Waiting for your marks' : 'Closed' }}</UiBadge></td></tr>
          </tbody></table>
        </section>
      </template>
      <template v-else>
        <div class="studio-actions"><UiButton @click="back"><ArrowLeft :size="16" /> All evaluations</UiButton>
          <span class="llm-progress" aria-live="polite">Pair {{ index + 1 }} of {{ opened.pairs.length }} · {{ marked }} marked</span></div>
        <section v-if="pair" class="panel">
          <div class="eyebrow">EVALUATION {{ opened.number }} · {{ pair.set_label.toUpperCase() }}</div>
          <p v-if="!opened.open" class="field-help">This evaluation takes no more marks; what you marked is kept.</p>
          <h2>The question</h2>
          <LlmConversation :content="{ kind: 'chat', messages: pair.prompt }" />
          <dl v-if="pair.reference || pair.rubric" class="llm-facts">
            <template v-if="pair.reference"><dt>Expected answer</dt><dd class="llm-pre">{{ pair.reference }}</dd></template>
            <template v-if="pair.rubric"><dt>Rubric</dt><dd class="llm-pre">{{ pair.rubric }}</dd></template>
          </dl>
          <div class="llm-pair">
            <article class="llm-answer" aria-labelledby="llm-answer-a"><h3 id="llm-answer-a">Answer A</h3><p>{{ pair.answer_a || '(an empty answer)' }}</p></article>
            <article class="llm-answer" aria-labelledby="llm-answer-b"><h3 id="llm-answer-b">Answer B</h3><p>{{ pair.answer_b || '(an empty answer)' }}</p></article>
          </div>
          <label class="field-label" for="llm-pair-note">Note (optional)</label>
          <textarea id="llm-pair-note" v-model="note" class="text-input" rows="2" :disabled="!opened.open" placeholder="Why one is better, if it helps."></textarea>
          <fieldset class="llm-decisions" :disabled="!opened.open || saving">
            <legend class="field-label">Which answer is better?</legend>
            <button v-for="d in opened.decisions" :key="d.value" type="button" :class="['button', pair.decision === d.value ? 'button--primary' : 'button--secondary']" :aria-pressed="pair.decision === d.value" @click="decide(d.value)">{{ d.label }}</button>
          </fieldset>
          <div class="dialog-actions">
            <UiButton :disabled="index === 0" @click="go(-1)"><ArrowLeft :size="15" /> Previous</UiButton>
            <UiButton :disabled="index >= opened.pairs.length - 1" @click="go(1)">Next <ArrowRight :size="15" /></UiButton>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.llm-test{display:grid;gap:16px}
.llm-test .field-label>.text-input{font-weight:400;margin-top:8px}
.llm-test .text-input::placeholder{color:#64748b;font-weight:400}
.llm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:4px 0 0}
.llm-test-pick-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.llm-test-pick-row select{flex:1 1 260px;width:auto}
.llm-chat-settings{margin:8px 0 12px}
.llm-chat-settings summary{cursor:pointer;font-size:13px;color:#334155;min-height:32px;display:flex;align-items:center}
.llm-chat-log{display:grid;gap:10px;max-height:460px;overflow:auto;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;min-height:160px;align-content:start}
.llm-bubble{max-width:min(720px,92%);border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#fff}
.llm-bubble p{margin:4px 0 0;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.55;color:#162139}
.llm-bubble small{display:block;margin-top:6px;color:#475569;font-size:11px}
.llm-bubble--user{justify-self:end;background:#f5f3ff;border-color:#ddd6fe}
.llm-bubble--assistant{justify-self:start;background:#f0fdfa;border-color:#99f6e4}
.llm-turn-label{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#475569}
.llm-writing p{color:#475569}
.llm-chat-input{display:flex;gap:10px;align-items:flex-end}
.llm-chat-input textarea{flex:1;min-width:0;resize:vertical}
.llm-progress{font-size:13px;color:#334155}
.llm-pre{white-space:pre-wrap}
.llm-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0 4px}
.llm-answer{border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;background:#fff;min-width:0}
.llm-answer h3{font-size:13px;color:#334155;margin-bottom:6px}
.llm-answer p{white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.55;color:#162139;margin:0}
.llm-decisions{border:0;padding:0;margin:8px 0 0;display:flex;flex-wrap:wrap;gap:10px}
.llm-decisions legend{margin-bottom:10px}
.llm-decisions .button{min-height:44px}
@media (max-width:700px){.llm-pair{grid-template-columns:1fr}.llm-chat-input{flex-direction:column;align-items:stretch}.llm-decisions .button{flex:1 1 140px}}
</style>
