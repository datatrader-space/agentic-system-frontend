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

    <!-- Composer (thread mode; welcome screen has its own) -->
    <div v-if="!chat.isEmpty" class="chat-footer">
      <ChatComposer :streaming="chat.isStreaming" @send="onSend" @stop="chat.stop()" />
    </div>
  </div>
</template>

<script setup>
import { computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../../stores/useChatStore'
import ChatWelcome from './ChatWelcome.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatComposer from './ChatComposer.vue'

const chat = useChatStore()
const route = useRoute()
const router = useRouter()

const title = computed(() => {
  const first = chat.messages.find((m) => m.role === 'user')
  return first ? first.content.slice(0, 60) : 'New Chat'
})

const onSend = (text) => chat.sendMessage(text)

const startNew = () => {
  chat.reset()
  if (route.path !== '/dashboard/chat/new') router.push('/dashboard/chat/new')
}

onMounted(() => {
  chat.loadAgents()
  const sid = route.params.sessionId
  if (sid) chat.openConversation(sid)
  else if (chat.conversationId) chat.reset()
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
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid #eef1f5;
  background: #fff;
  flex-shrink: 0;
}
.chat-head-text { min-width: 0; }
.chat-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-agent { font-size: 0.75rem; color: #8b5cf6; font-weight: 500; }
.header-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.header-btn:hover { border-color: #c7d2fe; color: #4f46e5; }
.header-btn svg { width: 15px; height: 15px; }

.chat-body { flex: 1; min-height: 0; }
.chat-footer { flex-shrink: 0; background: linear-gradient(to top, #f6f7f9 60%, transparent); }
</style>
