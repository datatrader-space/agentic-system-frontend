<template>
  <div class="overflow-hidden rounded-[8px] border border-[#DDE6F2] bg-white">
    <table class="w-full table-fixed border-collapse text-left">
      <colgroup>
        <col class="w-[38%]" />
        <col class="w-[18%]" />
        <col class="w-[20%]" />
        <col class="w-[14%]" />
        <col class="w-[10%]" />
      </colgroup>
      <thead>
        <tr class="border-b border-[#EEF1F4] bg-[#F8FAFC]">
          <th class="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-[#52627A]">Server</th>
          <th class="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wide text-[#52627A]">Transport</th>
          <th class="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wide text-[#52627A]">Status</th>
          <th class="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wide text-[#52627A]">Tools</th>
          <th class="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-[#52627A]">Actions</th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading">
          <tr v-for="row in 6" :key="`mcp-skeleton-${row}`" class="border-b border-[#EAF0F7] last:border-0">
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-3">
                <span class="vm-skel h-9 w-9 shrink-0 rounded-[8px]"></span>
                <div class="min-w-0 flex-1">
                  <span class="vm-skel block h-4 w-[48%]"></span>
                  <span class="vm-skel mt-2 block h-3 w-[82%]"></span>
                </div>
              </div>
            </td>
            <td class="px-4 py-3.5"><span class="vm-skel block h-4 w-[62%]"></span></td>
            <td class="px-4 py-3.5"><span class="vm-skel block h-6 w-[76px] rounded-full"></span></td>
            <td class="px-4 py-3.5"><span class="vm-skel block h-4 w-[44px]"></span></td>
            <td class="px-4 py-3.5 text-right">
              <div class="inline-flex items-center gap-2">
                <span class="vm-skel block h-8 w-8 rounded-lg"></span>
                <span class="vm-skel block h-8 w-8 rounded-lg"></span>
              </div>
            </td>
          </tr>
        </template>
        <tr v-else-if="!servers.length">
          <td colspan="5" class="px-5 py-10 text-center text-sm text-[#94A3B8]">No MCP servers yet. Add one to expose its tools to your agents.</td>
        </tr>

        <tr v-for="s in servers" :key="s.id" class="border-b border-[#EAF0F7] last:border-0 hover:bg-[#F8FAFC]">
          <td class="px-5 py-3.5">
            <div class="flex items-center gap-3">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-violet-50 text-violet-600">
                <Server :size="17" :stroke-width="2" />
              </span>
              <div class="min-w-0 overflow-hidden">
                <p class="truncate text-[13.5px] font-bold text-[#0F172A]">{{ s.name }}</p>
                <p class="truncate text-[12px] text-[#64748B]">{{ s.description || s.command || s.slug }}</p>
              </div>
            </div>
          </td>
          <td class="px-4 py-3.5">
            <span class="block truncate text-[13px] font-medium text-[#52627A]">
              {{ (s.transport_type || 'stdio').toUpperCase() }}
            </span>
          </td>
          <td class="px-4 py-3.5">
            <span class="inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                  :class="s.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'">
              {{ s.enabled ? 'Enabled' : 'Disabled' }}
            </span>
          </td>
          <td class="truncate px-4 py-3.5 text-[13px] font-medium text-[#52627A]">{{ s.total_tools || 0 }}</td>
          <td class="px-4 py-3.5 text-right">
            <div class="inline-flex items-center gap-1">
              <button class="grid h-8 w-8 place-items-center rounded-lg text-[#94A3B8] hover:bg-slate-100 hover:text-[#475569]"
                      title="Test connection" @click="$emit('test', s)">
                <Activity :size="16" :stroke-width="2" />
              </button>
              <button class="grid h-8 w-8 place-items-center rounded-lg text-[#94A3B8] hover:bg-slate-100 hover:text-[#475569]"
                      title="Refresh tools" @click="$emit('refresh', s)">
                <RefreshCw :size="16" :stroke-width="2" />
              </button>
              <button v-if="!s.is_system_default"
                      class="grid h-8 w-8 place-items-center rounded-lg text-[#94A3B8] hover:bg-red-50 hover:text-red-600"
                      title="Delete" @click="$emit('delete', s)">
                <Trash2 :size="16" :stroke-width="2" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { Server, Activity, RefreshCw, Trash2 } from 'lucide-vue-next'

defineProps({
  servers: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
defineEmits(['test', 'refresh', 'delete'])
</script>
