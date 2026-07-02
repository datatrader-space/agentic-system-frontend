<template>
  <div class="hc">
    <header class="hc-head">
      <div>
        <h1>Help Center Content</h1>
        <p>Create and manage documentation, guides, FAQs, and integrations. Saving publishes searchable,
          embedded sections. Use <strong>Generate KB embeddings</strong> to index any content that isn't embedded yet.</p>
      </div>
      <div class="hc-head-actions">
        <button class="btn ghost" :disabled="embedding" @click="generateEmbeddings" :title="embedPhase">
          <Icon :icon="embedding ? 'lucide:loader-2' : 'lucide:sparkles'" :class="{ spin: embedding }" />
          {{ embedding ? (embedPhase || 'Indexing…') : 'Generate KB embeddings' }}
        </button>
        <button class="btn primary" @click="openCreate"><Icon icon="lucide:plus" /> New content</button>
      </div>
    </header>

    <div v-if="embedResult" class="embed-banner">
      <Icon icon="lucide:check-circle-2" />
      <span>Help Center KB source updated: <strong>{{ embedResult.embedded }}</strong> section{{ embedResult.embedded === 1 ? '' : 's' }} embedded
        ({{ embedResult.created }} new, {{ embedResult.updated }} changed), {{ embedResult.skipped }} unchanged{{ embedResult.removed ? `, ${embedResult.removed} removed` : '' }}.
        <em>{{ embedResult.chunks }} chunks total across {{ embedResult.articles }} articles.</em>
        Add it to an agent via <strong>Add KB source</strong>.</span>
      <button class="banner-x" @click="embedResult = null"><Icon icon="lucide:x" /></button>
    </div>

    <!-- Filters -->
    <div class="hc-filters">
      <div class="search">
        <Icon icon="lucide:search" />
        <input v-model="filters.q" placeholder="Search title…" @input="debouncedLoad" />
      </div>
      <select v-model="filters.type" @change="load">
        <option value="">All types</option>
        <option v-for="t in meta.types" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
      <select v-model="filters.product_area" @change="load">
        <option value="">All areas</option>
        <option v-for="a in meta.product_areas" :key="a" :value="a">{{ a }}</option>
      </select>
      <select v-model="filters.status" @change="load">
        <option value="">All statuses</option>
        <option v-for="s in meta.statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
    </div>

    <!-- Table -->
    <section class="card">
      <div v-if="loading" class="state">Loading…</div>
      <div v-else-if="error" class="state err">Couldn’t load. <button class="link" @click="load">Retry</button></div>
      <div v-else-if="!rows.length" class="state">No content yet. <button class="link" @click="openCreate">Create the first article</button>.</div>
      <table v-else class="tbl">
        <thead><tr><th>Title</th><th>Type</th><th>Area</th><th>Status</th><th>Sections</th><th>Updated</th><th class="r">Actions</th></tr></thead>
        <tbody>
          <tr v-for="c in rows" :key="c.id">
            <td>
              <strong>{{ c.title }}</strong>
              <div class="sub">/{{ c.slug }}</div>
            </td>
            <td><span class="kind">{{ c.type }}</span></td>
            <td class="muted">{{ c.product_area || '—' }}</td>
            <td><span :class="['status', c.status]">{{ c.status }}</span></td>
            <td>
              <span class="secs" :class="{ warn: c.pending_embeddings > 0 }">
                {{ c.embedded_count }}/{{ c.section_count }}
                <Icon v-if="c.pending_embeddings > 0" icon="lucide:alert-triangle" :title="`${c.pending_embeddings} section(s) not embedded`" />
              </span>
            </td>
            <td class="muted">{{ shortDate(c.last_updated) }}</td>
            <td class="actions">
              <button class="ic" title="Edit" @click="openEdit(c)"><Icon icon="lucide:pencil" /></button>
              <button class="ic" :title="c.status === 'published' ? 'Unpublish' : 'Publish'" @click="togglePublish(c)">
                <Icon :icon="c.status === 'published' ? 'lucide:eye-off' : 'lucide:eye'" />
              </button>
              <button class="ic danger" title="Delete" @click="confirmRow = c"><Icon icon="lucide:trash-2" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Editor drawer -->
    <div v-if="editorOpen" class="backdrop" @click.self="editorOpen = false">
      <aside class="drawer">
        <header class="d-head">
          <h2>{{ form.id ? 'Edit content' : 'New content' }}</h2>
          <button class="ic" @click="editorOpen = false"><Icon icon="lucide:x" /></button>
        </header>
        <div class="d-body">
          <div class="row2">
            <label class="field"><span>Title <em>*</em></span><input v-model="form.title" @input="onTitleInput" placeholder="Create your first agent" /></label>
            <label class="field"><span>Slug <em>*</em></span><input v-model="form.slug" :disabled="!!form.id" @input="form._slugTouched = true" placeholder="create-your-first-agent" /></label>
          </div>
          <div class="row3">
            <label class="field"><span>Type</span>
              <select v-model="form.type"><option v-for="t in meta.types" :key="t.value" :value="t.value">{{ t.label }}</option></select>
            </label>
            <label class="field"><span>Status</span>
              <select v-model="form.status"><option v-for="s in meta.statuses" :key="s.value" :value="s.value">{{ s.label }}</option></select>
            </label>
            <label class="field"><span>Visibility</span>
              <select v-model="form.visibility"><option v-for="v in meta.visibilities" :key="v.value" :value="v.value">{{ v.label }}</option></select>
            </label>
          </div>
          <div class="row3">
            <label class="field"><span>Product area</span>
              <input v-model="form.product_area" list="hc-areas" placeholder="Agents" />
              <datalist id="hc-areas"><option v-for="a in meta.product_areas" :key="a" :value="a" /></datalist>
            </label>
            <label class="field"><span>Difficulty</span>
              <select v-model="form.difficulty"><option value="">—</option><option v-for="d in meta.difficulties" :key="d.value" :value="d.value">{{ d.label }}</option></select>
            </label>
            <label class="field"><span>Read time (min)</span><input v-model.number="form.estimated_read_time" type="number" min="0" placeholder="0 = auto" /></label>
          </div>
          <label class="field"><span>Summary</span><input v-model="form.summary" placeholder="One-line description shown in cards/search." /></label>
          <div class="row2">
            <label class="field"><span>Tags (comma-separated)</span><input v-model="tagsText" placeholder="agent, create" /></label>
            <label class="field"><span>Search keywords</span><input v-model="keywordsText" placeholder="assistant, bot, setup" /></label>
          </div>
          <div class="row3">
            <label class="field"><span>Icon</span><input v-model="form.icon" placeholder="lucide:rocket" /></label>
            <label class="field"><span>Tone</span><input v-model="form.tone" placeholder="blue" /></label>
            <label class="field"><span>Sort order</span><input v-model.number="form.sort_order" type="number" placeholder="0" /></label>
          </div>

          <div class="body-head">
            <span>Body (Markdown) — <code>## Heading</code> starts a searchable section</span>
            <button class="mini" @click="showPreview = !showPreview">{{ showPreview ? 'Edit' : 'Preview' }}</button>
          </div>
          <textarea v-if="!showPreview" v-model="form.body" class="body-area" rows="16"
                    placeholder="## Overview&#10;Intro paragraph.&#10;&#10;## Create the agent&#10;Steps…"></textarea>
          <div v-else class="body-preview md" v-html="previewHtml"></div>

          <!-- Related content links (needs a saved article as the source) -->
          <div class="rel-section">
            <div class="body-head"><span>Related content</span></div>
            <p v-if="!form.id" class="rel-hint">Save the article first, then link related / prerequisite / next-step content here.</p>
            <template v-else>
              <div v-if="relations.length" class="rel-list">
                <div v-for="r in relations" :key="r.id" class="rel-row">
                  <span class="rel-type">{{ r.relation_type }}</span>
                  <span class="rel-title">{{ r.target_title }} <small>/{{ r.target_slug }}</small></span>
                  <button class="ic danger" title="Remove" @click="removeRelation(r)"><Icon icon="lucide:x" /></button>
                </div>
              </div>
              <p v-else class="rel-hint">No related content linked yet.</p>
              <div class="rel-add">
                <select v-model="newRel.type"><option v-for="t in relTypes" :key="t.value" :value="t.value">{{ t.label }}</option></select>
                <select v-model="newRel.target"><option value="">Select article…</option><option v-for="c in relOptions" :key="c.id" :value="c.id">{{ c.title }}</option></select>
                <button class="btn ghost sm" :disabled="!newRel.target" @click="addRelation">Add link</button>
              </div>
            </template>
          </div>

          <div v-if="formError" class="form-error">{{ formError }}</div>
        </div>
        <footer class="d-foot">
          <button class="btn ghost" @click="editorOpen = false">Cancel</button>
          <button class="btn primary" @click="save" :disabled="saving || !isValid">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create') }}</button>
        </footer>
      </aside>
    </div>

    <!-- Delete confirm -->
    <div v-if="confirmRow" class="backdrop center" @click.self="confirmRow = null">
      <div class="modal">
        <h2>Delete “{{ confirmRow.title }}”?</h2>
        <p>This removes the article and its indexed sections. This can't be undone.</p>
        <div class="m-actions"><button class="btn ghost" @click="confirmRow = null">Cancel</button><button class="btn danger" @click="remove">Delete</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, inject } from 'vue'
import { Icon } from '@iconify/vue'
import { marked } from 'marked'
import api from '../../services/api'

const notify = inject('notify', (m) => console.log(m))

const rows = ref([])
const loading = ref(true)
const error = ref(false)
const meta = reactive({ types: [], statuses: [], visibilities: [], difficulties: [], product_areas: [] })
const filters = reactive({ q: '', type: '', product_area: '', status: '' })

const editorOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const showPreview = ref(false)
const form = reactive({})
const tagsText = ref('')
const keywordsText = ref('')

const confirmRow = ref(null)
const embedding = ref(false)
const embedPhase = ref('')
const embedResult = ref(null)

// Related-content links (HelpRelation).
const relations = ref([])
const relTypes = ref([{ value: 'related', label: 'Related' }])
const relOptions = ref([])
const newRel = reactive({ type: 'related', target: '' })

function shortDate(d) { try { return new Date(d).toLocaleDateString() } catch { return '' } }
const previewHtml = computed(() => { try { return marked.parse(form.body || '') } catch { return '' } })
const isValid = computed(() => !!form.title?.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug || ''))

function slugify(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function onTitleInput() { if (!form.id && !form._slugTouched) form.slug = slugify(form.title) }

let _t = null
function debouncedLoad() { clearTimeout(_t); _t = setTimeout(load, 280) }

async function load() {
  loading.value = true; error.value = false
  try {
    const params = {}
    for (const k of ['q', 'type', 'product_area', 'status']) if (filters[k]) params[k] = filters[k]
    const { data } = await api.adminListHelpContent(params)
    rows.value = Array.isArray(data) ? data : (data.results || [])
  } catch (e) { error.value = true }
  loading.value = false
}

async function loadMeta() {
  try { const { data } = await api.adminHelpContentMeta(); Object.assign(meta, data) } catch (e) { /* dropdowns degrade */ }
  try { const { data } = await api.adminRelationTypes(); if (data?.relation_types?.length) relTypes.value = data.relation_types } catch (e) { /* keep default */ }
}

function openCreate() {
  Object.assign(form, {
    id: null, title: '', slug: '', type: 'doc', status: 'draft', visibility: 'public',
    product_area: '', difficulty: '', estimated_read_time: 0, summary: '', body: '',
    icon: '', tone: '', sort_order: 0, _slugTouched: false,
  })
  tagsText.value = ''; keywordsText.value = ''; formError.value = ''; showPreview.value = false; editorOpen.value = true
}
function openEdit(c) {
  Object.assign(form, {
    id: c.id, title: c.title, slug: c.slug, type: c.type, status: c.status, visibility: c.visibility,
    product_area: c.product_area, difficulty: c.difficulty, estimated_read_time: c.estimated_read_time,
    summary: c.summary, body: c.body, icon: c.icon, tone: c.tone, sort_order: c.sort_order,
  })
  tagsText.value = (c.tags || []).join(', '); keywordsText.value = (c.search_keywords || []).join(', ')
  formError.value = ''; showPreview.value = false; editorOpen.value = true
  newRel.target = ''
  loadRelations(); loadRelOptions()
}

async function loadRelations() {
  if (!form.id) { relations.value = []; return }
  try { const { data } = await api.adminListRelations(form.id); relations.value = data.results || data }
  catch (e) { relations.value = [] }
}
async function loadRelOptions() {
  if (!form.id) { relOptions.value = []; return }
  try {
    const { data } = await api.adminListHelpContent({})
    const rows = data.results || data
    relOptions.value = rows.filter(c => c.id !== form.id).map(c => ({ id: c.id, title: c.title }))
  } catch (e) { relOptions.value = [] }
}
async function addRelation() {
  if (!newRel.target) return
  try {
    await api.adminCreateRelation({ source_content: form.id, target_content: newRel.target, relation_type: newRel.type })
    newRel.target = ''; loadRelations()
  } catch (e) { notify(e?.response?.data?.detail || e?.response?.data?.non_field_errors?.[0] || 'Could not add link', 'error') }
}
async function removeRelation(r) {
  try { await api.adminDeleteRelation(r.id); loadRelations() } catch (e) { notify('Could not remove', 'error') }
}

function parseList(s) { return (s || '').split(',').map(x => x.trim()).filter(Boolean) }

async function save() {
  if (!isValid.value) { formError.value = 'A title and a valid slug (lowercase-hyphenated) are required.'; return }
  saving.value = true; formError.value = ''
  const payload = {
    title: form.title, slug: form.slug, type: form.type, status: form.status, visibility: form.visibility,
    product_area: form.product_area, difficulty: form.difficulty, estimated_read_time: form.estimated_read_time || 0,
    summary: form.summary, body: form.body, icon: form.icon, tone: form.tone, sort_order: form.sort_order || 0,
    tags: parseList(tagsText.value), search_keywords: parseList(keywordsText.value),
  }
  try {
    if (form.id) await api.adminUpdateHelpContent(form.id, payload)
    else await api.adminCreateHelpContent(payload)
    notify('Saved', 'success'); editorOpen.value = false; load()
  } catch (e) {
    const d = e?.response?.data
    formError.value = d?.slug?.[0] || d?.non_field_errors?.[0] || (d && typeof d === 'object' ? JSON.stringify(d) : 'Save failed')
  }
  saving.value = false
}

async function togglePublish(c) {
  try { await api.adminPublishHelpContent(c.id, c.status !== 'published'); load() }
  catch (e) { notify('Could not update', 'error') }
}
async function remove() {
  const c = confirmRow.value
  try { await api.adminDeleteHelpContent(c.id); notify('Deleted', 'success'); confirmRow.value = null; load() }
  catch (e) { notify('Delete failed', 'error') }
}

let _pollTimer = null
function stopPolling() { clearTimeout(_pollTimer); _pollTimer = null }

async function pollEmbedStatus() {
  let st
  try { const { data } = await api.adminHelpEmbeddingsStatus(); st = data }
  catch { _pollTimer = setTimeout(pollEmbedStatus, 2000); return }  // transient — keep polling

  if (st.state === 'running' || st.state === 'started') {
    embedPhase.value = st.phase || 'working…'
    _pollTimer = setTimeout(pollEmbedStatus, 1500)
    return
  }
  // terminal
  embedding.value = false; embedPhase.value = ''; stopPolling()
  if (st.state === 'done' && st.stats) {
    embedResult.value = st.stats
    notify(`Help Center KB updated — ${st.stats.embedded} embedded, ${st.stats.chunks} chunks total`, 'success')
    load()
  } else if (st.state === 'error') {
    notify(st.error || 'Embedding failed — configure an embedding provider', 'error')
  }
}

async function generateEmbeddings() {
  embedding.value = true; embedResult.value = null; embedPhase.value = 'queuing…'
  try {
    const { data } = await api.adminGenerateHelpEmbeddings()   // returns 202 { state, task_id }
    embedPhase.value = data.state === 'running' ? 'a job is already running…' : 'queued…'
    stopPolling(); pollEmbedStatus()
  } catch (e) {
    embedding.value = false; embedPhase.value = ''
    notify(e?.response?.data?.detail || 'Could not start embedding — is the worker running?', 'error')
  }
}

onMounted(() => {
  load(); loadMeta()
  // If a job is already running (started elsewhere / page reload), re-attach to it.
  api.adminHelpEmbeddingsStatus().then(({ data }) => {
    if (data && (data.state === 'running' || data.state === 'started')) {
      embedding.value = true; embedPhase.value = data.phase || 'working…'; pollEmbedStatus()
    }
  }).catch(() => {})
})
onBeforeUnmount(stopPolling)
</script>

<style scoped>
.hc { padding: 28px 32px 60px; }
.hc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.hc-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.hc-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 680px; line-height: 1.5; }
.hc-head-actions { display: flex; gap: 10px; flex-shrink: 0; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.primary { background: #4f46e5; color: #fff; } .btn.ghost { background: #fff; border-color: #d8e2f0; color: #334155; } .btn.danger { background: #dc2626; color: #fff; }
.btn:disabled { opacity: .6; cursor: default; } .btn svg { width: 15px; height: 15px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }

.embed-banner { display: flex; align-items: center; gap: 9px; margin-bottom: 16px; padding: 11px 14px; border: 1px solid #bbf7d0; border-radius: 10px; background: #f0fdf4; color: #15803d; font-size: 13px; font-weight: 600; }
.embed-banner svg { width: 18px; height: 18px; } .banner-x { margin-left: auto; border: 0; background: transparent; color: #16a34a; cursor: pointer; } .banner-x svg { width: 16px; height: 16px; }

.hc-filters { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.hc-filters .search { display: flex; align-items: center; gap: 8px; height: 38px; flex: 1; min-width: 220px; border: 1px solid #d8e2f0; border-radius: 9px; background: #fff; padding: 0 12px; }
.hc-filters .search svg { width: 16px; height: 16px; color: #94a3b8; } .hc-filters .search input { flex: 1; border: 0; outline: 0; font-size: 13px; }
.hc-filters select { height: 38px; border: 1px solid #d8e2f0; border-radius: 9px; background: #fff; padding: 0 10px; font-size: 12.5px; font-weight: 600; color: #334155; }

.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.state { padding: 44px; text-align: center; color: #64748b; } .state.err { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 12px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; }
.tbl th.r { text-align: right; }
.tbl td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
.tbl tr:last-child td { border-bottom: 0; }
.sub { color: #94a3b8; font-size: 11.5px; margin-top: 2px; } .muted { color: #94a3b8; }
.kind { border-radius: 6px; padding: 3px 8px; font-size: 10.5px; font-weight: 800; text-transform: capitalize; background: #eef2ff; color: #4f46e5; }
.status { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; }
.status.published { background: #dcfce7; color: #16a34a; } .status.draft { background: #fef9c3; color: #a16207; } .status.archived { background: #f1f5f9; color: #64748b; }
.secs { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; color: #16a34a; } .secs.warn { color: #b45309; } .secs svg { width: 14px; height: 14px; }
.actions { text-align: right; white-space: nowrap; }
.ic { display: inline-grid; place-items: center; width: 32px; height: 32px; border: 0; background: transparent; border-radius: 8px; color: #64748b; cursor: pointer; }
.ic:hover { background: #eef2f7; color: #0f172a; } .ic.danger:hover { background: #fee2e2; color: #dc2626; } .ic svg { width: 16px; height: 16px; }

.backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; justify-content: flex-end; z-index: 60; }
.backdrop.center { align-items: center; justify-content: center; padding: 20px; }
.drawer { width: 620px; max-width: 100%; height: 100vh; background: #fff; display: flex; flex-direction: column; }
.d-head { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #eef2f7; } .d-head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.d-body { flex: 1; overflow-y: auto; padding: 18px 20px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.field { display: block; margin-bottom: 13px; } .field > span { display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; } .field em { color: #dc2626; font-style: normal; }
.field input, .field select, .field textarea { width: 100%; border: 1px solid #d8e2f0; border-radius: 9px; padding: 9px 11px; font-size: 13px; font-family: inherit; }
.field input:focus, .field select:focus, .field textarea:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.field input:disabled { background: #f8fafc; color: #94a3b8; }
.body-head { display: flex; align-items: center; justify-content: space-between; margin: 6px 0 6px; font-size: 12px; font-weight: 700; color: #334155; }
.body-head code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 11px; }
.mini { border: 1px solid #d8e2f0; border-radius: 7px; background: #fff; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #4f46e5; cursor: pointer; }
.body-area { width: 100%; border: 1px solid #d8e2f0; border-radius: 9px; padding: 11px 13px; font-size: 12.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; line-height: 1.6; resize: vertical; }
.body-preview { border: 1px solid #eef2f7; border-radius: 9px; padding: 14px 16px; background: #fbfdff; min-height: 200px; font-size: 13.5px; line-height: 1.6; }
.md :deep(h2) { font-size: 16px; margin: 14px 0 6px; } .md :deep(p) { margin: 8px 0; } .md :deep(code) { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; }
.rel-section { margin-top: 16px; padding-top: 14px; border-top: 1px solid #eef2f7; }
.rel-hint { color: #94a3b8; font-size: 12px; margin: 4px 0 10px; }
.rel-list { display: grid; gap: 7px; margin-bottom: 10px; }
.rel-row { display: flex; align-items: center; gap: 10px; border: 1px solid #eef2f7; border-radius: 9px; padding: 8px 10px; }
.rel-type { border-radius: 6px; padding: 3px 8px; font-size: 10px; font-weight: 850; text-transform: capitalize; background: #eef2ff; color: #4f46e5; flex-shrink: 0; }
.rel-title { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 700; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .rel-title small { color: #94a3b8; font-weight: 500; }
.rel-add { display: flex; gap: 8px; }
.rel-add select { flex: 1; min-width: 0; border: 1px solid #d8e2f0; border-radius: 8px; padding: 8px 9px; font-size: 12.5px; }
.btn.sm { height: 34px; padding: 0 12px; font-size: 12px; }
.form-error { background: #fef2f2; color: #dc2626; border-radius: 9px; padding: 11px 12px; font-size: 12.5px; margin-top: 12px; }
.d-foot { flex-shrink: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #eef2f7; }
.modal { background: #fff; border-radius: 14px; padding: 24px; width: 420px; max-width: 92vw; } .modal h2 { margin: 0 0 8px; font-size: 17px; } .modal p { color: #64748b; font-size: 13px; }
.m-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
@media (max-width: 680px) { .hc { padding: 20px 16px; } .drawer { width: 100%; } .row2, .row3 { grid-template-columns: 1fr; } }
</style>
