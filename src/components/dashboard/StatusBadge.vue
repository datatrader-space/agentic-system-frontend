<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
    :class="cfg.cls"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="cfg.dot" />
    {{ cfg.label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'offline' },
})

const MAP = {
  online:  { label: 'Online',  cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  running: { label: 'Running', cls: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500' },
  idle:    { label: 'Idle',    cls: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500' },
  offline: { label: 'Offline', cls: 'bg-slate-100 text-slate-500',    dot: 'bg-slate-400' },
}
const cfg = computed(() => MAP[props.status] || MAP.offline)
</script>
