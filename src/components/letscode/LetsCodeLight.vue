<!--
  LetsCodeLight: Let's Code's light project view for a phone (ADM-1330, LETS_CODE_EDITOR_GAPS_2026_PLAN.md G17). A
  person follows the Coding Agent and steers it without the editor: the project's chats and what each is doing, its
  task list, its approval cards, Stop and reply, and the link to the running app's preview.

  Nothing is drawn twice: the chat on screen IS the editor's chat panel (UnifiedAgentChat: the shared chat store, its
  approval card and Stop, its task list, its reply box), so an approval here is the same person-only `hitl_response`
  the editor sends, checked by the server. The list reads the person's own sessions (projectRuns.js). The editor's
  chat tabs controller is the page's (CODING_CHAT_TABS), so the chats open here are the ones the editor shows.
  Loaded only when it is shown (LetsCode.vue's lazyComponent); never in the first-load bundle.
-->
<template>
  <div class="lcl" :data-theme="theme" data-test="lc-light">
    <header class="lcl-bar">
      <!-- Back: from a chat to the chats (with how many others wait for the person), from the chats to the projects. -->
      <button v-if="screen === 'chat'" type="button" class="lcl-icon lcl-back" data-test="lcl-back-to-chats"
              :aria-label="othersNeedYou ? `${t('light.backToChats')}. ${tn('light.othersNeedYou', othersNeedYou)}` : t('light.backToChats')"
              :title="t('light.backToChats')" @click="showList">
        <Icon icon="lucide:chevron-left" aria-hidden="true" />
        <span v-if="othersNeedYou" class="lcl-badge" aria-hidden="true">{{ othersNeedYou }}</span>
      </button>
      <button v-else type="button" class="lcl-icon" :aria-label="t('light.backToProjects')" :title="t('light.backToProjects')"
              data-test="lcl-projects" @click="emit('back')">
        <Icon icon="lucide:chevron-left" aria-hidden="true" />
      </button>
      <div class="lcl-name">
        <h1 class="lcl-title" :title="project.name">{{ project.name }}</h1>
        <StatusPill :project="project" />
      </div>
      <button type="button" class="lcl-btn" data-test="lcl-full-editor" @click="emit('full-editor')">
        <Icon icon="lucide:code" aria-hidden="true" /> {{ t('light.fullEditor') }}
      </button>
    </header>

    <!-- ============ The project's chats ============ -->
    <div v-show="screen === 'list'" class="lcl-home vm-scroll" data-test="lcl-list">
      <p v-if="!ready" class="lcl-note" role="status">
        <Icon icon="lucide:loader-2" class="spin" aria-hidden="true" /> {{ t('light.preparing') }}
      </p>

      <p v-if="needYou" class="lcl-alert" role="status" data-test="lcl-need-you">
        <Icon icon="lucide:hand" aria-hidden="true" /> {{ tn('light.needYou', needYou) }}
      </p>

      <section class="lcl-sec" aria-labelledby="lcl-chats-h">
        <div class="lcl-sec-head">
          <h2 id="lcl-chats-h" class="lcl-sec-h">{{ t('light.chats') }}</h2>
          <button type="button" class="lcl-btn" :disabled="!ready" data-test="lcl-new-chat" @click="startChat">
            <Icon icon="lucide:plus" aria-hidden="true" /> {{ t('light.newChat') }}
          </button>
        </div>

        <!-- The browser's notification when a chat needs the person and this page is in the background. -->
        <div v-if="permission === 'default'" class="lcl-perm" data-test="lcl-notify">
          <p>{{ t('light.notifyAsk') }}</p>
          <button type="button" class="lcl-btn" @click="askPermission">
            <Icon icon="lucide:bell" aria-hidden="true" /> {{ t('light.notifyTurnOn') }}
          </button>
        </div>

        <ul v-if="loading && !chats.length" class="lcl-list" aria-busy="true" :aria-label="t('light.loadingChats')">
          <li v-for="n in 3" :key="n" class="lcl-skel" aria-hidden="true"><span /><span /></li>
        </ul>
        <p v-else-if="loadError && !chats.length" class="lcl-empty" role="alert">
          {{ t('light.loadError') }}
          <button type="button" class="lcl-link" @click="refresh">{{ t('light.retry') }}</button>
        </p>
        <p v-else-if="!chats.length" class="lcl-empty">{{ t('light.noChats') }}</p>
        <ul v-else class="lcl-list" :aria-label="t('light.chats')">
          <li v-for="c in chats" :key="c.id" class="lcl-row" :class="`is-${c.state}`" :data-test="`lcl-chat-${c.id}`">
            <button type="button" class="lcl-open" :aria-label="t('light.openChat', { title: c.title || t('light.untitled') })"
                    @click="openChat(c)">
              <span class="lcl-row-top">
                <span class="lcl-pill" :class="`p-${c.state}`">
                  <Icon :icon="STATE_ICON[c.state] || STATE_ICON.idle" :class="{ spin: c.state === 'working' }" aria-hidden="true" />
                  {{ stateLabel(c.state) }}
                </span>
                <Icon icon="lucide:chevron-right" class="lcl-chev" aria-hidden="true" />
              </span>
              <span class="lcl-row-title">{{ c.title || t('light.untitled') }}</span>
              <span v-if="c.summary" class="lcl-row-sum">{{ c.summary }}</span>
            </button>
            <div v-if="c.state === 'needs_input' || c.state === 'working'" class="lcl-row-actions">
              <button v-if="c.state === 'needs_input'" type="button" class="lcl-btn primary" data-test="lcl-answer"
                      @click="openChat(c)">
                <Icon icon="lucide:message-circle-question" aria-hidden="true" /> {{ t('light.answer') }}
              </button>
              <button type="button" class="lcl-btn danger" :disabled="!!stopping[c.id]" data-test="lcl-stop"
                      @click="stopChat(c)">
                <Icon :icon="stopping[c.id] ? 'lucide:loader-2' : 'lucide:square'" :class="{ spin: stopping[c.id] }" aria-hidden="true" />
                {{ stopping[c.id] ? t('light.stopping') : t('light.stop') }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- The running app: each port opens AADML's own preview page, which asks for a fresh signed link. -->
      <section class="lcl-sec" aria-labelledby="lcl-preview-h">
        <div class="lcl-sec-head">
          <h2 id="lcl-preview-h" class="lcl-sec-h">{{ t('light.preview') }}</h2>
          <button type="button" class="lcl-icon" :disabled="!ready || portsBusy" :aria-label="t('light.refreshPorts')"
                  :title="t('light.refreshPorts')" @click="loadPorts">
            <Icon icon="lucide:refresh-cw" :class="{ spin: portsBusy }" aria-hidden="true" />
          </button>
        </div>
        <p v-if="!ready" class="lcl-empty">{{ t('light.portsWhenReady') }}</p>
        <p v-else-if="portsError" class="lcl-empty" role="alert">{{ portsError }}</p>
        <p v-else-if="!listening.length" class="lcl-empty">{{ portsBusy ? t('light.readingPorts') : t('light.noPorts') }}</p>
        <ul v-else class="lcl-ports">
          <li v-for="p in listening" :key="p.port">
            <a class="lcl-btn" :href="previewHref(p.port)" target="_blank" rel="noopener" data-test="lcl-preview-link">
              <Icon icon="lucide:monitor-play" aria-hidden="true" /> {{ t('light.openPort', { port: p.port }) }}
              <Icon icon="lucide:external-link" class="lcl-ext" aria-hidden="true" />
            </a>
          </li>
        </ul>
      </section>
    </div>

    <!-- ============ One chat: the editor's own chat panel ============ -->
    <div v-show="screen === 'chat'" class="lcl-chat" data-test="lcl-chat">
      <div class="lcl-chat-body">
        <UnifiedAgentChat
          :system-id="project.system_id" :repo-id="project.repo_id" :crs-ready="ready" :chat-id="chatId"
          @chat-opened="(id) => emit('chat-opened', id)"
          @open-preview="openPreview" @view-changes="emit('full-editor')" @review-changes="emit('full-editor')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, inject, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { confirm } from '@/composables/useConfirm'
import { usePoller } from '@/composables/usePoller'
import { useChatStore } from '@/stores/useChatStore'
import { CODING_CHAT_TABS, createCodingChatTabs } from '@/stores/useCodingChatTabs'
import UnifiedAgentChat from './UnifiedAgentChat.vue'
import StatusPill from './StatusPill.vue'
import { loadRunningRows, projectChats, notifyPermission, requestNotifyPermission, notifyChatNeedsYou } from './projectRuns'
import { t, tn, has } from './messages'

const props = defineProps({
  project: { type: Object, required: true },
  ready: { type: Boolean, default: false },
  // The chat the page's address names: the view opens on it.
  chatId: { type: [String, Number], default: null },
  // The editor's own light or dark (useIdeTheme), so the phone view looks like the editor it stands for.
  theme: { type: String, default: '' },
})
const emit = defineEmits(['back', 'full-editor', 'chat-opened'])

const chat = useChatStore()
const tabs = inject(CODING_CHAT_TABS, null) || createCodingChatTabs()
const screen = ref(props.chatId ? 'chat' : 'list')

const STATE_ICON = { needs_input: 'lucide:message-circle-question', working: 'lucide:loader-2',
  done: 'lucide:circle-check', failed: 'lucide:circle-x', stopped: 'lucide:circle-pause', idle: 'lucide:message-square' }
function stateLabel(s) { return has(`light.state.${s}`) ? t(`light.state.${s}`) : t('light.state.idle') }

// ── The project's chats and what each is doing ──
const conversations = ref([])
const running = ref({})
const loading = ref(true)
const loadError = ref(false)
const GENERIC = /^(new conversation|new chat|untitled chat|chat with .*)$/i
function chatTitle(c) {
  const title = String(c.title || '').trim()
  if (title && !GENERIC.test(title)) return title
  const lm = c.last_message && c.last_message.content
  return lm ? String(lm).slice(0, 60) : ''
}
async function refresh() {
  const repoId = props.project.repo_id
  try {
    const { data } = await api.getConversations({ repository: repoId })
    const list = data?.results || data || []
    conversations.value = Array.isArray(list) ? list : []
    running.value = await loadRunningRows(api, repoId, new Set(conversations.value.map((c) => String(c.id))))
    loadError.value = false
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
  return running.value
}
const chats = computed(() => projectChats({ conversations: conversations.value, running: running.value, chat,
  title: chatTitle }))
const needYou = computed(() => chats.value.filter((c) => c.state === 'needs_input').length)
const othersNeedYou = computed(() => chats.value.filter((c) => c.state === 'needs_input'
  && c.id !== String(chat.conversationId || '')).length)

// Read again on a slow clock (paused while the page is hidden, read at once when it shows again), and soon after
// anything this page hears changes a chat: its own chat's stream or card, a chat left running in this page.
const poller = usePoller(() => refresh(), { interval: 10000 })
let soon = null
function refreshSoon() { clearTimeout(soon); soon = setTimeout(() => { soon = null; refresh() }, 400) }
watch(() => [chat.isBusy, (chat.hitlRequests || []).length, chat.parkedRuns], refreshSoon, { deep: true })
onMounted(() => { poller.start(); loadPorts() })
watch(() => props.ready, (r) => { if (r) { refreshSoon(); loadPorts() } })

// ── A chat that starts waiting for the person while this page is in the background: the browser's notification ──
const permission = ref(notifyPermission())
async function askPermission() { permission.value = await requestNotifyPermission() }
// Only a change seen here is told: what already waited when the page opened is on screen in the list.
let seenStates = null
watch(chats, (list) => {
  if (loading.value) return
  const now = Object.fromEntries(list.map((c) => [c.id, c.state]))
  if (seenStates) {
    for (const c of list) {
      if (c.state === 'needs_input' && seenStates[c.id] !== 'needs_input') {
        notifyChatNeedsYou({ title: t('light.notifyTitle'), body: c.summary || c.title,
          conversationId: c.id, repoId: props.project.repo_id })
      }
    }
  }
  seenStates = now
})

// ── Open a chat, start one, go back ──
function openChat(c) {
  const id = String(c.id)
  let tab = tabs.tabs.find((x) => x.id === id)
  if (!tab) { tab = { key: `l${id}`, id, label: c.title || '' }; tabs.tabs.push(tab) }
  tabs.select(tab)
  screen.value = 'chat'
}
function startChat() {
  tabs.newChat()
  screen.value = 'chat'
}
function showList() {
  screen.value = 'list'
  refresh()
}

// Stop a chat's run. The chat on screen stops as its own Stop button does; another chat gets the same `stop_execution`
// for its conversation, which the server applies only to the person's own run.
const stopping = reactive({})
async function stopChat(c) {
  const ok = await confirm({ title: t('light.stopTitle'), message: t('light.stopMessage', { title: c.title || t('light.untitled') }),
    confirmText: t('light.stop'), cancelText: t('light.cancel'), danger: true })
  if (!ok) return
  stopping[c.id] = true
  try {
    if (c.id === String(chat.conversationId || '')) chat.stop()
    else chat.sendRaw({ type: 'stop_execution', conversation_id: c.id })
  } finally {
    setTimeout(() => { delete stopping[c.id]; refresh() }, 1500)
  }
}

// ── The running app's preview ──
const ports = ref([])
const portsBusy = ref(false)
const portsError = ref('')
const listening = computed(() => ports.value.filter((p) => p && p.listening))
async function loadPorts() {
  if (!props.ready || portsBusy.value) return
  portsBusy.value = true
  portsError.value = ''
  try {
    const { data } = await api.getProjectPorts(props.project.repo_id)
    ports.value = Array.isArray(data?.ports) ? data.ports : []
  } catch (e) {
    const body = e?.response?.data || {}
    portsError.value = body.code === 'RUNNER_STARTING' ? t('light.portsStarting') : (body.error || t('light.portsError'))
  } finally {
    portsBusy.value = false
  }
}
function previewHref(port) { return `/preview/lets-code/${encodeURIComponent(props.project.repo_id)}/${Number(port)}` }
function openPreview(port) {
  try { window.open(previewHref(port), '_blank', 'noopener') } catch { /* the Preview list below has the link */ }
  loadPorts()
}
</script>

<style scoped>
.lcl {
  --lcl-on-solid: white;
  height: 100%; min-height: 0; display: flex; flex-direction: column; background: var(--vm-bg); color: var(--vm-ink);
  font-family: var(--vm-font-sans); overflow-x: hidden;
  padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);
}
.spin { animation: lcl-spin 1s linear infinite; }
@keyframes lcl-spin { to { transform: rotate(360deg); } }

/* ── Top bar ── */
.lcl-bar { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 6px 12px; padding-top: max(6px, env(safe-area-inset-top));
  border-bottom: 1px solid var(--vm-line); background: var(--vm-surface); }
.lcl-name { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.lcl-title { margin: 0; font: 700 16px/1.25 var(--vm-font-display, var(--vm-font-sans)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Buttons: 44 px to touch, a visible focus ring ── */
.lcl-btn, .lcl-icon { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px;
  border: 1px solid var(--vm-line-2); border-radius: 10px; background: var(--vm-surface); color: var(--vm-ink);
  font: 600 14px var(--vm-font-sans); cursor: pointer; text-decoration: none; touch-action: manipulation;
  transition: background-color .15s, border-color .15s, color .15s; }
.lcl-btn { padding: 0 14px; white-space: nowrap; }
.lcl-icon { width: 44px; flex: 0 0 auto; padding: 0; border-color: transparent; background: transparent; color: var(--vm-ink-soft); }
.lcl-btn :deep(svg), .lcl-icon :deep(svg) { width: 18px; height: 18px; flex: 0 0 auto; }
.lcl-btn:hover:not(:disabled), .lcl-icon:hover:not(:disabled) { background: var(--vm-surface-soft); }
.lcl-btn:focus-visible, .lcl-icon:focus-visible, .lcl-open:focus-visible, .lcl-link:focus-visible {
  outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 2px; }
.lcl-btn:disabled, .lcl-icon:disabled { opacity: .5; cursor: not-allowed; }
.lcl-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: var(--lcl-on-solid); }
.lcl-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d, var(--vm-violet)); }
.lcl-btn.danger { color: var(--vm-red-ink, var(--vm-danger)); border-color: color-mix(in srgb, var(--vm-danger) 35%, var(--vm-line-2)); }
.lcl-btn.danger:hover:not(:disabled) { background: color-mix(in srgb, var(--vm-danger) 8%, transparent); }
.lcl-ext { opacity: .7; }
.lcl-link { min-height: 44px; border: none; background: none; color: var(--vm-violet); font: 600 14px var(--vm-font-sans); cursor: pointer; text-decoration: underline; }

/* ── The list screen ── */
.lcl-home { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 12px 16px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 18px; }
.lcl-note, .lcl-alert { display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 10px;
  font-size: 14px; line-height: 1.5; }
.lcl-note { background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.lcl-alert { background: color-mix(in srgb, var(--vm-amber) 14%, var(--vm-surface)); color: var(--vm-ink);
  border: 1px solid color-mix(in srgb, var(--vm-amber) 45%, var(--vm-line)); font-weight: 600; }
.lcl-note :deep(svg), .lcl-alert :deep(svg) { width: 18px; height: 18px; flex: 0 0 auto; }
.lcl-sec { display: flex; flex-direction: column; gap: 10px; }
.lcl-sec-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lcl-sec-h { margin: 0; font: 700 16px/1.3 var(--vm-font-display, var(--vm-font-sans)); }
.lcl-perm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px; border: 1px dashed var(--vm-line-2);
  border-radius: 10px; font-size: 14px; color: var(--vm-ink-soft); }
.lcl-perm p { flex: 1 1 180px; margin: 0; line-height: 1.5; }
.lcl-empty { margin: 0; font-size: 14px; line-height: 1.5; color: var(--vm-ink-soft); }
.lcl-list, .lcl-ports { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.lcl-row { border: 1px solid var(--vm-line); border-radius: 12px; background: var(--vm-surface); overflow: hidden; }
.lcl-row.is-needs_input { border-color: color-mix(in srgb, var(--vm-amber) 55%, var(--vm-line)); }
.lcl-open { display: flex; flex-direction: column; align-items: stretch; gap: 4px; width: 100%; min-height: 44px; padding: 10px 12px;
  border: none; background: transparent; color: inherit; text-align: left; font: inherit; cursor: pointer; }
.lcl-open:hover { background: var(--vm-surface-soft); }
.lcl-row-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lcl-chev { width: 18px; height: 18px; color: var(--vm-ink-faint); }
.lcl-row-title { font: 600 15px/1.4 var(--vm-font-sans); overflow-wrap: anywhere; }
.lcl-row-sum { font-size: 14px; line-height: 1.5; color: var(--vm-ink-soft); overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.lcl-row-actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 12px 12px; }
.lcl-row-actions .lcl-btn { flex: 1 1 120px; }
/* The state: a word AND an icon AND a colour, never colour alone. */
.lcl-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; font: 600 13px var(--vm-font-sans);
  background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.lcl-pill :deep(svg) { width: 14px; height: 14px; }
.lcl-pill.p-needs_input { background: color-mix(in srgb, var(--vm-amber) 18%, var(--vm-surface)); color: var(--vm-ink); }
.lcl-pill.p-working { background: var(--vm-violet-soft); color: var(--vm-violet); }
.lcl-pill.p-failed { color: var(--vm-red-ink, var(--vm-danger)); }
.lcl-skel { display: flex; flex-direction: column; gap: 8px; padding: 14px 12px; border: 1px solid var(--vm-line); border-radius: 12px; }
.lcl-skel span { height: 12px; border-radius: 6px; background: var(--vm-surface-soft); }
.lcl-skel span:first-child { width: 30%; }
.lcl-skel span:last-child { width: 70%; }
.lcl-ports .lcl-btn { width: 100%; justify-content: flex-start; }
.lcl-ports .lcl-ext { margin-left: auto; }

/* ── The chat screen: the editor's chat panel fills it ── */
.lcl-chat { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.lcl-back { position: relative; }
.lcl-badge { position: absolute; top: 2px; right: 0; display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px;
  border-radius: 999px; background: var(--vm-amber); color: var(--vm-ink); font: 700 12px/1 var(--vm-font-sans); }
.lcl-chat-body { flex: 1 1 auto; min-height: 0; padding-bottom: env(safe-area-inset-bottom); }
/* The chat panel's own header (its title and Chat history) is the list screen here: one bar, more of the chat. */
.lcl-chat-body :deep(.uac-head) { display: none; }
/* The shared chat's small controls, made 44 px to touch in this view only (the editor's side panel keeps its own). */
.lcl-chat-body :deep(.msg-action) { min-width: 44px; min-height: 44px; }
.lcl-chat-body :deep(.btn-link), .lcl-chat-body :deep(.amp-btn), .lcl-chat-body :deep(.tms__opt) { min-height: 44px; }

@media (prefers-reduced-motion: reduce) {
  .spin { animation: none; }
  .lcl-btn, .lcl-icon { transition: none; }
}
</style>
