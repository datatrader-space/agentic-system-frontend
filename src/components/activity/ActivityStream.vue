<!--
  ActivityStream — renders an agent turn's live activity timeline from `activity` state
  (see composables/activityStream.js). Decoupled + dumb: it only renders the steps it's
  given, so the Emulator and the new chat share it with zero duplication.

  While running  → live checklist: ✓ done · spinner active · faded pending · red error.
  When done      → collapses to "✓ Done · N steps · Xs", click to expand the full log.
-->
<template>
  <div v-if="activity && activity.steps && activity.steps.length" class="my-1">
    <!-- Running: live checklist -->
    <div v-if="!activity.done"
         class="rounded-lg border border-gray-200 bg-slate-50/70 px-3 py-2">
      <div class="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 mb-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span> Working
      </div>
      <div>
        <div v-for="s in activity.steps" :key="s.id"
             class="flex items-start gap-2.5 py-1.5 border-b border-gray-100 last:border-b-0"
             :class="{ 'opacity-30': s.status === 'pending' }">
          <span class="mt-0.5 shrink-0">
            <span v-if="s.status === 'running'" class="inline-block w-3.5 h-3.5 rounded-full border-2 border-gray-200 border-t-indigo-500 animate-spin"></span>
            <span v-else-if="s.status === 'pending_approval'" class="inline-block w-3.5 h-3.5 rounded-full bg-amber-400 animate-pulse" title="Waiting for your approval"></span>
            <svg v-else-if="s.status === 'done' || s.status === 'approved'" class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
            <svg v-else-if="s.status === 'blocked' || s.status === 'rejected'" class="w-3.5 h-3.5 text-amber-600" viewBox="0 0 20 20" fill="currentColor" title="Blocked — requires approval"><path fill-rule="evenodd" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM4.6 5.7l9.7 9.7a6.5 6.5 0 0 1-9.7-9.7Zm1.1-1.1a6.5 6.5 0 0 1 9.7 9.7L5.7 4.6Z" clip-rule="evenodd"/></svg>
            <svg v-else-if="s.status === 'error'" class="w-3.5 h-3.5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM8.7 7.3a1 1 0 0 0-1.4 1.4L8.6 10l-1.3 1.3a1 1 0 1 0 1.4 1.4L10 11.4l1.3 1.3a1 1 0 0 0 1.4-1.4L11.4 10l1.3-1.3a1 1 0 0 0-1.4-1.4L10 8.6 8.7 7.3Z" clip-rule="evenodd"/></svg>
            <span v-else class="inline-block w-3 h-3 rounded-full border-[1.5px] border-gray-300"></span>
          </span>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] leading-tight"
                 :class="statusTextClass(s.status)">
              {{ s.label }}
              <span v-if="s.status === 'pending_approval'" class="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600">pending approval</span>
              <span v-else-if="s.status === 'blocked'" class="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">blocked</span>
              <span v-else-if="s.status === 'rejected'" class="ml-1 text-[10px] font-semibold uppercase tracking-wide text-red-600">rejected</span>
            </div>
            <div v-if="s.error" class="mt-0.5 text-[11px] text-red-500/90 font-mono break-words">{{ s.error }}</div>
          </div>
          <span class="text-[11px] text-gray-400 shrink-0 mt-0.5">
            <span v-if="s.status === 'running'">…</span>
            <span v-else-if="secs(s) != null">{{ secs(s).toFixed(1) }}s</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Done: collapsed summary (click to expand) -->
    <div v-else class="rounded-lg border border-gray-200 bg-slate-50/70">
      <button type="button" @click="expanded = !expanded"
              class="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-600 hover:bg-slate-100/60 rounded-lg">
        <svg class="w-4 h-4 shrink-0" :class="anyError ? 'text-red-500' : 'text-emerald-500'" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
        <span>{{ anyError ? 'Completed with issues' : 'Done' }} · {{ summary.count }} step{{ summary.count === 1 ? '' : 's' }}<span v-if="summary.seconds"> · {{ summary.seconds.toFixed(1) }}s</span></span>
        <svg class="w-3.5 h-3.5 ml-auto text-gray-400 transition-transform" :class="{ 'rotate-180': expanded }" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" clip-rule="evenodd"/></svg>
      </button>
      <div v-if="expanded" class="px-3 pb-2 pt-1 border-t border-gray-100">
        <div v-for="s in activity.steps" :key="s.id" class="flex items-start gap-2.5 py-1.5">
          <svg v-if="s.status !== 'error'" class="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
          <svg v-else class="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM8.7 7.3a1 1 0 0 0-1.4 1.4L8.6 10l-1.3 1.3a1 1 0 1 0 1.4 1.4L10 11.4l1.3 1.3a1 1 0 0 0 1.4-1.4L11.4 10l1.3-1.3a1 1 0 0 0-1.4-1.4L10 8.6 8.7 7.3Z" clip-rule="evenodd"/></svg>
          <div class="flex-1 min-w-0">
            <div class="text-[13px]" :class="s.status === 'error' ? 'text-red-600' : 'text-gray-600'">{{ s.label }}</div>
            <div v-if="s.error" class="mt-0.5 text-[11px] text-red-500/90 font-mono break-words">{{ s.error }}</div>
          </div>
          <span v-if="secs(s) != null" class="text-[11px] text-gray-400 shrink-0">{{ secs(s).toFixed(1) }}s</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { stepSeconds, activitySummary } from '../../composables/activityStream'

const props = defineProps({
  activity: { type: Object, default: null },
})

const expanded = ref(false)
const secs = (s) => stepSeconds(s)
const summary = computed(() => activitySummary(props.activity))
// "Issues" at a glance = hard errors OR safety blocks/rejections (failed safe).
const anyError = computed(() => !!(props.activity && props.activity.steps.some(
  (s) => s.status === 'error' || s.status === 'blocked' || s.status === 'rejected')))

function statusTextClass(status) {
  if (status === 'running') return 'text-gray-900 font-medium'
  if (status === 'pending_approval') return 'text-amber-700 font-medium'
  if (status === 'blocked') return 'text-amber-700'
  if (status === 'error' || status === 'rejected') return 'text-red-600'
  return 'text-gray-500'
}
</script>
