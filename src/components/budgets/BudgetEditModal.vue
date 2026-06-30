<template>
  <Teleport to="body">
    <div class="bm-overlay" @click.self="$emit('close')">
      <div class="bm-modal" role="dialog" aria-modal="true">
        <header class="bm-head">
          <h3>{{ form.id ? 'Edit budget' : 'New budget' }}</h3>
          <button class="bm-x" @click="$emit('close')"><Icon icon="lucide:x" /></button>
        </header>

        <div class="bm-body">
          <label class="bm-field">
            <span>Scope</span>
            <select v-model="form.scope_type" :disabled="!!form.id" @change="onScopeChange">
              <option value="org">Organization</option>
              <option value="workspace">Workspace</option>
              <option value="agent">Agent</option>
              <option value="workflow">Workflow</option>
              <option value="schedule">Schedule</option>
            </select>
          </label>

          <p v-if="form.scope_type === 'org'" class="bm-hint">
            Applies to the whole organization<template v-if="orgName"> ({{ orgName }})</template>.
          </p>

          <label class="bm-field" v-else>
            <span>{{ scopeLabel }}</span>
            <select v-model="form.scope_id" :disabled="!!form.id || loadingTargets" @change="onTargetChange">
              <option :value="null" disabled>
                {{ loadingTargets ? 'Loading…' : `Select ${scopeLabel.toLowerCase()}…` }}
              </option>
              <option v-for="t in targets" :key="t.id" :value="t.id">{{ t.label }}</option>
            </select>
            <small v-if="!loadingTargets && !targets.length" class="bm-warn">
              No {{ scopeLabel.toLowerCase() }}s found to budget for.
            </small>
          </label>

          <label class="bm-field">
            <span>Name</span>
            <input v-model="form.name" type="text" placeholder="e.g. Default Workspace" />
          </label>

          <p v-if="form.scope_type !== 'org' && (parentCaps.monthly != null || parentCaps.daily != null)" class="bm-hint">
            Organization caps —
            <template v-if="parentCaps.monthly != null">monthly ${{ Number(parentCaps.monthly).toFixed(2) }}</template>
            <template v-if="parentCaps.monthly != null && parentCaps.daily != null">, </template>
            <template v-if="parentCaps.daily != null">daily ${{ Number(parentCaps.daily).toFixed(2) }}</template>.
            This budget cannot exceed them.
          </p>

          <div class="bm-row">
            <label class="bm-field">
              <span>Monthly limit (USD)</span>
              <input v-model="form.monthly_limit_usd" type="number" step="0.01" min="0" placeholder="No cap"
                     :class="{ 'bm-invalid': limitErrors.monthly }" />
              <small v-if="limitErrors.monthly" class="bm-warn">{{ limitErrors.monthly }}</small>
            </label>
            <label class="bm-field">
              <span>Daily limit (USD)</span>
              <input v-model="form.daily_limit_usd" type="number" step="0.01" min="0" placeholder="No cap"
                     :class="{ 'bm-invalid': limitErrors.daily }" />
              <small v-if="limitErrors.daily" class="bm-warn">{{ limitErrors.daily }}</small>
            </label>
          </div>

          <div class="bm-row">
            <label class="bm-field">
              <span>Per-run max (USD)</span>
              <input v-model="form.per_run_max_usd" type="number" step="0.01" min="0" placeholder="No cap" />
            </label>
            <label class="bm-field">
              <span>Per-turn max (USD)</span>
              <input v-model="form.per_turn_max_usd" type="number" step="0.0001" min="0" placeholder="No cap" />
            </label>
          </div>

          <label class="bm-field">
            <span>Approval threshold (USD)</span>
            <input v-model="form.approval_threshold_usd" type="number" step="0.01" min="0" placeholder="No approval gate" />
          </label>

          <label class="bm-field">
            <span>Alert thresholds (comma %, e.g. 50, 80, 100)</span>
            <input v-model="alertText" type="text" placeholder="50, 80, 100" />
          </label>
        </div>

        <footer class="bm-foot">
          <button class="bm-ghost" @click="$emit('close')">Cancel</button>
          <button class="bm-primary" :disabled="saving || hasLimitErrors || (form.scope_type !== 'org' && !form.scope_id)" @click="submit">
            {{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create budget') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'

const props = defineProps({
  budget: { type: Object, default: null },
  saving: { type: Boolean, default: false },
  orgName: { type: String, default: '' },
  orgId: { type: [Number, String], default: null },
  // Parent (organization) USD ceilings, so a child budget can't be saved above its parent. The backend
  // re-validates against the full ancestor chain; this is the pre-submit guard + visible context.
  parentCaps: { type: Object, default: () => ({ monthly: null, daily: null }) },
})
const emit = defineEmits(['close', 'save'])

const b = props.budget || {}
const form = reactive({
  id: b.id || null,
  scope_type: b.scope_type || 'org',
  scope_id: b.scope_id ?? null,
  name: b.name || '',
  monthly_limit_usd: b.monthly_limit_usd ?? '',
  daily_limit_usd: b.daily_limit_usd ?? '',
  per_run_max_usd: b.per_run_max_usd ?? '',
  per_turn_max_usd: b.per_turn_max_usd ?? '',
  approval_threshold_usd: b.approval_threshold_usd ?? '',
})
const alertText = ref(Array.isArray(b.alert_thresholds)
  ? b.alert_thresholds.map((x) => Math.round(x * 100)).join(', ') : '')

// ── Scope target options (populated from the backend per selected scope) ──
const SCOPE_LABEL = { workspace: 'Workspace', agent: 'Agent', workflow: 'Workflow', schedule: 'Schedule' }
const scopeLabel = computed(() => SCOPE_LABEL[form.scope_type] || 'Target')
const targets = ref([])
const loadingTargets = ref(false)

async function loadTargets(scope) {
  // Targets come from ONE org-scoped, membership-validated endpoint so the dropdown only ever lists
  // agents/workspaces/workflows/schedules that belong to the selected organization.
  targets.value = []
  if (!scope || scope === 'org') return
  loadingTargets.value = true
  try {
    const { data } = await api.getBudgetTargets(props.orgId, scope)
    targets.value = Array.isArray(data?.targets) ? data.targets : []
  } catch {
    targets.value = []
  } finally {
    loadingTargets.value = false
  }
}

function onScopeChange() {
  form.scope_id = null
  // Only auto-clear an auto-filled name (leave a user-typed name alone is hard to detect; clear on scope switch).
  if (form.scope_type === 'org') { targets.value = []; return }
  loadTargets(form.scope_type)
}

function onTargetChange() {
  // Default the budget name to the selected target's label if the user hasn't named it.
  const sel = targets.value.find((t) => String(t.id) === String(form.scope_id))
  if (sel && !form.name) form.name = sel.label
}

onMounted(() => { if (form.scope_type !== 'org') loadTargets(form.scope_type) })

function num(v) { return v === '' || v === null || v === undefined ? null : Number(v) }

// Client-side hierarchy validation (mirrors the backend): daily ≤ monthly, and for child scopes
// monthly/daily ≤ the organization parent caps. Shown inline + blocks submit.
const limitErrors = computed(() => {
  const e = {}
  const m = num(form.monthly_limit_usd), d = num(form.daily_limit_usd)
  if (m != null && d != null && d > m) e.daily = `Daily cannot exceed this budget's monthly ($${m.toFixed(2)}).`
  if (form.scope_type !== 'org') {
    const pm = props.parentCaps?.monthly, pd = props.parentCaps?.daily
    if (m != null && pm != null && m > pm) e.monthly = `Cannot exceed the organization monthly budget of $${Number(pm).toFixed(2)}.`
    if (d != null && pd != null && d > pd) e.daily = `Cannot exceed the organization daily budget of $${Number(pd).toFixed(2)}.`
  }
  return e
})
const hasLimitErrors = computed(() => Object.keys(limitErrors.value).length > 0)

function submit() {
  const thresholds = alertText.value
    .split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n))
    .map((pct) => Math.round((pct / 100) * 100) / 100)
  const payload = {
    id: form.id,
    scope_type: form.scope_type,
    scope_id: form.scope_type === 'org' ? null : (form.scope_id ?? null),
    name: form.name,
    monthly_limit_usd: num(form.monthly_limit_usd),
    daily_limit_usd: num(form.daily_limit_usd),
    per_run_max_usd: num(form.per_run_max_usd),
    per_turn_max_usd: num(form.per_turn_max_usd),
    approval_threshold_usd: num(form.approval_threshold_usd),
    alert_thresholds: thresholds,
    enabled: true,
  }
  emit('save', payload)
}
</script>

<style scoped>
.bm-overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center;
  background: rgba(15, 23, 42, .45); padding: 24px; }
.bm-modal { width: 100%; max-width: 520px; background: #fff; border-radius: 14px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, .25); display: flex; flex-direction: column; max-height: 90vh; }
.bm-head { display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; border-bottom: 1px solid #eef2f7; }
.bm-head h3 { margin: 0; font-size: 16px; font-weight: 850; color: #0f172a; }
.bm-x { border: 0; background: transparent; cursor: pointer; color: #64748b; display: grid; place-items: center; }
.bm-x svg { width: 18px; height: 18px; }
.bm-body { padding: 18px 20px; overflow-y: auto; display: grid; gap: 14px; }
.bm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.bm-field { display: grid; gap: 6px; }
.bm-field span { font-size: 11px; font-weight: 800; color: #475569; }
.bm-hint { margin: -4px 0 0; color: #64748b; font-size: 12px; font-weight: 650; }
.bm-warn { color: #b45309; font-size: 11px; font-weight: 700; }
.bm-invalid { border-color: #ef4444 !important; outline-color: #fecaca !important; }
.bm-field input, .bm-field select { height: 38px; border: 1px solid #dbe4f0; border-radius: 9px;
  padding: 0 12px; font: inherit; font-size: 13px; color: #0f172a; background: #fff; }
.bm-field input:focus, .bm-field select:focus { outline: 2px solid #c7d2fe; border-color: #3156e9; }
.bm-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 20px; border-top: 1px solid #eef2f7; }
.bm-ghost, .bm-primary { height: 38px; border-radius: 9px; padding: 0 16px; font-size: 13px; font-weight: 800; cursor: pointer; }
.bm-ghost { border: 1px solid #dbe4f0; background: #fff; color: #334155; }
.bm-primary { border: 0; background: #3156e9; color: #fff; }
.bm-primary:disabled { opacity: .6; cursor: default; }
</style>
