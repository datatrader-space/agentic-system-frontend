<template>
  <div class="cpe">
    <p class="cpe-intro">
      Each context tier is set by just <strong>three knobs</strong>: the total token budget, the share for
      conversation history, and when history compacts. Retrieval, memory, and tool budgets are derived
      automatically from the remainder. Blank resets a value to the default shown beneath.
    </p>

    <div v-for="p in orderedProfiles" :key="p.key" class="cpe-card">
      <div class="cpe-card-head">
        <div>
          <strong>{{ p.label }}</strong>
          <span class="cpe-desc">{{ p.description }}</span>
        </div>
        <button type="button" class="cpe-reset" :disabled="disabled" @click="resetProfile(p.key)">
          Reset to defaults
        </button>
      </div>

      <div class="cpe-grid">
        <label v-for="f in FIELDS" :key="f.key" class="cpe-field">
          <span class="cpe-label">{{ f.label }}<span v-if="f.pct" class="cpe-unit"> %</span></span>
          <input
            type="number"
            class="cpe-input"
            :min="f.pct ? 1 : 1"
            :max="f.pct ? 100 : undefined"
            :step="f.pct ? 1 : 100"
            :disabled="disabled"
            :value="displayValue(p.key, f)"
            @input="onInput(p.key, f, $event)"
          />
          <span class="cpe-hint">default: {{ defaultLabel(p.key, f) }}</span>
          <span v-if="f.help" class="cpe-help">{{ f.help }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Platform Context Profiles editor (admin). Renders the effective per-profile budgets and emits the edited
 * set as `context_profiles` overrides for the GlobalAgentPolicy.llm_policy PATCH. The backend stores them
 * (validated) and merges over the code defaults at read time.
 */
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  profiles: { type: Object, default: () => ({}) },   // effective (defaults + current overrides)
  defaults: { type: Object, default: () => ({}) },   // code defaults, for the "default: N" hint
  display: { type: Array, default: () => [] },        // [{ key, label, description }] in display order
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update', 'change'])

// The three tier knobs. `pct` renders a fraction (0–1) as a percentage; otherwise a raw token count.
const FIELDS = [
  { key: 'total_input_tokens', label: 'Total input tokens', pct: false,
    help: 'Overall token budget for a turn (clamped to the model window).' },
  { key: 'history_pct', label: 'History', pct: true,
    help: 'Share of the budget for conversation history. The rest holds retrieval, memory, and tool context.' },
  { key: 'compaction_trigger_pct', label: 'Compaction trigger', pct: true,
    help: 'How full the history window gets before old turns compact into a summary.' },
]

// Local editable copy — re-synced whenever the loaded effective profiles change.
const model = reactive({})
function sync(src) {
  Object.keys(model).forEach((k) => delete model[k])
  Object.entries(src || {}).forEach(([k, v]) => { model[k] = { ...v } })
}
watch(() => props.profiles, (v) => sync(v), { immediate: true, deep: true })

const orderedProfiles = computed(() => {
  const known = new Set((props.display || []).map((d) => d.key))
  const rows = (props.display || []).map((d) => ({ key: d.key, label: d.label, description: d.description }))
  // include any profile present in the data but missing from display (forward-compat)
  Object.keys(props.profiles || {}).forEach((k) => {
    if (!known.has(k)) rows.push({ key: k, label: k, description: '' })
  })
  return rows
})

const fmt = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString())

function displayValue(pkey, f) {
  const v = model[pkey]?.[f.key]
  if (v === null || v === undefined || v === '') return ''
  return f.pct ? Math.round(Number(v) * 100) : Number(v)
}
function defaultLabel(pkey, f) {
  const v = props.defaults?.[pkey]?.[f.key]
  if (v === null || v === undefined) return '—'
  return f.pct ? `${Math.round(Number(v) * 100)}%` : fmt(v)
}

function onInput(pkey, f, e) {
  if (!model[pkey]) model[pkey] = {}
  const raw = e.target.value
  if (raw === '') {
    // blank → drop the override for this field (falls back to the default on the backend)
    delete model[pkey][f.key]
  } else {
    const num = Number(raw)
    if (Number.isNaN(num)) return
    model[pkey][f.key] = f.pct ? Math.min(1, Math.max(0.01, num / 100)) : Math.max(1, Math.round(num))
  }
  emitChange()
}
function resetProfile(pkey) {
  model[pkey] = { ...(props.defaults?.[pkey] || {}) }
  emitChange()
}
function emitChange() {
  // Emit the full edited set; the parent stores it as the context_profiles override on save.
  emit('update', JSON.parse(JSON.stringify(model)))
  emit('change')
}
</script>

<style scoped>
.cpe { display: flex; flex-direction: column; gap: 14px; }
.cpe-intro { margin: 0 0 2px; font-size: 13px; color: var(--text-muted, #667085); line-height: 1.5; }
.cpe-card { border: 1px solid var(--border, #e4e7ec); border-radius: 12px; padding: 14px 16px; background: var(--surface, #fff); }
.cpe-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.cpe-card-head strong { display: block; font-size: 14px; color: var(--text, #0f172a); }
.cpe-desc { display: block; font-size: 12px; color: var(--text-muted, #667085); margin-top: 2px; max-width: 62ch; }
.cpe-reset { flex: none; font-size: 12px; padding: 5px 10px; border: 1px solid var(--border, #e4e7ec);
  border-radius: 8px; background: transparent; color: var(--text-muted, #667085); cursor: pointer; }
.cpe-reset:hover:not(:disabled) { background: var(--surface-2, #f8fafc); color: var(--text, #0f172a); }
.cpe-reset:disabled { opacity: 0.5; cursor: default; }
.cpe-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px 14px; }
.cpe-field { display: flex; flex-direction: column; gap: 3px; }
.cpe-label { font-size: 12px; font-weight: 600; color: var(--text, #0f172a); }
.cpe-unit { color: var(--text-muted, #667085); font-weight: 400; }
.cpe-input { width: 100%; padding: 6px 8px; font-size: 13px; border: 1px solid var(--border, #e4e7ec);
  border-radius: 8px; background: var(--surface, #fff); color: var(--text, #0f172a); font-variant-numeric: tabular-nums; }
.cpe-input:focus { outline: 2px solid var(--accent, #6d28d9); outline-offset: -1px; }
.cpe-input:disabled { background: var(--surface-2, #f8fafc); opacity: 0.7; }
.cpe-hint { font-size: 11px; color: var(--text-muted, #98a2b3); font-variant-numeric: tabular-nums; }
.cpe-help { font-size: 11px; color: var(--text-muted, #667085); line-height: 1.35; margin-top: 2px; }
@media (prefers-color-scheme: dark) {
  .cpe-card { background: #0f1729; border-color: #1f2a44; }
  .cpe-input { background: #0b1220; border-color: #1f2a44; color: #e5e7eb; }
  .cpe-input:disabled { background: #0f1729; }
}
</style>
