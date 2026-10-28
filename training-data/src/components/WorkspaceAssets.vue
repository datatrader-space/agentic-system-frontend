<script setup>
// The Training Asset Library: the photos and videos you uploaded here. Choose some and add them to a Training
// project: a photo becomes a photo of the project, a video gives a photo every few seconds, taken in with the Upload
// page's rules. One AADML Library is shared by every origin and never mixed: this page lists Training's own files
// only (GET /api/library/?origin=training), never Video Studio's or AADML's chats'. Backend: app_api.py library/
// (uploads) and photos/from-library/.
import { computed, onMounted, ref, watch } from 'vue';
import { Images, Upload, Search, Check, X, Film, FileText, Music, Plus } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import { libraryApi, mediaPath, usable, sizeText, addedSaid } from '../api/library.js';
import { listProjects } from '../api/training.js';
import { FRAME_EVERY } from '../api/phone.js';
import { projectLink } from '../api/workspace.js';

const emit = defineEmits(['navigate']);
const TYPES = [['image', 'Photos'], ['video', 'Videos'], ['all', 'Everything']];
const type = ref('image'); const q = ref('');
const items = ref(null); const page = ref(1); const more = ref(false); const busy = ref(false); const error = ref('');
const picked = ref(new Set());

async function load(next = false) {
  busy.value = true; error.value = '';
  try {
    const body = await libraryApi.list({ type: type.value, q: q.value, page: next ? page.value + 1 : 1 });
    items.value = next ? [...items.value, ...body.items] : body.items;
    page.value = body.page; more.value = body.has_more;
  } catch (e) { error.value = e.message; items.value = items.value || []; }
  finally { busy.value = false; }
}
let searchTimer = null;
watch(type, () => { picked.value = new Set(); load(); });
watch(q, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => load(), 300); });
onMounted(() => load());

function toggle(item) {
  if (!usable(item)) return;
  const next = new Set(picked.value);
  next.has(item.attachment_id) ? next.delete(item.attachment_id) : next.add(item.attachment_id);
  picked.value = next;
}
const chosen = computed(() => (items.value || []).filter(item => picked.value.has(item.attachment_id)));
const day = iso => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

// Upload into the Training Asset Library (listed here only).
const uploader = ref(null); const uploading = ref('');
async function uploadFiles(list) {
  const files = Array.from(list || []).filter(f => /^(image|video)\//.test(f.type));
  if (uploader.value) uploader.value.value = '';
  if (!files.length) { error.value = 'Choose photos or videos.'; return; }
  error.value = '';
  try {
    for (const [index, file] of files.entries()) { uploading.value = `Uploading ${index + 1} of ${files.length}…`; await libraryApi.upload(file); }
    await load();
  } catch (e) { error.value = e.message; }
  finally { uploading.value = ''; }
}

// Add the chosen files to a project.
const adding = ref(false); const projects = ref([]); const outcome = ref(null); const addError = ref(''); const sending = ref(false);
const form = ref({ project: '', origin: 'development', consent: '', grouping: 'one', group: '', batch: 'From my Library', every: 5 });
const hasVideo = computed(() => chosen.value.some(item => item.media_type === 'video'));
async function openAdd() {
  adding.value = true; outcome.value = null; addError.value = '';
  try {
    projects.value = (await listProjects()).projects.filter(p => p.family !== 'llm' && (p.rights || []).includes('upload'));
    if (!projects.value.some(p => p.ref === form.value.project)) form.value.project = projects.value[0]?.ref || '';
  } catch (e) { addError.value = e.message; }
}
async function addToProject() {
  const f = form.value; addError.value = '';
  if (!f.project) { addError.value = 'Choose a project.'; return; }
  if (f.origin === 'development' && !f.consent.trim()) { addError.value = 'Describe where permission to use these files comes from.'; return; }
  if (f.grouping === 'one' && !f.group.trim()) { addError.value = 'Enter a home/group name to keep them together.'; return; }
  if (!f.batch.trim()) { addError.value = 'Enter a batch name.'; return; }
  sending.value = true;
  try {
    const project = projects.value.find(p => p.ref === f.project);
    const body = await libraryApi.addToProject(f.project, { attachment_ids: chosen.value.map(i => i.attachment_id), origin: f.origin,
      consent_source: f.consent.trim(), grouping: f.grouping, group: f.group.trim(), batch_name: f.batch.trim(), every: f.every });
    outcome.value = { said: addedSaid(body, project.name), ref: project.ref, problems: body.results.filter(r => r.state === 'rejected') };
    picked.value = new Set();
  } catch (e) { addError.value = e.message; }
  finally { sending.value = false; }
}
function openProject() { const ref = outcome.value?.ref; adding.value = false; if (ref) location.hash = projectLink(ref, 'dataset').slice(1); }
</script>

<template>
  <div class="studio ws-assets">
    <div class="studio-actions top">
      <label class="button button--primary upload-pick"><Upload :size="15"/> {{ uploading || 'Upload to your Library' }}<input ref="uploader" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" multiple :disabled="!!uploading" @change="uploadFiles($event.target.files)"></label>
    </div>
    <div class="studio-actions filters">
      <div class="studio-tabs" role="tablist" aria-label="What to show"><button v-for="[value, label] in TYPES" :key="value" role="tab" :aria-selected="type===value" :class="{active:type===value}" @click="type=value">{{ label }}</button></div>
      <div class="search-field"><Search :size="16"/><input v-model="q" aria-label="Search your Library" placeholder="Search by name…"></div>
    </div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="items===null" class="muted">Loading your Library…</p>
    <section v-else-if="!items.length" class="model-empty">
      <Images :size="40"/>
      <h2>{{ q ? 'Nothing matches that name' : type==='video' ? 'No videos in your Library yet' : 'Your Library is empty' }}</h2>
      <p>Upload photos or videos to add them to your projects.</p>
    </section>
    <template v-else>
      <ul class="asset-grid">
        <li v-for="item in items" :key="item.attachment_id" :class="['asset', { picked: picked.has(item.attachment_id), off: !usable(item) }]">
          <button type="button" class="asset-pick" :disabled="!usable(item)" :aria-pressed="picked.has(item.attachment_id)"
                  :aria-label="usable(item) ? `${picked.has(item.attachment_id) ? 'Unselect' : 'Select'} ${item.title}` : `${item.title}: a sound or a document cannot go into a project`" @click="toggle(item)">
            <span class="thumb">
              <img v-if="usable(item) && item.thumbnail_url" :src="item.thumbnail_url" :alt="item.title" loading="lazy" decoding="async" @error="item.thumbnail_url=''">
              <img v-else-if="item.media_type==='image' && mediaPath(item.url)" :src="mediaPath(item.url)" :alt="item.title" loading="lazy" decoding="async">
              <video v-else-if="item.media_type==='video' && mediaPath(item.url)" :src="mediaPath(item.url)" preload="metadata" muted playsinline aria-hidden="true"></video>
              <span v-else class="thumb-icon"><Film v-if="item.media_type==='video'" :size="28"/><Music v-else-if="item.media_type==='audio'" :size="28"/><FileText v-else :size="28"/></span>
              <span v-if="item.media_type==='video'" class="kind"><Film :size="12"/> Video</span>
              <span class="tick" aria-hidden="true"><Check :size="14"/></span>
            </span>
            <span class="asset-body"><strong :title="item.title">{{ item.title }}</strong>
              <small>{{ [item.ext ? item.ext.toUpperCase() : item.media_type, sizeText(item.size_bytes), day(item.created_at)].filter(Boolean).join(', ') }}</small></span>
          </button>
        </li>
      </ul>
      <div class="more"><UiButton v-if="more" :disabled="busy" @click="load(true)">{{ busy ? 'Loading…' : 'Show more' }}</UiButton></div>
    </template>
    <div v-if="picked.size" class="pick-bar" role="region" aria-label="Selected files">
      <strong>{{ picked.size }} selected</strong>
      <UiButton @click="picked = new Set()"><X :size="14"/> Clear</UiButton>
      <UiButton variant="primary" @click="openAdd"><Plus :size="15"/> Add to a project…</UiButton>
    </div>

    <UiDialog :open="adding" title="Add to a project" @close="adding=false">
      <template v-if="!outcome">
        <p class="dialog-description">{{ chosen.length }} file{{ chosen.length===1?'':'s' }} of your Library go into the project as photos, checked like photos you upload.{{ hasVideo ? ' A video gives a photo every few seconds.' : '' }} Your Library keeps them.</p>
        <label class="field-label">Project<select v-model="form.project" class="text-input"><option v-if="!projects.length" value="">You may add photos to no vision project here</option><option v-for="p in projects" :key="p.ref" :value="p.ref">{{ p.name }}</option></select></label>
        <label class="field-label">Image source<select v-model="form.origin" class="text-input"><option value="development">Development / test images</option><option value="customer">Customer images</option></select></label>
        <label v-if="form.origin==='development'" class="field-label">Permission source<input v-model="form.consent" class="text-input" maxlength="200" placeholder="e.g. My own photos, or images made with AI"></label>
        <label class="field-label">Grouping<select v-model="form.grouping" class="text-input"><option value="one">All of one home/group</option><option value="file">Each its own home/group</option></select></label>
        <label v-if="form.grouping==='one'" class="field-label">Home/group name<input v-model="form.group" class="text-input" maxlength="100" placeholder="e.g. Demo home 01"></label>
        <label class="field-label">Batch name<input v-model="form.batch" class="text-input" maxlength="100"></label>
        <label v-if="hasVideo" class="field-label">From each video, a photo every<select v-model.number="form.every" class="text-input"><option v-for="n in FRAME_EVERY" :key="n" :value="n">{{ n }} second{{ n===1?'':'s' }}</option></select></label>
        <p v-if="addError" class="field-error" role="alert">{{ addError }}</p>
        <div class="dialog-actions"><UiButton @click="adding=false">Cancel</UiButton><UiButton variant="primary" :disabled="sending||!projects.length" @click="addToProject">{{ sending ? 'Adding…' : `Add ${chosen.length} file${chosen.length===1?'':'s'}` }}</UiButton></div>
      </template>
      <template v-else>
        <p class="dialog-description" role="status">{{ outcome.said }}</p>
        <ul v-if="outcome.problems.length" class="problems"><li v-for="p in outcome.problems" :key="p.name">{{ p.name }}: {{ p.detail }}</li></ul>
        <div class="dialog-actions"><UiButton @click="adding=false">Close</UiButton><UiButton variant="primary" @click="openProject">Open its Dataset</UiButton></div>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.top{justify-content:flex-end;margin-top:0}
.muted{font-size:12px!important;color:#5f6d82!important}
.filters>.studio-tabs{margin:0;flex:1;min-width:220px}
.compact-select{padding:9px 12px!important;font-size:12px}
.upload-pick{position:relative;cursor:pointer}
.upload-pick input{position:absolute;inset:0;opacity:0;cursor:pointer}
.upload-pick:focus-within{outline:3px solid var(--aadml-outline);outline-offset:3px}
.model-empty h2{margin:6px 0 0}
.asset-grid{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
.asset-pick{display:flex;flex-direction:column;width:100%;padding:0;border:1px solid #e0e3eb;border-radius:10px;background:#fff;text-align:left;cursor:pointer;overflow:hidden;color:inherit;transition:border-color .15s,box-shadow .15s}
.asset-pick:hover:not(:disabled){border-color:var(--aadml-outline)}
.asset-pick:disabled{cursor:default}
.asset.picked .asset-pick{border-color:var(--aadml-primary);box-shadow:0 0 0 3px var(--aadml-soft)}
.thumb{position:relative;display:block;aspect-ratio:4/3;background:#f1f3f7}
.thumb img,.thumb video{width:100%;height:100%;object-fit:cover;display:block}
.thumb-icon{position:absolute;inset:0;display:grid;place-items:center;color:#8a95a8}
.kind{position:absolute;left:8px;bottom:8px;display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:5px;background:#0f172acc;color:#fff;font-size:11px}
.tick{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;border:2px solid #fff;background:#0f172a55;color:transparent}
.asset.picked .tick{background:var(--aadml-primary);color:#fff}
.asset.off .tick{display:none}
.asset.off .thumb{opacity:.6}
.asset-body{display:flex;flex-direction:column;gap:4px;padding:10px 12px 12px;min-width:0}
.asset-body strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.asset-body small{font-size:11px;color:#5f6d82}
.asset-body .badge{align-self:flex-start}
.more{display:flex;justify-content:center;margin:18px 0 90px}
.pick-bar{position:sticky;bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px;padding:12px 16px;border-radius:12px;background:#0f172a;color:#fff;box-shadow:0 10px 30px #0f172a33;z-index:5}
.pick-bar strong{flex:1;font-size:13px}
.pick-bar .button--secondary{background:transparent;color:#fff;border-color:#ffffff59}
.pick-bar .button--secondary:hover{background:#ffffff1a}
.problems{font-size:12px;color:#b42318;padding-left:18px}
@media(prefers-reduced-motion:reduce){.asset-pick{transition:none}}
@media(max-width:520px){.asset-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.pick-bar{bottom:8px}}
</style>
