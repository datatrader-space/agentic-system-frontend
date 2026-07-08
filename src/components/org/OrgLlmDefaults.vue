<script setup>
/**
 * P8 — Org / Workspace LLM Defaults (org-guardrails page).
 * Edits OrgAgentPolicy.llm_policy: the org-level default context profile + LLM ceilings the resolver
 * applies to every agent in the org. Org values may only TIGHTEN below the platform ceilings (P7) — the
 * API rejects anything larger, and the resolver defensively clamps to platform at runtime. Absolute
 * code guards (ABSOLUTE_*) are never editable here; they are shown as the read-only maximum.
 *
 * Precedence surfaced by the effective preview: agent profile > org default > request-type fallback,
 * and for ceilings: min(ABSOLUTE, platform, org).
 */
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },   // org llm_policy dict
  platform: { type: Object, default: () => ({}) },      // platform_llm_policy (read-only ceiling hints)
  absolute: { type: Object, default: () => ({}) },      // ABSOLUTE_* code guards (read-only hints)
  preview: { type: Object, default: null },             // resolved effective policy + sources
  errors: { type: Object, default: () => ({}) },        // { key: 'message' } from the API
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'change'])

const PROFILES = [
  { key: 'fast', label: 'Fast' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'deep_research', label: 'Deep Research' },
  { key: 'code_repo', label: 'Code / Repo' },
  { key: 'data_analysis', label: 'Data Analysis' },
]

// ABSOLUTE_* code guards (agent/services/llm_policy.py: PLATFORM_LLM_INT_KEYS). These are compile-time
// constants that never change at runtime, so we keep a local copy as a guaranteed fallback: the max cap
// always renders even if the API `absolute` prop hasn't loaded yet.
const ABSOLUTE_DEFAULTS = {
  max_input_tokens: 500000,
  max_tool_iterations: 500,
  max_images_per_turn: 20,
  max_image_bytes: 20971520,
  max_image_width: 8192,
  max_image_height: 8192,
}

// Tool-output size is governed by artifactization (LLM_ARTIFACTIZE_LONG_OUTPUTS); the per-result / total
// tool-token caps were removed as policy fields.
const NUM_FIELDS = [
  { key: 'max_input_tokens', label: 'Max input tokens', hint: 'Ceiling on prompt tokens per turn.' },
  { key: 'max_tool_iterations', label: 'Max steps per run', hint: 'Ceiling on tool-call rounds ("steps") per run.' },
  { key: 'max_images_per_turn', label: 'Max images per turn', hint: 'Reject beyond this many images.' },
  { key: 'max_image_bytes', label: 'Max image size (bytes)', hint: 'Downscale/reject larger images.' },
  { key: 'max_image_width', label: 'Max image width (px)', hint: '' },
  { key: 'max_image_height', label: 'Max image height (px)', hint: '' },
]

// The absolute cap for a key: the API-supplied value, else the baked-in code constant (always present).
function absFor(key) {
  const a = props.absolute?.[key]
  return a === null || a === undefined ? ABSOLUTE_DEFAULTS[key] : Number(a)
}
// The effective ceiling an org can't exceed = min(platform, absolute). Shown as the max hint + input max.
function ceiling(key) {
  const vals = [props.platform?.[key], absFor(key)]
    .map((n) => (n === null || n === undefined ? Infinity : Number(n)))
  const m = Math.min(...vals)
  return Number.isFinite(m) ? m : null
}
// The concrete cap shown to the admin: the platform ceiling if set, otherwise the absolute code default.
// Either way the org value may not exceed it — surfaced so the admin never enters more than allowed.
function capSource(key) {
  if (props.platform?.[key] !== null && props.platform?.[key] !== undefined) return { n: Number(props.platform[key]), from: 'platform' }
  const a = absFor(key)
  if (a !== null && a !== undefined) return { n: Number(a), from: 'absolute' }
  return { n: null, from: null }
}
function placeholderFor(key) {
  const c = capSource(key)
  if (c.n === null) return 'no limit'
  return c.from === 'platform' ? `platform: ${fmt(c.n)}` : `absolute default: ${fmt(c.n)}`
}

// Per-key notice shown when the admin's typed value was clamped down to the cap.
const capped = ref({})
const profile = computed(() => props.modelValue.default_context_profile || '')

function setProfile(e) {
  const next = { ...props.modelValue }
  const v = e.target.value
  if (!v) delete next.default_context_profile          // blank = no org default -> request-type fallback
  else next.default_context_profile = v
  emit('update:modelValue', next)
  emit('change')
}
function setNum(key, e) {
  const raw = e.target.value
  const next = { ...props.modelValue }
  if (raw === '' || raw === null) {
    delete next[key]                                    // blank = inherit platform ceiling
    capped.value = { ...capped.value, [key]: false }
  } else {
    let v = Math.trunc(Number(raw))
    const cap = ceiling(key)                            // min(platform, absolute) — the org may not exceed it
    if (cap !== null && v > cap) {                      // proactively clamp so the admin can't enter more
      v = cap
      e.target.value = String(cap)
      capped.value = { ...capped.value, [key]: true }
    } else {
      capped.value = { ...capped.value, [key]: false }
    }
    next[key] = v
  }
  emit('update:modelValue', next)
  emit('change')
}
function setBool(key, e) {
  emit('update:modelValue', { ...props.modelValue, [key]: !!e.target.checked })
  emit('change')
}
const downscale = computed(() => props.modelValue.image_downscale_enabled !== false)
const fmt = (n) => (n === null || n === undefined ? '' : Number(n).toLocaleString())

// Preview rows: label + platform ceiling + org value + final resolved + binding source.
const PREVIEW_ROWS = [
  { key: 'hard_input_limit', label: 'Input tokens', pol: 'max_input_tokens' },
  { key: 'max_tool_iterations', label: 'Max steps per run', pol: 'max_tool_iterations' },
  // "Total tool context" is now profile-only (no admin cap) — shown for reference, no policy mapping.
  { key: 'total_tool_context_budget', label: 'Total tool context (profile)', pol: null },
]
const previewProfile = computed(() => props.preview?.profile || '—')
const previewProfileSrc = computed(() => props.preview?.profile_source || '—')
function finalVal(row) { return props.preview?.[row.key] }
function finalSrc(row) { return props.preview?.sources?.[row.key] || '—' }
</script>

<template>
  <div class="old">
    <p class="old-note">
      These are your <strong>organization defaults</strong>. They apply to every agent in the org, but can only
      make the <strong>platform ceilings stricter</strong> — never larger. A value above the platform limit is
      rejected. Each agent can then tighten further. Leave a field blank to inherit the platform ceiling.
    </p>

    <!-- Default context profile -->
    <label class="old-profile" data-test="old-default_context_profile">
      <span class="old-lbl">Default context profile</span>
      <select :value="profile" :disabled="disabled" @change="setProfile">
        <option value="">Auto — no org default (each request picks by type)</option>
        <option v-for="p in PROFILES" :key="p.key" :value="p.key">{{ p.label }}</option>
      </select>
      <small class="old-hint">
        Used when an agent has no explicit profile of its own. An agent's own profile always wins;
        with <strong>Auto</strong>, each turn falls back to the request-type default.
      </small>
      <small v-if="errors.default_context_profile" class="old-err" data-test="err-default_context_profile">
        {{ errors.default_context_profile }}
      </small>
    </label>

    <!-- Numeric ceilings -->
    <div class="old-grid">
      <label v-for="f in NUM_FIELDS" :key="f.key" class="old-field" :data-test="`old-${f.key}`">
        <span class="old-lbl">{{ f.label }}</span>
        <input type="number" min="1" :step="1" :max="ceiling(f.key) || undefined" :disabled="disabled"
               :value="modelValue[f.key] ?? ''" @input="setNum(f.key, $event)"
               :placeholder="placeholderFor(f.key)" />
        <small class="old-hint">
          <span v-if="ceiling(f.key)">max {{ fmt(ceiling(f.key)) }}
            <em class="old-cap-from">({{ capSource(f.key).from === 'platform' ? 'platform ceiling' : 'absolute default' }})</em>
          </span>
          <span v-if="f.hint"> · {{ f.hint }}</span>
        </small>
        <small v-if="capped[f.key]" class="old-capnote" :data-test="`capped-${f.key}`">
          Capped at the {{ capSource(f.key).from === 'platform' ? 'platform limit' : 'absolute limit' }} ({{ fmt(ceiling(f.key)) }}).
        </small>
        <small v-if="errors[f.key]" class="old-err" :data-test="`err-${f.key}`">{{ errors[f.key] }}</small>
      </label>

      <label class="old-field old-toggle" data-test="old-image_downscale_enabled">
        <span class="old-lbl">Downscale oversized images</span>
        <input type="checkbox" :checked="downscale" :disabled="disabled"
               @change="setBool('image_downscale_enabled', $event)" />
        <small class="old-hint">On = shrink to fit before sending. Off = reject oversized images.</small>
      </label>
    </div>

    <!-- Effective preview -->
    <div v-if="preview" class="old-preview" data-test="old-preview">
      <h3>Effective for org agents</h3>
      <div class="old-prow" data-test="preview-profile">
        <span class="old-pk">Context profile</span>
        <span class="old-pv">{{ previewProfile }}</span>
        <span class="old-src" :data-src="previewProfileSrc">{{ previewProfileSrc }}</span>
      </div>
      <div v-for="row in PREVIEW_ROWS" :key="row.key" class="old-prow" :data-test="`preview-${row.key}`">
        <span class="old-pk">{{ row.label }}</span>
        <span class="old-pv">
          <em>platform</em> {{ fmt(platform[row.pol]) || '—' }} ·
          <em>org</em> {{ fmt(modelValue[row.pol]) || '—' }} →
          <strong>{{ fmt(finalVal(row)) }}</strong>
        </span>
        <span class="old-src" :data-src="finalSrc(row)">{{ finalSrc(row) }}</span>
      </div>
      <p class="old-phint">
        <strong>Source</strong> shows which layer bound each value: <code>org_policy</code> (your override),
        <code>platform_policy</code> (platform ceiling), or <code>model_metadata</code> (the model's own window).
      </p>
    </div>
  </div>
</template>

<style scoped>
.old { display: flex; flex-direction: column; gap: 16px; }
.old-note { margin: 0; font-size: 13px; line-height: 1.5; color: #64748b; }
.old-profile { display: flex; flex-direction: column; gap: 5px; max-width: 460px; }
.old-profile select { height: 36px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: 13px; background: #fff; }
.old-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.old-field { display: flex; flex-direction: column; gap: 4px; }
.old-lbl { font-size: 13px; font-weight: 600; }
.old-field input[type="number"] { padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; }
.old-field input:disabled, .old-profile select:disabled { opacity: .6; }
.old-hint { font-size: 11px; color: #94a3b8; }
.old-cap-from { font-style: normal; color: #cbd5e1; }
.old-capnote { font-size: 11px; color: #b45309; font-weight: 600; }
.old-err { font-size: 11px; color: #dc2626; font-weight: 600; }
.old-toggle { flex-direction: row; align-items: center; gap: 10px; }
.old-toggle .old-lbl { flex: 1; }
.old-preview { border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.old-preview h3 { margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #334155; }
.old-prow { display: flex; align-items: center; gap: 10px; font-size: 12.5px; }
.old-pk { width: 130px; font-weight: 650; color: #475569; }
.old-pv { flex: 1; color: #334155; }
.old-pv em { font-style: normal; color: #94a3b8; font-size: 11px; }
.old-src { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #e2e8f0; color: #475569; }
.old-src[data-src="org_policy"] { background: #ecfdf3; color: #067647; }
.old-src[data-src="platform_policy"], .old-src[data-src="platform_absolute"] { background: #eff6ff; color: #1d4ed8; }
.old-src[data-src="model_metadata"] { background: #fef3e2; color: #b45309; }
.old-phint { margin: 4px 0 0; font-size: 11px; line-height: 1.5; color: #94a3b8; }
.old-phint code { background: #eef2f7; padding: 1px 5px; border-radius: 4px; font-size: 10.5px; }
@media (max-width: 640px) { .old-grid { grid-template-columns: 1fr; } }
</style>
