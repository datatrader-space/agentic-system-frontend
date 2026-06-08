<template>
  <!-- Manual Mode plan-approval card (v3 Layer 2). Shows the generated plan and lets the human
       approve or reject it; approval resumes execution against the plan (the parent re-sends the
       original message). Rendered only when Planning Mode is ON and the run is in Manual Mode. -->
  <div class="border border-indigo-200 bg-indigo-50/60 rounded-xl p-3 mt-1 text-sm">
    <div class="flex items-center gap-2 mb-1.5">
      <span class="text-base leading-none">📋</span>
      <span class="font-semibold text-indigo-900">{{ plan.title || 'Proposed plan' }}</span>
      <span class="ml-auto text-[11px] text-indigo-500 font-medium">Awaiting your approval</span>
    </div>

    <p v-if="plan.summary" class="text-gray-700 mb-2">{{ plan.summary }}</p>

    <ol v-if="phases.length" class="space-y-1.5 mb-2">
      <li v-for="(ph, i) in phases" :key="i" class="bg-white border border-indigo-100 rounded-lg px-2.5 py-1.5">
        <div class="font-medium text-gray-800">
          <span class="text-indigo-600">Phase {{ ph.phase_number ?? (i + 1) }}.</span>
          {{ ph.title || 'Untitled phase' }}
        </div>
        <ul v-if="(ph.steps || []).length" class="list-disc pl-5 text-gray-600 mt-0.5">
          <li v-for="(s, j) in ph.steps" :key="j">{{ s }}</li>
        </ul>
        <div v-if="(ph.tools_required || []).length" class="mt-0.5 text-[11px] text-gray-500">
          Tools: <span class="font-mono">{{ (ph.tools_required || []).join(', ') }}</span>
        </div>
      </li>
    </ol>

    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 mb-2">
      <span v-if="plan.estimated_total_steps">~{{ plan.estimated_total_steps }} steps</span>
      <span v-if="plan.risk_notes" class="text-amber-700">⚠ {{ plan.risk_notes }}</span>
    </div>

    <div class="flex items-center gap-2">
      <button @click="$emit('approve')" :disabled="busy"
              class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
        Approve &amp; run
      </button>
      <button @click="$emit('reject')" :disabled="busy"
              class="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-50">
        Reject
      </button>
      <!-- Third path: neither approve nor reject — send feedback so the agent revises the plan. -->
      <button @click="showRevise = !showRevise" :disabled="busy"
              class="ml-auto px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 text-xs font-medium hover:bg-indigo-100 disabled:opacity-50">
        {{ showRevise ? 'Cancel' : 'Request changes…' }}
      </button>
    </div>

    <!-- Feedback box: the input goes to the agent, which re-plans and asks again. -->
    <div v-if="showRevise" class="mt-2">
      <textarea
        v-model="feedback"
        rows="2"
        placeholder="Tell the agent what to change (e.g. “just connect — skip the health checks”)…"
        class="w-full px-2.5 py-1.5 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        @keydown.enter.meta.prevent="submitRevise"
        @keydown.enter.ctrl.prevent="submitRevise"
      ></textarea>
      <div class="flex items-center justify-end gap-2 mt-1">
        <span class="text-[11px] text-gray-400 mr-auto">The agent will revise the plan from your feedback.</span>
        <button @click="submitRevise" :disabled="busy || !feedback.trim()"
                class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
          Send to agent
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  plan: { type: Object, default: () => ({}) },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['approve', 'reject', 'revise'])

const phases = computed(() => Array.isArray(props.plan?.phases) ? props.plan.phases : [])

const showRevise = ref(false)
const feedback = ref('')
function submitRevise() {
  const text = feedback.value.trim()
  if (!text) return
  emit('revise', text)
  feedback.value = ''
  showRevise.value = false
}
</script>
