<!--
  Manual AI-provider switch, on Settings → AI Providers.

  The chat already offers a switch when a provider REFUSES a turn (key limit, credits, rejected key). That is the
  only way models ever moved, which left two things impossible: changing provider while nothing is broken, and
  going back to OpenRouter after topping the limit up. This card is that switch, asked for deliberately.

  It is the same backend operation the popup applies (POST /llm/providers/switch/) and the same preview
  (ProviderSwitchPicker) — no second way to move a user between providers. What it adds is the read side:
  which provider the models are on, why they are on it, and which providers are not selectable and why not.
-->
<template>
  <div class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden" data-test="provider-switch-card">
    <div class="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/30 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 class="text-base font-bold text-slate-900">Active AI provider</h2>
        <p class="text-[13px] text-slate-500 mt-0.5">
          Move every model you run — all your agents, internal operations, your picks on shared agents and chats
          pinned to a model — from one provider to another in one step.
        </p>
      </div>
      <button type="button" data-test="provider-switch-open"
              :disabled="loading || !currentType"
              class="px-3.5 py-2 text-[13px] font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap disabled:opacity-50"
              @click="openDialog">
        Switch provider
      </button>
    </div>

    <div class="p-5 sm:p-6">
      <div v-if="loading" class="text-[13px] text-slate-500" data-test="provider-switch-card-loading">Loading…</div>
      <div v-else-if="loadError" class="text-[13px] text-red-600" role="alert">{{ loadError }}</div>
      <template v-else>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[13px] text-slate-500">Currently running on</span>
          <span v-if="currentType" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100"
                data-test="provider-switch-current">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>{{ providerLabel(currentType) }}
          </span>
          <span v-else class="text-[13px] font-semibold text-slate-700" data-test="provider-switch-current">
            no provider yet — add one below
          </span>
          <span v-if="current.slots" class="text-[12px] text-slate-400">
            {{ current.slots }} of {{ current.total }} model slot{{ current.total === 1 ? '' : 's' }}
          </span>
        </div>

        <!-- Why. The only thing the model rows themselves cannot say. -->
        <p class="mt-2 text-[13px]" :class="lastSwitch && lastSwitch.origin === 'auto' ? 'text-amber-700' : 'text-slate-500'"
           data-test="provider-switch-why">{{ whyText }}</p>

        <p v-if="current.mixed" class="mt-2 text-[12px] text-slate-500" data-test="provider-switch-mixed">
          Some models run on other providers ({{ mixedText }}). A switch only moves what is on
          {{ providerLabel(currentType) }} — the rest stays where it is.
        </p>

        <div v-if="canSwitchBack" class="mt-3 text-[13px] text-slate-600" data-test="provider-switch-back-hint">
          Raised the limit on {{ providerLabel(lastSwitch.from_provider) }} again? Switch back the same way.
        </div>

        <!-- Every provider the user owns, selectable or not, with the reason it is not. -->
        <ul class="mt-4 grid gap-2 sm:grid-cols-2">
          <li v-for="p in providers" :key="p.id"
              class="rounded-xl border px-3 py-2.5 flex items-start gap-2"
              :class="p.is_current ? 'border-indigo-200 bg-indigo-50/40' : (p.available ? 'border-slate-200' : 'border-slate-200 bg-slate-50')"
              :data-test="'provider-switch-option-' + p.provider_type">
            <div class="min-w-0 flex-1">
              <p class="text-[13px] font-semibold text-slate-900 truncate">
                {{ p.name }}
                <span v-if="p.is_current" class="ml-1 text-[11px] font-bold text-indigo-600">· in use</span>
              </p>
              <p class="text-[12px]" :class="p.available ? 'text-emerald-600' : 'text-slate-500'">
                <template v-if="p.available">Ready — {{ p.model_count }} model{{ p.model_count === 1 ? '' : 's' }}</template>
                <template v-else>{{ p.unavailable_reason }}</template>
              </p>
            </div>
          </li>
        </ul>
        <p v-if="!providers.length" class="mt-4 text-[13px] text-slate-500" data-test="provider-switch-no-providers">
          You have no providers configured yet. Add one below, then you can switch between them here.
        </p>
      </template>
    </div>

    <!-- Confirm dialog: the preview, then the switch. Never a native confirm()/alert(). -->
    <Teleport to="body">
      <div v-if="dialogOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4"
           data-test="provider-switch-dialog" @keydown.esc.prevent="closeDialog">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" @click="closeDialog"></div>
        <div class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
             role="dialog" aria-modal="true" aria-label="Switch AI provider">
          <div class="p-6">
            <h3 class="text-base font-semibold text-slate-900">
              Switch away from {{ providerLabel(currentType) }}
            </h3>
            <p class="mt-1.5 text-sm text-slate-600">
              Every model on {{ providerLabel(currentType) }} moves to the same model on the provider you pick, or
              the closest one it has. A slot with nothing capable there keeps its model. Your embedding model is
              never moved — changing it would mean re-indexing every knowledge base.
            </p>
            <ProviderSwitchPicker v-model="selectedId" :from-provider="currentType" :reload-key="reloadKey" class="mt-5">
              <template #empty>
                No other provider of yours is ready to take this. Add a key or sync models for one above, then try again.
              </template>
            </ProviderSwitchPicker>
            <div v-if="applyError" class="mt-3 text-sm text-red-600" role="alert"
                 data-test="provider-switch-error">{{ applyError }}</div>
          </div>
          <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" data-test="provider-switch-dialog-cancel"
                    class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                    @click="closeDialog">Cancel</button>
            <button type="button" data-test="provider-switch-dialog-apply"
                    class="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    :disabled="!selectedId || applying" @click="apply">
              {{ applying ? 'Switching…' : 'Switch provider' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import api from '../../services/api'
import ProviderSwitchPicker from './ProviderSwitchPicker.vue'

// The parent owns the toast + the provider/model reload: this card reports what the switch did and stays
// dumb about the rest of the page.
const emit = defineEmits(['switched'])

const PROVIDER_NAMES = {
  openrouter: 'OpenRouter', openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google Gemini',
  xai: 'xAI (Grok)', ollama: 'Ollama', custom: 'Custom', cloudinary: 'Cloudinary',
}
const providerLabel = (t) => PROVIDER_NAMES[t] || t || 'no provider'

const FAULT_TEXT = {
  key_limit: 'reached its spending limit',
  credits: 'ran out of credits',
  auth: 'rejected the API key',
}

const loading = ref(true)
const loadError = ref('')
const current = ref({ provider_type: '', slots: 0, total: 0, mixed: false, usage: {} })
const providers = ref([])
const lastSwitch = ref(null)

const currentType = computed(() => current.value.provider_type || '')
const mixedText = computed(() => Object.entries(current.value.usage || {})
  .filter(([t]) => t !== currentType.value)
  .map(([t, n]) => `${providerLabel(t)} × ${n}`).join(', '))

const whyText = computed(() => {
  const s = lastSwitch.value
  if (!s) return 'These are the models you chose. Nothing has been switched automatically.'
  const when = s.at ? new Date(s.at).toLocaleString() : ''
  if (s.origin === 'auto') {
    const why = FAULT_TEXT[s.reason] || 'refused a request'
    return `Switched automatically${when ? ' on ' + when : ''}: ${providerLabel(s.from_provider)} ${why}, `
         + `so ${s.changed_count} model${s.changed_count === 1 ? '' : 's'} moved to ${s.to_provider_name || providerLabel(s.to_provider_type)}.`
  }
  return `You switched from ${providerLabel(s.from_provider)} to ${s.to_provider_name || providerLabel(s.to_provider_type)}`
       + `${when ? ' on ' + when : ''} — ${s.changed_count} model${s.changed_count === 1 ? '' : 's'} moved.`
})

// Only worth offering when the auto-switch is what moved them AND the old provider is usable again.
const canSwitchBack = computed(() => {
  const s = lastSwitch.value
  if (!s || s.origin !== 'auto' || s.from_provider === currentType.value) return false
  return providers.value.some((p) => p.provider_type === s.from_provider && p.available)
})

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.getProviderSwitchState()
    current.value = data?.current || { provider_type: '', slots: 0, total: 0, mixed: false, usage: {} }
    providers.value = Array.isArray(data?.providers) ? data.providers : []
    lastSwitch.value = data?.last_switch || null
  } catch (e) {
    loadError.value = 'Could not load your provider status.'
  } finally {
    loading.value = false
  }
}

// ── the switch dialog ──
const dialogOpen = ref(false)
const selectedId = ref(null)
const applying = ref(false)
const applyError = ref('')
const reloadKey = ref(0)

const openDialog = () => {
  applyError.value = ''
  selectedId.value = null
  reloadKey.value += 1          // re-read the preview every time it is opened
  dialogOpen.value = true
}
const closeDialog = () => {
  if (applying.value) return
  dialogOpen.value = false
}

const apply = async () => {
  if (!selectedId.value || applying.value) return
  applying.value = true
  applyError.value = ''
  try {
    // from='' — the server switches away from the provider the models are actually on, so the page and the
    // backend can never disagree about the source. origin='manual' is what separates this from the popup.
    const { data } = await api.switchProvider('', selectedId.value, 'manual', '')
    dialogOpen.value = false
    await load()
    emit('switched', data)
  } catch (e) {
    applyError.value = e?.response?.data?.error || 'The switch did not go through. Nothing was changed.'
  } finally {
    applying.value = false
  }
}

load()
defineExpose({ reload: load })
</script>
