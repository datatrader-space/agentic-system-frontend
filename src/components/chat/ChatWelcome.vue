<template>
  <div class="welcome">
    <div class="welcome-inner">
      <div class="welcome-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      </div>
      <h1 class="welcome-title">What would you like your <span class="vm-grad-text">agent</span> to do?</h1>
      <p class="welcome-sub">Ask about repositories, run tools, inspect system state, or generate a plan.</p>

      <!-- Agent + mode now live inside the composer bottom bar (Claude-style), below. -->
      <p v-if="chat.agentsLoaded && !chat.agents.length" class="no-agent">
        No agents yet — <router-link to="/dashboard/agents" class="no-agent-link">create one</router-link> to start chatting.
      </p>

      <!-- Suggestion chips -->
      <div class="chips">
        <button v-for="s in suggestions" :key="s" class="chip" @click="useSuggestion(s)">{{ s }}</button>
      </div>

      <!-- Composer -->
      <form class="composer" @submit.prevent="submit">
        <!-- Staged attachments -->
        <div v-if="chat.pendingAttachments.length" class="attach-strip">
          <div v-for="(a, i) in chat.pendingAttachments" :key="i" class="attach-chip">
            <img v-if="a.isImage && a.url" :src="a.url" class="attach-thumb" :alt="a.name" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="attach-fileicon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
            <span class="attach-name">{{ a.name }}</span>
            <button type="button" class="attach-x" title="Remove" @click="chat.removeAttachment(i)">×</button>
          </div>
        </div>
        <input ref="fileEl" type="file" accept="image/*" multiple class="file-hidden" @change="onFiles" />
        <div class="composer-top">
          <textarea
            ref="inputEl"
            v-model="draft"
            class="composer-input"
            rows="1"
            placeholder="Message your agent…"
            @keydown="onKeydown"
          ></textarea>
          <button v-if="speech.supported" type="button" class="composer-mic" :class="{ live: speech.listening.value }"
                  :title="speech.listening.value ? 'Stop dictation' : 'Voice input'" @click="speech.toggle()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
          </button>
        </div>
        <!-- Bottom toolbar: + attach + mode pill (left), send (right) -->
        <div class="composer-actions">
          <div class="composer-bar-left">
            <button type="button" class="composer-attach" title="Attach image" @click="fileEl?.click()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14" stroke-linecap="round" /></svg>
            </button>
            <!-- searchable agent picker (autocomplete, ~5 visible) -->
            <AgentSelect :agents="chat.agents" :selected-id="chat.selectedAgentId" @select="onSelectAgent" />
            <AgentModePicker v-if="chat.currentAgent"
              :key="chat.currentAgent.id"
              :agent-id="chat.currentAgent.id"
              :execution-mode="chat.currentAgent.execution_mode"
              :plan-mode="chat.currentAgent.plan_mode_enabled"
              placement="up" @change="onModeChange" />
          </div>
          <button type="submit" class="composer-send" :disabled="!draft.trim() && !chat.pendingAttachments.length" title="Send">
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
import AgentModePicker from '../agent/AgentModePicker.vue'
import AgentSelect from './AgentSelect.vue'
import { useSpeech } from '../../composables/useSpeech'

const emit = defineEmits(['submit'])
const chat = useChatStore()

const draft = ref('')
const inputEl = ref(null)
const fileEl = ref(null)

// Voice input (mic) — appends the transcript to the draft. Hidden when the browser can't transcribe.
const speech = useSpeech({ onResult: (text) => { draft.value = draft.value ? `${draft.value} ${text}` : text } })

const onFiles = (e) => {
  const files = e.target.files
  if (files && files.length) chat.addAttachments(files)
  e.target.value = ''
}

onMounted(() => chat.loadAgents())
const onSelectAgent = (a) => { if (a && a.id != null) chat.setAgent(a.id) }

// Reflect a mode change immediately on the selected agent (the picker also PATCHes the backend).
const onModeChange = (patch) => {
  if (chat.currentAgent) {
    chat.currentAgent.execution_mode = patch.execution_mode
    chat.currentAgent.plan_mode_enabled = patch.plan_mode_enabled
  }
}

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
  if (!text && !chat.pendingAttachments.length) return
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
  font-family: var(--vm-font-sans);
}
.welcome-inner {
  width: 100%;
  max-width: 680px;
  text-align: center;
}
.welcome-mark {
  width: 56px;
  height: 56px;
  margin: 0 auto 22px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vm-g-brand);
  box-shadow: var(--vm-glow-v);
  animation: vmPop .7s var(--vm-ease) both, vmFloat 5s ease-in-out infinite;
}
.welcome-mark svg { width: 28px; height: 28px; }
.welcome-title {
  font-family: var(--vm-font-display);
  font-size: 1.875rem;
  font-weight: 700;
  letter-spacing: -.025em;
  color: var(--vm-ink);
  margin: 0 0 8px;
  line-height: 1.2;
}
.welcome-sub {
  font-size: 0.9375rem;
  color: var(--vm-ink-soft);
  margin: 0 0 18px;
}
.agent-pick { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 22px; }
.agent-pick-label { font-size: 0.8125rem; color: var(--vm-ink-faint); font-weight: 600; }
.agent-select {
  padding: 8px 12px; font-size: 0.8125rem; font-weight: 600; color: var(--vm-ink);
  border: 1px solid var(--vm-line-2); border-radius: 12px; background: var(--vm-surface); cursor: pointer;
}
.agent-select:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(14,165,233,.16); }
.no-agent { font-size: 0.875rem; color: var(--vm-ink-faint); margin: 0 0 22px; }
.no-agent-link { color: var(--vm-violet-d); font-weight: 600; }
.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}
.chip {
  padding: 9px 15px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vm-ink-soft);
  background: var(--vm-glass-strong);
  border: 1px solid var(--vm-line);
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.18s var(--vm-ease), box-shadow 0.18s, color 0.18s, border-color 0.18s;
}
.chip:hover {
  transform: translateY(-2px);
  border-color: transparent;
  color: var(--vm-violet-d);
  background: var(--vm-violet-soft);
  box-shadow: var(--vm-shadow-s);
}
.composer {
  background: var(--vm-surface);
  border: 1.5px solid var(--vm-line);
  border-radius: 18px;
  padding: 12px 14px;
  box-shadow: var(--vm-shadow-m);
  text-align: left;
  transition: border-color .2s var(--vm-ease2), box-shadow .2s;
}
.composer:focus-within {
  border-color: var(--vm-sky);
  box-shadow: 0 0 0 4px rgba(14, 165, 233, .16);
}
.composer-input {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-size: 0.9375rem;
  font-family: inherit;
  color: var(--vm-ink);
  background: transparent;
  max-height: 160px;
}
.composer-input::placeholder { color: var(--vm-ink-faint); }
.composer-top { display: flex; align-items: flex-start; gap: 6px; }
.composer-mic {
  display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex-shrink: 0;
  border: none; border-radius: 9999px; background: transparent; color: #94a3b8; cursor: pointer; transition: .15s var(--vm-ease);
}
.composer-mic:hover { color: var(--vm-violet); background: var(--vm-violet-soft); }
.composer-mic.live { color: #fff; background: #ef4444; animation: vmMicPulse 1.3s ease-in-out infinite; }
.composer-mic svg { width: 16px; height: 16px; }
@keyframes vmMicPulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.composer-bar-left { display: flex; align-items: center; gap: 6px; }
.composer-attach {
  display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px;
  border: none; border-radius: 9px; background: transparent; color: #94a3b8; cursor: pointer;
}
.composer-attach:hover { color: var(--vm-violet); background: var(--vm-violet-soft); }
.composer-attach svg { width: 18px; height: 18px; }
.file-hidden { display: none; }
.attach-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.attach-chip {
  display: inline-flex; align-items: center; gap: 6px; max-width: 220px;
  padding: 4px 6px 4px 4px; background: var(--vm-bg); border: 1px solid var(--vm-line); border-radius: 10px;
}
.attach-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.attach-fileicon { width: 22px; height: 22px; color: var(--vm-ink-soft); flex-shrink: 0; }
.attach-name { font-size: 0.75rem; color: var(--vm-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attach-x {
  flex-shrink: 0; width: 18px; height: 18px; line-height: 1; border: none; border-radius: 9999px;
  background: var(--vm-line-2); color: var(--vm-ink-soft); font-size: 14px; cursor: pointer;
}
.attach-x:hover { background: #cbd5e1; }
.composer-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  color: #fff;
  background: var(--vm-g-cool);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: var(--vm-glow-v);
  transition: transform 0.18s var(--vm-ease);
}
.composer-send:hover:not(:disabled) { transform: scale(1.08) rotate(-8deg); }
.composer-send:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
.composer-send svg { width: 17px; height: 17px; }
.phase-note {
  margin-top: 14px;
  font-size: 0.75rem;
  color: #b0b8c4;
}
</style>
