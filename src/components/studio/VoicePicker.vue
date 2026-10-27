<template>
  <div class="vp" data-field="voice_id">
    <template v-if="listed">
      <label class="st-field">Find a voice<input v-model="search" class="st-input" type="search" placeholder="Name, accent or style" data-test="voice-search" @input="queue" /></label>
      <p v-if="loading && !voices.length" class="st-status vp-status" role="status">Loading voices…</p>
      <fieldset v-if="voices.length" class="vp-list"><legend class="st-sr">Voice</legend>
        <label v-for="voice in voices" :key="voice.voice_id" class="vp-voice" :class="{ chosen: voice.voice_id === modelValue }">
          <input type="radio" name="studio-voice" :value="voice.voice_id" :checked="voice.voice_id === modelValue" @change="emit('update:modelValue', voice.voice_id)" />
          <span class="vp-name">{{ voice.name }}<small v-if="voice.category">{{ voice.category }}</small></span>
          <button v-if="voice.preview_url" type="button" class="st-button vp-play" :aria-label="`${playing === voice.voice_id ? 'Stop' : 'Play'} a sample of ${voice.name}`" @click.prevent="play(voice)">{{ playing === voice.voice_id ? 'Stop' : 'Play' }}</button>
        </label>
      </fieldset>
      <p v-else-if="!loading && !failure" class="st-muted vp-status">No voice matches that search.</p>
      <button v-if="nextToken" type="button" class="st-button" :disabled="loading" @click="load(true)">More voices</button>
    </template>
    <label v-else class="st-field">Voice ID<input class="st-input" :value="modelValue" maxlength="64" placeholder="The voice's ID from the provider" data-test="voice-id" @input="emit('update:modelValue', $event.target.value.trim())" /></label>
    <p v-if="failure" class="st-error" role="alert">{{ failure }}</p>
  </div>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
// The voices a speech or voice-change model offers (a free read with that model's key). A provider without a voice
// list takes a voice ID instead.
const props = defineProps({ modelValue: { type: String, default: '' }, routeId: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
const voices = ref([]), listed = ref(true), loading = ref(false), failure = ref(''), search = ref(''), nextToken = ref(''), playing = ref('')
let sequence = 0, timer = null, audio = null, disposed = false
async function load(more = false) {
  if (!props.routeId) { voices.value = []; return }
  const seq = ++sequence
  loading.value = true; failure.value = ''
  try {
    const { data } = await api.getMediaVoices({ route_id: props.routeId, search: search.value.trim() || undefined, page_token: more ? nextToken.value : undefined })
    if (disposed || seq !== sequence) return
    listed.value = data.listed !== false
    voices.value = more ? [...voices.value, ...(data.voices || [])] : (data.voices || [])
    nextToken.value = data.next_page_token || ''
  } catch (e) { if (!disposed && seq === sequence) failure.value = e.response?.data?.error?.message || 'Could not load the voices.' }
  finally { if (!disposed && seq === sequence) loading.value = false }
}
function queue() { clearTimeout(timer); timer = setTimeout(() => load(), 300) }
function play(voice) {
  audio?.pause()
  if (playing.value === voice.voice_id) { playing.value = ''; return }
  audio = new Audio(voice.preview_url); playing.value = voice.voice_id
  audio.onended = () => { playing.value = '' }
  audio.play()?.catch?.(() => { playing.value = '' })
}
watch(() => props.routeId, () => { search.value = ''; load() }, { immediate: true })
onBeforeUnmount(() => { disposed = true; clearTimeout(timer); audio?.pause() })
</script>
<style scoped>
.vp{display:grid;gap:10px;min-width:0}.vp-status{padding:0;font-size:12px}.vp-list{display:grid;gap:4px;max-height:260px;overflow:auto;margin:0;padding:4px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-bg)}.vp-voice{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 8px;border:1px solid transparent;border-radius:6px;cursor:pointer}.vp-voice:hover{background:var(--vm-surface-2)}.vp-voice.chosen{border-color:var(--vm-violet);background:var(--vm-surface-2)}.vp-voice input{width:16px;height:16px;flex-shrink:0}.vp-name{display:grid;flex:1;min-width:0;font-size:13px;overflow-wrap:anywhere}.vp-name small{color:var(--vm-ink-soft);font-size:11px}.vp-play{min-height:32px;padding:4px 9px;font-size:12px}@media(max-width:767px){.vp-play{min-height:44px}}
</style>
