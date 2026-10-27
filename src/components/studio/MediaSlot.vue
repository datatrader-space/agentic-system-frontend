<template>
  <div class="ms" :data-field="field || undefined" :data-studio-required-empty="required && !modelValue.length ? 'true' : 'false'">
    <InputSlot :label="label" :required="required" :kinds="kinds" :limit="limit" :items="modelValue" @add-files="addFiles" @pick="pick" @remove="remove" />
    <p v-if="uploading" class="st-status ms-status" role="status">Uploading…</p>
    <p v-if="error" class="st-error" role="alert">{{ error }}</p>
    <p v-if="hint" class="st-muted ms-hint">{{ hint }}</p>
  </div>
</template>
<script setup>
import InputSlot from './InputSlot.vue'
import { useStudioUpload } from '../../composables/useStudioUpload'
import { useSessionProject } from '../../composables/useSessionProject'
// One input a page needs (a photo, a clip, a recording): uploaded into the Studio session or picked from the Library.
const props = defineProps({ modelValue: { type: Array, default: () => [] }, label: { type: String, required: true }, kinds: { type: Array, default: () => ['image'] }, limit: { type: Number, default: 1 }, required: Boolean, field: String, hint: String })
const emit = defineEmits(['update:modelValue'])
const { upload, uploading, error } = useStudioUpload()
const { linkFromLibrary } = useSessionProject()
const kindOf = item => item.media_type || (item.isVideo ? 'video' : 'image')
async function addFiles(files) {
  const added = []
  for (const file of files) { const item = await upload(file); if (item) added.push(item) }
  if (added.length) emit('update:modelValue', [...props.modelValue, ...added].slice(0, props.limit))
}
async function pick(items) {
  const chosen = items.filter(item => item.attachment_id && !props.modelValue.some(have => have.attachment_id === item.attachment_id))
  if (!chosen.length) return
  // A file from another chat is linked to this session's project first, so the job can use it.
  uploading.value++; error.value = ''
  try { await linkFromLibrary(chosen, `${props.label} session`) }
  catch (e) { error.value = e.response?.data?.error?.message || e.message || 'Could not use that file here.'; return }
  finally { uploading.value-- }
  const fresh = items.filter(item => item.attachment_id && !props.modelValue.some(have => have.attachment_id === item.attachment_id))
    .map(item => ({ attachment_id: item.attachment_id, name: item.title || item.filename || item.name || 'File', media_type: kindOf(item), url: item.url || '', thumbnail_url: item.thumbnail_url || (kindOf(item) === 'image' ? item.url : '') || '' }))
  emit('update:modelValue', [...props.modelValue, ...fresh].slice(0, props.limit))
}
function remove(item) { emit('update:modelValue', props.modelValue.filter(have => have !== item && have.attachment_id !== item.attachment_id)) }
</script>
<style scoped>.ms{display:grid;gap:8px;min-width:0}.ms-status{padding:0;font-size:12px}.ms-hint{font-size:12px;line-height:1.55}</style>
