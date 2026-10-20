<template>
  <!-- The Library (VIDEO_STUDIO_AGENT_FLOW_PLAN.md D4): every file the user uploaded or generated in Video Studio,
       and their named Ingredients. One Library is shared by every origin and never mixed (backend
       ASSET_LIBRARY_ORIGINS_PLAN.md): AADML's chats and Training Data list their own. "Use" links a file to this
       video's project and adds it to the composer. -->
  <Teleport to="body" :disabled="isPage">
    <div class="lib-backdrop" :class="{ page: isPage }" @click.self="!isPage && close()">
      <section ref="panelEl" class="lib" :role="isPage ? 'region' : 'dialog'" :aria-modal="isPage ? undefined : 'true'"
               aria-labelledby="lib-title" tabindex="-1" data-test="video-library" @keydown.esc="!isPage && close()">
        <header class="lib-head">
          <component :is="isPage ? 'h1' : 'h2'" id="lib-title">{{ isPage ? (initialTab === 'ingredients' ? 'Ingredients' : 'Library') : 'Library' }}</component>
          <p v-if="isPage" class="lib-lead">{{ initialTab === 'ingredients'
            ? 'Characters, products, places and styles you named, ready for any video.'
            : 'Every image, video, sound and document you uploaded or made in Video Studio.' }}</p>
          <button v-if="!isPage" type="button" class="lib-x" aria-label="Close Library" @click="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <!-- On the Studio's own pages the side navigation picks Library or Ingredients; the drawer has both as tabs. -->
        <div v-if="!isPage" class="lib-tabs" role="tablist" aria-label="Library">
          <button v-for="t in tabs" :key="t.value" type="button" role="tab" class="lib-tab" :class="{ on: tab === t.value }"
                  :aria-selected="tab === t.value ? 'true' : 'false'" :data-test="'lib-tab-' + t.value" @click="tab = t.value">
            {{ t.label }}</button>
        </div>

        <!-- FILES -->
        <div v-show="tab === 'files'" class="lib-body" role="tabpanel" aria-label="Files">
          <div class="lib-filters">
            <div class="lib-types" role="group" aria-label="Type">
              <button v-for="t in types" :key="t.value" type="button" class="lib-chip" :class="{ on: lib.type === t.value }"
                      :aria-pressed="lib.type === t.value ? 'true' : 'false'" @click="setType(t.value)">{{ t.label }}</button>
            </div>
            <div class="lib-types" role="group" aria-label="Made or uploaded">
              <button v-for="s in sources" :key="s.value" type="button" class="lib-chip" :class="{ on: lib.source === s.value }"
                      :aria-pressed="lib.source === s.value ? 'true' : 'false'" :data-test="'lib-source-' + s.value"
                      @click="setSource(s.value)">{{ s.label }}</button>
            </div>
            <!-- One project's files: its chats and what was linked to it (owner, 2026-10-20). -->
            <VideoChoice v-if="video.libraryProjects.length" class="lib-project" :model-value="lib.project" :options="projectOptions"
                         label="Project" :icon="PROJECT_ICON" drop="down" test-id="lib-project" @update:model-value="setProject" />
            <label class="lib-field lib-search"><span class="lib-sr">Search the Library</span>
              <input type="search" :value="lib.q" placeholder="Search by name…" data-test="lib-search" @input="onSearch($event.target.value)" /></label>
          </div>
          <p v-if="lib.error" class="lib-error" role="alert">{{ lib.error }}</p>
          <p v-else-if="!lib.loading && !lib.items.length" class="lib-empty">
            {{ lib.q ? 'Nothing matches that search.' : 'Files and documents you upload or make in Video Studio appear here.' }}</p>
          <ul class="lib-grid" aria-label="Files">
            <li v-for="it in lib.items" :key="it.attachment_id" class="lib-card" :class="{ picked: picked.has(it.attachment_id) }"
                :data-test="'lib-item'">
              <video v-if="it.media_type === 'video'" :src="it.url" muted preload="metadata" class="lib-thumb" aria-hidden="true"></video>
              <span v-else-if="it.media_type === 'audio'" class="lib-thumb lib-audio" aria-hidden="true">Audio</span>
              <!-- A document: a page with its file type, not a broken image. -->
              <span v-else-if="it.media_type === 'document'" class="lib-thumb lib-doc" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>
                <span class="lib-doc-ext">{{ (it.ext || 'file').toUpperCase() }}</span>
              </span>
              <img v-else :src="it.url" alt="" class="lib-thumb" loading="lazy" />
              <span class="lib-name" :title="it.title">{{ it.title }}</span>
              <span class="lib-meta">{{ it.source === 'generated' ? 'Made with AI' : 'Uploaded' }}, {{ day(it.created_at) }}{{ it.size_bytes ? ', ' + size(it.size_bytes) : '' }}</span>
              <span v-if="it.ingredients && it.ingredients.length" class="lib-ing">{{ it.ingredients.join(', ') }}</span>
              <!-- A document is listed to open; a video uses images, clips and sounds. -->
              <div v-if="it.media_type === 'document'" class="lib-actions">
                <a :href="it.url" class="lib-btn" target="_blank" rel="noopener noreferrer" data-test="lib-open">Open</a>
              </div>
              <div v-else-if="usingId === it.attachment_id" class="lib-use">
                <VideoChoice v-model="useRole" :options="rolesFor(it)" label="Use as" drop="down" test-id="lib-role" />
                <button type="button" class="lib-btn primary" data-test="lib-use-confirm" @click="confirmUse(it)">Add</button>
                <button type="button" class="lib-btn" @click="usingId = ''">Cancel</button>
              </div>
              <div v-else class="lib-actions">
                <button type="button" class="lib-btn primary" data-test="lib-use" @click="startUse(it)">Use</button>
                <label v-if="it.media_type !== 'audio'" class="lib-pick">
                  <input type="checkbox" :checked="picked.has(it.attachment_id)" :aria-label="'Select ' + it.title" @change="togglePick(it)" />
                  Select</label>
              </div>
            </li>
          </ul>
          <button v-if="lib.hasMore" type="button" class="lib-btn wide" :disabled="lib.loading" @click="video.loadLibrary({ more: true })">
            {{ lib.loading ? 'Loading…' : 'Load more' }}</button>

          <form v-if="picked.size" class="lib-save" data-test="lib-save-ingredient" @submit.prevent="saveIngredient">
            <p class="lib-save-title">Save {{ picked.size }} file{{ picked.size === 1 ? '' : 's' }} as an ingredient</p>
            <label class="lib-field"><span>Name</span><input v-model="draft.name" maxlength="80" required data-test="lib-ing-name" /></label>
            <div class="lib-field"><span>Kind</span>
              <VideoChoice v-model="draft.kind" :options="kinds" label="Kind" test-id="lib-ing-kind" /></div>
            <label class="lib-field"><span>Description (optional)</span><textarea v-model="draft.description" rows="2" maxlength="1000"></textarea></label>
            <div class="lib-actions">
              <button type="submit" class="lib-btn primary" :disabled="!draft.name.trim() || saving">{{ saving ? 'Saving…' : 'Save ingredient' }}</button>
              <button type="button" class="lib-btn" @click="picked = new Set()">Clear selection</button>
            </div>
          </form>
        </div>

        <!-- INGREDIENTS -->
        <div v-show="tab === 'ingredients'" class="lib-body" role="tabpanel" aria-label="Ingredients">
          <div v-if="!video.ingredients.length" class="lib-empty-block">
            <p class="lib-empty">An ingredient is a named character, product, place or style you can reuse in any video. Select
              files in the Library and save them as one, or ask the agent to.</p>
            <router-link v-if="isPage" to="/video-studio/library" class="lib-btn primary">Open the Library</router-link>
            <button v-else type="button" class="lib-btn" @click="tab = 'files'">Show my files</button>
          </div>
          <ul class="lib-ings">
            <li v-for="ing in video.ingredients" :key="ing.ingredient_id" class="lib-ing-card" data-test="lib-ingredient">
              <div class="lib-ing-thumbs" aria-hidden="true">
                <template v-for="f in ing.files.slice(0, 3)" :key="f.attachment_id">
                  <video v-if="f.media_type === 'video'" :src="f.url" muted preload="metadata" class="lib-mini"></video>
                  <img v-else :src="f.url" alt="" class="lib-mini" loading="lazy" />
                </template>
              </div>
              <template v-if="editingId === ing.ingredient_id">
                <label class="lib-field"><span>Name</span><input v-model="edit.name" maxlength="80" /></label>
                <label class="lib-field"><span>Description</span><textarea v-model="edit.description" rows="2" maxlength="1000"></textarea></label>
                <div class="lib-actions">
                  <button type="button" class="lib-btn primary" @click="saveEdit(ing)">Save</button>
                  <button type="button" class="lib-btn" @click="editingId = ''">Cancel</button>
                </div>
              </template>
              <template v-else>
                <p class="lib-ing-name"><strong>{{ ing.name }}</strong> <span class="lib-kind">{{ kindLabel(ing.kind) }}</span></p>
                <p v-if="ing.description" class="lib-meta">{{ ing.description }}</p>
                <div v-if="deletingId === ing.ingredient_id" class="lib-confirm" role="alert">
                  <span>Delete "{{ ing.name }}"? Its files stay in your Library.</span>
                  <button type="button" class="lib-btn danger" data-test="lib-ing-delete-confirm" @click="remove(ing)">Delete</button>
                  <button type="button" class="lib-btn" @click="deletingId = ''">Cancel</button>
                </div>
                <div v-else class="lib-actions">
                  <button type="button" class="lib-btn primary" data-test="lib-ing-use" @click="useIngredient(ing)">Use</button>
                  <button type="button" class="lib-btn" @click="startEdit(ing)">Edit</button>
                  <button type="button" class="lib-btn" @click="deletingId = ing.ingredient_id">Delete</button>
                </div>
              </template>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useVideoStore } from '../../stores/useVideoStore'
import { useChatStore } from '../../stores/useChatStore'
import VideoChoice from './VideoChoice.vue'

// mode 'drawer': over the Create page, "Use" adds the file at once. mode 'page': Video Studio's Library and
// Ingredients pages, where "Use" queues the file and opens Create, which applies it to its project.
const props = defineProps({
  mode: { type: String, default: 'drawer' },
  initialTab: { type: String, default: 'files' },
})
const isPage = computed(() => props.mode === 'page')
const router = useRouter()
const video = useVideoStore()
const chat = useChatStore()
const lib = computed(() => video.library)
const panelEl = ref(null)
const tab = ref(props.initialTab === 'ingredients' ? 'ingredients' : 'files')
const tabs = [{ value: 'files', label: 'Files' }, { value: 'ingredients', label: 'Ingredients' }]
const sources = [{ value: 'all', label: 'All sources' }, { value: 'generated', label: 'Made with AI' }, { value: 'uploaded', label: 'Uploaded' }]
const types = [{ value: 'all', label: 'All' }, { value: 'image', label: 'Images' }, { value: 'video', label: 'Videos' },
               { value: 'audio', label: 'Audio' }, { value: 'document', label: 'Documents' }]
const kinds = [{ value: 'character', label: 'Character' }, { value: 'product', label: 'Product' },
               { value: 'location', label: 'Location' }, { value: 'style', label: 'Style' }]
// What a file can be used as. The composer then shows whether the chosen model takes it.
const ROLES = {
  image: [{ value: 'subject', label: 'Product, character or place' }, { value: 'style', label: 'Style' },
          { value: 'first_frame', label: 'Opening shot' }, { value: 'last_frame', label: 'Closing shot' }],
  video: [{ value: 'subject', label: 'Product, character or place' }, { value: 'style', label: 'Style' },
          { value: 'motion', label: 'Motion' }],
  audio: [{ value: 'audio', label: 'Sound reference' }, { value: 'music', label: 'Music' }],
}
const usingId = ref('')
const useRole = ref('subject')
const picked = ref(new Set())
const draft = reactive({ name: '', kind: 'product', description: '' })
const saving = ref(false)
const editingId = ref('')
const edit = reactive({ name: '', description: '' })
const deletingId = ref('')
let searchTimer = null

function close() { video.libraryOpen = false }
function day(iso) { return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '' }
function size(n) {
  const b = Number(n) || 0
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`
}
function kindLabel(k) { return (kinds.find((x) => x.value === k) || { label: k }).label }
function rolesFor(it) { return ROLES[it.media_type] || ROLES.image }
function setType(t) { video.library.type = t; video.loadLibrary() }
function setSource(s) { video.library.source = s; video.loadLibrary() }
function setProject(id) { video.library.project = id; video.loadLibrary() }
const PROJECT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h7l2 2h9v10H3z"/></svg>'
const projectOptions = computed(() => [{ value: '', label: 'All projects' },
  ...video.libraryProjects.map((p) => ({ value: p.project_id, label: p.title }))])
function onSearch(q) {
  video.library.q = q
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => video.loadLibrary(), 300)
}
function startUse(it) { usingId.value = it.attachment_id; useRole.value = rolesFor(it)[0].value }
async function confirmUse(it) {
  if (isPage.value) {
    video.queueUse({ kind: 'file', item: it, role: useRole.value })
    usingId.value = ''
    router.push({ name: 'video-studio' })
    return
  }
  if (await video.useLibraryItem(it, useRole.value, { chat })) usingId.value = ''
}
function togglePick(it) {
  const next = new Set(picked.value)
  if (next.has(it.attachment_id)) next.delete(it.attachment_id)
  else if (next.size < 8) next.add(it.attachment_id)
  picked.value = next
}
async function saveIngredient() {
  saving.value = true
  try {
    const ing = await video.createIngredient({ kind: draft.kind, name: draft.name.trim(), description: draft.description.trim(),
                                               attachmentIds: [...picked.value] })
    if (ing) {
      picked.value = new Set()
      Object.assign(draft, { name: '', kind: 'product', description: '' })
      // A page has no tabs (the side navigation picks Library or Ingredients), so it goes to the Ingredients page.
      if (isPage.value) { router.push('/video-studio/ingredients'); return }
      tab.value = 'ingredients'
      video.loadLibrary()
    }
  } finally { saving.value = false }
}
async function useIngredient(ing) {
  if (isPage.value) {
    video.queueUse({ kind: 'ingredient', ingredient: ing })
    router.push({ name: 'video-studio' })
    return
  }
  await video.useIngredient(ing, { chat })
}
function startEdit(ing) { editingId.value = ing.ingredient_id; Object.assign(edit, { name: ing.name, description: ing.description }) }
async function saveEdit(ing) {
  if (await video.updateIngredient(ing.ingredient_id, { name: edit.name.trim(), description: edit.description.trim() })) editingId.value = ''
}
async function remove(ing) { if (await video.deleteIngredient(ing.ingredient_id)) deletingId.value = '' }

onMounted(async () => {
  video.loadLibrary()
  video.loadIngredients()
  video.loadLibraryProjects()
  await nextTick()
  if (!isPage.value) panelEl.value?.focus()
})
onBeforeUnmount(() => clearTimeout(searchTimer))
</script>

<style scoped>
/* Drawer over Create, or a page of the Studio. Files are a contact sheet: the frame is the content, the name and
   source sit under it, actions after. Colours come from the --vm-* tokens. */
.lib-backdrop { position: fixed; inset: 0; z-index: 1900; background: var(--vs-scrim, rgba(15, 23, 42, .4)); display: flex; justify-content: flex-end; }
.lib-backdrop.page { position: static; inset: auto; z-index: auto; background: transparent; width: 100%; min-height: 100%; }
.lib { width: min(520px, 100vw); height: 100%; display: flex; flex-direction: column; outline: none;
  background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); box-shadow: var(--vm-shadow-l, -12px 0 40px rgba(15, 23, 42, .2)); }
.lib-backdrop.page .lib { width: 100%; height: auto; min-height: 100%; background: transparent; box-shadow: none; }
.lib-head { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 8px 8px 20px;
  min-height: 60px; box-sizing: border-box; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.lib-head h1, .lib-head h2 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -.015em; }
.lib-backdrop.page .lib-head { display: block; padding: 12px 20px; }
.lib-lead { margin: 2px 0 0; font-size: 12.5px; color: var(--vm-ink-soft, #64748b); }
.lib-x { display: grid; place-items: center; width: 44px; height: 44px; border: none; border-radius: 6px; background: transparent; color: var(--vm-ink-soft, #64748b); cursor: pointer; }
.lib-x:hover { color: var(--vm-ink, #0f172a); }
.lib-x svg { width: 18px; height: 18px; }
.lib-tabs { display: flex; gap: 4px; padding: 0 14px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.lib-tab { min-height: 44px; padding: 0 10px; border: none; border-bottom: 2px solid transparent; background: transparent; color: var(--vm-ink-soft, #64748b);
  font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer; }
.lib-tab.on { color: var(--vm-ink, #0f172a); border-bottom-color: var(--vm-violet, #4f46e5); }
.lib-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 20px 24px; display: grid; gap: 14px; align-content: start; }
.lib-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.lib-project :deep(.vch-pill) { min-height: 40px; border-radius: 8px; max-width: 240px; }
.lib-types { display: flex; flex-wrap: wrap; gap: 2px; padding: 3px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; }
.lib-chip { min-height: 34px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: var(--vm-ink-soft, #64748b);
  font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.lib-chip:hover { color: var(--vm-ink, #0f172a); }
.lib-chip.on { background: var(--vm-surface-2, #f1f5f9); color: var(--vm-ink, #0f172a); box-shadow: inset 0 0 0 1px var(--vm-line, #dce3ee); }
.lib-field { display: grid; gap: 6px; min-width: 0; font-size: 12.5px; font-weight: 500; color: var(--vm-ink-soft, #64748b); }
.lib-search { flex: 1 1 200px; max-width: 360px; }
.lib-field input, .lib-field select, .lib-field textarea { width: 100%; min-height: 40px; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--vm-line, #e5e7eb);
  border-radius: 6px; background: var(--vm-surface-2, #fff); color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; font-weight: 400; }
.lib-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 18px 14px; }
.lib-card { display: grid; gap: 6px; min-width: 0; align-content: start; }
.lib-card.picked .lib-thumb { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
.lib-thumb { width: 100%; aspect-ratio: 16/10; object-fit: cover; border-radius: 4px; background: #000; display: grid; place-items: center; color: #a7a8ae; font-size: 12px; }
.lib-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lib-meta { margin: 0; font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.lib-doc { display: grid; place-items: center; align-content: center; gap: 4px; background: var(--vm-surface-2, #f1f5f9); color: var(--vm-ink-soft, #64748b); }
.lib-doc svg { width: 34px; height: 34px; }
.lib-doc-ext { font-size: 11.5px; font-weight: 600; letter-spacing: .02em; color: var(--vm-ink, #0f172a); }
a.lib-btn { display: inline-flex; align-items: center; text-decoration: none; }
.lib-ing { font-size: 12px; color: var(--vs-accent-ink, var(--vm-violet-d, #4f46e5)); }
.lib-actions, .lib-use, .lib-confirm { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.lib-use { display: grid; }
.lib-confirm { font-size: 13px; }
.lib-btn { min-height: 36px; padding: 0 12px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px; background: transparent; color: var(--vm-ink, #0f172a);
  font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.lib-btn:hover:not(:disabled) { background: var(--vm-surface-2, #f1f5f9); }
.lib-btn.primary { background: var(--vm-violet-d, #4f46e5); color: #fff; border-color: transparent; font-weight: 600; }
.lib-btn.primary:hover:not(:disabled) { background: var(--vm-violet, #6366f1); }
.lib-btn.danger { background: #c53030; color: #fff; border-color: transparent; }
.lib-btn.wide { width: 100%; }
.lib-btn:disabled { opacity: .45; cursor: not-allowed; }
.lib-pick { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; font-size: 12.5px; color: var(--vm-ink-soft, #64748b); cursor: pointer; }
.lib-pick input { width: 16px; height: 16px; accent-color: var(--vm-violet-d, #4f46e5); }
.lib-save { position: sticky; bottom: 0; display: grid; gap: 10px; padding: 14px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 8px;
  background: var(--vm-surface, #fff); box-shadow: var(--vm-shadow-m, 0 8px 22px rgba(15, 23, 42, .08)); }
.lib-save-title { margin: 0; font-weight: 600; font-size: 13.5px; }
.lib-ings { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.lib-ing-card { display: grid; gap: 8px; align-content: start; padding: 12px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; }
.lib-ing-thumbs { display: flex; gap: 4px; }
.lib-mini { width: 72px; height: 48px; object-fit: cover; border-radius: 4px; background: #000; }
.lib-ing-name { margin: 0; font-size: 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.lib-kind { font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.lib-empty-block { display: grid; gap: 14px; justify-items: start; }
.lib-btn { display: inline-flex; align-items: center; text-decoration: none; }
.lib-empty, .lib-error { margin: 0; max-width: 40em; font-size: 13.5px; line-height: 1.6; color: var(--vm-ink-soft, #64748b); }
.lib-error { color: var(--vs-bad-ink, #b91c1c); }
.lib-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.lib button:focus-visible, .lib input:focus-visible, .lib select:focus-visible, .lib textarea:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
@media (max-width: 1023px) { .lib-backdrop.page .lib-head { padding-left: calc(12px + var(--vs-bar-inset, 0px)); } }
@media (pointer: coarse) { .lib-btn, .lib-chip, .lib-pick, .lib-field input, .lib-field select { min-height: 44px; } }
@media (max-width: 640px) {
  .lib-body { padding: 12px 16px 20px; }
  .lib-field input, .lib-field select, .lib-field textarea { font-size: 16px; }
  .lib-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 10px; }
  .lib-search { max-width: none; }
}
@media (prefers-reduced-motion: reduce) { .lib * { transition: none !important; } }
</style>
