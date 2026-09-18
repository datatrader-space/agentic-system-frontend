<!--
  Switch-provider popup. Opens when a turn is refused because a provider ACCOUNT is at fault (key limit, out of
  credits, rejected key) — the backend marks that error frame with `provider_switch`.

  One click moves every model the user runs on that provider (all their agents, internal operations, shared-agent
  picks and pinned chats) to the same or closest model on the chosen provider, then re-sends the failed message.
  Cancel leaves everything as it is. The preview (ProviderSwitchPicker) is the same one the AI Provider page's
  manual switch uses — this popup is just the entrance the chat takes when a provider refuses.
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

          <ProviderSwitchPicker v-if="offer" v-model="selectedId" :from-provider="offer.from_provider" class="mt-5">
            <template #empty>
              You have no other working provider. Add one on the
              <router-link to="/dashboard/settings/providers" class="text-indigo-600 underline" @click="cancel">AI Provider page</router-link>,
              or raise the limit on your {{ fromLabel }} key.
            </template>
          </ProviderSwitchPicker>
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
import ProviderSwitchPicker from '../providers/ProviderSwitchPicker.vue'
import { useChatStore } from '../../stores/useChatStore'
import { notify } from '../../composables/useNotify'

const chat = useChatStore()
const offer = computed(() => chat.providerSwitchOffer)
const selectedId = ref(null)
const applying = ref(false)
const applyError = ref('')

const PROVIDER_NAMES = { openrouter: 'OpenRouter', openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google Gemini', xai: 'xAI' }
const fromLabel = computed(() => PROVIDER_NAMES[offer.value?.from_provider] || offer.value?.from_provider || 'this provider')
const title = computed(() => ({
  key_limit: `${fromLabel.value} key reached its spending limit`,
  credits: `${fromLabel.value} is out of credits`,
  auth: `${fromLabel.value} rejected the API key`,
}[offer.value?.reason] || `${fromLabel.value} refused the request`))

watch(offer, () => {
  selectedId.value = null
  applyError.value = ''
})

function cancel() {
  if (applying.value) return
  chat.providerSwitchOffer = null
}

async function apply() {
  if (!selectedId.value || applying.value) return
  applying.value = true
  applyError.value = ''
  try {
    // origin='auto': this switch was OFFERED after a provider refusal, not chosen on the settings page. The
    // AI Provider page reads that back to say why the user is on the provider they are on.
    const { data } = await api.switchProvider(offer.value.from_provider, selectedId.value, 'auto', offer.value.reason || '')
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
