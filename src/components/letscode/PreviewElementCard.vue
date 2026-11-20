<template>
  <section class="pe" aria-label="The selected element">
    <div class="pe-head">
      <code class="pe-tag" translate="no">{{ elementLabel(element) }}</code>
      <span class="pe-size">{{ element.box.width }}×{{ element.box.height }}</span>
      <button type="button" class="pe-tool" aria-label="Clear the selection" title="Clear" @click="emit('clear')">
        <Icon icon="lucide:x" aria-hidden="true" />
      </button>
    </div>
    <p class="pe-line">
      <Icon icon="lucide:file-code" class="pe-ic" aria-hidden="true" />
      <span v-if="element.source" class="pe-src" translate="no" :title="sourceLabel(element.source)">{{ sourceLabel(element.source) }}</span>
      <span v-else class="pe-none">The app does not say which file this comes from; the agent finds it from the element.</span>
    </p>
    <p v-if="element.text" class="pe-text" :title="element.text">“{{ element.text }}”</p>
    <p v-if="edit && edit.after !== edit.before" class="pe-edit">
      Changed in the preview only: “{{ edit.before }}” → “{{ edit.after }}”. Ask the agent to make it in the code.
    </p>
    <p v-if="editing" class="pe-edit" role="status">Type the new text in the preview, then press Enter (Esc puts it back).</p>
    <label class="pe-ask">
      <span class="sr-only">What should change?</span>
      <textarea v-model="request" name="preview-element-request" rows="2" autocomplete="off" placeholder="What should change? (optional)"
                @keydown.enter.ctrl.prevent="ask" @keydown.enter.meta.prevent="ask"></textarea>
    </label>
    <div class="pe-actions">
      <button type="button" class="pe-btn primary" :disabled="busy" @click="ask">
        <Icon :icon="busy ? 'lucide:loader-circle' : 'lucide:send'" :class="{ spin: busy }" aria-hidden="true" />
        {{ busy ? 'Sending…' : 'Ask the agent' }}
      </button>
      <button type="button" class="pe-btn" :disabled="!element.editable || editing" :title="element.editable ? '' : 'Only an element that holds text alone can be edited here'"
              @click="emit('edit-text')">
        <Icon icon="lucide:type" aria-hidden="true" /> Edit text
      </button>
    </div>
    <p v-if="note" class="pe-note" :class="{ err: noteError }" :role="noteError ? 'alert' : 'status'">{{ note }}</p>
  </section>
</template>

<script setup>
// The element picked in the preview (ADM-1318): where it comes from, and one message to the agent about it, with a
// picture of the preview. "Edit text" changes the text in the preview only; the agent makes the real change.
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { elementLabel, sourceLabel } from './previewInspector'

const props = defineProps({
  element: { type: Object, required: true },
  edit: { type: Object, default: null },          // { before, after } after a text edit in the preview
  editing: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  note: { type: String, default: '' },
  noteError: { type: Boolean, default: false },
})
const emit = defineEmits(['ask', 'edit-text', 'clear'])
const request = ref('')
watch(() => props.element, () => { request.value = '' })

function ask() {
  if (props.busy) return
  emit('ask', request.value)
}
defineExpose({ clearRequest: () => { request.value = '' } })
</script>

<style scoped>
.pe { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--vm-line); background: var(--vm-surface); flex: 0 0 auto; }
.pe-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pe-tag { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 12.5px var(--vm-font-mono); color: var(--vm-violet-ink, var(--vm-ink)); }
.pe-size { font: 11.5px var(--vm-font-mono); color: var(--vm-ink-faint); font-variant-numeric: tabular-nums; }
.pe-tool {
  display: grid; place-items: center; width: 24px; height: 24px; margin-left: auto; border: none; border-radius: 4px; background: transparent;
  color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; flex: 0 0 auto;
}
.pe-tool:hover { background: color-mix(in srgb, var(--vm-ink) 8%, transparent); color: var(--vm-ink); }
.pe-tool :deep(svg) { width: 14px; height: 14px; }
.pe-line { display: flex; align-items: center; gap: 6px; margin: 0; min-width: 0; font-size: 12px; }
.pe-ic { width: 13px; height: 13px; color: var(--vm-ink-faint); flex: 0 0 auto; }
.pe-src { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--vm-font-mono); color: var(--vm-ink); }
.pe-none { color: var(--vm-ink-faint); }
.pe-text { margin: 0; font-size: 12.5px; color: var(--vm-ink-soft); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pe-edit { margin: 0; font-size: 12px; color: var(--vm-ink-soft); overflow-wrap: anywhere; }
.pe-ask textarea {
  width: 100%; resize: vertical; min-height: 40px; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 8px;
  background: var(--vm-surface); color: var(--vm-ink); font: 13px/1.4 var(--vm-font-sans);
}
.pe-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.pe-btn {
  display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: 8px;
  background: var(--vm-surface); color: var(--vm-ink); font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, filter .15s;
}
.pe-btn :deep(svg) { width: 14px; height: 14px; }
.pe-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.pe-btn.primary { border-color: transparent; background: var(--vm-violet); color: #fff; }
.pe-btn.primary:hover:not(:disabled) { background: var(--vm-violet); filter: brightness(1.08); }
.pe-btn:disabled { opacity: .55; cursor: default; }
.pe-tool:focus-visible, .pe-btn:focus-visible, .pe-ask textarea:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
.pe-note { margin: 0; font-size: 12px; color: var(--vm-ink-soft); }
.pe-note.err { color: var(--vm-danger); }
.pe-tool, .pe-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.spin { animation: pe-turn .8s linear infinite; }
@keyframes pe-turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } .pe-btn, .pe-tool { transition: none; } }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (max-width: 640px) {
  .pe-tool { width: 44px; height: 44px; }
  .pe-btn { min-height: 44px; }
  .pe-ask textarea { font-size: 16px; }
}
</style>
