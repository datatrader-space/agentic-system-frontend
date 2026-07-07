<!--
  PlanChecklist — the agent's durable execution plan as a live todo-list. Each step ticks off as the
  backend emits plan_step_completed (persisted, so it survives a reconnect). Shown for task/CRS runs
  where the agent plans N steps up front. `plan` = { resumed, steps:[{id, description, done}] }.
-->
<template>
  <div class="plan-checklist">
    <div class="plan-checklist__head">
      <svg class="plan-checklist__icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <span>{{ plan.resumed ? 'Resuming plan' : 'Plan' }}</span>
      <span class="plan-checklist__count">· {{ done }}/{{ plan.steps.length }} done</span>
    </div>
    <ul class="plan-checklist__list">
      <li v-for="(s, i) in plan.steps" :key="s.id ?? i" class="plan-checklist__item"
          :class="{ 'is-done': s.done, 'is-active': i === activeIdx }">
        <!-- ✓ done -->
        <svg v-if="s.done" class="plan-checklist__check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <!-- ▶ in progress (the current step, only while the run is live) -->
        <span v-else-if="i === activeIdx" class="plan-checklist__spinner"></span>
        <!-- ○ remaining -->
        <span v-else class="plan-checklist__dot"></span>
        <span class="plan-checklist__text">{{ s.description }}</span>
        <span v-if="i === activeIdx" class="plan-checklist__now">in progress</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  plan: { type: Object, required: true },   // { resumed, steps:[{id, description, done}] }
  done: { type: Number, default: 0 },
  running: { type: Boolean, default: false }, // still working → the first unchecked step is "in progress"
})

// The step the agent is currently on = the first not-done step, but ONLY while the run is live.
// When the run has finished, nothing is "in progress" (remaining steps just show as ○).
const activeIdx = computed(() => {
  if (!props.running) return -1
  return props.plan.steps.findIndex((s) => !s.done)
})
</script>

<style scoped>
.plan-checklist {
  margin-bottom: 8px;
  border: 1px solid rgba(99, 102, 241, 0.18);
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  padding: 8px 10px;
}
.plan-checklist__head {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #6366f1;
  margin-bottom: 5px;
}
.plan-checklist__icon { flex-shrink: 0; }
.plan-checklist__count { color: #9ca3af; font-weight: 500; }
.plan-checklist__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.plan-checklist__item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  line-height: 1.35;
  color: #374151;
}
.plan-checklist__item.is-done .plan-checklist__text { color: #9ca3af; text-decoration: line-through; }
.plan-checklist__item.is-active .plan-checklist__text { color: #4338ca; font-weight: 500; }
.plan-checklist__check { flex-shrink: 0; margin-top: 1px; color: #10b981; }
.plan-checklist__dot {
  flex-shrink: 0;
  width: 13px;
  height: 13px;
  margin-top: 1px;
  border: 1.5px solid #d1d5db;
  border-radius: 50%;
}
/* ▶ current step: pulsing indigo ring so the user sees exactly what the agent is doing right now. */
.plan-checklist__spinner {
  flex-shrink: 0;
  width: 13px;
  height: 13px;
  margin-top: 1px;
  border: 1.5px solid #c7d2fe;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: plan-spin 0.7s linear infinite;
}
@keyframes plan-spin { to { transform: rotate(360deg); } }
.plan-checklist__text { flex: 1; word-break: break-word; }
.plan-checklist__now {
  flex-shrink: 0;
  font-size: 10px;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 4px;
  padding: 0 5px;
  align-self: center;
}

@media (prefers-color-scheme: dark) {
  .plan-checklist { background: rgba(30, 41, 59, 0.5); border-color: rgba(99, 102, 241, 0.3); }
  .plan-checklist__item { color: #cbd5e1; }
  .plan-checklist__item.is-active .plan-checklist__text { color: #a5b4fc; }
}
</style>
