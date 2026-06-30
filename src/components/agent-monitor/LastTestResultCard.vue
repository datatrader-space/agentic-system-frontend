<template>
  <div class="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-[18px] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold text-[#0F172A]">Last Test Result</h2>
      <StatusBadge v-if="result" :status="result.status === 'error' ? 'offline' : 'online'" />
    </div>

    <div v-if="!result" class="flex-1 py-7 text-center text-[13px] text-[#64748B]">
      No runs yet. Use Quick Test to send a message.
    </div>

    <div v-else class="flex-1">
      <div class="mb-3 flex items-center gap-2.5">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
          :class="result.status === 'error' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'">
          <component :is="result.status === 'error' ? AlertTriangle : CheckCircle2" :size="18" :stroke-width="2.1" />
        </span>
        <div class="min-w-0">
          <p class="truncate text-[14px] font-semibold text-[#0F172A]">
            {{ result.status === 'error' ? 'Last run failed' : 'Last run succeeded' }}
          </p>
          <p class="truncate text-xs text-[#64748B]">{{ result.model || result.request_source || 'chat' }} · {{ ago(result.created_at) }}</p>
        </div>
      </div>

      <dl class="grid grid-cols-2 gap-2 text-[13px]">
        <div class="rounded-xl bg-slate-50 px-3 py-2">
          <dt class="text-[11px] uppercase tracking-wide text-[#94A3B8]">Latency</dt>
          <dd class="mt-0.5 font-bold text-[#0F172A]">{{ result.latency_ms != null ? result.latency_ms + ' ms' : '—' }}</dd>
        </div>
        <div class="rounded-xl bg-slate-50 px-3 py-2">
          <dt class="text-[11px] uppercase tracking-wide text-[#94A3B8]">Cost</dt>
          <dd class="mt-0.5 font-bold text-[#0F172A]">${{ (result.cost_estimate || 0).toFixed(4) }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>

<script setup>
import { CheckCircle2, AlertTriangle } from 'lucide-vue-next'
import StatusBadge from '../dashboard/StatusBadge.vue'
import { ago } from '../dashboard/time'

defineProps({
  result: { type: Object, default: null },
})
</script>
