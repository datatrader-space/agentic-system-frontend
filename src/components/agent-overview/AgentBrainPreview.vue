<template>
  <section class="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div class="flex items-center gap-2.5">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600">
          <Brain :size="18" :stroke-width="2" />
        </span>
        <h3 class="text-[15px] font-semibold text-[#0F172A]">Agent Brain</h3>
      </div>
      <router-link
        :to="editLink"
        class="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
      >
        Edit <ChevronRight :size="14" :stroke-width="2.5" />
      </router-link>
    </header>

    <div class="space-y-5 px-5 py-5">
      <div v-if="loading" class="space-y-2">
        <div class="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
        <div class="h-20 animate-pulse rounded-lg bg-slate-50" />
      </div>

      <template v-else>
        <!-- System prompt -->
        <div>
          <p class="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
            System Prompt
            <span v-if="agent?.prompt_mode" class="ml-1 font-medium normal-case tracking-normal text-slate-400">
              ({{ agent.prompt_mode }})
            </span>
          </p>
          <p
            v-if="systemPrompt"
            class="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3.5 text-[13px] leading-relaxed text-[#334155]"
          >{{ systemPrompt }}</p>
          <p v-else class="rounded-lg bg-slate-50 p-3.5 text-[13px] text-[#94A3B8]">
            No system prompt configured yet.
          </p>
        </div>

        <!-- Rules -->
        <div>
          <p class="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">Rules</p>
          <ul v-if="rules.length" class="space-y-1.5">
            <li
              v-for="(rule, i) in rules"
              :key="i"
              class="flex items-start gap-2 text-[13px] leading-relaxed text-[#334155]"
            >
              <CheckCircle2 :size="15" class="mt-0.5 shrink-0 text-emerald-500" :stroke-width="2.25" />
              <span>{{ rule }}</span>
            </li>
          </ul>
          <p v-else class="text-[13px] text-[#94A3B8]">No rules defined.</p>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Brain, ChevronRight, CheckCircle2 } from 'lucide-vue-next'

const props = defineProps({
  agent: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
})

const editLink = computed(() => `/dashboard/agents/${props.agent?.id ?? ''}/editor?step=brain`)

const systemPrompt = computed(() => (props.agent?.system_prompt_template || '').trim())

// agent_rules may be a list of strings, a list of objects, or a newline-delimited string.
const rules = computed(() => {
  const raw = props.agent?.agent_rules
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((r) => (typeof r === 'string' ? r : r?.text || r?.rule || r?.description || ''))
      .map((s) => String(s).trim())
      .filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw.split('\n').map((s) => s.trim()).filter(Boolean)
  }
  return []
})
</script>
