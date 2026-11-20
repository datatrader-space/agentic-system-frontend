<!--
  A number setting (ADM-1333, F5). The saved value is a NUMBER (or null when the field is emptied, when `optional`),
  never the text of the box. A value outside min/max, a fraction where a whole number is needed, or text that is not a
  number is NOT saved: the field says why, inline, and the saved value stays as it was until the entry is valid.

    <NumberField id="f-retries" label="Retries" :model-value="data.retries" :min="0" :max="5" integer optional
                 @update:model-value="(v) => editor.set('retries', v, 'Retries')" />
-->
<template>
  <div class="nf">
    <input
      :id="id"
      class="nf-in"
      type="number"
      inputmode="decimal"
      :value="draft"
      :min="min ?? undefined"
      :max="max ?? undefined"
      :step="integer ? 1 : 'any'"
      :placeholder="placeholder"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="[describedby, error ? errorId : ''].filter(Boolean).join(' ') || undefined"
      autocomplete="off"
      @input="onInput"
      @blur="onBlur"
    >
    <p v-if="error" :id="errorId" class="nf-err" role="alert">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, useId, watch } from 'vue'
import { numberProblem } from '../wfNodeModalModel'

const props = defineProps({
  modelValue: { type: [Number, String], default: null },
  id: { type: String, required: true },
  label: { type: String, required: true },
  min: { type: Number, default: null },
  max: { type: Number, default: null },
  // A value must be greater than `min`, not equal to it (a timeout of 0 is refused by the engine).
  minExclusive: { type: Boolean, default: false },
  integer: { type: Boolean, default: false },
  optional: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  describedby: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const errorId = `nf-err-${useId()}`

const show = (v) => (v === null || v === undefined ? '' : String(v))
const draft = ref(show(props.modelValue))
const error = ref('')
// An outside change (undo, another node) replaces the draft; the person's own valid entry is already the value.
watch(() => props.modelValue, (v) => { draft.value = show(v); error.value = '' })

function onInput(e) {
  // A number input reports '' for text it cannot read ("1e", "-"): badInput tells that apart from an empty box.
  const raw = e.target.validity?.badInput ? NaN : e.target.value
  draft.value = e.target.value
  const problem = numberProblem(raw === '' ? '' : raw, props)
  error.value = problem || ''
  if (problem) return
  const next = raw === '' ? null : Number(raw)
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function onBlur() { if (!error.value) draft.value = show(props.modelValue) }
</script>

<style scoped>
.nf { min-width: 0; }
.nf-in {
  width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; font-variant-numeric: tabular-nums;
}
.nf-in:hover { border-color: var(--vm-ink-faint); }
.nf-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.nf-in[aria-invalid='true'] { border-color: var(--vm-red-ink); }
.nf-err { margin: 4px 0 0; font-size: 12px; color: var(--vm-red-ink); }
@media (pointer: coarse) { .nf-in { min-height: 44px; } }
</style>
