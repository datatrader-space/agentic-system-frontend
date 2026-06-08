<template>
  <div class="composer-shell">
    <!-- Staged attachments (images/files) to send with the next message -->
    <div v-if="attachments.length" class="attach-strip">
      <div v-for="(a, i) in attachments" :key="i" class="attach-chip">
        <img v-if="a.isImage && a.url" :src="a.url" class="attach-thumb" :alt="a.name" />
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="attach-fileicon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
        <span class="attach-name">{{ a.name }}</span>
        <button type="button" class="attach-x" title="Remove" @click="$emit('remove-attach', i)">×</button>
      </div>
    </div>

    <!-- Single unified container: text area on top, action toolbar on the bottom. -->
    <form class="composer" :class="{ focused }" @submit.prevent="onSubmit">
      <input ref="fileEl" type="file" accept="image/*" multiple class="file-hidden" @change="onFiles" />

      <div class="composer-top">
        <textarea
          ref="inputEl"
          v-model="draft"
          class="composer-input"
          rows="1"
          :placeholder="placeholder"
          aria-label="Message your agent"
          @input="autoGrow"
          @keydown="onKeydown"
          @focus="focused = true"
          @blur="focused = false"
        ></textarea>
        <!-- Mic (top-right) — only when the browser can actually transcribe -->
        <button v-if="speech.supported" type="button" class="mic-btn" :class="{ live: speech.listening.value }"
                :title="speech.listening.value ? 'Stop dictation' : 'Voice input'" aria-label="Voice input"
                @click="speech.toggle()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
        </button>
      </div>

      <!-- Bottom toolbar: attach + mode pill (left), send/stop (right) -->
      <div class="composer-bar">
        <div class="bar-left">
          <button type="button" class="ghost-btn" title="Attach image" aria-label="Attach image" @click="fileEl?.click()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14m-7-7h14" stroke-linecap="round"/></svg>
          </button>
          <AgentModePicker v-if="agentId" :agent-id="agentId" :execution-mode="executionMode"
                           :plan-mode="planMode" placement="up" @change="$emit('mode-change', $event)" />
        </div>

        <button v-if="streaming" type="button" class="action-btn stop" title="Stop generating"
                aria-label="Stop generating" @click="$emit('stop')">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
        </button>
        <button v-else type="submit" class="action-btn send"
                :disabled="!draft.trim() && attachments.length === 0" title="Send" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </form>
    <p class="composer-hint">Enter to send · Shift+Enter for new line</p>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import AgentModePicker from '../agent/AgentModePicker.vue'
import { useSpeech } from '../../composables/useSpeech'

const props = defineProps({
  streaming: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Message your agent…' },
  attachments: { type: Array, default: () => [] },
  // Agent + mode (so the mode pill lives inside the composer, Claude-style).
  agentId: { type: [Number, String], default: null },
  executionMode: { type: String, default: 'manual' },
  planMode: { type: Boolean, default: false },
})
const emit = defineEmits(['send', 'stop', 'attach', 'remove-attach', 'mode-change'])

const draft = ref('')
const inputEl = ref(null)
const fileEl = ref(null)
const focused = ref(false)

// Voice input appends the transcript to whatever's already typed.
const speech = useSpeech({
  onResult: (text) => {
    draft.value = draft.value ? `${draft.value} ${text}` : text
    nextTick(autoGrow)
  },
})

const onFiles = (e) => {
  const files = e.target.files
  if (files && files.length) emit('attach', files)
  e.target.value = '' // allow re-selecting the same file
}

const autoGrow = () => {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

const reset = async () => {
  draft.value = ''
  await nextTick()
  autoGrow()
}

const onSubmit = () => {
  const text = draft.value.trim()
  if ((!text && props.attachments.length === 0) || props.streaming) return
  emit('send', text)
  reset()
}

const onKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSubmit()
  }
}
</script>

<style scoped>
.composer-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 8px 16px 14px;
  font-family: var(--vm-font-sans);
}
.composer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: var(--vm-surface);
  border: 1.5px solid var(--vm-line);
  border-radius: 18px;
  box-shadow: var(--vm-shadow-m);
  transition: border-color 0.18s var(--vm-ease2), box-shadow 0.18s;
}
.composer.focused {
  border-color: var(--vm-sky);
  box-shadow: 0 0 0 4px rgba(14, 165, 233, .16);
}
.composer-top { display: flex; align-items: flex-start; gap: 6px; }
.composer-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  resize: none;
  padding: 6px 2px;
  font-size: 0.9375rem;
  font-family: inherit;
  line-height: 1.5;
  color: var(--vm-ink);
  background: transparent;
  max-height: 200px;
}
.composer-input::placeholder { color: var(--vm-ink-faint); }

/* bottom toolbar */
.composer-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.bar-left { display: flex; align-items: center; gap: 6px; }

.ghost-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; flex-shrink: 0;
  background: transparent; border: none; border-radius: 10px;
  color: var(--vm-ink-faint); cursor: pointer; transition: .15s var(--vm-ease);
}
.ghost-btn:hover { color: var(--vm-violet); background: var(--vm-violet-soft); }
.ghost-btn:disabled { opacity: 0.5; cursor: default; }
.ghost-btn svg { width: 18px; height: 18px; }

.mic-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; flex-shrink: 0;
  background: transparent; border: none; border-radius: 9999px;
  color: var(--vm-ink-faint); cursor: pointer; transition: .15s var(--vm-ease);
}
.mic-btn:hover { color: var(--vm-violet); background: var(--vm-violet-soft); }
.mic-btn.live { color: #fff; background: #ef4444; animation: micpulse 1.3s ease-in-out infinite; }
.mic-btn svg { width: 16px; height: 16px; }
@keyframes micpulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }

.file-hidden { display: none; }

.attach-strip { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 4px 8px; }
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

.action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; flex-shrink: 0;
  border: none; border-radius: 12px; cursor: pointer;
  transition: transform 0.18s var(--vm-ease), opacity 0.15s;
}
.action-btn svg { width: 17px; height: 17px; }
.action-btn.send { color: #fff; background: var(--vm-g-cool); box-shadow: var(--vm-glow-v); }
.action-btn.send:hover:not(:disabled) { transform: scale(1.08) rotate(-8deg); }
.action-btn.send:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
.action-btn.stop { color: #fff; background: var(--vm-ink); }
.action-btn.stop:hover { filter: brightness(1.15); }

.composer-hint {
  margin: 8px 0 0;
  text-align: center;
  font-size: 0.6875rem;
  color: var(--vm-ink-faint);
}
</style>
