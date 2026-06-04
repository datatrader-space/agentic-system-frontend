<template>
  <div class="composer-shell">
    <form class="composer" :class="{ focused }" @submit.prevent="onSubmit">
      <button type="button" class="ghost-btn" title="Attach (coming soon)" aria-label="Attach file" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>

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

      <!-- Stop while streaming, otherwise Send -->
      <button
        v-if="streaming"
        type="button"
        class="action-btn stop"
        title="Stop generating"
        aria-label="Stop generating"
        @click="$emit('stop')"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
      </button>
      <button
        v-else
        type="submit"
        class="action-btn send"
        :disabled="!draft.trim()"
        title="Send"
        aria-label="Send message"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    </form>
    <p class="composer-hint">Enter to send · Shift+Enter for new line</p>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
  streaming: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Message your agent…' },
})
const emit = defineEmits(['send', 'stop'])

const draft = ref('')
const inputEl = ref(null)
const focused = ref(false)

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
  if (!text || props.streaming) return
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
}
.composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 8px 8px 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.composer.focused {
  border-color: #c7d2fe;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}
.composer-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  resize: none;
  padding: 7px 0;
  font-size: 0.9375rem;
  font-family: inherit;
  line-height: 1.5;
  color: #0f172a;
  background: transparent;
  max-height: 200px;
}
.composer-input::placeholder { color: #94a3b8; }

.ghost-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  background: transparent;
  border: none;
  border-radius: 9px;
  color: #94a3b8;
  cursor: pointer;
}
.ghost-btn:disabled { opacity: 0.5; cursor: default; }
.ghost-btn svg { width: 18px; height: 18px; }

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}
.action-btn svg { width: 17px; height: 17px; }
.action-btn.send { color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.action-btn.send:hover:not(:disabled) { transform: translateY(-1px); }
.action-btn.send:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn.stop { color: #fff; background: #0f172a; }
.action-btn.stop:hover { background: #1e293b; }

.composer-hint {
  margin: 8px 0 0;
  text-align: center;
  font-size: 0.6875rem;
  color: #b0b8c4;
}
</style>
