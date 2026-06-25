<template>
  <div class="chat-workspace">
    <!-- Thread header (only once a conversation has started) -->
    <header v-if="!chat.isEmpty" class="chat-header">
      <div class="chat-head-text">
        <h2 class="chat-title">{{ title }}</h2>
        <span v-if="chat.currentAgent" class="chat-agent">{{ chat.currentAgent.name }}</span>
      </div>
      <button class="header-btn" title="New chat" @click="startNew">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14" stroke-linecap="round" /></svg>
        <span>New</span>
      </button>
    </header>

    <!-- Body -->
    <div class="chat-body">
      <ChatWelcome v-if="chat.isEmpty" @submit="onSend" />
      <ChatMessageList v-else />
    </div>

    <!-- Manual Mode plan approval card (Planning Mode ON + Manual): approve resumes the run. -->
    <div v-if="chat.pendingPlan" class="chat-plan">
      <PlanApprovalCard :plan="chat.pendingPlan" :busy="chat.isStreaming"
        @approve="chat.approvePlan" @reject="chat.rejectPlan" @revise="chat.revisePlan" />
    </div>

    <!-- Composer (thread mode; welcome screen has its own) -->
    <div v-if="!chat.isEmpty" class="chat-footer">
      <!-- agent-id comes from selectedAgentId (always set once a conversation loads), NOT
           currentAgent — the latter only resolves if the agent is in the workspace-scoped
           agents list, so it would hide the mode picker for cross-workspace/unloaded agents.
           AgentModePicker re-fetches the agent's mode itself on mount, so the id is enough. -->
      <ChatComposer :streaming="chat.isStreaming" :attachments="chat.pendingAttachments"
        :agent-id="chat.selectedAgentId"
        :execution-mode="chat.currentAgent && chat.currentAgent.execution_mode"
        :plan-mode="chat.currentAgent && chat.currentAgent.plan_mode_enabled"
        @send="onSend" @stop="chat.stop()" @mode-change="onModeChange"
        @attach="chat.addAttachments" @remove-attach="chat.removeAttachment" />
      <div v-if="chat.sessionTokens" class="session-meter" :title="`Total tokens used in this chat`">
        Session {{ fmtTokens(chat.sessionTokens) }}<span v-if="chat.sessionCost"> · {{ fmtCost(chat.sessionCost) }}</span>
      </div>
    </div>

    <!-- Human-in-the-loop approval modal: appears when the backend gates a tool for approval. -->
    <HITLModal
      :requests="chat.hitlRequests"
      @respond="chat.respondHitl"
      @dismiss="chat.dismissHitl"
      @skip="chat.skipHitl"
    />
  </div>
</template>

<script setup>
import { computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../../stores/useChatStore'
import ChatWelcome from './ChatWelcome.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatComposer from './ChatComposer.vue'
import HITLModal from '../HITLModal.vue'
import PlanApprovalCard from '../agent/PlanApprovalCard.vue'
import { fmtTokens, fmtCost } from '../../composables/tokens'

const chat = useChatStore()
const route = useRoute()
const router = useRouter()

const title = computed(() => {
  const first = chat.messages.find((m) => m.role === 'user')
  return first ? first.content.slice(0, 60) : 'New Chat'
})

// Persist the mode change locally so the picker + any badges reflect it immediately.
const onModeChange = (patch) => {
  if (chat.currentAgent) {
    chat.currentAgent.execution_mode = patch.execution_mode
    chat.currentAgent.plan_mode_enabled = patch.plan_mode_enabled
  }
}

const onSend = (text) => chat.sendMessage(text)

const startNew = () => {
  chat.reset()
  if (route.path !== '/dashboard/chat/new') router.push('/dashboard/chat/new')
}

onMounted(async () => {
  await chat.loadAgents()
  const sid = route.params.sessionId
  if (sid) {
    chat.openConversation(sid)
  } else {
    if (chat.conversationId) chat.reset()
    // New chat: open the socket + pre-build the (auto-)selected agent now, during the idle window
    // before the user sends — so the first message reuses the runner (no ~6.6s cold build).
    chat.prewarmAgent()
  }
})

// Load a conversation by URL, or reset for a fresh "new chat".
watch(
  () => route.params.sessionId,
  (id) => {
    if (id) chat.openConversation(id)
    else chat.reset()
  }
)

// Once a brand-new chat gets a conversation id, reflect it in the URL so the
// session is bookmarkable and highlighted in the sidebar. openConversation()
// no-ops for the already-active conversation, so this won't disrupt streaming.
watch(
  () => chat.conversationId,
  (id) => {
    if (id && String(route.params.sessionId) !== String(id)) {
      router.replace(`/dashboard/chat/${id}`)
    }
  }
)
</script>

<style scoped>
.chat-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-family: var(--vm-font-sans);
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 22px;
  border-bottom: 1px solid var(--vm-line);
  background: var(--vm-glass-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  flex-shrink: 0;
}
.chat-head-text { min-width: 0; }
.chat-title {
  font-family: var(--vm-font-display);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -.01em;
  color: var(--vm-ink);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-agent {
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--vm-g-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.auto-badge { margin-left: 6px; padding: 1px 7px; border-radius: 9999px; background: #ccfbf1; color: #0f766e; font-size: 0.65rem; font-weight: 600; }
.header-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vm-ink-soft);
  background: var(--vm-surface);
  border: 1px solid var(--vm-line-2);
  border-radius: 12px;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s var(--vm-ease), box-shadow 0.15s, color 0.15s;
}
.header-btn:hover { transform: translateY(-1px); box-shadow: var(--vm-shadow-s); color: var(--vm-violet-d); }
.header-btn svg { width: 15px; height: 15px; }

.chat-body { flex: 1; min-height: 0; }
.chat-plan { flex-shrink: 0; padding: 8px 20px 0; }
.chat-footer { flex-shrink: 0; background: linear-gradient(to top, var(--vm-bg) 55%, transparent); }
.session-meter {
  text-align: right; padding: 2px 20px 6px; font-size: 11px; color: var(--vm-text-3, #6b7280);
  font-variant-numeric: tabular-nums; user-select: none;
}
</style>
