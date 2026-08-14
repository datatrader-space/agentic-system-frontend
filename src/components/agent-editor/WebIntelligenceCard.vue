<template>
  <!-- Web Intelligence — how this agent searches the web (WEB_SEARCH broker).
       Saves through its OWN validated endpoint (not the editor's generic Save), because the backend
       must verify the selected search model is capability-verified AND has provider credentials. -->
  <section class="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-sky-50 text-sky-600">
          <Globe :size="18" :stroke-width="2" />
        </span>
        <div>
          <h3 class="text-base font-semibold text-[#0F172A]">Web Intelligence</h3>
          <p class="text-[13px] text-[#64748B]">
            How this agent searches the web. Search engines are used by default; you can also pick a
            dedicated web-search model.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2.5">
        <span v-if="dirty && editable" class="text-[11.5px] font-semibold text-[#B54708]">Unsaved changes</span>
        <button v-if="editable" class="btn-outline" :disabled="!agent.id || saving || !dirty" @click="save">
          <Save :size="14" :stroke-width="2" /> {{ saving ? 'Saving…' : 'Save web settings' }}
        </button>
      </div>
    </div>

    <!-- A brand-new agent has no id yet — the config endpoint is per-agent, so ask for a save first. -->
    <p v-if="!agent.id" class="mt-4 rounded-lg bg-[#F9FAFB] px-3 py-2.5 text-[12.5px] text-[#667085]">
      Create the agent first — web search settings are saved per agent.
    </p>

    <div v-else-if="loading" class="mt-4 h-32 animate-pulse rounded-xl bg-slate-100" />

    <template v-else>
      <!-- Shared/system agents (e.g. the Platform Super Agent) are ONE row for every user: viewers
           see the settings but only the owner or an administrator may change them. -->
      <p v-if="!editable"
         class="mt-4 flex items-start gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2.5 text-[12.5px] text-[#667085]">
        <Lock :size="14" :stroke-width="2" class="mt-0.5 shrink-0" />
        This is a shared agent — its web search settings are managed by its owner or an
        administrator. You can view them here but not change them.
      </p>

      <!-- Master switch -->
      <div class="mt-4 flex items-start justify-between gap-4 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] px-3.5 py-3">
        <div>
          <p class="text-[13px] font-semibold text-[#0F172A]">Enable web search</p>
          <p class="mt-0.5 text-[11.5px] leading-snug text-[#667085]">
            When off, the WEB_SEARCH tool refuses to run for this agent.
          </p>
        </div>
        <button type="button" role="switch" :aria-checked="String(!!cfg.enabled)"
                class="wi-switch shrink-0" :class="cfg.enabled ? 'on' : 'off'"
                @click="editable && (cfg.enabled = !cfg.enabled)"><span class="knob" /></button>
      </div>

      <div v-if="cfg.enabled" class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- ── Left: mode + model ── -->
        <div class="space-y-4">
          <div>
            <label class="field-label">Search mode</label>
            <select v-model="cfg.mode" class="field" :disabled="!editable">
              <option v-for="m in MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
            <p class="mt-1 text-[11.5px] leading-snug text-[#667085]">{{ modeHint }}</p>
          </div>

          <div>
            <div class="mb-1 flex items-center justify-between">
              <label class="field-label mb-0">Web search model</label>
              <button v-if="hasModel && editable" type="button" class="text-[11px] font-semibold text-[#2563EB]"
                      @click="clearModel">Reset to search engines</button>
            </div>
            <select v-model="modelKey" class="field" :disabled="!editable || !groupedModels.length">
              <option value="">Search engines only (no model cost)</option>
              <optgroup v-for="g in groupedModels" :key="g.provider" :label="g.label">
                <option v-for="m in g.models" :key="m.key" :value="m.key" :disabled="!m.available">
                  {{ m.display_name }} — {{ m.search_mode_label }}{{ m.available ? '' : ' (no credentials)' }}
                </option>
              </optgroup>
            </select>
            <p v-if="!groupedModels.length" class="mt-1 text-[11.5px] text-[#667085]">
              No verified web-search models yet.
              <RouterLink to="/dashboard/llm-settings" class="font-semibold text-[#2563EB]">
                Connect an AI provider
              </RouterLink>
              to enable model-based search.
            </p>
            <p v-else class="mt-1 text-[11.5px] leading-snug text-[#667085]">
              Only models verified to actually run a web search appear here. This is separate from the
              agent's main model — use a fast, cheap model for search and keep your reasoning model
              for the answer.
            </p>

            <div v-if="selectedModel" class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2">
              <span class="chip" :class="selectedModel.search_mode === 'native' ? 'chip-blue' : 'chip-amber'">
                {{ selectedModel.search_mode_label }}
              </span>
              <span v-if="selectedModel.citations" class="chip chip-green">Citations</span>
              <span class="text-[11px] text-[#98A2B3]">{{ selectedModel.mechanism }}</span>
              <button type="button" class="ml-auto text-[11.5px] font-semibold text-[#2563EB] disabled:opacity-50"
                      :disabled="probing" @click="probe">
                {{ probing ? 'Testing…' : 'Test this model' }}
              </button>
            </div>
            <p v-if="probeResult" class="mt-1.5 text-[11.5px]"
               :class="probeResult.status === 'verified' ? 'text-[#027A48]' : 'text-[#B42318]'">
              {{ probeResult.status === 'verified' ? 'Verified' : 'Failed' }} — {{ probeResult.detail }}
            </p>
          </div>

          <div>
            <label class="field-label">Preferred search engine</label>
            <select v-model="cfg.engine_provider" class="field" :disabled="!editable">
              <option value="auto">Auto (best available)</option>
              <option value="serper">Serper</option>
              <option value="tavily">Tavily</option>
              <option value="brave">Brave Search</option>
              <option value="google">Google Custom Search</option>
            </select>
            <p class="mt-1 text-[11.5px] leading-snug text-[#667085]">
              Engine keys come from this agent's Credentials step. Image, news, places, video and
              shopping searches always need Serper.
            </p>
          </div>
        </div>

        <!-- ── Right: behaviour + limits ── -->
        <div class="space-y-3">
          <div v-for="t in TOGGLES" :key="t.field"
               class="flex items-start justify-between gap-4 rounded-xl border border-[#EAECF0] px-3.5 py-3">
            <div>
              <p class="text-[12.5px] font-semibold text-[#0F172A]">{{ t.label }}</p>
              <p class="mt-0.5 text-[11.5px] leading-snug text-[#667085]">{{ t.hint }}</p>
            </div>
            <button type="button" role="switch" :aria-checked="String(!!cfg[t.field])"
                    class="wi-switch shrink-0" :class="cfg[t.field] ? 'on' : 'off'"
                    @click="editable && (cfg[t.field] = !cfg[t.field])"><span class="knob" /></button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div v-for="n in NUMBERS" :key="n.field">
              <label class="field-label">{{ n.label }}</label>
              <input v-model.number="cfg[n.field]" type="number" :min="n.min" :max="n.max" class="field" :disabled="!editable" />
              <p class="mt-1 text-[11px] leading-snug text-[#98A2B3]">{{ n.hint }}</p>
            </div>
          </div>

          <div>
            <label class="field-label">Max search cost per turn (USD)</label>
            <input v-model="costLimit" type="number" min="0" step="0.01" class="field"
                   :disabled="!editable" placeholder="No limit" />
            <p class="mt-1 text-[11px] leading-snug text-[#98A2B3]">
              Applies to model-based search only (tokens + per-search charges). Blank = no extra limit
              beyond your run budget.
            </p>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Globe, Lock, Save } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'

const props = defineProps({ agent: { type: Object, required: true } })

const MODES = [
  { value: 'auto', label: 'Auto — recommended',
    hint: 'Picks the best path per request: structured lists and image/news/shopping searches go to a search engine; current-events lookups and research use your search model when one is set.' },
  { value: 'engines_only', label: 'Search engines only',
    hint: 'Always use search engines (Serper, Tavily, Brave, Google). No model tokens are spent on search.' },
  { value: 'native_preferred', label: 'Prefer the search model',
    hint: 'Use the selected web-search model first; fall back to a search engine if it is unavailable (when fallback is on).' },
  { value: 'native_only', label: 'Search model only',
    hint: 'Only the selected model. If it is unavailable the search fails with a clear error instead of silently switching providers.' },
  { value: 'hybrid_verify', label: 'Hybrid — cross-check sources',
    hint: 'Runs the search model AND a search engine, then merges and de-duplicates. Best confidence, highest cost.' },
]

const TOGGLES = [
  { field: 'allow_engine_fallback', label: 'Search engine fallback',
    hint: 'If the search model fails or is unavailable, fall back to a search engine. Ignored in "Search model only" mode.' },
  { field: 'citations_required', label: 'Require citations',
    hint: 'Warn when results come back without source citations, so ungrounded answers are visible.' },
  { field: 'semantic_cache', label: 'Reuse similar searches',
    hint: 'Serve stored evidence for equivalent questions. Freshness is always respected — time-sensitive asks never reuse stale results.' },
]

const NUMBERS = [
  { field: 'max_results', label: 'Max results', min: 1, max: 20, hint: 'Per search, up to 20.' },
  { field: 'max_search_calls_per_turn', label: 'Searches per turn', min: 1, max: 50, hint: 'All searches.' },
  { field: 'max_native_search_calls_per_turn', label: 'Model searches per turn', min: 1, max: 50,
    hint: 'Of those, how many may use the model.' },
]

const loading = ref(true)
const editable = ref(true)      // false for shared/system agents the viewer doesn't own
const saving = ref(false)
const probing = ref(false)
const probeResult = ref(null)
const models = ref([])
const saved = ref('{}')

const cfg = reactive({
  enabled: true, mode: 'auto', engine_provider: 'auto',
  allow_engine_fallback: true, citations_required: true, semantic_cache: true,
  max_results: 10, max_search_calls_per_turn: 5, max_native_search_calls_per_turn: 3,
})
// Kept out of `cfg` so an empty input round-trips as null (no limit) rather than 0.
const costLimit = ref('')
// "provider::model_id" — a single select value across provider groups.
const modelKey = ref('')

const modeHint = computed(() => MODES.find(m => m.value === cfg.mode)?.hint || '')
const hasModel = computed(() => !!modelKey.value)

const groupedModels = computed(() => {
  const groups = new Map()
  for (const m of models.value) {
    const key = `${m.provider}::${m.model_id}`
    if (!groups.has(m.provider)) groups.set(m.provider, { provider: m.provider, label: m.provider_label, models: [] })
    groups.get(m.provider).models.push({ ...m, key })
  }
  return [...groups.values()]
})
const selectedModel = computed(() =>
  groupedModels.value.flatMap(g => g.models).find(m => m.key === modelKey.value) || null)

function snapshot() { return JSON.stringify({ ...payload() }) }
const dirty = computed(() => snapshot() !== saved.value)

function payload() {
  const [provider, model_id] = modelKey.value ? modelKey.value.split('::') : [null, null]
  const cost = String(costLimit.value).trim()
  return {
    ...cfg,
    search_model: provider ? { provider, model_id } : null,
    max_search_cost_per_turn_usd: cost === '' ? null : Number(cost),
  }
}

function clearModel() { modelKey.value = ''; probeResult.value = null }

async function load() {
  if (!props.agent.id) { loading.value = false; return }
  loading.value = true
  try {
    const [cfgRes, modelsRes] = await Promise.all([
      api.getAgentWebIntelligence(props.agent.id),
      api.getWebSearchModels().catch(() => ({ data: { models: [] } })),
    ])
    models.value = modelsRes.data?.models || []
    editable.value = cfgRes.data?.editable !== false
    // Render the EFFECTIVE config (stored values merged with backend defaults) so the form always
    // shows what the agent actually does today, not a half-empty stored blob.
    const eff = cfgRes.data?.effective || {}
    for (const k of Object.keys(cfg)) if (eff[k] !== undefined) cfg[k] = eff[k]
    const sm = eff.search_model || {}
    modelKey.value = sm.provider && sm.model_id ? `${sm.provider}::${sm.model_id}` : ''
    costLimit.value = eff.max_search_cost_per_turn_usd ?? ''
    saved.value = snapshot()
  } catch (e) {
    notify.error('Could not load web search settings')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!props.agent.id || saving.value || !editable.value) return
  saving.value = true
  try {
    const { data } = await api.updateAgentWebIntelligence(props.agent.id, payload())
    props.agent.web_intelligence = data?.config || {}
    saved.value = snapshot()
    notify.success('Web search settings saved')
  } catch (e) {
    // The backend rejects an unverified model / missing credentials by design — surface its reason.
    const err = e?.response?.data || {}
    notify.error(err.detail || (err.problems || []).join(', ') || 'Could not save web search settings')
  } finally {
    saving.value = false
  }
}

async function probe() {
  const m = selectedModel.value
  if (!m || probing.value) return
  probing.value = true
  probeResult.value = null
  try {
    const { data } = await api.probeWebSearchModel(m.provider, m.model_id)
    probeResult.value = data
    if (data.status !== 'verified') await load()   // a failed probe disables the model server-side
  } catch (e) {
    probeResult.value = { status: 'failed', detail: 'Could not reach the provider' }
  } finally {
    probing.value = false
  }
}

watch(() => props.agent.id, load)
onMounted(load)
</script>

<style scoped>
.field-label { margin-bottom: 4px; display: block; font-size: 12px; font-weight: 650; color: #344054; }
.field { width: 100%; border: 1px solid #D0D5DD; border-radius: 10px; padding: 9px 12px; font-size: 13px; color: #0F172A; background: #fff; outline: none; transition: box-shadow .15s, border-color .15s; }
.field:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
.field:disabled { background: #F9FAFB; color: #98A2B3; }
.btn-outline { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #E5E7EB; background: #fff; border-radius: 10px; padding: 8px 13px; font-size: 13px; font-weight: 600; color: #344054; cursor: pointer; }
.btn-outline:hover:not(:disabled) { border-color: #2563EB; color: #2563EB; }
.btn-outline:disabled { opacity: .5; cursor: not-allowed; }
.wi-switch { position: relative; height: 22px; width: 38px; flex-shrink: 0; border-radius: 999px; border: none; cursor: pointer; transition: background .15s; padding: 0; }
.wi-switch.on { background: #2563EB; }
.wi-switch.off { background: #D0D5DD; }
.wi-switch .knob { position: absolute; top: 2px; left: 2px; height: 18px; width: 18px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.2); transition: transform .15s; }
.wi-switch.on .knob { transform: translateX(16px); }
.chip { display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 650; }
.chip-blue { background: #EAF0FF; color: #2563EB; }
.chip-amber { background: #FEF3E2; color: #B54708; }
.chip-green { background: #E6F7EE; color: #027A48; }
</style>
