<template>
  <section class="vsp" aria-labelledby="vsp-title" data-test="video-studio-projects">
    <header class="vsp-head">
      <div class="vsp-head-text">
        <h1 id="vsp-title">Projects</h1>
        <p class="vsp-sub">Every video you made in the Studio. Open one to keep working on it.</p>
      </div>
      <router-link v-if="projects.length" :to="{ name: 'video-studio', query: { new: '1' } }" class="vsp-btn" data-test="vsp-new">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <span>New video</span>
      </router-link>
    </header>
    <div class="vsp-body">
      <label v-if="projects.length" class="vsp-search"><span class="vsp-sr">Search projects</span>
        <input v-model="q" type="search" placeholder="Search by title" /></label>
      <p v-if="loading" class="vsp-note" role="status">Loading your projects…</p>
      <p v-else-if="error" class="vsp-note err" role="alert">{{ error }} <button type="button" class="vsp-btn" @click="load">Try again</button></p>
      <div v-else-if="!projects.length" class="vsp-empty">
        <p>No projects yet. A project is made when you ask for your first estimate or plan a story.</p>
        <router-link :to="{ name: 'video-studio', query: { new: '1' } }" class="vsp-btn primary">Make a video</router-link>
      </div>
      <p v-else-if="!shown.length" class="vsp-note">No project matches “{{ q }}”.</p>
      <!-- A project is a frame of its own shape: the aspect ratio is what tells projects apart at a glance. -->
      <ul class="vsp-grid">
        <li v-for="p in shown" :key="p.project_id">
          <router-link :to="{ name: 'video-studio', query: { project: p.project_id } }" class="vsp-card" data-test="vsp-project">
            <span class="vsp-frame" aria-hidden="true"><span class="vsp-shape" :style="{ '--ar': ratio(p.aspect_ratio) }"></span></span>
            <strong class="vsp-name">{{ p.title || 'Untitled video' }}</strong>
            <span class="vsp-meta">{{ p.aspect_ratio ? p.aspect_ratio + ', ' : '' }}edited {{ day(p.updated_at) }}</span>
          </router-link>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../services/api'

const projects = ref([])
const loading = ref(true)
const error = ref('')
const q = ref('')
const shown = computed(() => {
  const t = q.value.trim().toLowerCase()
  return t ? projects.value.filter((p) => String(p.title || '').toLowerCase().includes(t)) : projects.value
})
function day(iso) { return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '' }
function ratio(ar) {
  const m = /^(\d+):(\d+)$/.exec(ar || '')
  return m && Number(m[2]) ? Number(m[1]) / Number(m[2]) : 16 / 9
}
async function load() {
  loading.value = true
  error.value = ''
  try { projects.value = (await api.get('/video/projects/')).data.projects || [] }
  catch { error.value = 'Could not load your projects.' }
  finally { loading.value = false }
}
onMounted(load)
</script>

<style scoped>
.vsp { min-height: 100%; color: var(--vm-ink); }
.vsp-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 60px; padding: 12px 20px; box-sizing: border-box;
  border-bottom: 1px solid var(--vm-line-2); }
.vsp-head-text { min-width: 0; }
.vsp h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -.015em; }
.vsp-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--vm-ink-soft); }
.vsp-body { display: grid; gap: 16px; padding: 16px 20px 28px; }
.vsp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 14px; box-sizing: border-box;
  border: 1px solid var(--vm-line); border-radius: 6px; background: transparent; color: var(--vm-ink); font: inherit; font-size: 13px; font-weight: 500;
  text-decoration: none; cursor: pointer; flex-shrink: 0; }
.vsp-btn svg { width: 16px; height: 16px; }
.vsp-btn:hover { background: var(--vm-surface-2); }
.vsp-btn.primary { background: var(--vm-violet-d); border-color: transparent; color: #fff; font-weight: 600; justify-self: start; }
.vsp-btn.primary:hover { background: var(--vm-violet); }
.vsp-search input { width: min(360px, 100%); min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--vm-line); border-radius: 6px;
  background: var(--vm-surface-2); color: var(--vm-ink); font: inherit; font-size: 13.5px; }
.vsp-note { margin: 0; font-size: 13.5px; color: var(--vm-ink-soft); }
.vsp-note.err { color: var(--vs-bad-ink, #b91c1c); }
.vsp-empty { display: grid; gap: 14px; max-width: 40em; }
.vsp-empty p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--vm-ink-soft); }
.vsp-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 22px 16px; }
.vsp-card { display: grid; gap: 6px; color: inherit; text-decoration: none; border-radius: 4px; }
.vsp-frame { display: grid; place-items: center; aspect-ratio: 16 / 10; border-radius: 4px; background: #000; transition: background-color .15s; }
.vsp-card:hover .vsp-frame { background: #0b0b0c; box-shadow: inset 0 0 0 1px var(--vm-line); }
.vsp-shape { height: 62%; aspect-ratio: var(--ar, 1.7778); max-width: 80%; border: 1px solid #5b5c63; border-radius: 2px; box-sizing: border-box; }
.vsp-name { margin-top: 2px; font-size: 13.5px; font-weight: 500; overflow-wrap: anywhere; }
.vsp-meta { font-size: 12px; color: var(--vm-ink-soft); font-variant-numeric: tabular-nums; }
.vsp a:focus-visible, .vsp input:focus-visible, .vsp button:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.vsp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 1023px) { .vsp-head { padding-left: calc(12px + var(--vs-bar-inset, 0px)); } }
@media (max-width: 640px) {
  .vsp-head { padding-top: 10px; padding-bottom: 10px; }
  .vsp-head .vsp-btn span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .vsp-head .vsp-btn { width: 44px; height: 44px; padding: 0; }
  .vsp-body { padding: 14px 16px 24px; }
  .vsp-search input { font-size: 16px; }
  .vsp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 10px; }
}
@media (prefers-reduced-motion: reduce) { .vsp-frame { transition: none; } }
</style>
