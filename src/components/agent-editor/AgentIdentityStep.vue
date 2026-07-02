<template>
  <div class="mx-auto w-full max-w-[1840px] px-6 pb-8 font-[Inter,system-ui,sans-serif]">
    <header v-if="isNew" class="mb-6 text-center">
      <h2 class="text-[28px] font-bold tracking-tight text-[#0F172A]">Let's build your agent</h2>
      <p class="mt-2 text-[15px] text-[#64748B]">Choose a starting point and confirm the basics for this agent.</p>
    </header>
    <header v-else class="mx-auto mb-5 max-w-[1120px]">
      <h2 class="text-[20px] font-bold tracking-tight text-[#0F172A]">Agent Identity</h2>
      <p class="mt-0.5 text-[13.5px] text-[#64748B]">Your agent's name, purpose, and where it lives.</p>
    </header>

    <section v-if="isNew" class="mx-auto mb-5 max-w-[1120px]">
      <p class="mb-3 text-[13px] font-semibold text-[#0F172A]">Choose a starting point</p>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <button
          v-for="template in visibleTemplates"
          :key="template.key"
          type="button"
          class="relative min-h-[144px] rounded-xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#2563EB]"
          :class="selectedTemplate === template.key ? 'border-[#2563EB] ring-1 ring-[#2563EB]' : 'border-[#E5E7EB]'"
          @click="selectTemplate(template)"
        >
          <span class="grid h-12 w-12 place-items-center rounded-xl" :class="template.tint">
            <component :is="template.icon" :size="25" :stroke-width="2" />
          </span>
          <span class="mt-5 block text-[15px] font-semibold text-[#0F172A]">{{ template.title }}</span>
          <span class="mt-2 block text-[13px] leading-5 text-[#475569]">{{ template.desc }}</span>
          <span class="absolute right-5 top-5 grid h-5 w-5 place-items-center rounded-full border"
                :class="selectedTemplate === template.key ? 'border-[#2563EB] bg-[#2563EB] text-white' : 'border-[#CBD5E1] bg-white text-transparent'">
            <Check :size="13" :stroke-width="3" />
          </span>
        </button>
      </div>
      <div class="mt-4 flex justify-center">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-[10px] border border-[#C7D7F7] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#2563EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-[#2563EB] hover:bg-[#EFF4FF]"
          @click="router.push({ name: 'builtin-agent-library' })"
        >
          View all built-in agents to clone
          <ArrowRight :size="15" :stroke-width="2" />
        </button>
      </div>
    </section>

    <section class="mx-auto max-w-[1120px] rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <h3 class="mb-4 text-base font-semibold text-[#0F172A]">Agent basics</h3>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1.5 block text-[13px] font-semibold text-[#344054]">Agent name</label>
          <input v-model="agent.name" type="text" placeholder="e.g., My Lead Intake Agent" class="field" />
          <p class="mt-1.5 text-xs text-[#667085]">Choose a clear, descriptive name for your agent.</p>
        </div>
        <div>
          <label class="mb-1.5 block text-[13px] font-semibold text-[#344054]">Purpose</label>
          <input v-model="agent.description" type="text" placeholder="e.g., Qualify leads and route to the right team" class="field" />
          <p class="mt-1.5 text-xs text-[#667085]">What will this agent do?</p>
        </div>
      </div>

      <div class="mt-4">
        <label class="mb-1.5 block text-[13px] font-semibold text-[#344054]">Workspace</label>
        <select v-model="selectedWorkspace" class="field">
          <option :value="null">Select a workspace</option>
          <option v-for="w in workspaces" :key="w.id" :value="w.id">{{ w.org_name ? `${w.org_name} · ${w.name}` : w.name }}</option>
        </select>
        <p class="mt-1.5 text-xs text-[#667085]">Choose where this agent will live and which data it can access.</p>
      </div>
    </section>

    <section v-if="isNew" class="mx-auto mt-5 flex max-w-[1120px] items-center justify-between gap-4 rounded-xl border border-[#DCE6FB] bg-[#EFF4FF] px-5 py-4">
      <div class="flex items-start gap-3">
        <Lightbulb :size="20" :stroke-width="2" class="mt-0.5 shrink-0 text-[#2563EB]" />
        <div>
          <p class="text-[13.5px] font-semibold text-[#0F172A]">Not sure where to start?</p>
          <p class="text-[13px] text-[#475569]">You can always modify your agent later. Start simple, add more as you go. Pick a template above for a head start.</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Check, ChevronDown, Database, FileText, Lightbulb, MessageCircle, Plus, Search, Sparkles, Users } from 'lucide-vue-next'
import api from '../../services/api'
import tenancyApi from '../../services/tenancyApi'

const router = useRouter()
const props = defineProps({
  agent: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
})

const workspaces = ref([])
const selectedWorkspace = ref(props.agent.workspace ?? null)
const selectedTemplate = ref('blank')
const showMoreTemplates = ref(false)

// Real built-in templates (GET /agents/templates/) — cards are data-driven, with cycled icons/tints.
const fetchedTemplates = ref([])
const ICONS = [Users, Search, MessageCircle, Sparkles, FileText, Database, Plus]
const TINTS = ['bg-emerald-50 text-emerald-600', 'bg-violet-50 text-violet-600', 'bg-orange-50 text-orange-600', 'bg-cyan-50 text-cyan-600', 'bg-indigo-50 text-indigo-600', 'bg-rose-50 text-rose-600', 'bg-slate-100 text-slate-600']
const templates = computed(() => [
  { key: 'blank', title: 'Start from blank', desc: 'Build a custom agent from scratch', icon: Plus, tint: 'bg-blue-50 text-blue-600', raw: null },
  ...fetchedTemplates.value.map((t, i) => ({
    key: t.id,
    title: t.name,
    desc: t.template_description || t.description || 'Pre-built agent template',
    icon: ICONS[i % ICONS.length],
    tint: TINTS[i % TINTS.length],
    raw: t,
  })),
])
const visibleTemplates = computed(() => showMoreTemplates.value ? templates.value : templates.value.slice(0, 4))

// Selecting a real template applies its actual config as a starting point (user can still edit).
function selectTemplate(template) {
  selectedTemplate.value = template.key
  const t = template.raw
  if (!t) return // "Start from blank" — apply nothing
  if (t.system_prompt_template) props.agent.system_prompt_template = t.system_prompt_template
  if (!props.agent.description) props.agent.description = t.template_description || t.description || ''
  if (t.prompt_mode) props.agent.prompt_mode = t.prompt_mode
  if (Array.isArray(t.agent_rules)) props.agent.agent_rules = [...t.agent_rules]
  if (Array.isArray(t.tools)) props.agent.tool_ids = t.tools.map(x => x.id)
}

watch(selectedWorkspace, (id) => { props.agent.workspace = id })

onMounted(async () => {
  try {
    // Tenancy workspaces (agent.workspace is a FK to tenancy.Workspace) — the same
    // workspaces shown in the Organization page / workspace switcher. NOTE: the legacy
    // /api/workspaces/ endpoint returns Let's-Code WorkspaceConnection rows instead and
    // would never match this FK, so we go through the v2 tenancy API here.
    const res = await tenancyApi.getAllWorkspaces()
    workspaces.value = Array.isArray(res.data) ? res.data : (res.data?.results || [])
  } catch (e) {
    workspaces.value = []
  }
  try {
    const r = await api.listAgentTemplates()
    fetchedTemplates.value = Array.isArray(r.data) ? r.data : (r.data?.results || [])
  } catch (e) {
    fetchedTemplates.value = []
  }
})
</script>

<style scoped>
.field { width: 100%; border: 1px solid #D0D5DD; border-radius: 10px; padding: 10px 12px; font-size: 13.5px; color: #0F172A; background: #fff; outline: none; transition: box-shadow .15s, border-color .15s; }
.field:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
</style>
