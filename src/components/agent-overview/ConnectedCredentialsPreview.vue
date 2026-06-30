<template>
  <section class="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div class="flex items-center gap-2.5">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
          <KeyRound :size="18" :stroke-width="2" />
        </span>
        <h3 class="text-[15px] font-semibold text-[#0F172A]">Connected Credentials</h3>
        <span
          v-if="!loading && !error"
          class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500"
        >{{ credentials.length }}</span>
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
        <div v-for="i in 2" :key="i" class="h-12 animate-pulse rounded-lg bg-slate-50" />
      </div>

      <div v-else-if="error" class="flex items-center gap-2 rounded-lg bg-rose-50 px-3.5 py-3 text-[13px] text-rose-700">
        <AlertTriangle :size="15" class="shrink-0" />
        <span>Could not load credentials.</span>
      </div>

      <div v-else-if="!credentials.length" class="flex flex-col items-center gap-2 py-6 text-center">
        <KeyRound :size="26" class="text-slate-300" />
        <p class="text-[13px] text-[#94A3B8]">No credentials connected.</p>
      </div>

      <ul v-else class="space-y-2">
        <li
          v-for="cred in credentials"
          :key="cred.id"
          class="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-2.5"
        >
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-emerald-600 shadow-sm">
            <KeyRound :size="15" :stroke-width="2.25" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-semibold text-[#334155]">{{ cred.service_name }}</p>
            <p class="truncate text-[11px] text-[#94A3B8]">
              {{ cred.credential_name || cred.auth_type || cred.scope_type }}
            </p>
          </div>
          <span
            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
            :class="cred.is_valid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="cred.is_valid ? 'bg-emerald-500' : 'bg-amber-500'" />
            {{ cred.is_valid ? 'Valid' : 'Unverified' }}
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { KeyRound, ChevronRight, AlertTriangle } from 'lucide-vue-next'

const props = defineProps({
  agentId: { type: [String, Number], default: null },
  credentials: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
})

import { computed } from 'vue'
const editLink = computed(() => `/dashboard/agents/${props.agentId ?? ''}/editor?step=credentials`)
</script>
