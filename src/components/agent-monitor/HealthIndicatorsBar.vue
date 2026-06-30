<template>
  <div class="rounded-2xl border border-[#E5E7EB] bg-white p-[18px] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold text-[#0F172A]">Health Indicators</h2>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div
        v-for="ind in indicators"
        :key="ind.key"
        class="flex items-center gap-2.5 rounded-xl border border-[#F2F4F7] bg-slate-50/60 px-3 py-2.5"
      >
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="dotClass(ind.level)" />
        <div class="min-w-0">
          <p class="truncate text-[12px] font-medium text-[#64748B]">{{ ind.label }}</p>
          <p class="truncate text-[14px] font-bold text-[#0F172A]">{{ ind.value }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // { error_rate, avg_latency_ms, last_run_at, status }
  health: { type: Object, default: () => ({}) },
})

function level(metric, val) {
  if (val == null) return 'idle'
  if (metric === 'error_rate') return val > 20 ? 'bad' : val > 5 ? 'warn' : 'good'
  if (metric === 'latency') return val > 8000 ? 'bad' : val > 3000 ? 'warn' : 'good'
  return 'good'
}

function dotClass(lvl) {
  return {
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
    idle: 'bg-slate-300',
  }[lvl] || 'bg-slate-300'
}

function ago(iso) {
  if (!iso) return 'never'
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

const indicators = computed(() => {
  const h = props.health || {}
  const err = h.error_rate
  const lat = h.avg_latency_ms
  return [
    {
      key: 'status',
      label: 'Overall',
      value: (h.status || 'unknown').replace(/^\w/, (c) => c.toUpperCase()),
      level: h.status === 'healthy' ? 'good' : h.status === 'degraded' ? 'warn' : h.status === 'down' ? 'bad' : 'idle',
    },
    { key: 'err', label: 'Error Rate', value: err != null ? `${err}%` : '—', level: level('error_rate', err) },
    { key: 'lat', label: 'Avg Latency', value: lat != null ? `${lat} ms` : '—', level: level('latency', lat) },
    { key: 'last', label: 'Last Run', value: ago(h.last_run_at), level: h.last_run_at ? 'good' : 'idle' },
  ]
})
</script>
