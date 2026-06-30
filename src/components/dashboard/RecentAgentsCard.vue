<template>
  <div class="flex min-h-[338px] flex-col rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold text-[#0F172A]">Recent Agents</h2>
      <button class="text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]" @click="$emit('view-all')">View all</button>
    </div>

    <ul v-if="loading" class="flex-1">
      <li v-for="n in 4" :key="n" class="border-b border-[#F2F4F7] py-3 last:border-0">
        <div class="h-9 w-full animate-pulse rounded bg-slate-100" />
      </li>
    </ul>

    <ul v-else-if="agents.length" class="flex-1">
      <li
        v-for="(a, i) in agents"
        :key="a.id"
        class="flex cursor-pointer items-center gap-3 rounded-xl border-b border-[#F2F4F7] px-1.5 py-3 last:border-0 hover:bg-slate-50"
        @click="$emit('open', a)"
      >
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" :class="visual(i).tint">
          <component :is="visual(i).icon" :size="18" :stroke-width="2" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13.5px] font-semibold text-[#0F172A]">{{ a.name }}</p>
          <p class="truncate text-xs text-[#64748B]">{{ a.description || 'No description' }}</p>
        </div>
        <StatusBadge :status="a.status" />
        <span class="shrink-0 whitespace-nowrap text-[11.5px] text-slate-400">{{ ago(a.last_active || a.updated_at) }}</span>
      </li>
    </ul>

    <div v-else class="flex-1 py-7 text-center text-[13px] text-[#64748B]">
      <p class="mb-2">No agents yet.</p>
      <button class="font-semibold text-[#2563EB]" @click="$emit('create')">Create your first agent</button>
    </div>

    <div class="mt-3 border-t border-[#F2F4F7] pt-3">
      <button
        class="inline-flex items-center gap-1.5 rounded-[11px] border border-[#E5E7EB] px-3.5 py-2 text-[13px] font-semibold text-[#2563EB] hover:border-blue-200 hover:bg-blue-50"
        @click="$emit('view-all')"
      >
        <Users :size="15" :stroke-width="2" />
        Manage all agents
      </button>
    </div>
  </div>
</template>

<script setup>
import { PenLine, Search, BarChart3, Headphones, Bot, Users } from 'lucide-vue-next'
import StatusBadge from './StatusBadge.vue'
import { ago } from './time'

defineProps({
  agents: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
defineEmits(['view-all', 'open', 'create'])

// Decorative colored icon tiles cycled per row (agents carry no stored type/icon).
const VISUALS = [
  { icon: PenLine,    tint: 'bg-teal-50 text-teal-600' },
  { icon: Search,     tint: 'bg-violet-50 text-violet-600' },
  { icon: BarChart3,  tint: 'bg-red-50 text-red-500' },
  { icon: Headphones, tint: 'bg-slate-100 text-slate-600' },
  { icon: Bot,        tint: 'bg-blue-50 text-blue-600' },
]
const visual = (i) => VISUALS[i % VISUALS.length]
</script>
