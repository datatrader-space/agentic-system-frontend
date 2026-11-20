<!--
  The model of a "Model call" step (ADM-1333, plan §3.3): the shared ModelPicker over every model the person may use.
  Left empty, the step uses the platform default for its slot (backend B18); there is no silent pick of another model.
  The whole list is read (every page); a failed read says so with Retry and keeps the saved model.
-->
<template>
  <div class="lm">
    <p v-if="error" class="lm-err" role="alert">
      {{ error }} The saved model is kept.
      <button type="button" class="lm-btn" @click="load">Retry</button>
    </p>
    <p v-else-if="loading" class="lm-help" role="status">Loading models…</p>
    <ModelPicker
      v-else
      :model-value="current"
      :models="models"
      aria-label="Model"
      placeholder="Platform default model"
      @update:model-value="(v) => editor.set('model_id', v, 'Model')"
    />
    <div class="lm-foot">
      <p class="lm-help">{{ current ? savedLabel : 'Empty: the platform default model for this step is used.' }}</p>
      <button v-if="current" type="button" class="lm-btn" @click="editor.set('model_id', null, 'Model')">Use the platform default</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/services/api'
import ModelPicker from '@/components/common/ModelPicker.vue'
import { useNodeEditor } from './nodeEditor'

const editor = useNodeEditor()
const models = ref([])
const loading = ref(false)
const error = ref('')

const current = computed(() => editor.data.value.model_id ?? null)
const savedLabel = computed(() => {
  const m = models.value.find((x) => String(x.id) === String(current.value) || x.model_id === current.value)
  return m ? `This step runs on ${m.name}.` : `This step runs on model ${current.value}.`
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const rows = []
    let { data } = await api.get('/llm/models/')
    for (;;) {
      rows.push(...(Array.isArray(data) ? data : data?.results || []))
      if (Array.isArray(data) || !data?.next) break
      ;({ data } = await api.get(data.next))
    }
    models.value = rows
  } catch {
    error.value = 'Could not load the models.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<style scoped>
.lm { display: grid; gap: 6px; }
.lm-foot { display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.lm-help { margin: 0; font-size: 12px; color: var(--vm-ink-faint); }
.lm-err { margin: 0; font-size: 12px; color: var(--vm-red-ink); }
.lm-btn {
  min-height: 28px; padding: 3px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface);
  color: var(--vm-link); font: inherit; font-size: 12px; cursor: pointer;
}
.lm-btn:hover { background: var(--vm-surface-soft); }
.lm-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
@media (pointer: coarse) { .lm-btn { min-height: 44px; } }
</style>
