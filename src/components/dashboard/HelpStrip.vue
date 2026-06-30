<template>
  <div class="rounded-2xl border border-[#D8E4FF] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <div class="mb-4">
      <h2 class="text-base font-semibold text-[#0F172A]">Onboarding &amp; Help</h2>
      <p class="mt-0.5 text-[13px] text-[#64748B]">New here? Get up and running in minutes.</p>
    </div>
    <div class="grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-6">
      <button
        v-for="(h, i) in items"
        :key="h.label"
        type="button"
        class="flex min-h-[64px] items-center gap-3 border-r px-5 py-3 text-left transition last:border-r-0"
        :class="i === items.length - 1
          ? 'rounded-xl border-blue-200 bg-blue-50 hover:bg-blue-100/70'
          : 'border-[#E5E7EB] hover:bg-slate-50'"
        @click="$emit('go', h.to)"
      >
        <component :is="h.icon" :size="20" :stroke-width="2" :class="i === items.length - 1 ? 'text-[#2563EB]' : 'text-[#2563EB]'" />
        <span class="min-w-0">
          <span class="block whitespace-nowrap text-[13px] font-semibold" :class="i === items.length - 1 ? 'text-[#2563EB]' : 'text-[#0F172A]'">{{ h.label }}</span>
          <span class="block truncate text-[11.5px] text-[#64748B]">{{ h.desc }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { Rocket, CircleHelp, FileText, PlaySquare, Search, LifeBuoy } from 'lucide-vue-next'

defineEmits(['go'])

const items = [
  { label: 'Quick Start Guide', desc: 'Step-by-step walkthrough', icon: Rocket,     to: '/dashboard/agents/new' },
  { label: 'Contextual Help',   desc: 'Help in the right time',   icon: CircleHelp,  to: '/dashboard/settings/general' },
  { label: 'Docs & Examples',   desc: 'Learn with real use cases',icon: FileText,    to: '/dashboard/settings/general' },
  { label: 'Video Tutorials',   desc: 'Short guided walkthroughs',icon: PlaySquare,  to: '/dashboard/settings/general' },
  { label: 'Search Everywhere', desc: 'Find anything instantly',  icon: Search,      to: '/dashboard/agents' },
  { label: 'Need Help?',        desc: 'Chat with our team',       icon: LifeBuoy,    to: '/dashboard/activity' },
]
</script>
