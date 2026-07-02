<script setup>
/**
 * Compact context profile picker.
 * Writes agent_policy.context_profile, but keeps the guardrails card short so the
 * three top policy cards stay aligned.
 */
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  profiles: { type: Array, default: () => [] },
  preview: { type: Object, default: null },
  // Exact per-profile token-budget matrix from the backend (effective-policy → profiles_matrix), computed
  // against THIS agent's model context window. { model_context_window, hard_input_limit, rows:[{key,...}] }.
  matrix: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
  // Compact mode: dropdown + a small details card for the SELECTED profile only. No summary blurb, no
  // helper note, no "all profiles" comparison table/popover. Used in the Step 2 Memory & Context section.
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const FALLBACK = [
  { key: 'fast', label: 'Fast', short: 'Low-cost, short-answer mode.', description: 'For short, low-cost answers. Uses smaller history, retrieval, and tool context budgets.' },
  { key: 'balanced', label: 'Balanced', short: 'Default everyday assistant mode.', description: 'Default general-purpose mode. Good for normal assistants and everyday tasks.' },
  { key: 'deep_research', label: 'Deep Research', short: 'Large retrieval and history budgets.', description: 'For long documents, research, and multi-source reasoning. Allows larger history and retrieval context when budget permits.' },
  { key: 'code_repo', label: 'Code / Repo', short: 'Higher code, repo, and tool context.', description: 'For repository, implementation, debugging, and multi-step code tasks.' },
  { key: 'data_analysis', label: 'Data Analysis', short: 'Prioritizes files, logs, tables, and tool results.', description: 'For files, tables, logs, reports, and data-heavy tasks. Prioritizes tool/result context and artifacts.' },
]

const DETAIL_BY_KEY = {
  '': {
    label: 'Automatic',
    short: 'Uses the best default profile for the request type.',
    description: 'No explicit override is stored. Chat uses Balanced, code uses Code / Repo, and research can use a larger research profile when available.',
    rows: [
      ['Stored override', 'None'],
      ['Selection logic', 'Request-type default'],
      ['Best for', 'General use'],
    ],
  },
  balanced: {
    label: 'Balanced agent',
    short: 'Default profile for normal agents and everyday tasks.',
    description: 'A steady middle setting for conversation, retrieval, and tool context.',
    rows: [
      ['Model context', '1,000,000'],
      ['Hard input limit', '500,000'],
      ['Target input', '30K-60K'],
      ['History', 'Medium'],
      ['Vector', 'Medium'],
      ['Tool context', 'Medium'],
    ],
  },
  code_repo: {
    label: 'Code / Repo agent',
    short: 'Higher budgets for repositories, debugging, and implementation.',
    description: 'Allows more code, tool-result, and repository context when the model and cost limits permit.',
    rows: [
      ['Model context', '1,000,000'],
      ['Hard input limit', '500,000'],
      ['Target input', '100K+'],
      ['History', 'Higher'],
      ['Vector/code context', 'Higher'],
      ['Tool result context', 'Higher'],
    ],
  },
  fast: {
    label: 'Fast agent',
    short: 'Small context budget for quick, low-cost answers.',
    description: 'Keeps history, retrieval, and tool context tight for faster lightweight responses.',
    rows: [
      ['Model context', '1,000,000'],
      ['Hard input limit', '500,000'],
      ['Target input', '10K-20K'],
      ['History', 'Small'],
      ['Vector', 'Small'],
      ['Tool context', 'Small'],
    ],
  },
  deep_research: {
    label: 'Deep Research',
    short: 'Large retrieval and history budgets for research tasks.',
    description: 'Best for long documents, multi-source reasoning, and larger retrieval context when budget permits.',
    rows: [
      ['Model context', '1,000,000'],
      ['Hard input limit', '500,000'],
      ['Target input', 'Large'],
      ['History', 'Higher'],
      ['Vector', 'Higher'],
      ['Tool context', 'Higher'],
    ],
  },
  data_analysis: {
    label: 'Data Analysis',
    short: 'Prioritizes files, logs, tables, and tool results.',
    description: 'Best for data-heavy tasks where artifacts and tool output need more context.',
    rows: [
      ['Model context', '1,000,000'],
      ['Hard input limit', '500,000'],
      ['Target input', 'Medium-large'],
      ['History', 'Medium'],
      ['Vector', 'Medium'],
      ['Tool context', 'Higher'],
    ],
  },
}

const apiOptions = computed(() => {
  const seen = new Set()
  return (props.profiles || [])
    .filter((profile) => profile && profile.key && !seen.has(profile.key) && seen.add(profile.key))
    .map((profile) => ({
      key: profile.key,
      label: DETAIL_BY_KEY[profile.key]?.label || profile.label,
      short: DETAIL_BY_KEY[profile.key]?.short || profile.description || 'Custom context profile.',
      description: profile.description || DETAIL_BY_KEY[profile.key]?.description || '',
    }))
})
const profileOptions = computed(() => (apiOptions.value.length ? apiOptions.value : FALLBACK))
const options = computed(() => [
  { key: '', label: 'Automatic (Recommended)', short: DETAIL_BY_KEY[''].short, description: DETAIL_BY_KEY[''].description },
  ...profileOptions.value,
])

const selected = computed(() => props.modelValue || '')
const selectedOption = computed(() => options.value.find((opt) => opt.key === selected.value) || options.value[0])

const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString())

// Exact per-profile token budgets from the backend, keyed by profile key.
const matrixByKey = computed(() => {
  const m = {}
  for (const r of props.matrix?.rows || []) m[r.key] = r
  return m
})
const modelContext = computed(() => props.matrix?.model_context_window ?? null)
const hardInputLimit = computed(() => props.matrix?.hard_input_limit ?? null)

// Full comparison table (all profiles) with exact integers, scaled to this agent's model.
const COLUMNS = [
  { key: 'label', label: 'Profile' },
  { key: 'model_context', label: 'Model Context' },
  { key: 'hard_input', label: 'Hard Input Limit' },
  { key: 'target_input', label: 'Target Input' },
  { key: 'history', label: 'History' },
  { key: 'memory', label: 'Memory' },
  { key: 'vector', label: 'Vector/RAG' },
  { key: 'tool_result', label: 'Tool Result / Iteration' },
  { key: 'tool_total', label: 'Total Tool Context' },
]
const comparisonRows = computed(() =>
  (props.matrix?.rows || []).map((r) => ({
    key: r.key,
    label: r.label,
    model_context: fmt(modelContext.value),
    hard_input: fmt(hardInputLimit.value),
    target_input: fmt(r.target_input),
    history: fmt(r.history),
    memory: fmt(r.memory),
    vector: fmt(r.vector),
    tool_result: fmt(r.tool_result),
    tool_total: fmt(r.tool_total),
  })),
)

const selectedDetails = computed(() => {
  const base = DETAIL_BY_KEY[selected.value] || selectedOption.value
  // Exact rows for the selected profile, scaled to this agent's model. Automatic ('') has no single
  // profile row → keep its descriptive rows. Falls back to the (legacy) descriptive rows if no matrix.
  const mr = matrixByKey.value[selected.value]
  let rows = base.rows || []
  if (mr) {
    rows = [
      ['Model context', fmt(modelContext.value)],
      ['Hard input limit', fmt(hardInputLimit.value)],
      ['Target input', fmt(mr.target_input)],
      ['History', fmt(mr.history)],
      ['Memory', fmt(mr.memory)],
      ['Vector/RAG', fmt(mr.vector)],
      ['Tool result / iteration', fmt(mr.tool_result)],
      ['Total tool context', fmt(mr.tool_total)],
    ]
  }
  return {
    label: base.label || selectedOption.value.label,
    short: base.short || selectedOption.value.short,
    description: base.description || selectedOption.value.description,
    rows,
  }
})

const detailsOpen = ref(false)

function choose(event) {
  if (props.disabled) return
  emit('update:modelValue', event.target.value)
  detailsOpen.value = true
}

const previewRows = computed(() => {
  if (!props.preview) return []
  return [
    ['Effective profile', props.preview.profile || selectedDetails.value.label],
    ['Model context', fmt(props.preview.model_context_window)],
    ['Hard input limit', fmt(props.preview.hard_input_limit)],
    ['Target input', fmt(props.preview.target_input_tokens)],
  ]
})
</script>

<template>
  <div class="ctx-profile">
    <label class="ctx-select-row">
      <span>Profile selection</span>
      <select :value="selected" :disabled="disabled" @change="choose">
        <option v-for="opt in options" :key="opt.key || 'automatic'" :value="opt.key">
          {{ opt.label }}
        </option>
      </select>
    </label>

    <!-- Compact: a small card with the SELECTED profile's exact budgets only (no all-profiles table). -->
    <div v-if="compact" class="ctx-mini">
      <div class="ctx-mini-head">
        <strong>{{ selectedDetails.label }}</strong>
        <span v-if="selected === ''" class="ctx-recommended">Recommended</span>
      </div>
      <dl v-if="selectedDetails.rows.length" class="ctx-mini-grid">
        <div v-for="row in selectedDetails.rows" :key="row[0]">
          <dt>{{ row[0] }}</dt>
          <dd>{{ row[1] }}</dd>
        </div>
      </dl>
    </div>

    <template v-if="!compact">
      <div class="ctx-summary">
        <span class="ctx-summary-icon"><Icon icon="lucide:info" /></span>
        <span class="ctx-summary-copy">
          <strong>
            {{ selectedDetails.label }}
            <span v-if="selected === ''" class="ctx-recommended">Recommended</span>
          </strong>
          <small>{{ selectedDetails.short }}</small>
        </span>
      </div>

      <button type="button" class="ctx-details-btn" :disabled="disabled" @click="detailsOpen = true">
        View profile details
        <Icon icon="lucide:chevron-right" />
      </button>

      <p class="ctx-note">
        Controls context budget behavior for conversation, retrieval, and tool results. It does not force the model to use the full context window.
      </p>
    </template>

    <div v-if="!compact && detailsOpen" class="ctx-popover" role="dialog" aria-label="Context profile details">
      <header>
        <div>
          <strong>{{ selectedDetails.label }}</strong>
          <p>{{ selectedDetails.description }}</p>
        </div>
        <button type="button" @click="detailsOpen = false" aria-label="Close context details">
          <Icon icon="lucide:x" />
        </button>
      </header>

      <dl class="ctx-detail-grid">
        <div v-for="row in selectedDetails.rows" :key="row[0]">
          <dt>{{ row[0] }}</dt>
          <dd>{{ row[1] }}</dd>
        </div>
      </dl>

      <!-- Exact per-profile token budgets, scaled to this agent's model context window. No vague words. -->
      <section v-if="comparisonRows.length" class="ctx-matrix">
        <span class="ctx-matrix-title">All profiles — exact token budgets for this model</span>
        <div class="ctx-matrix-scroll">
          <table class="ctx-matrix-table">
            <thead>
              <tr>
                <th v-for="col in COLUMNS" :key="col.key" :class="{ num: col.key !== 'label' }">{{ col.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in comparisonRows" :key="row.key" :class="{ active: row.key === selected }">
                <td v-for="col in COLUMNS" :key="col.key" :class="{ num: col.key !== 'label', name: col.key === 'label' }">
                  {{ row[col.key] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="previewRows.length" class="ctx-live-preview">
        <span>Effective preview</span>
        <dl>
          <div v-for="row in previewRows" :key="row[0]">
            <dt>{{ row[0] }}</dt>
            <dd>{{ row[1] }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ctx-profile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ctx-select-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.ctx-select-row span {
  color: var(--text-primary, #0f172a);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
}

.ctx-select-row select {
  width: 100%;
  height: 42px;
  border: 1px solid var(--border, #d8e2f1);
  border-radius: 8px;
  background: var(--surface, #fff);
  color: var(--text-primary, #0f172a);
  font-size: 14px;
  font-weight: 600;
  padding: 0 12px;
  line-height: 42px;
}

.ctx-select-row select:focus {
  border-color: var(--primary, #2f63f6);
  box-shadow: 0 0 0 3px rgba(47, 99, 246, 0.12);
  outline: none;
}

.ctx-summary {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  border: 1px solid var(--border, #d8e2f1);
  border-radius: 10px;
  background: #f8fbff;
  padding: 12px 13px;
  text-align: left;
}

.ctx-summary-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: #eef4ff;
  color: #2f63f6;
  flex: 0 0 auto;
}

.ctx-summary-copy {
  min-width: 0;
  display: block;
}

.ctx-summary strong {
  display: block;
  color: var(--text-primary, #0f172a);
  font-size: 14px;
  line-height: 1.2;
  margin: 1px 0 4px;
}

/* Compact mode — small card with the selected profile's exact budgets only */
.ctx-mini {
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 10px;
  background: #f8fbff;
  padding: 12px 13px;
}

.ctx-mini-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.ctx-mini-head strong {
  color: #0f172a;
  font-size: 13.5px;
  font-weight: 700;
}

.ctx-mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px 12px;
}

.ctx-mini-grid div { min-width: 0; }

.ctx-mini-grid dt {
  color: #6b7c99;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.ctx-mini-grid dd {
  margin: 2px 0 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ctx-recommended {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: #e6f7ee;
  color: #047a48;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  vertical-align: middle;
}

.ctx-summary small {
  display: block;
  color: var(--text-muted, #5d6f8f);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
}

.ctx-details-btn {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  width: fit-content;
  border: 0;
  background: transparent;
  color: #2459e8;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}

.ctx-details-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.ctx-details-btn svg {
  width: 15px;
  height: 15px;
}

.ctx-note {
  margin: 0;
  color: var(--text-muted, #5d6f8f);
  font-size: 12px;
  line-height: 1.45;
}

.ctx-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + 10px);
  left: 0;
  right: auto;
  width: min(960px, 92vw);
  max-width: 92vw;
  border: 1px solid #cfe0fb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.16);
  padding: 14px;
}

.ctx-popover header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e7edf7;
}

.ctx-popover header strong {
  color: #0f172a;
  font-size: 15px;
}

.ctx-popover header p {
  margin: 4px 0 0;
  color: #5d6f8f;
  font-size: 12px;
  line-height: 1.45;
}

.ctx-popover header button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid #d8e2f1;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
}

.ctx-detail-grid,
.ctx-live-preview dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
  margin: 12px 0 0;
}

.ctx-detail-grid div,
.ctx-live-preview dl div {
  min-width: 0;
}

.ctx-detail-grid dt,
.ctx-live-preview dt {
  color: #6b7c99;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.ctx-detail-grid dd,
.ctx-live-preview dd {
  margin: 3px 0 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

/* Exact per-profile token-budget comparison table */
.ctx-matrix {
  margin-top: 14px;
  border-top: 1px solid #e7edf7;
  padding-top: 12px;
}

.ctx-matrix-title {
  display: block;
  color: #2f63f6;
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 8px;
}

.ctx-matrix-scroll {
  overflow-x: auto;
  border: 1px solid #e7edf7;
  border-radius: 10px;
}

.ctx-matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  white-space: nowrap;
}

.ctx-matrix-table th,
.ctx-matrix-table td {
  padding: 7px 12px;
  text-align: left;
  border-bottom: 1px solid #eef2f9;
}

.ctx-matrix-table thead th {
  position: sticky;
  top: 0;
  background: #f8fbff;
  color: #6b7c99;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.ctx-matrix-table th.num,
.ctx-matrix-table td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.ctx-matrix-table td {
  color: #334155;
  font-weight: 600;
}

.ctx-matrix-table td.name {
  color: #0f172a;
  font-weight: 700;
}

.ctx-matrix-table tbody tr:last-child td {
  border-bottom: none;
}

.ctx-matrix-table tbody tr.active td {
  background: #eef4ff;
  color: #1d4ed8;
}

.ctx-matrix-table tbody tr.active td.name {
  color: #1d4ed8;
}

.ctx-live-preview {
  margin-top: 12px;
  border-top: 1px solid #e7edf7;
  padding-top: 12px;
}

.ctx-live-preview > span {
  color: #2f63f6;
  font-size: 12px;
  font-weight: 800;
}

@media (max-width: 720px) {
  .ctx-popover {
    position: static;
  }
}
</style>
