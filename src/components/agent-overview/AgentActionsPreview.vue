<template>
  <section class="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div class="flex items-center gap-2.5">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <Wrench :size="18" :stroke-width="2" />
        </span>
        <h3 class="text-[15px] font-semibold text-[#0F172A]">Actions</h3>
        <span
          v-if="!loading"
          class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500"
        >{{ tools.length }}</span>
      </div>
      <router-link
        :to="editLink"
        class="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
      >
        Manage <ChevronRight :size="14" :stroke-width="2.5" />
      </router-link>
    </header>

    <div class="px-5 py-5">
      <div v-if="loading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-lg bg-slate-50" />
      </div>

      <div v-else-if="!tools.length" class="flex flex-col items-center gap-2 py-6 text-center">
        <Wrench :size="26" class="text-slate-300" />
        <p class="text-[13px] text-[#94A3B8]">No actions connected yet.</p>
      </div>

      <ul v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <li
          v-for="tool in tools"
          :key="tool.id ?? tool.name"
          class="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
        >
          <span class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white text-amber-600 shadow-sm">
            <Zap :size="14" :stroke-width="2.25" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-[13px] font-semibold text-[#334155]">
              {{ tool.display_name || tool.name }}
            </p>
            <p v-if="tool.category_label" class="truncate text-[11px] text-[#94A3B8]">
              {{ tool.category_label }}
            </p>
          </div>
        </li>
      </ul>

      <p
        v-if="!loading && bundleCount"
        class="mt-3 text-[12px] text-[#94A3B8]"
      >
        + {{ bundleCount }} tool bundle{{ bundleCount === 1 ? '' : 's' }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Wrench, ChevronRight, Zap } from 'lucide-vue-next'

const props = defineProps({
  agent: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
})

const editLink = computed(() => `/dashboard/agents/${props.agent?.id ?? ''}/editor?step=actions`)
const tools = computed(() => (Array.isArray(props.agent?.tools) ? props.agent.tools : []))
const bundleCount = computed(() =>
  Array.isArray(props.agent?.tool_bundles) ? props.agent.tool_bundles.length : 0,
)
</script>
