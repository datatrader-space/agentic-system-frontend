<template>
  <!-- Every kept version of an Element, newest first. Viewing one shows its files; restoring makes a new revision (a
       draft to approve), so nothing is ever overwritten. -->
  <section class="eh" :aria-label="`Versions of ${element.name}`" data-test="el-history">
    <p v-if="versions === null" class="eh-note" role="status">Loading versions…</p>
    <ol v-else class="eh-list">
      <li v-for="v in versions" :key="v.number" class="eh-item">
        <div class="eh-head">
          <strong>Version {{ v.number }}</strong>
          <span class="eh-note">{{ when(v.created_at) }}<template v-if="v.note">, {{ v.note.toLowerCase() }}</template>, {{ v.file_count }} file{{ v.file_count === 1 ? '' : 's' }}</span>
          <span v-if="v.current" class="eh-current">Current</span>
          <button v-else type="button" class="eh-link" :aria-expanded="openNumber === v.number" :data-test="`eh-view-${v.number}`" @click="view(v)">{{ openNumber === v.number ? 'Hide' : 'View' }}</button>
        </div>
        <div v-if="openNumber === v.number" class="eh-detail">
          <p v-if="!detail" class="eh-note" role="status">Loading…</p>
          <template v-else>
            <p v-if="detail.name !== element.name" class="eh-note">Named {{ detail.name }} then.</p>
            <div class="eh-thumbs">
              <figure v-for="f in detail.files" :key="f.attachment_id" class="eh-fig">
                <img v-if="f.thumbnail_url" :src="f.thumbnail_url" :alt="f.title" class="eh-mini" width="72" height="48" loading="lazy" />
                <span v-else class="eh-mini eh-kind">{{ f.media_type }}</span>
                <figcaption v-if="f.view_label">{{ VIEW_LABELS[f.view_label] || f.view_label }}</figcaption>
              </figure>
              <p v-if="!detail.files.length" class="eh-note">No files are left from this version.</p>
            </div>
            <div v-if="confirming === v.number" class="eh-confirm" role="alert">
              <span>Restore version {{ v.number }}? It becomes version {{ element.revision + 1 }}, a draft to approve.</span>
              <button type="button" class="eh-btn primary" :data-test="`eh-restore-confirm-${v.number}`" :disabled="busy" @click="restore(v)">Restore</button>
              <button type="button" class="eh-btn" @click="confirming = 0">Cancel</button>
            </div>
            <button v-else type="button" class="eh-btn" :data-test="`eh-restore-${v.number}`" @click="confirming = v.number">Restore this version</button>
          </template>
        </div>
      </li>
    </ol>
    <button type="button" class="eh-btn" @click="emit('cancel')">Close history</button>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import { VIEW_LABELS } from './elementKinds'

const props = defineProps({ element: { type: Object, required: true } })
const emit = defineEmits(['done', 'cancel'])
const video = useVideoStore()
const versions = ref(null), openNumber = ref(0), detail = ref(null), confirming = ref(0), busy = ref(false)
const when = iso => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
async function view(v) {
  if (openNumber.value === v.number) { openNumber.value = 0; return }
  openNumber.value = v.number; detail.value = null; confirming.value = 0
  detail.value = await video.loadIngredientVersion(props.element.ingredient_id, v.number)
}
async function restore(v) {
  busy.value = true
  const row = await video.restoreIngredientVersion(props.element.ingredient_id, v.number)
  busy.value = false
  if (row) emit('done', row)
}
onMounted(async () => { versions.value = (await video.loadIngredientVersions(props.element.ingredient_id)) || [] })
</script>

<style scoped>
.eh { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 8px; background: var(--vm-surface-2, #f8fafc); min-width: 0; }
.eh-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.eh-item { display: grid; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.eh-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; font-size: 13px; }
.eh-note { margin: 0; font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.eh-current { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--vs-good-ink, #166534); }
.eh-link { margin-left: auto; min-height: 32px; padding: 0; border: 0; background: transparent; color: var(--vs-accent-ink, var(--vm-violet-d, #4f46e5));
  font: inherit; font-size: 12.5px; cursor: pointer; }
.eh-link:hover { text-decoration: underline; text-underline-offset: 2px; }
.eh-detail { display: grid; gap: 8px; }
.eh-thumbs { display: flex; flex-wrap: wrap; gap: 6px; }
.eh-fig { margin: 0; display: grid; gap: 2px; font-size: 11.5px; color: var(--vm-ink-soft, #64748b); }
.eh-mini { width: 72px; height: 48px; object-fit: cover; border-radius: 4px; background: #000; }
.eh-kind { display: grid; place-items: center; background: var(--vm-surface, #f1f5f9); font-size: 11.5px; }
.eh-confirm { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 13px; }
.eh-btn { justify-self: start; min-height: 36px; padding: 0 12px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px; background: transparent;
  color: var(--vm-ink, #0f172a); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.eh-btn.primary { background: var(--vm-violet-d, #4f46e5); color: #fff; border-color: transparent; font-weight: 600; }
.eh-btn:disabled { opacity: .45; cursor: not-allowed; }
.eh :focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
@media (pointer: coarse) { .eh-btn, .eh-link { min-height: 44px; } }
</style>
