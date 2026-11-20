<template>
  <section class="vsp" aria-labelledby="vsp-title" data-test="video-studio-projects">
    <header class="vsp-head">
      <div class="vsp-head-text">
        <p class="vsp-eyebrow">YOUR WORKSPACE</p><h1 id="vsp-title">A home for every story.</h1>
        <p class="vsp-sub">Keep the brief, assets and versions together. Share a project with your team, review it together, and open it to continue with your agent.</p>
      </div>
      <button type="button" class="vsp-btn primary" data-test="vsp-new" @click="createDialog.showModal()">＋ New project</button>
    </header>
    <dialog ref="createDialog" class="vsp-create" aria-labelledby="vsp-create-title"><header><h2 id="vsp-create-title">New project</h2><button type="button" aria-label="Close new project" :disabled="creating" @click="createDialog.close()">×</button></header><form @submit.prevent="create"><label>Project name<input v-model="newTitle" type="text" maxlength="200" placeholder="Name your project" required /></label><p v-if="currentFolder" class="vsp-create-in">It goes in the folder “{{ currentFolder.name }}”.</p><p v-if="createError" role="alert">{{ createError }}</p><button type="submit" class="vsp-btn primary" :disabled="creating || !newTitle.trim()">{{ creating ? 'Creating…' : 'Create project' }}</button></form></dialog>
    <div class="vsp-body">
      <div class="vsp-tabs" role="tablist" aria-label="Which projects">
        <button v-for="t in scopes" :key="t.value" type="button" role="tab" class="vsp-tab" :class="{ on: scope === t.value }" :aria-selected="scope === t.value ? 'true' : 'false'" :data-test="`vsp-scope-${t.value}`" @click="setScope(t.value)">{{ t.label }}</button>
      </div>

      <section v-if="scope !== 'trash' && workspaces.length" class="vsp-folders" aria-label="Folders" data-test="vsp-folders">
        <div class="vsp-folder-bar">
          <label v-if="workspaces.length > 1 || !workspaceId" class="vsp-ws"><span class="vsp-sr">Workspace</span>
            <select :value="workspaceId" data-test="vsp-workspace" @change="chooseWorkspace($event.target.value)"><option v-if="!workspaceId" value="" disabled>Choose a workspace</option><option v-for="w in workspaces" :key="w.id" :value="String(w.id)">{{ w.name }}</option></select></label>
          <button type="button" class="vsp-chip" :class="{ on: folderFilter === '' }" :aria-pressed="folderFilter === '' ? 'true' : 'false'" @click="pickFolder('')">All</button>
          <button type="button" class="vsp-chip" :class="{ on: folderFilter === 'none' }" :aria-pressed="folderFilter === 'none' ? 'true' : 'false'" @click="pickFolder('none')">Not in a folder</button>
          <button v-for="f in sortedFolders" :key="f.folder_id" type="button" class="vsp-chip" :class="{ on: folderFilter === String(f.folder_id) }" :aria-pressed="folderFilter === String(f.folder_id) ? 'true' : 'false'" data-test="vsp-folder" @click="pickFolder(String(f.folder_id))">
            <svg v-if="f.pinned" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 4h6l-1 6 4 4H6l4-4-1-6zM12 14v6" /></svg>
            {{ f.name }}<small>{{ f.project_count }}</small><span v-if="f.shared" class="vsp-sr">, shared with the workspace</span><svg v-if="f.shared" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M8 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 20a6 6 0 0 1 12 0M14 20a6 6 0 0 1 8-5.6" /></svg>
          </button>
          <button type="button" class="vsp-chip add" data-test="vsp-folder-new" :aria-expanded="folderForm ? 'true' : 'false'" @click="openFolderForm()">＋ Folder</button>
        </div>
        <form v-if="folderForm" class="vsp-folder-form" data-test="vsp-folder-form" @submit.prevent="saveFolder">
          <label><span>{{ folderForm.folder_id ? 'Folder name' : 'New folder name' }}</span><input ref="folderName" v-model.trim="folderForm.name" type="text" maxlength="120" required /></label>
          <label class="vsp-check"><input v-model="folderForm.shared" type="checkbox" /> Shared with everyone in the workspace</label>
          <label v-if="folderForm.folder_id" class="vsp-check"><input v-model="folderForm.pinned" type="checkbox" /> Pinned to the top</label>
          <div class="vsp-actions"><button type="submit" class="vsp-btn primary" :disabled="folderBusy || !folderForm.name">{{ folderForm.folder_id ? 'Save folder' : 'Create folder' }}</button><button type="button" class="vsp-btn" @click="folderForm = null">Cancel</button>
            <button v-if="folderForm.folder_id && !confirmFolderDelete" type="button" class="vsp-btn danger" @click="confirmFolderDelete = true">Delete folder</button>
            <template v-if="confirmFolderDelete"><span class="vsp-warn">Its projects stay, outside any folder.</span><button type="button" class="vsp-btn danger" data-test="vsp-folder-delete" :disabled="folderBusy" @click="deleteFolder">Delete it</button></template></div>
          <p v-if="folderError" class="vsp-note err" role="alert">{{ folderError }}</p>
        </form>
        <p v-if="currentFolder && currentFolder.can_manage && !folderForm" class="vsp-folder-tools"><button type="button" class="vsp-link" data-test="vsp-folder-edit" @click="openFolderForm(currentFolder)">Edit “{{ currentFolder.name }}”</button></p>
      </section>

      <label v-if="projects.length" class="vsp-search"><span class="vsp-sr">Search projects</span>
        <input v-model="q" type="search" placeholder="Search by title" /></label>
      <p v-if="actionError" class="vsp-note err" role="alert" data-test="vsp-action-error">{{ actionError }}</p>
      <p v-if="loading" class="vsp-note" role="status">Loading your projects…</p>
      <p v-else-if="error" class="vsp-note err" role="alert">{{ error }} <button type="button" class="vsp-btn" @click="load">Try again</button></p>
      <div v-else-if="!projects.length" class="vsp-empty">
        <p v-if="scope === 'trash'">The trash is empty. A project you move to the trash stays here for 30 days, then it is deleted for good.</p>
        <p v-else-if="scope === 'shared'">Nothing is shared with you yet. A project someone shares with you, or opens to your workspace, shows here.</p>
        <p v-else-if="folderFilter">No project in this folder yet. Move one here from its card.</p>
        <template v-else><p>No projects yet. A project is made when you ask for your first estimate or plan a story.</p>
          <router-link :to="{ name: 'video-studio-dashboard', query: { new: '1' } }" class="vsp-btn primary">Make a video</router-link></template>
      </div>
      <p v-else-if="!shown.length" class="vsp-note">No project matches “{{ q }}”.</p>
      <!-- A project is a frame of its own shape: the aspect ratio is what tells projects apart at a glance. -->
      <ul class="vsp-grid">
        <li v-for="p in shown" :key="p.project_id" class="vsp-item">
          <!-- A project opens in the chat it was last open in; one never opened gets a new chat (owner, 2026-10-20:
               opening a project made a new, empty chat every time). A project in the trash does not open. -->
          <div v-if="scope === 'trash'" class="vsp-card" data-test="vsp-project">
            <span class="vsp-frame" aria-hidden="true"><span class="vsp-shape" :style="{ '--ar': ratio(p.aspect_ratio) }"></span><small class="vsp-novideo">In the trash</small></span>
            <strong class="vsp-name">{{ p.title || 'Untitled video' }}</strong>
            <span class="vsp-meta">Moved to the trash {{ day(p.trashed_at) }}</span>
          </div>
          <router-link v-else :to="{ name: 'video-studio-dashboard', query: p.conversation_id ? { conversation: String(p.conversation_id) } : { project: p.project_id } }"
                       class="vsp-card" data-test="vsp-project">
            <!-- The project's own video (its active version's picture, from the server); none yet: its shape and a note. -->
            <span class="vsp-frame" :class="{ 'has-thumb': p.thumbnail_url && !noThumb.has(p.project_id) }" aria-hidden="true">
              <img v-if="p.thumbnail_url && !noThumb.has(p.project_id)" :src="p.thumbnail_url" alt="" class="vsp-thumb" loading="lazy" data-test="vsp-thumbnail" @error="thumbFailed(p)" />
              <template v-else><span class="vsp-shape" :style="{ '--ar': ratio(p.aspect_ratio) }"></span><small class="vsp-novideo">No video yet</small></template>
            </span>
            <strong class="vsp-name">{{ p.title || 'Untitled video' }}</strong>
            <span class="vsp-meta">{{ p.aspect_ratio ? p.aspect_ratio + ', ' : '' }}edited {{ day(p.updated_at) }}</span>
            <span v-if="badges(p).length" class="vsp-badges" data-test="vsp-badges"><span v-for="b in badges(p)" :key="b.text" class="vsp-badge" :class="b.tone">{{ b.text }}</span></span>
          </router-link>
          <div class="vsp-card-actions">
            <template v-if="scope === 'trash'">
              <small class="vsp-until">{{ p.restore_until ? `Can be restored until ${day(p.restore_until)}` : 'In the trash' }}</small>
              <button type="button" class="vsp-btn" :disabled="busyId === p.project_id" data-test="vsp-restore" @click="restore(p)">Restore</button>
              <button v-if="confirmPurge !== p.project_id" type="button" class="vsp-btn danger" @click="confirmPurge = p.project_id">Delete for good</button>
              <span v-else class="vsp-confirm" role="group" :aria-label="`Delete ${p.title || 'this project'} for good`"><span>Its comments, canvas and links go too. This cannot be undone.</span>
                <button type="button" class="vsp-btn danger" data-test="vsp-purge" :disabled="busyId === p.project_id" @click="purge(p)">Delete</button><button type="button" class="vsp-btn" @click="confirmPurge = ''">Keep</button></span>
            </template>
            <template v-else>
              <button type="button" class="vsp-btn" data-test="vsp-share" @click="sharing = p">{{ p.abilities?.manage ? 'Share' : 'Who has access' }}</button>
              <router-link :to="{ name: 'video-studio-project-room', params: { projectId: p.project_id, tab: 'review' } }" class="vsp-btn" data-test="vsp-review">Review</router-link>
              <router-link :to="{ name: 'video-studio-project-room', params: { projectId: p.project_id, tab: 'canvas' } }" class="vsp-btn" data-test="vsp-canvas">Canvas</router-link>
              <label v-if="p.abilities?.manage && String(p.workspace_id) === workspaceId && folders.length" class="vsp-move"><span class="vsp-sr">Folder for {{ p.title || 'this project' }}</span>
                <select :value="p.folder_id == null ? '' : String(p.folder_id)" :disabled="busyId === p.project_id" data-test="vsp-move" @change="move(p, $event.target.value)">
                  <option value="">No folder</option><option v-for="f in folders" :key="f.folder_id" :value="String(f.folder_id)">{{ f.name }}</option></select></label>
              <button v-if="p.abilities?.own && confirmTrash !== p.project_id" type="button" class="vsp-btn quiet" data-test="vsp-trash" @click="confirmTrash = p.project_id">Move to trash</button>
              <span v-if="confirmTrash === p.project_id" class="vsp-confirm" role="group" aria-label="Confirm move to trash"><span>Everyone it is shared with loses access until you restore it.</span>
                <button type="button" class="vsp-btn danger" data-test="vsp-trash-confirm" :disabled="busyId === p.project_id" @click="trash(p)">Move to trash</button><button type="button" class="vsp-btn" @click="confirmTrash = ''">Keep</button></span>
            </template>
          </div>
        </li>
      </ul>
    </div>
    <ProjectShareDialog :open="!!sharing" :project-id="sharing ? sharing.project_id : ''" :title="sharing ? sharing.title : ''" @close="sharing = null" @changed="load" />
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import api from '../services/api'
import ProjectShareDialog from '../components/studio/ProjectShareDialog.vue'
import { REVIEW_LABELS, ROLE_LABELS, day, errorText, sharing as share } from '../services/studioSharing'
import { useStudioWorkspace } from '../composables/useStudioWorkspace'

const projects = ref([])
const loading = ref(true)
const error = ref('')
const q = ref('')
const scopes = [{ value: 'all', label: 'All' }, { value: 'mine', label: 'Mine' }, { value: 'shared', label: 'Shared with me' }, { value: 'trash', label: 'Trash' }]
const scope = ref('all')
// The workspace the Studio menu shows, kept in step with it (ISSUE-19): its folders are the ones listed here.
const { workspaces, workspaceId, loadWorkspaces, chooseWorkspace } = useStudioWorkspace({ onChange: () => { folderFilter.value = ''; loadFolders(); load() } })
const folders = ref([]), folderFilter = ref('')
const folderForm = ref(null), folderBusy = ref(false), folderError = ref(''), confirmFolderDelete = ref(false), folderName = ref(null)
const sharing = ref(null), busyId = ref(''), actionError = ref(''), confirmTrash = ref(''), confirmPurge = ref('')
const createDialog=ref(null),newTitle=ref(''),creating=ref(false),createError=ref('')
const sortedFolders = computed(() => [...folders.value].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(a.name).localeCompare(String(b.name))))
const currentFolder = computed(() => folders.value.find(f => String(f.folder_id) === folderFilter.value) || null)
async function create(){if(creating.value || !newTitle.value.trim())return;creating.value=true;createError.value='';try{const body={title:newTitle.value.trim()};if(currentFolder.value){body.workspace_id=currentFolder.value.workspace_id;body.folder_id=currentFolder.value.folder_id}await api.post('/video/projects/',body);newTitle.value='';createDialog.value.close();await load()}catch(e){createError.value=errorText(e,'The project could not be created. Please try again.')}finally{creating.value=false}}
const shown = computed(() => {
  const t = q.value.trim().toLowerCase()
  return t ? projects.value.filter((p) => String(p.title || '').toLowerCase().includes(t)) : projects.value
})
// A picture that will not load falls back to the shape, never a broken image.
const noThumb = ref(new Set())
function thumbFailed(p) { noThumb.value = new Set(noThumb.value).add(p.project_id) }
function ratio(ar) {
  const m = /^(\d+):(\d+)$/.exec(ar || '')
  return m && Number(m[2]) ? Number(m[1]) / Number(m[2]) : 16 / 9
}
// What a card says about sharing: whose it is (when not mine) and my role, and where its review stands.
function badges(p) {
  const out = []
  if (p.my_role && p.my_role !== 'owner') out.push({ text: `${p.owner?.name ? p.owner.name + ', ' : ''}you are ${String(ROLE_LABELS[p.my_role] || p.my_role).toLowerCase()}`, tone: '' })
  else if (p.visibility === 'workspace') out.push({ text: 'Shared with the workspace', tone: '' })
  if (p.review_status && p.review_status !== 'none') out.push({ text: REVIEW_LABELS[p.review_status], tone: { approved: 'ok', changes_requested: 'warn', in_review: 'info' }[p.review_status] })
  return out
}
async function load() {
  loading.value = true
  error.value = ''
  const params = scope.value === 'trash' ? { trash: 1 } : { scope: scope.value }
  if (scope.value !== 'trash' && folderFilter.value) params.folder = folderFilter.value
  try { projects.value = (await (scope.value === 'all' && !folderFilter.value ? api.get('/video/projects/') : api.get('/video/projects/', { params }))).data.projects || [] }
  catch { error.value = 'Could not load your projects.' }
  finally { loading.value = false }
}
async function loadFolders() {
  if (!workspaceId.value) { folders.value = []; return }
  try { folders.value = (await share.folders(workspaceId.value)).data?.folders || [] } catch { folders.value = [] }
}
function setScope(s) { scope.value = s; confirmTrash.value = ''; confirmPurge.value = ''; actionError.value = ''; load() }
function pickFolder(f) { folderFilter.value = f; folderForm.value = null; load() }
async function openFolderForm(f = null) {
  folderError.value = ''; confirmFolderDelete.value = false
  folderForm.value = f ? { folder_id: f.folder_id, name: f.name, shared: !!f.shared, pinned: !!f.pinned } : { folder_id: null, name: '', shared: true, pinned: false }
  await nextTick(); folderName.value?.focus?.()
}
async function saveFolder() {
  const f = folderForm.value
  folderBusy.value = true; folderError.value = ''
  try {
    if (f.folder_id) await share.editFolder(f.folder_id, { name: f.name, shared: f.shared, pinned: f.pinned })
    else await share.createFolder({ workspace_id: Number(workspaceId.value), name: f.name, shared: f.shared })
    folderForm.value = null; await loadFolders(); await load()
  } catch (e) { folderError.value = errorText(e, 'The folder could not be saved.') } finally { folderBusy.value = false }
}
async function deleteFolder() {
  folderBusy.value = true; folderError.value = ''
  try { await share.deleteFolder(folderForm.value.folder_id); folderForm.value = null; folderFilter.value = ''; await loadFolders(); await load() }
  catch (e) { folderError.value = errorText(e, 'The folder could not be deleted.') } finally { folderBusy.value = false }
}
async function act(p, fn, fallback) {
  busyId.value = p.project_id; actionError.value = ''
  try { await fn(); confirmTrash.value = ''; confirmPurge.value = ''; await load(); await loadFolders() }
  catch (e) { actionError.value = errorText(e, fallback) } finally { busyId.value = '' }
}
const move = (p, v) => act(p, () => share.update(p.project_id, { folder_id: v ? Number(v) : null }), 'The project could not be moved.')
const trash = (p) => act(p, () => share.trash(p.project_id), 'The project could not be moved to the trash.')
const restore = (p) => act(p, () => share.restore(p.project_id), 'The project could not be restored.')
const purge = (p) => act(p, () => share.purge(p.project_id), 'The project could not be deleted.')
onMounted(async () => {
  load()
  await loadWorkspaces()
  await loadFolders()
})
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
.vsp-frame { position: relative; overflow: hidden; }
.vsp-frame.has-thumb { background: #000; }
.vsp-thumb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.vsp-novideo { position: absolute; left: 12px; bottom: 10px; font-size: 11px; color: var(--vm-ink-soft); }
.vsp-name { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.vsp-shape { height: 46%; aspect-ratio: var(--ar, 1.7778); max-width: 80%; border: 1px solid #5b5c63; border-radius: 2px; box-sizing: border-box; }
.vsp-name { margin-top: 2px; font-size: 13.5px; font-weight: 500; overflow-wrap: anywhere; }
.vsp-meta { font-size: 12px; color: var(--vm-ink-soft); font-variant-numeric: tabular-nums; }
.vsp a:focus-visible, .vsp input:focus-visible, .vsp button:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.vsp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 1023px) { .vsp-head { padding-left: calc(12px + var(--vs-bar-inset, 0px)); } }
@media (max-width: 640px) {
  .vsp-head { padding-top: 10px; padding-bottom: 10px; }
  .vsp-body { padding: 14px 16px 24px; }
  .vsp-search input { font-size: 16px; }
  .vsp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 10px; }
}
@media (prefers-reduced-motion: reduce) { .vsp-frame { transition: none; } }
</style>

<style scoped>.vsp-head{padding:30px 32px 24px;min-height:120px;border-bottom:0}.vsp h1{font-size:30px;letter-spacing:-.04em;font-weight:550}.vsp-eyebrow{font-size:9px;letter-spacing:.15em;color:var(--vm-ink-faint);margin:0 0 10px}.vsp-sub{font-size:12px;line-height:1.8;margin-top:10px;max-width:580px}.vsp-body{padding:5px 32px 32px;gap:24px}.vsp-grid{gap:18px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}.vsp-card{border:1px solid var(--vm-line);background:var(--vm-surface);border-radius:10px;overflow:hidden;padding-bottom:18px;gap:8px}.vsp-frame{background:linear-gradient(130deg,#27384c,#19222e);border-radius:0;aspect-ratio:16/9}.vsp-name,.vsp-meta{padding-inline:18px}.vsp-name{margin-top:9px;font-size:15px}.vsp-empty{max-width:none;padding:42px;border:1px dashed var(--vm-line);border-radius:12px;background:var(--vm-surface)}.vsp-search input{min-height:44px;background:var(--vm-surface)}@media(max-width:640px){.vsp-head{padding:23px 16px;gap:14px;flex-direction:column;align-items:flex-start}.vsp-head .vsp-btn{min-height:44px;white-space:nowrap}.vsp h1{font-size:25px}.vsp-sub{font-size:11px}.vsp-body{padding:0 16px 24px}.vsp-grid{grid-template-columns:1fr}.vsp-empty{padding:24px}.vsp-frame{aspect-ratio:16/8}}
</style>

<style scoped>.vsp-create{width:min(500px,calc(100vw - 24px));padding:22px;background:#202733;color:#dce7f5;border:1px solid #435169;border-radius:11px}.vsp-create::backdrop{background:#080d14cc}.vsp-create header{display:flex;align-items:center;justify-content:space-between;gap:20px}.vsp-create h2{font-size:21px;font-weight:500}.vsp-create header button{width:44px;height:44px;border:0;background:none;color:inherit;font-size:24px;cursor:pointer}.vsp-create form{display:grid;gap:20px;margin-top:16px}.vsp-create label{display:grid;gap:9px;font-size:12px}.vsp-create input{padding:12px;border:1px solid #435169;border-radius:7px;background:#182130;color:#dce7f5;font:inherit}.vsp-create p{color:var(--vs-bad-ink);font-size:12px}.vsp-create form>button{justify-self:end}@media(max-width:680px){.vsp-create input{font-size:16px}}</style>

<style scoped>
/* Sharing (ADM-1248): scope tabs, folders, the state of a card, and its actions. */
.vsp-tabs{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--vm-line-2)}
.vsp-tab{min-height:44px;padding:0 14px;border:0;border-bottom:2px solid transparent;background:none;color:var(--vm-ink-soft);font:inherit;font-size:13px;font-weight:500;cursor:pointer}
.vsp-tab:hover{color:var(--vm-ink)}.vsp-tab.on{color:var(--vm-ink);border-bottom-color:var(--vm-violet)}
.vsp-folders{display:grid;gap:10px}.vsp-folder-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.vsp-ws select,.vsp-move select,.vsp-folder-form input[type=text]{min-height:40px;box-sizing:border-box;padding:0 10px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface);color:var(--vm-ink);font:inherit;font-size:13px}
.vsp-chip{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border:1px solid var(--vm-line);border-radius:999px;background:transparent;color:var(--vm-ink-soft);font:inherit;font-size:12.5px;cursor:pointer}
.vsp-chip svg{width:14px;height:14px}.vsp-chip small{font-size:11px;color:var(--vm-ink-faint);font-variant-numeric:tabular-nums}
.vsp-chip:hover{color:var(--vm-ink);background:var(--vm-surface)}.vsp-chip.on{color:var(--vm-ink);background:var(--vm-primary-soft);border-color:var(--vm-primary-line)}.vsp-chip.add{border-style:dashed}
.vsp-folder-form{display:grid;gap:12px;max-width:520px;padding:16px;border:1px solid var(--vm-line);border-radius:10px;background:var(--vm-surface)}
.vsp-folder-form>label:first-child{display:grid;gap:6px;font-size:12px;color:var(--vm-ink-soft)}
.vsp-check{display:flex;align-items:center;gap:8px;min-height:32px;font-size:13px;cursor:pointer}.vsp-check input{width:17px;height:17px;accent-color:var(--vm-violet)}
.vsp-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.vsp-warn{font-size:12px;color:var(--vs-warn-ink,var(--vm-amber-ink))}
.vsp-folder-tools{margin:0}.vsp-link{min-height:36px;padding:0;border:0;background:none;color:var(--vm-link);font:inherit;font-size:12.5px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.vsp-item{display:grid;gap:8px;align-content:start}
.vsp-badges{display:flex;flex-wrap:wrap;gap:6px;padding-inline:18px}
.vsp-badge{font-size:11px;line-height:1.4;padding:2px 8px;border-radius:999px;border:1px solid var(--vm-line);color:var(--vm-ink-soft)}
.vsp-badge.ok{color:var(--vs-ok-ink);background:var(--vs-ok-bg);border-color:transparent}.vsp-badge.warn{color:var(--vs-warn-ink);background:var(--vs-warn-bg);border-color:transparent}.vsp-badge.info{color:var(--vs-accent-ink);background:var(--vm-primary-soft);border-color:transparent}
.vsp-card-actions{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.vsp-card-actions .vsp-btn{min-height:36px;padding:0 11px;font-size:12px}
.vsp-btn.quiet{border-color:transparent;color:var(--vm-ink-soft)}.vsp-btn.danger{border-color:var(--vm-danger);color:var(--vm-red-ink)}.vsp-btn:disabled{opacity:.55;cursor:not-allowed}
.vsp-move select{min-height:36px;font-size:12px}
.vsp-until{flex-basis:100%;font-size:11.5px;color:var(--vm-ink-soft)}
.vsp-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:6px;flex-basis:100%;padding:10px;border:1px solid var(--vm-danger);border-radius:8px;background:var(--vm-red-soft);font-size:12px}
.vsp-confirm>span{flex-basis:100%}
.vsp-create-in{color:var(--vm-ink-soft)!important}
.vsp-tab:focus-visible,.vsp-chip:focus-visible,.vsp-link:focus-visible,select:focus-visible,.vsp-item a:focus-visible{outline:2px solid var(--vs-accent-ink,var(--vm-link));outline-offset:2px}
@media(max-width:640px){.vsp-tabs{gap:0}.vsp-tab{flex:1 1 auto;padding:0 8px}.vsp-chip{min-height:44px}.vsp-card-actions .vsp-btn,.vsp-move select{min-height:44px}.vsp-ws select,.vsp-folder-form input[type=text]{font-size:16px;min-height:44px}}
</style>
