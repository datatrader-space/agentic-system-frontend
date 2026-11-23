<!--
  The model of a "Model call" step (ADM-1333, plan §3.3): the shared ModelPicker over every model the person may use.
  Left empty, the step uses the platform default for its slot (backend B18); there is no silent pick of another model.
  The whole list is read (every page); a failed read says so with Retry and keeps the saved model.
  With Images filled in (ADM-1351 phase 3), it says whether the chosen model takes images (the list's
  `supports_vision`): the server refuses a run that sends images to one that does not, in words.
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
    <p v-if="visionNote" class="lm-vision" :class="`is-${visionNote.tone}`" data-test="lm-vision">
      <Icon :icon="visionNote.tone === 'bad' ? 'lucide:triangle-alert' : 'lucide:image'" aria-hidden="true" /><span>{{ visionNote.text }}</span>
    </p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import ModelPicker from '@/components/common/ModelPicker.vue'
import { useNodeEditor } from './nodeEditor'

const editor = useNodeEditor()
const models = ref([])
const loading = ref(false)
const error = ref('')

const current = computed(() => editor.data.value.model_id ?? null)
const chosen = computed(() => models.value.find((x) => String(x.id) === String(current.value) || x.model_id === current.value) || null)
const savedLabel = computed(() => (chosen.value ? `This step runs on ${chosen.value.name}.` : `This step runs on model ${current.value}.`))

// Images are sent only to a model that takes them; said while Images holds something.
const hasImages = computed(() => String(editor.data.value.images ?? '').trim() !== '')
const visionNote = computed(() => {
  if (!hasImages.value || loading.value || error.value) return null
  if (!current.value) return { tone: 'info', text: 'The images are sent with the prompt, so the model must take images. The platform default may not: choose a model that takes images, or the run is refused.' }
  if (!chosen.value) return null
  if (chosen.value.supports_vision) return { tone: 'ok', text: `${chosen.value.name} takes images: they are sent with the prompt.` }
  return { tone: 'bad', text: `${chosen.value.name} does not take images, so a run with images is refused. Choose a model that takes images, or empty Images.` }
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
.lm-vision { display: flex; gap: 6px; align-items: flex-start; margin: 0; padding: 7px 9px; border-radius: 6px; font-size: 12px; line-height: 1.5; background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.lm-vision :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; }
.lm-vision.is-bad { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.lm-btn {
  min-height: 28px; padding: 3px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface);
  color: var(--vm-link); font: inherit; font-size: 12px; cursor: pointer;
}
.lm-btn:hover { background: var(--vm-surface-soft); }
.lm-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
@media (pointer: coarse) { .lm-btn { min-height: 44px; } }
</style>
