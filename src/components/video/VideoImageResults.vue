<template>
  <!-- The images made in this session (VIDEO_STUDIO_AGENT_FLOW_PLAN.md D14), newest first, each on a dark frame like
       the monitor. An image goes into a video (the opening shot when the video model starts from one, else a
       reference) or is saved as a named ingredient for any later video. -->
  <div class="vir" data-test="image-results">
    <div v-if="!video.sessionImages.length" class="vir-empty">
      <p class="vir-empty-title">No images yet</p>
      <p>Choose Image in the box, describe the picture and press Create. The images show here, ready to use in a video.</p>
    </div>
    <ul v-else class="vir-grid" aria-label="Images in this session">
      <li v-for="img in video.sessionImages" :key="img.attachment_id" class="vir-card" data-test="image-result">
        <a :href="img.url" target="_blank" rel="noopener noreferrer" class="vir-frame" :aria-label="'Open ' + img.title + ' full size'">
          <MediaThumb :item="{ ...img, media_type: img.media_type || 'image' }" :src="img.url" />
        </a>
        <form v-if="savingId === img.attachment_id" class="vir-save" @submit.prevent="save(img)">
          <label class="vir-field"><span>Name</span>
            <input v-model="draft.name" maxlength="80" required placeholder="Lavender candle" data-test="image-ing-name" /></label>
          <div class="vir-field"><span>Kind</span>
            <VideoChoice v-model="draft.kind" :options="kinds" label="Kind" drop="down" test-id="image-ing-kind" /></div>
          <div class="vir-actions">
            <button type="submit" class="vir-btn primary" :disabled="!draft.name.trim() || busy" data-test="image-ing-save">{{ busy ? 'Saving…' : 'Save' }}</button>
            <button type="button" class="vir-btn" @click="savingId = ''">Cancel</button>
          </div>
        </form>
        <div v-else class="vir-actions">
          <button type="button" class="vir-btn primary" data-test="image-use-in-video" @click="useInVideo(img)">Use in video</button>
          <button type="button" class="vir-btn" data-test="image-save-ingredient" @click="startSave(img)">Save as ingredient</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import MediaThumb from '../common/MediaThumb.vue'
import { useVideoStore } from '../../stores/useVideoStore'
import { useChatStore } from '../../stores/useChatStore'
import { notify } from '../../composables/useNotify'
import VideoChoice from './VideoChoice.vue'

const video = useVideoStore()
const chat = useChatStore()
const kinds = [{ value: 'product', label: 'Product' }, { value: 'character', label: 'Character' },
               { value: 'location', label: 'Location' }, { value: 'style', label: 'Style' }]
const savingId = ref('')
const busy = ref(false)
const draft = reactive({ name: '', kind: 'product' })

// The video model decides the role: an opening shot when it starts from an image and none is set yet, else a
// reference. The composer flags it if the model takes neither, with a model that does.
function useInVideo(img) {
  video.setKind('video')
  const opening = video.can.startFrame && !video.refs.some((r) => r.role === 'first_frame')
  video.addExistingRef(img, opening ? 'first_frame' : 'subject')
  notify.success(opening ? 'Added as the opening shot. Describe the video and get an estimate.'
    : 'Added as a reference. Describe the video and get an estimate.')
  // Back to the box (on a phone that is the Agent tab), keeping what is already typed.
  window.dispatchEvent(new CustomEvent('video-compose', { detail: { text: video.studioDraft || '' } }))
}
function startSave(img) {
  savingId.value = img.attachment_id
  Object.assign(draft, { name: '', kind: 'product' })
}
async function save(img) {
  busy.value = true
  try {
    const ing = await video.createIngredient({ kind: draft.kind, name: draft.name.trim(), description: '', attachmentIds: [img.attachment_id] })
    if (ing) savingId.value = ''
  } finally { busy.value = false }
}
// Reloaded when the session changes and when a turn ends (the agent may have made images).
watch(() => chat.conversationId, (cid) => video.loadSessionImages(cid), { immediate: true })
watch(() => chat.isBusy, (now, was) => { if (was && !now && chat.conversationId) video.loadSessionImages(chat.conversationId) })
</script>

<style scoped>
.vir { display: grid; gap: 12px; }
.vir-empty { padding: 28px 4px; max-width: 34em; }
.vir-empty p { margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--vm-ink-soft, #64748b); }
.vir-empty .vir-empty-title { margin-bottom: 4px; font-size: 15px; font-weight: 600; color: var(--vm-ink, #0f172a); }
.vir-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
.vir-card { display: grid; gap: 8px; min-width: 0; }
/* The frame: black like the monitor, so an image is judged on true colour; the whole picture shows, never cropped. */
.vir-frame { display: grid; place-items: center; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 6px; background: #000;
  outline: 1px solid var(--vm-line-2, #e5e7eb); outline-offset: -1px; }
.vir-frame img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
.vir-frame:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
.vir-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.vir-btn { min-height: 34px; padding: 0 12px; border: 1px solid var(--vm-line, #dce3ee); border-radius: 6px; background: transparent;
  color: var(--vm-ink, #0f172a); font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: background-color .15s; }
.vir-btn:hover:not(:disabled) { background: var(--vm-surface-2, #f1f5f9); }
.vir-btn.primary { border-color: transparent; background: var(--vm-violet-d, #4f46e5); color: #fff; }
.vir-btn.primary:hover:not(:disabled) { background: var(--vm-violet, #6366f1); }
.vir-btn:disabled { opacity: .45; cursor: not-allowed; }
.vir-btn:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
.vir-save { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 6px; }
.vir-field { display: grid; gap: 4px; font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.vir-field input { min-height: 36px; padding: 0 10px; box-sizing: border-box; border: 1px solid var(--vm-line, #dce3ee); border-radius: 6px;
  background: var(--vm-surface-2, #fff); color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; }
.vir-field input:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 0; }
@media (pointer: coarse) { .vir-btn { min-height: 44px; } .vir-field input { min-height: 44px; font-size: 16px; } }
@media (max-width: 480px) { .vir-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
@media (prefers-reduced-motion: reduce) { .vir-btn { transition: none; } }
</style>
