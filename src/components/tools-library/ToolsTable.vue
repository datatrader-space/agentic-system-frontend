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
          <th class="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-[#52627A]">Tool</th>
          <th class="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wide text-[#52627A]">Type</th>
          <th class="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wide text-[#52627A]">Status</th>
          <th class="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wide text-[#52627A]">Used by</th>
          <th class="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-[#52627A]">Actions</th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading">
          <tr v-for="row in 8" :key="`tool-skeleton-${row}`" class="border-b border-[#EAF0F7] last:border-0">
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
            <td class="px-4 py-3.5"><span class="vm-skel block h-4 w-[58px]"></span></td>
            <td class="px-4 py-3.5 text-right">
              <div class="inline-flex items-center gap-2">
                <span class="vm-skel block h-8 w-8 rounded-lg"></span>
                <span class="vm-skel block h-8 w-8 rounded-lg"></span>
              </div>
            </td>
          </tr>
        </template>
        <tr v-else-if="!tools.length">
          <td colspan="5" class="px-5 py-10 text-center text-sm text-[#94A3B8]">No tools match your filters.</td>
        </tr>

        <tr
          v-for="tool in tools"
          :key="tool.name"
          class="cursor-pointer border-b border-[#EAF0F7] last:border-0 hover:bg-[#F8FAFC]"
          @click="$emit('select', tool)"
        >
          <!-- TOOL -->
          <td class="px-5 py-3.5">
            <div class="flex items-center gap-3">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-[8px]" :class="iconTint(tool)">
                <Icon
                  v-if="iconSpec(tool).kind === 'iconify'"
                  :icon="iconSpec(tool).icon"
                  class="h-5 w-5"
                />
                <component
                  :is="iconSpec(tool).icon"
                  v-else
                  :size="18"
                  :stroke-width="2.1"
                />
              </span>
              <div class="min-w-0 overflow-hidden">
                <p class="truncate text-[13.5px] font-bold text-[#0F172A]">{{ displayName(tool) }}</p>
                <p class="truncate text-[12px] text-[#64748B]">{{ tool.description || '-' }}</p>
              </div>
            </div>
          </td>

          <!-- TYPE -->
          <td class="px-4 py-3.5">
            <span class="block truncate text-[13px] font-medium text-[#52627A]">
              {{ typeBadge(tool).label }}
            </span>
          </td>

          <!-- STATUS -->
          <td class="px-4 py-3.5">
            <span class="inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-1 text-[11.5px] font-bold" :class="statusBadge(tool).cls">
              {{ statusBadge(tool).label }}
            </span>
          </td>

          <!-- USAGE -->
          <td class="truncate px-4 py-3.5 text-[13px] font-medium text-[#52627A]">
            {{ tool.agents_count || 0 }} {{ (tool.agents_count === 1) ? 'agent' : 'agents' }}
          </td>

          <!-- ACTIONS -->
          <td class="px-4 py-3.5 text-right" @click.stop>
            <div class="relative inline-block">
              <button
                class="grid h-9 w-9 place-items-center rounded-[8px] border border-[#DDE6F2] text-[#0F172A] hover:bg-slate-50"
                @click="menuFor = (menuFor === tool.name ? null : tool.name)"
              >
                <MoreVertical :size="17" :stroke-width="2" />
              </button>
              <div
                v-if="menuFor === tool.name"
                class="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-[0_10px_30px_rgba(16,24,40,0.12)]"
              >
                <button class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] text-[#334155] hover:bg-slate-50" @click="act('details', tool)">
                  <Info :size="14" :stroke-width="2" /> View details
                </button>
                <button class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] text-[#334155] hover:bg-slate-50" @click="act('toggle', tool)">
                  <Power :size="14" :stroke-width="2" /> {{ tool.enabled ? 'Disable' : 'Enable' }}
                </button>
                <button
                  v-if="isDeletable(tool)"
                  class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
                  @click="act('delete', tool)"
                >
                  <Trash2 :size="14" :stroke-width="2" /> Delete
                </button>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import {
  MoreVertical, Info, Power, Trash2,
  Bot, Brain, Code2, Database, FileCode, FilePlus2, FileText, Globe, Image,
  Link2, Mail, MessageSquare, Network, Search, Send, Server, Smartphone,
  SquareTerminal, Terminal, UserRound, Wrench,
} from 'lucide-vue-next'

const props = defineProps({
  tools: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'toggle', 'delete'])

const menuFor = ref(null)

function act(kind, tool) {
  menuFor.value = null
  if (kind === 'details') emit('select', tool)
  else if (kind === 'toggle') emit('toggle', tool)
  else if (kind === 'delete') emit('delete', tool)
}

function displayName(tool) {
  if (tool.display_name) return tool.display_name
  return String(tool.name || '')
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// MCP and remote/yaml tools are user-created and deletable.
function isDeletable(tool) {
  return tool.tool_kind === 'yaml' || tool.tool_kind === 'remote' || tool.category === 'mcp'
}

function toolText(tool) {
  return `${tool.name || ''} ${tool.display_name || ''} ${tool.description || ''} ${tool.category || ''}`.toLowerCase()
}

function iconSpec(tool) {
  const text = toolText(tool)
  const cat = (tool.category || '').toLowerCase()

  if (text.includes('slack')) return { kind: 'iconify', icon: 'logos:slack-icon' }
  if (text.includes('notion')) return { kind: 'iconify', icon: 'logos:notion-icon' }
  if (text.includes('github') || text.includes('git hub')) return { kind: 'iconify', icon: 'simple-icons:github' }

  if (text.includes('web search') || text.includes('search web') || text.includes('browser')) return { kind: 'lucide', icon: Globe }
  if (text.includes('code') || text.includes('interpreter') || text.includes('script')) return { kind: 'lucide', icon: Code2 }
  if (text.includes('file reader') || text.includes('read file') || text.includes('document')) return { kind: 'lucide', icon: FileText }
  if (text.includes('append file') || text.includes('write file')) return { kind: 'lucide', icon: FilePlus2 }
  if (text.includes('http') || text.includes('api') || tool.tool_kind === 'remote') return { kind: 'lucide', icon: Link2 }
  if (text.includes('android') || text.includes('phone') || text.includes('tablet')) return { kind: 'lucide', icon: Smartphone }
  if (text.includes('image') || text.includes('media') || text.includes('vision')) return { kind: 'lucide', icon: Image }
  if (text.includes('llm') || text.includes('chat') || text.includes('question')) return { kind: 'lucide', icon: MessageSquare }
  if (text.includes('ask user') || text.includes('user')) return { kind: 'lucide', icon: UserRound }
  if (text.includes('agent') || text.includes('assign tool')) return { kind: 'lucide', icon: Bot }
  if (text.includes('send') || text.includes('message')) return { kind: 'lucide', icon: Send }
  if (text.includes('arp') || text.includes('network')) return { kind: 'lucide', icon: Network }
  if (tool.category === 'mcp' || cat.includes('mcp')) return { kind: 'lucide', icon: Server }
  if (tool.tool_kind === 'yaml') return { kind: 'lucide', icon: FileCode }
  if (cat.includes('data')) return { kind: 'lucide', icon: Database }
  if (cat.includes('knowledge') || cat.includes('search')) return { kind: 'lucide', icon: Search }
  if (cat.includes('memory')) return { kind: 'lucide', icon: Brain }
  if (cat.includes('email') || cat.includes('mail')) return { kind: 'lucide', icon: Mail }
  if (cat.includes('system') || cat.includes('command') || cat.includes('shell')) return { kind: 'lucide', icon: Terminal }
  if (text.includes('terminal') || text.includes('command')) return { kind: 'lucide', icon: SquareTerminal }
  return { kind: 'lucide', icon: Wrench }
}

function iconTint(tool) {
  const text = toolText(tool)
  if (text.includes('slack') || text.includes('notion') || text.includes('github')) return 'bg-white text-[#0F172A] ring-1 ring-[#DDE6F2]'
  if (text.includes('code') || text.includes('interpreter')) return 'bg-emerald-600 text-white'
  if (text.includes('http') || text.includes('api') || text.includes('browser')) return 'bg-violet-600 text-white'
  if (text.includes('image') || text.includes('media') || text.includes('llm')) return 'bg-blue-600 text-white'
  if (text.includes('file') || text.includes('document')) return 'bg-sky-600 text-white'
  if (text.includes('android')) return 'bg-green-600 text-white'
  if (text.includes('network') || text.includes('arp')) return 'bg-cyan-600 text-white'
  const b = typeBadge(tool).key
  if (b === 'mcp') return 'bg-violet-600 text-white'
  if (b === 'custom') return 'bg-violet-600 text-white'
  return 'bg-blue-600 text-white'
}

function typeBadge(tool) {
  if (tool.category === 'mcp') return { key: 'mcp', label: 'MCP Server', cls: 'bg-violet-50 text-violet-700' }
  if (tool.tool_kind === 'remote' || tool.tool_kind === 'yaml') return { key: 'custom', label: 'Custom Tool', cls: 'bg-emerald-50 text-emerald-700' }
  return { key: 'builtin', label: 'Built-in', cls: 'bg-blue-50 text-blue-700' }
}

function statusBadge(tool) {
  const s = tool.status || (tool.enabled ? 'enabled' : 'disabled')
  if (s === 'needs_config') return { label: 'Needs Credential', cls: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' }
  if (s === 'disabled') return { label: 'Disabled', cls: 'border-red-200 bg-red-50 text-red-600', dot: 'bg-red-500' }
  return { label: 'Enabled', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
}
</script>
