<template>
  <transition name="drawer">
    <div v-if="open" class="fixed inset-0 z-40 flex justify-end" @keydown.esc="$emit('close')">
      <div class="absolute inset-0 bg-slate-900/30" @click="$emit('close')" />

      <div class="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <!-- Header -->
        <div class="flex items-start justify-between gap-3 border-b border-[#EEF1F4] px-5 py-4">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl" :class="iconTint">
              <component :is="Wrench" :size="19" :stroke-width="2" />
            </span>
            <div class="min-w-0">
              <p class="truncate text-[15px] font-bold text-[#0F172A]">{{ name }}</p>
              <p class="truncate text-[12px] text-[#64748B]">{{ tool?.category || '—' }}</p>
            </div>
          </div>
          <button class="grid h-8 w-8 place-items-center rounded-lg text-[#94A3B8] hover:bg-slate-100" @click="$emit('close')">
            <X :size="18" :stroke-width="2" />
          </button>
        </div>

        <div class="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <!-- Badges -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" :class="typeBadge.cls">{{ typeBadge.label }}</span>
            <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" :class="statusBadge.cls">
              <span class="h-1.5 w-1.5 rounded-full" :class="statusBadge.dot" />
              {{ statusBadge.label }}
            </span>
          </div>

          <!-- Description -->
          <section>
            <h4 class="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Description</h4>
            <p class="mt-1.5 text-[13px] leading-relaxed text-[#475569]">{{ detail?.description || tool?.description || 'No description provided.' }}</p>
          </section>

          <!-- Used by N agents -->
          <section>
            <div class="flex items-center justify-between">
              <h4 class="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Used by</h4>
              <button class="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] hover:underline" @click="goAgents()">
                View in Agents <ArrowUpRight :size="13" :stroke-width="2.4" />
              </button>
            </div>
            <p class="mt-1.5 text-[13px] text-[#475569]">
              <span class="font-semibold text-[#0F172A]">{{ usageCount }}</span> {{ usageCount === 1 ? 'agent' : 'agents' }}
            </p>
            <ul v-if="usageAgents.length" class="mt-2 space-y-1.5">
              <li v-for="a in usageAgents" :key="a.id">
                <button class="flex w-full items-center justify-between rounded-lg border border-[#EEF1F4] px-3 py-2 text-left hover:bg-slate-50" @click="goAgent(a.id)">
                  <span class="truncate text-[13px] font-medium text-[#334155]">{{ a.name }}</span>
                  <span class="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        :class="a.publish_status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                    {{ a.publish_status }}
                  </span>
                </button>
              </li>
            </ul>
            <p v-else-if="!usageLoading" class="mt-2 text-[12.5px] text-[#94A3B8]">Not assigned to any of your agents yet.</p>
          </section>

          <!-- Parameters / schema -->
          <section v-if="parameters.length">
            <h4 class="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Parameters</h4>
            <div class="mt-2 space-y-2">
              <div v-for="p in parameters" :key="p.name" class="rounded-lg border border-[#EEF1F4] px-3 py-2">
                <div class="flex items-center gap-2">
                  <code class="text-[12.5px] font-semibold text-[#0F172A]">{{ p.name }}</code>
                  <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-[#64748B]">{{ p.type }}</span>
                  <span v-if="p.required" class="rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">required</span>
                </div>
                <p v-if="p.description" class="mt-1 text-[12px] text-[#64748B]">{{ p.description }}</p>
              </div>
            </div>
          </section>

          <!-- Raw schema -->
          <section v-if="schemaJson">
            <h4 class="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Schema</h4>
            <pre class="mt-2 max-h-60 overflow-auto rounded-lg border border-[#EEF1F4] bg-[#0F172A] p-3 text-[11.5px] leading-relaxed text-slate-100">{{ schemaJson }}</pre>
          </section>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between gap-2 border-t border-[#EEF1F4] px-5 py-3.5">
          <button
            class="inline-flex items-center gap-2 rounded-[11px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-[13px] font-medium text-[#475569] hover:border-slate-300"
            @click="$emit('toggle', tool)"
          >
            <Power :size="15" :stroke-width="2" />
            {{ tool?.enabled ? 'Disable' : 'Enable' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { X, Wrench, Power, ArrowUpRight } from 'lucide-vue-next'

const props = defineProps({
  open: { type: Boolean, default: false },
  tool: { type: Object, default: null },          // row from list
  detail: { type: Object, default: null },        // /tools/<name>/ payload
  usage: { type: Object, default: null },          // /tools/<name>/agents/ payload
  usageLoading: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'toggle'])
const router = useRouter()

const name = computed(() => props.tool?.display_name || props.tool?.name || props.detail?.name || '')
const parameters = computed(() => props.detail?.parameters || props.tool?.parameters || [])
const usageAgents = computed(() => props.usage?.agents || [])
const usageCount = computed(() => props.usage?.count ?? props.tool?.agents_count ?? 0)

const schemaJson = computed(() => {
  const s = props.detail?.params_schema || props.detail?.schema
  if (!s) return ''
  try { return JSON.stringify(s, null, 2) } catch { return '' }
})

const typeBadge = computed(() => {
  const t = props.tool || {}
  if (t.category === 'mcp') return { label: 'MCP Server', cls: 'bg-violet-50 text-violet-700' }
  if (t.tool_kind === 'remote' || t.tool_kind === 'yaml') return { label: 'Custom', cls: 'bg-emerald-50 text-emerald-700' }
  return { label: 'Built-in', cls: 'bg-blue-50 text-blue-700' }
})

const iconTint = computed(() => {
  const t = props.tool || {}
  if (t.category === 'mcp') return 'bg-violet-50 text-violet-600'
  if (t.tool_kind === 'remote' || t.tool_kind === 'yaml') return 'bg-emerald-50 text-emerald-600'
  return 'bg-blue-50 text-blue-600'
})

const statusBadge = computed(() => {
  const s = props.tool?.status || (props.tool?.enabled ? 'enabled' : 'disabled')
  if (s === 'needs_config') return { label: 'Needs Configuration', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' }
  if (s === 'disabled') return { label: 'Disabled', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' }
  return { label: 'Enabled', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
})

function goAgents() {
  router.push({ name: 'dashboard-agents' })
}
function goAgent(id) {
  router.push({ name: 'dashboard-agent-overview', params: { id } })
}
</script>

<style scoped>
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.18s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
</style>
