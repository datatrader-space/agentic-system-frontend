<script setup>
// The conversation with the Training Assistant, on the Agent page itself (agentic-docs/TRAINING_DATA_AGENT_CHAT_PLAN.md).
// AADML's chat protocol (api/assistantChat.js): the answer as it is written, its steps, and every step that spends
// compute or changes a deployment asked here first (Approve / Reject). Earlier conversations are listed by the page.
import { nextTick, onBeforeUnmount, reactive, ref } from 'vue';
import { Send, Square, Plus, Check, X, Loader2, CircleAlert, CircleCheck } from 'lucide-vue-next';
import { safeMarkdown } from '../markdown.js';
import { addUserMessage, applyEvent, assistantChat, emptyChat, fromHistory, stepLabel } from '../api/assistantChat.js';

const props = defineProps({ agentId: { type: [Number, String], required: true } });
const emit = defineEmits(['started']);
const draft = defineModel('draft', { default: '' });

const chat = reactive(emptyChat());
const sending = ref(false);
const log = ref(null);
const input = ref(null);
let connection = null;

function scrollDown(force = false) {
  nextTick(() => {
    const el = log.value;
    if (!el) return;
    // Follow the answer only when the person is already at the end: never pull them away from what they read.
    if (force || el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  });
}

function connect(conversationId) {
  connection?.close();
  Object.assign(chat, emptyChat(conversationId));
  connection = assistantChat.connect(conversationId, {
    onOpen: () => { chat.connection = 'open'; },
    onClose: () => { chat.connection = 'reconnecting'; },
    onError: () => { chat.connection = 'reconnecting'; },
    onEvent: evt => {
      applyEvent(chat, evt);
      if (evt.type === 'conversation_created' && chat.conversationId) connection.setConversation(chat.conversationId);
      scrollDown();
    },
  });
}
connect(null);
onBeforeUnmount(() => connection?.close());

async function send() {
  const text = draft.value.trim();
  if (!text || sending.value || chat.running) return;
  sending.value = true;
  try {
    if (!chat.conversationId) {
      const made = await assistantChat.start(props.agentId);
      chat.conversationId = made.conversation_id;
      connection.setConversation(chat.conversationId);
      emit('started', chat.conversationId);
    }
    addUserMessage(chat, text);
    draft.value = '';
    connection.sendMessage(text, props.agentId);
    scrollDown(true);
  } catch (error) {
    chat.error = error.message || 'The message could not be sent. Try again.';
  } finally {
    sending.value = false;
    nextTick(() => input.value?.focus());
  }
}

function onKey(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(); }
}

function answer(approval, value) {
  approval.answering = true;
  connection.sendHitlResponse(approval.request_id, value);
}
function decidePlan(decision) { connection.sendPlanDecision(decision, ''); chat.plan = null; }
function stop() { connection.stop(); }

function newChat() { connect(null); draft.value = ''; nextTick(() => input.value?.focus()); }

async function openConversation(id) {
  connect(id);
  try {
    chat.messages = fromHistory(await assistantChat.messages(id));
    scrollDown(true);
  } catch (error) { chat.error = error.message || 'This conversation could not be opened.'; }
}

// What an approval asks, in words: the request's own summary, and the tool and its cost when the payload says them.
// A turn can take a dozen steps: the last few show, the rest on request.
const STEPS_SHOWN = 3;
const openSteps = reactive({});
const shownSteps = m => (openSteps[m.id] ? m.steps : m.steps.slice(-STEPS_SHOWN));

const isQuestion = a => a.response_type === 'choice' || a.response_type === 'text';
const approvalTitle = a => a.summary || stepLabel(a.payload?.tool_name || a.payload?.tool) || 'The assistant asks before this step.';
const approvalCost = a => a.payload?.cost_text || a.payload?.estimated_cost || '';

defineExpose({ newChat, openConversation, focus: () => input.value?.focus() });
</script>

<template>
  <section class="chat panel" aria-label="Conversation with the Training Assistant">
    <header class="chat-head">
      <h2>Conversation</h2>
      <span v-if="chat.connection === 'reconnecting'" class="chat-state" role="status">Reconnecting…</span>
      <button class="button" type="button" @click="newChat"><Plus :size="15"/> New conversation</button>
    </header>

    <div ref="log" class="chat-log" role="log" aria-live="polite" aria-relevant="additions text">
      <p v-if="!chat.messages.length" class="chat-empty">Ask about your projects, or pick one of the questions on this page.
        The assistant works with your own role in each project and asks you before anything that spends
        compute or changes what is deployed.</p>
      <article v-for="m in chat.messages" :key="m.id" class="msg" :class="`msg--${m.role}`">
        <span class="msg-who">{{ m.role === 'user' ? 'You' : 'Training Assistant' }}</span>
        <button v-if="m.steps.length > STEPS_SHOWN && !openSteps[m.id]" type="button" class="steps-more"
                @click="openSteps[m.id] = true">Show all {{ m.steps.length }} steps</button>
        <ul v-if="m.steps.length" class="steps">
          <li v-for="(s, i) in shownSteps(m)" :key="i" :class="`step--${s.state}`">
            <Loader2 v-if="s.state === 'running'" :size="14" class="spin" aria-hidden="true"/>
            <CircleAlert v-else-if="s.state === 'failed'" :size="14" aria-hidden="true"/>
            <CircleCheck v-else :size="14" aria-hidden="true"/>
            <span>{{ s.label || stepLabel(s.tool) }}<template v-if="s.state === 'failed'">: did not work{{ s.error ? ` (${s.error})` : '' }}</template></span>
          </li>
        </ul>
        <div v-if="m.role === 'assistant' && m.text" class="msg-text md" v-html="safeMarkdown(m.text)"></div>
        <p v-else-if="m.role === 'user'" class="msg-text">{{ m.text }}</p>
        <p v-else-if="m.streaming" class="msg-text thinking"><Loader2 :size="14" class="spin" aria-hidden="true"/> Working…</p>
      </article>

      <div v-for="a in chat.approvals" :key="a.request_id" class="approval" role="group" :aria-label="`${isQuestion(a) ? 'Question' : 'Approval'}: ${approvalTitle(a)}`">
        <strong>{{ isQuestion(a) ? 'The assistant asks you' : 'The assistant asks before it does this' }}</strong>
        <p>{{ approvalTitle(a) }}</p>
        <p v-if="approvalCost(a)" class="approval-cost">{{ approvalCost(a) }}</p>
        <!-- A question with choices: one button per choice (AADML's chat sends the option's id), and a free answer
             when the assistant allows one. A question that wants words: a text box. Only a yes/no is Approve/Reject. -->
        <div v-if="a.response_type === 'choice' && a.options.length" class="choices">
          <button v-for="option in a.options" :key="option.id" class="choice" type="button" :disabled="a.answering"
                  @click="answer(a, option.id)"><span>{{ option.title || option.label || option.id }}</span>
            <small v-if="option.description">{{ option.description }}</small></button>
        </div>
        <form v-if="a.response_type === 'text' || (a.response_type === 'choice' && a.payload?.allow_text)" class="answer-row"
              @submit.prevent="(a.reply || '').trim() && answer(a, a.reply.trim())">
          <label class="sr-only" :for="`answer-${a.request_id}`">Your answer</label>
          <input :id="`answer-${a.request_id}`" v-model="a.reply" class="text-input" :disabled="a.answering"
                 :placeholder="a.response_type === 'choice' ? '…or type your own answer' : 'Type your answer'" />
          <button class="button button--primary" type="submit" :disabled="a.answering || !(a.reply || '').trim()">Send</button>
        </form>
        <div v-if="!isQuestion(a)" class="approval-actions">
          <button class="button button--primary" type="button" :disabled="a.answering" @click="answer(a, true)"><Check :size="15"/> Approve</button>
          <button class="button" type="button" :disabled="a.answering" @click="answer(a, false)"><X :size="15"/> Reject</button>
        </div>
      </div>

      <div v-if="chat.plan" class="approval" role="group" aria-label="The assistant's plan">
        <strong>The assistant's plan</strong>
        <ol v-if="(chat.plan.steps || []).length" class="plan-steps">
          <li v-for="(step, i) in chat.plan.steps" :key="i">{{ step.title || step.description || step }}</li>
        </ol>
        <p v-else>{{ chat.plan.summary || 'It asks before it starts.' }}</p>
        <div class="approval-actions">
          <button class="button button--primary" type="button" @click="decidePlan('approve')"><Check :size="15"/> Go ahead</button>
          <button class="button" type="button" @click="decidePlan('reject')"><X :size="15"/> Do not</button>
        </div>
      </div>
    </div>

    <p v-if="chat.error" class="field-error chat-error" role="alert">{{ chat.error }}</p>

    <form class="composer" @submit.prevent="send">
      <label class="sr-only" for="assistant-message">Message to the Training Assistant</label>
      <textarea id="assistant-message" ref="input" v-model="draft" class="text-input" rows="2" maxlength="8000"
                placeholder="Ask the Training Assistant…" @keydown="onKey"></textarea>
      <button v-if="chat.running" class="button" type="button" @click="stop"><Square :size="14"/> Stop</button>
      <button v-else class="button button--primary" type="submit" :disabled="!draft.trim() || sending">
        <Loader2 v-if="sending" :size="15" class="spin" aria-hidden="true"/><Send v-else :size="15"/> Send</button>
    </form>
    <p class="composer-hint">Enter sends; Shift + Enter starts a new line.</p>
  </section>
</template>

<style scoped>
.chat{display:flex;flex-direction:column;gap:14px;padding:22px;min-height:560px}
.chat-head{display:flex;align-items:center;gap:12px}
.chat-head h2{margin:0;font-size:17px}
.chat-head .button{margin-left:auto}
.chat-state{font-size:12px;color:#8a5a00;background:#fff5d9;border-radius:5px;padding:4px 8px}
.chat-log{flex:1;min-height:320px;max-height:62vh;overflow-y:auto;display:flex;flex-direction:column;gap:14px;padding:4px 2px;scroll-behavior:smooth}
.chat-empty{font-size:13px;line-height:1.65;color:#4c5d74;max-width:62ch;margin:auto 0}
.msg{display:flex;flex-direction:column;gap:6px;max-width:min(78ch,92%)}
.msg--user{align-self:flex-end;align-items:flex-end}
.msg-who{font-size:11px;font-weight:600;color:#5f6d82}
.msg-text{font-size:14px;line-height:1.6;color:#1d2a3d;margin:0;overflow-wrap:anywhere}
.msg--user .msg-text{background:var(--aadml-soft);border-radius:12px 12px 2px 12px;padding:10px 14px;white-space:pre-wrap}
.msg--assistant .msg-text{background:#fff;border:1px solid var(--border);border-radius:12px 12px 12px 2px;padding:10px 14px}
.md :deep(p){margin:0 0 8px;color:inherit}.md :deep(p:last-child){margin:0}.md :deep(ul),.md :deep(ol){margin:4px 0 8px;padding-left:20px}
.md :deep(code){background:#f3f4f6;border-radius:4px;padding:1px 4px;font-size:13px}
.thinking{display:inline-flex;align-items:center;gap:8px;color:#5f6d82;background:transparent!important;border:0!important;padding:0!important}
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.steps li{display:flex;align-items:center;gap:7px;font-size:12px;color:#4c5d74}
.steps-more{align-self:flex-start;border:0;background:transparent;color:var(--aadml-primary);font-size:12px;padding:6px 0;min-height:32px}
.steps-more:hover{text-decoration:underline}
.step--done svg{color:#27765a}.step--failed{color:#b52f40!important}.step--running svg{color:var(--aadml-primary)}
.approval{border:1px solid var(--aadml-outline);background:var(--aadml-tint, #f5f8ff);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;max-width:min(78ch,100%)}
.approval strong{font-size:13px;color:#1d2a3d}.approval p{margin:0;font-size:13px;color:#24324a}
.approval-cost{font-weight:600}
.choices{display:flex;flex-direction:column;gap:8px}
.choice{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;border:1px solid var(--aadml-outline);background:#fff;border-radius:8px;padding:10px 12px;min-height:44px;font-size:13px;color:#1d2a3d}
.choice:hover:not(:disabled){background:var(--aadml-soft)}
.choice small{font-size:12px;color:#5f6d82}
.answer-row{display:flex;gap:8px}
.answer-row .text-input{flex:1;padding:10px}
.answer-row .button{min-height:44px}
.approval-actions{display:flex;gap:10px;flex-wrap:wrap}
.approval-actions .button,.composer .button{min-height:44px;padding:10px 16px;font-size:13px}
.plan-steps{margin:0;padding-left:20px;font-size:13px;color:#24324a;line-height:1.6}
.chat-error{margin:0}
.composer{display:flex;gap:10px;align-items:flex-end}
.composer .text-input{flex:1;resize:vertical;min-height:52px;max-height:200px;font-size:14px;line-height:1.5}
.composer-hint{margin:-6px 0 0;font-size:11px;color:#6b778a}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}.chat-log{scroll-behavior:auto}}
@media(max-width:700px){.chat{padding:16px;min-height:0}.chat-log{max-height:none;min-height:240px}.msg{max-width:100%}
  .composer{flex-direction:column;align-items:stretch}.composer .button{width:100%}.msg-text{font-size:16px}.composer .text-input{font-size:16px}}
</style>
