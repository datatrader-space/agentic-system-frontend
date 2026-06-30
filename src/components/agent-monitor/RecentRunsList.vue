<template>
  <div class="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-[18px] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <div class="mb-1 flex items-center justify-between">
      <h2 class="text-base font-semibold text-[#0F172A]">Recent Runs</h2>
      <span class="text-[12px] text-[#64748B]">{{ runs.length }}</span>
    </div>

    <ul v-if="loading" class="flex-1">
      <li v-for="n in 5" :key="n" class="border-b border-[#F2F4F7] py-3 last:border-0">
        <div class="h-8 w-full animate-pulse rounded bg-slate-100" />
      </li>
    </ul>

    <ul v-else-if="runs.length" class="flex-1">
      <li
        v-for="run in runs"
        :key="run.id"
        class="flex items-center gap-3 border-b border-[#F2F4F7] px-1 py-2.5 last:border-0"
      >
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
          :class="run.status === 'error' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'">
          <component :is="run.status === 'error' ? AlertTriangle : CheckCircle2" :size="15" :stroke-width="2.1" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13.5px] font-semibold text-[#0F172A]">
            {{ run.status === 'error' ? 'Run failed' : 'Run completed' }}
          </p>
          <p class="truncate text-xs text-[#64748B]">
            {{ run.model || run.request_source || 'chat' }}
            <span v-if="run.latency_ms != null"> · {{ run.latency_ms }} ms</span>
          </p>
        </div>
        <span class="shrink-0 whitespace-nowrap text-[11.5px] text-slate-400">{{ ago(run.created_at) }}</span>
      </li>
    </ul>

    <div v-else class="flex-1 py-7 text-center text-[13px] text-[#64748B]">No runs yet.</div>
  </div>
</template>

<script setup>
import { CheckCircle2, AlertTriangle } from 'lucide-vue-next'
import { ago } from '../dashboard/time'

defineProps({
  runs: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
</script>
