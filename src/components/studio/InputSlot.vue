<template>
  <div class="islot" role="group" :aria-labelledby="labelId">
    <div class="islot-heading"><h2 :id="labelId">{{ label }}</h2><span v-if="!required" class="st-pill">Optional</span></div>
    <div class="islot-drop" @dragover.prevent @drop.prevent="acceptFiles($event.dataTransfer?.files)">
      <svg class="st-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 16V3M7 8l5-5 5 5M4 15v6h16v-6" /></svg>
      <p>{{ allowUpload ? `Drop ${kinds.join(' or ')} files here` : `Choose ${kinds.map(k => ({ image: 'an image', video: 'a video', audio: 'an audio file' })[k] || `a ${k}`).join(' or ')} from your Library` }}</p><p class="islot-limit">{{ kinds.join(' / ') }} &middot; up to {{ limit }}</p>
      <div class="islot-actions"><button v-if="allowUpload" type="button" class="st-button" :disabled="items.length >= limit" @click="fileInput.click()">Upload</button><button type="button" class="st-button" :disabled="items.length >= limit" @click="openPicker('files', $event)">From Library</button><button type="button" class="st-button" :disabled="items.length >= limit" @click="openPicker('ingredients', $event)">From Elements</button></div>
      <input ref="fileInput" class="st-sr" type="file" :accept="kinds.map(kind => kind + '/*').join(',')" :multiple="limit > 1" :aria-label="`Upload ${label}`" @change="acceptFiles($event.target.files); $event.target.value = ''" />
    </div>
    <ul v-if="items.length" class="islot-files" :aria-label="label"><li v-for="item in items" :key="item.key || item.attachment_id"><img v-if="item.thumbnail_url || (item.file && item.url)" :src="item.thumbnail_url || item.url" alt="" /><span>{{ item.name || item.title || item.filename }}</span><button type="button" class="st-button" :aria-label="`Remove ${item.name || item.title || 'file'}`" @click="emit('remove', item)">Remove</button></li></ul>
    <p v-if="error" class="st-error" role="alert">{{ error }}</p>
    <VideoLibrary v-if="picker" mode="picker" :initial-tab="picker" :allowed-kinds="kinds" @pick="pickItems([$event])" @pick-element="pickItems($event.files || [])" @close="closePicker" />
  </div>
</template>
<script setup>
import { defineAsyncComponent, nextTick, ref, useId } from 'vue'
const VideoLibrary = defineAsyncComponent(() => import('../video/VideoLibrary.vue'))
const props = defineProps({ label: { type: String, required: true }, allowUpload: { type: Boolean, default: true }, required: Boolean, kinds: { type: Array, default: () => ['image'] }, limit: { type: Number, default: 1 }, items: { type: Array, default: () => [] } })
const emit = defineEmits(['add-files','pick','remove'])
const labelId = `slot-${useId()}`, fileInput = ref(null), picker = ref(''), error = ref('')
let returnTo
function openPicker(tab, event) { returnTo = event.currentTarget; picker.value = tab; error.value = '' }
async function closePicker() { picker.value = ''; await nextTick(); returnTo?.focus() }
function validate(items, kindOf) {
  error.value = ''
  if (!items.length) { error.value = 'This Element has no usable files.'; return false }
  if (items.some(item => !props.kinds.includes(kindOf(item)))) { error.value = `Choose ${props.kinds.join(' or ')} files only.`; return false }
  if (props.items.length + items.length > props.limit) { error.value = `This slot takes up to ${props.limit}. Remove a file before adding more.`; return false }
  return true
}
function acceptFiles(files) { if (!props.allowUpload) { error.value = 'Choose an existing file from the Library.'; return }; const items = [...(files || [])]; if (validate(items, file => file.type.split('/')[0])) emit('add-files', items) }
function pickItems(items) { if (validate(items, item => item.media_type || (item.isVideo ? 'video' : 'image'))) { emit('pick', items); closePicker() } }
</script>
<style scoped>
.islot{display:grid;gap:10px;min-width:0}.islot:focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:4px;border-radius:7px}.islot-heading{display:flex;align-items:center;gap:8px}.islot-heading h2{font-size:13px;font-weight:500}.islot-drop{display:grid;justify-items:center;gap:7px;padding:18px 10px;border:1px dashed var(--vm-line);border-radius:7px;background:var(--vm-bg);color:var(--vm-ink-soft);text-align:center}.islot-drop p{font-size:13px}.islot-drop .islot-limit{font-size:12px}.islot-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:8px}.islot-actions button{font-size:11px;padding:6px 8px;min-height:34px}.islot-files{display:grid;gap:6px;padding:0;margin:0;list-style:none}.islot-files li{display:flex;align-items:center;gap:8px;min-width:0;padding:7px;border:1px solid var(--vm-line);border-radius:6px}.islot-files img{width:34px;height:34px;object-fit:cover;border-radius:4px}.islot-files span{flex:1;min-width:0;overflow-wrap:anywhere;font-size:12px}.islot-files button{min-height:32px;padding:5px 7px;font-size:11px}@media(max-width:767px){.islot-actions button,.islot-files button{min-height:44px;font-size:12px}}
</style>
