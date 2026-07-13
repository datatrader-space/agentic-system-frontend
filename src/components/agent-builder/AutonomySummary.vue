<template>
  <!-- Deterministic, client-side plain-English summary of the agent's autonomy + safety
       settings (Screen 18). Pure presentation — no API calls, no side effects. -->
  <div class="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-blue-50/60 p-4">
    <div class="flex items-center gap-2 mb-2">
      <Sparkles class="w-4 h-4 text-indigo-600" />
      <h4 class="text-sm font-semibold text-gray-900">Autonomy Summary</h4>
    </div>
    <p class="text-xs text-gray-600 leading-relaxed">{{ summary }}</p>
    <div class="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
      <ShieldCheck class="w-3.5 h-3.5" />
      <span>Configuration looks good</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Sparkles, ShieldCheck } from 'lucide-vue-next'
import { isAutonomous, isPlanReview } from '../../composables/agentModes'

const props = defineProps({
  runMode: { type: String, default: 'manual' },
  riskCeiling: { type: String, default: null },
  maxCostPerRun: { type: [Number, String], default: null },
  dailyBudget: { type: [Number, String], default: null },
  checkpointEveryNSteps: { type: [Number, String], default: null },
})

function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

const summary = computed(() => {
  const parts = []

  // Plan review (drafts a plan before acting)
  if (isPlanReview(props.runMode)) {
    parts.push(isAutonomous(props.runMode)
      ? 'This agent drafts a plan that is reviewed automatically, then runs autonomously'
      : 'This agent drafts a plan and waits for your approval before acting')
  } else if (isAutonomous(props.runMode)) {
    parts.push('This agent runs tools automatically and resolves risky stops with the AI safety policy')
  } else {
    parts.push('This agent asks for your approval before running any tool')
  }

  // Risk ceiling
  const rc = (props.riskCeiling || '').toLowerCase()
  if (rc && rc !== 'none') {
    parts.push(`actions above ${rc} risk require approval`)
  }

  // Spending
  const perRun = num(props.maxCostPerRun)
  const daily = num(props.dailyBudget)
  if (perRun && daily) {
    parts.push(`runs are capped at $${perRun.toFixed(2)} each and $${daily.toFixed(2)} per day`)
  } else if (perRun) {
    parts.push(`each run is capped at $${perRun.toFixed(2)}`)
  } else if (daily) {
    parts.push(`daily spend is capped at $${daily.toFixed(2)}`)
  }

  // Checkpoints
  const cp = num(props.checkpointEveryNSteps)
  if (cp) {
    parts.push(`it pauses for a checkpoint every ${cp} tool call${cp === 1 ? '' : 's'}`)
  }

  // Join into a single sentence.
  if (parts.length === 1) return parts[0] + '.'
  const last = parts.pop()
  return parts.join('; ') + '; and ' + last + '.'
})
</script>
