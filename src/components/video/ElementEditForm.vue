<template>
  <form class="ee" :aria-label="`Edit ${element.name}`" data-test="el-edit-form" @submit.prevent="save">
    <label class="ee-field"><span>Name</span><input v-model="name" maxlength="80" required data-test="ee-name" /></label>
    <label class="ee-field"><span>Description</span><textarea v-model="description" rows="2" maxlength="1000"></textarea></label>
    <div class="ee-row">
      <label class="ee-field"><span>Token</span>
        <span class="ee-token"><span aria-hidden="true">@</span><input v-model="handle" maxlength="32" pattern="[a-zA-Z][a-zA-Z0-9_]{1,31}" data-test="ee-handle" aria-describedby="ee-token-help" spellcheck="false" autocomplete="off" translate="no" /></span></label>
      <label class="ee-field"><span>Folder</span><input v-model="folder" maxlength="80" :list="listId" placeholder="No folder" autocomplete="off" data-test="ee-folder" />
        <datalist :id="listId"><option v-for="f in folders" :key="f" :value="f" /></datalist></label>
    </div>
    <p id="ee-token-help" class="ee-note">Write the token in any prompt to use this Element. Letters, digits and underscores.</p>
    <fieldset v-if="fields.length" class="ee-set">
      <legend>{{ kindLabel }} details</legend>
      <template v-for="[key, spec] in fields" :key="key">
        <label v-if="spec.type === 'text'" class="ee-field"><span>{{ propertyLabel(key) }}</span>
          <input v-model="props_[key]" :maxlength="spec.max" :data-test="`ee-prop-${key}`" /></label>
        <label v-else-if="spec.type === 'select'" class="ee-field"><span>{{ propertyLabel(key) }}</span>
          <select v-model="props_[key]" :data-test="`ee-prop-${key}`"><option value="">Not set</option><option v-for="o in spec.options" :key="o" :value="o">{{ o }}</option></select></label>
        <fieldset v-else class="ee-multi"><legend>{{ propertyLabel(key) }} <span class="ee-note">(up to {{ spec.max }})</span></legend>
          <label v-for="o in spec.options" :key="o" class="ee-opt"><input type="checkbox" :value="o" :checked="(props_[key] || []).includes(o)"
            :disabled="!(props_[key] || []).includes(o) && (props_[key] || []).length >= spec.max" @change="toggle(key, o)" /> {{ o }}</label>
        </fieldset>
      </template>
    </fieldset>
    <fieldset v-if="element.files.length" class="ee-set">
      <legend>View of each file</legend>
      <label v-for="f in element.files" :key="f.attachment_id" class="ee-view">
        <img v-if="f.thumbnail_url" :src="f.thumbnail_url" alt="" class="ee-mini" width="48" height="32" loading="lazy" />
        <span class="ee-file">{{ f.title }}</span>
        <select v-model="labels[f.attachment_id]" :aria-label="`View of ${f.title}`"><option value="">No label</option>
          <option v-for="(label, value) in VIEW_LABELS" :key="value" :value="value">{{ label }}</option></select>
      </label>
    </fieldset>
    <p v-if="element.status === 'approved' && changesWhatItShows" class="ee-warn" role="status">Changing these details returns it to draft: approve it again to use it.</p>
    <div class="ee-actions">
      <button type="submit" class="ee-btn primary" :disabled="busy || !name.trim()" data-test="ee-save">{{ busy ? 'Saving…' : 'Save changes' }}</button>
      <button type="button" class="ee-btn" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import { KINDS, VIEW_LABELS, propertyLabel } from './elementKinds'

const props = defineProps({ element: { type: Object, required: true }, schema: { type: Object, default: null }, folders: { type: Array, default: () => [] } })
const emit = defineEmits(['done', 'cancel'])
const video = useVideoStore()
const el = props.element
const listId = `ee-folders-${el.ingredient_id}`
const name = ref(el.name), description = ref(el.description || ''), handle = ref(el.handle || ''), folder = ref(el.folder || '')
const props_ = reactive(JSON.parse(JSON.stringify(el.properties || {})))
const labels = reactive(Object.fromEntries((el.files || []).map(f => [f.attachment_id, f.view_label || ''])))
const busy = ref(false)
const kindLabel = (KINDS.find(k => k.value === el.kind) || { label: el.kind }).label
const fields = computed(() => Object.entries(props.schema?.properties?.[el.kind] || {}))
const cleanProps = () => Object.fromEntries(Object.entries(props_).filter(([, v]) => v !== '' && v !== null && !(Array.isArray(v) && !v.length)))
const changesWhatItShows = computed(() => JSON.stringify(cleanProps()) !== JSON.stringify(el.properties || {}))
function toggle(key, option) {
  const now = props_[key] || []
  props_[key] = now.includes(option) ? now.filter(v => v !== option) : [...now, option]
}
async function save() {
  const changes = {}
  if (name.value.trim() !== el.name) changes.name = name.value.trim()
  if (description.value.trim() !== (el.description || '')) changes.description = description.value.trim()
  if (handle.value.trim() && handle.value.trim().toLowerCase() !== el.handle) changes.handle = handle.value.trim()
  if (folder.value.trim() !== (el.folder || '')) changes.folder = folder.value.trim()
  if (changesWhatItShows.value) changes.properties = cleanProps()
  const changedLabels = Object.fromEntries(Object.entries(labels).filter(([id, v]) => v !== ((el.files || []).find(f => f.attachment_id === id)?.view_label || '')))
  if (Object.keys(changedLabels).length) changes.view_labels = changedLabels
  if (!Object.keys(changes).length) { emit('done', el); return }
  busy.value = true
  const row = await video.updateIngredient(el.ingredient_id, changes)
  busy.value = false
  if (row) emit('done', row)
}
</script>

<style scoped>
.ee { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 8px; background: var(--vm-surface-2, #f8fafc); min-width: 0; }
.ee-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.ee-field { display: grid; gap: 6px; min-width: 0; font-size: 12.5px; font-weight: 500; color: var(--vm-ink-soft, #64748b); }
.ee-field input, .ee-field select, .ee-field textarea, .ee-view select { width: 100%; min-height: 40px; box-sizing: border-box; padding: 8px 10px;
  border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px; background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; }
.ee-token { display: flex; align-items: center; gap: 4px; color: var(--vm-violet-d, #4f46e5); font-weight: 600; }
.ee-set, .ee-multi { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
.ee-set > legend, .ee-multi > legend { padding: 0; margin-bottom: 2px; font-size: 13px; font-weight: 600; color: var(--vm-ink, #0f172a); }
.ee-multi { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.ee-multi > legend { width: 100%; font-size: 12.5px; font-weight: 500; color: var(--vm-ink-soft, #64748b); }
.ee-opt { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; font-size: 13px; color: var(--vm-ink, #0f172a); }
.ee-opt input { width: 16px; height: 16px; accent-color: var(--vm-violet-d, #4f46e5); }
.ee-view { display: grid; grid-template-columns: 48px minmax(0, 1fr) minmax(120px, 160px); align-items: center; gap: 8px; }
.ee-mini { width: 48px; height: 32px; object-fit: cover; border-radius: 4px; background: #000; }
.ee-file { font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink, #0f172a); }
.ee-note { margin: 0; font-size: 12px; font-weight: 400; color: var(--vm-ink-soft, #64748b); }
.ee-warn { margin: 0; font-size: 12.5px; color: var(--vs-warn-ink, #92400e); }
.ee-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.ee-btn { min-height: 36px; padding: 0 12px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px; background: transparent; color: var(--vm-ink, #0f172a);
  font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.ee-btn.primary { background: var(--vm-violet-d, #4f46e5); color: #fff; border-color: transparent; font-weight: 600; }
.ee-btn:disabled { opacity: .45; cursor: not-allowed; }
.ee :focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
@media (pointer: coarse) { .ee-btn, .ee-opt { min-height: 44px; } }
@media (max-width: 640px) { .ee-field input, .ee-field select, .ee-field textarea, .ee-view select { font-size: 16px; } .ee-view { grid-template-columns: 48px minmax(0, 1fr); } .ee-view select { grid-column: 1 / -1; } }
</style>
