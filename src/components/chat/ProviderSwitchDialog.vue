<!--
  Switch-provider popup. Opens when a turn is refused because a provider ACCOUNT is at fault (key limit, out of
  credits, rejected key) — the backend marks that error frame with `provider_switch`.

  One click moves every model the user runs on that provider (all their agents, internal operations, shared-agent
  picks and pinned chats) to the same or closest model on the chosen provider, then re-sends the failed message.
  Cancel leaves everything as it is. The preview lists exactly what changes and what stays behind before anything
  is written.
-->
<template>
  <Teleport to="body">
    <div v-if="offer" class="fixed inset-0 z-[100] flex items-center justify-center p-4" data-test="provider-switch"
         @keydown.esc.prevent="cancel">
      <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-[1px]" @click="cancel"></div>
      <div class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
           role="alertdialog" aria-modal="true" aria-label="Switch AI provider">
        <div class="p-6">
          <div class="flex items-start gap-4">
            <div class="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-amber-100 text-amber-600">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-gray-900">{{ title }}</h3>
              <p class="mt-1.5 text-sm text-gray-600">
                Switch everything that runs on <b>{{ fromLabel }}</b> to another provider? Each model moves to the same
                model there when it exists, otherwise the closest one. Your message is sent again after the switch.
              </p>
            </div>
          </div>

          <div v-if="loading" class="mt-5 text-sm text-gray-500" data-test="provider-switch-loading">Checking your providers…</div>
          <div v-else-if="loadError" class="mt-5 text-sm text-red-600" role="alert">{{ loadError }}</div>
          <div v-else-if="!targets.length" class="mt-5 text-sm text-gray-600" data-test="provider-switch-none">
            You have no other working provider. Add one on the
            <router-link to="/dashboard/settings/providers" class="text-indigo-600 underline" @click="cancel">AI Provider page</router-link>,
            or raise the limit on your {{ fromLabel }} key.
          </div>
          <div v-else class="mt-5 space-y-2">
            <label v-for="t in targets" :key="t.to_provider.id"
                   class="block rounded-xl border p-3 cursor-pointer"
                   :class="selectedId === t.to_provider.id ? 'border-indigo-500 bg-indigo-50/40' : 'border-gray-200'"
                   :data-test="'provider-switch-target-' + t.to_provider.provider_type">
              <div class="flex items-center gap-2">
                <input v-model="selectedId" type="radio" :value="t.to_provider.id" class="accent-indigo-600" />
                <span class="text-sm font-semibold text-gray-900">{{ t.to_provider.name }}</span>
                <span class="ml-auto text-xs text-gray-500">{{ t.changes.length }} change{{ t.changes.length === 1 ? '' : 's' }}</span>
              </div>
              <ul v-if="selectedId === t.to_provider.id" class="mt-2 max-h-48 overflow-auto text-xs text-gray-600 space-y-1">
                <li v-for="(c, i) in t.changes" :key="'c' + i" data-test="provider-switch-change">
                  <span class="text-gray-800">{{ c.target_name }}</span> · {{ c.label }}{{ c.count > 1 ? ` (${c.count} chats)` : '' }}:
                  {{ c.from_model.model_id }} → <b>{{ c.to_model.model_id }}</b>
                  <span v-if="c.match === 'closest'" class="text-amber-600">(closest)</span>
                </li>
                <li v-for="(w, i) in t.warnings" :key="'w' + i" class="text-amber-700" data-test="provider-switch-warning">{{ w }}</li>
              </ul>
            </label>
          </div>
          <div v-if="applyError" class="mt-3 text-sm text-red-600" role="alert">{{ applyError }}</div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
                  data-test="provider-switch-cancel" @click="cancel">Cancel</button>
          <button type="button" class="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  :disabled="!selectedId || applying" data-test="provider-switch-apply" @click="apply">
            {{ applying ? 'Switching…' : 'Switch & retry' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import api from '../../services/api'
import { useChatStore } from '../../stores/useChatStore'
import { notify } from '../../composables/useNotify'

const chat = useChatStore()
const offer = computed(() => chat.providerSwitchOffer)
const targets = ref([])
const selectedId = ref(null)
const loading = ref(false)
const loadError = ref('')
const applying = ref(false)
const applyError = ref('')

const PROVIDER_NAMES = { openrouter: 'OpenRouter', openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google Gemini', xai: 'xAI' }
const fromLabel = computed(() => PROVIDER_NAMES[offer.value?.from_provider] || offer.value?.from_provider || 'this provider')
const title = computed(() => ({
  key_limit: `${fromLabel.value} key reached its spending limit`,
  credits: `${fromLabel.value} is out of credits`,
  auth: `${fromLabel.value} rejected the API key`,
}[offer.value?.reason] || `${fromLabel.value} refused the request`))

watch(offer, async (o) => {
  targets.value = []
  selectedId.value = null
  loadError.value = ''
  applyError.value = ''
  if (!o) return
  loading.value = true
  try {
    const { data } = await api.getProviderSwitchOptions(o.from_provider)
    targets.value = Array.isArray(data?.targets) ? data.targets : []
    if (targets.value.length) selectedId.value = targets.value[0].to_provider.id
  } catch {
    loadError.value = 'Could not load your providers.'
  } finally {
    loading.value = false
  }
}, { immediate: true })

function cancel() {
  if (applying.value) return
  chat.providerSwitchOffer = null
}

async function apply() {
  if (!selectedId.value || applying.value) return
  applying.value = true
  applyError.value = ''
  try {
    const { data } = await api.switchProvider(offer.value.from_provider, selectedId.value)
    const n = (data?.changes || []).length
    notify.success(`Switched ${n} model${n === 1 ? '' : 's'} to ${data?.to_provider?.name || 'the new provider'}`)
    for (const w of (data?.warnings || [])) notify.warning(w)
    chat.providerSwitchOffer = null
    chat.retryLast()
  } catch (e) {
    applyError.value = e?.response?.data?.error || 'The switch did not go through. Nothing was changed.'
  } finally {
    applying.value = false
  }
}
</script>
