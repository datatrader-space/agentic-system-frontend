<template>
  <div class="ag">
    <header class="ag-hero">
      <div class="ag-hero-copy">
        <div class="ag-eyebrow">Platform policy</div>
        <h1>System Guardrails</h1>
        <p>
          Define the platform-wide safety floor inherited by every organization and agent.
          Lower tiers can only tighten these rules.
        </p>
        <div class="ag-meta">
          <span :class="['ag-status-pill', pol.enabled ? 'on' : 'off']">
            <span></span>{{ pol.enabled ? 'Enforced' : 'Disabled' }}
          </span>
          <span v-if="pol.updated_at">Updated {{ new Date(pol.updated_at).toLocaleString() }}</span>
          <span v-if="dirty" class="dirty">Unsaved changes</span>
        </div>
      </div>
      <div class="ag-hero-actions">
        <button
          class="ag-toggle"
          :class="pol.enabled ? 'on' : 'off'"
          :disabled="!canEdit || saving"
          @click="pol.enabled = !pol.enabled; mark()"
        >
          {{ pol.enabled ? 'Disable policy' : 'Enable policy' }}
        </button>
        <button class="ag-save" :disabled="!canEdit || saving || !dirty" @click="save">
          {{ saving ? 'Saving...' : 'Save policy' }}
        </button>
      </div>
    </header>

    <div v-if="!canEdit" class="ag-banner warn">
      <strong>Read-only access.</strong> Only a platform administrator can change the system policy.
    </div>
    <div v-else-if="!pol.enabled" class="ag-banner danger">
      <strong>Policy disabled.</strong> None of the rules below are enforced until this policy is enabled.
    </div>

    <div v-if="loading" class="ag-loading">
      <div v-for="n in 6" :key="n" class="ag-skeleton"></div>
    </div>

    <template v-else>
      <section class="ag-stats">
        <div class="ag-stat-card">
          <span class="ag-stat-icon blue">◇</span>
          <p>Approval ceiling</p>
          <strong>{{ riskLabel }}</strong>
        </div>
        <div class="ag-stat-card">
          <span class="ag-stat-icon green">↗</span>
          <p>External writes</p>
          <strong>{{ pol.allow_external_write ? 'Allowed' : 'Blocked' }}</strong>
        </div>
        <div class="ag-stat-card">
          <span class="ag-stat-icon violet">#</span>
          <p>Guardrails</p>
          <strong>{{ pol.guardrails.length }}</strong>
        </div>
        <div class="ag-stat-card">
          <span class="ag-stat-icon red">!</span>
          <p>Blocked tools</p>
          <strong>{{ pol.forbidden_tools.length }}</strong>
        </div>
      </section>

      <div class="ag-layout">
        <main class="ag-main">
          <section class="ag-card">
            <div class="ag-card-head">
              <div>
                <h2>Approval Floor</h2>
                <p>Baseline approval and external-write rules applied globally.</p>
              </div>
              <span class="ag-card-badge">Core</span>
            </div>
            <div class="ag-control-grid">
              <label class="ag-field">
                <span>Require approval for actions above</span>
                <select v-model="pol.risk_ceiling" :disabled="!canEdit" @change="mark">
                  <option value="">No ceiling</option>
                  <option value="low">Low impact</option>
                  <option value="medium">Medium impact</option>
                  <option value="high">High impact</option>
                  <option value="critical">Critical only</option>
                </select>
              </label>
              <label class="ag-field ag-switch-row">
                <span>
                  <b>Allow external writes</b>
                  <small>Disable to block outbound write actions by default.</small>
                </span>
                <button
                  :class="['ag-switch', { on: pol.allow_external_write }]"
                  type="button"
                  :disabled="!canEdit"
                  @click="pol.allow_external_write = !pol.allow_external_write; mark()"
                >
                  <i />
                </button>
              </label>
            </div>
          </section>

          <section class="ag-card">
            <div class="ag-card-head">
              <div>
                <h2>Answer Assurance</h2>
                <p>Verify every answer before it ships — final verifier, LLM grounding judge, and per-claim evidence ledger.</p>
              </div>
              <span class="ag-card-badge">Verification</span>
            </div>
            <div class="ag-control-grid">
              <label class="ag-field ag-switch-row">
                <span>
                  <b>Verify answers before sending</b>
                  <small>When OFF, the model's answer ships as-is (sanitize + citations only) — no grounding checks, judge, or repair. Turn off if the verifier is over-blocking.</small>
                </span>
                <button
                  :class="['ag-switch', { on: pol.final_assurance_enabled }]"
                  type="button"
                  :disabled="!canEdit"
                  @click="pol.final_assurance_enabled = !pol.final_assurance_enabled; mark()"
                >
                  <i />
                </button>
              </label>
            </div>
          </section>

          <section class="ag-card">
            <div class="ag-card-head">
              <div>
                <h2>Tool-Call Budget</h2>
                <p>Anti-runaway limits enforced on every agent turn.</p>
              </div>
              <span class="ag-card-badge">Limits</span>
            </div>
            <div class="ag-control-grid three">
              <label class="ag-field">
                <span>Soft budget</span>
                <input type="number" min="1" v-model.number="pol.tool_call_budget" :disabled="!canEdit" @input="mark" />
              </label>
              <label class="ag-field">
                <span>On exceeded</span>
                <select v-model="pol.on_budget_exceeded" :disabled="!canEdit" @change="mark">
                  <option value="ask_llm">Ask the LLM to decide</option>
                  <option value="ask_user">Ask the user</option>
                  <option value="force_conclude">Force conclude</option>
                  <option value="continue">Continue</option>
                </select>
              </label>
              <label class="ag-field">
                <span>Hard cap</span>
                <input type="number" min="1" v-model.number="pol.max_tool_calls_hard" :disabled="!canEdit" @input="mark" />
              </label>
            </div>
          </section>

          <section class="ag-card" data-test="platform-llm-policy">
            <div class="ag-card-head">
              <div>
                <h2>LLM Policy</h2>
                <p>Platform ceilings for token, tool, and image budgets — the resolver enforces these across all agents.</p>
              </div>
              <span class="ag-card-badge">Platform</span>
            </div>
            <PlatformLlmPolicy
              v-model="llmPolicy"
              :absolute="llmPolicyAbsolute"
              :errors="llmPolicyErrors"
              :disabled="!canEdit"
              @change="onLlmPolicyChange"
            />
          </section>

          <section class="ag-card" data-test="context-profiles">
            <div class="ag-card-head">
              <div>
                <h2>Context Profiles</h2>
                <p>Per-profile context budgets (history, retrieval, tool, memory). An agent picks one — the resolver splits its token budget accordingly.</p>
              </div>
              <span class="ag-card-badge">Platform</span>
            </div>
            <ContextProfilesEditor
              :profiles="contextProfiles"
              :defaults="contextProfileDefaults"
              :display="contextProfileDisplay"
              :disabled="!canEdit"
              @update="onContextProfilesUpdate"
              @change="onLlmPolicyChange"
            />
          </section>

          <section class="ag-card">
            <div class="ag-card-head">
              <div>
                <h2>Behavioral Guardrails</h2>
                <p>Non-negotiable rules injected into every agent system prompt.</p>
              </div>
              <span class="ag-card-badge">{{ pol.guardrails.length }} rules</span>
            </div>
            <ul class="ag-rule-list">
              <li v-for="(g, i) in pol.guardrails" :key="i">
                <span class="rule-dot">✓</span>
                <p>{{ g }}</p>
                <button v-if="canEdit" @click="removeGuardrail(i)" aria-label="Remove guardrail">×</button>
              </li>
              <li v-if="!pol.guardrails.length" class="ag-empty-card">No behavioral guardrails configured.</li>
            </ul>
            <div v-if="canEdit" class="ag-add">
              <input v-model="newGuardrail" placeholder="e.g. Never contact competitors" @keyup.enter="addGuardrail" />
              <button @click="addGuardrail">Add rule</button>
            </div>
          </section>
        </main>

        <aside class="ag-side">
          <section class="ag-card compact">
            <div class="ag-card-head">
              <div>
                <h2>Blocked Tools</h2>
                <p>Tools no agent may ever run.</p>
              </div>
            </div>
            <div class="ag-chips">
              <button v-for="t in pol.forbidden_tools" :key="t" class="ag-chip deny" :disabled="!canEdit" @click="removeForbidden(t)">
                {{ t }} <span v-if="canEdit">×</span>
              </button>
              <span v-if="!pol.forbidden_tools.length" class="ag-empty-inline">None blocked.</span>
            </div>
            <div v-if="canEdit" class="ag-add stacked">
              <input v-model="newForbidden" placeholder="TOOL_NAME" @keyup.enter="addForbidden" />
              <button @click="addForbidden">Block tool</button>
            </div>
          </section>

          <section class="ag-card compact">
            <div class="ag-card-head">
              <div>
                <h2>Tool Permissions</h2>
                <p>Force ask, deny, or allow for specific tools.</p>
              </div>
            </div>
            <div class="ag-chips">
              <button v-for="t in permTags" :key="t.tool" :class="['ag-chip', t.perm]" :disabled="!canEdit" @click="removeToolPerm(t.tool)">
                {{ t.tool }} · {{ t.perm }} <span v-if="canEdit">×</span>
              </button>
              <span v-if="!permTags.length" class="ag-empty-inline">All tools allowed by default.</span>
            </div>
            <div v-if="canEdit" class="ag-add stacked">
              <input v-model="newTool" placeholder="TOOL_NAME" @keyup.enter="addToolPerm" />
              <div class="ag-add-line">
                <select v-model="newToolPerm">
                  <option value="ask">Ask</option>
                  <option value="deny">Deny</option>
                  <option value="allow">Allow</option>
                </select>
                <button @click="addToolPerm">Add</button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import PlatformLlmPolicy from '@/components/admin/PlatformLlmPolicy.vue'
import ContextProfilesEditor from '@/components/admin/ContextProfilesEditor.vue'

const loading = ref(true)
const saving = ref(false)
const dirty = ref(false)
const canEdit = ref(false)

const pol = reactive({
  enabled: true,
  risk_ceiling: '',
  allow_external_write: true,
  tool_call_budget: 4,
  on_budget_exceeded: 'ask_llm',
  max_tool_calls_hard: 25,
  final_assurance_enabled: true,
  forbidden_tools: [],
  guardrails: [],
  tool_permissions: {},
  updated_at: null,
})

const riskLabels = {
  '': 'No ceiling',
  low: 'Low impact',
  medium: 'Medium impact',
  high: 'High impact',
  critical: 'Critical only',
}
const riskLabel = computed(() => riskLabels[pol.risk_ceiling] || 'No ceiling')
const permTags = computed(() => Object.entries(pol.tool_permissions).map(([tool, perm]) => ({ tool, perm })))
const newGuardrail = ref('')
const newForbidden = ref('')
const newTool = ref('')
const newToolPerm = ref('ask')

// P7: platform LLM policy
const llmPolicy = ref({})
const llmPolicyAbsolute = ref({})
const llmPolicyErrors = ref({})
function onLlmPolicyChange() { dirty.value = true; llmPolicyErrors.value = {} }

// Context profiles (per-profile context budgets) — effective values + code defaults from the policy GET.
const contextProfiles = ref({})
const contextProfileDefaults = ref({})
const contextProfileDisplay = ref([])
function onContextProfilesUpdate(cps) {
  // Store the edited budgets as the context_profiles override inside llm_policy — sent on save.
  llmPolicy.value = { ...llmPolicy.value, context_profiles: cps }
  dirty.value = true
}

function mark() { dirty.value = true }

function apply(d) {
  d = d || {}
  llmPolicy.value = (d.llm_policy && typeof d.llm_policy === 'object') ? { ...d.llm_policy } : {}
  llmPolicyAbsolute.value = (d.llm_policy_absolute && typeof d.llm_policy_absolute === 'object') ? { ...d.llm_policy_absolute } : {}
  llmPolicyErrors.value = {}
  contextProfiles.value = (d.context_profiles && typeof d.context_profiles === 'object') ? d.context_profiles : {}
  contextProfileDefaults.value = (d.context_profile_defaults && typeof d.context_profile_defaults === 'object') ? d.context_profile_defaults : {}
  contextProfileDisplay.value = Array.isArray(d.context_profile_display) ? d.context_profile_display : []
  pol.enabled = d.enabled !== false
  pol.risk_ceiling = d.risk_ceiling || ''
  pol.allow_external_write = d.allow_external_write !== false
  pol.tool_call_budget = d.tool_call_budget ?? 4
  pol.on_budget_exceeded = d.on_budget_exceeded || 'ask_llm'
  pol.max_tool_calls_hard = d.max_tool_calls_hard ?? 25
  pol.final_assurance_enabled = d.final_assurance_enabled !== false
  pol.forbidden_tools = Array.isArray(d.forbidden_tools) ? [...d.forbidden_tools] : []
  pol.guardrails = Array.isArray(d.guardrails) ? [...d.guardrails] : []
  pol.tool_permissions = d.tool_permissions && typeof d.tool_permissions === 'object' ? { ...d.tool_permissions } : {}
  pol.updated_at = d.updated_at || null
  canEdit.value = !!d.can_edit
  dirty.value = false
}

async function load() {
  loading.value = true
  try {
    apply((await api.getGlobalAgentPolicy()).data)
  } catch (e) {
    notify.error('Failed to load the system policy')
  } finally {
    loading.value = false
  }
}

function addGuardrail() {
  const g = newGuardrail.value.trim()
  newGuardrail.value = ''
  if (!g) return
  pol.guardrails = [...pol.guardrails, g]
  mark()
}
function removeGuardrail(i) {
  const c = [...pol.guardrails]
  c.splice(i, 1)
  pol.guardrails = c
  mark()
}
function addForbidden() {
  const t = newForbidden.value.trim().toUpperCase()
  newForbidden.value = ''
  if (!t || pol.forbidden_tools.includes(t)) return
  pol.forbidden_tools = [...pol.forbidden_tools, t]
  mark()
}
function removeForbidden(t) {
  pol.forbidden_tools = pol.forbidden_tools.filter(x => x !== t)
  mark()
}
function addToolPerm() {
  const t = newTool.value.trim().toUpperCase()
  newTool.value = ''
  if (!t) return
  pol.tool_permissions = { ...pol.tool_permissions, [t]: newToolPerm.value }
  mark()
}
function removeToolPerm(tool) {
  const tp = { ...pol.tool_permissions }
  delete tp[tool]
  pol.tool_permissions = tp
  mark()
}

async function save() {
  if (!canEdit.value || saving.value) return
  saving.value = true
  try {
    const r = await api.updateGlobalAgentPolicy({
      enabled: pol.enabled,
      risk_ceiling: pol.risk_ceiling,
      allow_external_write: pol.allow_external_write,
      tool_call_budget: pol.tool_call_budget,
      on_budget_exceeded: pol.on_budget_exceeded,
      max_tool_calls_hard: pol.max_tool_calls_hard,
      final_assurance_enabled: pol.final_assurance_enabled,
      forbidden_tools: pol.forbidden_tools,
      guardrails: pol.guardrails,
      tool_permissions: pol.tool_permissions,
      llm_policy: llmPolicy.value,   // P7 platform LLM ceilings
    })
    apply(r.data)
    notify.success('System policy saved')
  } catch (e) {
    // P7: surface llm_policy validation errors (400) inline; other errors toast as before.
    const llmErr = e.response?.status === 400 && e.response?.data?.llm_policy
    if (llmErr) {
      const list = Array.isArray(llmErr) ? llmErr : [String(llmErr)]
      const map = {}
      list.forEach((m) => { const k = String(m).match(/'([a-z_]+)'/)?.[1]; if (k) map[k] = m })
      llmPolicyErrors.value = map
      notify.error('Fix the highlighted platform LLM policy fields')
    } else {
      notify.error(e.response?.status === 403 ? 'Only a platform administrator can change the policy' : 'Failed to save policy')
    }
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.ag {
  min-height: 100%;
  padding: 4px 2px 44px;
  color: #0f172a;
}
.ag-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  padding: 24px;
  border: 1px solid #dbe4f0;
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(124, 58, 237, 0.06) 42%, rgba(255, 255, 255, 0.9)),
    #fff;
  box-shadow: 0 16px 42px rgba(15, 23, 42, 0.07);
}
.ag-eyebrow {
  margin-bottom: 8px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .06em;
}
.ag-hero h1 {
  margin: 0;
  color: #061126;
  font-size: 32px;
  font-weight: 850;
  letter-spacing: -0.03em;
}
.ag-hero p {
  max-width: 700px;
  margin: 10px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.6;
}
.ag-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 18px;
  color: #64748b;
  font-size: 12px;
  font-weight: 750;
}
.ag-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
}
.ag-status-pill span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
}
.ag-status-pill.on {
  background: #dcfce7;
  color: #047857;
}
.ag-status-pill.off {
  background: #fee2e2;
  color: #dc2626;
}
.ag-meta .dirty {
  color: #b45309;
  background: #fef3c7;
  border-radius: 999px;
  padding: 6px 10px;
}
.ag-hero-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
}
.ag-toggle,
.ag-save,
.ag-add button {
  height: 40px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
}
.ag-toggle {
  background: #fff;
  color: #0f172a;
}
.ag-toggle.on {
  color: #b91c1c;
}
.ag-toggle.off {
  color: #047857;
}
.ag-save {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
  box-shadow: 0 10px 22px rgba(37, 99, 235, .22);
}
.ag-save:disabled,
.ag-toggle:disabled,
.ag-add button:disabled {
  opacity: .55;
  cursor: not-allowed;
  box-shadow: none;
}
.ag-toggle:not(:disabled):hover,
.ag-save:not(:disabled):hover,
.ag-add button:hover {
  transform: translateY(-1px);
}
.ag-banner {
  margin-top: 16px;
  border-radius: 12px;
  padding: 13px 15px;
  font-size: 13px;
  line-height: 1.5;
}
.ag-banner.warn {
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
}
.ag-banner.danger {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}
.ag-loading {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}
.ag-skeleton {
  min-height: 148px;
  border-radius: 14px;
  background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 37%, #f1f5f9 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}
@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
.ag-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.ag-stat-card,
.ag-card {
  border: 1px solid #dbe4f0;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, .04);
}
.ag-stat-card {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 12px;
  align-items: center;
  min-height: 92px;
  border-radius: 14px;
  padding: 16px;
}
.ag-stat-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 900;
}
.ag-stat-icon.blue { background: #eff6ff; color: #2563eb; }
.ag-stat-icon.green { background: #ecfdf5; color: #059669; }
.ag-stat-icon.violet { background: #f3e8ff; color: #7c3aed; }
.ag-stat-icon.red { background: #fef2f2; color: #dc2626; }
.ag-stat-card p {
  margin: 0 0 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}
.ag-stat-card strong {
  color: #071326;
  font-size: 20px;
  font-weight: 900;
}
.ag-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  margin-top: 16px;
  align-items: start;
}
.ag-main,
.ag-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ag-card {
  border-radius: 14px;
  padding: 20px;
}
.ag-card.compact {
  padding: 18px;
}
.ag-card-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}
.ag-card h2 {
  margin: 0;
  color: #061126;
  font-size: 18px;
  font-weight: 850;
  letter-spacing: -0.02em;
}
.ag-card-head p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}
.ag-card-badge {
  flex-shrink: 0;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 900;
}
.ag-control-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.ag-control-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.ag-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  padding: 14px;
}
.ag-field > span {
  color: #334155;
  font-size: 12px;
  font-weight: 850;
}
.ag-field small {
  display: block;
  margin-top: 3px;
  color: #64748b;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.4;
}
.ag-field select,
.ag-field input,
.ag-add input,
.ag-add select {
  width: 100%;
  height: 38px;
  border: 1px solid #dbe4f0;
  border-radius: 9px;
  background: #fff;
  color: #0f172a;
  padding: 0 11px;
  font-size: 13px;
  font-weight: 700;
  outline: none;
}
.ag-field select:focus,
.ag-field input:focus,
.ag-add input:focus,
.ag-add select:focus {
  border-color: #93b4ff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, .12);
}
.ag-switch-row {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
.ag-switch {
  position: relative;
  width: 46px;
  height: 26px;
  flex-shrink: 0;
  border: 0;
  border-radius: 999px;
  background: #cbd5e1;
  cursor: pointer;
}
.ag-switch.on {
  background: #2563eb;
}
.ag-switch i {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, .18);
  transition: transform .16s ease;
}
.ag-switch.on i {
  transform: translateX(20px);
}
.ag-switch:disabled {
  cursor: default;
  opacity: .65;
}
.ag-rule-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ag-rule-list li:not(.ag-empty-card) {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  padding: 12px;
}
.rule-dot {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 999px;
  background: #dcfce7;
  color: #059669;
  font-size: 12px;
  font-weight: 900;
}
.ag-rule-list p {
  flex: 1;
  margin: 0;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}
.ag-rule-list button {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
}
.ag-rule-list button:hover {
  background: #fee2e2;
  color: #dc2626;
}
.ag-empty-card,
.ag-empty-inline {
  display: block;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  padding: 16px;
  color: #64748b;
  font-size: 13px;
  font-weight: 750;
}
.ag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ag-chip {
  min-height: 30px;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  background: #f1f5f9;
  color: #334155;
}
.ag-chip.ask {
  background: #fff7ed;
  color: #c2410c;
}
.ag-chip.deny {
  background: #fef2f2;
  color: #dc2626;
}
.ag-chip.allow {
  background: #ecfdf5;
  color: #047857;
}
.ag-chip:disabled {
  cursor: default;
  opacity: .85;
}
.ag-add {
  display: flex;
  gap: 9px;
  margin-top: 14px;
}
.ag-add.stacked {
  flex-direction: column;
}
.ag-add-line {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 9px;
}
.ag-add button {
  border-color: #0f172a;
  background: #0f172a;
  color: #fff;
  white-space: nowrap;
}
@media (max-width: 1180px) {
  .ag-layout {
    grid-template-columns: 1fr;
  }
  .ag-side {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 860px) {
  .ag-hero,
  .ag-hero-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .ag-stats,
  .ag-control-grid,
  .ag-control-grid.three,
  .ag-side {
    grid-template-columns: 1fr;
  }
}
</style>
