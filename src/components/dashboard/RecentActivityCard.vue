<template>
  <div class="flex min-h-[338px] flex-col rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold text-[#0F172A]">Recent Activity</h2>
      <button class="text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]" @click="$emit('view-all')">View all</button>
    </div>

    <ul v-if="loading" class="flex-1">
      <li v-for="n in 5" :key="n" class="border-b border-[#F2F4F7] py-3 last:border-0">
        <div class="h-9 w-full animate-pulse rounded bg-slate-100" />
      </li>
    </ul>

    <ul v-else-if="activities.length" class="flex-1">
      <li
        v-for="(ev, i) in activities"
        :key="ev.id"
        class="flex items-center gap-3 border-b border-[#F2F4F7] px-1.5 py-3 last:border-0"
      >
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" :class="ev.status === 'error' ? 'bg-red-50 text-red-500' : visual(i).tint">
          <component :is="ev.status === 'error' ? AlertTriangle : visual(i).icon" :size="15" :stroke-width="2.1" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13.5px] font-semibold text-[#0F172A]">{{ title(ev) }}</p>
          <p class="truncate text-xs text-[#64748B]">{{ ev.model || ev.request_source || 'chat' }}</p>
        </div>
        <span class="shrink-0 whitespace-nowrap text-[11.5px] text-slate-400">{{ ago(ev.created_at) }}</span>
      </li>
    </ul>

    <div v-else class="flex-1 py-7 text-center text-[13px] text-[#64748B]">No recent activity.</div>
  </div>
</template>

<script setup>
import { CheckCircle2, Search, BarChart3, Workflow, Headphones, AlertTriangle } from 'lucide-vue-next'
import { ago } from './time'

defineProps({
  activities: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
defineEmits(['view-all'])

const VISUALS = [
  { icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600' },
  { icon: Search,       tint: 'bg-violet-50 text-violet-600' },
  { icon: BarChart3,    tint: 'bg-red-50 text-red-500' },
  { icon: Workflow,     tint: 'bg-teal-50 text-teal-600' },
  { icon: Headphones,   tint: 'bg-slate-100 text-slate-600' },
]
const visual = (i) => VISUALS[i % VISUALS.length]

const title = (ev) => ev.title || (ev.agent_name ? `${ev.agent_name} ran` : 'LLM request')
</script>
