<template>
  <form class="creative-form" @submit.prevent="prepare">
    <div class="ca-tabs" role="tablist" aria-label="What to make">
      <button v-for="(t, i) in kinds" :key="t.id" type="button" role="tab" :aria-selected="kind === t.id" :tabindex="kind === t.id ? 0 : -1" :data-test="`audio-${t.id}`" @click="choose(t.id)" @keydown="move($event, i)">{{ t.label }}</button>
    </div>
    <p class="st-muted ca-purpose">{{ current.purpose }}</p>
    <MediaRoutePicker v-model="routeId" :operation="kind" />
    <template v-if="kind === 'speech'">
      <label class="st-field" data-field="prompt">Script<textarea v-model="script" class="st-input" rows="7" required placeholder="The words to speak, exactly as they should be read." data-test="audio-script" /></label>
      <p class="st-muted ca-count">{{ script.length.toLocaleString() }} characters. A long script is spoken in parts and joined; it is never shortened.</p>
      <VoicePicker v-model="voiceId" :route-id="routeId" />
      <label class="st-field" data-field="language">Language (optional)<input v-model="language" class="st-input" maxlength="2" placeholder="Two letters, such as en or es" /></label>
    </template>
    <template v-else-if="kind === 'sound'">
      <label class="st-field" data-field="prompt">Sound<textarea v-model="sound" class="st-input" rows="4" required placeholder="Rain on a tin roof, steady, with distant thunder." data-test="audio-sound" /></label>
      <label class="st-field" data-field="duration">Length in seconds (optional)<input v-model.number="duration" class="st-input" type="number" min="0.5" max="30" step="0.5" placeholder="The model chooses" /></label>
    </template>
    <template v-else>
      <MediaSlot v-model="recording" label="Recording" field="references" :kinds="['audio']" required hint="The words and timing of this recording are kept; only the voice changes." />
      <VoicePicker v-model="voiceId" :route-id="routeId" />
      <label class="ca-check"><input v-model="removeNoise" type="checkbox" /> Remove background noise first</label>
    </template>
    <ConsentStep v-if="consent" :request="consent" @agreed="consent.retry()" @cancel="cancelConsent" />
    <CreativeError :error="error" />
    <button class="st-button primary" :disabled="busy || !!consent || !!missing" data-test="audio-prepare">{{ busy ? 'Preparing…' : 'Review estimate' }}</button>
    <p v-if="missing && !busy" class="st-muted ca-count" role="status">{{ missing }}</p>
    <Teleport v-if="monitor" defer :to="`#${monitor}`"><MediaMonitor :items="kind === 'voice_change' ? recording.map(f => ({ ...f, role: 'Recording' })) : []" :empty="current.monitor" /></Teleport>
  </form>
</template>
<script setup>
import { computed, inject, ref } from 'vue'
import api from '../../services/api'
import CreativeError from './CreativeError.vue'
import ConsentStep from './ConsentStep.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
import MediaMonitor from './MediaMonitor.vue'
import MediaSlot from './MediaSlot.vue'
import VoicePicker from './VoicePicker.vue'
import { useMediaJob } from '../../composables/useMediaJob'
const emit = defineEmits(['job'])
const monitor = inject('studioMonitor', '')
const kinds = [
  { id: 'speech', label: 'Speech', purpose: 'A voice reading your script.', monitor: 'Write the script and choose a voice. The spoken take appears in My results once you choose Generate on its card.' },
  { id: 'sound', label: 'Sound effect', purpose: 'A sound from a short description, up to 30 seconds.', monitor: 'Describe the sound. It appears in My results once you choose Generate on its card.' },
  { id: 'voice_change', label: 'Voice change', purpose: 'Your recording spoken again in another voice. Needs the consent of the person heard.', monitor: 'Add the recording to change; you can play it here before asking for an estimate.' },
]
const kind = ref('speech'), routeId = ref(''), script = ref(''), voiceId = ref(''), language = ref(''), sound = ref(''), duration = ref(null), recording = ref([]), removeNoise = ref(false)
const current = computed(() => kinds.find(k => k.id === kind.value))
const { busy, error, consent, submit, cancelConsent } = useMediaJob(job => emit('job', job))
function choose(id) { if (kind.value !== id) { kind.value = id; routeId.value = ''; voiceId.value = ''; cancelConsent() } }
function move(event, index) {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? kinds.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : kinds.length - 1)) % kinds.length
  choose(kinds[next].id); event.currentTarget.parentElement.querySelectorAll('button')[next]?.focus()
}
const missing = computed(() => {
  if (!routeId.value) return 'Choose a model that is proven for this.'
  if (kind.value === 'speech') return !script.value.trim() ? 'Write the script.' : !voiceId.value ? 'Choose a voice.' : language.value && !/^[a-z]{2}$/.test(language.value) ? 'The language is two lowercase letters, such as en.' : ''
  if (kind.value === 'sound') return !sound.value.trim() ? 'Describe the sound.' : duration.value != null && duration.value !== '' && (duration.value < 0.5 || duration.value > 30) ? 'A sound effect is 0.5 to 30 seconds.' : ''
  return !recording.value.length ? 'Add the recording.' : !voiceId.value ? 'Choose the new voice.' : ''
})
function prepare() {
  if (missing.value) return
  const op = kind.value
  const request = op === 'speech' ? { prompt: script.value, voice_id: voiceId.value, ...(language.value ? { language: language.value } : {}) }
    : op === 'sound' ? { prompt: sound.value.trim(), ...(duration.value ? { duration: Number(duration.value) } : {}) }
    : { voice_id: voiceId.value, remove_background_noise: removeNoise.value }
  const references = op === 'voice_change' ? recording.value.map(file => ({ attachment_id: file.attachment_id, role: 'audio' })) : []
  const names = Object.fromEntries(recording.value.map(file => [file.attachment_id, file.name]))
  submit(s => api.prepareMediaJob({ operation: op, route_id: routeId.value, request, references, ...s }), names)
}
</script>
<style scoped>
.ca-tabs{display:flex;gap:3px;padding:3px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface-2)}.ca-tabs button{flex:1;min-height:36px;padding:6px 8px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--vm-ink-soft);font:500 13px var(--vm-font-sans);cursor:pointer}.ca-tabs button[aria-selected=true]{background:var(--vm-surface);border-color:var(--vm-line);color:var(--vm-ink)}.ca-purpose,.ca-count{font-size:12px;line-height:1.55}.ca-check{display:flex;align-items:center;gap:8px;min-height:36px;font-size:13px;cursor:pointer}.ca-check input{width:18px;height:18px}@media(max-width:767px){.ca-tabs button{min-height:44px}.ca-check{min-height:44px}}
</style>
