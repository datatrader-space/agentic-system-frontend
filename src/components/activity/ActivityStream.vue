<!--
  ActivityStream — renders an agent turn's live transcript from `activity` state
  (see composables/activityStream.js). Each row is an <ActivityStep> (status + label +
  expandable rich body: thinking, bash IN/OUT, file snippet, edit diff, …). Decoupled +
  dumb, so the Emulator and the new chat share it with zero duplication.

  While running  → live transcript. When done → collapses to "✓ Done · N steps · Xs",
  click to expand the full transcript (rows still individually expandable).
-->
<template>
  <div v-if="activity && activity.steps && activity.steps.length" class="my-1">
    <!-- Running: live transcript -->
    <div v-if="!activity.done" class="rounded-lg border border-gray-200 bg-slate-50/70 px-3 py-2">
      <div class="flex items-center justify-between mb-1.5">
        <div v-if="activity.reconnecting" class="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Reconnecting…
          <span class="text-amber-400">· still working on the server</span>
        </div>
        <div v-else class="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span> Working
          <span v-if="liveTurnSecs != null" class="tabular-nums text-indigo-400">· {{ liveTurnSecs }}s</span>
        </div>
        <!-- live token chip — ticks up while the model works (token_metering_mockup) -->
        <span v-if="liveTokens" class="text-[12px] text-gray-500 tabular-nums flex items-center gap-1"
              :title="liveTokens.estimated ? 'Live estimate — finalises exactly when done' : 'Tokens so far'">
          · {{ fmtTokens(liveTokens.total) }} tokens
          <span v-if="liveTokens.estimated" class="text-emerald-500 text-[10px]">▲</span>
        </span>
      </div>
      <ActivityStep v-for="s in activity.steps" :key="s.id" :step="s" />
    </div>

    <!-- Done: collapsed summary (click to expand the full transcript) -->
    <div v-else class="rounded-lg border border-gray-200 bg-slate-50/70">
      <button type="button" @click="expanded = !expanded"
              class="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-600 hover:bg-slate-100/60 rounded-lg">
        <svg class="w-4 h-4 shrink-0" :class="anyError ? 'text-red-500' : 'text-emerald-500'" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
        <span>{{ summaryLabel }} · {{ summary.count }} step{{ summary.count === 1 ? '' : 's' }}<span v-if="summary.seconds"> · {{ summary.seconds.toFixed(1) }}s</span><span v-if="liveTokens"> · {{ fmtTokens(liveTokens.total) }} tokens</span></span>
        <svg class="w-3.5 h-3.5 ml-auto text-gray-400 transition-transform" :class="{ 'rotate-180': expanded }" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" clip-rule="evenodd"/></svg>
      </button>
      <div v-if="expanded" class="px-3 pb-2 pt-1 border-t border-gray-100">
        <ActivityStep v-for="s in activity.steps" :key="s.id" :step="s" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { activitySummary } from '../../composables/activityStream'
import { fmtTokens } from '../../composables/tokens'
import { useClock } from '../../composables/useClock'
import ActivityStep from './ActivityStep.vue'

const props = defineProps({
  activity: { type: Object, default: null },
})

const expanded = ref(false)
const summary = computed(() => activitySummary(props.activity))
// Live turn-total elapsed while running (ticks every second).
const nowMs = useClock()
const liveTurnSecs = computed(() => {
  const a = props.activity
  if (!a || a.done || !a.steps || !a.steps.length) return null
  const start = a.steps[0].startTs
  return start ? Math.max(0, Math.round((nowMs.value - start) / 1000)) : null
})
const liveTokens = computed(() => (props.activity && props.activity.tokens) || null)
// "Issues" at a glance = hard errors OR safety blocks/rejections (failed safe).
const anyError = computed(() => !!(props.activity && props.activity.steps.some(
  (s) => s.status === 'error' || s.status === 'blocked' || s.status === 'rejected')))
// An interrupted turn (socket dropped mid-stream) reads distinctly so it isn't mistaken for "Done".
const summaryLabel = computed(() => {
  if (props.activity && props.activity.interrupted) return 'Interrupted — connection lost'
  return anyError.value ? 'Completed with issues' : 'Done'
})
</script>
