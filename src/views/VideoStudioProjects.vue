<template>
  <section class="vsp" aria-labelledby="vsp-title" data-test="video-studio-projects">
    <header class="vsp-head">
      <div class="vsp-head-text">
        <p class="vsp-eyebrow">YOUR WORKSPACE</p><h1 id="vsp-title">A home for every story.</h1>
        <p class="vsp-sub">Keep the brief, assets and versions together. Open a project to continue with your agent.</p>
      </div>
      <button type="button" class="vsp-btn primary" data-test="vsp-new" @click="createDialog.showModal()">＋ New project</button>
    </header>
    <dialog ref="createDialog" class="vsp-create" aria-labelledby="vsp-create-title"><header><h2 id="vsp-create-title">New project</h2><button type="button" aria-label="Close new project" :disabled="creating" @click="createDialog.close()">×</button></header><form @submit.prevent="create"><label>Project name<input v-model="newTitle" type="text" maxlength="200" placeholder="Name your project" required /></label><p v-if="createError" role="alert">{{ createError }}</p><button type="submit" class="vsp-btn primary" :disabled="creating || !newTitle.trim()">{{ creating ? 'Creating…' : 'Create project' }}</button></form></dialog>
    <div class="vsp-body">
      <label v-if="projects.length" class="vsp-search"><span class="vsp-sr">Search projects</span>
        <input v-model="q" type="search" placeholder="Search by title" /></label>
      <p v-if="loading" class="vsp-note" role="status">Loading your projects…</p>
      <p v-else-if="error" class="vsp-note err" role="alert">{{ error }} <button type="button" class="vsp-btn" @click="load">Try again</button></p>
      <div v-else-if="!projects.length" class="vsp-empty">
        <p>No projects yet. A project is made when you ask for your first estimate or plan a story.</p>
        <router-link :to="{ name: 'video-studio-dashboard', query: { new: '1' } }" class="vsp-btn primary">Make a video</router-link>
      </div>
      <p v-else-if="!shown.length" class="vsp-note">No project matches “{{ q }}”.</p>
      <!-- A project is a frame of its own shape: the aspect ratio is what tells projects apart at a glance. -->
      <ul class="vsp-grid">
        <li v-for="p in shown" :key="p.project_id">
          <!-- A project opens in the chat it was last open in; one never opened gets a new chat (owner, 2026-10-20:
               opening a project made a new, empty chat every time). -->
          <router-link :to="{ name: 'video-studio-dashboard', query: p.conversation_id ? { conversation: String(p.conversation_id) } : { project: p.project_id } }"
                       class="vsp-card" data-test="vsp-project">
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
const createDialog=ref(null),newTitle=ref(''),creating=ref(false),createError=ref('')
async function create(){if(creating.value || !newTitle.value.trim())return;creating.value=true;createError.value='';try{await api.post('/video/projects/',{title:newTitle.value.trim()});newTitle.value='';createDialog.value.close();await load()}catch{createError.value='The project could not be created. Please try again.'}finally{creating.value=false}}
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

<style scoped>.vsp-head{padding:30px 32px 24px;min-height:120px;border-bottom:0}.vsp h1{font-size:30px;letter-spacing:-.04em;font-weight:550}.vsp-eyebrow{font-size:9px;letter-spacing:.15em;color:var(--vm-ink-faint);margin:0 0 10px}.vsp-sub{font-size:12px;line-height:1.8;margin-top:10px;max-width:580px}.vsp-body{padding:5px 32px 32px;gap:24px}.vsp-grid{gap:18px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}.vsp-card{border:1px solid var(--vm-line);background:var(--vm-surface);border-radius:10px;overflow:hidden;padding-bottom:18px;gap:8px}.vsp-frame{background:linear-gradient(130deg,#27384c,#19222e);border-radius:0;aspect-ratio:16/9}.vsp-name,.vsp-meta{padding-inline:18px}.vsp-name{margin-top:9px;font-size:15px}.vsp-empty{max-width:none;padding:42px;border:1px dashed var(--vm-line);border-radius:12px;background:var(--vm-surface)}.vsp-search input{min-height:44px;background:var(--vm-surface)}@media(max-width:640px){.vsp-head{padding:23px 16px;gap:10px}.vsp h1{font-size:25px}.vsp-sub{font-size:11px}.vsp-body{padding:0 16px 24px}.vsp-grid{grid-template-columns:1fr}.vsp-empty{padding:24px}.vsp-frame{aspect-ratio:16/8}}
</style>

<style scoped>.vsp-create{width:min(500px,calc(100vw - 24px));padding:22px;background:#202733;color:#dce7f5;border:1px solid #435169;border-radius:11px}.vsp-create::backdrop{background:#080d14cc}.vsp-create header{display:flex;align-items:center;justify-content:space-between;gap:20px}.vsp-create h2{font-size:21px;font-weight:500}.vsp-create header button{width:44px;height:44px;border:0;background:none;color:inherit;font-size:24px;cursor:pointer}.vsp-create form{display:grid;gap:20px;margin-top:16px}.vsp-create label{display:grid;gap:9px;font-size:12px}.vsp-create input{padding:12px;border:1px solid #435169;border-radius:7px;background:#182130;color:#dce7f5;font:inherit}.vsp-create p{color:var(--vs-bad-ink);font-size:12px}.vsp-create form>button{justify-self:end}@media(max-width:680px){.vsp-create input{font-size:16px}}</style>
