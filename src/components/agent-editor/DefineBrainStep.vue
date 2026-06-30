<template>
  <div class="mx-auto w-full max-w-[1840px] px-8 pb-10 font-[Inter,system-ui,sans-serif]">
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 class="text-[20px] font-bold tracking-tight text-[#0F172A]">Agent Brain</h2>
        <p class="mt-0.5 text-[13.5px] text-[#64748B]">Define how your agent thinks, responds, and remembers.</p>
      </div>
      <button class="btn-outline"><ExternalLink :size="15" :stroke-width="2" /> Open in Brain</button>
    </div>

    <div class="brain-grid">
      <div class="flex flex-col gap-5">
        <section class="brain-card">
          <header class="card-head">
            <div class="flex items-start gap-3">
              <span class="icon-box bg-violet-50 text-violet-600"><Cpu :size="18" :stroke-width="2" /></span>
              <div>
                <h3 class="card-title">AI Model</h3>
                <p class="card-sub">Choose the model that powers this agent.</p>
              </div>
            </div>
            <button class="edit-btn" @click="toggle('model')"><Pencil :size="13" :stroke-width="2" /> {{ editing.model ? 'Done' : 'Edit' }}</button>
          </header>

          <div v-if="editing.model" class="space-y-3">
            <div>
              <label class="field-label">Provider</label>
              <select v-model="selectedProvider" class="field" @change="onProviderChange">
                <option :value="null">Select a provider...</option>
                <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name || p.provider_type }}</option>
              </select>
            </div>

            <template v-if="selectedProvider != null">
              <div>
                <label class="field-label">Main model</label>
                <ModelPicker
                  :model-value="agent.default_model"
                  :models="filteredModels"
                  placeholder="Search and select a model..."
                  @update:model-value="agent.default_model = $event"
                />
              </div>
              <div class="border-t border-[#F2F4F7] pt-3">
                <p class="text-xs font-semibold text-[#344054]">Capability models <span class="font-normal text-[#98A2B3]">- optional</span></p>
                <p class="mb-2.5 text-[11px] leading-snug text-[#667085]">Use a specialized model for tasks the main model can't do. Leave on Auto to use the main model.</p>
                <div class="space-y-3">
                  <div v-for="c in CAPS" :key="c.field">
                    <div class="mb-1 flex items-center justify-between">
                      <label class="text-[11.5px] font-medium text-[#475569]">{{ c.label }}</label>
                      <button v-if="agent[c.field]" type="button" class="text-[11px] font-semibold text-[#2563EB]" @click="agent[c.field] = null">Reset to Auto</button>
                    </div>
                    <ModelPicker
                      :model-value="agent[c.field]"
                      :models="filteredModels"
                      placeholder="Auto (use main model)"
                      @update:model-value="agent[c.field] = $event"
                    />
                  </div>
                </div>
              </div>
            </template>
            <p v-else class="rounded-lg bg-[#F9FAFB] px-3 py-2.5 text-[12.5px] text-[#667085]">Select a provider to choose a model.</p>

            <!-- Reasoning (per-agent): stream the model's extended thinking into the activity timeline -->
            <div class="border-t border-[#F2F4F7] pt-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <label class="text-[11.5px] font-medium text-[#475569]">Stream model reasoning</label>
                  <p class="mt-0.5 text-[11px] leading-snug text-[#667085]">Shows the model's extended thinking in the activity timeline. Adds token cost + latency; reasoning-capable models only.</p>
                </div>
                <button type="button" role="switch" :aria-checked="String(!!agent.stream_reasoning)"
                        class="mem-switch shrink-0" :class="agent.stream_reasoning ? 'on' : 'off'"
                        @click="agent.stream_reasoning = !agent.stream_reasoning"><span class="knob" /></button>
              </div>
            </div>
          </div>
          <div v-else class="space-y-1.5">
            <div class="flex items-center gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2.5 text-[13px] text-[#344054]">
              <Cpu :size="15" :stroke-width="2" class="text-[#667085]" />
              {{ currentModelLabel || 'No model selected.' }}
            </div>
            <p v-if="capCount" class="text-[11.5px] text-[#667085]">+ {{ capCount }} capability override{{ capCount === 1 ? '' : 's' }}</p>
            <p v-if="agent.stream_reasoning" class="text-[11.5px] text-[#667085]">Reasoning streaming on</p>
          </div>
        </section>

        <section class="brain-card">
          <header class="card-head">
            <div class="flex items-start gap-3">
              <span class="icon-box bg-blue-50 text-blue-600"><ShieldCheck :size="18" :stroke-width="2" /></span>
              <div>
                <h3 class="card-title">Behavioral Rules</h3>
                <p class="card-sub">Set the guidelines and guardrails for agent behavior.</p>
              </div>
            </div>
            <button class="edit-btn" @click="toggle('rules')"><Pencil :size="13" :stroke-width="2" /> {{ editing.rules ? 'Done' : 'Edit' }}</button>
          </header>

          <ul v-if="!editing.rules" class="space-y-2">
            <li v-for="(r, i) in rules" :key="i" class="flex items-start gap-2.5 text-[13px] text-[#344054]">
              <CheckCircle2 :size="16" :stroke-width="2" class="mt-0.5 shrink-0 text-[#2563EB]" /> {{ r }}
            </li>
            <li v-if="!rules.length" class="text-[13px] text-[#667085]">No rules yet.</li>
          </ul>
          <div v-else class="space-y-2">
            <div v-for="(r, i) in rules" :key="i" class="flex items-center gap-2">
              <input v-model="rules[i]" class="field flex-1" placeholder="Add a behavior rule" />
              <button class="icon-x" @click="removeRule(i)"><X :size="15" :stroke-width="2" /></button>
            </div>
            <button class="add-btn" @click="rules.push('')"><Plus :size="14" :stroke-width="2" /> Add rule</button>
          </div>
        </section>

        <section class="brain-card">
          <header class="card-head">
            <div class="flex items-start gap-3">
              <span class="icon-box bg-amber-50 text-amber-600"><Database :size="18" :stroke-width="2" /></span>
              <div>
                <h3 class="card-title">Memory &amp; Context</h3>
                <p class="card-sub">What this agent sees each turn and what it's allowed to remember.</p>
              </div>
            </div>
            <RouterLink to="/dashboard/settings/memory" class="edit-btn"><Settings2 :size="13" :stroke-width="2" /> Account settings</RouterLink>
          </header>

          <!-- Account master is off → everything here is inert. Honest, DB-driven copy (no env/system wording). -->
          <div v-if="masterOff" class="mb-3 flex items-start gap-2 rounded-xl border border-[#FEC84B] bg-[#FFFAEB] px-3.5 py-2.5">
            <Info :size="15" :stroke-width="2" class="mt-0.5 shrink-0 text-[#B54708]" />
            <p class="text-[12.5px] leading-snug text-[#B54708]">
              Memory is turned off in <RouterLink to="/dashboard/settings/memory" class="font-semibold underline">Settings → Memory</RouterLink>. Turn it on there to use any of these.
            </p>
          </div>

          <!-- Conversation Context -->
          <div class="mem-group">
            <p class="mem-group-title">Conversation context</p>
            <div class="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[13px] font-semibold text-[#0F172A]">Choose how much recent chat this agent can see</p>
                  <p class="text-xs text-[#667085]">Auto is recommended.</p>
                </div>
                <div class="seg-pill">
                  <button type="button" class="seg-pill-btn" :class="{ active: !agent.max_history_messages }" @click="agent.max_history_messages = 0">Auto</button>
                  <button type="button" class="seg-pill-btn" :class="{ active: !!agent.max_history_messages }" @click="agent.max_history_messages = agent.max_history_messages || 10">Manual</button>
                </div>
              </div>
              <div v-if="agent.max_history_messages" class="mt-2.5 flex items-center gap-2">
                <label class="text-[12px] font-medium text-[#475569]">Recent messages</label>
                <input v-model.number="agent.max_history_messages" type="number" min="1" class="field !w-24 !py-1.5" />
              </div>
            </div>
          </div>

          <!-- Memory: just the three decisions a user needs. The detailed read/write/project controls live in
               Settings → Memory (linked below). -->
          <div class="mem-group">
            <p class="mem-group-title">Memory</p>
            <div class="overflow-hidden rounded-xl border border-[#EAECF0]">
              <!-- Use my global memory -->
              <div class="flex items-center justify-between gap-3 bg-white px-4 py-3" :class="{ 'opacity-60': masterOff }">
                <div class="min-w-0">
                  <p class="text-[13px] font-semibold text-[#0F172A]">Use my global memory</p>
                  <p class="text-xs text-[#667085]">{{ masterOff ? 'Memory is turned off in Settings.' : 'Let this agent use memories saved in your account.' }}</p>
                </div>
                <button type="button" role="switch" :aria-checked="String(!!agent.use_global_memory)" :disabled="masterOff"
                        class="mem-switch" :class="[agent.use_global_memory ? 'on' : 'off', masterOff ? 'is-disabled' : '']"
                        @click="!masterOff && (agent.use_global_memory = !agent.use_global_memory)"><span class="knob" /></button>
              </div>
              <!-- Allow this agent to remember (master for the agent's own memory) -->
              <div class="flex items-center justify-between gap-3 border-t border-[#F2F4F7] bg-white px-4 py-3" :class="{ 'opacity-60': masterOff }">
                <div class="min-w-0">
                  <p class="text-[13px] font-semibold text-[#0F172A]">Allow this agent to remember</p>
                  <p class="text-xs text-[#667085]">{{ masterOff ? 'Memory is turned off in Settings.' : 'Save useful preferences, rules, and decisions for this agent.' }}</p>
                </div>
                <button type="button" role="switch" :aria-checked="String(allowRemember)" :disabled="masterOff"
                        class="mem-switch" :class="[allowRemember ? 'on' : 'off', masterOff ? 'is-disabled' : '']"
                        @click="toggleAllowRemember()"><span class="knob" /></button>
              </div>
              <!-- Sub-option: Learn at end of runs -->
              <div class="flex items-center justify-between gap-3 border-t border-[#F2F4F7] bg-[#FCFCFD] px-4 py-3 pl-9"
                   :class="{ 'opacity-60': masterOff || !allowRemember }">
                <div class="min-w-0">
                  <p class="text-[13px] font-semibold text-[#0F172A]">Learn at end of runs</p>
                  <p class="text-xs text-[#667085]">After a completed task, the agent can save useful lessons automatically.</p>
                </div>
                <button type="button" role="switch" :aria-checked="String(!!agent.end_of_run_learning_enabled)"
                        :disabled="masterOff || !allowRemember"
                        class="mem-switch" :class="[agent.end_of_run_learning_enabled ? 'on' : 'off', (masterOff || !allowRemember) ? 'is-disabled' : '']"
                        @click="(!masterOff && allowRemember) && (agent.end_of_run_learning_enabled = !agent.end_of_run_learning_enabled)"><span class="knob" /></button>
              </div>
            </div>
            <RouterLink to="/dashboard/settings/memory" class="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#2563EB]">
              Manage all memory settings <ArrowRight :size="13" :stroke-width="2.2" />
            </RouterLink>
          </div>

          <!-- What this agent remembers: its memory summary + rows (agent scope only) -->
          <div v-if="agent.id" class="mem-group">
            <p class="mem-group-title">What this agent remembers</p>
            <!-- summary is being (re)generated -->
            <div v-if="agentMemLoading" class="mb-2.5 flex items-center gap-2 rounded-xl border border-[#EAECF0] bg-[#F8FAFC] px-4 py-3 text-[12.5px] font-semibold text-[#4F46E5]">
              <span class="dg-spin" /> Memory summary is being generated…
            </div>
            <div v-else-if="agentSummary && agentSummary.content" class="rounded-xl border border-[#EAECF0] bg-[#F8FAFC] px-4 py-3 mb-2.5">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">Agent memory summary</span>
                <span class="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10.5px] font-bold text-[#4F46E5]">{{ agentSummary.mode === 'compressed' ? 'AI-compressed' : 'Exact' }} · {{ agentSummary.source_count }}</span>
              </div>
              <p class="whitespace-pre-wrap text-[12.5px] leading-5 text-[#475569]">{{ agentSummary.content }}</p>
            </div>

            <div v-if="agentMemLoading" class="px-1 py-2 text-xs text-[#98A2B3]">Loading memories…</div>
            <div v-else-if="!agentMemRows.length" class="px-1 py-2 text-xs text-[#98A2B3]">No agent memories yet — they appear here as the agent learns or you save them.</div>
            <template v-else>
              <ul class="overflow-hidden rounded-xl border border-[#EAECF0]">
                <li v-for="(m, i) in pagedAgentMem" :key="m.id"
                    class="flex items-start gap-2.5 bg-white px-4 py-2.5" :class="i > 0 ? 'border-t border-[#F2F4F7]' : ''">
                  <span class="mt-0.5 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">{{ m.kind }}</span>
                  <p class="min-w-0 flex-1 text-[12.5px] leading-5 text-[#344054]">{{ m.content }}</p>
                </li>
              </ul>
              <div v-if="agentMemRows.length > AGENT_PAGE_SIZE" class="mt-2 flex items-center justify-center gap-3">
                <button type="button" class="mem-pg-btn" :disabled="agentMemPage <= 1" @click="agentMemPage--">Prev</button>
                <span class="text-[11px] text-[#98A2B3]">{{ agentMemPage }} / {{ agentMemPages }} · {{ agentMemRows.length }} total</span>
                <button type="button" class="mem-pg-btn" :disabled="agentMemPage >= agentMemPages" @click="agentMemPage++">Next</button>
              </div>
            </template>
          </div>
        </section>
      </div>

      <div class="flex flex-col gap-5">
        <section class="brain-card">
          <header class="card-head">
            <div class="flex items-start gap-3">
              <span class="icon-box bg-emerald-50 text-emerald-600"><FileText :size="18" :stroke-width="2" /></span>
              <div>
                <h3 class="card-title">System Prompt</h3>
                <p class="card-sub">Provide the agent with instructions and context for how to behave.</p>
              </div>
            </div>
            <button class="edit-btn" @click="toggle('prompt')"><Pencil :size="13" :stroke-width="2" /> {{ editing.prompt ? 'Done' : 'Edit' }}</button>
          </header>
          <textarea v-if="editing.prompt" v-model="agent.system_prompt_template" rows="12" placeholder="You are a helpful AI assistant..." class="field min-h-[260px]" />
          <div v-else class="content-box min-h-[260px]">
            <p class="whitespace-pre-wrap text-[13px] leading-6 text-[#344054]">{{ promptPreview }}</p>
            <button v-if="isLongPrompt" class="mt-4 text-[12.5px] font-semibold text-[#2563EB]" @click="showFull = !showFull">
              {{ showFull ? 'Show less' : 'Show more' }}
            </button>
          </div>
        </section>

        <section class="brain-card">
          <header class="card-head">
            <div class="flex items-start gap-3">
              <span class="icon-box bg-blue-50 text-blue-600"><Activity :size="18" :stroke-width="2" /></span>
              <div>
                <h3 class="card-title">Response Style</h3>
                <p class="card-sub">Set the tone, language, and style of agent responses.</p>
              </div>
            </div>
            <button class="edit-btn" @click="toggle('style')"><Pencil :size="13" :stroke-width="2" /> {{ editing.style ? 'Done' : 'Edit' }}</button>
          </header>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="s in STYLE_TAGS"
              :key="s"
              :disabled="!editing.style"
              class="rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition"
              :class="styleSet.has(s) ? 'border-[#2563EB] bg-[#EAF0FF] text-[#2563EB]' : 'border-[#E5E7EB] bg-white text-[#667085]'"
              @click="editing.style && toggleStyle(s)"
            >{{ s }}</button>
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
            <span class="font-semibold text-[#344054]">Tone:</span>
            <input v-if="editing.style" v-model="tone" class="field min-w-[260px] flex-1" placeholder="e.g., Professional and approachable" />
            <span v-else class="text-[#475569]">{{ tone || 'Professional and approachable' }}</span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Activity, ArrowRight, CheckCircle2, Cpu, Database, ExternalLink, FileText, Info, Pencil, Plus, Settings2, ShieldCheck, X } from 'lucide-vue-next'
import api from '../../services/api'
import ModelPicker from '../common/ModelPicker.vue'

const props = defineProps({ agent: { type: Object, required: true } })

const editing = reactive({ model: false, prompt: false, rules: false, memory: false, style: false })
const toggle = (k) => { editing[k] = !editing[k] }

// ── Memory & Context ────────────────────────────────────────────────────────────
// Per-agent fields live on the agent (PATCHed by the editor's save()). The ACCOUNT master switch lives on
// UserMemorySettings — we read it only to honestly disable/explain (no env/system-policy wording).
const account = ref(null)
const masterOff = computed(() => account.value && account.value.memory_enabled === false)

// "Allow this agent to remember" is the single, user-facing switch for the agent's OWN memory. It drives the
// detailed backend fields (read/write/project) together, so the user never sees them. The fine-grained
// controls live in Settings → Memory. "Use my global memory" is independent (account-wide memories).
const allowRemember = computed(() => !!props.agent.structured_memory_enabled)

function toggleAllowRemember() {
  if (masterOff.value) return
  const on = !allowRemember.value
  props.agent.structured_memory_enabled = on
  props.agent.memory_read_enabled = on
  props.agent.memory_write_enabled = on
  props.agent.use_project_memory = on
  // Turning the master off also stops end-of-run learning; turning it on enables it by default.
  props.agent.end_of_run_learning_enabled = on
}

// What this agent remembers — its memory summary + agent-scope rows (5 per page).
const AGENT_PAGE_SIZE = 5
const agentSummary = ref(null)
const agentMemRows = ref([])
const agentMemLoading = ref(false)
const agentMemPage = ref(1)
const agentMemPages = computed(() => Math.max(1, Math.ceil(agentMemRows.value.length / AGENT_PAGE_SIZE)))
const pagedAgentMem = computed(() => {
  const start = (agentMemPage.value - 1) * AGENT_PAGE_SIZE
  return agentMemRows.value.slice(start, start + AGENT_PAGE_SIZE)
})
async function loadAgentMemory() {
  if (!props.agent.id) return
  agentMemLoading.value = true
  try {
    const [sum, rows] = await Promise.all([
      api.getAgentMemoryDigest(props.agent.id).catch(() => ({ data: null })),
      api.getAgentMemory(props.agent.id, { scope: 'agent' }).catch(() => ({ data: { memories: [] } })),
    ])
    agentSummary.value = sum.data
    agentMemRows.value = (rows.data && rows.data.memories) || []
    if (agentMemPage.value > agentMemPages.value) agentMemPage.value = agentMemPages.value
  } catch (e) {
    agentSummary.value = null; agentMemRows.value = []
  } finally {
    agentMemLoading.value = false
  }
}

const models = ref([])
const providers = ref([])
const selectedProvider = ref(null)

const CAPS = [
  { field: 'image_model', label: 'Image generation' },
  { field: 'vision_model', label: 'Image input (vision)' },
  { field: 'audio_model', label: 'Audio generation' },
  { field: 'video_model', label: 'Video generation' },
]
const capCount = computed(() => CAPS.filter(c => props.agent[c.field]).length)

const modelProvider = (m) => m.provider ?? m.provider_id ?? (m.provider && m.provider.id) ?? null
const filteredModels = computed(() =>
  selectedProvider.value == null ? models.value : models.value.filter(m => modelProvider(m) === selectedProvider.value)
)
function onProviderChange() {
  const ok = new Set(filteredModels.value.map(m => m.id))
  if (props.agent.default_model && !ok.has(props.agent.default_model)) props.agent.default_model = null
  for (const c of CAPS) if (props.agent[c.field] && !ok.has(props.agent[c.field])) props.agent[c.field] = null
}

function modelLabel(m) {
  const name = m.display_name || m.model_id || m.name || `Model ${m.id}`
  const provider = m.provider_name || (m.provider && m.provider.name) || m.provider_type || ''
  return provider ? `${provider} - ${name}` : name
}
const currentModelLabel = computed(() => {
  const id = props.agent.default_model
  const hit = models.value.find(m => m.id === id)
  if (hit) return modelLabel(hit)
  return props.agent.default_model_name || ''
})

onMounted(async () => {
  try {
    const [mRes, pRes] = await Promise.all([api.get('/llm/models/'), api.get('/llm/providers/')])
    models.value = Array.isArray(mRes.data) ? mRes.data : (mRes.data?.results || [])
    providers.value = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.results || [])
    const cur = models.value.find(m => m.id === props.agent.default_model)
    if (cur) selectedProvider.value = modelProvider(cur)
  } catch (e) {
    models.value = []
    providers.value = []
  }
  // Account master switch — read-only here; controls live in Settings → Memory. Failure = assume on.
  try { account.value = (await api.getMemorySettings()).data } catch (e) { account.value = null }
  loadAgentMemory()
})

const showFull = ref(false)
const isLongPrompt = computed(() => (props.agent.system_prompt_template || '').length > 240)
const promptPreview = computed(() => {
  const p = props.agent.system_prompt_template || 'No system prompt set yet.'
  return (!showFull.value && isLongPrompt.value) ? p.slice(0, 240) + '...' : p
})

const rules = ref(normalizeRules(props.agent.agent_rules))
function normalizeRules(v) {
  if (Array.isArray(v)) return v.map(r => (typeof r === 'string' ? r : (r && (r.text || r.rule || r.description)) || '')).filter(Boolean)
  if (typeof v === 'string' && v.trim()) return v.split('\n').map(s => s.trim()).filter(Boolean)
  return []
}
function removeRule(i) { rules.value.splice(i, 1) }
watch(rules, (v) => { props.agent.agent_rules = v.filter(r => (r || '').trim()) }, { deep: true })

// Response Style — bound to agent.response_style ({ tags: [...], tone: '...' }), persisted via PATCH.
const STYLE_TAGS = ['Professional', 'Friendly', 'Clear', 'Helpful', 'Concise']
const _initStyle = (props.agent.response_style && typeof props.agent.response_style === 'object' && !Array.isArray(props.agent.response_style)) ? props.agent.response_style : {}
const styleSet = ref(new Set(Array.isArray(_initStyle.tags) ? _initStyle.tags : []))
const tone = ref(_initStyle.tone || '')
function syncStyle() {
  props.agent.response_style = { tags: [...styleSet.value], tone: (tone.value || '').trim() }
}
function toggleStyle(s) {
  styleSet.value.has(s) ? styleSet.value.delete(s) : styleSet.value.add(s)
  styleSet.value = new Set(styleSet.value)
  syncStyle()
}
watch(tone, syncStyle)
</script>

<style scoped>
.brain-card { border: 1px solid #E5E7EB; background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.brain-grid { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); gap: 20px; }
.card-head { margin-bottom: 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.icon-box { display: grid; height: 36px; width: 36px; flex-shrink: 0; place-items: center; border-radius: 10px; }
.card-title { font-size: 14.5px; font-weight: 650; color: #0F172A; }
.card-sub { font-size: 12px; color: #667085; }
.content-box { border: 1px solid #EAECF0; border-radius: 12px; background: #F9FAFB; padding: 14px; }
.field-label { margin-bottom: 4px; display: block; font-size: 12px; font-weight: 650; color: #344054; }
.field { width: 100%; border: 1px solid #D0D5DD; border-radius: 10px; padding: 9px 12px; font-size: 13px; color: #0F172A; background: #fff; outline: none; transition: box-shadow .15s, border-color .15s; }
.field:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
.edit-btn { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #E5E7EB; background: #fff; border-radius: 9px; padding: 5px 11px; font-size: 12.5px; font-weight: 600; color: #344054; cursor: pointer; white-space: nowrap; }
.edit-btn:hover { border-color: #2563EB; color: #2563EB; }
.btn-outline { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #E5E7EB; background: #fff; border-radius: 10px; padding: 8px 13px; font-size: 13px; font-weight: 600; color: #344054; cursor: pointer; }
.btn-outline:hover { border-color: #cdd5e0; color: #0F172A; }
.icon-x { display: grid; place-items: center; height: 30px; width: 30px; border-radius: 8px; border: 1px solid #E5E7EB; background: #fff; color: #667085; cursor: pointer; }
.icon-x:hover { border-color: #F04438; color: #F04438; }
.add-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: #2563EB; background: none; border: none; cursor: pointer; padding: 4px 0; }
.mem-group { margin-bottom: 14px; }
.mem-group:last-child { margin-bottom: 0; }
.mem-group-title { margin-bottom: 7px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #98A2B3; }
.mem-switch { position: relative; height: 22px; width: 38px; flex-shrink: 0; border-radius: 999px; border: none; cursor: pointer; transition: background .15s; padding: 0; }
.mem-switch.on { background: #2563EB; }
.mem-switch.off { background: #D0D5DD; }
.mem-switch .knob { position: absolute; top: 2px; left: 2px; height: 18px; width: 18px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.2); transition: transform .15s; }
.mem-switch.on .knob { transform: translateX(16px); }
.mem-switch.is-disabled { opacity: .45; cursor: not-allowed; }
.seg-pill { display: inline-flex; flex-shrink: 0; padding: 3px; background: #F2F4F7; border-radius: 9px; }
.seg-pill-btn { padding: 5px 14px; font-size: 12.5px; font-weight: 600; color: #667085; background: transparent; border: none; border-radius: 7px; cursor: pointer; transition: .15s; }
.seg-pill-btn.active { background: #fff; color: #2563EB; box-shadow: 0 1px 2px rgba(16,24,40,.1); }
.mem-pg-btn { padding: 4px 11px; font-size: 11.5px; font-weight: 600; color: #344054; background: #fff; border: 1px solid #E5E7EB; border-radius: 7px; cursor: pointer; }
.mem-pg-btn:hover:not(:disabled) { border-color: #2563EB; color: #2563EB; }
.mem-pg-btn:disabled { opacity: .45; cursor: not-allowed; }
.dg-spin { width: 13px; height: 13px; border: 2px solid #c7d2fe; border-top-color: #4f46e5; border-radius: 50%; animation: dg-rot 0.7s linear infinite; display: inline-block; }
@keyframes dg-rot { to { transform: rotate(360deg); } }
@media (max-width: 900px) {
  .brain-grid { grid-template-columns: 1fr; }
}
</style>
