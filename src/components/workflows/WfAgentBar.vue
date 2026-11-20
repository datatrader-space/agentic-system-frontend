<!--
  "Build / Edit with Agent" bar of the Workflow Builder (ADM-1333, plan §3.4 and D6). A single-line prompt at the bottom
  centre of the canvas; above it, a small conversation panel with the agent's streamed answer, its tool steps, and the
  proposed changes, each accepted or rejected here or on the canvas. The agent never saves: accepting changes the draft
  (and can be undone), and the person saves.

    <WfAgentBar :doc="doc" :history="history" :proposal="proposal" :graph-id="graphId" />

  `proposal` is useWorkflowProposal(doc, history), shared with the canvas that draws its marks and ghosts. The parent
  is positioned (relative); the bar sits at its bottom centre, raised by `--wf-agentbar-bottom` (default 16px).
-->
<template>
  <div class="wfab" :class="{ 'wfab--open': open }" data-test="wf-agent-bar" @keydown.esc.stop="onEscape">
    <p class="sr-only" aria-live="polite" aria-atomic="true" data-test="wfab-announce">{{ announcement }}</p>

    <Transition name="wfab-pop">
      <section
        v-if="open"
        :id="panelId"
        class="wfab-panel"
        role="region"
        :aria-labelledby="`${panelId}-title`"
        data-test="wfab-panel"
      >
        <header class="wfab-head">
          <h2 :id="`${panelId}-title`" class="wfab-title">
            <Icon icon="lucide:sparkles" class="wfab-title-ic" aria-hidden="true" />
            Build with agent
          </h2>
          <span v-if="pendingCount" class="wfab-count" data-test="wfab-pending-count">{{ pendingCount }} waiting</span>
          <button
            type="button"
            class="wfab-icon-btn"
            aria-label="New conversation"
            title="New conversation"
            :disabled="!chat.messages.value.length"
            data-test="wfab-new"
            @click="onNewConversation"
          >
            <Icon icon="lucide:message-square-plus" aria-hidden="true" />
          </button>
          <button type="button" class="wfab-icon-btn" aria-label="Close the agent panel" title="Close (Esc)" data-test="wfab-close" @click="closePanel">
            <Icon icon="lucide:x" aria-hidden="true" />
          </button>
        </header>

        <div ref="scrollEl" class="wfab-scroll">
          <p v-if="!chat.messages.value.length && !hunks.length" class="wfab-empty">
            Describe what this workflow should do, or what to change. The agent reads the draft and proposes changes;
            nothing is saved until you accept them and save.
          </p>

          <ol class="wfab-log" aria-label="Conversation">
            <li
              v-for="m in chat.messages.value"
              :key="m.id"
              class="wfab-msg"
              :class="`wfab-msg--${m.role}`"
              :data-test="`wfab-msg-${m.role}`"
            >
              <p v-if="m.role === 'user'" class="wfab-user">{{ m.content }}</p>
              <template v-else>
                <ul v-if="stepsOf(m).length" class="wfab-steps" aria-label="Agent steps">
                  <li v-for="s in stepsOf(m)" :key="s.key" class="wfab-step" :class="`is-${s.status}`">
                    <Icon v-if="s.status === 'running'" icon="lucide:loader-circle" class="wfab-step-ic wfab-spin" aria-hidden="true" />
                    <Icon v-else-if="s.status === 'failed'" icon="lucide:circle-x" class="wfab-step-ic" aria-hidden="true" />
                    <Icon v-else-if="s.status === 'interrupted'" icon="lucide:circle-alert" class="wfab-step-ic" aria-hidden="true" />
                    <Icon v-else icon="lucide:circle-check" class="wfab-step-ic" aria-hidden="true" />
                    <span class="wfab-step-label">{{ s.label }}</span>
                    <span class="sr-only">{{ stepStatusWord(s.status) }}</span>
                    <span v-if="s.reason" class="wfab-step-reason">{{ s.reason }}</span>
                  </li>
                </ul>
                <!-- eslint-disable-next-line vue/no-v-html -- renderUntrustedMarkdown sanitises the agent's text -->
                <div v-if="m.content" class="wfab-md" v-html="render(m.content)" />
                <p v-else-if="m.status === 'streaming'" class="wfab-thinking">
                  <Icon icon="lucide:loader-circle" class="wfab-spin" aria-hidden="true" />
                  {{ chat.liveStatus.value || 'Working…' }}
                </p>
                <p v-if="m.status === 'stopped'" class="wfab-note">Stopped.</p>
                <div v-if="m.error" class="wfab-error" role="alert" data-test="wfab-error">
                  <Icon icon="lucide:circle-alert" class="wfab-error-ic" aria-hidden="true" />
                  <span>{{ m.error }}</span>
                  <router-link v-if="m.errorCode === 'wallet_empty'" to="/dashboard/billing" class="wfab-link" data-test="wfab-topup">
                    Top up your balance
                  </router-link>
                </div>
                <p v-if="m.needsChat" class="wfab-note" data-test="wfab-needs-chat">
                  {{ NEEDS_CHAT }}
                  <router-link v-if="chat.conversationId.value" :to="`/dashboard/chat/${chat.conversationId.value}`" class="wfab-link">
                    Open in Chat
                  </router-link>
                </p>
              </template>
            </li>
          </ol>

          <section v-if="hunks.length" class="wfab-proposal" aria-labelledby="wfab-proposal-title" data-test="wfab-proposal">
            <div class="wfab-proposal-head">
              <h3 id="wfab-proposal-title" class="wfab-proposal-title">
                Proposed changes
                <span class="wfab-proposal-sub">{{ proposalSummary }}</span>
              </h3>
              <div class="wfab-proposal-actions">
                <button type="button" class="wfab-btn" :disabled="!pendingCount" data-test="wfab-reject-all" @click="onRejectAll">
                  Reject all
                </button>
                <button type="button" class="wfab-btn wfab-btn--primary" :disabled="!pendingCount" data-test="wfab-accept-all" @click="onAcceptAll">
                  Accept all
                </button>
              </div>
            </div>
            <ul class="wfab-hunks">
              <li
                v-for="h in hunks"
                :key="`${proposalKey}-${h.index}`"
                class="wfab-hunk"
                :class="[`is-${h.state}`, `mark-${h.mark}`]"
                :data-test="`wfab-hunk-${h.index}`"
              >
                <span class="wfab-mark" :aria-label="markWord(h.mark)" role="img">
                  <Icon v-if="h.mark === 'add'" icon="lucide:plus" aria-hidden="true" />
                  <Icon v-else-if="h.mark === 'remove'" icon="lucide:minus" aria-hidden="true" />
                  <Icon v-else icon="lucide:pencil" aria-hidden="true" />
                </span>
                <span class="wfab-hunk-body">
                  <span class="wfab-hunk-text">{{ h.summary }}</span>
                  <span v-if="h.state === 'refused'" class="wfab-hunk-refused" data-test="wfab-refused">
                    <Icon icon="lucide:ban" aria-hidden="true" /> Refused: {{ h.error?.message || 'This change cannot be applied.' }}
                  </span>
                  <span v-else-if="h.state !== 'pending'" class="wfab-hunk-state">{{ h.state === 'accepted' ? 'Accepted' : 'Rejected' }}</span>
                </span>
                <span v-if="h.state === 'pending'" class="wfab-hunk-actions">
                  <button
                    type="button"
                    class="wfab-icon-btn wfab-icon-btn--ok"
                    :aria-label="`Accept: ${h.summary}`"
                    title="Accept"
                    :data-test="`wfab-accept-${h.index}`"
                    @click="onAccept(h)"
                  >
                    <Icon icon="lucide:check" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="wfab-icon-btn wfab-icon-btn--no"
                    :aria-label="`Reject: ${h.summary}`"
                    title="Reject"
                    :data-test="`wfab-reject-${h.index}`"
                    @click="onReject(h)"
                  >
                    <Icon icon="lucide:x" aria-hidden="true" />
                  </button>
                </span>
              </li>
            </ul>
            <p v-if="acceptedUnsaved" class="wfab-saved-note" data-test="wfab-unsaved">
              Accepted changes are in the draft, not saved yet. Save the workflow to keep them.
              <button v-if="canUndoAgent" type="button" class="wfab-link-btn" data-test="wfab-undo" @click="onUndo">
                Undo {{ undoLabel.toLowerCase() }}
              </button>
            </p>
            <div v-if="issues.length" class="wfab-issues" data-test="wfab-issues">
              <p class="wfab-issues-title">The workflow with these changes still has problems:</p>
              <ul>
                <li v-for="(x, i) in issues" :key="i">{{ x.node_id ? `${x.node_id}: ` : '' }}{{ x.message || x.code }}</li>
              </ul>
            </div>
          </section>
        </div>
      </section>
    </Transition>

    <p v-if="connectionLine" class="wfab-conn" :class="{ 'is-lost': chat.connection.value === 'lost' }" role="status" data-test="wfab-connection">
      <Icon icon="lucide:wifi-off" aria-hidden="true" />
      {{ connectionLine }}
      <button v-if="chat.connection.value === 'lost'" type="button" class="wfab-link-btn" data-test="wfab-reconnect" @click="chat.reconnectNow()">
        Reconnect now
      </button>
    </p>
    <p v-if="chat.agentError.value" class="wfab-conn is-lost" role="alert" data-test="wfab-agent-error">
      <Icon icon="lucide:circle-alert" aria-hidden="true" />
      {{ chat.agentError.value }}
    </p>

    <form class="wfab-bar" data-test="wfab-form" @submit.prevent="submit">
      <Icon icon="lucide:sparkles" class="wfab-bar-ic" aria-hidden="true" />
      <label :for="inputId" class="sr-only">Ask the agent to build or change this workflow</label>
      <input
        :id="inputId"
        ref="inputEl"
        v-model="draft"
        class="wfab-input"
        type="text"
        name="wf-agent-prompt"
        autocomplete="off"
        enterkeyhint="send"
        placeholder="Ask the agent to build or change this workflow…"
        :aria-describedby="hintId"
        data-test="wfab-input"
      >
      <button
        type="button"
        class="wfab-icon-btn wfab-toggle"
        :aria-label="open ? 'Hide the agent panel' : (pendingCount ? `Show the agent panel, ${pendingCount} changes waiting` : 'Show the agent panel')"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="panelId"
        data-test="wfab-toggle"
        @click="togglePanel"
      >
        <Icon :icon="open ? 'lucide:chevron-down' : 'lucide:chevron-up'" aria-hidden="true" />
        <span v-if="!open && pendingCount" class="wfab-badge" aria-hidden="true">{{ pendingCount }}</span>
      </button>
      <button
        v-if="chat.busy.value"
        type="button"
        class="wfab-send wfab-send--stop"
        aria-label="Stop the agent"
        title="Stop"
        data-test="wfab-stop"
        @click="onStop"
      >
        <Icon icon="lucide:square" aria-hidden="true" />
      </button>
      <button
        v-else
        type="submit"
        class="wfab-send"
        aria-label="Send to the agent"
        title="Send (Enter)"
        :disabled="!draft.trim()"
        data-test="wfab-send"
      >
        <Icon icon="lucide:arrow-up" aria-hidden="true" />
      </button>
    </form>
    <div :id="hintId" class="wfab-hint">
      <AgentModelPicker v-if="agentId" :agent-id="agentId" />
      <span>Paid from your balance</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, useId, unref } from 'vue'
import { Icon } from '@iconify/vue'
import AgentModelPicker from '@/components/agent/AgentModelPicker.vue'
import { useWorkflowAgentChat, NEEDS_CHAT } from '@/composables/useWorkflowAgentChat'
import { renderUntrustedMarkdown } from '@/utils/safeMarkdown'

const props = defineProps({
  doc: { type: Object, required: true },
  history: { type: Object, required: true },
  proposal: { type: Object, required: true },
  graphId: { type: [Number, String], required: true },
})

const uid = useId()
const panelId = `wfab-panel-${uid}`
const inputId = `wfab-input-${uid}`
const hintId = `wfab-hint-${uid}`

const open = ref(false)
const draft = ref('')
const announcement = ref('')
const inputEl = ref(null)
const scrollEl = ref(null)

const chat = useWorkflowAgentChat({
  graphId: () => props.graphId,
  onProposal: (frame) => onProposal(frame),
})

const agentId = computed(() => chat.agent.value?.id ?? null)
// The proposal's refs are read with unref, so the parent may pass useWorkflowProposal()'s object as is or reactive().
const hunks = computed(() => unref(props.proposal.hunks) || [])
const issues = computed(() => unref(props.proposal.issues) || [])
const pendingCount = computed(() => hunks.value.filter((h) => h.state === 'pending').length)
const proposalKey = computed(() => unref(props.proposal.proposalId) || 'p')
const proposalSummary = computed(() => {
  const refused = hunks.value.filter((h) => h.state === 'refused').length
  const parts = [`${pendingCount.value} waiting`]
  if (refused) parts.push(`${refused} refused`)
  return parts.join(', ')
})

// After an accept: the draft is unsaved (the person saves), and the agent's last change can be undone from here too.
const acceptedUnsaved = computed(() => !!unref(props.doc.dirty) && hunks.value.some((h) => h.state === 'accepted'))
const undoLabel = computed(() => unref(props.history.undoLabel) || '')
const canUndoAgent = computed(() => !!unref(props.history.canUndo) && /^Agent change/.test(undoLabel.value))
function onUndo() {
  const label = undoLabel.value
  if (props.history.undo()) say(`Undone: ${label}.`)
}

const connectionLine = computed(() => {
  const s = chat.connection.value
  if (s === 'lost') return 'Connection to the agent lost. The bar keeps trying to reconnect.'
  if (s === 'reconnecting' && chat.busy.value) return 'Connection dropped while the agent was working. Reconnecting…'
  return ''
})

const say = (text) => {
  // Re-set even when the text repeats, so a screen reader reads it again.
  announcement.value = ''
  nextTick(() => { announcement.value = text })
}

function render(text) { return renderUntrustedMarkdown(text || '') }

// The tool steps of a message: the live timeline while it streams, its snapshot after; tool frames when no timeline came.
function stepsOf(m) {
  const live = m.status === 'streaming' ? chat.liveSteps.value : (m.steps || [])
  const rows = live.map((s, i) => ({ key: s.stepId || `s${i}`, label: s.label, status: s.status === 'ok' ? 'done' : s.status, reason: s.status === 'failed' ? s.reason : '' }))
  if (rows.length) return rows
  return (m.toolCalls || []).map((t, i) => ({ key: `t${i}`, label: t.name, status: t.status === 'error' ? 'failed' : t.status, reason: t.error || '' }))
}
const stepStatusWord = (s) => ({ running: 'running', failed: 'failed', interrupted: 'stopped' }[s] || 'done')
const markWord = (mark) => ({ add: 'Added', remove: 'Removed' }[mark] || 'Changed')

function focusInput() { nextTick(() => inputEl.value?.focus()) }
function scrollDown() {
  nextTick(() => { const el = scrollEl.value; if (el) el.scrollTop = el.scrollHeight })
}

function togglePanel() { open.value = !open.value; if (open.value) scrollDown() }
function closePanel() { open.value = false; focusInput() }

// Esc closes the panel (focus back in the prompt); with the panel closed it only leaves the prompt. Either way the
// canvas does not also act on it (it would clear the selection).
function onEscape(e) {
  if (open.value) { closePanel(); return }
  if (e.target === inputEl.value) inputEl.value.blur()
}

async function submit() {
  const text = draft.value.trim()
  if (!text || chat.busy.value) return
  open.value = true
  const sent = await chat.send(text)
  if (sent) {
    draft.value = ''
    say('Sent to the agent.')
  }
  scrollDown()
  focusInput()
}

function onStop() {
  chat.stop()
  say('The agent was stopped.')
  focusInput()
}

function onNewConversation() {
  chat.newConversation()
  say('New conversation started.')
  focusInput()
}

async function onProposal(frame) {
  open.value = true
  const shown = await props.proposal.receive(frame)
  if (!shown) return
  const all = hunks.value.length
  const refused = hunks.value.filter((h) => h.state === 'refused').length
  say(`The agent proposed ${all} change${all === 1 ? '' : 's'}${refused ? `, ${refused} refused` : ''}. Accept or reject them, then save the workflow.`)
  scrollDown()
}

function onAccept(h) {
  if (props.proposal.accept(h.index)) say(`Accepted: ${h.summary}. Save the workflow to keep it.`)
}
function onReject(h) {
  if (props.proposal.reject(h.index)) say(`Rejected: ${h.summary}.`)
}
function onAcceptAll() {
  const n = props.proposal.acceptAll()
  if (n) say(`Accepted ${n} change${n === 1 ? '' : 's'}. Save the workflow to keep them.`)
}
function onRejectAll() {
  const n = props.proposal.rejectAll()
  if (n) say(`Rejected ${n} change${n === 1 ? '' : 's'}.`)
}

// A finished reply is read out once; the streaming text is not (it would be read chunk by chunk).
watch(() => chat.busy.value, (now, before) => {
  if (!before || now) return
  const last = [...chat.messages.value].reverse().find((m) => m.role === 'assistant')
  if (!last) return
  if (last.error) say(`The agent could not finish: ${last.error}`)
  else if (last.status === 'stopped') say('The agent was stopped.')
  else if (last.content) say(`The agent replied: ${last.content}`)
  scrollDown()
})
watch(() => chat.messages.value.map((m) => m.content.length).join(','), () => { if (open.value) scrollDown() })

onMounted(() => { chat.ensureAgent() })

defineExpose({ focus: focusInput, open: () => { open.value = true } })
</script>

<style scoped>
.wfab {
  --ab-surface: var(--wf-surface, var(--vm-surface));
  --ab-soft: var(--wf-surface-soft, var(--vm-surface-soft));
  --ab-ink: var(--wf-ink, var(--vm-ink));
  --ab-ink-soft: var(--wf-ink-soft, var(--vm-ink-soft));
  --ab-muted: var(--wf-muted, var(--vm-ink-faint));
  --ab-line: var(--wf-line, var(--vm-line));
  --ab-accent: var(--wf-accent, var(--vm-primary));
  --ab-accent-strong: var(--wf-accent-strong, var(--vm-primary-d));
  --ab-accent-ink: var(--wf-accent-ink, var(--vm-link));
  --ab-accent-soft: var(--wf-accent-soft, var(--vm-primary-soft));
  --ab-on-accent: var(--wf-on-accent, #FFFFFF);
  --ab-focus: var(--wf-focus, var(--vm-focus));
  --ab-ok-ink: var(--wf-success-ink, var(--vm-green-ink));
  --ab-ok-soft: var(--wf-success-soft, var(--vm-green-soft));
  --ab-no-ink: var(--wf-danger-ink, var(--vm-red-ink));
  --ab-no-soft: var(--wf-danger-soft, var(--vm-red-soft));
  --ab-warn-ink: var(--wf-warn-ink, var(--vm-amber-ink));
  --ab-warn-soft: var(--wf-warn-soft, var(--vm-amber-soft));
  --ab-shadow: var(--wf-shadow-tint, rgb(15 23 42 / .08));
  position: absolute;
  left: 50%;
  bottom: var(--wf-agentbar-bottom, 16px);
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  width: min(600px, calc(100% - 32px));
  transform: translateX(-50%);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  color: var(--ab-ink);
}

/* ── the panel ─────────────────────────────────────────────────────────────────────────────────── */
.wfab-panel {
  display: flex;
  flex-direction: column;
  max-height: min(460px, calc(100vh - 220px));
  background: var(--ab-surface);
  border: 1px solid var(--ab-line);
  border-radius: 14px;
  box-shadow: 0 12px 32px var(--ab-shadow), 0 2px 6px var(--ab-shadow);
  overflow: hidden;
}
.wfab-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 8px 14px;
  border-bottom: 1px solid var(--ab-line);
}
.wfab-title { display: flex; flex: 1; align-items: center; gap: 6px; min-width: 0; margin: 0; font-size: 13px; font-weight: 600; }
.wfab-title-ic { color: var(--ab-accent-ink); }
.wfab-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ab-accent-soft);
  color: var(--ab-accent-ink);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.wfab-scroll { flex: 1; min-height: 0; padding: 10px 14px 12px; overflow-y: auto; overscroll-behavior: contain; }
.wfab-empty { margin: 4px 0 8px; color: var(--ab-ink-soft); font-size: 13px; line-height: 1.5; }

.wfab-log { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.wfab-msg { min-width: 0; font-size: 13px; line-height: 1.55; }
.wfab-user {
  align-self: flex-end;
  max-width: 85%;
  margin: 0 0 0 auto;
  padding: 7px 11px;
  border-radius: 12px 12px 4px 12px;
  background: var(--ab-accent-soft);
  color: var(--ab-ink);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.wfab-msg--user { display: flex; }
.wfab-md { color: var(--ab-ink); overflow-wrap: anywhere; }
.wfab-md :deep(p) { margin: 0 0 6px; }
.wfab-md :deep(p:last-child) { margin-bottom: 0; }
.wfab-md :deep(ul), .wfab-md :deep(ol) { margin: 0 0 6px; padding-left: 18px; }
.wfab-md :deep(code) { padding: 1px 4px; border-radius: 4px; background: var(--ab-soft); font-size: .9em; }
.wfab-md :deep(pre) { padding: 8px 10px; border-radius: 8px; background: var(--ab-soft); overflow-x: auto; }
.wfab-md :deep(a) { color: var(--ab-accent-ink); text-decoration: underline; }

.wfab-thinking, .wfab-note { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 4px 0 0; color: var(--ab-ink-soft); }
.wfab-steps { display: flex; flex-direction: column; gap: 3px; margin: 0 0 6px; padding: 0; list-style: none; }
.wfab-step { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--ab-ink-soft); font-size: 12.5px; }
.wfab-step-ic { flex: none; }
.wfab-step.is-done .wfab-step-ic { color: var(--ab-ok-ink); }
.wfab-step.is-failed .wfab-step-ic, .wfab-step.is-failed .wfab-step-reason { color: var(--ab-no-ink); }
.wfab-step.is-interrupted .wfab-step-ic { color: var(--ab-warn-ink); }
.wfab-step.is-running .wfab-step-ic { color: var(--ab-accent-ink); }
.wfab-step-label { min-width: 0; overflow-wrap: anywhere; }
.wfab-step-reason { flex-basis: 100%; padding-left: 20px; }

.wfab-error {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
  margin-top: 6px;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--ab-no-soft);
  color: var(--ab-no-ink);
  overflow-wrap: anywhere;
}
.wfab-error-ic { flex: none; margin-top: 3px; }
.wfab-error > span { flex: 1; min-width: 0; }
.wfab-link, .wfab-link-btn {
  color: var(--ab-accent-ink);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.wfab-link-btn { padding: 0; border: 0; background: none; font: inherit; }
.wfab-error .wfab-link { color: inherit; }

/* ── proposal ─────────────────────────────────────────────────────────────────────────────────── */
.wfab-proposal { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--ab-line); }
.wfab-proposal-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.wfab-proposal-title { display: flex; flex-direction: column; margin: 0; font-size: 13px; font-weight: 600; }
.wfab-proposal-sub { color: var(--ab-ink-soft); font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; }
.wfab-proposal-actions { display: flex; gap: 6px; }
.wfab-hunks { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.wfab-hunk {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 6px 6px 8px;
  border: 1px solid var(--ab-line);
  border-radius: 9px;
  font-size: 12.5px;
}
.wfab-hunk.is-accepted, .wfab-hunk.is-rejected { color: var(--ab-ink-soft); background: var(--ab-soft); }
.wfab-hunk.is-refused { border-color: color-mix(in srgb, var(--ab-no-ink) 35%, transparent); }
.wfab-mark {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border-radius: 6px;
}
.mark-add .wfab-mark { background: var(--ab-ok-soft); color: var(--ab-ok-ink); }
.mark-change .wfab-mark { background: var(--ab-warn-soft); color: var(--ab-warn-ink); }
.mark-remove .wfab-mark { background: var(--ab-no-soft); color: var(--ab-no-ink); }
.wfab-hunk-body { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; padding-top: 2px; }
.wfab-hunk-text { overflow-wrap: anywhere; }
.wfab-hunk.is-rejected .wfab-hunk-text { text-decoration: line-through; }
.wfab-hunk-state { color: var(--ab-ink-soft); font-size: 12px; }
.wfab-hunk-refused { display: flex; align-items: flex-start; gap: 4px; color: var(--ab-no-ink); font-size: 12px; overflow-wrap: anywhere; }
.wfab-hunk-refused :deep(svg) { flex: none; margin-top: 2px; }
.wfab-hunk-actions { display: flex; flex: none; gap: 2px; }
.wfab-saved-note { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 8px 0 0; color: var(--ab-ink-soft); font-size: 12.5px; }
.wfab-issues { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: var(--ab-warn-soft); color: var(--ab-warn-ink); font-size: 12.5px; }
.wfab-issues-title { margin: 0 0 4px; font-weight: 600; }
.wfab-issues ul { margin: 0; padding-left: 18px; overflow-wrap: anywhere; }

/* ── buttons ──────────────────────────────────────────────────────────────────────────────────── */
.wfab-icon-btn, .wfab-btn, .wfab-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color .15s ease, color .15s ease, border-color .15s ease;
}
.wfab-icon-btn {
  position: relative;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  color: var(--ab-ink-soft);
  font-size: 16px;
}
.wfab-icon-btn:hover:not(:disabled) { background: var(--ab-soft); color: var(--ab-ink); }
.wfab-icon-btn--ok:hover:not(:disabled) { background: var(--ab-ok-soft); color: var(--ab-ok-ink); }
.wfab-icon-btn--no:hover:not(:disabled) { background: var(--ab-no-soft); color: var(--ab-no-ink); }
.wfab-btn {
  min-height: 32px;
  padding: 0 12px;
  border-color: var(--ab-line);
  border-radius: 8px;
  background: var(--ab-surface);
  color: var(--ab-ink);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
}
.wfab-btn:hover:not(:disabled) { background: var(--ab-soft); }
.wfab-btn--primary { border-color: var(--ab-accent); background: var(--ab-accent); color: var(--ab-on-accent); }
.wfab-btn--primary:hover:not(:disabled) { border-color: var(--ab-accent-strong); background: var(--ab-accent-strong); }
.wfab-icon-btn:disabled, .wfab-btn:disabled, .wfab-send:disabled { opacity: .45; cursor: not-allowed; }
.wfab-icon-btn:focus-visible, .wfab-btn:focus-visible, .wfab-send:focus-visible,
.wfab-link:focus-visible, .wfab-link-btn:focus-visible {
  outline: 2px solid var(--ab-focus);
  outline-offset: 2px;
}

/* ── the bar ──────────────────────────────────────────────────────────────────────────────────── */
.wfab-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 48px;
  padding: 0 6px 0 14px;
  background: var(--ab-surface);
  border: 1px solid var(--ab-line);
  border-radius: 999px;
  box-shadow: 0 8px 24px var(--ab-shadow), 0 1px 3px var(--ab-shadow);
}
.wfab-bar:focus-within { border-color: var(--ab-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ab-focus) 25%, transparent), 0 8px 24px var(--ab-shadow); }
.wfab-bar-ic { flex: none; color: var(--ab-accent-ink); font-size: 16px; }
.wfab-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 6px;
  border: 0;
  background: transparent;
  color: var(--ab-ink);
  font: inherit;
  font-size: 14px;
  outline: none; /* the whole bar shows focus (:focus-within above) */
}
.wfab-input::placeholder { color: var(--ab-muted); }
.wfab-send {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--ab-accent);
  color: var(--ab-on-accent);
  font-size: 16px;
}
.wfab-send:hover:not(:disabled) { background: var(--ab-accent-strong); }
.wfab-send--stop { background: var(--ab-ink); color: var(--ab-surface); }
.wfab-send--stop:hover { background: var(--ab-ink-soft); }
.wfab-badge {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--ab-accent);
  color: var(--ab-on-accent);
  font-size: 10.5px;
  font-weight: 700;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}
.wfab-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--ab-ink-soft);
  font-size: 12px;
}
.wfab-conn {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--ab-warn-soft);
  color: var(--ab-warn-ink);
  font-size: 12.5px;
}
.wfab-conn.is-lost { background: var(--ab-no-soft); color: var(--ab-no-ink); }

/* ── motion ───────────────────────────────────────────────────────────────────────────────────── */
.wfab-spin { animation: wfab-spin 1s linear infinite; }
@keyframes wfab-spin { to { transform: rotate(360deg); } }
.wfab-pop-enter-active, .wfab-pop-leave-active { transition: opacity .16s ease, transform .16s ease; }
.wfab-pop-enter-from, .wfab-pop-leave-to { opacity: 0; transform: translateY(6px); }
@media (prefers-reduced-motion: reduce) {
  .wfab-spin { animation: none; }
  .wfab-pop-enter-active, .wfab-pop-leave-active { transition: none; }
  .wfab-icon-btn, .wfab-btn, .wfab-send { transition: none; }
}

/* Touch: 44px targets. */
@media (pointer: coarse) {
  .wfab-icon-btn, .wfab-send { width: 44px; height: 44px; }
  .wfab-btn { min-height: 44px; }
  .wfab-bar { min-height: 54px; }
}
@media (max-width: 480px) {
  .wfab { width: calc(100% - 16px); }
  .wfab-panel { max-height: calc(100vh - 180px); }
}
</style>
