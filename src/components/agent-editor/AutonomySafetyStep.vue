<template>
  <div class="mx-auto w-full max-w-[1840px] px-8 pb-10 font-[Inter,system-ui,sans-serif]">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-[21px] font-bold tracking-tight text-[#0F172A]">Configure Autonomy &amp; Safety</h2>
        <p class="mt-1 text-[13.5px] text-[#475569]">Set how your agent works, when it acts, and the boundaries it must follow.</p>
      </div>
      <button class="guide-btn" @click="go('/dashboard/docs?topic=autonomy-safety')">
        <BookOpen :size="16" :stroke-width="2" /> View Autonomy Guide
      </button>
    </div>

    <section class="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <div class="grid gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <div>
          <h3 class="text-[16px] font-semibold text-[#0F172A]">Execution Mode</h3>
          <p class="mt-2 text-[13px] leading-5 text-[#64748B]">Choose how your agent makes decisions and takes action.</p>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <button
            v-for="mode in executionModes"
            :key="mode.key"
            class="mode-card"
            :class="executionMode === mode.key ? 'mode-card-active' : ''"
            @click="selectMode(mode.key)"
          >
            <span class="flex items-start justify-between gap-3">
              <component :is="mode.icon" :size="26" :stroke-width="2" :class="mode.iconClass" />
              <span class="radio-dot" :class="executionMode === mode.key ? 'radio-dot-active' : ''" />
            </span>
            <span class="mt-3 block text-[15px] font-semibold text-[#0F172A]">{{ mode.title }}</span>
            <span class="mt-1 block text-[13px] leading-5 text-[#475569]">{{ mode.desc }}</span>
            <span v-if="mode.recommended" class="mt-3 inline-flex rounded-full bg-[#EAF0FF] px-3 py-1 text-[11px] font-bold text-[#2563EB]">Recommended</span>
          </button>
        </div>
      </div>
    </section>

    <div class="mt-5 grid gap-5 xl:grid-cols-3">
      <section class="config-card">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <ShieldCheck :size="21" :stroke-width="2" />
          </span>
          <div>
            <h3 class="text-[15px] font-semibold text-[#0F172A]">Approval Rules</h3>
            <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">Define when human approval is required.</p>
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <label class="field-row">
            <span>Require approval for</span>
            <select v-model="riskCeiling" class="control">
              <option value="low">Low impact actions</option>
              <option value="medium">Medium impact actions</option>
              <option value="high">High impact actions</option>
              <option value="critical">Critical actions only</option>
            </select>
          </label>
          <label class="field-row">
            <span>Approval from</span>
            <select v-model="approvalGroup" class="control">
              <option>Anyone in Sales Ops</option>
              <option>Workspace admins</option>
              <option>Agent owner</option>
              <option>Any active user</option>
            </select>
          </label>
        </div>

        <button class="link-btn mt-5">View all rules <ChevronRight :size="15" /></button>
      </section>

      <section class="config-card">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck :size="21" :stroke-width="2" />
          </span>
          <div>
            <h3 class="text-[15px] font-semibold text-[#0F172A]">Guardrails</h3>
            <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">Set boundaries the agent must always follow.</p>
          </div>
        </div>

        <div class="mt-5 space-y-3">
          <label v-for="rule in guardrailOptions" :key="rule.key" class="check-row">
            <input v-model="enabledGuardrails" type="checkbox" :value="rule.key" />
            <span>{{ rule.label }}</span>
          </label>
        </div>

        <button class="link-btn mt-5">Manage guardrails <ChevronRight :size="15" /></button>
      </section>

      <section class="config-card">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">
            <CircleDollarSign :size="21" :stroke-width="2" />
          </span>
          <div>
            <h3 class="text-[15px] font-semibold text-[#0F172A]">Spending Limits</h3>
            <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">Control how much the agent can spend.</p>
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <label class="field-row">
            <span>Max per action</span>
            <input v-model="maxCostPerRun" class="control" inputmode="decimal" placeholder="$500.00" />
          </label>
          <label class="field-row">
            <span>Max per day</span>
            <input v-model="dailyBudget" class="control" inputmode="decimal" placeholder="$2,000.00" />
          </label>
        </div>

        <button class="link-btn mt-5">View spend history <ChevronRight :size="15" /></button>
      </section>
    </div>

    <div class="mt-5 grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
      <section class="config-card">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <ClipboardCheck :size="21" :stroke-width="2" />
          </span>
          <div>
            <h3 class="text-[15px] font-semibold text-[#0F172A]">Action Limits</h3>
            <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">Limit how often the agent can take actions.</p>
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <label class="field-row">
            <span>Max actions per run</span>
            <input v-model.number="maxActionsPerRun" class="control" type="number" min="1" />
          </label>
          <label class="field-row">
            <span>Max runs per day</span>
            <input v-model.number="maxRunsPerDay" class="control" type="number" min="1" />
          </label>
        </div>

        <button class="link-btn mt-5">View usage <ChevronRight :size="15" /></button>
      </section>

      <section class="config-card">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Sparkles :size="21" :stroke-width="2" />
          </span>
          <div>
            <h3 class="text-[15px] font-semibold text-[#0F172A]">Autonomy Summary</h3>
            <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">A plain-language summary of how your agent will operate.</p>
          </div>
        </div>

        <div class="mt-4 rounded-xl bg-[#EEF4FF] p-5 text-[13px] leading-6 text-[#344054]">
          <p>Your agent will <strong class="text-[#2563EB]">{{ summaryMode }}</strong>.</p>
          <p>It can spend up to <strong class="text-[#2563EB]">{{ moneyLabel(maxCostPerRun) }}</strong> per action and <strong class="text-[#2563EB]">{{ moneyLabel(dailyBudget) }}</strong> per day.</p>
          <p>It will follow <strong class="text-[#2563EB]">{{ activeGuardrailCount }} guardrails</strong> and ask for approval on <strong class="text-[#0F172A]">{{ riskCeiling }}</strong> impact actions.</p>
          <p>It can take up to <strong class="text-[#2563EB]">{{ maxActionsPerRun || 25 }} actions per run</strong> and <strong class="text-[#2563EB]">{{ maxRunsPerDay || 10 }} runs per day</strong>.</p>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span class="inline-flex items-center gap-2 rounded-lg bg-[#E6F7EE] px-3 py-2 text-[13px] font-semibold text-[#027A48]">
            <CheckCircle2 :size="16" :stroke-width="2.4" /> Configuration looks good
          </span>
          <button class="test-btn" @click="go(`/dashboard/agents/${agent.id}/playground`)">
            <Play :size="15" :stroke-width="2" /> Test these settings
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Hand,
  ListChecks,
  Play,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-vue-next'
import api from '../../services/api'

const props = defineProps({ agent: { type: Object, required: true } })
const router = useRouter()
const go = (to) => router.push(to)

const effectiveGuardrails = ref([])

const executionModes = [
  { key: 'manual', title: 'Manual', desc: 'Agent asks every time before taking action.', icon: Hand, iconClass: 'text-violet-600' },
  { key: 'assisted', title: 'Plan First', desc: 'Agent plans, shows steps for approval, then acts.', icon: ListChecks, iconClass: 'text-[#2563EB]', recommended: true },
  { key: 'autonomous', title: 'Auto', desc: 'Agent acts automatically within defined guardrails.', icon: Zap, iconClass: 'text-emerald-600' },
]
const guardrailOptions = [
  { key: 'no_external_email', label: 'Do not send external emails' },
  { key: 'no_pricing_changes', label: 'Do not modify pricing' },
  { key: 'respect_privacy', label: 'Respect data privacy policies' },
]

const policy = computed({
  get() {
    if (!props.agent.agent_policy || typeof props.agent.agent_policy !== 'object' || Array.isArray(props.agent.agent_policy)) {
      props.agent.agent_policy = {}
    }
    return props.agent.agent_policy
  },
  set(value) {
    props.agent.agent_policy = value
  },
})

const executionMode = computed({
  get: () => props.agent.execution_mode || (props.agent.plan_mode_enabled ? 'assisted' : 'manual'),
  set: (value) => {
    props.agent.execution_mode = value
    props.agent.plan_mode_enabled = value === 'assisted'
    props.agent.plan_approval_required = value !== 'autonomous'
  },
})
const riskCeiling = computed({
  get: () => policy.value.risk_ceiling || 'high',
  set: (value) => { policy.value = { ...policy.value, risk_ceiling: value } },
})
const approvalGroup = computed({
  get: () => policy.value.approval_group || 'Anyone in Sales Ops',
  set: (value) => { policy.value = { ...policy.value, approval_group: value } },
})
const enabledGuardrails = computed({
  get: () => policy.value.guardrails || guardrailOptions.map(g => g.key),
  set: (value) => { policy.value = { ...policy.value, guardrails: value } },
})
const maxCostPerRun = computed({
  get: () => formatMoneyInput(props.agent.max_cost_per_run_usd ?? '500.00'),
  set: (value) => { props.agent.max_cost_per_run_usd = parseMoney(value) },
})
const dailyBudget = computed({
  get: () => formatMoneyInput(props.agent.daily_budget_usd ?? '2000.00'),
  set: (value) => { props.agent.daily_budget_usd = parseMoney(value) },
})
const maxActionsPerRun = computed({
  get: () => policy.value.max_actions_per_run ?? 25,
  set: (value) => { policy.value = { ...policy.value, max_actions_per_run: Number(value) || 25 } },
})
const maxRunsPerDay = computed({
  get: () => policy.value.max_runs_per_day ?? 10,
  set: (value) => { policy.value = { ...policy.value, max_runs_per_day: Number(value) || 10 } },
})
const activeGuardrailCount = computed(() => Math.max(enabledGuardrails.value.length, effectiveGuardrails.value.length))
const summaryMode = computed(() => {
  if (executionMode.value === 'autonomous') return 'act automatically within guardrails'
  if (executionMode.value === 'assisted') return 'plan before acting and wait for approval'
  return 'ask before every action'
})

function selectMode(value) {
  executionMode.value = value
}
function parseMoney(value) {
  const n = Number(String(value).replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n.toFixed(2) : null
}
function formatMoneyInput(value) {
  if (value === null || value === undefined || value === '') return ''
  return String(value).startsWith('$') ? String(value) : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function moneyLabel(value) {
  return value || '$0.00'
}
async function loadGuardrails() {
  if (!props.agent.id) return
  try {
    const res = await api.getAgentGuardrails(props.agent.id)
    effectiveGuardrails.value = res.data?.guardrails || []
  } catch (e) {
    effectiveGuardrails.value = []
  }
}

watch(() => props.agent.id, loadGuardrails)
onMounted(loadGuardrails)
</script>

<style scoped>
.guide-btn { display: inline-flex; align-items: center; gap: 8px; height: 42px; border: 1px solid #D9E0EA; border-radius: 10px; background: #fff; padding: 0 16px; font-size: 13px; font-weight: 700; color: #344054; box-shadow: 0 1px 2px rgba(16,24,40,.03); }
.mode-card { min-height: 142px; border: 1px solid #E5E7EB; border-radius: 12px; background: #fff; padding: 20px; text-align: left; transition: border-color .15s, box-shadow .15s, background .15s; }
.mode-card:hover { border-color: #BFD0FF; box-shadow: 0 8px 20px rgba(16,24,40,.06); }
.mode-card-active { border-color: #2563EB; box-shadow: 0 0 0 1px #2563EB, 0 10px 24px rgba(37,99,235,.08); }
.radio-dot { height: 17px; width: 17px; border-radius: 999px; border: 1.5px solid #98A2B3; background: #fff; }
.radio-dot-active { border: 5px solid #2563EB; }
.config-card { border: 1px solid #E5E7EB; border-radius: 12px; background: #fff; padding: 20px; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
.field-row { display: grid; grid-template-columns: minmax(120px, .78fr) minmax(0, 1.22fr); align-items: center; gap: 16px; font-size: 13px; font-weight: 500; color: #475569; }
.control { height: 38px; width: 100%; border: 1px solid #D0D5DD; border-radius: 8px; background: #fff; padding: 0 12px; font-size: 13px; font-weight: 600; color: #344054; outline: none; box-shadow: 0 1px 2px rgba(16,24,40,.03); }
.control:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
.check-row { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 500; color: #475569; }
.check-row input { height: 16px; width: 16px; accent-color: #12B76A; }
.link-btn { display: inline-flex; align-items: center; gap: 5px; color: #2563EB; font-size: 13px; font-weight: 700; }
.test-btn { display: inline-flex; align-items: center; gap: 7px; height: 40px; border: 1px solid #D9E0EA; border-radius: 10px; background: #fff; padding: 0 16px; color: #2563EB; font-size: 13px; font-weight: 700; }
@media (max-width: 720px) {
  .field-row { grid-template-columns: 1fr; gap: 7px; }
}
</style>
