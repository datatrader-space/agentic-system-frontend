<script setup>
/**
 * P7 — Platform LLM Policy (admin-dashboard only).
 * Edits GlobalAgentPolicy.llm_policy: platform ceilings the resolver enforces. Agent/org/profile can TIGHTEN
 * below these; the code ABSOLUTE_* emergency guards are NOT editable here (shown as read-only max hints).
 */
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },   // llm_policy dict
  absolute: { type: Object, default: () => ({}) },      // { key: ABSOLUTE_max } read-only hints
  errors: { type: Object, default: () => ({}) },        // { key: 'message' } from the API
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'change'])

const NUM_FIELDS = [
  { key: 'max_input_tokens', label: 'Max input tokens', hint: 'Ceiling on prompt tokens per turn.' },
  { key: 'max_tool_iterations', label: 'Max tool iterations', hint: 'Ceiling on tool-call rounds per turn.' },
  { key: 'max_tool_result_tokens', label: 'Max tool result tokens', hint: 'Per tool-result cap.' },
  { key: 'max_total_tool_context_tokens', label: 'Total tool context tokens', hint: 'All tool context per turn.' },
  { key: 'max_images_per_turn', label: 'Max images per turn', hint: 'Reject beyond this many images.' },
  { key: 'max_image_bytes', label: 'Max image size (bytes)', hint: 'Downscale/reject larger images.' },
  { key: 'max_image_width', label: 'Max image width (px)', hint: '' },
  { key: 'max_image_height', label: 'Max image height (px)', hint: '' },
]

function setNum(key, e) {
  const raw = e.target.value
  const next = { ...props.modelValue }
  if (raw === '' || raw === null) delete next[key]           // blank = unset -> falls back to ABSOLUTE
  else next[key] = Math.trunc(Number(raw))
  emit('update:modelValue', next)
  emit('change')
}
function setBool(key, e) {
  emit('update:modelValue', { ...props.modelValue, [key]: !!e.target.checked })
  emit('change')
}
const downscale = computed(() => props.modelValue.image_downscale_enabled !== false)
const fmt = (n) => (n === null || n === undefined ? '' : Number(n).toLocaleString())
</script>

<template>
  <div class="plp">
    <p class="plp-note">
      These are <strong>platform ceilings</strong>. Agent, org, and profile settings can tighten below these,
      but cannot exceed them. Absolute emergency limits are still enforced in code and are shown as the
      read-only maximum next to each field. Leave a field blank to use the absolute default.
    </p>

    <div class="plp-grid">
      <label v-for="f in NUM_FIELDS" :key="f.key" class="plp-field" :data-test="`plp-${f.key}`">
        <span class="plp-lbl">{{ f.label }}</span>
        <input type="number" min="1" :step="1" :disabled="disabled"
               :value="modelValue[f.key] ?? ''" @input="setNum(f.key, $event)"
               :placeholder="`absolute default`" />
        <small class="plp-hint">
          <span v-if="absolute[f.key]">max {{ fmt(absolute[f.key]) }}</span>
          <span v-if="f.hint"> · {{ f.hint }}</span>
        </small>
        <small v-if="errors[f.key]" class="plp-err" :data-test="`err-${f.key}`">{{ errors[f.key] }}</small>
      </label>

      <label class="plp-field plp-toggle" data-test="plp-image_downscale_enabled">
        <span class="plp-lbl">Downscale oversized images</span>
        <input type="checkbox" :checked="downscale" :disabled="disabled"
               @change="setBool('image_downscale_enabled', $event)" />
        <small class="plp-hint">On = shrink to fit before sending. Off = reject oversized images.</small>
      </label>
    </div>
  </div>
</template>

<style scoped>
.plp { display: flex; flex-direction: column; gap: 14px; }
.plp-note { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-muted, #64748b); }
.plp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.plp-field { display: flex; flex-direction: column; gap: 4px; }
.plp-lbl { font-size: 13px; font-weight: 600; }
.plp-field input[type="number"] { padding: 8px 10px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; font-size: 14px; }
.plp-field input:disabled { opacity: .6; }
.plp-hint { font-size: 11px; color: var(--text-muted, #94a3b8); }
.plp-err { font-size: 11px; color: #dc2626; font-weight: 600; }
.plp-toggle { flex-direction: row; align-items: center; gap: 10px; }
.plp-toggle .plp-lbl { flex: 1; }
@media (max-width: 640px) { .plp-grid { grid-template-columns: 1fr; } }
</style>
