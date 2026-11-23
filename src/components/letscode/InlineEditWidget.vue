<template>
  <div ref="root" class="lc-ie" role="group" :aria-label="`Edit ${lines} with the Coding Agent`" data-test="ie-widget"
       @keydown="onKeydown">
    <!-- Inline edit on a selection (ADM-1315): the prompt over the selected lines (Ctrl+K), then Accept / Reject /
         Retry on the change the Coding Agent suggests. Its keys stay here: Monaco never sees them (Enter would type a
         line). -->
    <form class="lc-ie-row" @submit.prevent="send">
      <Icon icon="lucide:sparkles" class="lc-ie-ic" aria-hidden="true" />
      <label :for="inputId" class="lc-ie-sr">What should change in {{ lines }}?</label>
      <textarea :id="inputId" ref="input" v-model="text" class="lc-ie-input" rows="1" :disabled="state === 'running'"
                :placeholder="`Describe the change to ${lines}`" :aria-describedby="hintId" data-test="ie-input"
                @input="grow" />
      <span :id="hintId" class="lc-ie-sr">Enter sends, Shift+Enter starts a new line, Escape closes.</span>
      <button v-if="state !== 'running'" type="submit" class="lc-ie-btn primary" :disabled="!text.trim()"
              aria-label="Send (Enter)" title="Send (Enter)" data-test="ie-send">
        <Icon icon="lucide:arrow-up" aria-hidden="true" />
      </button>
      <span v-else class="lc-ie-busy" data-test="ie-busy">
        <Icon icon="lucide:loader-circle" class="lc-ie-spin" aria-hidden="true" /> Making the change…
      </span>
      <button type="button" class="lc-ie-btn" :aria-label="state === 'ready' ? 'Reject the change (Escape)' : 'Close (Escape)'"
              :title="state === 'ready' ? 'Reject (Esc)' : 'Close (Esc)'" data-test="ie-close" @click="$emit('close')">
        <Icon icon="lucide:x" aria-hidden="true" />
      </button>
    </form>

    <div v-if="state === 'ready'" class="lc-ie-row lc-ie-result">
      <span class="lc-ie-summary">{{ summary }}</span>
      <span v-if="costText" class="lc-ie-cost" data-test="ie-cost">{{ costText }}</span>
      <span class="lc-ie-actions">
        <button ref="acceptBtn" type="button" class="lc-ie-btn primary labelled" aria-label="Accept the change"
                title="Accept the change and save the file" data-test="ie-accept" @click="$emit('accept')">
          <Icon icon="lucide:check" aria-hidden="true" /><span>Accept</span>
        </button>
        <button type="button" class="lc-ie-btn labelled" aria-label="Reject the change" title="Reject (Esc)"
                data-test="ie-reject" @click="$emit('reject')">
          <Icon icon="lucide:undo-2" aria-hidden="true" /><span>Reject</span>
        </button>
        <button type="button" class="lc-ie-btn" aria-label="Retry: ask for the change again" title="Retry"
                :disabled="!text.trim()" data-test="ie-retry" @click="send">
          <Icon icon="lucide:rotate-ccw" aria-hidden="true" />
        </button>
      </span>
      <!-- The suggested lines for a screen reader: the green lines in the editor are drawn for the eye only. -->
      <pre class="lc-ie-sr" data-test="ie-sr-code">Suggested code:
{{ replacement }}</pre>
    </div>

    <div v-if="state === 'error'" class="lc-ie-row lc-ie-error" role="alert" data-test="ie-error">
      <Icon icon="lucide:circle-alert" class="lc-ie-ic" aria-hidden="true" />
      <span class="lc-ie-error-text">{{ error }}<template v-if="costText"> {{ costText }}</template></span>
      <button type="button" class="lc-ie-btn" aria-label="Retry" title="Retry" :disabled="!text.trim()"
              data-test="ie-error-retry" @click="send">
        <Icon icon="lucide:rotate-ccw" aria-hidden="true" />
      </button>
    </div>
    <p v-if="detail && state === 'error'" class="lc-ie-detail">{{ detail }}</p>

    <p class="lc-ie-sr" role="status" aria-live="polite" data-test="ie-status">{{ announce }}</p>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { fmtCost, shownCost } from '@/composables/tokens'
import { changeSummary } from '@/utils/inlineEdit'

const props = defineProps({
  startLine: { type: Number, required: true },
  endLine: { type: Number, required: true },
  // prompt | running | ready | error
  state: { type: String, default: 'prompt' },
  original: { type: String, default: '' },
  replacement: { type: String, default: '' },
  error: { type: String, default: '' },
  detail: { type: String, default: '' },
  // The finished job's answer: { cost_usd, price_usd } (what the person pays is shown).
  usage: { type: Object, default: null },
  instruction: { type: String, default: '' },
})
const emit = defineEmits(['send', 'accept', 'reject', 'close', 'height'])

const n = Math.random().toString(36).slice(2, 10)
const inputId = `lc-ie-input-${n}`
const hintId = `lc-ie-hint-${n}`
const root = ref(null)
const input = ref(null)
const acceptBtn = ref(null)
const text = ref(props.instruction)

const lines = computed(() => (props.startLine === props.endLine ? `line ${props.startLine}`
  : `lines ${props.startLine}–${props.endLine}`))
const summary = computed(() => changeSummary(props.original, props.replacement))
const costText = computed(() => {
  const c = shownCost(props.usage)
  return c == null ? '' : `${fmtCost(c)}, paid from your balance`
})
const announce = computed(() => {
  if (props.state === 'running') return 'Making the change.'
  if (props.state === 'ready') return `Suggested change ready: ${summary.value}. Accept, Reject or Retry.`
  return ''
})

function send() {
  const t = text.value.trim()
  if (t && props.state !== 'running') emit('send', t)
}

function onKeydown(e) {
  // Nothing typed here reaches the editor under it (its own Enter, Tab and Ctrl+K would act on the code).
  e.stopPropagation()
  if (e.key === 'Escape') {
    e.preventDefault()
    emit(props.state === 'ready' ? 'reject' : 'close')
  } else if (e.key === 'Enter' && !e.shiftKey && e.target === input.value) {
    e.preventDefault()
    send()
  }
}

function grow() {
  const el = input.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`
}

// The zone above the lines is as tall as this widget.
let observer = null
onMounted(() => {
  nextTick(() => { input.value?.focus(); grow() })
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(() => emit('height', root.value?.offsetHeight || 0))
    observer.observe(root.value)
  }
  emit('height', root.value?.offsetHeight || 0)
})
onBeforeUnmount(() => { observer?.disconnect(); observer = null })

watch(() => props.state, (s) => nextTick(() => {
  if (s === 'ready') acceptBtn.value?.focus()
  else if (s === 'prompt' || s === 'error') input.value?.focus()
}))
</script>

<style scoped>
.lc-ie {
  box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; padding: 6px 8px; z-index: 10;
  font: 13px/1.4 var(--vm-font-sans); color: var(--vm-ink);
  background: var(--vm-surface); border: 1px solid color-mix(in srgb, var(--vm-violet) 45%, var(--vm-line));
  border-radius: 8px; box-shadow: var(--vm-shadow-l, 0 4px 14px rgba(0, 0, 0, .18));
}
.lc-ie-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.lc-ie-ic { width: 15px; height: 15px; flex: 0 0 auto; color: var(--vm-violet); }
.lc-ie-input {
  flex: 1 1 auto; min-width: 0; resize: none; max-height: 140px; padding: 5px 8px;
  font: 13px/1.4 var(--vm-font-sans); color: var(--vm-ink); background: var(--vm-surface-soft);
  border: 1px solid var(--vm-line); border-radius: 6px; outline: none;
}
.lc-ie-input:focus-visible { border-color: var(--vm-focus); box-shadow: 0 0 0 2px color-mix(in srgb, var(--vm-focus) 25%, transparent); }
.lc-ie-input:disabled { color: var(--vm-ink-soft); }
.lc-ie-btn {
  flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  min-width: 30px; height: 30px; padding: 0 6px; border-radius: 6px; cursor: pointer;
  font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); background: transparent;
  border: 1px solid var(--vm-line); transition: background-color .15s, color .15s, border-color .15s;
}
.lc-ie-btn :deep(svg) { width: 15px; height: 15px; }
.lc-ie-btn:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.lc-ie-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.lc-ie-btn:disabled { opacity: .5; cursor: default; }
.lc-ie-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: white; }
.lc-ie-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); border-color: var(--vm-violet-d); color: white; }
.lc-ie-btn.labelled { padding: 0 10px; }
.lc-ie-busy { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--vm-ink-soft); white-space: nowrap; }
.lc-ie-busy :deep(svg) { width: 15px; height: 15px; }
.lc-ie-spin { animation: lc-ie-spin 1s linear infinite; }
@keyframes lc-ie-spin { to { transform: rotate(360deg); } }
.lc-ie-result { flex-wrap: wrap; }
.lc-ie-summary { font-weight: 600; color: var(--vm-ink); }
.lc-ie-cost { font-size: 12px; color: var(--vm-ink-soft); }
.lc-ie-actions { display: inline-flex; gap: 6px; margin-left: auto; }
.lc-ie-error { color: var(--vm-red-ink); }
.lc-ie-error .lc-ie-ic { color: var(--vm-red-ink); }
.lc-ie-error-text { flex: 1 1 auto; min-width: 0; }
.lc-ie-detail {
  margin: 0; padding: 4px 8px; max-height: 120px; overflow: auto; white-space: pre-wrap; font-size: 12px;
  color: var(--vm-ink-soft); background: var(--vm-surface-soft); border-radius: 6px;
}
.lc-ie-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
@media (max-width: 640px) {
  .lc-ie-btn { min-width: 44px; height: 44px; }
  .lc-ie-input { min-height: 44px; font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .lc-ie-spin { animation: none; }
  .lc-ie-btn { transition: none; }
}
</style>
