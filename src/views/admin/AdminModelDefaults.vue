<template>
  <div class="md">
    <header class="md-hero">
      <div class="md-eyebrow">Platform policy</div>
      <h1>Default models</h1>
      <p>
        Every agent runs on these unless its owner picks another model for that job. Changing one here moves every
        agent still on the default, built-in agents included.
      </p>
    </header>

    <div v-if="loading" class="md-loading">
      <div v-for="n in 7" :key="n" class="md-skeleton"></div>
    </div>

    <section v-else class="md-card" aria-labelledby="md-title">
      <h2 id="md-title">Model for each job</h2>
      <p class="md-sub">Only models on the platform's own connections that can do the job are listed.</p>

      <div v-for="row in slots" :key="row.slot" class="md-row" :data-test="`default-${row.slot}`">
        <div class="md-what">
          <span class="md-label">{{ row.label }}</span>
          <span class="md-hint">{{ HINTS[row.slot] }}</span>
        </div>
        <div class="md-pick">
          <ModelPicker
            :model-value="draft[row.slot]"
            :models="row.options"
            :placeholder="row.options.length ? 'No default: people pick their own' : 'No platform model can do this yet'"
            @update:model-value="draft[row.slot] = $event"
          />
          <div class="md-meta">
            <span v-if="priceOf(row)" class="md-price">{{ priceOf(row) }}</span>
            <button v-if="draft[row.slot]" type="button" class="md-link" @click="draft[row.slot] = null">Clear</button>
          </div>
          <p v-if="fieldErrors[row.slot]" class="md-error" role="alert">{{ fieldErrors[row.slot] }}</p>
        </div>
      </div>

      <div v-if="error" class="md-banner" role="alert">{{ error }}</div>
      <div class="md-actions">
        <button class="md-save" type="button" :disabled="saving || !changed" data-test="defaults-save" @click="save">
          {{ saving ? 'Saving…' : 'Save defaults' }}
        </button>
        <span v-if="savedAt" class="md-saved" role="status">Saved</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../../services/api'
import ModelPicker from '../../components/common/ModelPicker.vue'

// What each job is, in the words an admin needs to choose (agentic-docs/PLATFORM_MODEL_DEFAULTS_PLAN.md).
const HINTS = {
  default_model: 'Writes every answer and calls the tools.',
  vision_model: 'Reads images people send or agents make.',
  video_input_model: 'Watches a video with its sound: what happens, what is said, and when.',
  image_model: 'Makes and edits images.',
  video_model: 'Makes video (Video Studio).',
  audio_model: 'Speaks text aloud.',
  audio_transcription_model: 'Turns speech in audio and video into text.',
}

const loading = ref(true)
const saving = ref(false)
const slots = ref([])
const saved = reactive({})
const draft = reactive({})
const fieldErrors = reactive({})
const error = ref('')
const savedAt = ref(null)

function take(payload) {
  slots.value = payload.slots || []
  for (const row of slots.value) {
    saved[row.slot] = row.model ? row.model.id : null
    draft[row.slot] = saved[row.slot]
    fieldErrors[row.slot] = ''
  }
}

const changed = computed(() => slots.value.some(row => (draft[row.slot] ?? null) !== (saved[row.slot] ?? null)))

function perMillion(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? `$${(n * 1e6).toFixed(2)}` : ''
}
function priceOf(row) {
  const m = row.options.find(o => o.id === draft[row.slot])
  if (!m) return ''
  const i = perMillion(m.pricing_input), o = perMillion(m.pricing_output)
  return i || o ? `${i || '-'} in / ${o || '-'} out per 1M tokens · ${m.provider_name}` : m.provider_name
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/admin/platform-model-defaults/')
    take(data)
  } catch (e) {
    error.value = 'Could not load the defaults.'
  } finally {
    loading.value = false
  }
}

async function save() {
  error.value = ''
  savedAt.value = null
  const body = {}
  for (const row of slots.value) {
    if ((draft[row.slot] ?? null) !== (saved[row.slot] ?? null)) body[row.slot] = draft[row.slot] ?? null
  }
  saving.value = true
  try {
    const { data } = await api.put('/admin/platform-model-defaults/', body)
    take(data)
    savedAt.value = Date.now()
  } catch (e) {
    const err = e?.response?.data?.error || {}
    for (const [slot, why] of Object.entries(err.fields || {})) fieldErrors[slot] = why
    error.value = err.message || 'The defaults were not saved.'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.md { padding: 24px; max-width: 980px; margin: 0 auto; }
.md-hero { margin-bottom: 20px; }
.md-eyebrow { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; }
.md-hero h1 { margin: 4px 0 6px; font-size: 26px; color: #111827; }
.md-hero p { margin: 0; color: #4b5563; max-width: 68ch; line-height: 1.55; }

.md-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
.md-card h2 { margin: 0 0 4px; font-size: 16px; color: #111827; }
.md-sub { margin: 0 0 8px; color: #6b7280; font-size: 13px; }

.md-row { display: grid; grid-template-columns: minmax(180px, 260px) 1fr; gap: 16px; padding: 14px 0; border-top: 1px solid #f3f4f6; }
.md-what { display: flex; flex-direction: column; gap: 3px; }
.md-label { font-size: 14px; font-weight: 600; color: #111827; }
.md-hint { font-size: 12.5px; color: #4b5563; line-height: 1.5; }
.md-pick { min-width: 0; }
.md-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; min-height: 20px; }
.md-price { font-size: 12px; color: #4b5563; }
.md-link { background: none; border: 0; color: #2563eb; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 600; padding: 4px 6px; border-radius: 6px; }
.md-link:focus-visible, .md-save:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.md-error { margin: 6px 0 0; font-size: 12.5px; color: #b91c1c; }

.md-banner { border-radius: 8px; padding: 10px 12px; font-size: 13px; margin: 12px 0; background: #fee2e2; color: #991b1b; }
.md-actions { display: flex; gap: 12px; align-items: center; padding-top: 14px; border-top: 1px solid #f3f4f6; }
.md-save { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 10px 18px; font-weight: 600; cursor: pointer; min-height: 40px; transition: background-color .15s; }
.md-save:hover:not(:disabled) { background: #1d4ed8; }
.md-save:disabled { opacity: .55; cursor: default; }
.md-saved { font-size: 13px; color: #065f46; }

.md-loading { display: grid; gap: 10px; }
.md-skeleton { height: 56px; border-radius: 10px; background: #f3f4f6; }

@media (max-width: 767px) {
  .md { padding: 16px; }
  .md-row { grid-template-columns: 1fr; gap: 8px; }
  .md-save { width: 100%; min-height: 44px; }
  .md-link { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .md-save { transition: none; } }
</style>
