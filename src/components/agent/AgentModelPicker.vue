<!--
  Compact chat model picker for shared/system-owned agents: summary card -> one searchable list of every chat model
  the person may use. There is no provider step and no provider is named anywhere (owner, 2026-10-29): people choose
  a model, never the provider AADML runs it on.
-->
<template>
  <div v-if="agentId" class="amp">
    <button
      type="button"
      class="amp-btn"
      :class="{ 'amp-on': source === 'override' }"
      :title="current ? `Model: ${current.name}` : 'Choose the model this chat runs on'"
      aria-haspopup="menu"
      :aria-expanded="open ? 'true' : 'false'"
      data-test="model-picker-trigger"
      @click="toggle"
    >
      <svg class="amp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>
      <span class="amp-label">{{ pillLabel }}</span>
      <svg class="amp-caret" :class="{ open }" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" clip-rule="evenodd"/></svg>
    </button>

    <div v-if="open" class="amp-menu" role="menu" data-test="model-picker-menu" @click.stop>
      <div v-if="loading" class="amp-state">Loading your models…</div>

      <div v-else-if="!modelCount && !current" class="amp-state">
        <p><strong>No AI model is available yet.</strong></p>
        <p>The platform's AI models are added by a platform administrator. Usage is charged to your balance.</p>
        <router-link class="amp-cta" to="/dashboard/billing" @click="close">
          Open Billing →
        </router-link>
      </div>

      <template v-else>
        <div class="amp-current">
          <span class="amp-current-body">
            <span class="amp-current-name">{{ current?.name || 'Choose a model' }}</span>
            <span class="amp-current-desc">{{ currentMeta }}</span>
          </span>
          <svg v-if="current" class="amp-current-check" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-label="Selected"><path d="m4 10 4 4 8-8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>

        <div class="amp-divider"></div>

        <button
          type="button"
          class="amp-more"
          :class="{ active: showModels }"
          aria-haspopup="listbox"
          :aria-expanded="showModels ? 'true' : 'false'"
          data-test="model-picker-models"
          @click="toggleModels"
        >
          <span>Model</span>
          <span class="amp-more-value">{{ modelCount }} available</span>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m8 5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>

        <div class="amp-divider"></div>

        <!-- Run MODE. Shared agents show it here rather than in a separate pill: this agent is ONE row
             serving every user, so the mode is a per-user setting resolved alongside their model and
             effort. Writes go to the caller's override row, never the shared profile. -->
        <div class="amp-mode" role="group" aria-label="Run mode">
          <div class="amp-mode-head">
            <span class="amp-mode-title">Mode</span>
            <span class="amp-mode-value">{{ modeLabel }}</span>
          </div>
          <button v-for="opt in modeOptions" :key="opt.key" type="button" class="amp-mode-item"
                  :class="{ 'is-on': opt.active }" :disabled="modeSaving"
                  :aria-pressed="opt.active ? 'true' : 'false'"
                  :data-test="'model-picker-mode-' + opt.key" @click.stop="pickMode(opt)">
            <span class="amp-mode-icon">{{ opt.icon }}</span>
            <span class="amp-mode-body">
              <span class="amp-mode-name">{{ opt.title }}</span>
              <span class="amp-mode-desc">{{ opt.desc }}</span>
            </span>
            <svg v-if="opt.active" class="amp-mode-check" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
          </button>
          <div v-if="modeError" class="amp-error" role="alert">{{ modeError }}</div>
        </div>

        <div class="amp-divider"></div>
        <!-- Per-turn thinking effort: a model setting, so it sits with the model. -->
        <EffortSlider :options="reasoningOptions" />

        <div v-if="error" class="amp-error" role="alert">{{ error }}</div>

        <div
          v-if="showModels"
          class="amp-model-flyout"
          role="dialog"
          aria-label="Chat models"
          data-test="model-picker-model-flyout"
        >
          <button type="button" class="amp-card-title amp-model-back" @click="closeModelCard">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 5-5 5 5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Models</span>
          </button>

          <div class="amp-model-search">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4" stroke-linecap="round"/></svg>
            <input
              ref="modelSearchEl"
              v-model="modelQuery"
              type="search"
              placeholder="Search models…"
              aria-label="Search models"
              autocomplete="off"
              data-test="model-search"
              @keydown.enter.prevent="pickFirstFilteredModel"
              @keydown.esc.stop="onSearchEscape"
            />
            <button v-if="modelQuery" type="button" class="amp-search-clear" aria-label="Clear model search" @click="clearModelSearch">×</button>
          </div>

          <div class="amp-model-scroll" role="listbox" aria-label="Chat models">
            <button
              v-for="m in filteredModels"
              :key="m.id"
              type="button"
              class="amp-model"
              :class="{ active: current && current.id === m.id }"
              :disabled="saving"
              role="option"
              :aria-selected="current?.id === m.id ? 'true' : 'false'"
              :data-test="'model-option-' + m.id"
              @click="pick(m)"
            >
              <span class="amp-model-text">
                <span class="amp-model-name">{{ m.name }}</span>
                <span v-if="modelMeta(m)" class="amp-model-meta">{{ modelMeta(m) }}</span>
              </span>
              <svg v-if="current && current.id === m.id" class="amp-check" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div v-if="loadingModels && !filteredModels.length" class="amp-model-empty" data-test="model-loading">
              Loading models…
            </div>
            <div v-else-if="!filteredModels.length" class="amp-model-empty" data-test="model-search-empty">
              No matching models
            </div>
            <div v-if="hiddenModelCount > 0" class="amp-model-more" data-test="model-more">
              Showing {{ filteredModels.length }} of {{ matchingModels.length }}. Type to narrow the list.
            </div>
          </div>

          <button v-if="source === 'override'" type="button" class="amp-reset" :disabled="saving" @click="pick(null)">
            <span>Use platform default</span>
            <span v-if="platformDefault.model_name">{{ platformDefault.model_name }}</span>
          </button>
        </div>
      </template>
    </div>

    <div v-if="open" class="amp-backdrop" @click="close"></div>
  </div>
</template>

<script setup>
import EffortSlider from '../chat/EffortSlider.vue'
import { uniqueModels } from '../../utils/uniqueModels'
import { useAgentRunMode } from '../../composables/useAgentRunMode'
import { useReasoningOptions } from '../../composables/useReasoningOptions'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import api from '../../services/api'

const props = defineProps({
  agentId: { type: [Number, String], default: null },
})
const emit = defineEmits(['changed'])

const open = ref(false)
// What Effort may offer: depends on the model THIS user runs the shared agent on, so it reloads after a pick.
const { options: reasoningOptions, reload: reloadReasoning } = useReasoningOptions(() => props.agentId)
const showModels = ref(false)
const modelQuery = ref('')
const modelSearchEl = ref(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const modelCount = ref(0)
const current = ref(null)
const source = ref(null)
const platformDefault = ref({})
// Every chat model the person may use, one list across every platform provider, each model once (`?models=1`),
// fetched when they open the list and kept for the session. The page load reads only the count and the current pick:
// fetching every model to show one label was 1,111 rows and 194 KB for one account.
const models = ref(null)
const loadingModels = ref(false)
// Rows drawn at once. One key can list 533 chat models; drawing all of them on a click froze the tab.
// Search still filters the whole list.
const RENDER_LIMIT = 60

// ── per-turn thinking effort ──────────────────────────────────────────────────────────────────────────

// Run mode for the CALLER (shared agents store it per user — see useAgentRunMode).
const { label: modeLabel, options: modeOptions, saving: modeSaving, error: modeError,
        select: applyMode } = useAgentRunMode(() => props.agentId)
const pickMode = (opt) => applyMode(opt)

const pillLabel = computed(() => {
  if (loading.value && !current.value) return 'Model…'
  if (current.value) return current.value.name
  return modelCount.value ? 'Choose model' : 'No model'
})

const sourceLabel = computed(() => ({
  override: 'Your pick',
  platform_default: 'Platform default',
}[source.value] || ''))

// Who chose the model ("Your pick", "Admin default"), never the provider it runs on.
const currentMeta = computed(() => sourceLabel.value || 'Select the model used for this chat')

const matchingModels = computed(() => {
  const list = models.value || []
  const query = modelQuery.value.trim().toLowerCase()
  if (!query) return list
  return list.filter((model) =>
    [model.name, model.model_id].some((value) => String(value || '').toLowerCase().includes(query)))
})
const filteredModels = computed(() => matchingModels.value.slice(0, RENDER_LIMIT))
const hiddenModelCount = computed(() => matchingModels.value.length - filteredModels.value.length)

// Context window + per-1M pricing, formatted exactly like the agent editor's model picker
// (components/common/ModelPicker.vue) so the same model reads the same way in both places.
// Prices arrive as per-TOKEN decimals; ×1e6 gives the familiar "$3.00/$15.00 per 1M".
function formatContext(m) {
  const c = Number(m.context_window)
  if (!c) return ''
  if (c >= 1000) return `${Math.round(c / 1000)}K ctx`
  return `${c} ctx`
}
function formatPrice(m) {
  const inp = parseFloat(m.pricing_input ?? '')
  const out = parseFloat(m.pricing_output ?? '')
  if (Number.isNaN(inp) || Number.isNaN(out)) return ''
  if (inp === 0 && out === 0) return 'Free'
  const fmt = (v) => `$${(v * 1e6).toFixed(2)}`
  return `${fmt(inp)}/${fmt(out)} per 1M`
}
function modelMeta(m) {
  return [formatContext(m), formatPrice(m)].filter(Boolean).join(' · ')
}

function applyPayload(data) {
  // Frontend and backend releases can arrive separately. Older servers return
  // authorized connection counts; keep their names out of the model picker.
  modelCount.value = Number(data.model_count ?? (data.providers || []).reduce((n, p) => n + Number(p.model_count ?? p.models?.length ?? 0), 0))
  if (Array.isArray(data.models)) models.value = data.models
  current.value = data.current || null
  source.value = data.source || null
  platformDefault.value = data.platform_default || {}
}

async function load() {
  if (!props.agentId) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.getAgentModelOptions(props.agentId)
    applyPayload(data)
  } catch {
    error.value = 'Could not load your models.'
  } finally {
    loading.value = false
  }
}

async function pick(model) {
  saving.value = true
  error.value = ''
  try {
    const { data } = await api.selectAgentModel(props.agentId, model ? model.id : null)
    reloadReasoning()
    applyPayload(data)
    emit('changed', { current: current.value, source: source.value })
    close()
  } catch (e) {
    error.value = e?.response?.data?.detail || 'Could not switch the model.'
  } finally {
    saving.value = false
  }
}

function toggle() {
  open.value = !open.value
  if (!open.value) closeLayers()
  if (open.value && !current.value && !modelCount.value && !loading.value) load()
}

async function loadModels() {
  if (models.value) return
  loadingModels.value = true
  try {
    const { data } = await api.getAgentModelOptions(props.agentId, { models: 1 })
    let rows = data.models
    if (!Array.isArray(rows) && Array.isArray(data.providers)) {
      const cards = await Promise.all(data.providers.map(async (p) => {
        if (Array.isArray(p.models)) return p
        const response = await api.getAgentModelOptions(props.agentId, { provider: p.id })
        return { models: (response.data.providers || []).flatMap((c) => c.models || []) }
      }))
      rows = cards.flatMap((p) => p.models || [])
    }
    models.value = uniqueModels(Array.isArray(rows) ? rows : [], [current.value?.id])
    modelCount.value = models.value.length
  } catch {
    error.value = 'Could not load the models.'
  } finally {
    loadingModels.value = false
  }
}

async function toggleModels() {
  if (showModels.value) { closeModelCard(); return }
  modelQuery.value = ''
  showModels.value = true
  await nextTick()
  modelSearchEl.value?.focus()
  await loadModels()
}

function clearModelSearch() {
  modelQuery.value = ''
  nextTick(() => modelSearchEl.value?.focus())
}

function closeModelCard() {
  showModels.value = false
  modelQuery.value = ''
}

function onSearchEscape() {
  if (modelQuery.value) clearModelSearch()
  else closeModelCard()
}

function pickFirstFilteredModel() {
  const first = filteredModels.value[0]
  if (first && !saving.value) pick(first)
}

function closeLayers() {
  showModels.value = false
  modelQuery.value = ''
}

function close() {
  open.value = false
  closeLayers()
}

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) close()
}

onMounted(() => {
  load()
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

watch(() => props.agentId, () => {
  close()
  modelCount.value = 0
  models.value = null
  current.value = null
  source.value = null
  load()
})
</script>

<style scoped>
.amp { position: relative; display: inline-block; color: #202123; }
.amp button, .amp a { font: inherit; }
.amp-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; max-width: 220px; padding: 5px 10px;
  border: 1px solid transparent; border-radius: 9px; background: #f4f4f4; color: #343434; font-size: 12px;
  font-weight: 560; line-height: 1; cursor: pointer; transition: background .14s ease, border-color .14s ease, box-shadow .14s ease; }
.amp-btn:hover, .amp-btn:focus-visible { background: #ececec; border-color: #dedede; }
.amp-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(37, 99, 235, .16); }
.amp-on { background: #f1f1f1; }
.amp-ic { width: 14px; height: 14px; flex: 0 0 auto; color: #6f6f6f; }
.amp-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.amp-caret { width: 12px; height: 12px; flex: 0 0 auto; color: #858585; transition: transform .16s ease; }
.amp-caret.open { transform: rotate(180deg); }
.amp-backdrop { position: fixed; inset: 0; z-index: 40; }
.amp-menu { position: absolute; left: 0; bottom: calc(100% + 8px); z-index: 50; width: 272px; max-width: calc(100vw - 24px);
  padding: 5px; background: rgba(255, 255, 255, .98); border: 1px solid rgba(0, 0, 0, .14); border-radius: 14px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, .13), 0 2px 8px rgba(0, 0, 0, .06); backdrop-filter: blur(16px); }
.amp-current { display: flex; min-height: 52px; align-items: center; gap: 12px; padding: 8px 10px; }
.amp-current-body { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
.amp-current-name { overflow: hidden; color: #242424; font-size: 13px; font-weight: 570; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.amp-current-desc { overflow: hidden; color: #828282; font-size: 11.5px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.amp-current-check { width: 17px; height: 17px; flex: 0 0 auto; color: #2563eb; }
.amp-divider { height: 1px; margin: 0 9px; background: #e5e5e5; }
.amp-more { display: grid; width: 100%; min-height: 44px; grid-template-columns: 1fr auto 16px; align-items: center; gap: 6px;
  padding: 7px 8px 7px 10px; border: 0; border-radius: 9px; background: transparent; color: #292929; font-size: 12.5px;
  text-align: left; cursor: pointer; transition: background .12s ease; }
.amp-more:hover, .amp-more.active, .amp-more:focus-visible { background: #f1f1f1; }
.amp-more:focus-visible, .amp-model:focus-visible, .amp-reset:focus-visible, .amp-model-back:focus-visible {
  outline: 2px solid rgba(37, 99, 235, .42); outline-offset: -2px; }
.amp-more-value { overflow: hidden; max-width: 116px; color: #858585; font-size: 11.5px; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.amp-more svg { width: 16px; height: 16px; color: #878787; }
.amp-state { padding: 14px 12px; color: #5b5b5b; font-size: 12.5px; line-height: 1.45; }
.amp-state p { margin: 0 0 8px; }
.amp-cta { display: inline-block; color: #2563eb; font-size: 12px; font-weight: 600; text-decoration: none; }
.amp-cta:hover { text-decoration: underline; }
.amp-model-flyout { position: absolute; left: calc(100% + 8px); bottom: -5px; z-index: 1; width: 218px;
  max-width: calc(100vw - 24px); padding: 5px; background: rgba(255, 255, 255, .98); border: 1px solid rgba(0, 0, 0, .14);
  border-radius: 14px; box-shadow: 0 14px 38px rgba(0, 0, 0, .14), 0 2px 8px rgba(0, 0, 0, .06); backdrop-filter: blur(16px); }
.amp-model-flyout { bottom: -5px; width: 280px; }
.amp-card-title { display: flex; min-height: 31px; align-items: center; padding: 6px 9px; color: #929292;
  font-size: 10px; font-weight: 650; letter-spacing: .035em; text-transform: uppercase; }
.amp-model-scroll { max-height: min(390px, calc(100vh - 32px)); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.amp-model-back { width: 100%; gap: 5px; border: 0; border-radius: 8px; background: transparent; text-align: left; cursor: pointer; }
.amp-model-back:hover { background: #f1f1f1; color: #555; }
.amp-model-back svg { width: 14px; height: 14px; }
.amp-model-search { position: relative; display: flex; align-items: center; margin: 2px 4px 5px; }
.amp-model-search > svg { position: absolute; left: 9px; width: 14px; height: 14px; color: #929292; pointer-events: none; }
.amp-model-search input { width: 100%; height: 34px; padding: 6px 30px 6px 29px; border: 1px solid #dedede; border-radius: 8px;
  background: #fafafa; color: #292929; font: inherit; font-size: 12px; outline: none; transition: border-color .12s ease, box-shadow .12s ease, background .12s ease; }
.amp-model-search input::placeholder { color: #999; }
.amp-model-search input:focus { border-color: #8eb0ff; background: #fff; box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }
.amp-model-search input::-webkit-search-cancel-button { display: none; }
.amp-search-clear { position: absolute; right: 5px; display: grid; width: 24px; height: 24px; place-items: center; padding: 0;
  border: 0; border-radius: 6px; background: transparent; color: #868686; font-size: 17px; line-height: 1; cursor: pointer; }
.amp-search-clear:hover { background: #ececec; color: #333; }
.amp-model-empty { padding: 26px 12px; color: #8b8b8b; font-size: 12px; text-align: center; }
.amp-model-more { padding: 8px 12px 10px; color: #8b8b8b; font-size: 11.5px; text-align: center; }
.amp-model { position: relative; display: flex; width: 100%; min-height: 44px; align-items: center; gap: 8px; padding: 7px 30px 7px 9px;
  border: 0; border-radius: 8px; background: transparent; color: #303030; text-align: left; cursor: pointer; transition: background .12s ease; }
.amp-model:hover, .amp-model.active { background: #f1f1f1; }
.amp-model:disabled { opacity: .55; cursor: wait; }
/* Two-line row: model name over its context-window + per-1M price (same info the agent editor's
   ModelPicker shows). min-width:0 on the flex child is what lets the ellipsis actually kick in. */
.amp-model-text { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 1px; }
.amp-model-name { overflow: hidden; font-size: 12.5px; font-weight: 480; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.amp-model-meta { overflow: hidden; color: #8a8a8a; font-size: 10.5px; font-variant-numeric: tabular-nums;
  line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.amp-model.active .amp-model-meta, .amp-model:hover .amp-model-meta { color: #6f6f6f; }
.amp-check { position: absolute; top: 50%; right: 9px; width: 15px; height: 15px; color: #2563eb; transform: translateY(-50%); }
.amp-reset { display: flex; width: 100%; min-height: 38px; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px;
  padding: 7px 9px; border: 0; border-top: 1px solid #e5e5e5; background: transparent; color: #555; font-size: 11.5px;
  text-align: left; cursor: pointer; }
.amp-reset span:last-child { overflow: hidden; max-width: 104px; color: #929292; text-overflow: ellipsis; white-space: nowrap; }
.amp-reset:hover { color: #202020; }
.amp-error { margin: 4px 5px 2px; padding: 7px 8px; border-radius: 7px; background: #fef2f2; color: #b91c1c; font-size: 11px; }

@media (max-width: 640px) {
  .amp-menu { max-width: min(272px, calc(100vw - 20px)); }
  .amp-model-flyout { left: 0; bottom: 0; z-index: 2; width: 100%; }
  .amp-model-scroll { max-height: min(310px, calc(100vh - 190px)); }
}

@media (prefers-reduced-motion: reduce) {
  .amp-btn, .amp-caret, .amp-more, .amp-model { transition: none; }
}
.amp-mode { padding: 4px 0 2px; }
.amp-mode-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 3px 10px 5px; }
.amp-mode-title { color: #292929; font-size: 12.5px; font-weight: 570; }
.amp-mode-value { color: #858585; font-size: 11.5px; }
.amp-mode-item { display: grid; width: 100%; grid-template-columns: 18px 1fr 16px; align-items: center; gap: 8px;
  padding: 6px 10px; border: 0; background: transparent; text-align: left; cursor: pointer;
  transition: background .12s ease; }
.amp-mode-item:hover:not(:disabled) { background: #f1f1f1; }
.amp-mode-item:focus-visible { outline: 2px solid rgba(37, 99, 235, .42); outline-offset: -2px; }
.amp-mode-item:disabled { cursor: default; opacity: .6; }
.amp-mode-icon { font-size: 13px; line-height: 1; text-align: center; }
.amp-mode-body { display: grid; gap: 1px; overflow: hidden; }
.amp-mode-name { overflow: hidden; color: #292929; font-size: 12.5px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.amp-mode-desc { overflow: hidden; color: #858585; font-size: 11px; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.amp-mode-item.is-on .amp-mode-name { color: #2563eb; font-weight: 570; }
.amp-mode-check { width: 15px; height: 15px; color: #2563eb; }
</style>
