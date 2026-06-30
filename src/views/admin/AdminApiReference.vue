<template>
  <div class="ar">
    <!-- Header -->
    <header class="ar-head">
      <div class="ar-head-text">
        <h1>API Reference</h1>
        <p>Curate the developer-facing API docs. Only <strong>enabled</strong> entries with
          <strong>public</strong> or <strong>partner</strong> visibility appear in the public Help Center.</p>
      </div>
      <div class="ar-head-actions">
        <button class="btn ghost" @click="seed" :disabled="seeding">
          <Icon :icon="seeding ? 'lucide:loader-2' : 'lucide:download'" :class="{ spin: seeding }" />
          {{ seeding ? 'Seeding…' : 'Seed defaults' }}
        </button>
        <button class="btn primary" @click="openCreate"><Icon icon="lucide:plus" /> New entry</button>
      </div>
    </header>

    <!-- Filters -->
    <section class="ar-filters card">
      <div class="search">
        <Icon icon="lucide:search" />
        <input v-model="filters.q" placeholder="Search by path or summary…" @input="onSearchInput" />
        <button v-if="filters.q" class="clear-x" @click="filters.q = ''; resetAndLoad()"><Icon icon="lucide:x" /></button>
      </div>
      <select v-model="filters.method" @change="resetAndLoad"><option value="">Any method</option><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select>
      <select v-model="filters.group" @change="resetAndLoad">
        <option value="">All groups</option>
        <option v-for="g in groupOptions" :key="g" :value="g">{{ g }}</option>
      </select>
      <select v-model="filters.visibility" @change="resetAndLoad"><option value="">All visibility</option><option value="public">Public</option><option value="partner">Partner</option><option value="internal">Internal</option><option value="hidden">Hidden</option></select>
      <select v-model="filters.stability" @change="resetAndLoad"><option value="">All stability</option><option value="stable">Stable</option><option value="beta">Beta</option><option value="deprecated">Deprecated</option></select>
      <select v-model="filters.enabled" @change="resetAndLoad"><option value="">Any status</option><option value="true">Published</option><option value="false">Draft</option></select>
      <button v-if="hasFilters" class="btn link-btn" @click="clearFilters"><Icon icon="lucide:filter-x" /> Clear</button>
      <span class="count">{{ count }} endpoint{{ count === 1 ? '' : 's' }} found</span>
    </section>

    <!-- Table card -->
    <section class="card table-card">
      <div class="table-scroll">
        <table class="ar-table">
          <thead>
            <tr>
              <th class="c-method">Method</th>
              <th class="c-ep">Endpoint</th>
              <th>Group</th>
              <th>Visibility</th>
              <th>Stability</th>
              <th>Status</th>
              <th>Updated</th>
              <th class="c-actions">Actions</th>
            </tr>
          </thead>

          <!-- Loading skeleton -->
          <tbody v-if="loading">
            <tr v-for="n in pageSize > 10 ? 8 : pageSize" :key="'s' + n" class="skeleton-row">
              <td v-for="c in 8" :key="c"><span class="skel" /></td>
            </tr>
          </tbody>

          <!-- Rows -->
          <tbody v-else-if="rows.length">
            <tr v-for="r in rows" :key="r.id" class="data-row">
              <td><span :class="['badge method', r.method.toLowerCase()]">{{ r.method }}</span></td>
              <td class="c-ep">
                <code class="path" :title="r.path">{{ r.path }}</code>
                <div class="sub" :title="r.docs_summary">{{ r.docs_summary || '—' }}</div>
              </td>
              <td class="muted">{{ r.docs_group }}</td>
              <td><span :class="['badge vis', r.docs_visibility]">{{ r.docs_visibility }}</span></td>
              <td><span :class="['badge stab', r.docs_stability]">{{ r.docs_stability }}</span></td>
              <td><span :class="['badge status', r.docs_enabled ? 'on' : 'off']"><i /> {{ r.docs_enabled ? 'Published' : 'Draft' }}</span></td>
              <td class="muted nowrap">{{ shortDate(r.updated_at) }}</td>
              <td class="c-actions">
                <div class="actions">
                  <button class="icon-btn" title="Edit" @click="openEdit(r)"><Icon icon="lucide:pencil" /></button>
                  <button class="icon-btn" title="Preview" @click="preview(r)"><Icon icon="lucide:eye" /></button>
                  <button class="icon-btn" :title="r.docs_enabled ? 'Unpublish' : 'Publish'" @click="toggleEnabled(r)">
                    <Icon :icon="r.docs_enabled ? 'lucide:eye-off' : 'lucide:upload'" />
                  </button>
                  <button class="icon-btn danger" title="Delete" @click="confirmRow = r"><Icon icon="lucide:trash-2" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Error -->
      <div v-if="!loading && error" class="state error">
        <Icon icon="lucide:alert-triangle" />
        <p>Couldn’t load API docs.</p>
        <button class="btn ghost" @click="load"><Icon icon="lucide:refresh-cw" /> Retry</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!loading && !rows.length" class="state empty">
        <Icon icon="lucide:file-search" />
        <p>No API docs found.</p>
        <div class="state-actions">
          <button v-if="hasFilters" class="btn ghost" @click="clearFilters">Clear filters</button>
          <button class="btn primary" @click="openCreate"><Icon icon="lucide:plus" /> New entry</button>
        </div>
      </div>

      <!-- Pagination footer -->
      <footer v-if="!loading && rows.length" class="ar-pager">
        <span class="showing">Showing <strong>{{ rangeStart }}–{{ rangeEnd }}</strong> of <strong>{{ count }}</strong></span>
        <div class="pager-right">
          <label class="page-size">
            Rows
            <select v-model.number="pageSize" @change="onPageSizeChange">
              <option :value="10">10</option><option :value="25">25</option><option :value="50">50</option><option :value="100">100</option>
            </select>
          </label>
          <div class="pager-nav">
            <button class="icon-btn" :disabled="page <= 1" @click="goPage(page - 1)"><Icon icon="lucide:chevron-left" /></button>
            <span class="page-of">Page {{ page }} of {{ totalPages }}</span>
            <button class="icon-btn" :disabled="page >= totalPages" @click="goPage(page + 1)"><Icon icon="lucide:chevron-right" /></button>
          </div>
        </div>
      </footer>
    </section>

    <!-- Editor drawer -->
    <transition name="drawer">
      <div v-if="editorOpen" class="backdrop" @click.self="closeEditor">
        <aside class="drawer">
          <header class="drawer-head">
            <div>
              <h2>{{ form.id ? 'Edit endpoint' : 'New endpoint' }}</h2>
              <small v-if="form.id">{{ form.method }} {{ form.path }}</small>
            </div>
            <button class="icon-btn" @click="closeEditor"><Icon icon="lucide:x" /></button>
          </header>

          <div class="drawer-body">
            <section class="form-section">
              <h3>Endpoint</h3>
              <div class="grid2">
                <label class="field"><span>Method <em>*</em></span>
                  <select v-model="form.method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select>
                </label>
                <label class="field"><span>Sort order</span><input type="number" v-model.number="form.docs_sort_order" /></label>
              </div>
              <label class="field"><span>Path <em>*</em></span><input v-model="form.path" placeholder="/api/agents/{id}/" /></label>
              <label class="field"><span>View name (optional)</span><input v-model="form.view_name" placeholder="AgentProfileViewSet" /></label>
            </section>

            <section class="form-section">
              <h3>Publishing</h3>
              <div class="toggles">
                <label class="switch"><input type="checkbox" v-model="form.docs_enabled" /><span>Enabled (published)</span></label>
                <label class="switch"><input type="checkbox" v-model="form.docs_auth_required" /><span>Requires authentication</span></label>
              </div>
              <div class="grid2">
                <label class="field"><span>Visibility <em>*</em></span>
                  <select v-model="form.docs_visibility"><option value="public">Public</option><option value="partner">Partner</option><option value="internal">Internal</option><option value="hidden">Hidden</option></select>
                </label>
                <label class="field"><span>Stability <em>*</em></span>
                  <select v-model="form.docs_stability"><option value="stable">Stable</option><option value="beta">Beta</option><option value="deprecated">Deprecated</option></select>
                </label>
              </div>
              <label class="field"><span>Group <em>*</em></span><input v-model="form.docs_group" placeholder="Agents" /></label>
            </section>

            <section class="form-section">
              <h3>Documentation</h3>
              <label class="field"><span>Summary</span><input v-model="form.docs_summary" placeholder="List agents" /></label>
              <label class="field"><span>Description</span><textarea v-model="form.docs_description" rows="3" placeholder="What this endpoint does…"></textarea></label>
              <label class="field">
                <span class="examples-label">Examples (JSON)
                  <em v-if="examplesError" class="json-bad"><Icon icon="lucide:x-circle" /> {{ examplesError }}</em>
                  <em v-else class="json-ok"><Icon icon="lucide:check-circle" /> valid</em>
                </span>
                <textarea v-model="examplesText" rows="7" spellcheck="false" class="mono" :class="{ invalid: examplesError }"
                          placeholder='{ "request": {...}, "response": {...} }'></textarea>
              </label>
            </section>

            <section class="form-section">
              <h3>Preview &amp; AI</h3>
              <div class="ai-row">
                <button class="btn ghost" @click="preview(form)"><Icon icon="lucide:eye" /> Preview</button>
                <button class="btn ai" @click="generateDraft" :disabled="!form.id || drafting">
                  <Icon :icon="drafting ? 'lucide:loader-2' : 'lucide:sparkles'" :class="{ spin: drafting }" />
                  {{ drafting ? 'Drafting…' : 'Generate AI draft' }}
                </button>
              </div>
              <small v-if="!form.id" class="hint">Save the entry first to enable AI drafting.</small>
              <small class="hint">AI drafts text only — it never publishes or changes visibility.</small>
            </section>

            <div v-if="formError" class="form-error"><Icon icon="lucide:alert-circle" /> {{ formError }}</div>
          </div>

          <footer class="drawer-foot">
            <button class="btn ghost" @click="closeEditor">Cancel</button>
            <button class="btn primary" @click="save" :disabled="saving || !!examplesError">
              <Icon v-if="saving" icon="lucide:loader-2" class="spin" />
              {{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create entry') }}
            </button>
          </footer>
        </aside>
      </div>
    </transition>

    <!-- Preview modal -->
    <div v-if="previewData" class="modal-backdrop" @click.self="previewData = null">
      <div class="modal">
        <header class="modal-head"><h2>Public preview</h2><button class="icon-btn" @click="previewData = null"><Icon icon="lucide:x" /></button></header>
        <div class="preview-body">
          <div class="pv-row">
            <span :class="['badge method', previewData.method.toLowerCase()]">{{ previewData.method }}</span>
            <code class="path">{{ previewData.path }}</code>
          </div>
          <div class="pv-badges">
            <span :class="['badge stab', previewData.stability]">{{ previewData.stability }}</span>
            <span :class="['badge vis', previewData.visibility]">{{ previewData.visibility }}</span>
            <span class="badge auth">{{ previewData.auth_required ? '🔒 Requires auth' : '🌐 Public' }}</span>
          </div>
          <h3 class="pv-summary">{{ previewData.summary }}</h3>
          <p v-if="previewData.description" class="pv-desc">{{ previewData.description }}</p>
          <div v-if="previewData.parameters?.length" class="pv-block">
            <h4>Parameters</h4>
            <ul><li v-for="p in previewData.parameters" :key="p.name"><code>{{ p.name }}</code> <em>{{ p.in }}</em> <span v-if="p.required" class="req">required</span> <span class="pd">{{ p.description }}</span></li></ul>
          </div>
          <div v-if="previewData.request_example" class="pv-block"><h4>Request body</h4><pre>{{ pretty(previewData.request_example) }}</pre></div>
          <div v-if="previewData.response_example" class="pv-block"><h4>Response</h4><pre>{{ pretty(previewData.response_example) }}</pre></div>
          <div v-if="previewData.responses?.length" class="pv-block"><h4>Status codes</h4><span v-for="c in previewData.responses" :key="c" class="code">{{ c }}</span></div>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="confirmRow" class="modal-backdrop" @click.self="confirmRow = null">
      <div class="modal small">
        <div class="danger-ico"><Icon icon="lucide:trash-2" /></div>
        <h2>Delete this entry?</h2>
        <p><code>{{ confirmRow.method }} {{ confirmRow.path }}</code> will be removed from the API reference. This cannot be undone.</p>
        <div class="confirm-actions">
          <button class="btn ghost" @click="confirmRow = null">Cancel</button>
          <button class="btn danger" @click="remove" :disabled="deleting">{{ deleting ? 'Deleting…' : 'Delete entry' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'

const notify = inject('notify', (m) => console.log(m))

const rows = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(25)
const totalPages = ref(1)
const loading = ref(true)
const error = ref(false)
const seeding = ref(false)
const groupOptions = ref([])

const filters = reactive({ q: '', method: '', group: '', visibility: '', stability: '', enabled: '' })
const hasFilters = computed(() => Object.values(filters).some(Boolean))

const editorOpen = ref(false)
const saving = ref(false)
const drafting = ref(false)
const deleting = ref(false)
const formError = ref('')
const form = reactive({})
const examplesText = ref('{}')
const previewData = ref(null)
const confirmRow = ref(null)

const rangeStart = computed(() => (count.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
const rangeEnd = computed(() => Math.min(page.value * pageSize.value, count.value))

const examplesError = computed(() => {
  const t = examplesText.value.trim()
  if (!t) return ''
  try { const v = JSON.parse(t); if (typeof v !== 'object' || Array.isArray(v)) return 'Must be a JSON object'; return '' }
  catch { return 'Invalid JSON' }
})

function pretty(v) { try { return JSON.stringify(v, null, 2) } catch { return String(v) } }
function shortDate(d) { try { return new Date(d).toLocaleDateString() } catch { return '' } }

let _t = null
function onSearchInput() { clearTimeout(_t); _t = setTimeout(resetAndLoad, 300) }
function resetAndLoad() { page.value = 1; load() }

async function load() {
  loading.value = true; error.value = false
  try {
    const params = { page: page.value, page_size: pageSize.value }
    for (const k of ['q', 'method', 'group', 'visibility', 'stability', 'enabled']) if (filters[k]) params[k] = filters[k]
    const { data } = await api.adminListApiEndpoints(params)
    if (Array.isArray(data)) {
      rows.value = data; count.value = data.length; totalPages.value = 1; page.value = 1
    } else {
      rows.value = data.results || []
      count.value = data.count ?? rows.value.length
      totalPages.value = data.total_pages || 1
      if (data.page) page.value = data.page
    }
  } catch (e) { error.value = true; rows.value = [] }
  loading.value = false
}

async function loadGroups() {
  try {
    const { data } = await api.adminListApiEndpoints({ page_size: 100 })
    const list = Array.isArray(data) ? data : (data.results || [])
    groupOptions.value = [...new Set(list.map(r => r.docs_group).filter(Boolean))].sort()
  } catch (e) { /* optional */ }
}

function goPage(p) { if (p >= 1 && p <= totalPages.value) { page.value = p; load() } }
function onPageSizeChange() { page.value = 1; load() }
function clearFilters() { Object.keys(filters).forEach(k => { filters[k] = '' }); resetAndLoad() }

function blankForm() {
  return { id: null, method: 'GET', path: '', view_name: '', docs_enabled: true, docs_group: '',
    docs_visibility: 'public', docs_stability: 'stable', docs_summary: '', docs_description: '',
    docs_auth_required: true, docs_sort_order: 0 }
}
function openCreate() { Object.assign(form, blankForm()); examplesText.value = '{}'; formError.value = ''; editorOpen.value = true }
function openEdit(r) { Object.assign(form, { ...r }); examplesText.value = pretty(r.docs_examples || {}); formError.value = ''; editorOpen.value = true }
function closeEditor() { editorOpen.value = false }

function validate() {
  if (!form.method) return 'Method is required.'
  if (!form.path || !form.path.trim()) return 'Path is required.'
  if (!form.docs_group || !form.docs_group.trim()) return 'Group is required.'
  if (!form.docs_visibility) return 'Visibility is required.'
  if (!form.docs_stability) return 'Stability is required.'
  if (examplesError.value) return 'Fix the Examples JSON before saving.'
  return ''
}

async function save() {
  const err = validate(); if (err) { formError.value = err; return }
  saving.value = true; formError.value = ''
  const payload = { ...form, docs_examples: examplesText.value.trim() ? JSON.parse(examplesText.value) : {} }
  delete payload.id; delete payload.updated_at
  try {
    if (form.id) await api.adminUpdateApiEndpoint(form.id, payload)
    else await api.adminCreateApiEndpoint(payload)
    notify('Saved', 'success'); editorOpen.value = false; loadGroups(); load()
  } catch (e) {
    const d = e?.response?.data
    formError.value = d?.non_field_errors?.[0] || (d && typeof d === 'object' ? Object.values(d).flat()[0] : 'Save failed')
  }
  saving.value = false
}

async function toggleEnabled(r) {
  try { await api.adminUpdateApiEndpoint(r.id, { docs_enabled: !r.docs_enabled }); load() }
  catch (e) { notify('Could not update', 'error') }
}

async function remove() {
  const r = confirmRow.value; if (!r) return
  deleting.value = true
  try { await api.adminDeleteApiEndpoint(r.id); notify('Deleted', 'success'); confirmRow.value = null; loadGroups(); load() }
  catch (e) { notify('Delete failed', 'error') }
  deleting.value = false
}

async function preview(source) {
  try {
    let data
    if (source && source.id) ({ data } = await api.adminPreviewApiEndpoint(source.id))
    else {
      const err = validate(); if (err) { formError.value = err; return }
      ({ data } = await api.adminPreviewApiEndpointData({ ...source, docs_examples: examplesText.value.trim() ? JSON.parse(examplesText.value) : {} }))
    }
    previewData.value = data.entry
  } catch (e) { notify('Preview failed', 'error') }
}

async function generateDraft() {
  if (!form.id) return
  drafting.value = true
  try {
    const { data } = await api.adminGenerateApiDraft(form.id)
    const d = data.draft || {}
    if (d.docs_summary) form.docs_summary = d.docs_summary
    if (d.docs_description) form.docs_description = d.docs_description
    if (d.docs_examples) examplesText.value = pretty(d.docs_examples)
    notify('AI draft inserted — review and Save to apply.', 'info')
  } catch (e) { notify('Could not generate draft', 'error') }
  drafting.value = false
}

async function seed() {
  seeding.value = true
  try { const { data } = await api.adminSeedApiEndpoints(); notify(`Seeded (${data.seeded} entries)`, 'success'); loadGroups(); load() }
  catch (e) { notify('Seed failed', 'error') }
  seeding.value = false
}

onMounted(() => { load(); loadGroups() })
</script>

<style scoped>
.ar { min-height: 100%; padding: 26px 30px 60px; }
.ar-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.ar-head-text h1 { margin: 0; font-size: 22px; font-weight: 800; }
.ar-head-text p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 640px; line-height: 1.5; }
.ar-head-actions { display: flex; gap: 10px; flex-shrink: 0; }
.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; white-space: nowrap; }
.btn svg { width: 15px; height: 15px; }
.btn.primary { background: #4f46e5; color: #fff; }
.btn.primary:hover { background: #4338ca; }
.btn.ghost { background: #fff; border-color: #d8e2f0; color: #334155; }
.btn.ghost:hover { background: #f8fafc; }
.btn.danger { background: #dc2626; color: #fff; }
.btn.ai { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
.btn.link-btn { background: transparent; color: #4f46e5; height: 34px; padding: 0 8px; }
.btn:disabled { opacity: .6; cursor: default; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
/* Filters */
.ar-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 14px; margin-bottom: 16px; }
.ar-filters select { height: 38px; border: 1px solid #d8e2f0; border-radius: 9px; padding: 0 10px; font-size: 13px; background: #fff; color: #334155; }
.search { position: relative; display: flex; align-items: center; flex: 1; min-width: 240px; }
.search > svg { position: absolute; left: 12px; width: 16px; height: 16px; color: #94a3b8; }
.search input { width: 100%; height: 38px; border: 1px solid #d8e2f0; border-radius: 9px; padding: 0 34px; font-size: 13px; }
.clear-x { position: absolute; right: 8px; border: 0; background: transparent; color: #94a3b8; cursor: pointer; display: grid; place-items: center; }
.clear-x svg { width: 15px; height: 15px; }
.count { margin-left: auto; color: #64748b; font-size: 12.5px; font-weight: 600; }
/* Table */
.table-card { overflow: hidden; }
.table-scroll { overflow-x: auto; }
.ar-table { width: 100%; border-collapse: collapse; min-width: 920px; }
.ar-table thead th { position: sticky; top: 0; z-index: 1; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #eef2f7; white-space: nowrap; }
.ar-table td { padding: 13px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
.data-row:hover { background: #f8fbff; }
.data-row:last-child td { border-bottom: 0; }
.c-method { width: 84px; } .c-actions { width: 150px; text-align: right; }
.c-ep { max-width: 360px; }
.path { font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; font-weight: 600; color: #0f172a; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { color: #94a3b8; font-size: 11.5px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: #64748b; } .nowrap { white-space: nowrap; }
.badge { display: inline-flex; align-items: center; gap: 5px; border-radius: 6px; padding: 3px 8px; font-size: 10.5px; font-weight: 800; text-transform: capitalize; }
.badge.method { min-width: 48px; justify-content: center; }
.method.get { background: #dcfce7; color: #16a34a; } .method.post { background: #eaf1ff; color: #2563eb; }
.method.put, .method.patch { background: #fff5d9; color: #b7791f; } .method.delete { background: #fee2e2; color: #dc2626; }
.vis.public { background: #dff8ef; color: #059669; } .vis.partner { background: #eef4ff; color: #2563eb; }
.vis.internal { background: #fff7e6; color: #d97706; } .vis.hidden { background: #f1f5f9; color: #64748b; }
.stab.stable { background: #dff8ef; color: #059669; } .stab.beta { background: #eef4ff; color: #2563eb; } .stab.deprecated { background: #fff1f3; color: #e11d48; }
.status { } .status i { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.status.on { background: #dcfce7; color: #16a34a; } .status.on i { background: #16a34a; }
.status.off { background: #f1f5f9; color: #64748b; } .status.off i { background: #94a3b8; }
.actions { display: inline-flex; gap: 2px; }
.icon-btn { display: grid; place-items: center; width: 32px; height: 32px; border: 0; background: transparent; border-radius: 8px; color: #64748b; cursor: pointer; }
.icon-btn:hover { background: #eef2f7; color: #0f172a; }
.icon-btn.danger:hover { background: #fee2e2; color: #dc2626; }
.icon-btn:disabled { opacity: .4; cursor: default; }
.icon-btn svg { width: 16px; height: 16px; }
/* Skeleton */
.skeleton-row td { padding: 14px 16px; }
.skel { display: block; height: 14px; border-radius: 6px; background: linear-gradient(90deg, #eef2f7, #f8fafc, #eef2f7); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
/* States */
.state { display: grid; place-items: center; gap: 12px; padding: 56px 20px; text-align: center; color: #64748b; }
.state svg { width: 34px; height: 34px; color: #cbd5e1; }
.state p { margin: 0; font-size: 14px; }
.state-actions { display: flex; gap: 10px; }
.state.error svg { color: #f59e0b; }
/* Pager */
.ar-pager { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 16px; border-top: 1px solid #eef2f7; flex-wrap: wrap; }
.showing { color: #64748b; font-size: 12.5px; }
.pager-right { display: flex; align-items: center; gap: 18px; }
.page-size { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 12.5px; }
.page-size select { height: 32px; border: 1px solid #d8e2f0; border-radius: 8px; padding: 0 8px; font-size: 12.5px; }
.pager-nav { display: flex; align-items: center; gap: 8px; }
.page-of { color: #334155; font-size: 12.5px; font-weight: 600; }
/* Drawer */
.backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; justify-content: flex-end; z-index: 60; }
.drawer { width: 720px; max-width: 100%; height: 100vh; background: #fff; display: flex; flex-direction: column; box-shadow: -12px 0 40px rgba(15,23,42,.18); }
.drawer-head { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #eef2f7; }
.drawer-head h2 { margin: 0; font-size: 17px; font-weight: 800; }
.drawer-head small { color: #94a3b8; font-size: 12px; font-family: ui-monospace, Menlo, monospace; }
.drawer-body { flex: 1; overflow-y: auto; padding: 8px 22px 22px; }
.form-section { padding: 16px 0; border-bottom: 1px solid #f1f5f9; }
.form-section:last-of-type { border-bottom: 0; }
.form-section h3 { margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; font-weight: 800; }
.field { display: block; margin-bottom: 12px; }
.field > span { display: block; font-size: 12.5px; font-weight: 700; color: #334155; margin-bottom: 6px; }
.field em { color: #dc2626; font-style: normal; }
.field input, .field select, .field textarea { width: 100%; border: 1px solid #d8e2f0; border-radius: 9px; padding: 9px 11px; font-size: 13px; font-family: inherit; color: #0f172a; }
.field input:focus, .field select:focus, .field textarea:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.field textarea.mono { font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; }
textarea.invalid { border-color: #dc2626; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.toggles { display: flex; flex-wrap: wrap; gap: 18px; margin-bottom: 12px; }
.switch { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; font-weight: 600; cursor: pointer; }
.switch input { width: 16px; height: 16px; }
.examples-label { display: flex; align-items: center; justify-content: space-between; }
.json-bad { display: inline-flex; align-items: center; gap: 4px; color: #dc2626; font-size: 11.5px; }
.json-ok { display: inline-flex; align-items: center; gap: 4px; color: #16a34a; font-size: 11.5px; font-weight: 600; }
.json-bad svg, .json-ok svg { width: 13px; height: 13px; }
.ai-row { display: flex; gap: 10px; }
.hint { display: block; color: #94a3b8; font-size: 11.5px; margin-top: 8px; }
.form-error { display: flex; align-items: center; gap: 8px; background: #fef2f2; color: #dc2626; border-radius: 9px; padding: 11px 12px; font-size: 12.5px; margin-top: 14px; }
.form-error svg { width: 16px; height: 16px; }
.drawer-foot { flex-shrink: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid #eef2f7; background: #fff; position: sticky; bottom: 0; }
.drawer-enter-active, .drawer-leave-active { transition: opacity .2s ease; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: transform .22s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(100%); }
/* Modals */
.modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 70; padding: 20px; }
.modal { background: #fff; border-radius: 16px; width: 600px; max-width: 100%; max-height: 86vh; overflow: auto; }
.modal.small { width: 440px; padding: 26px; text-align: center; }
.modal-head { position: sticky; top: 0; background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #eef2f7; }
.modal-head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.danger-ico { display: grid; place-items: center; width: 48px; height: 48px; margin: 0 auto 14px; border-radius: 50%; background: #fee2e2; color: #dc2626; }
.danger-ico svg { width: 22px; height: 22px; }
.modal.small h2 { margin: 0 0 8px; font-size: 17px; }
.modal.small p { color: #64748b; font-size: 13px; line-height: 1.5; }
.modal.small code { background: #f1f5f9; padding: 1px 6px; border-radius: 5px; }
.confirm-actions { display: flex; justify-content: center; gap: 10px; margin-top: 20px; }
.preview-body { padding: 20px 22px; }
.pv-row { display: flex; align-items: center; gap: 10px; }
.pv-badges { display: flex; gap: 8px; margin-top: 12px; }
.pv-summary { margin: 16px 0 0; font-size: 17px; font-weight: 800; }
.pv-desc { color: #475569; font-size: 13px; line-height: 1.6; margin: 8px 0 0; }
.pv-block { margin-top: 18px; }
.pv-block h4 { margin: 0 0 7px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
.pv-block ul { margin: 0; padding-left: 16px; font-size: 13px; display: grid; gap: 5px; }
.pv-block code { background: #f1f5f9; padding: 1px 6px; border-radius: 5px; font-size: 12px; }
.pv-block pre { background: #0f172a; color: #e2e8f0; border-radius: 10px; padding: 14px 16px; font-size: 12px; overflow: auto; margin: 0; }
.badge.auth { background: #f1f5f9; color: #475569; }
.req { color: #dc2626; font-size: 10.5px; font-weight: 800; }
.pd { color: #64748b; }
.code { display: inline-block; margin-right: 6px; background: #f1f5f9; border-radius: 6px; padding: 3px 9px; font-size: 11.5px; font-weight: 800; }
/* Responsive */
@media (max-width: 860px) {
  .ar { padding: 20px 16px 50px; }
  .grid2 { grid-template-columns: 1fr; }
  .drawer { width: 100%; }
  .count { width: 100%; margin-left: 0; }
}
</style>
