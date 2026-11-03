<template>
  <div class="slm" :class="{ 'slm-empty': !latest }" :aria-busy="state === 'loading' ? 'true' : 'false'" data-test="look-media">
    <template v-if="latest">
      <video v-if="playing && latest.media_type === 'video'" ref="player" :src="latest.url" :poster="picture || undefined" controls playsinline preload="metadata" :aria-label="`Your latest result with ${look.title}`" />
      <img v-else-if="picture" :src="picture" :alt="controls ? `Your latest result with ${look.title}` : ''" loading="lazy" />
      <span v-else class="slm-state" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path :d="latest.media_type === 'audio' ? 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' : 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5'" /></svg></span>
      <span class="slm-label">Your latest result{{ count > 1 ? ` · ${count} made` : '' }}</span>
      <audio v-if="controls && latest.media_type === 'audio' && latest.url" class="slm-audio" :src="latest.url" controls preload="none" :aria-label="`Your latest result with ${look.title}`" />
      <button v-if="controls && latest.media_type === 'video' && latest.url && !playing" type="button" class="slm-control" aria-label="Play your latest result" @click="play">▷ Play</button>
      <span v-else-if="!controls && latest.media_type === 'video'" class="slm-play" aria-hidden="true">▷</span>
    </template>
    <div v-else class="slm-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /></svg>
      <span>{{ state === 'error' ? 'Your results could not be loaded.' : 'Your results with this look appear here' }}</span>
    </div>
  </div>
</template>
<script setup>
// A look shows only the person's own newest result made with it (from the backend), never stock media.
// Nothing plays by itself: a video starts only from its Play button, with controls and no loop.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { loadLookResult } from '../../services/studioLooks'
const props = defineProps({ look: { type: Object, required: true }, controls: Boolean })
const state = ref('loading'), count = ref(0), latest = ref(null), playing = ref(false), player = ref(null)
const picture = computed(() => latest.value?.thumbnail_url || (latest.value?.media_type === 'image' ? latest.value.url : ''))
let alive = true, asked = 0
async function load() {
  const ticket = ++asked
  state.value = 'loading'; playing.value = false
  try {
    const result = await loadLookResult(props.look?.id)
    if (!alive || ticket !== asked) return
    count.value = result.count; latest.value = result.latest; state.value = 'ready'
  } catch {
    if (!alive || ticket !== asked) return
    count.value = 0; latest.value = null; state.value = 'error'
  }
}
async function play() { playing.value = true; await nextTick(); player.value?.play?.()?.catch?.(() => {}) }
watch(() => props.look?.id, load, { immediate: true })
onBeforeUnmount(() => { alive = false; player.value?.pause?.() })
</script>
<style scoped>
.slm-control{position:absolute;bottom:12px;left:12px;z-index:2;min-height:36px;padding:7px 12px;border:1px solid #ffffff55;border-radius:7px;background:#101722dd;color:#eef4ff;font:500 11px var(--vm-font-sans);cursor:pointer}.slm-control:focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:3px}.slm{position:relative;overflow:hidden;aspect-ratio:4/3;background:var(--vm-surface-2,#1c2635)}.slm img,.slm video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.slm video{object-fit:contain;background:#080c12}.slm-label{position:absolute;top:10px;left:10px;background:#101722ba;color:#e6edf6;border:1px solid #ffffff21;padding:5px 7px;border-radius:5px;font-size:10px;letter-spacing:.02em}.slm-play{position:absolute;bottom:12px;right:12px;display:grid;place-items:center;width:32px;height:32px;border:1px solid #ffffff66;border-radius:50%;background:#111c2c77;color:#fff;font-size:20px}
.slm-state{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px;color:var(--vm-ink-soft);font-size:12px;line-height:1.5;text-align:center}.slm-state svg{width:28px;height:28px;opacity:.7}.slm-audio{position:absolute;left:12px;right:12px;bottom:12px;width:calc(100% - 24px)}
</style>
