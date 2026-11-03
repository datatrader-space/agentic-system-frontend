<template>
  <!-- The canvas shows the person's own newest result (from the backend), never stock media: with nothing made yet it
       is an empty state. "Full preview" opens the app's media viewer. Nothing moves or zooms. -->
  <section class="scc" aria-label="Your creative canvas" :aria-busy="state === 'loading' ? 'true' : 'false'" data-test="creative-canvas">
    <header><span>▧ Your creative canvas</span><span>{{ latest ? 'Your newest result' : 'Your results' }}</span></header>
    <button v-if="latest" type="button" class="scc-reference" :aria-label="`Preview your newest result: ${latest.title}`" data-test="creative-canvas-open" @click="viewing = true">
      <img v-if="picture" :src="picture" :alt="`Your newest result: ${latest.title}`" data-test="creative-canvas-picture" />
      <span v-else class="scc-blank" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path :d="latest.media_type === 'audio' ? 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' : 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5'" /></svg></span>
      <span class="scc-label">YOUR NEWEST RESULT</span>
      <span v-if="latest.media_type === 'video'" class="scc-open" aria-hidden="true">▷</span>
      <span class="scc-copy"><small>AADML STUDIO / CREATIVE DIRECTION</small><strong>Make the next version yours.</strong><span>Bring a reference, choose a look, and build on what you made last.</span></span>
    </button>
    <div v-else class="scc-empty" data-test="creative-canvas-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /></svg>
      <strong>{{ state === 'loading' ? 'Looking for your newest result…' : 'A good place to begin.' }}</strong>
      <span>{{ state === 'error' ? 'Your results could not be loaded.' : 'Bring your reference, choose a look, and what you make appears here.' }}</span>
    </div>
    <footer v-if="latest"><span>{{ latest.title }}</span><button type="button" data-test="creative-canvas-preview" @click="viewing = true">Full preview ↗</button></footer>
    <MediaViewer v-if="viewing && latest" :items="[latest]" :index="0" @close="viewing = false" @leave="viewing = false" />
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import api from '../../services/api'
import { safeMediaUrl } from '../../services/studioLooks'
import MediaViewer from '../video/MediaViewer.vue'
// The person's newest generated file in Video Studio (GET /video/library/, theirs only). Only http(s) or same-origin
// addresses are shown.
const state = ref('loading'), latest = ref(null), viewing = ref(false)
const picture = computed(() => latest.value?.thumbnail_url || (latest.value?.media_type === 'image' ? latest.value.url : ''))
let alive = true
onMounted(async () => {
  try {
    const { data } = await api.get('/video/library/', { params: { source: 'generated', type: 'all', page: 1, limit: 1 } })
    if (!alive) return
    const row = (data?.items || [])[0]
    const url = safeMediaUrl(row?.url)
    latest.value = row && url && ['image', 'video', 'audio'].includes(row.media_type)
      ? { ...row, url, thumbnail_url: safeMediaUrl(row.thumbnail_url), title: row.title || 'Your result' } : null
    state.value = 'ready'
  } catch { if (alive) { latest.value = null; state.value = 'error' } }
})
onBeforeUnmount(() => { alive = false })
</script>
<style scoped>
.scc{display:grid;gap:15px}.scc header{display:flex;align-items:center;justify-content:space-between;gap:15px;color:#8fa2bd;font-size:11px}.scc-reference{display:block;position:relative;width:100%;padding:0;overflow:hidden;border:1px solid #3a506b;border-radius:8px;background:#0d1b2a;cursor:pointer;text-align:left}.scc-reference img,.scc-blank{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.scc-blank{display:grid;place-items:center;color:#8fa2bd}.scc-blank svg{width:44px;height:44px}.scc-label{position:absolute;top:14px;left:14px;color:#c4d8f0;font-size:9px;letter-spacing:.04em;background:#14243abf;border:1px solid #58708e;padding:5px 7px;border-radius:3px}.scc-open{position:absolute;top:45%;left:48%;display:grid;place-items:center;width:48px;height:48px;border:1px solid #91a8be;border-radius:50%;background:#1b2d3cbf;color:#d3e4f5;font-size:22px}.scc-reference::after{content:"";position:absolute;inset:35% 0 0;background:linear-gradient(transparent,#071727e6);pointer-events:none}.scc-copy,.scc-label,.scc-open{z-index:1}.scc-copy{position:absolute;left:24px;right:24px;bottom:24px;color:#e1ebf6}.scc-copy small{display:block;font-size:8px;font-weight:600;letter-spacing:1.2px;color:#a9c0d9}.scc-copy strong{display:block;font-size:34px;font-weight:600;letter-spacing:-1.2px;margin-top:10px;line-height:1.2}.scc-copy>span{display:block;color:#a4bdd4;font-size:12px;margin-top:10px;line-height:1.7}
.scc-empty{display:grid;place-items:center;align-content:center;gap:10px;aspect-ratio:16/9;padding:24px;border:1px dashed #3a506b;border-radius:8px;background:#0d1b2a;color:#a4bdd4;text-align:center;font-size:12px;line-height:1.7}.scc-empty svg{width:40px;height:40px;color:#8fa2bd}.scc-empty strong{color:#e1ebf6;font-size:22px;font-weight:600;letter-spacing:-.6px}
.scc footer{display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:10px;color:#8fa2bd}.scc footer>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.scc footer button{border:0;background:none;color:#a8c0df;min-height:36px;padding:4px 0;font:inherit;cursor:pointer}
@media(max-width:680px){.scc header{font-size:10px}.scc-reference img,.scc-blank,.scc-empty{aspect-ratio:4/3}.scc-label{font-size:8px;left:10px;top:10px}.scc-copy{left:16px;right:16px;bottom:18px}.scc-copy strong{font-size:26px}.scc-copy>span{font-size:11px}.scc footer button{min-height:44px}}
</style>
