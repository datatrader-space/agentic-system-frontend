<template>
  <!-- Background removal (plan D21, owner's decision O1): a paid provider job. "Get the price" asks the server for an
       estimate; the Studio's price card (VideoJobCard) shows it with Generate and Decline; nothing is spent before
       Generate. When the matte is ready the clip gets the background-removal effect. A matte made before for the same
       file is used again at no cost. -->
  <section class="bg" data-test="bg-removal" aria-label="Background removal">
    <p v-if="has" class="pn-note" data-test="bg-on">The background of this clip is removed. Turn it off or remove it in the list of effects.</p>
    <template v-else>
      <template v-if="d.state.status === 'idle' || d.state.status === 'failed'">
        <p class="pn-note">A paid model separates the person or object from the background. You see the price first; nothing is spent until you press Generate.</p>
        <button type="button" class="st-button pn-small" :disabled="!clip.media" data-test="bg-quote" @click="ask">Get the price</button>
      </template>
      <VideoJobCard v-if="job" :job="job" in-studio />
      <p v-else-if="d.state.status === 'working'" class="pn-note" role="status">{{ progressText }}</p>
      <p v-if="d.state.status === 'failed'" class="pn-error" role="alert">{{ d.state.error }}</p>
    </template>
  </section>
</template>
<script setup>
import { computed, watch } from 'vue'
import * as tl from '../timelineModel'
import * as br from './bridge'
import { useDerive } from './useDerive'
import VideoJobCard from '../../video/VideoJobCard.vue'

const props = defineProps({ doc: { type: Object, required: true }, clip: { type: Object, required: true } })
// refresh-media: the matte is made; the editor reads the media view again (its matte_url) for the monitor.
const emit = defineEmits(['ops', 'refresh-media'])
const d = useDerive()
const job = computed(() => d.job())
const has = computed(() => (props.clip.effects || []).some(e => e.kind === 'bg_removal'))
const progressText = computed(() => d.state.progress != null ? `Removing the background… ${Math.round(d.state.progress * 100)}%` : 'Removing the background…')
let forClip = ''
// The registry names the server job the effect needs (effects.bg_removal.needs_derived).
function ask() { forClip = props.clip.id; d.start(props.clip.media, br.effectDerive(br.registry(), 'bg_removal'), {}) }
watch(() => props.clip.media, () => { if (d.state.status !== 'idle' && props.clip.id !== forClip) d.reset() })
// The matte is ready (just made, or made before): the clip it was asked for gets the effect, once.
watch(() => d.state.status, s => {
  if (s !== 'ready' || !forClip) return
  const f = tl.find(props.doc, forClip)
  if (f?.item.media) emit('refresh-media', f.item.media)
  if (!f || (f.item.effects || []).some(e => e.kind === 'bg_removal')) return
  const ops = br.addEffectOps(props.doc, forClip, 'bg_removal', { registry: br.registry() })
  if (ops.length) emit('ops', { ops, label: 'Background removed' })
})
</script>
<style scoped>
.bg{display:grid;gap:8px}
</style>
