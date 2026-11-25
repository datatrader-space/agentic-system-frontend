<!--
  One edit field of a Data Table row (ADM-1363), by the column's type: a date picker, a date-and-time picker (the
  person's local time), true / false, or text (numbers and JSON in a monospace field). Enter saves, Esc cancels.
-->
<template>
  <div class="tci">
    <select
      v-if="column.type === 'boolean'" class="tci-in" :value="modelValue" :aria-label="label"
      :aria-invalid="error ? 'true' : 'false'" :aria-describedby="error ? errId : undefined"
      @change="emit('update:modelValue', $event.target.value)" @keydown="onKey"
    >
      <option value="">(empty)</option>
      <option value="true">true</option>
      <option value="false">false</option>
    </select>
    <input
      v-else class="tci-in" :class="{ mono: ['json', 'number'].includes(column.type) }" :type="inputType"
      :inputmode="column.type === 'number' ? 'decimal' : undefined" :value="modelValue" :aria-label="label"
      :aria-invalid="error ? 'true' : 'false'" :aria-describedby="error ? errId : undefined" autocomplete="off" spellcheck="false"
      @input="emit('update:modelValue', $event.target.value)" @keydown="onKey"
    >
    <span v-if="error" :id="errId" class="tci-err">{{ error }}</span>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  column: { type: Object, required: true },
  modelValue: { type: String, default: '' },
  error: { type: String, default: '' },
  rowLabel: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'enter', 'escape'])

const errId = `tci-${useId()}`
const label = computed(() => `${props.column.label || props.column.key}, ${props.rowLabel}`)
const inputType = computed(() => ({ date: 'date', datetime: 'datetime-local' }[props.column.type] || 'text'))
function onKey(ev) {
  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); emit('enter') }
  if (ev.key === 'Escape') { ev.preventDefault(); emit('escape') }
}
</script>

<style scoped>
.tci { display: grid; gap: 2px; min-width: 140px; }
.tci-in { width: 100%; min-width: 0; min-height: 32px; padding: 5px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; }
.tci-in.mono { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; }
.tci-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.tci-in[aria-invalid="true"] { border-color: var(--vm-red-ink); }
.tci-err { font-size: 11px; color: var(--vm-red-ink); }
@media (pointer: coarse) { .tci-in { min-height: 44px; } }
</style>
