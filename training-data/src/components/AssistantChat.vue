<script setup>
// The conversation with the Training Assistant, on the Agent page itself (agentic-docs/TRAINING_DATA_AGENT_CHAT_PLAN.md).
// AADML's chat protocol (api/assistantChat.js): the answer as it is written, its steps, and every step that spends
// compute or changes a deployment asked here first (Approve / Reject). Earlier conversations are listed by the page.
// Before the first message the page's greeting and suggestions sit around one large message box (slots `intro` and
// `below`); once a conversation has anything in it, the conversation fills the column and the box stays at its foot.
// Photos go with a message (the + button, a drop or a paste): each is stored in the person's conversation and the
// message names them by id, as AADML's chat does, so the agent sees exactly the photos sent with it.
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ArrowUp, Square, Check, X, Copy, ImagePlus, Loader2, CircleAlert, CircleCheck } from 'lucide-vue-next';
import { safeMarkdown } from '../markdown.js';
import { addUserMessage, applyEvent, assistantChat, emptyChat, fromHistory, stepLabel, titleFrom } from '../api/assistantChat.js';

const props = defineProps({ agentId: { type: [Number, String], required: true } });
// started: a new conversation was made (the page lists it); conversation: the one shown now, or null for a new one;
// empty: whether nothing is in the conversation yet (the page shows its start screen).
const emit = defineEmits(['started', 'conversation', 'empty']);
const draft = defineModel('draft', { default: '' });

const chat = reactive(emptyChat());
const sending = ref(false);
const log = ref(null);
const input = ref(null);
const picker = ref(null);
let connection = null;

// The photos waiting to go with the next message. Their previews stay valid while the conversation is shown and are
// released when another one opens.
const MAX_PHOTOS = 4;
const MAX_BYTES = 20 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const photos = ref([]);
const previews = new Set();
const dragging = ref(false);
function preview(file) { const url = URL.createObjectURL(file); previews.add(url); return url; }
function releasePreviews() { previews.forEach(url => URL.revokeObjectURL(url)); previews.clear(); }
function addPhotos(files) {
  for (const file of files) {
    if (!PHOTO_TYPES.includes(file.type)) { chat.error = `${file.name || 'That file'} is not a photo: send a JPEG, PNG or WebP image.`; continue; }
    if (file.size > MAX_BYTES) { chat.error = `${file.name} is larger than 20 MB.`; continue; }
    if (photos.value.length >= MAX_PHOTOS) { chat.error = `Up to ${MAX_PHOTOS} photos go with one message.`; break; }
    photos.value.push({ file, name: file.name, url: preview(file) });
  }
}
function removePhoto(i) { const [gone] = photos.value.splice(i, 1); if (gone) { URL.revokeObjectURL(gone.url); previews.delete(gone.url); } }
function onPick(event) { addPhotos([...(event.target.files || [])]); event.target.value = ''; input.value?.focus(); }
function onDrop(event) { dragging.value = false; addPhotos([...(event.dataTransfer?.files || [])]); }
function onPaste(event) {
  const files = [...(event.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
  if (files.length) { event.preventDefault(); addPhotos(files); }
}

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
  releasePreviews();
  photos.value = [];
  Object.assign(chat, emptyChat(conversationId));
  emit('conversation', conversationId);
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
onBeforeUnmount(() => { connection?.close(); releasePreviews(); });

async function send() {
  const text = draft.value.trim();
  if (!text || sending.value || chat.running) return;
  sending.value = true;
  try {
    if (!chat.conversationId) {
      const made = await assistantChat.start(props.agentId);
      chat.conversationId = made.conversation_id;
      connection.setConversation(chat.conversationId);
      // The name is a convenience: a conversation that could not be renamed keeps the server's name and still works.
      await assistantChat.rename(chat.conversationId, titleFrom(text)).catch(() => {});
      emit('started', chat.conversationId);
      emit('conversation', chat.conversationId);
    }
    // Every photo is stored before the message goes; if one fails, nothing is sent and the photos stay to try again.
    const sent = [...photos.value];
    const attachmentIds = [];
    for (const photo of sent) attachmentIds.push(await assistantChat.upload(chat.conversationId, photo.file));
    photos.value = [];
    addUserMessage(chat, text, sent.map(p => ({ url: p.url, name: p.name })));
    draft.value = '';
    connection.sendMessage(text, props.agentId, null, { attachmentIds });
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
const isEmpty = computed(() => !chat.messages.length && !chat.approvals.length && !chat.plan);
watch(isEmpty, value => emit('empty', value), { immediate: true });

// Copy an answer as it was written (its Markdown), and say so for a moment.
const copied = ref(null);
async function copy(m) {
  try { await navigator.clipboard.writeText(m.text); copied.value = m.id; setTimeout(() => { if (copied.value === m.id) copied.value = null; }, 1600); }
  catch { chat.error = 'The answer could not be copied. Select it and copy it instead.'; }
}

defineExpose({ newChat, openConversation, focus: () => input.value?.focus() });
</script>

<template>
  <section :class="['chat', isEmpty ? 'chat--empty' : 'chat--talking']" aria-label="Conversation with the Training Assistant">
    <span v-if="chat.connection === 'reconnecting'" class="chat-state" role="status">Reconnecting…</span>
    <div v-if="isEmpty" class="chat-intro"><slot name="intro" /></div>

    <div v-show="!isEmpty" ref="log" class="chat-log" role="log" aria-live="polite" aria-relevant="additions text">
      <article v-for="m in chat.messages" :key="m.id" class="msg" :class="`msg--${m.role}`">
        <span class="sr-only">{{ m.role === 'user' ? 'You' : 'Training Assistant' }}</span>
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
        <div v-if="m.role === 'user' && m.images?.length" class="msg-photos">
          <a v-for="(img, i) in m.images" :key="i" :href="img.url" target="_blank" rel="noopener"><img :src="img.url" :alt="img.name || 'Photo sent with the message'" loading="lazy"></a>
        </div>
        <p v-if="m.role === 'user'" class="msg-text">{{ m.text }}</p>
        <p v-else-if="m.streaming" class="msg-text thinking"><Loader2 :size="14" class="spin" aria-hidden="true"/> Working…</p>
        <div v-if="m.role === 'assistant' && m.text && !m.streaming" class="msg-actions">
          <button type="button" :aria-label="copied === m.id ? 'Copied' : 'Copy the answer'" :title="copied === m.id ? 'Copied' : 'Copy'" @click="copy(m)">
            <Check v-if="copied === m.id" :size="14"/><Copy v-else :size="14"/></button>
        </div>
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

    <form :class="['composer', { 'composer--drop': dragging }]" @submit.prevent="send" @click.self="input?.focus()"
          @dragover.prevent="dragging = true" @dragleave.self="dragging = false" @drop.prevent="onDrop">
      <ul v-if="photos.length" class="pending" aria-label="Photos to send">
        <li v-for="(p, i) in photos" :key="p.url"><img :src="p.url" :alt="p.name">
          <button type="button" :aria-label="`Remove ${p.name}`" title="Remove" @click="removePhoto(i)"><X :size="12"/></button></li>
      </ul>
      <label class="sr-only" for="assistant-message">Message to the Training Assistant</label>
      <textarea id="assistant-message" ref="input" v-model="draft" :rows="isEmpty ? 3 : 1" maxlength="8000"
                :placeholder="isEmpty ? 'Describe what you want to train, measure or deploy, or add a photo…' : 'Reply to the Training Assistant…'"
                @keydown="onKey" @paste="onPaste"></textarea>
      <div class="composer-bar">
        <input ref="picker" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple tabindex="-1" aria-hidden="true" @change="onPick">
        <button class="attach" type="button" aria-label="Add a photo" title="Add a photo (JPEG, PNG or WebP)" :disabled="photos.length >= MAX_PHOTOS || sending"
                @click="picker?.click()"><ImagePlus :size="18"/></button>
        <span class="composer-hint">Enter sends · Shift + Enter for a new line</span>
        <button v-if="chat.running" class="send send--stop" type="button" aria-label="Stop the assistant" title="Stop" @click="stop"><Square :size="14"/></button>
        <button v-else class="send" type="submit" aria-label="Send" title="Send" :disabled="!draft.trim() || sending">
          <Loader2 v-if="sending" :size="17" class="spin" aria-hidden="true"/><ArrowUp v-else :size="17"/></button>
      </div>
    </form>
    <div v-if="isEmpty" class="chat-below"><slot name="below" /></div>
  </section>
</template>

<style scoped>
.chat{display:flex;flex-direction:column;gap:14px;width:100%;max-width:760px;margin:0 auto;height:100%;min-height:0;position:relative}
.chat--empty{justify-content:center;padding-bottom:6vh}
.chat-state{position:absolute;top:0;right:0;z-index:1;font-size:12px;color:#8a5a00;background:#fff5d9;border-radius:5px;padding:4px 8px}
.chat-log{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:22px;padding:8px 4px 16px;scroll-behavior:smooth}
.msg{display:flex;flex-direction:column;gap:6px}
.msg--user{align-self:flex-end;align-items:flex-end;max-width:min(64ch,85%);margin-top:8px}
.msg--assistant{max-width:100%}
.msg-text{font-size:14px;line-height:1.7;color:#1d2a3d;margin:0;overflow-wrap:anywhere}
.msg--user .msg-text{background:#f4f5f8;border:1px solid #e1e4ea;border-radius:10px;padding:9px 14px;white-space:pre-wrap}
.md :deep(strong){color:#111a2b;font-weight:600}.md :deep(li){margin:3px 0}
.msg-actions{display:flex;gap:2px;margin-left:-6px}
.msg-actions button{width:32px;height:32px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:#6b778a}
.msg-actions button:hover{background:#f0f2f6;color:#24324a}
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
.approval-actions .button{min-height:44px;padding:10px 16px;font-size:13px}
.plan-steps{margin:0;padding-left:20px;font-size:13px;color:#24324a;line-height:1.6}
.chat-error{margin:0}
.composer{display:flex;flex-direction:column;gap:6px;border:1px solid #d9dce5;border-radius:16px;background:#fff;padding:14px 14px 10px 18px;box-shadow:0 6px 24px #18223410;cursor:text;transition:border-color .15s,box-shadow .15s}
.composer:focus-within{border-color:var(--aadml-focus);box-shadow:0 6px 24px #2563eb1f}
.composer textarea{border:0;outline:none;resize:none;background:transparent;padding:0;font-size:15px;line-height:1.55;color:#1d2a3d;max-height:220px;field-sizing:content;min-height:1.55em}
.chat--empty .composer textarea{min-height:4.65em}
.composer textarea::placeholder{color:#7a8597}
.composer-bar{display:flex;align-items:center;gap:10px}
.composer-hint{margin-right:auto;font-size:11px;color:#6b778a}
.composer--drop{border-color:var(--aadml-primary);background:var(--aadml-tint)}
.attach{width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:#4c5d74;margin-left:-8px}
.attach:hover:not(:disabled){background:#f0f2f6;color:#1d2a3d}
.pending{list-style:none;margin:0 0 4px;padding:0;display:flex;gap:8px;flex-wrap:wrap}
.pending li{position:relative;width:64px;height:64px}
.pending img{width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px solid #e1e4ea;display:block}
.pending button{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:1px solid #fff;background:#1d2a3d;color:#fff;display:grid;place-items:center;padding:0}
.pending button::after{content:'';position:absolute;inset:-11px}
.msg-photos{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.msg-photos img{width:160px;height:120px;object-fit:cover;border-radius:10px;border:1px solid #e1e4ea;display:block}
.send{width:44px;height:44px;border-radius:50%;border:0;display:grid;place-items:center;background:var(--accent);color:#fff;transition:background .15s}
.send:hover:not(:disabled){background:var(--aadml-primary)}
.send:disabled{background:#c9cfda;opacity:1}
.send--stop{background:#1d2a3d}
.chat-intro,.chat-below{width:100%}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}.chat-log{scroll-behavior:auto}}
@media(max-width:700px){.msg{max-width:100%}.msg-text{font-size:16px}.composer textarea{font-size:16px}.composer-hint{display:none}.composer-bar{justify-content:space-between}
  .chat--empty{padding-bottom:0}}
</style>
