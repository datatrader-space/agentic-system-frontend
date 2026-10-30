<template>
  <div class="bs admin-page">
    <header class="bs-head admin-page-header">
      <div>
        <h1 class="admin-page-title">Built-in Skills</h1>
        <p>Curated playbooks every user can assign to their agents — read-only outside this page, and
          <strong>auto-assigned to the Platform Super Agent</strong> so it can load any of them on demand.
          User-authored skills are separate: private to their owner, never listed here.</p>
      </div>
      <button class="btn primary" @click="openCreate"><Icon icon="lucide:plus" /> New built-in skill</button>
    </header>

    <!-- Create / edit -->
    <section v-if="showForm" class="card form admin-surface">
      <h2 class="admin-section-title">{{ editing ? `Edit “${editing.name}”` : 'New built-in skill' }}</h2>
      <div v-if="!editing" class="tabs admin-tabs">
        <button :class="{ on: mode === 'fields' }" @click="mode = 'fields'">Fields</button>
        <button :class="{ on: mode === 'paste' }" @click="mode = 'paste'">Paste SKILL.md</button>
        <button :class="{ on: mode === 'import' }" @click="mode = 'import'">Import bundle</button>
      </div>
      <div v-if="mode === 'paste' && !editing" class="grid">
        <textarea aria-label="Paste a full SKILL.md (--- YAML frontmatter --- then the body)" v-model="skillMd" rows="8"
                  placeholder="Paste a full SKILL.md (--- YAML frontmatter --- then the body)"></textarea>
      </div>
      <div v-else-if="mode === 'import' && !editing" class="grid">
        <input aria-label="Https://github.com/owner/repo (public repo with SKILL.md at root)" v-model="importUrl" placeholder="https://github.com/owner/repo (public repo with SKILL.md at root)" />
        <input aria-label="Choose a file" ref="zipEl" type="file" accept=".zip" />
        <p class="hint admin-muted">Imported bundles arrive <strong>untrusted</strong> — bundled scripts stay locked until
          you mark the skill trusted.</p>
      </div>
      <!-- Editing: the form is filled from the skill's detail (the list carries no body). -->
      <div v-else-if="editing && editLoading" class="state">Loading the skill…</div>
      <div v-else-if="editing && editError" class="state err" role="alert">
        {{ editError }} <button class="link" @click="openEdit(editing)">Retry</button>
      </div>
      <div v-else class="grid">
        <input aria-label="Skill name" v-model="draft.name" placeholder="Skill name" />
        <input aria-label="One-line summary (what the skill is for)" v-model="draft.description" placeholder="One-line summary (what the skill is for)" />
        <textarea aria-label="Full instructions (Markdown)" v-model="draft.body" rows="6" placeholder="Full instructions (Markdown)"></textarea>
      </div>
      <div class="f-actions">
        <button class="btn primary" :disabled="saving || !canSave" @click="save">
          {{ saving ? 'Saving…' : (editing ? 'Save changes' : (mode === 'import' ? 'Install as built-in' : 'Create built-in')) }}
        </button>
        <button class="btn ghost" @click="closeForm">Cancel</button>
      </div>
    </section>

    <section class="card admin-surface">
      <div class="toolbar admin-toolbar">
        <input aria-label="Search" v-model="query" class="search" placeholder="Search built-in skills…" />
        <span class="count">{{ filtered.length }} of {{ rows.length }}</span>
      </div>
      <div v-if="loading" class="state">Loading…</div>
      <div v-else-if="error" class="state err">Couldn’t load. <button class="link" @click="load">Retry</button></div>
      <div v-else-if="!rows.length" class="state">No built-in skills yet. <button class="link" @click="openCreate">Create one</button>.</div>
      <div class="admin-table-scroll" v-else><table  class="tbl admin-table">
        <thead><tr><th>Skill</th><th>Category</th><th>Bundle</th><th>Trust</th><th>Updated</th><th class="r">Actions</th></tr></thead>
        <tbody>
          <tr v-for="s in paged" :key="s.id">
            <td>
              <strong>{{ s.name }}</strong>
              <div class="sub admin-muted">{{ s.description || '—' }}</div>
              <div v-if="(s.lint || []).length" class="lint" :title="lintText(s)">
                <Icon icon="lucide:triangle-alert" /> {{ s.lint.length }} authoring tip{{ s.lint.length === 1 ? '' : 's' }}
              </div>
            </td>
            <td><span class="cat">{{ s.category || 'general' }}</span></td>
            <td class="muted admin-muted">
              {{ (s.files || []).length }} file{{ (s.files || []).length === 1 ? '' : 's' }}<template
                v-if="scriptCount(s)"> · {{ scriptCount(s) }} script{{ scriptCount(s) === 1 ? '' : 's' }}</template>
            </td>
            <td><span :class="['trust', s.trust_status === 'trusted' ? 'on' : 'off']">{{ s.trust_status }}</span></td>
            <td class="muted admin-muted">{{ shortDate(s.updated_at) }}</td>
            <td class="actions">
              <button class="ic" title="Edit" @click="openEdit(s)"><Icon icon="lucide:pencil" /></button>
              <button class="ic" :title="s.trust_status === 'trusted' ? 'Untrust (locks bundled scripts)' : 'Trust (unlocks bundled scripts)'"
                      @click="toggleTrust(s)">
                <Icon :icon="s.trust_status === 'trusted' ? 'lucide:shield-off' : 'lucide:shield-check'" />
              </button>
              <button class="ic danger" title="Delete" @click="confirmRow = s"><Icon icon="lucide:trash-2" /></button>
            </td>
          </tr>
        </tbody>
      </table></div>
      <div v-if="pageCount > 1" class="pager admin-pagination">
        <button class="btn ghost" :disabled="page === 1" @click="page--">‹ Prev</button>
        <span class="count">page {{ page }} / {{ pageCount }}</span>
        <button class="btn ghost" :disabled="page === pageCount" @click="page++">Next ›</button>
      </div>
    </section>

    <!-- Delete confirm -->
    <div @keydown.esc.stop.prevent="confirmRow = null" v-if="confirmRow" class="backdrop center admin-overlay" @click.self="confirmRow = null">
      <div role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="admin-dialog-adminbuiltinskills-4" class="modal admin-dialog">
        <h2 id="admin-dialog-adminbuiltinskills-4" class="admin-section-title">Delete “{{ confirmRow.name }}”?</h2>
        <p>The skill disappears for every user and agent it was assigned to (including the Super Agent).
          This cannot be undone.</p>
        <div class="m-actions">
          <button class="btn ghost" @click="confirmRow = null">Cancel</button>
          <button class="btn danger" @click="remove">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Admin console for BUILT-IN (system) skills — the ONLY place they are curated. Uses the same
// /api/skills/ endpoints as the user page; every create/install from here carries make_system so the
// backend re-owns the row to the system user and auto-assigns it to the Platform Super Agent.
import { ref, computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'

const rows = ref([])
const loading = ref(true)
const error = ref(false)
const query = ref('')
const confirmRow = ref(null)

const showForm = ref(false)
const saving = ref(false)
const editing = ref(null)          // null = creating
// The list carries no `body` (it is the whole playbook), so editing reads the skill's detail first. Until it
// arrives, or when it failed, the form cannot save: a PATCH must never write an empty body over the real one.
const editLoading = ref(false)
const editError = ref('')
let editSeq = 0                    // only the latest Edit click may fill the form
const mode = ref('fields')         // fields | paste | import
const draft = ref({ name: '', description: '', body: '' })
const skillMd = ref('')
const importUrl = ref('')
const zipEl = ref(null)

const PAGE = 25
const page = ref(1)
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q) ||
    (s.category || '').toLowerCase().includes(q))
})
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE, page.value * PAGE))
watch([query], () => { page.value = 1 })
watch(pageCount, (n) => { if (page.value > n) page.value = n })

const scriptCount = (s) => (s.files || []).filter(f => f.is_script).length
// Authoring warnings from the server (never block a save): a description with no "Use when …" sentence, an
// over-long body. The agent picks a skill by its description alone, so these decide whether it is ever used.
const lintText = (s) => (s.lint || []).map(w => `• ${w.message}`).join('\n')
function warnLint(s) {
  if ((s?.lint || []).length) notify.warning(`${s.name}: ${s.lint[0].message}`, { timeout: 9000 })
}
const shortDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const canSave = computed(() => {
  if (editing.value) return !editLoading.value && !editError.value && !!draft.value.name.trim()
  if (mode.value === 'paste') return !!skillMd.value.trim()
  if (mode.value === 'import') return !!(importUrl.value.trim() || zipEl.value?.files?.length)
  return !!draft.value.name.trim()
})

function pickArray(d) { return Array.isArray(d) ? d : (d?.results ?? []) }

async function load() {
  loading.value = true
  error.value = false
  try {
    // Server-paginated (285+ built-ins) — walk every page, keep only the system rows.
    const all = []
    let p = 1
    for (;;) {
      const { data } = await api.get('/skills/', { params: { page: p, page_size: 100 } })
      all.push(...pickArray(data))
      if (!data?.next) break
      p += 1
    }
    rows.value = all.filter(s => s.visibility === 'system')
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editSeq += 1
  editing.value = null
  editLoading.value = false
  editError.value = ''
  mode.value = 'fields'
  draft.value = { name: '', description: '', body: '' }
  skillMd.value = ''
  importUrl.value = ''
  showForm.value = true
}

async function openEdit(s) {
  const seq = ++editSeq
  editing.value = s
  draft.value = { name: '', description: '', body: '' }
  editError.value = ''
  editLoading.value = true
  showForm.value = true
  try {
    const { data } = await api.get(`/skills/${s.id}/`)
    if (seq !== editSeq) return
    draft.value = { name: data.name || '', description: data.description || '', body: data.body || '' }
  } catch (e) {
    if (seq !== editSeq) return
    editError.value = e?.response?.data?.detail || 'Could not load the skill to edit.'
  } finally {
    if (seq === editSeq) editLoading.value = false
  }
}

function closeForm() {
  editSeq += 1
  showForm.value = false
  editing.value = null
  editLoading.value = false
  editError.value = ''
}

async function save() {
  if (editing.value && (editLoading.value || editError.value)) return
  saving.value = true
  try {
    if (editing.value) {
      const { data } = await api.patch(`/skills/${editing.value.id}/`, {
        name: draft.value.name.trim(), description: draft.value.description.trim(), body: draft.value.body })
      rows.value = rows.value.map(s => s.id === data.id ? data : s)
      notify.success(`Updated ${data.name}`)
      warnLint(data)
    } else if (mode.value === 'import') {
      const file = zipEl.value?.files?.[0]
      let res
      if (file) {
        const fd = new FormData()
        fd.append('zip_file', file)
        fd.append('make_system', 'true')
        res = await api.post('/skills/install/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        res = await api.post('/skills/install/', { git_url: importUrl.value.trim(), make_system: true })
      }
      rows.value = [res.data, ...rows.value]
      notify.success(`Installed built-in ${res.data.name} — mark it trusted to unlock its scripts`)
      warnLint(res.data)
    } else {
      const payload = mode.value === 'paste'
        ? { skill_md: skillMd.value, make_system: true }
        : { name: draft.value.name.trim(), description: draft.value.description.trim(),
            body: draft.value.body, make_system: true }
      const { data } = await api.post('/skills/', payload)
      rows.value = [data, ...rows.value]
      notify.success(`Created built-in ${data.name}`)
      warnLint(data)
    }
    closeForm()
  } catch (e) {
    notify.error(e?.response?.data?.detail || 'Could not save the skill.')
  } finally {
    saving.value = false
  }
}

async function toggleTrust(s) {
  try {
    const { data } = await api.post(`/skills/${s.id}/trust/`, { trusted: s.trust_status !== 'trusted' })
    s.trust_status = data.trust_status
  } catch {
    notify.error('Could not update trust.')
  }
}

async function remove() {
  const s = confirmRow.value
  confirmRow.value = null
  try {
    await api.delete(`/skills/${s.id}/`)
    rows.value = rows.value.filter(x => x.id !== s.id)
    notify.success('Built-in skill deleted')
  } catch {
    notify.error('Could not delete the skill.')
  }
}

onMounted(load)
</script>

<style scoped>
.bs { padding: 28px 32px 60px; }
.bs-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.bs-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.bs-head p { margin: 6px 0 0; color: var(--admin-muted, #64748b); font-size: 13px; max-width: 680px; line-height: 1.5; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.primary { background: #4f46e5; color: #fff; } .btn.ghost { background: var(--admin-surface, #fff); border-color: var(--admin-line, #d8e2f0); color: var(--admin-ink, #334155); } .btn.danger { background: #dc2626; color: #fff; }
.btn:disabled { opacity: .6; } .btn svg { width: 15px; height: 15px; }
.card { background: var(--admin-surface, #fff); border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; }
.card.form { padding: 20px; margin-bottom: 18px; }
.card.form h2 { margin: 0 0 12px; font-size: 15px; }
.tabs { display: inline-flex; gap: 2px; border: 1px solid #e5ebf3; border-radius: 9px; padding: 2px; margin-bottom: 12px; }
.tabs button { border: 0; background: transparent; border-radius: 7px; padding: 6px 12px; font-size: 12px; font-weight: 700; color: var(--admin-muted, #64748b); cursor: pointer; }
.tabs button.on { background: #4f46e5; color: #fff; }
.grid { display: grid; gap: 10px; }
.grid input[type="text"], .grid input:not([type]), .grid textarea {
  border: 1px solid #e5ebf3; border-radius: 9px; padding: 9px 12px; font-size: 13px; font-family: inherit; }
.grid textarea { font-family: ui-monospace, monospace; }
.hint { margin: 0; color: var(--admin-muted, #94a3b8); font-size: 12px; }
.f-actions { display: flex; gap: 10px; margin-top: 14px; }
.toolbar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--admin-line, #eef2f7); background: var(--admin-soft, #f8fafc); }
.search { flex: 1; max-width: 340px; border: 1px solid #e5ebf3; border-radius: 9px; padding: 8px 12px; font-size: 13px; }
.count { color: var(--admin-muted, #94a3b8); font-size: 12px; font-weight: 600; }
.state { padding: 44px; text-align: center; color: var(--admin-muted, #64748b); } .state.err { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: var(--admin-muted, #64748b); padding: 12px 16px; border-bottom: 1px solid var(--admin-line, #eef2f7); background: var(--admin-soft, #f8fafc); }
.tbl th.r { text-align: right; }
.tbl td { padding: 13px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
.tbl tr:last-child td { border-bottom: 0; }
.sub { color: var(--admin-muted, #94a3b8); font-size: 11.5px; margin-top: 3px; max-width: 480px; }
.lint { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 11px; font-weight: 700; color: #b45309; cursor: help; }
.lint svg { width: 12px; height: 12px; }
.muted { color: var(--admin-muted, #94a3b8); }
.cat { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; background: var(--admin-soft, #f1f5f9); color: var(--admin-muted, #64748b); }
.trust { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; }
.trust.on { background: #dcfce7; color: #16a34a; } .trust.off { background: #fef3c7; color: #b45309; }
.actions { text-align: right; white-space: nowrap; }
.ic { display: inline-grid; place-items: center; width: 32px; height: 32px; border: 0; background: transparent; border-radius: 8px; color: var(--admin-muted, #64748b); cursor: pointer; }
.ic:hover { background: #eef2f7; color: var(--admin-ink, #0f172a); } .ic.danger:hover { background: #fee2e2; color: #dc2626; } .ic svg { width: 16px; height: 16px; }
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px; }
.backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; z-index: 60; }
.backdrop.center { align-items: center; justify-content: center; padding: 20px; }
.modal { background: var(--admin-surface, #fff); border-radius: 14px; padding: 24px; width: 420px; max-width: 92vw; } .modal h2 { margin: 0 0 8px; font-size: 17px; } .modal p { color: var(--admin-muted, #64748b); font-size: 13px; }
.m-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
@media (max-width: 680px) { .bs { padding: 20px 16px; } }
</style>
