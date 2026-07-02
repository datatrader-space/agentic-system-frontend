<template>
  <main class="approvals-page">
    <section class="approvals-main">
      <header class="page-head">
        <div class="title-block">
          <span class="title-icon"><Icon icon="lucide:shield-check" /></span>
          <div>
            <h1>Guardrails</h1>
            <p>Control how your agents operate with policies, permissions, and safety limits.</p>
          </div>
        </div>
        <div class="head-actions">
          <button class="ghost" @click="openAudit"><Icon icon="lucide:file-clock" /> View audit log</button>
          <button class="primary" :disabled="!canEdit || saving" @click="saveGuardrails">
            <Icon icon="lucide:save" /> {{ saving ? 'Saving…' : 'Save guardrails' }}
          </button>
        </div>
      </header>

      <section class="notice">
        <span><Icon icon="lucide:shield" /></span>
        <div>
          <strong>Guardrails keep your agents aligned with your policies and values.</strong>
          <p>Apply rules that control what agents can do, when they need approval, and how they spend or communicate.</p>
        </div>
      </section>

      <section class="policy-grid">
        <article class="policy-card context-profile-card">
          <header class="card-head">
            <span><Icon icon="lucide:sliders-horizontal" /></span>
            <div>
              <h2>Context Profile</h2>
              <p>How much conversation, retrieval, and tool context this agent uses per turn.</p>
            </div>
          </header>
          <ContextProfilePicker
            :model-value="contextProfile"
            :profiles="availableProfiles"
            :preview="profilePreview"
            :matrix="profilesMatrix"
            :disabled="!canEdit"
            @update:model-value="onProfileChange"
          />
        </article>

        <article class="policy-card approval-card">
          <header class="card-head">
            <span>1</span>
            <div>
              <h2>Approval Policies</h2>
              <p>Require approval for sensitive or high-impact actions.</p>
            </div>
          </header>
          <div class="setting-list">
            <label v-for="item in approvalDefs" :key="item.key" class="setting-row">
              <span>{{ item.label }}</span>
              <button :class="['toggle', { on: pol.approvals[item.key] }]" type="button"
                      :disabled="!canEdit" @click="toggle('approvals', item.key)"><i /></button>
            </label>
          </div>
          <label class="field-row">
            <span>Approval timeout</span>
            <select v-model.number="pol.approval_timeout_hours" :disabled="!canEdit" @change="mark">
              <option :value="2">2 hours</option>
              <option :value="6">6 hours</option>
              <option :value="24">24 hours</option>
            </select>
          </label>
        </article>

        <article class="policy-card risky-card">
          <header class="card-head">
            <span>2</span>
            <div>
              <h2>Risky Actions</h2>
              <p>Block or warn on potentially risky behavior.</p>
            </div>
          </header>
          <div class="setting-list">
            <label v-for="item in riskyDefs" :key="item.key" class="setting-row">
              <span>{{ item.label }}</span>
              <button :class="['toggle', { on: pol.risky_actions[item.key] }]" type="button"
                      :disabled="!canEdit" @click="toggle('risky_actions', item.key)"><i /></button>
            </label>
          </div>
          <label class="field-row">
            <span>Action on violation</span>
            <select v-model="pol.on_violation" :disabled="!canEdit" @change="mark">
              <option value="block">Block and notify</option>
              <option value="warn">Warn only</option>
              <option value="ask">Require approval</option>
            </select>
          </label>
        </article>

        <article class="policy-card permissions-card">
          <header class="card-head">
            <span>3</span>
            <div>
              <h2>Tool Permissions &amp; Approvals</h2>
              <p>Decide when this agent needs human approval for the tools you selected.</p>
            </div>
          </header>

          <label class="field-row">
            <span>Require approval for actions above</span>
            <select v-model="pol.risk_ceiling" :disabled="!canEdit" @change="mark">
              <option value="">No ceiling</option>
              <option value="low">Low impact</option>
              <option value="medium">Medium impact</option>
              <option value="high">High impact</option>
              <option value="critical">Critical only</option>
            </select>
          </label>
          <label class="field-row">
            <span>Approval from</span>
            <select v-model="pol.approver_role" :disabled="!canEdit" @change="mark">
              <option value="agent_owner">Agent owner</option>
              <option value="org_owner">Organization owners</option>
              <option value="workspace_admin">Workspace admins</option>
            </select>
          </label>

          <div class="pertool-head">
            <span class="box-label">Per-tool approval</span>
            <div v-if="toolTotalPages > 1" class="pertool-pager">
              <button class="pg-btn" :disabled="toolPage <= 1" @click="toolPage--"><Icon icon="lucide:chevron-left" /></button>
              <span>{{ toolPage }}/{{ toolTotalPages }}</span>
              <button class="pg-btn" :disabled="toolPage >= toolTotalPages" @click="toolPage++"><Icon icon="lucide:chevron-right" /></button>
            </div>
          </div>
          <ul class="pertool-list">
            <li v-for="row in pagedToolRows" :key="row.key" class="pertool-row">
              <span class="pertool-ico"><Icon icon="lucide:wrench" /></span>
              <span class="pertool-name">
                <span class="pt-label">{{ row.label }}</span>
                <span class="pt-key">{{ row.name }}</span>
              </span>
              <select class="pt-select" :value="row.agent" :disabled="!canEdit"
                      @change="setToolPerm(row.key, $event.target.value)">
                <option value="">Inherit · Allow</option>
                <option value="ask">Ask approval</option>
                <option value="deny">Block</option>
              </select>
            </li>
            <li v-if="!toolRows.length" class="pertool-empty">
              No tools selected yet — pick tools in the Knowledge &amp; Tools step first.
            </li>
          </ul>
          <p class="hint">Manage connectors from the <strong>Connectors</strong> page <Icon icon="lucide:external-link" /></p>

        </article>

        <article class="policy-card action-mode-card">
          <header class="card-head">
            <span>4</span>
            <div>
              <h2>Read-only vs Action Mode</h2>
              <p>Choose the default mode for this agent.</p>
            </div>
          </header>
          <div class="mode-grid">
            <label :class="['mode-card', { selected: pol.read_only }]">
              <input type="radio" :checked="pol.read_only" :disabled="!canEdit" @change="pol.read_only = true; mark()" />
              <strong>Read-only mode</strong>
              <p>Agent can analyze and provide recommendations without making changes.</p>
            </label>
            <label :class="['mode-card', { selected: !pol.read_only }]">
              <input type="radio" :checked="!pol.read_only" :disabled="!canEdit" @change="pol.read_only = false; mark()" />
              <strong>Action mode</strong>
              <p>Agent can take actions based on permissions and approvals.</p>
            </label>
          </div>
          <label class="field-row mode-select">
            <span>Default mode</span>
            <select :value="pol.read_only ? 'read' : 'action'" :disabled="!canEdit"
                    @change="pol.read_only = ($event.target.value === 'read'); mark()">
              <option value="read">Read-only mode</option>
              <option value="action">Action mode</option>
            </select>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" :checked="execMode === 'manual'" :disabled="!canEdit"
                   @change="execMode = $event.target.checked ? 'manual' : 'autonomous'; mark()" />
            <span>Require approval before taking actions (manual mode)</span>
          </label>
        </article>

        <article class="policy-card checkpoints-card">
          <header class="card-head">
            <span>5</span>
            <div>
              <h2>Human-in-the-loop Checkpoints</h2>
              <p>Add checkpoints for important decisions.</p>
            </div>
          </header>
          <div class="setting-list">
            <label v-for="item in checkpointDefs" :key="item.key" class="setting-row">
              <span>{{ item.label }}</span>
              <button :class="['toggle', { on: pol.checkpoints[item.key] }]" type="button"
                      :disabled="!canEdit" @click="toggle('checkpoints', item.key)"><i /></button>
            </label>
          </div>
          <label class="reviewer-field">
            <span>Default reviewer</span>
            <input v-model="pol.default_reviewer" :disabled="!canEdit" @input="mark"
                   type="email" placeholder="reviewer@email.com" />
          </label>
        </article>

        <article class="policy-card behavioral-card">
          <header class="card-head">
            <span>6</span>
            <div>
              <h2>Behavioral Rules &amp; Restrictions</h2>
              <p>Custom rules injected into every reply, blocked tools, and external-write control.</p>
            </div>
          </header>

          <div class="permission-box">
            <span class="box-label">Behavioral rules — injected into every reply</span>
            <ul class="rule-list">
              <li v-for="(g, i) in pol.guardrails" :key="i" class="rule-item">
                <span>{{ g }}</span>
                <button type="button" :disabled="!canEdit" @click="removeGuardrail(i)"><Icon icon="lucide:x" /></button>
              </li>
              <li v-if="!pol.guardrails.length" class="empty-tag">No agent-specific rules.</li>
            </ul>
            <div class="tool-add-row">
              <input
                v-model="newGuardrail"
                :disabled="!canEdit"
                placeholder="e.g. Never share pricing"
                @keyup.enter="addGuardrail"
              />
              <button class="add-confirm" :disabled="!canEdit" @click="addGuardrail">Add</button>
            </div>
          </div>

          <div class="permission-box">
            <span class="box-label">Blocked tools</span>
            <div class="tag-cloud">
              <button v-for="t in pol.forbidden_tools" :key="t" class="perm-chip deny" type="button" :disabled="!canEdit" @click="removeForbidden(t)">
                {{ t }} <Icon icon="lucide:x" />
              </button>
              <span v-if="!pol.forbidden_tools.length" class="empty-tag">None</span>
            </div>
            <div class="tool-add-row">
              <input
                v-model="newForbidden"
                :disabled="!canEdit"
                placeholder="TOOL_NAME"
                @keyup.enter="addForbidden"
              />
              <button class="add-confirm" :disabled="!canEdit" @click="addForbidden">Add</button>
            </div>
          </div>

          <label class="setting-row external-write-row">
            <span>Allow external writes</span>
            <button :class="['toggle', { on: pol.allow_external_write }]" type="button" :disabled="!canEdit"
                    @click="pol.allow_external_write = !pol.allow_external_write; mark()"><i /></button>
          </label>
        </article>

      </section>

      <section class="escalation-card">
        <header class="card-head">
          <span>7</span>
          <div>
            <h2>Escalation Rules</h2>
            <p>Define what happens when guardrails are triggered.</p>
          </div>
        </header>
        <div class="escalation-table">
          <div class="table-head">
            <span>Trigger</span>
            <span>Escalation action</span>
            <span>Notify</span>
            <span />
          </div>
          <div v-for="(rule, i) in pol.escalation_rules" :key="i" class="escalation-row">
            <select v-model="rule.trigger" :disabled="!canEdit" @change="mark">
              <option v-for="t in escalationTriggers" :key="t" :value="t">{{ t }}</option>
            </select>
            <select v-model="rule.action" :disabled="!canEdit" @change="mark">
              <option v-for="a in escalationActions" :key="a" :value="a">{{ a }}</option>
            </select>
            <div class="email-pill">{{ pol.default_reviewer || 'Default reviewer' }}</div>
            <button :disabled="!canEdit" @click="removeEscalation(i)"><Icon icon="lucide:trash-2" /></button>
          </div>
          <div v-if="!pol.escalation_rules.length" class="escalation-row empty-row">
            <span class="empty-tag">No escalation rules yet — add one to define what happens when a guardrail trips.</span>
          </div>
        </div>
        <button class="add-rule" :disabled="!canEdit" @click="addEscalation"><Icon icon="lucide:plus" /> Add escalation rule</button>
      </section>
    </section>

    <aside class="guardrail-rail">
      <section class="rail-card about">
        <span class="rail-icon"><Icon icon="lucide:shield-check" /></span>
        <h2>About Guardrails</h2>
        <p>Guardrails help you safely scale agent autonomy by setting clear boundaries and escalation paths. You can always review and adjust these settings.</p>
      </section>

      <section class="rail-card presets">
        <h2>Recommended Presets</h2>
        <p>Start with a preset, then customize as needed.</p>
        <article v-for="preset in presets" :key="preset.title">
          <h3>{{ preset.title }}</h3>
          <p>{{ preset.copy }}</p>
          <ul>
            <li v-for="line in preset.lines" :key="line"><Icon icon="lucide:check" /> {{ line }}</li>
          </ul>
          <button @click="applyPreset(preset)">Apply {{ preset.button }}</button>
        </article>
        <p class="settings-note">You can create custom presets in <strong>Settings</strong>.</p>
      </section>
    </aside>

    <!-- Audit / usage modal (header "View audit log") -->
    <div v-if="showAudit" class="audit-overlay" @click.self="showAudit = false">
      <div class="audit-modal">
        <header class="audit-head">
          <div>
            <h2>Action usage &amp; audit</h2>
            <p>Recent runs and the effective action limits for this agent.</p>
          </div>
          <button class="icon-btn" @click="showAudit = false"><Icon icon="lucide:x" /></button>
        </header>

        <div v-if="audit.data" class="audit-stats">
          <div class="stat"><span>Runs today</span><strong>{{ audit.data.today?.runs ?? 0 }}</strong></div>
          <div class="stat"><span>Avg actions / run</span><strong>{{ audit.data.today?.avg_actions ?? 0 }}</strong></div>
          <div class="stat"><span>Max actions / run</span><strong>{{ audit.data.limits?.max_actions_per_run?.effective ?? '—' }}</strong></div>
          <div class="stat"><span>Runs / day limit</span><strong>{{ audit.data.limits?.max_runs_per_day?.unlimited ? 'Unlimited' : audit.data.limits?.max_runs_per_day?.effective }}</strong></div>
        </div>

        <div class="audit-list">
          <div class="audit-row audit-row-head">
            <span>When</span><span>Actions</span><span>Stop reason</span><span>Duration</span>
          </div>
          <div v-for="(r, i) in audit.recent" :key="i" class="audit-row">
            <span>{{ r.at ? new Date(r.at).toLocaleString() : '—' }}</span>
            <span :class="{ 'over-cap': r.over_cap }">{{ r.actions }}</span>
            <span>{{ r.stop_reason || '—' }}</span>
            <span>{{ r.duration_ms ? Math.round(r.duration_ms / 100) / 10 + 's' : '—' }}</span>
          </div>
          <div v-if="!audit.loading && !audit.recent.length" class="audit-empty">No runs recorded yet.</div>
          <div v-if="audit.loading" class="audit-empty">Loading…</div>
        </div>

        <footer class="audit-foot">
          <span>{{ audit.recent.length }} of {{ audit.total }}</span>
          <button v-if="auditHasMore" class="ghost" :disabled="audit.loading" @click="moreAudit">Load more</button>
        </footer>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import ContextProfilePicker from '@/components/agent/ContextProfilePicker.vue'

// ── Wired to the PER-AGENT policy (AgentProfile.agent_policy) + execution_mode. ──
// Per-agent policy can only TIGHTEN the org GlobalAgentPolicy floor; the backend clamps any
// weakening value at save time. This page never edits the org policy.
const route = useRoute()
const agentId = computed(() => route.params.id)
// Optimistic: allow editing by default so the Save button is never stuck disabled when the detail fetch is
// slow/fails. Ownership is enforced server-side on PATCH (a non-owner gets a 403 + clear message).
const canEdit = ref(true)
const dirty = ref(false)
const saving = ref(false)
const rawPolicy = ref({})            // full agent_policy as loaded, so we preserve unknown keys on save
const execMode = ref('manual')       // AgentProfile.execution_mode (real enforced field)

// P6: context profile (agent_policy.context_profile) + effective-policy preview.
const contextProfile = ref('')       // '' = Automatic (request-type default)
const availableProfiles = ref([])
const profilePreview = ref(null)
const profilesMatrix = ref(null)     // exact per-profile token budgets for THIS agent's model
function onProfileChange(key) { contextProfile.value = key; dirty.value = true }
async function loadEffectivePolicy() {
  if (!agentId.value) return
  try {
    const d = (await api.getAgentEffectivePolicy(agentId.value)).data || {}
    availableProfiles.value = d.available_profiles || []
    profilePreview.value = d.preview || null
    profilesMatrix.value = d.profiles_matrix || null
    if (contextProfile.value === '' && d.current_profile) contextProfile.value = d.current_profile
  } catch (e) { /* preview is best-effort; picker still works */ }
}

const pol = reactive({
  // hard policy (enforced by policy_layer Hook A/B)
  risk_ceiling: '', allow_external_write: true, tool_call_budget: 4, tool_permissions: {}, forbidden_tools: [],
  guardrails: [],   // free-text behavioral rules injected into every reply
  // structured Guardrails-page keys
  read_only: false,
  approvals: { email: false, message: false, purchase: false, file_edit: false, external_api: false },
  approval_timeout_hours: 24,
  approver_role: 'agent_owner',
  risky_actions: { block_exfil: false, block_injection: false, warn_destructive: false, warn_expensive: false },
  on_violation: 'block',
  checkpoints: { high_risk: false, over_budget: false, new_tool: false, external_api: false },
  default_reviewer: '',
  escalation_rules: [],
})
function toggle(group, key) { pol[group][key] = !pol[group][key]; dirty.value = true }
function mark() { dirty.value = true }

// ── Per-tool approval (Card 3) — the tools this agent SELECTED, each Inherit/Ask/Block. ──
const toolDefsById = ref({})
const toolIds = ref([])
const toolPage = ref(1)
const TOOL_PAGE_SIZE = 4
async function loadToolDefs() {
  try {
    let all = [], next = '/tools/definitions/', guard = 0
    while (next && guard++ < 60) {
      const d = (await api.get(next)).data
      if (Array.isArray(d)) { all = all.concat(d); break }
      all = all.concat(d.results || [])
      if (d.next) { const u = new URL(d.next, window.location.origin); next = u.pathname.replace(/^\/api/, '') + u.search }
      else next = null
    }
    const map = {}
    for (const t of all) map[t.id] = t
    toolDefsById.value = map
  } catch (e) { toolDefsById.value = {} }
}
const _permRow = (name, label) => ({
  key: String(name).toUpperCase(), name, label: label || name,
  agent: String(pol.tool_permissions[String(name).toUpperCase()] || '').toLowerCase(),
})
const selectedRows = computed(() => toolIds.value.map(id => toolDefsById.value[id]).filter(Boolean)
  .map(t => _permRow(t.name, t.display_name || t.name)))
const extraRows = computed(() => {
  const sel = new Set(toolIds.value.map(id => toolDefsById.value[id]).filter(Boolean).map(t => String(t.name).toUpperCase()))
  return Object.keys(pol.tool_permissions || {}).filter(k => !sel.has(k)).map(k => _permRow(k, k))
})
const toolRows = computed(() => [...selectedRows.value, ...extraRows.value])
const toolTotalPages = computed(() => Math.max(1, Math.ceil(toolRows.value.length / TOOL_PAGE_SIZE)))
const pagedToolRows = computed(() => {
  const s = (toolPage.value - 1) * TOOL_PAGE_SIZE
  return toolRows.value.slice(s, s + TOOL_PAGE_SIZE)
})
function setToolPerm(key, value) {
  const cur = { ...pol.tool_permissions }
  const k = String(key).toUpperCase()
  if (value) cur[k] = value
  else delete cur[k]
  pol.tool_permissions = cur; dirty.value = true
}

function applyPolicy(p) {
  p = p && typeof p === 'object' ? p : {}
  rawPolicy.value = { ...p }
  pol.risk_ceiling = p.risk_ceiling || ''
  pol.allow_external_write = p.allow_external_write !== false
  pol.tool_call_budget = p.tool_call_budget ?? 4
  pol.tool_permissions = p.tool_permissions || {}
  pol.forbidden_tools = Array.isArray(p.forbidden_tools) ? [...p.forbidden_tools] : []
  pol.guardrails = Array.isArray(p.guardrails) ? p.guardrails.map(normGuardrail) : []
  pol.read_only = !!p.read_only
  Object.assign(pol.approvals, { email: false, message: false, purchase: false, file_edit: false, external_api: false }, p.approvals || {})
  pol.approval_timeout_hours = p.approval_timeout_hours ?? 24
  pol.approver_role = p.approver_role || 'agent_owner'
  Object.assign(pol.risky_actions, { block_exfil: false, block_injection: false, warn_destructive: false, warn_expensive: false }, p.risky_actions || {})
  pol.on_violation = p.on_violation || 'block'
  Object.assign(pol.checkpoints, { high_risk: false, over_budget: false, new_tool: false, external_api: false }, p.checkpoints || {})
  pol.default_reviewer = p.default_reviewer || ''
  pol.escalation_rules = Array.isArray(p.escalation_rules) ? p.escalation_rules.map(r => ({ ...r })) : []
  dirty.value = false
}
async function loadPolicy() {
  if (!agentId.value) return
  try {
    const a = (await api.getAgent(agentId.value)).data || {}
    applyPolicy(a.agent_policy || {})
    contextProfile.value = (a.agent_policy && a.agent_policy.context_profile) || ''   // P6
    loadEffectivePolicy()                                                              // P6 (best-effort)
    execMode.value = a.execution_mode || 'manual'
    // GET returns `tools` (full objects); `tool_ids` is write-only. Derive ids from whichever is present.
    toolIds.value = Array.isArray(a.tool_ids) ? a.tool_ids
      : (Array.isArray(a.tools) ? a.tools.map(t => t.id) : [])
    canEdit.value = true                // owner-scoped detail; a non-owner PATCH is rejected 403
  } catch (e) { /* keep static UI usable */ }
}

// Behavioral rules (free-text guardrails) + blocked tools (forbidden_tools). Legacy opaque keys map to
// sentences on read so old data displays and cleans up on next edit.
const GUARDRAIL_KEY_MAP = {
  no_external_email: 'Do not send external emails',
  no_pricing_changes: 'Do not modify pricing',
  respect_privacy: 'Respect data privacy policies',
}
const normGuardrail = (g) => GUARDRAIL_KEY_MAP[g] || g
const newGuardrail = ref('')
function addGuardrail() {
  const g = newGuardrail.value.trim()
  newGuardrail.value = ''
  if (!g) return
  pol.guardrails = [...pol.guardrails, g]; dirty.value = true
}
function removeGuardrail(i) {
  const cur = [...pol.guardrails]; cur.splice(i, 1)
  pol.guardrails = cur; dirty.value = true
}
const newForbidden = ref('')
function addForbidden() {
  const t = newForbidden.value.trim().toUpperCase()
  newForbidden.value = ''
  if (!t || pol.forbidden_tools.includes(t)) return
  pol.forbidden_tools = [...pol.forbidden_tools, t]; dirty.value = true
}
function removeForbidden(t) {
  pol.forbidden_tools = pol.forbidden_tools.filter(x => x !== t); dirty.value = true
}
function addEscalation() {
  pol.escalation_rules.push({ trigger: escalationTriggers[0], action: escalationActions[0],
    notify: pol.default_reviewer ? [pol.default_reviewer] : [] })
  dirty.value = true
}
function removeEscalation(i) { pol.escalation_rules.splice(i, 1); dirty.value = true }

function applyPreset(preset) {
  pol.risk_ceiling = preset.risk_ceiling
  pol.allow_external_write = preset.allow_external_write
  pol.tool_call_budget = preset.tool_call_budget
  if (preset.approvals) Object.assign(pol.approvals, preset.approvals)
  if (preset.risky_actions) Object.assign(pol.risky_actions, preset.risky_actions)
  if (preset.read_only !== undefined) pol.read_only = preset.read_only
  dirty.value = true
  notify.info(`${preset.button} preset applied — click “Save guardrails” to persist`)
}
async function saveGuardrails() {
  if (saving.value || !agentId.value) return
  saving.value = true
  try {
    const agent_policy = {
      ...rawPolicy.value,
      risk_ceiling: pol.risk_ceiling, allow_external_write: pol.allow_external_write,
      tool_call_budget: pol.tool_call_budget, tool_permissions: pol.tool_permissions,
      forbidden_tools: pol.forbidden_tools, guardrails: pol.guardrails, read_only: pol.read_only,
      approvals: { ...pol.approvals }, approval_timeout_hours: pol.approval_timeout_hours,
      approver_role: pol.approver_role,
      risky_actions: { ...pol.risky_actions }, on_violation: pol.on_violation,
      checkpoints: { ...pol.checkpoints }, default_reviewer: pol.default_reviewer,
      escalation_rules: pol.escalation_rules,
      context_profile: contextProfile.value || '',   // P6: '' clears the override (Automatic)
    }
    const r = await api.updateAgent(agentId.value, { agent_policy, execution_mode: execMode.value })
    const saved = (r.data || {}).agent_policy || agent_policy
    applyPolicy(saved)   // reflect the server-clamped result
    contextProfile.value = saved.context_profile || ''   // P6: reflect cleared/normalized value
    loadEffectivePolicy()                                  // P6: refresh the preview for the new profile
    execMode.value = (r.data || {}).execution_mode || execMode.value
    notify.success('Agent guardrails saved')
  } catch (e) {
    notify.error(e.response?.status === 403 ? 'You can only edit your own agent’s guardrails' : 'Failed to save guardrails')
  } finally { saving.value = false }
}

// ── Audit-log / usage modal (header "View audit log") ──
const showAudit = ref(false)
const audit = reactive({ loading: false, data: null, recent: [], offset: 0, total: 0 })
async function openAudit() {
  showAudit.value = true; audit.offset = 0; audit.recent = []; await loadAudit()
}
async function loadAudit() {
  if (!agentId.value) return
  audit.loading = true
  try {
    const d = (await api.getAgentActionUsage(agentId.value, { limit: 10, offset: audit.offset })).data || {}
    audit.data = d
    audit.total = d.recent_total || 0
    audit.recent = audit.offset === 0 ? (d.recent || []) : [...audit.recent, ...(d.recent || [])]
  } catch (e) { notify.error('Failed to load usage') }
  finally { audit.loading = false }
}
function moreAudit() { audit.offset += 10; loadAudit() }
const auditHasMore = computed(() => audit.recent.length < audit.total)

onMounted(() => { loadPolicy(); loadToolDefs() })

// Template rows → structured agent_policy keys (labels unchanged; toggles bound to `pol`).
const approvalDefs = [
  { key: 'email', label: 'Require approval before sending emails' },
  { key: 'message', label: 'Require approval before posting messages' },
  { key: 'purchase', label: 'Require approval before making purchases' },
  { key: 'file_edit', label: 'Require approval before editing files' },
  { key: 'external_api', label: 'Require approval before calling external APIs' },
]
const riskyDefs = [
  { key: 'block_exfil', label: 'Block data exfiltration attempts' },
  { key: 'block_injection', label: 'Block prompt injection attempts' },
  { key: 'warn_destructive', label: 'Warn on destructive file operations' },
  { key: 'warn_expensive', label: 'Warn on long-running or expensive tasks' },
]
const checkpointDefs = [
  { key: 'high_risk', label: 'Checkpoint for high-risk actions' },
  { key: 'over_budget', label: 'Checkpoint for spending over limit' },
  { key: 'new_tool', label: 'Checkpoint for new tool usage' },
  { key: 'external_api', label: 'Checkpoint for external API calls' },
]
const escalationTriggers = ['High risk action blocked', 'Spend limit exceeded', 'Repeated policy violations', 'External write attempted', 'Approval timeout']
const escalationActions = ['Notify and require approval', 'Pause agent and notify', 'Disable agent and notify', 'Warn only']

const presets = [
  {
    title: 'Safe (Recommended)',
    button: 'Safe',
    copy: 'Maximum protection with strict approvals and lower limits.',
    lines: ['All high-impact actions require approval', 'External writes blocked', 'Best for regulated or sensitive work'],
    risk_ceiling: 'low', allow_external_write: false, tool_call_budget: 3, read_only: false,
    approvals: { email: true, message: true, purchase: true, file_edit: true, external_api: true },
    risky_actions: { block_exfil: true, block_injection: true, warn_destructive: true, warn_expensive: true },
  },
  {
    title: 'Balanced',
    button: 'Balanced',
    copy: 'Smart defaults for most teams and use cases.',
    lines: ['Key actions require approval', 'Moderate limits', 'Good balance of safety and speed'],
    risk_ceiling: 'high', allow_external_write: true, tool_call_budget: 4, read_only: false,
    approvals: { email: true, message: false, purchase: true, file_edit: true, external_api: false },
    risky_actions: { block_exfil: true, block_injection: true, warn_destructive: true, warn_expensive: false },
  },
  {
    title: 'Advanced',
    button: 'Advanced',
    copy: 'More autonomy with higher thresholds.',
    lines: ['Fewer approvals', 'Higher usage limits', 'Best for trusted, low-risk environments'],
    risk_ceiling: 'critical', allow_external_write: true, tool_call_budget: 8, read_only: false,
    approvals: { email: false, message: false, purchase: true, file_edit: false, external_api: false },
    risky_actions: { block_exfil: true, block_injection: true, warn_destructive: false, warn_expensive: false },
  },
]
</script>

<style scoped>
.approvals-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  min-height: 100%;
  padding: 26px 28px;
  background: #f8fbff;
  color: #0f172a;
}
.approvals-main { max-width: 1240px; width: 100%; justify-self: center; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
.title-block { display: flex; gap: 14px; align-items: flex-start; }
.title-icon, .notice span, .rail-icon {
  width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; background: #eef4ff; color: #3156e9;
}
h1, h2, h3, p { margin: 0; }
h1 { font-size: 24px; line-height: 1.1; font-weight: 850; }
.page-head p, .notice p, .card-head p, .hint, .rail-card p { color: #5b6b84; font-size: 12px; line-height: 1.45; }
.page-head p { margin-top: 8px; }
.head-actions { display: flex; gap: 12px; }
button, input, select { font: inherit; }
.ghost, .primary {
  height: 40px; border-radius: 8px; padding: 0 16px; display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 850;
}
.ghost { border: 1px solid #d9e3f0; background: #fff; color: #334155; }
.primary { border: 0; background: #4a47ea; color: #fff; box-shadow: 0 12px 24px rgba(74,71,234,.18); }
.notice, .policy-card, .escalation-card, .rail-card {
  border: 1px solid #dfe7f2; border-radius: 11px; background: #fff; box-shadow: 0 8px 22px rgba(15,23,42,.03);
}
.notice { display: flex; gap: 14px; align-items: center; padding: 18px 20px; margin-bottom: 14px; }
.notice strong { display: block; font-size: 13px; margin-bottom: 5px; }
.policy-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }
.policy-card, .escalation-card { padding: 18px; }
.context-profile-card { order: 1; }
.approval-card { order: 2; }
.risky-card { order: 3; }
.permissions-card { order: 4; }
.action-mode-card { order: 5; }
.checkpoints-card { order: 6; }
.behavioral-card { order: 7; }
.card-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 18px; }
.card-head > span {
  width: 22px; height: 22px; border-radius: 8px; display: grid; place-items: center; flex: 0 0 auto; background: #eaf1ff; color: #3156e9; font-size: 12px; font-weight: 900;
}
.card-head h2 { font-size: 15px; font-weight: 850; margin-bottom: 6px; }
.setting-list { display: grid; gap: 16px; }
.setting-row, .field-row, .connector-field, .reviewer-field, .domain-row {
  display: flex; align-items: center; justify-content: space-between; gap: 14px; color: #334155; font-size: 12px; font-weight: 750;
}
.field-row { margin-top: 22px; }
.toggle {
  width: 32px; height: 18px; border-radius: 999px; border: 0; padding: 2px; background: #d7dee8; flex: 0 0 auto;
}
.toggle i { display: block; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,.2); }
.toggle.on { background: #3156e9; }
.toggle.on i { margin-left: auto; }
select, input {
  height: 34px; border: 1px solid #d7e1ee; border-radius: 7px; background: #fff; color: #0f172a; padding: 0 12px; font-size: 12px; font-weight: 700;
}
.field-row select { width: 112px; }
.permission-box {
  border: 1px solid #d7e1ee; border-radius: 8px; padding: 10px; min-height: 112px; margin-bottom: 14px;
}
.box-label, .connector-field > span, .reviewer-field > span, .domain-row > span {
  display: block; color: #64748b; font-size: 11px; font-weight: 850; margin-bottom: 8px;
}
.tag-cloud { display: flex; flex-wrap: wrap; gap: 7px; }
.tag-cloud button {
  height: 26px; border: 0; border-radius: 6px; background: #f1f5f9; color: #334155; padding: 0 9px; display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 750;
}
.tag-cloud svg { width: 12px; height: 12px; }
.perm-chip.ask { background: #fef3e2; color: #b45309; }
.perm-chip.deny { background: #fef2f2; color: #dc2626; }
.perm-chip.allow { background: #ecfdf3; color: #067647; }
.perm-chip:disabled { opacity: .65; cursor: default; }
.empty-tag { color: #98a2b3; font-size: 11.5px; font-weight: 650; }
/* Per-tool approval (Card 3) */
.pertool-head { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.pertool-pager { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b; }
.pg-btn { width: 22px; height: 22px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #475569; }
.pg-btn:disabled { opacity: .4; cursor: default; }
.pg-btn svg { width: 13px; height: 13px; }
.pertool-list { list-style: none; margin: 8px 0 0; padding: 0; min-height: 132px; }
.pertool-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid #f2f4f7; }
.pertool-row:first-child { border-top: 0; }
.pertool-ico { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: #f1f5f9; color: #64748b; flex: 0 0 auto; }
.pertool-ico svg { width: 14px; height: 14px; }
.pertool-name { flex: 1; min-width: 0; }
.pt-label { display: block; font-size: 12px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pt-key { display: block; font-size: 10px; color: #98a2b3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pt-select { width: 138px; height: 30px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 8px; font-size: 12px; background: #fff; }
.pertool-empty { padding: 22px 6px; text-align: center; color: #98a2b3; font-size: 12px; }
.rule-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rule-item { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #334155; }
.rule-item span { flex: 1; }
.rule-item button { border: 0; background: transparent; color: #98a2b3; cursor: pointer; padding: 2px; }
.rule-item button:hover { color: #dc2626; }
.rule-item svg { width: 12px; height: 12px; }
.external-write-row { margin-top: 14px; border-top: 1px solid #f2f4f7; padding-top: 12px; }
.tool-add-row { display: flex; gap: 7px; align-items: center; margin-top: 10px; }
.tool-add-row input { flex: 1; min-width: 0; }
.tool-add-row select { width: 78px; }
.tool-add-row .add-confirm { height: 34px; border: 0; border-radius: 7px; background: #4a47ea; color: #fff; padding: 0 12px; font-size: 12px; font-weight: 850; cursor: pointer; }
.tool-add-row .add-confirm:disabled { opacity: .55; cursor: not-allowed; }
.link-button, .add-rule {
  margin-top: 10px; border: 0; background: transparent; color: #3156e9; padding: 0; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 850;
}
.connector-field, .reviewer-field, .domain-row { display: block; }
.connector-field select, .reviewer-field select { width: 100%; }
.hint { margin-top: 8px; display: flex; align-items: center; gap: 4px; }
.hint strong { color: #3156e9; }
.mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mode-card {
  min-height: 104px; border: 1px solid #d7e1ee; border-radius: 8px; padding: 14px; display: grid; align-content: start; gap: 8px; color: #334155;
}
.mode-card.selected { border-color: #3156e9; background: #f7faff; }
.mode-card input { width: 15px; height: 15px; padding: 0; accent-color: #3156e9; }
.mode-card strong { font-size: 12px; }
.mode-card p { color: #64748b; font-size: 11px; line-height: 1.45; padding-left: 28px; }
.mode-select select { width: 238px; }
.checkbox-row {
  display: flex; gap: 8px; align-items: center; margin-top: 14px; color: #334155; font-size: 12px; font-weight: 750;
}
.checkbox-row input { width: 14px; height: 14px; accent-color: #3156e9; padding: 0; }
.limit-list { display: grid; gap: 10px; }
.limit-list label { display: grid; grid-template-columns: 1fr 150px; align-items: center; gap: 12px; color: #52637a; font-size: 12px; font-weight: 750; }
.limit-list input { width: 100%; }
.domain-row { margin-top: 14px; }
.domain-row div { display: grid; grid-template-columns: 86px 1fr; gap: 8px; }
.escalation-card { margin-top: 12px; }
.escalation-table { display: grid; gap: 8px; }
.table-head, .escalation-row {
  display: grid; grid-template-columns: 1fr 1.05fr 1fr 34px; gap: 10px; align-items: center;
}
.table-head { color: #64748b; font-size: 11px; font-weight: 850; }
.escalation-row select, .email-pill { width: 100%; }
.email-pill {
  min-height: 34px; border: 1px solid #d7e1ee; border-radius: 7px; padding: 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #334155; font-size: 12px; font-weight: 750; background: #fff;
}
.escalation-row button {
  width: 34px; height: 34px; border: 0; background: transparent; color: #64748b;
}
.guardrail-rail { display: grid; gap: 14px; align-content: start; }
.rail-card { padding: 20px; }
.rail-card h2 { font-size: 15px; font-weight: 850; margin-bottom: 14px; }
.about .rail-icon { margin-bottom: 12px; }
.presets > p { margin-bottom: 16px; }
.presets article {
  border: 1px solid #dfe7f2; border-radius: 9px; padding: 16px; margin-bottom: 14px;
}
.presets h3 { color: #3156e9; font-size: 13px; font-weight: 850; margin-bottom: 10px; }
.presets ul { list-style: none; margin: 14px 0 16px; padding: 0; display: grid; gap: 9px; }
.presets li { display: flex; align-items: flex-start; gap: 7px; color: #52637a; font-size: 11px; font-weight: 750; line-height: 1.35; }
.presets li svg { color: #16a34a; width: 13px; height: 13px; flex: 0 0 auto; }
.presets article button {
  width: 100%; height: 36px; border: 0; border-radius: 7px; background: #edeafb; color: #3156e9; font-size: 12px; font-weight: 850;
}
.settings-note { margin-top: 18px; }
.settings-note strong { color: #3156e9; }
@media (max-width: 1320px) {
  .approvals-page { grid-template-columns: 1fr; }
  .guardrail-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1050px) {
  .policy-grid { grid-template-columns: 1fr 1fr; }
  .guardrail-rail { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .approvals-page { padding: 18px; }
  .page-head, .head-actions { flex-direction: column; }
  .head-actions, .ghost, .primary { width: 100%; justify-content: center; }
  .policy-grid, .mode-grid { grid-template-columns: 1fr; }
  .table-head { display: none; }
  .escalation-row { grid-template-columns: 1fr; }
  .limit-list label, .domain-row div { grid-template-columns: 1fr; }
}

/* Reviewer input matches the other field controls */
.reviewer-field input[type="email"] {
  width: 100%; height: 34px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px;
  font-size: 12.5px; color: #1f2a37; background: #fff;
}

/* Audit / usage modal */
.audit-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, .5); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center; z-index: 60; padding: 20px;
}
.audit-modal {
  width: min(720px, 100%); max-height: 84vh; overflow: auto; background: #fff; border-radius: 16px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, .28); padding: 20px 22px;
}
.audit-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.audit-head h2 { margin: 0; font-size: 17px; color: #0f172a; }
.audit-head p { margin: 3px 0 0; font-size: 12.5px; color: #64748b; }
.icon-btn { border: 0; background: #f1f5f9; width: 30px; height: 30px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.audit-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
.audit-stats .stat { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
.audit-stats .stat span { font-size: 11px; color: #64748b; font-weight: 650; }
.audit-stats .stat strong { font-size: 18px; color: #0f172a; }
.audit-list { border: 1px solid #eef2f6; border-radius: 10px; overflow: hidden; }
.audit-row { display: grid; grid-template-columns: 1.6fr .7fr 1.3fr .7fr; gap: 8px; padding: 9px 12px; font-size: 12px; color: #334155; border-top: 1px solid #f1f5f9; }
.audit-row-head { background: #f8fafc; font-weight: 750; color: #64748b; border-top: 0; text-transform: uppercase; font-size: 10.5px; letter-spacing: .03em; }
.audit-row .over-cap { color: #dc2626; font-weight: 800; }
.audit-empty { padding: 18px; text-align: center; color: #98a2b3; font-size: 12.5px; }
.audit-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 12px; color: #64748b; }
@media (max-width: 640px) {
  .audit-stats { grid-template-columns: repeat(2, 1fr); }
  .audit-row { grid-template-columns: 1fr 1fr; }
}
</style>
