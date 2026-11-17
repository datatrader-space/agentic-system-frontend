<template>
  <!-- Elements v2 (backend ELEMENTS_V2_PLAN.md): status, token, folders, pin, versions, rights. Only an approved
       Element with its rights confirmed can be used; the server enforces it, this shows why and what to do. -->
  <div class="el" :class="{ picker: isPicker }">
    <div class="el-filters">
      <label class="el-field el-search"><span class="el-sr">Search Elements</span>
        <input v-model="q" type="search" placeholder="Search by name or @token…" autocomplete="off" data-test="el-search" @input="reloadSoon" /></label>
      <div class="el-chips" role="group" aria-label="Status">
        <button v-for="s in statusFilters" :key="s.value" type="button" class="el-chip" :class="{ on: status === s.value }"
                :aria-pressed="status === s.value" :data-test="`el-status-${s.value || 'all'}`" @click="setStatus(s.value)">{{ s.label }}</button>
      </div>
      <label v-if="video.ingredientFolders.length" class="el-field"><span class="el-sr">Folder</span>
        <select v-model="folder" data-test="el-folder" @change="reload"><option :value="null">All folders</option>
          <option v-for="f in video.ingredientFolders" :key="f" :value="f">{{ f }}</option></select></label>
    </div>

    <p v-if="video.ingredientsLoading" class="el-empty" role="status">Loading Elements…</p>
    <p v-else-if="video.ingredientsError" class="el-error" role="alert">{{ video.ingredientsError }} <button type="button" class="el-btn" @click="reload">Try again</button></p>
    <div v-else-if="!video.ingredients.length" class="el-empty-block">
      <p class="el-empty">{{ filtered ? 'No Element matches these filters.' : 'An Element is a named character, product, place, style, brand or voice you can reuse in any video. Select files in the Library and save them as one, or ask the agent to.' }}</p>
      <slot name="empty" />
    </div>

    <ul class="el-list">
      <li v-for="ing in video.ingredients" :key="ing.ingredient_id" class="el-card" :class="`is-${ing.status}`" data-test="lib-ingredient">
        <div class="el-top">
          <div class="el-thumbs" aria-hidden="true">
            <template v-for="f in ing.files.slice(0, 3)" :key="f.attachment_id">
              <img v-if="f.thumbnail_url" :src="f.thumbnail_url" alt="" class="el-mini" width="72" height="48" loading="lazy" />
              <span v-else class="el-mini el-mini-kind">{{ f.media_type === 'audio' ? 'Audio' : f.media_type === 'video' ? 'Video' : 'Image' }}</span>
            </template>
            <span v-if="!ing.files.length" class="el-mini el-mini-kind">{{ kindLabel(ing.kind) }}</span>
          </div>
          <button v-if="!isPicker" type="button" class="el-pin" :aria-pressed="ing.pinned" :aria-label="ing.pinned ? `Unpin ${ing.name}` : `Pin ${ing.name}`"
                  :data-test="`el-pin-${ing.ingredient_id}`" @click="togglePin(ing)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4-1-6z" :fill="ing.pinned ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
          </button>
        </div>
        <p class="el-name"><strong>{{ ing.name }}</strong> <span class="el-kind">{{ kindLabel(ing.kind) }}</span>
          <span class="el-status" :data-test="`el-status-badge-${ing.ingredient_id}`">{{ statusLabel(ing.status) }}</span></p>
        <div class="el-tokenrow">
          <button v-if="ing.token" type="button" class="el-token" :aria-label="`Copy the token ${ing.token}`" :data-test="`el-token-${ing.ingredient_id}`" @click="copy(ing)">
            <span translate="no">{{ ing.token }}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M5 15V5a1 1 0 0 1 1-1h10" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
          </button>
          <span v-if="copiedId === ing.ingredient_id" class="el-meta" role="status">Copied. Write it in a prompt to use this Element.</span>
          <span v-else-if="ing.folder" class="el-meta">In {{ ing.folder }}</span>
        </div>
        <p v-if="ing.description" class="el-meta">{{ ing.description }}</p>
        <p v-if="ing.rights" class="el-meta" :data-test="`el-rights-${ing.ingredient_id}`">Rights: {{ basisLabel(ing.rights.basis) }}<template v-if="ing.rights.likeness">, consent of {{ ing.rights.subject_name }}</template>, confirmed {{ day(ing.rights.confirmed_at) }}</p>
        <p v-if="!ing.usable" class="el-why" :data-test="`el-why-${ing.ingredient_id}`">{{ whyText(ing) }}</p>

        <!-- one open panel at a time; every confirmation is inline, never a browser dialog -->
        <ElementApproveForm v-if="isOpen(ing, 'approve')" :element="ing" :schema="schema" @done="close" @cancel="close" />
        <ElementEditForm v-else-if="isOpen(ing, 'edit')" :element="ing" :schema="schema" :folders="video.ingredientFolders" @done="close" @cancel="close" />
        <ElementHistory v-else-if="isOpen(ing, 'history')" :element="ing" @done="close" @cancel="close" />
        <div v-else-if="isOpen(ing, 'delete')" class="el-confirm" role="alert">
          <span>Delete "{{ ing.name }}"? Its files stay in your Library.</span>
          <button type="button" class="el-btn danger" data-test="lib-ing-delete-confirm" @click="remove(ing)">Delete</button>
          <button type="button" class="el-btn" @click="close">Cancel</button>
        </div>
        <div v-else-if="isOpen(ing, 'rights')" class="el-confirm" role="alert">
          <span>Withdraw the rights and consent record of "{{ ing.name }}"? It goes back to draft and its file consents are revoked.</span>
          <button type="button" class="el-btn danger" :data-test="`el-rights-withdraw-${ing.ingredient_id}`" @click="withdraw(ing)">Withdraw</button>
          <button type="button" class="el-btn" @click="close">Cancel</button>
        </div>
        <template v-else>
          <div class="el-actions">
            <button type="button" class="el-btn primary" data-test="lib-ing-use" :disabled="!ing.usable" :aria-describedby="ing.usable ? undefined : `el-why-${ing.ingredient_id}`" @click="emit('use', ing)">Use</button>
            <button v-if="!isPicker && ing.status !== 'archived' && !ing.usable" type="button" class="el-btn" :data-test="`el-approve-${ing.ingredient_id}`" @click="open(ing, 'approve')">{{ ing.status === 'approved' ? 'Confirm rights' : 'Approve' }}</button>
          </div>
          <div v-if="!isPicker" class="el-more">
            <button type="button" class="el-link" :data-test="`el-edit-${ing.ingredient_id}`" @click="open(ing, 'edit')">Edit</button>
            <button type="button" class="el-link" :data-test="`el-history-${ing.ingredient_id}`" @click="open(ing, 'history')">History ({{ ing.version_count || 1 }})</button>
            <button v-if="ing.status === 'archived'" type="button" class="el-link" :data-test="`el-unarchive-${ing.ingredient_id}`" @click="setElementStatus(ing, 'draft')">Restore from archive</button>
            <button v-else type="button" class="el-link" :data-test="`el-archive-${ing.ingredient_id}`" @click="setElementStatus(ing, 'archived')">Archive</button>
            <button v-if="ing.rights" type="button" class="el-link" @click="open(ing, 'rights')">Withdraw rights</button>
            <button type="button" class="el-link danger" @click="open(ing, 'delete')">Delete</button>
          </div>
        </template>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import ElementApproveForm from './ElementApproveForm.vue'
import ElementEditForm from './ElementEditForm.vue'
import ElementHistory from './ElementHistory.vue'
import { BASIS_LABELS, KINDS } from './elementKinds'

const props = defineProps({ mode: { type: String, default: 'drawer' } })
const emit = defineEmits(['use'])
const video = useVideoStore()
const isPicker = computed(() => props.mode === 'picker')
const schema = ref(null)
const q = ref(''), status = ref(''), folder = ref(null)
const openId = ref(''), openPanel = ref(''), copiedId = ref('')
const statusFilters = [{ value: '', label: 'All' }, { value: 'approved', label: 'Approved' }, { value: 'draft', label: 'Drafts' }, { value: 'archived', label: 'Archived' }]
const filtered = computed(() => !!(q.value.trim() || status.value || folder.value !== null))
let timer = null, copyTimer = null

const kindLabel = k => (KINDS.find(x => x.value === k) || { label: k }).label
const statusLabel = s => ({ draft: 'Draft', approved: 'Approved', archived: 'Archived' }[s] || s)
const basisLabel = b => BASIS_LABELS[b] || 'no rights basis needed'
const day = iso => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
function whyText(ing) {
  if (ing.status === 'draft') return 'Draft. Approve it to use it in videos, batches and agent runs.'
  if (ing.status === 'archived') return 'Archived. Restore it from the archive and approve it to use it again.'
  return ing.unusable_reason
}
const isOpen = (ing, panel) => openId.value === ing.ingredient_id && openPanel.value === panel
function open(ing, panel) { openId.value = ing.ingredient_id; openPanel.value = panel }
function close() { openId.value = ''; openPanel.value = '' }
function reload() { return video.loadIngredients(q.value.trim(), { status: status.value, folder: folder.value }) }
function reloadSoon() { clearTimeout(timer); timer = setTimeout(reload, 250) }
function setStatus(value) { status.value = value; reload() }
async function togglePin(ing) { await video.updateIngredient(ing.ingredient_id, { pinned: !ing.pinned }) }
async function setElementStatus(ing, value) { await video.setIngredientStatus(ing.ingredient_id, value) }
async function remove(ing) { if (await video.deleteIngredient(ing.ingredient_id)) close() }
async function withdraw(ing) { if (await video.revokeIngredientRights(ing.ingredient_id)) close() }
async function copy(ing) {
  try { await navigator.clipboard.writeText(ing.token) } catch { /* the token stays visible to copy by hand */ }
  copiedId.value = ing.ingredient_id
  clearTimeout(copyTimer); copyTimer = setTimeout(() => { copiedId.value = '' }, 2500)
}
onMounted(async () => { schema.value = await video.loadIngredientSchema() })
onBeforeUnmount(() => { clearTimeout(timer); clearTimeout(copyTimer) })
defineExpose({ reload })
</script>

<style scoped>
/* A card per Element. The status is said in words and shown by the card's left rule; the token is the one
   memorable thing (it is what a person types), set apart as a chip. Colours come from the --vm-* tokens. */
.el { display: grid; gap: 14px; align-content: start; }
.el-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.el-field { display: grid; gap: 6px; min-width: 0; font-size: 12.5px; font-weight: 500; color: var(--vm-ink-soft, #64748b); }
.el-search { flex: 1 1 200px; max-width: 320px; }
.el-field input, .el-field select { width: 100%; min-height: 40px; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--vm-line, #e5e7eb);
  border-radius: 6px; background: var(--vm-surface-2, #fff); color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; }
.el-chips { display: flex; flex-wrap: wrap; gap: 2px; padding: 3px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; }
.el-chip { min-height: 34px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: var(--vm-ink-soft, #64748b);
  font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: color .15s, background-color .15s; }
.el-chip:hover { color: var(--vm-ink, #0f172a); }
.el-chip.on { background: var(--vm-surface-2, #f1f5f9); color: var(--vm-ink, #0f172a); box-shadow: inset 0 0 0 1px var(--vm-line, #dce3ee); }
.el-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.el-card { display: grid; gap: 8px; align-content: start; padding: 12px 12px 12px 14px; border: 1px solid var(--vm-line-2, #e5e7eb);
  border-left: 3px solid var(--vm-line, #cbd5e1); border-radius: 8px; background: var(--vm-surface, #fff); min-width: 0; }
.el-card.is-approved { border-left-color: var(--vs-good, #15803d); }
.el-card.is-draft { border-left-color: var(--vs-warn, #b45309); }
.el-card.is-archived { border-left-color: var(--vm-line, #94a3b8); background: var(--vm-surface-2, #f8fafc); }
.el-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.el-thumbs { display: flex; gap: 4px; min-width: 0; }
.el-mini { width: 72px; height: 48px; object-fit: cover; border-radius: 4px; background: #000; }
.el-mini-kind { display: grid; place-items: center; background: var(--vm-surface-2, #f1f5f9); color: var(--vm-ink-soft, #64748b); font-size: 11.5px; }
.el-pin { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border: 0; border-radius: 6px; background: transparent;
  color: var(--vm-ink-soft, #64748b); cursor: pointer; transition: color .15s; }
.el-pin[aria-pressed="true"] { color: var(--vm-violet-d, #4f46e5); }
.el-pin:hover { color: var(--vm-ink, #0f172a); }
.el-pin svg { width: 18px; height: 18px; }
.el-name { margin: 0; font-size: 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.el-kind { font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.el-status { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--vm-ink, #0f172a); }
.is-draft .el-status { color: var(--vs-warn-ink, #92400e); }
.is-approved .el-status { color: var(--vs-good-ink, #166534); }
.is-archived .el-status { color: var(--vm-ink-soft, #64748b); }
.el-tokenrow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.el-token { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; max-width: 100%; padding: 0 10px; border: 1px solid var(--vm-violet-soft, #c7d2fe);
  border-radius: 999px; background: var(--vm-violet-soft, #eef2ff); color: var(--vm-violet-d, #3730a3); font: 600 13px var(--vm-font-sans, inherit);
  cursor: pointer; transition: background-color .15s; }
.el-token span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.el-token:hover { background: var(--vm-surface-2, #e0e7ff); }
.el-token svg { width: 14px; height: 14px; flex-shrink: 0; }
.el-meta { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-soft, #64748b); }
.el-why { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--vs-warn-ink, #92400e); }
.el-actions, .el-confirm, .el-more { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.el-confirm { font-size: 13px; }
.el-more { gap: 2px 12px; }
.el-btn { display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px; background: transparent;
  color: var(--vm-ink, #0f172a); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: background-color .15s; }
.el-btn:hover:not(:disabled) { background: var(--vm-surface-2, #f1f5f9); }
.el-btn.primary { background: var(--vm-violet-d, #4f46e5); color: #fff; border-color: transparent; font-weight: 600; }
.el-btn.primary:hover:not(:disabled) { background: var(--vm-violet, #6366f1); }
.el-btn.danger { background: #c53030; color: #fff; border-color: transparent; }
.el-btn:disabled { opacity: .45; cursor: not-allowed; }
.el-link { min-height: 32px; padding: 0; border: 0; background: transparent; color: var(--vs-accent-ink, var(--vm-violet-d, #4f46e5)); font: inherit; font-size: 12.5px;
  cursor: pointer; text-underline-offset: 2px; }
.el-link:hover { text-decoration: underline; }
.el-link.danger { color: var(--vs-bad-ink, #b91c1c); }
.el-empty-block { display: grid; gap: 14px; justify-items: start; }
.el-empty, .el-error { margin: 0; max-width: 40em; font-size: 13.5px; line-height: 1.6; color: var(--vm-ink-soft, #64748b); }
.el-error { color: var(--vs-bad-ink, #b91c1c); }
.el-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.el button:focus-visible, .el input:focus-visible, .el select:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
@media (pointer: coarse) { .el-btn, .el-chip, .el-link, .el-token, .el-field input, .el-field select { min-height: 44px; } }
@media (max-width: 640px) { .el-field input, .el-field select { font-size: 16px; } .el-search { max-width: none; } .el-list { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .el * { transition: none !important; } }
</style>
