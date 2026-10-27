<script setup>
// The Agent page: the Training Assistant, an AADML agent that does Training work with the person's own role in each
// project and asks before it spends compute or changes what is deployed. The conversation happens here, in this app
// (AssistantChat; agentic-docs/TRAINING_DATA_AGENT_CHAT_PLAN.md): nothing sends the person to AADML's chat.
// Its own sidebar holds New chat and the recent conversations; a new conversation opens on a greeting with one large
// message box and things to start from; once a conversation has begun it takes the page, under a line with its title,
// and the sidebar folds away until the person opens it again.
import { computed, inject, nextTick, ref } from 'vue';
import { Sparkles, Plus, MessageSquare, ArrowLeft, PanelLeft, SquarePen, FolderPlus, ClipboardCheck, PenTool, ScanEye, MessagesSquare, ListChecks, Tags, Gauge, Rocket } from 'lucide-vue-next';
import AssistantChat from './AssistantChat.vue';
import { workspaceApi } from '../api/workspace.js';
import { assistantChat } from '../api/assistantChat.js';

const session = inject('session');
const data = ref(null); const error = ref(''); const draft = ref(''); const chatRef = ref(null);
const earlier = ref([]); const activeId = ref(null); const empty = ref(true); const railOpen = ref(false);
async function loadEarlier() {
  if (!data.value?.agent_id) return;
  try { earlier.value = (await assistantChat.conversations(data.value.agent_id)).slice(0, 30); } catch { earlier.value = []; }
}
workspaceApi.assistant().then(body => { data.value = body; loadEarlier(); }).catch(e => { error.value = e.message; });

// The greeting uses the first word of the person's name; an account named by its e-mail address gives the first word of
// the part before the @ ("sajid.r@…" → "Sajid"). The placeholder name of an unnamed account is not a name.
const firstName = computed(() => {
  const name = (session?.user?.name || '').trim();
  if (!name || name === 'Signed-in user') return '';
  const word = (name.includes('@') ? name.split('@')[0].split(/[._+-]/)[0] : name.split(/\s+/)[0]) || '';
  return /^[\p{L}][\p{L}'’-]*$/u.test(word) ? word.charAt(0).toUpperCase() + word.slice(1) : '';
});

// Where a person might start: a click puts it in the message box, ready to send or change.
const starts = [
  { label: 'Create a project', icon: FolderPlus,
    text: 'Create a new training project for me. Ask me what you need to know first.' },
  { label: 'Train a vision model', icon: ScanEye,
    text: 'Train a vision model on my photo project. Tell me which project is ready, the configuration you would use and what it costs before you start.' },
  { label: 'Train a chat model', icon: MessagesSquare,
    text: 'Train a chat model on my chat project. Check that its examples are ready, pick the configuration and tell me the cost before you start.' },
  { label: 'What is ready to train?', icon: ListChecks, text: 'Which of my projects is ready to train, and what is missing in the others?' },
  { label: 'Label my photos', icon: PenTool, text: 'Draw the labels on the unlabelled photos of my project and send them to review. Tell me how many photos and the cost first.' },
  { label: 'Give photos to label', icon: Tags, text: 'Give the next 50 unlabelled photos of my project to a labeller.' },
  { label: 'Review labels', icon: ClipboardCheck, text: 'Review the labels waiting for approval in my project and tell me which need fixing.' },
  { label: 'Evaluate a model', icon: Gauge, text: 'Evaluate the newest model of my project and compare it with the one deployed in staging.' },
  { label: 'Deploy a model', icon: Rocket, text: 'Deploy the newest approved model of my project to staging.' },
];
function start(text) { draft.value = text; nextTick(() => chatRef.value?.focus()); }
function newChat() { railOpen.value = false; chatRef.value?.newChat(); }
function open(id) { railOpen.value = false; if (id !== activeId.value) chatRef.value?.openConversation(id); }
const showRail = computed(() => empty.value || railOpen.value);

// A conversation the server named only after the agent is told apart by its time.
const titleOf = c => (c.title && !/^Chat with /i.test(c.title) ? c.title
  : `Conversation of ${new Date(c.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });
function ago(iso) {
  if (!iso) return '';
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60000);
  if (minutes > -1) return 'now';
  if (minutes > -60) return relative.format(minutes, 'minute');
  if (minutes > -1440) return relative.format(Math.round(minutes / 60), 'hour');
  if (minutes > -43200) return relative.format(Math.round(minutes / 1440), 'day');
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
const touched = c => c.updated_at || c.created_at;
const activeTitle = computed(() => {
  const c = earlier.value.find(x => x.id === activeId.value);
  return c ? titleOf(c) : 'New conversation';
});

// Each of its tools as a person reads it (the notes the backend sends are written for the model). A tool added later
// shows its own note until it is named here.
const CAN = {
  TRAINING_PROJECTS: 'Find your projects and say where each one stands.',
  TRAINING_STATUS: 'Read everything about one project: photos, batches, dataset versions, runs, models, evaluations and what is deployed.',
  TRAINING_PROJECT_CREATE: 'Create a photo or chat-model project for you, after asking its name, its kind and each data-use answer. It asks you first.',
  TRAINING_LABEL: 'Draw walls, windows and doors on photos nobody is working on and send them to review. Only where the project allows an outside AI provider. It asks you first.',
  TRAINING_LABEL_REVIEW: 'Check the labels waiting for approval and say which need fixing.',
  TRAINING_LABEL_SEND_BACK: 'Send a label back to the person who drew it, with the reason.',
  TRAINING_LABEL_ACCEPT: 'Accept labels people drew, when you ask. It asks you first, and never accepts labels it drew itself.',
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
  <div class="ws-agent">
    <aside v-if="data?.agent_id && showRail" id="agent-rail" class="agent-rail" aria-label="Training Assistant conversations">
      <div class="rail-head"><span class="rail-icon"><Sparkles :size="15"/></span>
        <div><strong>{{ data.name || 'Training Assistant' }}</strong><small>Agent</small></div></div>
      <button class="rail-new" type="button" @click="newChat"><Plus :size="15"/> New chat</button>
      <div class="rail-label">RECENT</div>
      <p v-if="!earlier.length" class="rail-empty">Your conversations with the assistant appear here.</p>
      <ul v-else class="rail-list">
        <li v-for="c in earlier" :key="c.id">
          <button type="button" :class="{ active: c.id === activeId }" :aria-current="c.id === activeId ? 'true' : undefined"
                  :title="titleOf(c)" @click="open(c.id)">
            <MessageSquare :size="14" aria-hidden="true"/><span>{{ titleOf(c) }}</span><small>{{ ago(touched(c)) }}</small></button>
        </li>
      </ul>
    </aside>

    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="!data" class="agent-loading" role="status">Loading…</p>
    <section v-else-if="!data.agent_id" class="agent-off panel" role="status">
      <span class="greet-icon"><Sparkles :size="22"/></span>
      <h2>{{ data.name || 'Training Assistant' }}</h2>
      <p>The Training Assistant is not offered to your account right now. An administrator of AADML can switch it on for you.</p>
    </section>

    <header v-if="data?.agent_id && !empty" class="talk-head">
      <button class="talk-icon" type="button" aria-label="Back to a new conversation" title="New conversation" @click="newChat"><ArrowLeft :size="16"/></button>
      <span class="talk-mark"><Sparkles :size="14"/></span>
      <h2 :title="activeTitle">{{ activeTitle }}</h2>
      <button class="talk-icon" type="button" aria-label="New chat" title="New chat" @click="newChat"><SquarePen :size="16"/></button>
      <button class="talk-icon" type="button" :aria-expanded="railOpen" aria-controls="agent-rail"
              :aria-label="railOpen ? 'Hide conversations' : 'Show conversations'" :title="railOpen ? 'Hide conversations' : 'Conversations'"
              @click="railOpen = !railOpen"><PanelLeft :size="16"/></button>
    </header>

    <AssistantChat v-if="!error && data?.agent_id" ref="chatRef" v-model:draft="draft" :agent-id="data.agent_id"
                   @started="loadEarlier" @conversation="id => (activeId = id)" @empty="value => (empty = value)">
      <template #intro>
        <div class="greeting">
          <span class="greet-icon"><Sparkles :size="22"/></span>
          <h1>{{ firstName ? `Hi ${firstName}, what are you training?` : 'What are you training?' }}</h1>
          <p>{{ data.description || 'Plans and does model-training work in your Training projects. It works with your own role in each project and asks you before anything that spends compute or changes what is deployed.' }}</p>
        </div>
      </template>
      <template #below>
        <ul class="starts" aria-label="Start from">
          <li v-for="s in starts" :key="s.label"><button type="button" @click="start(s.text)">
            <component :is="s.icon" :size="15" aria-hidden="true"/>{{ s.label }}</button></li>
        </ul>
        <section v-if="earlier.length" class="recent">
          <h2>Recent</h2>
          <div class="recent-grid">
            <button v-for="c in earlier.slice(0, 3)" :key="c.id" type="button" class="recent-card" @click="open(c.id)">
              <MessageSquare :size="16" aria-hidden="true"/><strong>{{ titleOf(c) }}</strong><small>{{ ago(touched(c)) }}</small>
            </button>
          </div>
        </section>
        <details class="can-do">
          <summary>What it can do</summary>
          <ul><li v-for="tool in data.tools" :key="tool.name">{{ sentence(tool) }}</li></ul>
        </details>
      </template>
    </AssistantChat>
  </div>
</template>

<style scoped>
/* The page fills the space under the top bar, so the conversation scrolls inside it and the message box stays in view. */
.ws-agent{display:flex;flex-direction:column;height:calc(100dvh - 148px);min-height:460px}
.ws-agent:has(.chat--empty){height:auto;min-height:calc(100dvh - 148px)}
@media(min-width:1600px){.ws-agent,.ws-agent:has(.chat--empty){min-height:calc(100dvh - 160px)}.ws-agent{height:calc(100dvh - 160px)}}
@media(max-width:1150px){.ws-agent,.ws-agent:has(.chat--empty){min-height:calc(100dvh - 128px)}.ws-agent{height:calc(100dvh - 128px)}}

.agent-rail{position:fixed;top:0;bottom:0;left:var(--workspace-nav);width:var(--agent-nav);z-index:15;background:#121320;border-right:1px solid #30343f;color:#a9bdd2;padding:16px 12px;display:flex;flex-direction:column;overflow-y:auto}
.rail-head{display:flex;align-items:center;gap:10px;padding:4px 6px 16px}
.rail-head strong{display:block;color:#fff;font-size:13px;font-weight:600}
.rail-head small{display:block;font-size:10px;color:#8b93a6;margin-top:2px}
.rail-icon{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--aadml-primary);color:#fff;flex-shrink:0}
.rail-new{display:flex;align-items:center;gap:8px;width:100%;min-height:40px;border:1px solid #303440;background:#222630;color:#fff;border-radius:9px;padding:0 12px;font-size:12px;font-weight:550}
.rail-new:hover{background:#2b303c;border-color:var(--aadml-focus)}
.rail-label{font-size:9px;letter-spacing:1.6px;font-weight:650;color:#858599;margin:22px 8px 8px}
.rail-empty{font-size:11px;line-height:1.6;color:#8b93a6;padding:0 8px}
.rail-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.rail-list button{width:100%;display:flex;align-items:center;gap:8px;text-align:left;border:1px solid transparent;background:transparent;color:#c3d0de;border-radius:8px;padding:8px;min-height:40px;font-size:12px}
.rail-list button:hover{background:#202430;color:#fff}
.rail-list button.active{background:#232430;border-color:var(--aadml-focus);color:var(--aadml-outline)}
.rail-list svg{color:#7f8aa0}
.rail-list span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rail-list small{font-size:10px;color:#7f8aa0;flex-shrink:0}

.talk-head{display:flex;align-items:center;gap:8px;max-width:760px;width:100%;margin:0 auto 6px;padding-bottom:10px;border-bottom:1px solid #eceef3}
.talk-head h2{flex:1;min-width:0;font-size:14px;font-weight:600;color:#1d2a3d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.talk-mark{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:var(--aadml-primary);color:#fff;flex-shrink:0}
.talk-icon{width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#4c5d74;flex-shrink:0}
.talk-icon:hover{background:#f0f2f6;color:#1d2a3d}
.talk-icon[aria-expanded=true]{background:var(--aadml-soft);color:var(--aadml-primary)}
.agent-loading{font-size:13px;color:#5f6d82;margin:auto}
.agent-off{max-width:560px;margin:auto;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px}
.agent-off p{font-size:13px;color:#4c5d74}

.greeting{text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:10px}
.greeting h1{font-size:30px;letter-spacing:-.8px;color:#1d2a3d;font-weight:650;line-height:1.25}
.greeting p{font-size:13px;line-height:1.65;color:#4c5d74;max-width:62ch}
.greet-icon{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--aadml-primary);color:#fff}

.starts{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.starts button{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:8px 14px;border:1px solid #dadce5;background:#fff;border-radius:999px;font-size:12px;font-weight:550;color:#24324a;transition:background .15s,border-color .15s}
.starts button:hover{background:var(--aadml-tint);border-color:var(--aadml-focus)}
.starts svg{color:var(--aadml-primary)}

.recent{margin-top:34px}
.recent h2{font-size:14px;margin-bottom:12px;color:#1d2a3d}
.recent-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.recent-card{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;min-height:96px;padding:14px;border:1px solid #e0e2ea;background:#fff;border-radius:12px;transition:border-color .15s,box-shadow .15s}
.recent-card:hover{border-color:var(--aadml-outline);box-shadow:0 6px 18px #2563eb10}
.recent-card svg{color:var(--aadml-primary)}
.recent-card strong{font-size:12px;font-weight:600;color:#24324a;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.recent-card small{font-size:11px;color:#6b778a;margin-top:auto}

.can-do{margin-top:24px;border-top:1px solid #e6e8ee;padding-top:14px}
.can-do summary{cursor:pointer;font-size:13px;font-weight:600;color:#24324a;min-height:32px;display:flex;align-items:center}
.can-do ul{list-style:none;margin:6px 0 0;padding:0}
.can-do li{padding:8px 0;border-bottom:1px solid #eef0f4;font-size:12px;line-height:1.55;color:#24324a}
.can-do li:last-child{border-bottom:0}

/* Narrow screens: the sidebar becomes a strip above the conversation, its recent conversations scroll sideways. */
@media(max-width:850px){
  .agent-rail{position:static;width:auto;flex-direction:row;flex-wrap:wrap;align-items:center;gap:8px;border-radius:12px;border:0;padding:10px;margin-bottom:16px;overflow:visible}
  .rail-head,.rail-label,.rail-empty{display:none}
  .rail-new{width:auto;flex-shrink:0}
  .rail-list{flex-direction:row;overflow-x:auto;flex:1;min-width:0;gap:6px}
  .rail-list li{flex:0 0 180px}
  .recent-grid{grid-template-columns:1fr}
}
@media(max-width:700px){
  .ws-agent,.ws-agent:has(.chat--empty){min-height:calc(100dvh - 112px)}.ws-agent{height:calc(100dvh - 112px)}
  .greeting h1{font-size:24px}
  .greeting p{font-size:14px}
}
</style>
