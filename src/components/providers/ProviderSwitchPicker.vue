<!--
  The switch-provider PREVIEW, shared by both entrances to the one backend switch:
    • the chat popup (ProviderSwitchDialog) when a provider account fault refuses a turn, and
    • the AI Provider page's manual switch, which can be asked for at any time.

  It lists every provider the caller could move to and, for the selected one, the exact model-by-model changes
  and what would stay behind. Read-only — nothing is written until the parent posts the switch.
-->
<template>
  <div>
    <div v-if="loading" class="text-sm text-gray-500" data-test="provider-switch-loading">Checking your providers…</div>
    <div v-else-if="loadError" class="text-sm text-red-600" role="alert">{{ loadError }}</div>
    <div v-else-if="!targets.length" class="text-sm text-gray-600" data-test="provider-switch-none">
      <slot name="empty">You have no other working provider to switch to.</slot>
    </div>
    <div v-else class="space-y-2">
      <label v-for="t in targets" :key="t.to_provider.id"
             class="block rounded-xl border p-3 cursor-pointer"
             :class="modelValue === t.to_provider.id ? 'border-indigo-500 bg-indigo-50/40' : 'border-gray-200'"
             :data-test="'provider-switch-target-' + t.to_provider.provider_type">
        <div class="flex items-center gap-2">
          <input :checked="modelValue === t.to_provider.id" type="radio" class="accent-indigo-600"
                 @change="$emit('update:modelValue', t.to_provider.id)" />
          <span class="text-sm font-semibold text-gray-900">{{ t.to_provider.name }}</span>
          <span class="ml-auto text-xs text-gray-500">{{ t.changes.length }} change{{ t.changes.length === 1 ? '' : 's' }}</span>
        </div>
        <ul v-if="modelValue === t.to_provider.id" class="mt-2 max-h-48 overflow-auto text-xs text-gray-600 space-y-1">
          <li v-for="(c, i) in t.changes" :key="'c' + i" data-test="provider-switch-change">
            <span class="text-gray-800">{{ c.target_name }}</span> · {{ c.label }}{{ c.count > 1 ? ` (${c.count} chats)` : '' }}:
            {{ c.from_model.model_id }} → <b>{{ c.to_model.model_id }}</b>
            <span v-if="c.match === 'closest'" class="text-amber-600">(closest)</span>
          </li>
          <li v-for="(w, i) in t.warnings" :key="'w' + i" class="text-amber-700" data-test="provider-switch-warning">{{ w }}</li>
        </ul>
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import api from '../../services/api'

const props = defineProps({
  // The provider TYPE to switch away from. Empty string = let the server use the one the caller's models
  // are actually on (what the AI Provider page wants); the chat popup passes the provider that refused.
  fromProvider: { type: String, default: '' },
  modelValue: { type: [Number, String], default: null },
  // Bumped by the parent to re-read after something changed (a key added, a switch applied).
  reloadKey: { type: [Number, String], default: 0 },
})
const emit = defineEmits(['update:modelValue', 'loaded'])

const targets = ref([])
const loading = ref(false)
const loadError = ref('')

const load = async () => {
  targets.value = []
  loadError.value = ''
  loading.value = true
  try {
    const { data } = await api.getProviderSwitchOptions(props.fromProvider || '')
    targets.value = Array.isArray(data?.targets) ? data.targets : []
    // Pre-select the first so one click applies; the parent learns which provider the server used as the
    // source, which is the only way the page can label "switching away from X" when it did not name one.
    emit('update:modelValue', targets.value.length ? targets.value[0].to_provider.id : null)
    emit('loaded', { targets: targets.value, fromProvider: data?.from_provider || props.fromProvider || '' })
  } catch {
    loadError.value = 'Could not load your providers.'
    emit('loaded', { targets: [], fromProvider: props.fromProvider || '' })
  } finally {
    loading.value = false
  }
}

watch(() => [props.fromProvider, props.reloadKey], load, { immediate: true })
defineExpose({ targets, reload: load })
</script>
