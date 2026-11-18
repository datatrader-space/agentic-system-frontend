<template>
  <!-- Export (plan section 2.11, P4): the shapes and a resolution, then the free export job with its progress. Each
       result lands in the Library and the project. A custom dialog: no browser dialog. -->
  <div class="cx-backdrop" @click.self="$emit('close')">
    <section ref="box" class="cx" role="dialog" aria-modal="true" aria-labelledby="cx-title" tabindex="-1" @keydown.esc.prevent="$emit('close')" @keydown.tab="trap">
      <header class="cx-head"><h2 id="cx-title">Export</h2><button type="button" class="cx-close" aria-label="Close" @click="$emit('close')">×</button></header>
      <template v-if="!job">
        <fieldset class="cx-group"><legend>Shapes</legend>
          <label v-for="a in tl.ASPECTS" :key="a" class="cx-check"><input v-model="aspects" type="checkbox" :value="a" /> {{ a }}{{ a === doc.canvas.aspect ? ' (this timeline)' : '' }}</label>
        </fieldset>
        <fieldset class="cx-group"><legend>Resolution</legend>
          <label v-for="r in ['720p', '1080p']" :key="r" class="cx-check"><input v-model="resolution" type="radio" :value="r" /> {{ r }}</label>
        </fieldset>
        <p class="st-muted cx-note">{{ seconds }} long. Export is free. Positions and sizes are shares of the frame, so every shape is drawn from the same timeline; a clip set to fill its box is cropped, one set to show the whole picture is padded.</p>
        <p v-if="error" class="st-error" role="alert">{{ error }}</p>
        <button type="button" class="st-button primary" :disabled="!aspects.length || busy" @click="$emit('export', { aspects, resolution })">{{ busy ? 'Starting…' : 'Export' }}</button>
        <fieldset class="cx-group"><legend>Other formats (free)</legend>
          <button type="button" class="st-button" data-test="cx-lottie" :disabled="busy" @click="$emit('lottie')">Download Lottie (text and overlays)</button>
          <button type="button" class="st-button" data-test="cx-webpage" :disabled="busy" @click="$emit('webpage')">Download as web page</button>
          <p v-if="note" class="st-muted cx-note" role="status">{{ note }}</p>
        </fieldset>
      </template>
      <template v-else>
        <VideoJobCard :job="job" in-studio />
        <p class="st-muted cx-note">{{ job.state === 'ready' ? 'Done. The video is in your Library and in this project\'s files.' : 'You can keep editing while it renders; it uses the timeline as saved when you pressed Export.' }}</p>
        <button type="button" class="st-button" @click="$emit('close')">Close</button>
      </template>
    </section>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as tl from './timelineModel'
import VideoJobCard from '../video/VideoJobCard.vue'

const props = defineProps({ doc: { type: Object, required: true }, busy: Boolean, job: { type: Object, default: null }, error: { type: String, default: '' }, note: { type: String, default: '' } })
defineEmits(['close', 'export', 'lottie', 'webpage'])
const aspects = ref([props.doc.canvas.aspect]), resolution = ref('1080p'), box = ref(null)
const seconds = computed(() => tl.timecode(tl.totalMs(props.doc), props.doc.rate))
const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
let before = null
onMounted(async () => { before = document.activeElement; await nextTick(); box.value?.focus() })
onBeforeUnmount(() => before?.focus?.())
function trap(e) {
  const items = [...(box.value?.querySelectorAll(FOCUSABLE) || [])]
  if (!items.length) return
  const first = items[0], last = items[items.length - 1]
  if (e.shiftKey && (document.activeElement === first || document.activeElement === box.value)) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
</script>
<style scoped>
.cx-backdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:16px;background:var(--vs-scrim)}
.cx{display:grid;gap:12px;width:min(460px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border:1px solid var(--vm-line);border-radius:10px;background:var(--vm-surface);box-shadow:var(--vm-shadow-l);color:var(--vm-ink)}
.cx-head{display:flex;align-items:center;justify-content:space-between}.cx-head h2{font-size:16px;font-weight:600}
.cx-close{width:36px;height:36px;border:0;border-radius:6px;background:none;color:var(--vm-ink-soft);font-size:22px;cursor:pointer}
.cx-group{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0;padding:10px;border:1px solid var(--vm-line-2);border-radius:7px}
.cx-group legend{padding:0 4px;font-size:12px;color:var(--vm-ink-soft)}
.cx-check{display:flex;align-items:center;gap:6px;min-height:32px;font-size:13px}.cx-check input{accent-color:var(--vm-primary);width:18px;height:18px}
.cx-note{font-size:12px;line-height:1.55}
@media (max-width:767px){.cx-backdrop{align-items:end;padding:0}.cx{width:100%;border-radius:12px 12px 0 0}.cx-check,.cx .st-button,.cx-close{min-height:44px}}
</style>
