<template>
  <!-- Wizard step 1 — "Agent basics": name + purpose + workspace, then Create Agent. -->
  <div class="mx-auto w-full max-w-6xl px-8 pb-10 font-[Inter,system-ui,sans-serif]">
    <!-- Heading -->
    <header class="mb-6">
      <button class="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]" @click="$emit('back')">
        <ChevronLeft :size="15" :stroke-width="2" /> Back
      </button>
      <h2 class="text-[24px] font-bold tracking-tight text-[#0F172A]">Agent basics</h2>
      <p class="mt-1 text-sm text-[#64748B]">Give your agent a name and purpose to get started.</p>
    </header>

    <!-- Basics card -->
    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
      <h2 class="mb-5 text-base font-semibold text-[#0F172A]">Agent basics</h2>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label class="mb-1.5 block text-[13px] font-semibold text-[#344054]">Agent name</label>
          <input
            v-model="agent.name"
            type="text"
            placeholder="e.g., My Lead Intake Agent"
            class="w-full rounded-[10px] border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#98A2B3] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-blue-100"
          />
          <p class="mt-1.5 text-xs text-[#667085]">Choose a clear, descriptive name for your agent.</p>
        </div>

        <div>
          <label class="mb-1.5 block text-[13px] font-semibold text-[#344054]">Purpose</label>
          <input
            v-model="agent.description"
            type="text"
            placeholder="e.g., Qualify leads and route to the right team"
            class="w-full rounded-[10px] border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#98A2B3] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-blue-100"
          />
          <p class="mt-1.5 text-xs text-[#667085]">What will this agent do?</p>
        </div>
      </div>

      <div class="mt-5">
        <label class="mb-1.5 block text-[13px] font-semibold text-[#344054]">Workspace</label>
        <select
          v-model="selectedWorkspace"
          class="w-full rounded-[10px] border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-blue-100"
        >
          <option :value="null">Select a workspace</option>
          <option v-for="w in workspaces" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
        <p class="mt-1.5 text-xs text-[#667085]">Choose where this agent will live and which data it can access.</p>
      </div>

      <div class="mt-6 flex justify-end">
        <button
          class="inline-flex items-center gap-2 rounded-[10px] bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(37,99,235,0.25)] transition hover:bg-[#1D4ED8] disabled:opacity-60"
          :disabled="creating || !(agent.name && agent.name.trim())"
          @click="$emit('create', { workspaceId: selectedWorkspace })"
        >
          <Sparkles :size="16" :stroke-width="2" />
          {{ creating ? 'Creating…' : 'Create Agent' }}
        </button>
      </div>
    </div>

    <!-- Help callout -->
    <div class="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[#DCE6FB] bg-[#EFF4FF] px-5 py-4">
      <div class="flex items-start gap-3">
        <Lightbulb :size="20" :stroke-width="2" class="mt-0.5 shrink-0 text-[#2563EB]" />
        <div>
          <p class="text-[13.5px] font-semibold text-[#0F172A]">Not sure where to start?</p>
          <p class="text-[13px] text-[#475569]">You can always modify your agent later. Start simple, add more as you go.</p>
        </div>
      </div>
      <button class="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-[#C7D7F7] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#344054] hover:border-[#2563EB] hover:text-[#2563EB]"
              @click="$emit('learn-more')">
        Learn more <ExternalLink :size="14" :stroke-width="2" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Sparkles, Lightbulb, ExternalLink, ChevronLeft } from 'lucide-vue-next'
import api from '../../services/api'

const props = defineProps({
  agent: { type: Object, required: true },
  creating: { type: Boolean, default: false },
})
defineEmits(['create', 'learn-more', 'back'])

const workspaces = ref([])
const selectedWorkspace = ref(props.agent.workspace_id ?? null)

onMounted(async () => {
  try {
    const res = await api.get('/workspaces/')
    const list = Array.isArray(res.data) ? res.data : (res.data?.results || [])
    workspaces.value = list
  } catch (e) {
    workspaces.value = []
  }
})
</script>
