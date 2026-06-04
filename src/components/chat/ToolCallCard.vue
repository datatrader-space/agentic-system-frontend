<template>
  <div class="tool-call" :class="status">
    <span class="tc-icon">
      <svg v-if="status === 'running'" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.22-8.56" stroke-linecap="round" /></svg>
      <svg v-else-if="status === 'done'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" /></svg>
    </span>
    <span class="tc-label">
      <span class="tc-verb">{{ verb }}</span>
      <code class="tc-name">{{ name }}</code>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  status: { type: String, default: 'running' }, // running | done | error
})

const verb = computed(() => {
  if (props.status === 'done') return 'Ran tool'
  if (props.status === 'error') return 'Tool failed'
  return 'Running tool'
})
</script>

<style scoped>
.tool-call {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  margin: 6px 0;
  font-size: 0.8125rem;
  border-radius: 9px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.tc-icon { display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0; }
.tc-icon svg { width: 15px; height: 15px; }
.tool-call.running { color: #4f46e5; border-color: #c7d2fe; background: #eef2ff; }
.tool-call.done { color: #16a34a; border-color: #bbf7d0; background: #f0fdf4; }
.tool-call.error { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
.tc-verb { color: inherit; }
.tc-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  color: #0f172a;
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 6px;
  border-radius: 5px;
}
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
