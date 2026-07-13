<template>
  <section class="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div class="flex items-center gap-2.5">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <ShieldCheck :size="18" :stroke-width="2" />
        </span>
        <h3 class="text-[15px] font-semibold text-[#0F172A]">Autonomy &amp; Safety</h3>
      </div>
      <router-link
        :to="editLink"
        class="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
      >
        Edit <ChevronRight :size="14" :stroke-width="2.5" />
      </router-link>
    </header>

    <div class="px-5 py-5">
      <div v-if="loading" class="grid grid-cols-2 gap-3">
        <div v-for="i in 4" :key="i" class="h-14 animate-pulse rounded-lg bg-slate-50" />
      </div>

      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          v-for="row in rows"
          :key="row.label"
          class="rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-3"
        >
          <p class="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">{{ row.label }}</p>
          <div class="mt-1 flex items-center gap-1.5">
            <component
              v-if="row.icon"
              :is="row.icon"
              :size="15"
              :class="row.on ? 'text-emerald-500' : 'text-slate-300'"
              :stroke-width="2.25"
            />
            <p class="text-[14px] font-semibold text-[#334155]">{{ row.value }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { ShieldCheck, ChevronRight, Check, X } from 'lucide-vue-next'
import { modeLabel } from '../../composables/agentModes'

const props = defineProps({
  agent: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
})

const editLink = computed(() => `/dashboard/agents/${props.agent?.id ?? ''}/editor?step=autonomy`)

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—')

const rows = computed(() => {
  const a = props.agent || {}
  const bool = (v) => ({ value: v ? 'On' : 'Off', on: !!v, icon: v ? Check : X })
  return [
    { label: 'Run Mode', value: modeLabel(a.agent_run_mode), icon: null, on: false },
    { label: 'Verify After Run', ...bool(a.verify_after_completion) },
    {
      label: 'Checkpoint Every',
      value: a.checkpoint_every_n_steps ? `${a.checkpoint_every_n_steps} steps` : '—',
      icon: null,
      on: false,
    },
    { label: 'Phase Checkpoints', ...bool(a.checkpoint_on_phase_boundary) },
  ]
})
</script>
