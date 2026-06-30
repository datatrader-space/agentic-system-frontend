<template>
  <!-- Wizard step 0 — "Start": choose blank vs a template. Rendered inside the builder body
       (the wizard step heading already shows "Create a new agent"). -->
  <div class="mx-auto w-full max-w-6xl px-8 pb-10 font-[Inter,system-ui,sans-serif]">
    <!-- Heading -->
    <header class="mb-6">
      <h2 class="text-[24px] font-bold tracking-tight text-[#0F172A]">Create a new agent</h2>
      <p class="mt-1 text-sm text-[#64748B]">Start from scratch or use a template to build your agent.</p>
    </header>

    <!-- Two choice cards -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <button
        class="group flex items-center justify-between gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-7 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
        @click="$emit('blank')"
      >
        <div class="flex items-center gap-4">
          <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600">
            <Bot :size="26" :stroke-width="2" />
          </span>
          <span>
            <span class="block text-base font-bold text-[#0F172A]">Blank Agent</span>
            <span class="mt-1 block max-w-[32ch] text-[13.5px] leading-snug text-[#64748B]">Start with a clean slate and build your agent step by step.</span>
          </span>
        </div>
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F2F4F7] text-[#475569] transition group-hover:bg-blue-50 group-hover:text-blue-600">
          <Plus :size="20" :stroke-width="2.2" />
        </span>
      </button>

      <button
        class="group flex items-center justify-between gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-7 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
        @click="scrollToTemplates"
      >
        <div class="flex items-center gap-4">
          <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600">
            <LayoutTemplate :size="26" :stroke-width="2" />
          </span>
          <span>
            <span class="block text-base font-bold text-[#0F172A]">From Template</span>
            <span class="mt-1 block max-w-[32ch] text-[13.5px] leading-snug text-[#64748B]">Choose from pre-built templates for common use cases.</span>
          </span>
        </div>
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F2F4F7] text-[#475569] transition group-hover:bg-violet-50 group-hover:text-violet-600">
          <ArrowRight :size="20" :stroke-width="2.2" />
        </span>
      </button>
    </div>

    <!-- Explore templates -->
    <section ref="templatesEl" class="mt-9 scroll-mt-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-base font-semibold text-[#0F172A]">Explore Templates</h3>
        <button v-if="templates.length" class="text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]" @click="scrollToTemplates">View all</button>
      </div>

      <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="n in 3" :key="n" class="h-[120px] animate-pulse rounded-2xl border border-[#E5E7EB] bg-white" />
      </div>

      <div v-else-if="templates.length" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="(t, i) in templates"
          :key="t.id"
          class="group flex flex-col items-start gap-2.5 rounded-2xl border border-[#E5E7EB] bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md disabled:opacity-60"
          :disabled="creatingId === t.id"
          @click="$emit('use-template', t)"
        >
          <span class="grid h-9 w-9 place-items-center rounded-[10px]" :class="visual(i)">
            <component :is="iconFor(i)" :size="18" :stroke-width="2" />
          </span>
          <span class="block text-sm font-semibold text-[#0F172A]">{{ t.name }}</span>
          <span class="block text-xs leading-snug text-[#64748B]">{{ t.template_description || t.description || 'Pre-built agent template.' }}</span>
          <span v-if="creatingId === t.id" class="text-[11px] font-semibold text-[#2563EB]">Creating…</span>
        </button>
      </div>

      <div v-else class="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-8 text-center text-[13px] text-[#64748B]">
        No templates yet. <button class="font-semibold text-[#2563EB]" @click="$emit('blank')">Start from a blank agent</button>.
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Bot, Plus, LayoutTemplate, ArrowRight, Database, Headphones, Search, Sparkles, FileText } from 'lucide-vue-next'
import api from '../../services/api'

defineProps({ creatingId: { type: [Number, String], default: null } })
defineEmits(['blank', 'use-template'])

const loading = ref(true)
const templates = ref([])
const templatesEl = ref(null)

const ICONS = [Database, Headphones, Search, Sparkles, FileText]
const TINTS = ['bg-blue-50 text-blue-600', 'bg-violet-50 text-violet-600', 'bg-emerald-50 text-emerald-600', 'bg-amber-50 text-amber-600', 'bg-teal-50 text-teal-600']
const iconFor = (i) => ICONS[i % ICONS.length]
const visual = (i) => TINTS[i % TINTS.length]

function scrollToTemplates() {
  templatesEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  try {
    const res = await api.listAgentTemplates()
    templates.value = Array.isArray(res.data) ? res.data : (res.data?.results || [])
  } catch (e) {
    templates.value = []
  } finally {
    loading.value = false
  }
})
</script>
