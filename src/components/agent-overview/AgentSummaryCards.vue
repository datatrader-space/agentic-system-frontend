<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <router-link
      v-for="card in cards"
      :key="card.key"
      :to="card.to"
      class="group block rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] transition hover:border-slate-300 hover:shadow-md"
    >
      <div class="flex items-start gap-3.5">
        <span
          class="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
          :class="card.tint"
        >
          <component :is="card.icon" :size="22" :stroke-width="2" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[13px] font-medium text-[#64748B]">{{ card.label }}</p>
            <ChevronRight
              :size="16"
              class="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-400"
            />
          </div>

          <template v-if="loading">
            <p class="mt-1 h-6 w-24 animate-pulse rounded bg-slate-100" />
          </template>
          <template v-else>
            <p class="mt-0.5 truncate text-[17px] font-bold leading-snug tracking-tight text-[#0F172A]" :title="card.value">
              {{ card.value }}
            </p>
            <p v-if="card.sub" class="mt-0.5 truncate text-[12px] text-[#94A3B8]">{{ card.sub }}</p>
            <StatusBadge v-if="card.badge" :status="card.badge" class="mt-1.5" />
          </template>
        </div>
      </div>
    </router-link>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  ChevronRight, Target, BookOpen, Wrench, KeyRound, ShieldCheck, FlaskConical,
} from 'lucide-vue-next'
import StatusBadge from '../dashboard/StatusBadge.vue'

const props = defineProps({
  agent: { type: Object, default: () => ({}) },
  credentialCount: { type: Number, default: 0 },
  lastTest: { type: Object, default: null }, // { status: 'passed'|'failed', at: Date }
  loading: { type: Boolean, default: false },
})

const configureBase = computed(() => `/dashboard/agents/${props.agent?.id ?? ''}/editor`)

const toolCount = computed(() => {
  const tools = Array.isArray(props.agent?.tools) ? props.agent.tools.length : 0
  const bundles = Array.isArray(props.agent?.tool_bundles) ? props.agent.tool_bundles.length : 0
  return tools + bundles
})

const knowledgeCount = computed(() =>
  Array.isArray(props.agent?.knowledge_files) ? props.agent.knowledge_files.length : 0,
)

const autonomyLabel = computed(() => {
  const mode = props.agent?.execution_mode || 'manual'
  return mode.charAt(0).toUpperCase() + mode.slice(1)
})

const lastTestValue = computed(() => {
  if (!props.lastTest) return 'Not tested yet'
  return props.lastTest.status === 'failed' ? 'Failed' : 'Passed'
})

const cards = computed(() => [
  {
    key: 'purpose',
    label: 'Purpose',
    icon: Target,
    tint: 'bg-blue-50 text-blue-600',
    value: props.agent?.name || 'Untitled Agent',
    sub: props.agent?.description || 'No description set',
    to: configureBase.value,
  },
  {
    key: 'knowledge',
    label: 'Knowledge',
    icon: BookOpen,
    tint: 'bg-violet-50 text-violet-600',
    value: knowledgeCount.value
      ? `${knowledgeCount.value} source${knowledgeCount.value === 1 ? '' : 's'}`
      : 'No knowledge',
    sub: props.agent?.knowledge_scope ? `Scope: ${props.agent.knowledge_scope}` : 'Add files or pages',
    to: `${configureBase.value}?step=knowledge`,
  },
  {
    key: 'tools',
    label: 'Tools',
    icon: Wrench,
    tint: 'bg-amber-50 text-amber-600',
    value: toolCount.value
      ? `${toolCount.value} action${toolCount.value === 1 ? '' : 's'}`
      : 'No actions',
    sub: 'Connected capabilities',
    to: `${configureBase.value}?step=actions`,
  },
  {
    key: 'credentials',
    label: 'Credentials',
    icon: KeyRound,
    tint: 'bg-emerald-50 text-emerald-600',
    value: props.credentialCount
      ? `${props.credentialCount} connected`
      : 'None connected',
    sub: 'Service & API keys',
    to: `${configureBase.value}?step=credentials`,
  },
  {
    key: 'autonomy',
    label: 'Autonomy',
    icon: ShieldCheck,
    tint: 'bg-indigo-50 text-indigo-600',
    value: autonomyLabel.value,
    sub: props.agent?.plan_mode_enabled ? 'Plan mode on' : 'Direct execution',
    to: `${configureBase.value}?step=autonomy`,
  },
  {
    key: 'last-test',
    label: 'Last Test',
    icon: FlaskConical,
    tint: 'bg-rose-50 text-rose-600',
    value: lastTestValue.value,
    sub: props.lastTest ? formatTime(props.lastTest.at) : 'Run a quick test',
    badge: props.lastTest ? (props.lastTest.status === 'failed' ? 'offline' : 'online') : null,
    to: configureBase.value,
  },
])

function formatTime(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
</script>
