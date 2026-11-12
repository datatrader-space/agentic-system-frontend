<!--
  UnifiedAgentChat: the Let's Code coding chat. It is the SAME chat as the main agent chat, the Super Agent and
  Video Studio (owner, 2026-11-06): the shared chat store streams the turn and ChatMessageList draws it (the step
  timeline, the answer, tokens, approvals). What is Let's Code's own stays here: the chat history of this project, and the lines a project turn adds under
  its answer (the files it changed, linking to Source control; a permission ask; the running app's preview). The agent is the one shared Coding Agent; the socket is the project's
  (ws/chat/repository/<id>/, the store's `repoId`). No native dialogs: useNotify only.
-->
<template>
  <div class="uac">
    <div class="uac-head">
      <span class="uac-title"><Icon icon="lucide:sparkles" aria-hidden="true" /> Coding agent</span>
      <div class="uac-head-actions">
        <div class="uac-hwrap">
          <button type="button" class="uac-hbtn" :class="{ on: historyOpen }" title="Chat history" aria-label="Chat history" :aria-expanded="historyOpen ? 'true' : 'false'" @click="toggleHistory">
            <Icon icon="lucide:history" />
          </button>
          <div v-if="historyOpen" class="uac-hbackdrop" @click="historyOpen = false"></div>
          <div v-if="historyOpen" class="uac-hmenu">
            <div class="uac-hmenu-head">Chat history</div>
            <div v-if="loadingHistory" class="uac-hmenu-empty">Loading…</div>
            <template v-else>
              <button
                v-for="c in conversations" :key="c.id"
                type="button" class="uac-hitem" :class="{ active: String(c.id) === String(chat.conversationId) }"
                @click="openConversation(c)"
              >
                <span class="uac-hitem-title">{{ convTitle(c) }}</span>
                <span class="uac-hitem-meta">{{ relTime(c.updated_at) }}, {{ c.message_count || 0 }} {{ (c.message_count || 0) === 1 ? 'message' : 'messages' }}</span>
              </button>
              <div v-if="!conversations.length" class="uac-hmenu-empty">No previous chats yet.</div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- One tab per chat on this project (ADM-1221): several tasks run at once, each on its own socket. Leaving a tab
         never stops its run; its dot says whether it is working, waiting for you, done or failed. -->
    <div class="uac-tabs" data-test="uac-tabs">
      <div ref="tabListEl" class="uac-tablist" role="tablist" aria-label="Chats on this project" @keydown="onTabKey">
        <div v-for="t in tabs" :key="t.key" class="uac-tab" :class="{ active: isActiveTab(t) }" data-test="uac-tab">
          <button
            :id="`uac-tab-${t.key}`" type="button" role="tab" class="uac-tab-main"
            :aria-selected="isActiveTab(t) ? 'true' : 'false'" aria-controls="uac-panel"
            :tabindex="isActiveTab(t) ? 0 : -1" :title="tabTitle(t)" @click="selectTab(t)"
          >
            <span class="uac-tab-dot" :class="tabState(t)" :aria-label="tabStateLabel(t)" role="img"></span>
            <span class="uac-tab-t">{{ tabTitle(t) }}</span>
          </button>
          <button type="button" class="uac-tab-x" :aria-label="`Close ${tabTitle(t)}`" title="Close tab (the chat stays in Chat history)"
                  tabindex="-1" data-test="uac-tab-close" @click.stop="closeTab(t)">
            <Icon icon="lucide:x" />
          </button>
        </div>
      </div>
      <button type="button" class="uac-tab-new" title="New chat" aria-label="New chat" data-test="uac-new-chat" @click="newChat">
        <Icon icon="lucide:plus" />
      </button>
    </div>

    <div id="uac-panel" ref="scrollEl" class="uac-stream" role="log" aria-label="Coding agent conversation" aria-live="polite" aria-relevant="additions">
      <div v-if="!chat.messages.length" class="uac-empty">
        <Icon icon="lucide:sparkles" aria-hidden="true" />
        <p>Describe a change or ask about the code. The agent reads, edits and runs it in the project's sandbox. Review its changes in Source control, then commit, push or discard them.</p>
      </div>
      <ChatMessageList v-else>
        <template #after-message="{ message }">
          <!-- Undo per message: the project's files go back to the checkpoint taken before this message's turn
               first changed one (AGENT_ENGINE_CAPABILITIES_PLAN.md section 9). -->
          <div v-if="message.role === 'user' && message.restoreCheckpointId && message.serverId" class="uac-restore">
            <button
              type="button" class="uac-restore-btn" data-test="restore-message"
              :disabled="chat.isBusy || restoringId !== null"
              :title="chat.isBusy ? 'Wait for the agent to finish, then restore' : 'Put the files back to how they were before this message'"
              @click="restoreTo(message)"
            >
              <Icon :icon="String(restoringId) === String(message.serverId) ? 'lucide:loader-2' : 'lucide:undo-2'"
                    :class="{ spin: String(restoringId) === String(message.serverId) }" aria-hidden="true" />
              {{ String(restoringId) === String(message.serverId) ? 'Restoring' : 'Restore to before this message' }}
            </button>
          </div>
          <div v-if="message.lcCard" class="uac-cards">
            <div v-if="message.lcCard.changes" class="ai-changes">
              <Icon icon="lucide:file-diff" aria-hidden="true" />
              <span class="ai-changes-text">{{ changesText(message.lcCard.changes) }}</span>
              <button type="button" class="ai-changes-open" @click="emit('view-changes')">View changes</button>
            </div>
            <div v-if="message.lcCard.preview" class="ai-preview">
              <Icon icon="lucide:monitor-play" aria-hidden="true" />
              <span class="ai-preview-text">The app is running on port {{ message.lcCard.preview.port }}</span>
              <button type="button" class="ai-preview-open" @click="openPreview(message.lcCard)">Open preview</button>
              <span v-if="message.lcCard.preview.error" class="ai-preview-err" role="alert">{{ message.lcCard.preview.error }}</span>
            </div>
          </div>
        </template>
      </ChatMessageList>
      <HITLModal v-if="chat.hitlRequests.length" inline :requests="chat.hitlRequests" show-stop
                 @respond="chat.respondHitl" @dismiss="chat.dismissHitl" @skip="chat.skipHitl" @stop="chat.stop" />
    </div>

    <PermissionCard :requests="permissionRequests" @respond="onPermissionRespond" />

    <!-- The agent's task list for this chat, the same list the main chat shows (the shared store's `todos`). -->
    <div v-if="chat.todos && chat.todos.length" class="uac-tasks"><ChatTaskList :todos="chat.todos" compact /></div>

    <div class="uac-composer">
      <!-- @ mentions a project file: Go to file's own search and list (useFileSearch, FileResultList). -->
      <div v-if="mention" class="uac-mention" data-test="uac-mention">
        <p class="uac-mention-status" role="status" aria-live="polite">{{ mentionStatus }}</p>
        <div v-if="mentionItems.length" ref="mentionList" class="uac-mention-list">
          <FileResultList list-id="uac-mention-list" label="Files to mention" :items="mentionItems" :active="mentionActive"
                          :highlight="mentionHighlight" :recent-tag="!mention.query"
                          @hover="mentionActive = $event" @pick="pickMention" />
        </div>
      </div>
      <div class="uac-box" :class="{ focused, dragging }"
           @dragenter="onDragEnter" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
        <!-- Files and images for the next message: the main chat's own upload (ADM-1205 phase E). -->
        <AttachmentStrip class="uac-attach" :attachments="chat.pendingAttachments" @remove="chat.removeAttachment($event)" />
        <!-- Code selected in the editor ("Ask the Coding Agent about this", Ctrl+L), sent with the next message. -->
        <div v-if="selection" class="uac-sel" data-test="uac-selection">
          <Icon icon="lucide:text-select" aria-hidden="true" />
          <span class="uac-sel-t" translate="no" :title="selection.path">{{ selectionLabel }}</span>
          <button type="button" class="uac-sel-x" :aria-label="`Remove ${selectionLabel}`" title="Remove" @click="selection = null">×</button>
        </div>
        <input ref="fileEl" type="file" multiple class="sr-only" tabindex="-1" aria-hidden="true" @change="onFiles" />
        <div class="uac-box-top">
          <label class="sr-only" for="uac-input">Message the coding agent</label>
          <textarea
            id="uac-input" ref="inputEl" v-model="input" :disabled="!crsReady"
            :placeholder="crsReady ? 'Describe a change or ask about the code (@ adds a file)' : 'Preparing the project'"
            rows="1" :aria-controls="mention ? 'uac-mention-list' : undefined" :aria-expanded="mention ? 'true' : 'false'"
            :aria-activedescendant="mention && mentionItems.length ? `uac-mention-list-${mentionActive}` : undefined"
            @input="onInput" @keydown="onKeydown" @paste="onPaste" @click="findMention" @focus="focused = true" @blur="onBlur"
          ></textarea>
          <!-- Mic: needs an Audio-transcription model; dimmed otherwise, click explains. -->
          <button
            type="button" class="uac-mic" data-test="uac-mic"
            :class="{ live: voice.recording.value, busy: voice.transcribing.value, off: !voice.enabled.value }"
            :aria-disabled="voice.enabled.value ? 'false' : 'true'"
            :aria-label="voice.recording.value ? 'Stop and send' : 'Voice input'"
            :title="voice.enabled.value
              ? (voice.recording.value ? `Stop and send (${voice.elapsed.value}s)` : 'Voice input')
              : voice.disabledMessage.value"
            @click="voice.toggle()"
          >
            <Icon icon="lucide:mic" />
          </button>
        </div>

        <div class="uac-box-bar">
          <div class="uac-bar-left">
            <button type="button" class="uac-attach-btn" aria-label="Attach files or images" title="Attach files or images"
                    :disabled="!crsReady || chat.isBusy" data-test="uac-attach" @click="fileEl?.click()">
              <Icon icon="lucide:paperclip" />
            </button>
            <!-- The same pick as the main chat for a shared agent: the person's own model for the Coding Agent. -->
            <AgentModelPicker v-if="agentId" :agent-id="agentId" />
          </div>
          <button v-if="chat.isBusy" type="button" class="uac-circle stop" title="Stop" aria-label="Stop" @click="chat.stop()">
            <Icon icon="lucide:square" />
          </button>
          <button
            v-else type="button" class="uac-circle send" title="Send" aria-label="Send"
            :disabled="(!input.trim() && !chat.pendingAttachments.length) || !crsReady || !agentId" @click="send()"
          >
            <Icon icon="lucide:arrow-up" />
          </button>
        </div>
      </div>
      <div class="uac-hint">
        <span class="uac-conn" :class="{ on: !chat.connectionLost }"><span class="uac-conn-dot" aria-hidden="true"></span>{{ chat.connectionLost ? 'Reconnecting' : 'Connected' }}</span>
        <span>Enter to send, Shift+Enter for a new line</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useVoiceInput } from '@/composables/useVoiceInput'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { usePermission } from '@/composables/usePermission'
import { useChatStore } from '@/stores/useChatStore'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import ChatTaskList from '@/components/chat/ChatTaskList.vue'
import HITLModal from '@/components/HITLModal.vue'
import PermissionCard from '@/components/letscode/PermissionCard.vue'
import AgentModelPicker from '@/components/agent/AgentModelPicker.vue'
import AttachmentStrip from '@/components/chat/AttachmentStrip.vue'
import FileResultList from '@/components/letscode/FileResultList.vue'
import { useComposerAttachments } from '@/composables/useComposerAttachments'
import { useFileSearch } from '@/composables/useFileSearch'
import { mentionAt, mentionedPaths } from '@/utils/codeMentions'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
  crsReady: { type: Boolean, default: false },
})
const emit = defineEmits(['changes', 'activity', 'view-changes', 'open-preview'])

const chat = useChatStore()
const input = ref('')
const agentId = ref('')           // the shared Coding Agent (from unified-config)
const scrollEl = ref(null)
const inputEl = ref(null)
const focused = ref(false)
const fileEl = ref(null)
// The file picker, a pasted image or long text, and files dropped on the box: the same code as the main chat's
// composers (useComposerAttachments), into the same store (`chat.addAttachments`, uploaded when the message is sent).
const { dragging, onFiles, onPaste, onDragEnter, onDragOver, onDragLeave, onDrop } = useComposerAttachments({
  attach: (files) => chat.addAttachments(files),
  inputEl,
  text: input,
  afterInsert: () => autoGrow(),
  disabled: () => !props.crsReady || chat.isBusy,
})
const historyOpen = ref(false)
const loadingHistory = ref(false)
const conversations = ref([])
// Let's Code's card for an answer ({ task, busy, exporting, resolved, error, preview }) is kept ON that message
// (`lcCard`), never in a map by its id: the chat store swaps a message's id for its saved row's id when
// `message_saved` arrives, and a card filed under the old id vanished (production 2026-11-06, proposal 23).
const activity = []
const lastUserPrompt = ref('')

// What the main chat held before this page took the shared chat over; given back when the page closes.
let previous = null

const voice = useVoiceInput({
  agentId: () => agentId.value || null,
  conversationId: () => chat.conversationId,
  getDraft: () => input.value,
  onTranscript: (text) => { input.value = text; nextTick(() => { autoGrow(); send() }) },
})

const { permissionRequests, handlePermissionEvent, respondPermission } =
  usePermission((obj) => chat.sendRaw(obj), () => chat.conversationId)

function lastAssistant() {
  for (let i = chat.messages.length - 1; i >= 0; i--) if (chat.messages[i].role === 'assistant') return chat.messages[i]
  return null
}
function cardFor(message) {
  if (!message) return null
  if (!message.lcCard) message.lcCard = { changes: null, preview: null }
  return message.lcCard
}
// Frames only a project turn sends. Everything else (the stream, the steps, approvals) is the shared chat's.
function onProjectFrame(d) {
  const t = d?.type
  if (handlePermissionEvent(d)) { scrollDown(); return true }
  if (t === 'tool_result') {
    // The Activity tab beside the editor lists the turn's steps in words; the chat still draws the frame.
    if (d.label) { activity.push(d.label); emit('activity', activity.slice()) }
    return false
  }
  if (t === 'lets_code_preview') {
    const c = cardFor(lastAssistant())
    if (c) c.preview = { port: d.port, error: '' }
    scrollDown(); return true
  }
  if (t === 'lets_code_changes') {
    // What this turn changed: paths and status only. The person reviews, commits and pushes in Source control.
    const c = cardFor(lastAssistant())
    if (c) c.changes = { files: d.files || [], total: d.total || 0 }
    emit('changes')
    scrollDown(); return true
  }
  return false
}

async function send(text) {
  const msg = (text != null ? text : input.value).trim()
  // A message can be files alone (the store uploads them with it), as in the main chat.
  if ((!msg && !chat.pendingAttachments.length) || !props.crsReady || !agentId.value) return
  const codeContext = codeContextFor(msg)
  lastUserPrompt.value = msg
  lastCodeContext = codeContext
  activity.length = 0
  input.value = ''
  mention.value = null
  nextTick(autoGrow)
  if (!(await (codeContext ? chat.sendMessage(msg, { codeContext }) : chat.sendMessage(msg)))) {
    input.value = msg                                        // not sent: the words stay in the box
    return
  }
  picked = []
  selection.value = null
  scrollDown()
}

// ── @ mentions and the editor's selection (ADM-1205 phase E): sent as `code_context`, read on the server ──
const mention = ref(null)                // { start, query } while an @word is being typed
const mentionList = ref(null)
let picked = []                          // paths picked from the @ list, in order
let lastCodeContext = null
const mentionQuery = computed(() => mention.value?.query || '')
const {
  items: mentionItems, found: mentionFound, busy: mentionBusy, error: mentionError, active: mentionActive,
  highlight: mentionHighlight, listEl: mentionListEl, reset: resetMentionSearch, onKey: onMentionKey,
} = useFileSearch({ systemId: () => Number(props.systemId), repoId: () => Number(props.repoId), text: mentionQuery })
watch(mentionList, (el) => { mentionListEl.value = el })
const mentionStatus = computed(() => {
  if (mentionError.value) return mentionError.value
  if (!mentionQuery.value) return mentionItems.value.length ? 'Recently opened files' : 'Type a file name.'
  if (mentionBusy.value && !mentionFound.value.length) return 'Searching…'
  const n = mentionItems.value.length
  return n ? `${n} ${n === 1 ? 'file' : 'files'}` : 'No file has that name.'
})

function findMention() {
  const el = inputEl.value
  const next = props.crsReady && el ? mentionAt(input.value, el.selectionStart) : null
  if (next && !mention.value) resetMentionSearch()
  mention.value = next
}
function onInput() { autoGrow(); findMention() }
function onBlur() { focused.value = false; setTimeout(() => { mention.value = null }, 150) }
function pickMention(f) {
  const m = mention.value
  if (!f || !m) return
  const el = inputEl.value
  const caret = el ? el.selectionStart : input.value.length
  const insert = `@${f.path} `
  input.value = input.value.slice(0, m.start) + insert + input.value.slice(caret)
  if (!picked.includes(f.path)) picked.push(f.path)
  mention.value = null
  nextTick(() => {
    autoGrow()
    const pos = m.start + insert.length
    try { el.focus(); el.selectionStart = el.selectionEnd = pos } catch { /* the box went away */ }
  })
}

// The editor's "Ask the Coding Agent about this": shown above the box until sent or removed.
const selection = ref(null)
const selectionLabel = computed(() => {
  const s = selection.value
  if (!s) return ''
  const name = s.path.split('/').pop()
  return s.start_line === s.end_line ? `${name}:${s.start_line}` : `${name}:${s.start_line}-${s.end_line}`
})
function addSelection(sel) {
  if (!sel || !sel.path || !sel.text) return
  selection.value = { path: sel.path, start_line: sel.start_line, end_line: sel.end_line, text: sel.text }
  nextTick(() => inputEl.value && inputEl.value.focus())
}

function codeContextFor(msg) {
  const files = mentionedPaths(msg, picked)
  if (!files.length && !selection.value) return null
  return { files, selection: selection.value || undefined }
}

function onPermissionRespond({ card, choice }) {
  const decided = respondPermission(card, choice)
  // Only a protected file's card (`access_secret`) comes at the END of a turn: the turn went on without the values,
  // so on Allow the request runs again and can read them. Every action the agent is about to take (a risky command,
  // a protected-file change, a commit or push) pauses on the shared approval card instead, and the SAME run goes on
  // when allowed: never re-sent (ADM-1185, ADM-1200).
  if (card?.capability !== 'access_secret') return
  if (String(decided).startsWith('allow') && lastUserPrompt.value) {
    if (lastCodeContext) chat.sendMessage(lastUserPrompt.value, { codeContext: lastCodeContext })
    else chat.sendMessage(lastUserPrompt.value)
  }
}

// "Restore to before this message": asked first in the app's own dialog, then the server puts the files back. The file
// tree, the open tabs and Source control reload through the page's `changes` handler, as after a turn's edits.
const restoringId = ref(null)
async function restoreTo(message) {
  if (!message?.serverId || restoringId.value !== null || chat.isBusy) return
  const ok = await confirm({
    title: 'Restore to before this message?',
    message: "Restore the project's files to how they were before this message? Changes made after it are discarded. Files that git ignores are not touched.",
    confirmText: 'Restore',
    danger: true,
  })
  if (!ok) return
  restoringId.value = message.serverId
  try {
    await api.restoreLetsCodeMessage(props.repoId, message.serverId)
    notify.success('Restored')
    emit('changes')
  } catch (e) {
    const err = e?.response?.data?.error
    notify.error((typeof err === 'string' ? err : err?.message) || 'The files were not restored. Try again.')
  } finally {
    restoringId.value = null
  }
}

function scrollDown() { nextTick(() => { const el = scrollEl.value; if (el) el.scrollTop = el.scrollHeight }) }
watch(() => [chat.messages.length, chat.messages.at(-1)?.content, chat.hitlRequests.length], scrollDown)
// A turn that ended may have saved a restore point on its message: show its button now, not on the next load.
watch(() => chat.isBusy, (busy, was) => { if (was && !busy) chat.refreshRestorePoints() })

function autoGrow() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}
function onKeydown(e) {
  // While the @ list is open, its keys pick a file: Enter never sends then.
  if (mention.value && onMentionKey(e, { pick: pickMention, close: () => { mention.value = null }, tabPicks: true })) return
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send() }
}

// ── Tabs (ADM-1221): one per chat. A tab without an id is a new chat not sent yet; its first message gives it one. ──
const tabs = ref([])
const tabListEl = ref(null)
let tabSeq = 0
const TABS_KEY = () => `aadml.lc.tabs.${props.repoId}`
const titles = ref({})                    // conversation id -> its title, from Chat history

function newTab(id = null) { return { key: id ? `c${id}` : `n${++tabSeq}`, id: id ? String(id) : null } }
function isActiveTab(t) { return t.id ? String(t.id) === String(chat.conversationId || '') : !chat.conversationId }
function activeTab() { return tabs.value.find(isActiveTab) || null }
function tabTitle(t) {
  if (isActiveTab(t)) {
    const first = chat.messages.find((m) => m.role === 'user' && (m.content || '').trim())
    if (first) return first.content.trim().slice(0, 60)
  }
  if (t.id && titles.value[t.id]) return titles.value[t.id]
  return t.id ? 'Chat' : 'New chat'
}
function tabState(t) {
  if (isActiveTab(t)) {
    if (chat.hitlRequests.length || permissionRequests.value.length) return 'needs_input'
    return chat.isBusy ? 'working' : 'idle'
  }
  return (t.id && (chat.parkedRuns || {})[t.id]) || 'idle'
}
const STATE_WORDS = { working: 'Working', needs_input: 'Needs your answer', done: 'Finished', failed: 'Failed', idle: 'Idle' }
function tabStateLabel(t) { return STATE_WORDS[tabState(t)] || 'Idle' }
function saveTabs() {
  try {
    localStorage.setItem(TABS_KEY(), JSON.stringify({ ids: tabs.value.filter((t) => t.id).map((t) => t.id),
                                                       active: chat.conversationId || null }))
  } catch { /* private window: the tabs are not remembered */ }
}
function readSavedTabs() {
  try { return JSON.parse(localStorage.getItem(TABS_KEY()) || 'null') } catch { return null }
}
// The first message of a new tab gives it its conversation id.
watch(() => chat.conversationId, (id) => {
  if (!id) return
  const sid = String(id)
  if (!tabs.value.some((t) => t.id === sid)) {
    const fresh = tabs.value.find((t) => !t.id)
    if (fresh) { fresh.id = sid; fresh.key = `c${sid}` } else tabs.value.push(newTab(sid))
  }
  saveTabs()
})

async function selectTab(t) {
  if (isActiveTab(t)) return
  resumeCancelled = true
  historyOpen.value = false
  if (t.id) await openConversation({ id: t.id })
  else chat.reset()                       // a running chat is never stopped: it keeps its socket (the store parks it)
  saveTabs()
  nextTick(() => document.getElementById(`uac-tab-${t.key}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
}
function newChat() {
  resumeCancelled = true                 // a New chat pressed while the last one loads is not overridden
  let t = tabs.value.find((x) => !x.id)
  if (!t) { t = newTab(); tabs.value.push(t) }
  chat.reset()                            // never stops the chat on screen: a running one keeps going in its tab
  historyOpen.value = false
  saveTabs()
  nextTick(() => {
    document.getElementById(`uac-tab-${t.key}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    inputEl.value && inputEl.value.focus()
  })
}
async function closeTab(t) {
  const i = tabs.value.indexOf(t)
  if (i < 0) return
  const wasActive = isActiveTab(t)
  tabs.value.splice(i, 1)
  if (!tabs.value.length) tabs.value.push(newTab())
  if (wasActive) await selectTab(tabs.value[Math.min(i, tabs.value.length - 1)])
  saveTabs()
}
// Arrow keys move between tabs, Home and End jump to the ends (the WAI-ARIA tabs pattern).
function onTabKey(e) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(e.key) || !tabs.value.length) return
  e.preventDefault()
  const cur = Math.max(0, tabs.value.findIndex(isActiveTab))
  const n = tabs.value.length
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (cur + (e.key === 'ArrowRight' ? 1 : -1) + n) % n
  const t = tabs.value[next]
  selectTab(t).then(() => nextTick(() => document.getElementById(`uac-tab-${t.key}`)?.focus()))
}
// A chat left running reports the files its turn changed, so the tree and Source control reload as for this one.
function onParkedFrame(_id, d) {
  if (d && d.type === 'lets_code_changes') emit('changes')
}
function rememberTitles(list) {
  const next = { ...titles.value }
  for (const c of list || []) next[String(c.id)] = convTitle(c)
  titles.value = next
}
async function loadHistory() {
  loadingHistory.value = true
  try {
    const { data } = await api.getConversations({ repository: props.repoId })
    conversations.value = data?.results || data || []
    rememberTitles(conversations.value)
  } catch (e) { conversations.value = [] }
  finally { loadingHistory.value = false }
}
function toggleHistory() {
  historyOpen.value = !historyOpen.value
  if (historyOpen.value) loadHistory()
}
async function openConversation(c) {
  historyOpen.value = false
  // A chat opened from Chat history gets a tab of its own (or its open tab is shown).
  if (!tabs.value.some((t) => t.id === String(c.id))) tabs.value.push(newTab(c.id))
  if (c.title || c.last_message) rememberTitles([c])
  if (String(c.id) === String(chat.conversationId)) return
  await chat.openConversation(c.id)
  chat.repoId = Number(props.repoId)                     // a chat of this project stays on this project's socket
  if (agentId.value) chat.selectedAgentId = String(agentId.value)
  scrollDown()
}
function convTitle(c) {
  if (c.title && c.title.trim()) return c.title.trim()
  const lm = c.last_message && c.last_message.content
  return lm ? lm.slice(0, 60) : 'Untitled chat'
}
function relTime(ts) {
  if (!ts) return ''
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`
  return new Date(ts).toLocaleDateString()
}

// "Changed 2 files: page.tsx, layout.tsx", "and 3 more changes not committed" when earlier work is waiting too.
function changesText(ch) {
  const files = ch.files || []
  const names = files.map((f) => f.path.split('/').pop())
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? `, +${names.length - 3} more` : '')
  const head = files.length ? `Changed ${files.length} ${files.length === 1 ? 'file' : 'files'}: ${shown}` : 'No files changed in this turn'
  const others = (ch.total || 0) - files.length
  return others > 0 ? `${head} · ${others} more ${others === 1 ? 'change' : 'changes'} not committed` : head
}

function openPreview(c) {
  // The IDE's Preview tab on that port (ADM-1205 phase D): it asks AADML for a fresh signed link, after AADML has woken
  // the sandbox and started the app again when it had stopped. "Open in a new tab" is there too.
  c.preview.error = ''
  emit('open-preview', c.preview.port)
}

// Reopening a project continues its last Coding Agent chat (ADM-1209). The panel used to start blank on every
// open, so each page load made a new conversation and an earlier chat looked lost. The newest of this project's
// chats (the server lists only the person's own, newest first) is opened, never over a chat already begun here:
// nothing typed, nothing sent, no conversation open. New chat and the history menu work as before.
let resumeCancelled = false
// With tabs: the tabs this project had open are opened again (those still in its history), on the one that was
// active; with none remembered, the newest chat, as before.
async function resumeLastChat() {
  try {
    const { data } = await api.getConversations({ repository: props.repoId })
    const list = data?.results || data || []
    rememberTitles(list)
    if (resumeCancelled) return
    if (chat.conversationId || chat.isBusy || chat.messages.length || input.value.trim()) return
    const known = new Set(list.map((c) => String(c.id)))
    const saved = readSavedTabs()
    const ids = ((saved && saved.ids) || []).map(String).filter((id) => known.has(id))
    if (ids.length) {
      tabs.value = ids.map((id) => newTab(id))
      const active = saved.active && ids.includes(String(saved.active)) ? String(saved.active) : ids[ids.length - 1]
      await openConversation({ id: active })
      return
    }
    const latest = list[0]
    if (!latest) return
    tabs.value = [newTab(latest.id)]
    await openConversation(latest)
  } catch { /* the blank chat stays: nothing was lost */ }
}

async function loadAgent() {
  try {
    const { data } = await api.unifiedConfig(props.systemId)
    if (data?.agent_id) {
      agentId.value = String(data.agent_id)
      chat.setAgent(agentId.value)          // also warms the agent on the project's socket
    }
  } catch (e) { /* Send stays disabled until the agent is known */ }
}

onMounted(() => {
  previous = { repoId: chat.repoId, agentId: chat.selectedAgentId }
  chat.reset()
  chat.repoId = Number(props.repoId)
  chat.newChatRepoId = Number(props.repoId)
  chat.surfaceHandler = onProjectFrame
  chat.parkedFrameHandler = onParkedFrame
  tabs.value = [newTab()]
  loadAgent()
  resumeLastChat()
})
onBeforeUnmount(() => {
  resumeCancelled = true
  if (chat.surfaceHandler === onProjectFrame) chat.surfaceHandler = null
  if (chat.parkedFrameHandler === onParkedFrame) chat.parkedFrameHandler = null
  chat.newChatRepoId = null
  chat.reset()
  // Give the main chat back what it had: its own socket endpoint and agent.
  if (previous) { chat.repoId = previous.repoId || 0; if (previous.agentId) chat.selectedAgentId = previous.agentId }
})

defineExpose({ send, addSelection })
</script>

<style scoped>
.uac {
  --uac-on-solid: white;   /* text on a solid primary/danger fill: the same in both themes */
  display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--vm-surface); color: var(--vm-ink);
}
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

/* ── Top bar ── */
.uac-head { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid var(--vm-line); background: var(--vm-surface); }
.uac-title { display: inline-flex; align-items: center; gap: 7px; font: 700 13px var(--vm-font-sans); color: var(--vm-ink); white-space: nowrap; }
.uac-title :deep(svg) { width: 15px; height: 15px; color: var(--vm-violet); }
.uac-head-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.uac-hbtn:focus-visible, .uac-circle:focus-visible, .uac-mic:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.uac-hwrap { position: relative; }
.uac-hbtn { display: grid; place-items: center; width: 32px; height: 32px; border: none; background: transparent; color: var(--vm-ink-soft); border-radius: 8px; cursor: pointer; transition: color .15s, background-color .15s; }
.uac-hbtn:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.uac-hbtn.on { background: var(--vm-violet-soft); color: var(--vm-violet); }
.uac-hbtn :deep(svg) { width: 16px; height: 16px; }
.uac-hbackdrop { position: fixed; inset: 0; z-index: 40; }
.uac-hmenu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 41; width: min(300px, calc(100vw - 32px)); max-height: 360px; overflow-y: auto;
  background: var(--vm-surface); border: 1px solid var(--vm-line); border-radius: 12px;
  box-shadow: var(--vm-shadow-l); padding: 6px;
}
.uac-hmenu-head { font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); padding: 6px 8px 8px; }
.uac-hmenu-empty { font-size: 13px; color: var(--vm-ink-faint); padding: 12px 8px; text-align: center; }
.uac-hitem { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; border: none; background: transparent; padding: 8px 9px; border-radius: 9px; cursor: pointer; transition: background-color .12s; }
.uac-hitem:hover { background: var(--vm-surface-soft); }
.uac-hitem.active { background: var(--vm-violet-soft); }
.uac-hitem-title { font: 600 13px var(--vm-font-sans); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.uac-hitem-meta { font-size: 11.5px; color: var(--vm-ink-faint); }

/* ── Tabs: one per chat on the project (ADM-1221) ── */
.uac-tabs { flex: 0 0 auto; display: flex; align-items: stretch; gap: 2px; padding: 0 6px; border-bottom: 1px solid var(--vm-line); background: var(--vm-surface); }
.uac-tablist { flex: 1 1 auto; min-width: 0; display: flex; align-items: stretch; gap: 2px; overflow-x: auto; scrollbar-width: thin; }
.uac-tab { position: relative; flex: 0 0 auto; display: flex; align-items: center; max-width: 180px; border-bottom: 2px solid transparent; color: var(--vm-ink-soft); transition: color .15s, border-color .15s; }
.uac-tab:hover { color: var(--vm-ink); }
.uac-tab.active { color: var(--vm-ink); border-bottom-color: var(--vm-violet); }
.uac-tab-main { display: flex; align-items: center; gap: 6px; min-width: 0; min-height: 32px; padding: 0 2px 0 8px; border: none; background: transparent; color: inherit; font: 600 12.5px var(--vm-font-sans); cursor: pointer; }
.uac-tab-main:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: -2px; border-radius: 6px; }
.uac-tab-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.uac-tab-dot { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; background: var(--vm-line-2); }
.uac-tab-dot.working { background: var(--vm-violet); animation: uacpulse 1.4s ease-in-out infinite; }
.uac-tab-dot.needs_input { background: var(--vm-amber); }
.uac-tab-dot.done { background: var(--vm-green); }
.uac-tab-dot.failed { background: var(--vm-danger); }
@keyframes uacpulse { 50% { opacity: .35; } }
.uac-tab-x { flex: 0 0 auto; display: grid; place-items: center; width: 22px; height: 22px; margin-right: 2px; border: none; border-radius: 5px; background: transparent; color: var(--vm-ink-faint); cursor: pointer; opacity: 0; transition: opacity .15s, background-color .15s, color .15s; }
.uac-tab:hover .uac-tab-x, .uac-tab.active .uac-tab-x, .uac-tab-x:focus-visible { opacity: 1; }
.uac-tab-x:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.uac-tab-x:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 0; }
.uac-tab-x :deep(svg) { width: 13px; height: 13px; }
.uac-tab-new { flex: 0 0 auto; align-self: center; display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: 7px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; }
.uac-tab-new:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.uac-tab-new:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.uac-tab-new :deep(svg) { width: 15px; height: 15px; }
@media (pointer: coarse) { .uac-tab-x { opacity: 1; width: 32px; height: 32px; } .uac-tab-new { width: 44px; height: 44px; } .uac-tab-main { min-height: 44px; } }

/* ── The conversation: the shared transcript, fitted to this narrow side panel (as Video Studio does) ── */
.uac-stream { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 12px; display: flex; flex-direction: column; gap: 12px; overflow-wrap: anywhere; }
.uac-empty { margin: auto; text-align: center; color: var(--vm-ink-soft); max-width: 320px; font-size: 13.5px; line-height: 1.5; }
.uac-empty :deep(svg) { width: 24px; height: 24px; margin-bottom: 8px; color: var(--vm-violet); }
.uac-stream :deep(.msg-list-inner) { padding: 0 0 8px; }
.uac-stream :deep(.msg) { max-width: none; margin: 0 0 14px; padding: 0; gap: 8px; }
.uac-stream :deep(.avatar) { width: 22px; height: 22px; }
.uac-stream :deep(.user-col) { max-width: 92%; }
.uac-stream :deep(.bubble.user) { padding: 9px 12px; font-size: 13px; line-height: 1.6; }
.uac-stream :deep(.bubble.assistant) { font-size: 13.5px; line-height: 1.6; }
.uac-stream :deep(.hitl-overlay--inline) { position: static; display: block; padding: 0; background: transparent; }
.uac-stream :deep(.hitl-modal) { width: 100%; min-width: 0; max-height: none; }

.uac-cards { display: flex; flex-direction: column; gap: 8px; margin: -6px 0 14px 30px; }
.ai-changes { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--vm-line); border-radius: 10px; background: var(--vm-surface); font-size: 12.5px; color: var(--vm-ink-soft); }
.ai-changes :deep(svg) { width: 15px; height: 15px; color: var(--vm-violet); flex: 0 0 auto; }
.ai-changes-text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.ai-changes-open { min-height: 32px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s; }
.ai-changes-open:hover { background: var(--vm-surface-soft); }
.ai-changes-open:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.ai-preview { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--vm-line); border-radius: 10px; background: var(--vm-surface); font-size: 12.5px; color: var(--vm-ink-soft); }
.ai-preview :deep(svg) { width: 15px; height: 15px; color: var(--vm-violet); flex: 0 0 auto; }
.ai-preview-text { flex: 1 1 auto; min-width: 0; }
.ai-preview-open { min-height: 32px; padding: 0 12px; border: none; border-radius: 8px; background: var(--vm-violet); color: var(--uac-on-solid); font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: filter .15s; }
.ai-preview-open:hover { filter: brightness(1.08); }
.ai-preview-open:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.ai-preview-err { flex-basis: 100%; color: var(--vm-red-ink); }

.uac-tasks { flex: 0 0 auto; padding: 8px 10px 0; border-top: 1px solid var(--vm-line); }
.uac-tasks :deep(.ctl) { margin: 0; }
.uac-tasks + .uac-composer { border-top: none; }

/* ── Restore to before a message: a quiet action under the person's own bubble ── */
.uac-restore { display: flex; justify-content: flex-end; margin: -8px 0 14px; }
.uac-restore-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 10px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); font: 600 12px var(--vm-font-sans); cursor: pointer; transition: color .15s, background-color .15s, border-color .15s; }
.uac-restore-btn :deep(svg) { width: 14px; height: 14px; }
.uac-restore-btn:hover:not(:disabled) { color: var(--vm-ink); background: var(--vm-surface-soft); border-color: var(--vm-line); }
.uac-restore-btn:disabled { opacity: .5; cursor: not-allowed; }
.uac-restore-btn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.uac-restore-btn .spin { animation: uacspin 1s linear infinite; }
@keyframes uacspin { to { transform: rotate(360deg); } }

/* ── @ mentions and the selection (ADM-1205 phase E) ── */
.uac-composer { position: relative; }
.uac-mention {
  position: absolute; left: 0; right: 0; bottom: calc(100% + 6px); z-index: 20; max-height: 280px; display: flex; flex-direction: column;
  background: var(--vm-surface); color: var(--vm-ink); border: 1px solid var(--vm-line-2); border-radius: 10px;
  box-shadow: var(--vm-shadow-l, 0 12px 32px rgba(0, 0, 0, .18)); overflow: hidden; font: 13px var(--vm-font-sans);
}
.uac-mention-status { margin: 0; padding: 8px 12px 4px; font-size: 12px; color: var(--vm-ink-faint); }
.uac-mention-list { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.uac-sel { display: inline-flex; align-items: center; gap: 6px; max-width: calc(100% - 16px); margin: 8px 8px 0; padding: 4px 6px 4px 8px; border: 1px solid var(--vm-line); border-radius: 8px; background: var(--vm-bg); font: 12px var(--vm-font-mono); color: var(--vm-ink-soft); }
.uac-sel :deep(svg) { width: 14px; height: 14px; flex: 0 0 auto; color: var(--vm-violet); }
.uac-sel-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.uac-sel-x { flex: 0 0 auto; width: 18px; height: 18px; line-height: 1; border: none; border-radius: 9999px; background: var(--vm-line-2); color: var(--vm-ink-soft); font-size: 14px; cursor: pointer; touch-action: manipulation; }
.uac-sel-x:hover { color: var(--vm-ink); }
.uac-sel-x:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
@media (pointer: coarse) { .uac-sel-x { width: 32px; height: 32px; } }

/* ── Attachments (ADM-1205 phase E) ── */
.uac-attach { padding: 8px 8px 0; }
.uac-box.dragging { outline: 2px dashed var(--vm-violet); outline-offset: 2px; }
.uac-attach-btn { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 auto; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; touch-action: manipulation; }
.uac-attach-btn:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.uac-attach-btn:disabled { opacity: .45; cursor: not-allowed; }
.uac-attach-btn:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
.uac-attach-btn :deep(svg) { width: 16px; height: 16px; }
@media (pointer: coarse) { .uac-attach-btn { width: 44px; height: 44px; } }

/* ── Composer ── */
.uac-composer { border-top: 1px solid var(--vm-line); padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.uac-box { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; background: var(--vm-surface); border: 1.5px solid var(--vm-line-2); border-radius: 16px; transition: border-color .18s var(--vm-ease2), box-shadow .18s; }
.uac-box.focused { border-color: var(--vm-focus); box-shadow: 0 0 0 4px color-mix(in srgb, var(--vm-focus) 18%, transparent); }
.uac-box-top { display: flex; align-items: flex-start; gap: 6px; }
.uac-box-top textarea { flex: 1; min-width: 0; resize: none; border: none; outline: none; background: transparent; padding: 5px 2px; font: inherit; font-size: 14px; line-height: 1.5; color: var(--vm-ink); max-height: 200px; }
.uac-box-top textarea::placeholder { color: var(--vm-ink-faint); }
.uac-box-top textarea:disabled { color: var(--vm-ink-faint); cursor: not-allowed; }
.uac-mic { flex: 0 0 auto; display: grid; place-items: center; width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: color .15s, background-color .15s; }
.uac-mic:hover { color: var(--vm-violet); background: var(--vm-violet-soft); }
.uac-mic.live { color: var(--uac-on-solid); background: var(--vm-danger); animation: uacmic 1.3s ease-in-out infinite; }
.uac-mic.off { color: var(--vm-ink-faint); opacity: .55; cursor: help; }
.uac-mic.off:hover { background: transparent; color: var(--vm-ink-faint); }
.uac-mic.busy { color: var(--vm-violet); animation: uacmic 1s linear infinite; }
.uac-mic :deep(svg) { width: 16px; height: 16px; }
@keyframes uacmic { 50% { opacity: .55; } }
.uac-box-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.uac-bar-left { display: flex; align-items: center; gap: 6px; min-width: 0; }
.uac-circle { flex: 0 0 auto; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; color: var(--uac-on-solid); transition: background-color .15s, opacity .15s; }
.uac-circle :deep(svg) { width: 16px; height: 16px; }
.uac-circle.send { background: var(--vm-violet); }
.uac-circle.send:hover:not(:disabled) { background: var(--vm-violet-d); }
.uac-circle.send:disabled { opacity: .4; cursor: not-allowed; }
.uac-circle.stop { background: var(--vm-danger); }
.uac-circle.stop:hover { opacity: .88; }
.uac-hint { display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 11.5px; color: var(--vm-ink-faint); }
.uac-conn { display: inline-flex; align-items: center; gap: 5px; color: var(--vm-ink-faint); }
.uac-conn-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--vm-amber); }
.uac-conn.on .uac-conn-dot { background: var(--vm-green); }
.uac-hint > span:last-child { margin-left: auto; text-align: right; }

@media (max-width: 640px) {
  .uac-hbtn, .uac-mic { width: 44px; height: 44px; }
  .uac-circle { width: 44px; height: 44px; }
  .uac-hint > span:last-child { display: none; }
  .ai-changes-open, .ai-preview-open, .uac-restore-btn { min-height: 44px; }
  .uac-box-top textarea { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .uac-mic.live, .uac-mic.busy, .uac-restore-btn .spin, .uac-tab-dot.working { animation: none; }
}
</style>
