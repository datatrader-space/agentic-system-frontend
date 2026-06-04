<template>
  <div class="welcome">
    <div class="welcome-inner">
      <div class="welcome-mark">
        <svg viewBox="0 0 32 32" fill="none"><rect x="3" y="3" width="26" height="26" rx="8" stroke="url(#wg)" stroke-width="2.5" /><path d="M10 16l4 4 8-8" stroke="url(#wg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /><defs><linearGradient id="wg" x1="0" y1="0" x2="32" y2="32"><stop stop-color="#6366f1" /><stop offset="1" stop-color="#d946ef" /></linearGradient></defs></svg>
      </div>
      <h1 class="welcome-title">What would you like your agent to do?</h1>
      <p class="welcome-sub">Ask about repositories, run tools, inspect system state, or generate a plan.</p>

      <!-- Agent picker -->
      <div v-if="chat.agents.length" class="agent-pick">
        <span class="agent-pick-label">Agent</span>
        <select class="agent-select" :value="chat.selectedAgentId" @change="onAgent($event)">
          <option v-for="a in chat.agents" :key="a.id" :value="String(a.id)">{{ a.name }}</option>
        </select>
      </div>
      <p v-else-if="chat.agentsLoaded" class="no-agent">
        No agents yet — <router-link to="/agents" class="no-agent-link">create one</router-link> to start chatting.
      </p>

      <!-- Suggestion chips -->
      <div class="chips">
        <button v-for="s in suggestions" :key="s" class="chip" @click="useSuggestion(s)">{{ s }}</button>
      </div>

      <!-- Composer (Phase 1 visual; full chat wiring lands in Phase 2) -->
      <form class="composer" @submit.prevent="submit">
        <textarea
          ref="inputEl"
          v-model="draft"
          class="composer-input"
          rows="1"
          placeholder="Message your agent…"
          @keydown="onKeydown"
        ></textarea>
        <div class="composer-actions">
          <span class="composer-hint">Enter to send · Shift+Enter for new line</span>
          <button type="submit" class="composer-send" :disabled="!draft.trim()" title="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { useChatStore } from '../../stores/useChatStore'

const emit = defineEmits(['submit'])
const chat = useChatStore()

const draft = ref('')
const inputEl = ref(null)

onMounted(() => chat.loadAgents())
const onAgent = (e) => chat.setAgent(e.target.value)

const suggestions = [
  'Analyze my repository structure',
  'List available tools',
  'Summarize recent activity',
  'Draft an implementation plan',
]

const useSuggestion = async (text) => {
  draft.value = text
  await nextTick()
  inputEl.value?.focus()
}

const onKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

const submit = () => {
  const text = draft.value.trim()
  if (!text) return
  emit('submit', text)
  draft.value = ''
}
</script>

<style scoped>
.welcome {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 32px 20px;
}
.welcome-inner {
  width: 100%;
  max-width: 680px;
  text-align: center;
}
.welcome-mark {
  width: 52px;
  height: 52px;
  margin: 0 auto 20px;
}
.welcome-mark svg { width: 100%; height: 100%; }
.welcome-title {
  font-size: 1.625rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 8px;
  line-height: 1.25;
}
.welcome-sub {
  font-size: 0.9375rem;
  color: #64748b;
  margin: 0 0 18px;
}
.agent-pick { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 22px; }
.agent-pick-label { font-size: 0.8125rem; color: #94a3b8; }
.agent-select {
  padding: 7px 12px; font-size: 0.8125rem; color: #0f172a;
  border: 1px solid #e2e8f0; border-radius: 9px; background: #fff; cursor: pointer;
}
.no-agent { font-size: 0.875rem; color: #94a3b8; margin: 0 0 22px; }
.no-agent-link { color: #6366f1; }
.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}
.chip {
  padding: 8px 14px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;
}
.chip:hover {
  border-color: #c7d2fe;
  color: #4f46e5;
  background: #fafaff;
}
.composer {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  text-align: left;
}
.composer:focus-within {
  border-color: #c7d2fe;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}
.composer-input {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-size: 0.9375rem;
  font-family: inherit;
  color: #0f172a;
  background: transparent;
  max-height: 160px;
}
.composer-input::placeholder { color: #94a3b8; }
.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.composer-hint { font-size: 0.6875rem; color: #94a3b8; }
.composer-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}
.composer-send:hover:not(:disabled) { transform: translateY(-1px); }
.composer-send:disabled { opacity: 0.4; cursor: not-allowed; }
.composer-send svg { width: 17px; height: 17px; }
.phase-note {
  margin-top: 14px;
  font-size: 0.75rem;
  color: #b0b8c4;
}
</style>
