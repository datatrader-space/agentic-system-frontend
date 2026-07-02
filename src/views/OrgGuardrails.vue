<template>
  <div class="ag">
    <header class="ag-head">
      <div>
        <h1>Organization Guardrails &amp; Approvals</h1>
        <p>Rules for <strong>every agent in {{ pol.organization_name || 'your organization' }}</strong>.
           These can only make the platform safety floor <strong>stricter</strong>, never weaker — and each
           agent can then only tighten them further.</p>
      </div>
      <div class="ag-head-actions">
        <button class="ag-toggle" :class="pol.enabled ? 'on' : 'off'" :disabled="!canEdit || saving"
                @click="pol.enabled = !pol.enabled; mark()">
          <span class="ag-toggle-dot"></span>
          {{ pol.enabled ? 'Policy enabled' : 'Policy disabled' }}
        </button>
        <button class="ag-save" :disabled="!canEdit || saving || !dirty" @click="save">
          {{ saving ? 'Saving…' : 'Save policy' }}
        </button>
      </div>
    </header>

    <div v-if="!canEdit" class="ag-note warn">
      You have <strong>read-only</strong> access. Only an organization <strong>owner or admin</strong> can change this policy.
    </div>
    <div v-else-if="!pol.enabled" class="ag-note">
      This organization policy is <strong>disabled</strong> — its rules are not applied. Enable it to add a floor for every agent in the org.
    </div>

    <div v-if="loading" class="ag-loading">Loading policy…</div>

    <div v-else class="ag-grid">
      <section class="ag-card">
        <h2>Approval floor</h2>
        <p class="ag-sub">Baseline approval + external-write rules for every agent in the org.</p>
        <label class="ag-row">
          <span>Require approval for actions above</span>
          <select v-model="pol.risk_ceiling" :disabled="!canEdit" @change="mark">
            <option value="">Inherit platform ceiling</option>
            <option value="low">Low impact</option>
            <option value="medium">Medium impact</option>
            <option value="high">High impact</option>
            <option value="critical">Critical only</option>
          </select>
        </label>
        <label class="ag-row">
          <span>Allow external writes</span>
          <button :class="['ag-switch', { on: pol.allow_external_write }]" type="button"
                  :disabled="!canEdit" @click="pol.allow_external_write = !pol.allow_external_write; mark()"><i /></button>
        </label>
      </section>

      <section class="ag-card">
        <h2>Tool-call budget</h2>
        <p class="ag-sub">Anti-runaway limits for org agents.</p>
        <label class="ag-row">
          <span>Soft budget (tool calls / turn)</span>
          <input type="number" min="1" v-model.number="pol.tool_call_budget" :disabled="!canEdit" @input="mark" />
        </label>
        <label class="ag-row">
          <span>On budget exceeded</span>
          <select v-model="pol.on_budget_exceeded" :disabled="!canEdit" @change="mark">
            <option value="ask_llm">Ask the LLM to decide</option>
            <option value="ask_user">Ask the user</option>
            <option value="force_conclude">Force conclude</option>
            <option value="continue">Continue</option>
          </select>
        </label>
        <label class="ag-row">
          <span>Hard cap (tool calls / turn)</span>
          <input type="number" min="1" v-model.number="pol.max_tool_calls_hard" :disabled="!canEdit" @input="mark" />
        </label>
      </section>

      <section class="ag-card">
        <h2>Behavioral guardrails</h2>
        <p class="ag-sub">Injected into every org agent's system prompt as non-negotiable rules.</p>
        <ul class="ag-list">
          <li v-for="(g, i) in pol.guardrails" :key="i">
            <span>{{ g }}</span>
            <button v-if="canEdit" @click="removeGuardrail(i)">✕</button>
          </li>
          <li v-if="!pol.guardrails.length" class="ag-empty">No org guardrails.</li>
        </ul>
        <div v-if="canEdit" class="ag-add">
          <input v-model="newGuardrail" placeholder="e.g. Never email customers without approval" @keyup.enter="addGuardrail" />
          <button @click="addGuardrail">Add</button>
        </div>
      </section>

      <section class="ag-card">
        <h2>Blocked tools</h2>
        <p class="ag-sub">Tools no agent in the org may run (added to the platform denylist).</p>
        <div class="ag-chips">
          <button v-for="t in pol.forbidden_tools" :key="t" class="ag-chip deny" :disabled="!canEdit" @click="removeForbidden(t)">
            {{ t }} <span v-if="canEdit">✕</span>
          </button>
          <span v-if="!pol.forbidden_tools.length" class="ag-empty">None.</span>
        </div>
        <div v-if="canEdit" class="ag-add">
          <input v-model="newForbidden" placeholder="TOOL_NAME" @keyup.enter="addForbidden" />
          <button @click="addForbidden">Add</button>
        </div>
      </section>

      <section class="ag-card ag-card-wide">
        <h2>Tool permission rules</h2>
        <p class="ag-sub">Force <strong>ask</strong> (approval) or <strong>deny</strong> for specific tools across the org.
           Agents can tighten these (deny &gt; ask &gt; allow) but never loosen them.</p>
        <div class="ag-chips">
          <button v-for="t in permTags" :key="t.tool" :class="['ag-chip', t.perm]" :disabled="!canEdit" @click="removeToolPerm(t.tool)">
            {{ t.tool }} · {{ t.perm }} <span v-if="canEdit">✕</span>
          </button>
          <span v-if="!permTags.length" class="ag-empty">No tool rules — all tools allowed by default.</span>
        </div>
        <div v-if="canEdit" class="ag-add">
          <input v-model="newTool" placeholder="TOOL_NAME" @keyup.enter="addToolPerm" />
          <select v-model="newToolPerm">
            <option value="ask">Ask</option>
            <option value="deny">Deny</option>
            <option value="allow">Allow</option>
          </select>
          <button @click="addToolPerm">Add</button>
        </div>
      </section>

      <section class="ag-card ag-card-wide">
        <h2>LLM defaults &amp; limits</h2>
        <p class="ag-sub">Default context profile and token/image ceilings for every agent in the org. These can
           only tighten the platform limits — a value above the platform ceiling is rejected.</p>
        <OrgLlmDefaults v-model="pol.llm_policy" :platform="platformLlm" :absolute="llmAbsolute"
                        :preview="llmPreview" :errors="llmErrors" :disabled="!canEdit" @change="mark" />
      </section>
    </div>

    <p v-if="pol.updated_at" class="ag-updated">Last updated {{ new Date(pol.updated_at).toLocaleString() }}</p>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import OrgLlmDefaults from '../components/org/OrgLlmDefaults.vue'

const loading = ref(true)
const saving = ref(false)
const dirty = ref(false)
const canEdit = ref(false)

const pol = reactive({
  organization_id: null, organization_name: '',
  enabled: true, risk_ceiling: '', allow_external_write: true,
  tool_call_budget: 4, on_budget_exceeded: 'ask_llm', max_tool_calls_hard: 25,
  forbidden_tools: [], guardrails: [], tool_permissions: {}, llm_policy: {}, updated_at: null,
})
const platformLlm = ref({})   // platform ceilings (read-only)
const llmAbsolute = ref({})   // ABSOLUTE_* code guards (read-only)
const llmPreview = ref(null)  // resolved effective policy + sources
const llmErrors = ref({})     // per-key validation errors from the API
const permTags = computed(() => Object.entries(pol.tool_permissions).map(([tool, perm]) => ({ tool, perm })))
const newGuardrail = ref('')
const newForbidden = ref('')
const newTool = ref('')
const newToolPerm = ref('ask')

function mark() { dirty.value = true }

function apply(d) {
  d = d || {}
  pol.organization_id = d.organization_id ?? null
  pol.organization_name = d.organization_name || ''
  pol.enabled = d.enabled !== false
  pol.risk_ceiling = d.risk_ceiling || ''
  pol.allow_external_write = d.allow_external_write !== false
  pol.tool_call_budget = d.tool_call_budget ?? 4
  pol.on_budget_exceeded = d.on_budget_exceeded || 'ask_llm'
  pol.max_tool_calls_hard = d.max_tool_calls_hard ?? 25
  pol.forbidden_tools = Array.isArray(d.forbidden_tools) ? [...d.forbidden_tools] : []
  pol.guardrails = Array.isArray(d.guardrails) ? [...d.guardrails] : []
  pol.tool_permissions = d.tool_permissions && typeof d.tool_permissions === 'object' ? { ...d.tool_permissions } : {}
  pol.llm_policy = d.llm_policy && typeof d.llm_policy === 'object' ? { ...d.llm_policy } : {}
  platformLlm.value = d.platform_llm_policy && typeof d.platform_llm_policy === 'object' ? { ...d.platform_llm_policy } : {}
  llmAbsolute.value = d.llm_policy_absolute && typeof d.llm_policy_absolute === 'object' ? { ...d.llm_policy_absolute } : {}
  llmPreview.value = d.llm_policy_preview || null
  llmErrors.value = {}
  pol.updated_at = d.updated_at || null
  canEdit.value = !!d.can_edit
  dirty.value = false
}

async function load() {
  loading.value = true
  try { apply((await api.getOrgAgentPolicy()).data) }
  catch (e) { notify.error('Failed to load the organization policy') }
  finally { loading.value = false }
}

function addGuardrail() {
  const g = newGuardrail.value.trim(); newGuardrail.value = ''
  if (!g) return
  pol.guardrails = [...pol.guardrails, g]; mark()
}
function removeGuardrail(i) { const c = [...pol.guardrails]; c.splice(i, 1); pol.guardrails = c; mark() }
function addForbidden() {
  const t = newForbidden.value.trim().toUpperCase(); newForbidden.value = ''
  if (!t || pol.forbidden_tools.includes(t)) return
  pol.forbidden_tools = [...pol.forbidden_tools, t]; mark()
}
function removeForbidden(t) { pol.forbidden_tools = pol.forbidden_tools.filter(x => x !== t); mark() }
function addToolPerm() {
  const t = newTool.value.trim().toUpperCase(); newTool.value = ''
  if (!t) return
  pol.tool_permissions = { ...pol.tool_permissions, [t]: newToolPerm.value }; mark()
}
function removeToolPerm(tool) { const tp = { ...pol.tool_permissions }; delete tp[tool]; pol.tool_permissions = tp; mark() }

async function save() {
  if (!canEdit.value || saving.value) return
  saving.value = true
  llmErrors.value = {}
  try {
    const r = await api.updateOrgAgentPolicy({
      organization_id: pol.organization_id,
      enabled: pol.enabled, risk_ceiling: pol.risk_ceiling, allow_external_write: pol.allow_external_write,
      tool_call_budget: pol.tool_call_budget, on_budget_exceeded: pol.on_budget_exceeded,
      max_tool_calls_hard: pol.max_tool_calls_hard, forbidden_tools: pol.forbidden_tools,
      guardrails: pol.guardrails, tool_permissions: pol.tool_permissions,
      llm_policy: pol.llm_policy,
    })
    apply(r.data)
    notify.success('Organization policy saved')
  } catch (e) {
    // The API returns { llm_policy: { key: message } } (or a list) on a 400 for LLM-limit violations.
    const lp = e.response?.status === 400 ? e.response?.data?.llm_policy : null
    if (lp) {
      llmErrors.value = Array.isArray(lp) ? { _: lp.join(' ') } : lp
      notify.error('Some LLM limits are invalid — they must not exceed the platform ceiling.')
    } else {
      notify.error(e.response?.status === 403 ? 'Only an organization owner/admin can change this policy' : 'Failed to save policy')
    }
  } finally { saving.value = false }
}

onMounted(load)
</script>

<style scoped>
.ag { max-width: 1100px; margin: 0 auto; padding: 24px 24px 48px; color: #0f172a; }
.ag-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin-bottom: 18px; }
.ag-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.ag-head p { margin: 6px 0 0; max-width: 740px; font-size: 13px; line-height: 1.55; color: #64748b; }
.ag-head-actions { display: flex; gap: 10px; align-items: center; }
.ag-toggle { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 8px; padding: 9px 14px; font-size: 12.5px; font-weight: 750; cursor: pointer; }
.ag-toggle.on { background: #ecfdf3; color: #067647; }
.ag-toggle.off { background: #fef2f2; color: #dc2626; }
.ag-toggle-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.ag-save { border: 0; border-radius: 8px; padding: 9px 16px; font-size: 12.5px; font-weight: 750; cursor: pointer; background: #4f46e5; color: #fff; }
.ag-save:disabled { opacity: .5; cursor: not-allowed; }
.ag-note { border-radius: 10px; padding: 11px 14px; font-size: 12.5px; margin-bottom: 16px; background: #f1f5f9; color: #475569; }
.ag-note.warn { background: #fffbeb; color: #92400e; }
.ag-loading { padding: 40px; text-align: center; color: #98a2b3; }
.ag-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ag-card { border: 1px solid #e5e7eb; border-radius: 14px; background: #fff; padding: 18px; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
.ag-card-wide { grid-column: 1 / -1; }
.ag-card h2 { margin: 0; font-size: 15px; font-weight: 700; }
.ag-sub { margin: 4px 0 14px; font-size: 12px; line-height: 1.5; color: #64748b; }
.ag-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; font-size: 12.5px; font-weight: 650; color: #334155; }
.ag-row select, .ag-row input { height: 34px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: 12.5px; background: #fff; min-width: 170px; }
.ag-switch { width: 40px; height: 22px; border-radius: 999px; border: 0; background: #e5e7eb; position: relative; cursor: pointer; transition: background .15s; }
.ag-switch.on { background: #4f46e5; }
.ag-switch i { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; }
.ag-switch.on i { transform: translateX(18px); }
.ag-switch:disabled { opacity: .6; cursor: default; }
.ag-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.ag-list li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: #334155; }
.ag-list li span { flex: 1; }
.ag-list li button { border: 0; background: transparent; color: #98a2b3; cursor: pointer; font-size: 13px; }
.ag-list li button:hover { color: #dc2626; }
.ag-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.ag-chip { height: 27px; border: 0; border-radius: 7px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 750; cursor: pointer; background: #f1f5f9; color: #334155; }
.ag-chip.ask { background: #fef3e2; color: #b45309; }
.ag-chip.deny { background: #fef2f2; color: #dc2626; }
.ag-chip.allow { background: #ecfdf3; color: #067647; }
.ag-chip:disabled { cursor: default; opacity: .8; }
.ag-empty { color: #98a2b3; font-size: 12px; font-weight: 650; }
.ag-add { display: flex; gap: 7px; margin-top: 12px; }
.ag-add input { flex: 1; min-width: 0; height: 34px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: 12.5px; }
.ag-add select { height: 34px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 8px; font-size: 12.5px; background: #fff; }
.ag-add button { border: 0; border-radius: 8px; padding: 0 14px; background: #0f172a; color: #fff; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.ag-updated { margin-top: 16px; font-size: 11.5px; color: #98a2b3; }
@media (max-width: 900px) { .ag-grid { grid-template-columns: 1fr; } }
</style>
