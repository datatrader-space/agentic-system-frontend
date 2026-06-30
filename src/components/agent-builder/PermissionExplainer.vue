<template>
  <!-- Right-rail education panel for the "Attach Credentials from Vault" step (Screen 09).
       Permission modes are NOT modeled in the backend — this is display-only education so
       users understand how attached credentials behave. No state, no API. -->
  <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div class="flex items-center gap-2 mb-1">
      <KeyRound class="w-4 h-4 text-indigo-600" />
      <h4 class="text-sm font-semibold text-gray-900">Understanding permissions</h4>
    </div>
    <p class="text-xs text-gray-500 mb-3 leading-relaxed">
      How attached credentials behave when this agent uses them.
    </p>

    <div class="space-y-2.5">
      <div v-for="mode in modes" :key="mode.key"
           class="flex items-start gap-2.5 rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
        <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              :class="mode.iconBg">
          <component :is="mode.icon" class="h-4 w-4" :class="mode.iconColor" />
        </span>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-gray-800">{{ mode.label }}</span>
            <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full" :class="mode.chip">
              {{ mode.tag }}
            </span>
          </div>
          <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">{{ mode.desc }}</p>
        </div>
      </div>
    </div>

    <div class="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 p-2.5">
      <Info class="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
      <p class="text-[11px] text-amber-700 leading-snug">
        The agent never sees the raw secret value — it only references the credential by name.
      </p>
    </div>
  </div>
</template>

<script setup>
import { KeyRound, Eye, Pencil, Info } from 'lucide-vue-next'

const modes = [
  {
    key: 'use', label: 'Use Only', tag: 'Default', icon: KeyRound,
    iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700',
    desc: 'The agent can authenticate with this credential to call its service, but cannot read or change it.',
  },
  {
    key: 'view', label: 'View', tag: 'Display', icon: Eye,
    iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
    chip: 'bg-blue-50 text-blue-700',
    desc: 'Lets a user inspect the credential’s metadata (not the secret value) when reviewing the agent.',
  },
  {
    key: 'edit', label: 'Edit', tag: 'Display', icon: Pencil,
    iconBg: 'bg-violet-50', iconColor: 'text-violet-600',
    chip: 'bg-violet-50 text-violet-700',
    desc: 'Reserved for owners who can rotate or update the stored credential from the vault.',
  },
]
</script>
