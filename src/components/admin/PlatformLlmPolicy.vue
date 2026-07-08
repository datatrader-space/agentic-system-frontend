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
  { key: 'max_input_tokens', label: 'Max input tokens', unit: 'tokens',
    desc: 'The largest prompt (all context combined) sent to the model in one turn. The model’s own context window still applies on top of this.' },
  { key: 'max_tool_iterations', label: 'Max steps per run', unit: 'steps',
    desc: 'How many actions / tool-call rounds ("steps") an agent may take in a single run. Org, workspace and agents can only tighten below this — they can never raise it.' },
  { key: 'max_images_per_turn', label: 'Max images per turn', unit: 'images',
    desc: 'How many images an agent accepts in one message. Images beyond this count are dropped.' },
  { key: 'max_image_bytes', label: 'Max image size', unit: 'bytes',
    desc: 'Max size of a SINGLE image sent to the model. Larger images are downscaled to fit. This is NOT the file-upload limit (that is a separate server setting).' },
  { key: 'max_image_width', label: 'Max image width', unit: 'px',
    desc: 'Max width, in pixels, of an image sent to the model. Wider images are downscaled to fit.' },
  { key: 'max_image_height', label: 'Max image height', unit: 'px',
    desc: 'Max height, in pixels, of an image sent to the model. Taller images are downscaled to fit.' },
]

function setNum(key, e) {
  const raw = e.target.value
  const next = { ...props.modelValue }
  // Model B: blank = unset -> the ABSOLUTE default applies. A set value is the ADMIN override and is NOT
  // clamped to the absolute (the platform admin is unbounded; only org/workspace/agent tighten below it).
  if (raw === '' || raw === null) delete next[key]
  else next[key] = Math.trunc(Number(raw))
  emit('update:modelValue', next)
  emit('change')
}
function setBool(key, e) {
  emit('update:modelValue', { ...props.modelValue, [key]: !!e.target.checked })
  emit('change')
}
const downscale = computed(() => props.modelValue.image_downscale_enabled !== false)
// Tool-output handling (DB-backed, default ON). Blank threshold = default 8000.
const artifactize = computed(() => props.modelValue.artifactize_long_outputs !== false)
const budgetSystem = computed(() => props.modelValue.tool_context_budget_enabled !== false)
function setThreshold(e) {
  const raw = e.target.value
  const next = { ...props.modelValue }
  if (raw === '' || raw === null) delete next.artifact_threshold_tokens
  else next.artifact_threshold_tokens = Math.trunc(Number(raw))
  emit('update:modelValue', next)
  emit('change')
}
const fmt = (n) => (n === null || n === undefined ? '' : Number(n).toLocaleString())
</script>

<template>
  <div class="plp">
    <p class="plp-note">
      These are the <strong>platform defaults</strong>. Leave a field <strong>blank</strong> to use the absolute
      default shown below it. A value you set here <strong>overrides</strong> that default and is not capped — org,
      workspace, and agent settings can only tighten <em>below</em> it.
    </p>

    <div class="plp-grid">
      <label v-for="f in NUM_FIELDS" :key="f.key" class="plp-field" :data-test="`plp-${f.key}`">
        <span class="plp-lbl">{{ f.label }} <span v-if="f.unit" class="plp-unit">({{ f.unit }})</span></span>
        <small class="plp-desc">{{ f.desc }}</small>
        <input type="number" min="1" :step="1" :disabled="disabled"
               :value="modelValue[f.key] ?? ''" @input="setNum(f.key, $event)"
               :placeholder="`absolute default`" />
        <small class="plp-hint">
          <span v-if="absolute[f.key]">Blank = default {{ fmt(absolute[f.key]) }}{{ f.unit ? ' ' + f.unit : '' }}</span>
        </small>
        <small v-if="errors[f.key]" class="plp-err" :data-test="`err-${f.key}`">{{ errors[f.key] }}</small>
      </label>

      <label class="plp-field plp-toggle" data-test="plp-image_downscale_enabled">
        <span class="plp-toggle-row">
          <span class="plp-lbl">Downscale oversized images</span>
          <input type="checkbox" :checked="downscale" :disabled="disabled"
                 @change="setBool('image_downscale_enabled', $event)" />
        </span>
        <small class="plp-desc">When ON, an image larger than the limits above is shrunk to fit before it is sent to the model. When OFF, an oversized image is rejected instead.</small>
      </label>
    </div>

    <h4 class="plp-subhead">Tool output handling</h4>
    <p class="plp-note">
      When an agent calls a tool, it always sees the <strong>full output on that turn</strong>. On <em>later</em>
      turns a large result is offloaded off-prompt (a short summary + a reload reference stays in context, and the
      agent can reload the full output on demand). These control that offloading.
    </p>
    <div class="plp-grid">
      <label class="plp-field plp-toggle" data-test="plp-artifactize_long_outputs">
        <span class="plp-toggle-row">
          <span class="plp-lbl">Offload long tool outputs</span>
          <input type="checkbox" :checked="artifactize" :disabled="disabled"
                 @change="setBool('artifactize_long_outputs', $event)" />
        </span>
        <small class="plp-desc">When ON, a tool output over the threshold below is stored off-prompt and replaced by a summary + reload reference on later turns. When OFF, nothing is offloaded (long outputs stay inline every turn — heavier context).</small>
      </label>

      <label class="plp-field" data-test="plp-artifact_threshold_tokens">
        <span class="plp-lbl">Offload threshold <span class="plp-unit">(tokens)</span></span>
        <small class="plp-desc">A single tool output larger than this (in tokens) is offloaded on later turns. Below it, the output rides inline. Default 8000.</small>
        <input type="number" min="1" :step="1" :disabled="disabled || !artifactize"
               :value="modelValue.artifact_threshold_tokens ?? ''" @input="setThreshold"
               placeholder="8000" />
        <small class="plp-hint"><span v-if="!(modelValue.artifact_threshold_tokens)">Blank = default 8,000 tokens</span></small>
        <small v-if="errors.artifact_threshold_tokens" class="plp-err">{{ errors.artifact_threshold_tokens }}</small>
      </label>

      <label class="plp-field plp-toggle" data-test="plp-tool_context_budget_enabled">
        <span class="plp-toggle-row">
          <span class="plp-lbl">Context-budget system</span>
          <input type="checkbox" :checked="budgetSystem" :disabled="disabled"
                 @change="setBool('tool_context_budget_enabled', $event)" />
        </span>
        <small class="plp-desc">Master switch for the model-aware context management (tool ledger, history trimming, conversation checkpoints, image de-duplication). Leave ON unless you have a specific reason — turning it off disables all of the above.</small>
      </label>
    </div>
  </div>
</template>

<style scoped>
.plp { display: flex; flex-direction: column; gap: 14px; }
.plp-note { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-muted, #64748b); }
.plp-subhead { margin: 6px 0 0; font-size: 14px; font-weight: 700; color: var(--text, #0f172a); }
.plp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.plp-field { display: flex; flex-direction: column; gap: 5px; padding: 12px; border: 1px solid var(--border, #eef2f7); border-radius: 10px; background: var(--surface, #fbfcfe); }
.plp-lbl { font-size: 13px; font-weight: 600; }
.plp-unit { font-weight: 400; color: var(--text-muted, #94a3b8); font-size: 11px; }
.plp-desc { font-size: 11.5px; line-height: 1.5; color: var(--text-muted, #64748b); }
.plp-field input[type="number"] { margin-top: 2px; padding: 8px 10px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; font-size: 14px; }
.plp-field input:disabled { opacity: .6; }
.plp-hint { font-size: 11px; color: var(--text-muted, #94a3b8); }
.plp-err { font-size: 11px; color: #dc2626; font-weight: 600; }
.plp-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
@media (max-width: 640px) { .plp-grid { grid-template-columns: 1fr; } }
</style>
