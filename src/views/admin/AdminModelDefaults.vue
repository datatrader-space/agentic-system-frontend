<template>
  <div class="md admin-page">
    <header class="md-hero admin-page-header">
      <div class="md-eyebrow">Platform policy</div>
      <h1 class="admin-page-title">Default models</h1>
      <p>
        Every agent runs on these unless its owner picks another model for that job. Changing one here moves every
        agent still on the default, built-in agents included.
      </p>
    </header>

    <div v-if="loading" class="md-loading">
      <div v-for="n in 8" :key="n" class="md-skeleton"></div>
    </div>

    <section v-else class="md-card admin-surface" aria-labelledby="md-title">
      <h2 class="admin-section-title" id="md-title">Model for each job</h2>
      <p class="md-sub">Only models on the platform's own connections that can do the job are listed.</p>

      <template v-for="row in slots" :key="row.slot">
      <div class="md-row" :data-test="`default-${row.slot}`">
        <div class="md-what">
          <span class="md-label">{{ row.label || LABELS[row.slot] || row.slot }}</span>
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

      <!-- The voice the Audio generation model speaks replies to voice notes in (VOICE_NOTES_PLAN.md). -->
      <div v-if="row.slot === 'audio_model'" class="md-row" data-test="default-audio-voice">
        <div class="md-what">
          <label class="md-label" for="md-voice">Reply voice</label>
          <span class="md-hint">The voice an agent answers a voice note in. No voice: voice notes are answered in text only.</span>
        </div>
        <div class="md-pick">
          <p v-if="(draft.audio_model ?? null) !== (saved.audio_model ?? null)" class="md-hint md-voice-note">
            Save the Audio generation model first, then choose its voice.
          </p>
          <p v-else-if="!saved.audio_model" class="md-hint md-voice-note">Choose an Audio generation model first.</p>
          <template v-else>
            <div class="md-voice">
              <select id="md-voice" class="md-select" :value="draftVoice?.voice_id || ''" :disabled="voicesLoading"
                      data-test="voice-select" @change="pickVoice($event.target.value)">
                <option value="">{{ voicesLoading ? 'Loading voices…' : 'No voice: replies are text only' }}</option>
                <option v-if="draftVoice && !voices.some(v => v.voice_id === draftVoice.voice_id)" :value="draftVoice.voice_id">
                  {{ draftVoice.name || draftVoice.voice_id }}
                </option>
                <option v-for="v in voices" :key="v.voice_id" :value="v.voice_id">{{ v.name }}</option>
              </select>
              <button v-if="samplePreview" type="button" class="md-link" data-test="voice-sample" @click="playSample">
                {{ sampling ? 'Stop sample' : 'Play sample' }}
              </button>
            </div>
            <p v-if="voicesError" class="md-error" role="alert">{{ voicesError }}</p>
            <p v-if="fieldErrors.audio_voice" class="md-error" role="alert">{{ fieldErrors.audio_voice }}</p>
          </template>
        </div>
      </div>
      </template>

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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
  fast_model: 'Small steps: summaries, notes, Explore subagents.',
}
// The name of a job the server sends without one.
const LABELS = { fast_model: 'Fast model' }

const loading = ref(true)
const saving = ref(false)
const slots = ref([])
const saved = reactive({})
const draft = reactive({})
const fieldErrors = reactive({})
const error = ref('')
const savedAt = ref(null)

function take(payload) {
  const audioBefore = saved.audio_model ?? null
  slots.value = payload.slots || []
  for (const row of slots.value) {
    saved[row.slot] = row.model ? row.model.id : null
    draft[row.slot] = saved[row.slot]
    fieldErrors[row.slot] = ''
  }
  savedVoice.value = payload.audio_voice || null
  draftVoice.value = savedVoice.value
  fieldErrors.audio_voice = ''
  if ((saved.audio_model ?? null) !== audioBefore || !voices.value.length) loadVoices()
}

// The reply voice (VOICE_NOTES_PLAN.md): {voice_id, name} or null, and the voices the saved Audio generation model has.
const savedVoice = ref(null)
const draftVoice = ref(null)
const voices = ref([])
const voicesLoading = ref(false)
const voicesError = ref('')
const sampling = ref(false)
let sampleAudio = null

const voiceChanged = computed(() => (draftVoice.value?.voice_id || '') !== (savedVoice.value?.voice_id || ''))
const changed = computed(() => voiceChanged.value
  || slots.value.some(row => (draft[row.slot] ?? null) !== (saved[row.slot] ?? null)))
const samplePreview = computed(() => voices.value.find(v => v.voice_id === draftVoice.value?.voice_id)?.preview_url || '')

function pickVoice(id) {
  const v = voices.value.find(x => x.voice_id === id)
  draftVoice.value = id ? { voice_id: id, name: v ? v.name : (draftVoice.value?.name || id) } : null
  stopSample()
}
function stopSample() {
  try { sampleAudio?.pause() } catch { /* ignore */ }
  sampleAudio = null
  sampling.value = false
}
function playSample() {
  if (sampling.value) { stopSample(); return }
  sampleAudio = new Audio(samplePreview.value)
  sampleAudio.onended = stopSample
  sampling.value = true
  sampleAudio.play().catch(stopSample)
}
async function loadVoices() {
  voices.value = []
  voicesError.value = ''
  if (!saved.audio_model) return
  voicesLoading.value = true
  try {
    const { data } = await api.get('/admin/platform-model-defaults/voices/')
    voices.value = data.voices || []
    if (!data.listed && data.message) voicesError.value = data.message
  } catch (e) {
    voicesError.value = e?.response?.data?.error?.message || 'The voices could not be listed.'
  } finally {
    voicesLoading.value = false
  }
}

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
  if (voiceChanged.value) body.audio_voice = draftVoice.value
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
onBeforeUnmount(stopSample)
</script>

<style scoped>
.md { padding: 24px; max-width: 980px; margin: 0 auto; }
.md-hero { margin-bottom: 20px; }
.md-eyebrow { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; }
.md-hero h1 { margin: 4px 0 6px; font-size: 26px; color: var(--admin-ink, #111827); }
.md-hero p { margin: 0; color: #4b5563; max-width: 68ch; line-height: 1.55; }

.md-card { background: var(--admin-surface, #fff); border: 1px solid var(--admin-line, #e5e7eb); border-radius: 12px; padding: 20px; }
.md-card h2 { margin: 0 0 4px; font-size: 16px; color: var(--admin-ink, #111827); }
.md-sub { margin: 0 0 8px; color: #6b7280; font-size: 13px; }

.md-row { display: grid; grid-template-columns: minmax(180px, 260px) 1fr; gap: 16px; padding: 14px 0; border-top: 1px solid #f3f4f6; }
.md-what { display: flex; flex-direction: column; gap: 3px; }
.md-label { font-size: 14px; font-weight: 600; color: var(--admin-ink, #111827); }
.md-hint { font-size: 12.5px; color: #4b5563; line-height: 1.5; }
.md-pick { min-width: 0; }
.md-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; min-height: 20px; }
.md-price { font-size: 12px; color: #4b5563; }
.md-link { background: none; border: 0; color: #2563eb; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 600; padding: 4px 6px; border-radius: 6px; }
.md-link:focus-visible, .md-save:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.md-error { margin: 6px 0 0; font-size: 12.5px; color: #b91c1c; }
.md-voice { display: flex; align-items: center; gap: 10px; }
.md-select { flex: 1; min-width: 0; min-height: 40px; padding: 8px 10px; border: 1px solid var(--admin-line, #e5e7eb);
  border-radius: 8px; background: var(--admin-surface, #fff); color: var(--admin-ink, #111827); font: inherit; font-size: 14px; }
.md-select:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.md-voice-note { margin: 10px 0 0; }

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
  .md-select { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .md-save { transition: none; } }
</style>
