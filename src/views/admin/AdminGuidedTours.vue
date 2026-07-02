<template>
  <div class="gt">
    <header class="gt-head">
      <div>
        <h1>Guided Tours</h1>
        <p>Create and manage interactive product walkthroughs. Each tour has ordered steps that spotlight
          UI (via a <code>data-tour</code> selector) or show a centered card fallback.</p>
      </div>
      <button class="btn primary" @click="openCreate"><Icon icon="lucide:plus" /> New tour</button>
    </header>

    <div class="gt-filters">
      <div class="search"><Icon icon="lucide:search" /><input v-model="filters.q" placeholder="Search title…" @input="debouncedLoad" /></div>
      <select v-model="filters.status" @change="load"><option value="">All statuses</option><option v-for="s in meta.statuses" :key="s.value" :value="s.value">{{ s.label }}</option></select>
      <select v-model="filters.trigger_context" @change="load"><option value="">All triggers</option><option v-for="t in meta.triggers" :key="t.value" :value="t.value">{{ t.label }}</option></select>
    </div>

    <section class="card">
      <div v-if="loading" class="state">Loading…</div>
      <div v-else-if="error" class="state err">Couldn’t load. <button class="link" @click="load">Retry</button></div>
      <div v-else-if="!rows.length" class="state">No tours yet. <button class="link" @click="openCreate">Create the first tour</button>.</div>
      <table v-else class="tbl">
        <thead><tr><th>Title</th><th>Area</th><th>Trigger</th><th>Status</th><th>Steps</th><th>Updated</th><th class="r">Actions</th></tr></thead>
        <tbody>
          <tr v-for="t in rows" :key="t.id">
            <td><strong>{{ t.title }}</strong><div class="sub">/{{ t.slug }}</div></td>
            <td class="muted">{{ t.product_area || '—' }}</td>
            <td class="muted">{{ t.trigger_context }}</td>
            <td><span :class="['status', t.status]">{{ t.status }}</span></td>
            <td class="muted">{{ t.steps_count }}</td>
            <td class="muted">{{ shortDate(t.updated_at) }}</td>
            <td class="actions">
              <button class="ic" title="Edit" @click="openEdit(t)"><Icon icon="lucide:pencil" /></button>
              <button class="ic" :title="t.status === 'published' ? 'Unpublish' : 'Publish'" @click="togglePublish(t)"><Icon :icon="t.status === 'published' ? 'lucide:eye-off' : 'lucide:eye'" /></button>
              <button class="ic danger" title="Delete" @click="confirmRow = t"><Icon icon="lucide:trash-2" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Editor drawer -->
    <div v-if="editorOpen" class="backdrop" @click.self="editorOpen = false">
      <aside class="drawer">
        <header class="d-head"><h2>{{ form.id ? 'Edit tour' : 'New tour' }}</h2><button class="ic" @click="editorOpen = false"><Icon icon="lucide:x" /></button></header>
        <div class="d-body">
          <div class="row2">
            <label class="field"><span>Title <em>*</em></span><input v-model="form.title" @input="onTitleInput" placeholder="Build your first agent" /></label>
            <label class="field"><span>Slug <em>*</em></span><input v-model="form.slug" :disabled="!!form.id" @input="form._slugTouched = true" placeholder="build-your-first-agent" /></label>
          </div>
          <label class="field"><span>Description</span><input v-model="form.description" placeholder="What this tour teaches." /></label>
          <div class="row3">
            <label class="field"><span>Status</span><select v-model="form.status"><option v-for="s in meta.statuses" :key="s.value" :value="s.value">{{ s.label }}</option></select></label>
            <label class="field"><span>Visibility</span><select v-model="form.visibility"><option v-for="v in meta.visibilities" :key="v.value" :value="v.value">{{ v.label }}</option></select></label>
            <label class="field"><span>Trigger</span><select v-model="form.trigger_context"><option v-for="t in meta.triggers" :key="t.value" :value="t.value">{{ t.label }}</option></select></label>
          </div>
          <div class="row3">
            <label class="field"><span>Product area</span><input v-model="form.product_area" list="gt-areas" placeholder="Agents" /><datalist id="gt-areas"><option v-for="a in meta.product_areas" :key="a" :value="a" /></datalist></label>
            <label class="field"><span>Difficulty</span><select v-model="form.difficulty"><option value="">—</option><option v-for="d in meta.difficulties" :key="d.value" :value="d.value">{{ d.label }}</option></select></label>
            <label class="field"><span>Est. minutes</span><input v-model.number="form.estimated_minutes" type="number" min="1" /></label>
          </div>
          <div class="row3">
            <label class="field"><span>Start route</span><input v-model="form.target_route" placeholder="/dashboard/agents/new" /></label>
            <label class="field"><span>Icon</span><input v-model="form.icon" placeholder="lucide:route" /></label>
            <label class="field"><span>Sort order</span><input v-model.number="form.sort_order" type="number" /></label>
          </div>
          <label class="field"><span>Tags (comma-separated)</span><input v-model="tagsText" placeholder="agents, onboarding" /></label>

          <!-- Steps repeater -->
          <div class="steps-head">
            <span>Steps ({{ form.steps.length }})</span>
            <button class="mini" @click="addStep">＋ Add step</button>
          </div>
          <div v-if="!form.steps.length" class="rel-hint">No steps yet — add at least one.</div>
          <div v-for="(s, i) in form.steps" :key="i" class="step-card">
            <div class="step-top">
              <span class="step-n">{{ i + 1 }}</span>
              <input v-model="s.title" class="step-title" placeholder="Step title" />
              <div class="step-move">
                <button class="ic" title="Up" :disabled="i === 0" @click="moveStep(i, -1)"><Icon icon="lucide:chevron-up" /></button>
                <button class="ic" title="Down" :disabled="i === form.steps.length - 1" @click="moveStep(i, 1)"><Icon icon="lucide:chevron-down" /></button>
                <button class="ic danger" title="Remove" @click="removeStep(i)"><Icon icon="lucide:trash-2" /></button>
              </div>
            </div>
            <textarea v-model="s.body" class="step-body" rows="2" placeholder="Step instructions shown to the user."></textarea>
            <div class="row2">
              <label class="field sm"><span>Navigate to (route)</span><input v-model="s.target_route" placeholder="/dashboard/agents/new" /></label>
              <label class="field sm"><span>Spotlight selector</span><input v-model="s.target_selector" placeholder='[data-tour="new-agent"]' /></label>
            </div>
            <div class="row3">
              <label class="field sm"><span>Placement</span><select v-model="s.placement"><option v-for="p in meta.placements" :key="p.value" :value="p.value">{{ p.label }}</option></select></label>
              <label class="field sm"><span>Action</span><select v-model="s.action_type"><option v-for="a in meta.action_types" :key="a.value" :value="a.value">{{ a.label }}</option></select></label>
              <label class="field sm"><span>Action hint</span><input v-model="s.action_hint" placeholder="Click here" /></label>
            </div>
            <label class="field sm"><span>Fallback text (when selector missing)</span><input v-model="s.fallback_text" placeholder="Centered card message." /></label>
            <div class="step-flags">
              <label><input type="checkbox" v-model="s.skippable" /> Skippable</label>
              <label><input type="checkbox" v-model="s.optional" /> Optional</label>
            </div>
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
        <p>This removes the tour and all its steps. This can't be undone.</p>
        <div class="m-actions"><button class="btn ghost" @click="confirmRow = null">Cancel</button><button class="btn danger" @click="remove">Delete</button></div>
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
const loading = ref(true)
const error = ref(false)
const meta = reactive({ statuses: [], visibilities: [], difficulties: [], triggers: [], placements: [], action_types: [], product_areas: [], content: [] })
const filters = reactive({ q: '', status: '', trigger_context: '' })

const editorOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive({ steps: [] })
const tagsText = ref('')
const confirmRow = ref(null)

function shortDate(d) { try { return new Date(d).toLocaleDateString() } catch { return '' } }
const isValid = computed(() => !!form.title?.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug || '') && form.steps.length > 0)
function slugify(s) { return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function onTitleInput() { if (!form.id && !form._slugTouched) form.slug = slugify(form.title) }

let _t = null
function debouncedLoad() { clearTimeout(_t); _t = setTimeout(load, 280) }

async function load() {
  loading.value = true; error.value = false
  try {
    const params = {}
    for (const k of ['q', 'status', 'trigger_context']) if (filters[k]) params[k] = filters[k]
    const { data } = await api.adminListGuidedTours(params)
    rows.value = Array.isArray(data) ? data : (data.results || [])
  } catch (e) { error.value = true }
  loading.value = false
}
async function loadMeta() {
  try { const { data } = await api.adminGuidedTourMeta(); Object.assign(meta, data) } catch (e) { /* degrade */ }
}

function blankStep() {
  return { title: '', body: '', target_route: '', target_selector: '', placement: 'bottom',
           action_type: 'view', action_hint: '', next_button_label: 'Next', back_button_label: 'Back',
           skippable: true, optional: false, fallback_text: '' }
}
function addStep() { form.steps.push(blankStep()) }
function removeStep(i) { form.steps.splice(i, 1) }
function moveStep(i, d) { const j = i + d; if (j < 0 || j >= form.steps.length) return; const [s] = form.steps.splice(i, 1); form.steps.splice(j, 0, s) }

function openCreate() {
  Object.assign(form, {
    id: null, title: '', slug: '', description: '', product_area: '', difficulty: 'beginner',
    estimated_minutes: 3, status: 'draft', visibility: 'public', target_route: '',
    trigger_context: 'help_center', icon: '', tone: '', sort_order: 0, _slugTouched: false,
    steps: [blankStep()],
  })
  tagsText.value = ''; formError.value = ''; editorOpen.value = true
}
async function openEdit(t) {
  formError.value = ''
  try {
    const { data } = await api.adminGetGuidedTour(t.id)
    Object.assign(form, {
      id: data.id, title: data.title, slug: data.slug, description: data.description,
      product_area: data.product_area, difficulty: data.difficulty, estimated_minutes: data.estimated_minutes,
      status: data.status, visibility: data.visibility, target_route: data.target_route,
      trigger_context: data.trigger_context, icon: data.icon, tone: data.tone, sort_order: data.sort_order,
      steps: (data.steps || []).map(s => ({ ...blankStep(), ...s })),
    })
    tagsText.value = (data.tags || []).join(', ')
    editorOpen.value = true
  } catch (e) { notify('Could not load tour', 'error') }
}

function parseList(s) { return (s || '').split(',').map(x => x.trim()).filter(Boolean) }

async function save() {
  if (!isValid.value) { formError.value = 'Title, a valid slug, and at least one step are required.'; return }
  saving.value = true; formError.value = ''
  const payload = {
    title: form.title, slug: form.slug, description: form.description, product_area: form.product_area,
    difficulty: form.difficulty, estimated_minutes: form.estimated_minutes || 3, status: form.status,
    visibility: form.visibility, target_route: form.target_route, trigger_context: form.trigger_context,
    icon: form.icon, tone: form.tone, sort_order: form.sort_order || 0, tags: parseList(tagsText.value),
    steps: form.steps.map(s => ({
      title: s.title, body: s.body, target_route: s.target_route, target_selector: s.target_selector,
      placement: s.placement, action_type: s.action_type, action_hint: s.action_hint,
      next_button_label: s.next_button_label || 'Next', back_button_label: s.back_button_label || 'Back',
      skippable: !!s.skippable, optional: !!s.optional, fallback_text: s.fallback_text,
    })),
  }
  try {
    if (form.id) await api.adminUpdateGuidedTour(form.id, payload)
    else await api.adminCreateGuidedTour(payload)
    notify('Saved', 'success'); editorOpen.value = false; load()
  } catch (e) {
    const d = e?.response?.data
    formError.value = d?.slug?.[0] || d?.non_field_errors?.[0] || (d && typeof d === 'object' ? JSON.stringify(d) : 'Save failed')
  }
  saving.value = false
}
async function togglePublish(t) { try { await api.adminPublishGuidedTour(t.id, t.status !== 'published'); load() } catch (e) { notify('Could not update', 'error') } }
async function remove() { const t = confirmRow.value; try { await api.adminDeleteGuidedTour(t.id); notify('Deleted', 'success'); confirmRow.value = null; load() } catch (e) { notify('Delete failed', 'error') } }

onMounted(() => { load(); loadMeta() })
</script>

<style scoped>
.gt { padding: 28px 32px 60px; }
.gt-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.gt-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.gt-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 660px; line-height: 1.5; }
.gt-head code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 11.5px; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.primary { background: #4f46e5; color: #fff; } .btn.ghost { background: #fff; border-color: #d8e2f0; color: #334155; } .btn.danger { background: #dc2626; color: #fff; }
.btn:disabled { opacity: .6; cursor: default; } .btn svg { width: 15px; height: 15px; }

.gt-filters { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.gt-filters .search { display: flex; align-items: center; gap: 8px; height: 38px; flex: 1; min-width: 220px; border: 1px solid #d8e2f0; border-radius: 9px; background: #fff; padding: 0 12px; }
.gt-filters .search svg { width: 16px; height: 16px; color: #94a3b8; } .gt-filters .search input { flex: 1; border: 0; outline: 0; font-size: 13px; }
.gt-filters select { height: 38px; border: 1px solid #d8e2f0; border-radius: 9px; background: #fff; padding: 0 10px; font-size: 12.5px; font-weight: 600; color: #334155; }

.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.state { padding: 44px; text-align: center; color: #64748b; } .state.err { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 12px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; }
.tbl th.r { text-align: right; }
.tbl td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
.tbl tr:last-child td { border-bottom: 0; }
.sub { color: #94a3b8; font-size: 11.5px; margin-top: 2px; } .muted { color: #94a3b8; }
.status { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; }
.status.published { background: #dcfce7; color: #16a34a; } .status.draft { background: #fef9c3; color: #a16207; } .status.archived { background: #f1f5f9; color: #64748b; }
.actions { text-align: right; white-space: nowrap; }
.ic { display: inline-grid; place-items: center; width: 30px; height: 30px; border: 0; background: transparent; border-radius: 8px; color: #64748b; cursor: pointer; }
.ic:hover { background: #eef2f7; color: #0f172a; } .ic:disabled { opacity: .35; cursor: default; } .ic.danger:hover { background: #fee2e2; color: #dc2626; } .ic svg { width: 15px; height: 15px; }

.backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; justify-content: flex-end; z-index: 60; }
.backdrop.center { align-items: center; justify-content: center; padding: 20px; }
.drawer { width: 640px; max-width: 100%; height: 100vh; background: #fff; display: flex; flex-direction: column; }
.d-head { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #eef2f7; } .d-head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.d-body { flex: 1; overflow-y: auto; padding: 18px 20px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.field { display: block; margin-bottom: 13px; } .field.sm { margin-bottom: 9px; } .field > span { display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; } .field.sm > span { font-size: 11px; } .field em { color: #dc2626; font-style: normal; }
.field input, .field select, .field textarea { width: 100%; border: 1px solid #d8e2f0; border-radius: 9px; padding: 9px 11px; font-size: 13px; font-family: inherit; }
.field.sm input, .field.sm select { padding: 7px 9px; font-size: 12px; }
.field input:focus, .field select:focus, .field textarea:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.field input:disabled { background: #f8fafc; color: #94a3b8; }

.steps-head { display: flex; align-items: center; justify-content: space-between; margin: 18px 0 10px; padding-top: 14px; border-top: 1px solid #eef2f7; font-size: 13px; font-weight: 800; color: #0f172a; }
.mini { border: 1px solid #d8e2f0; border-radius: 7px; background: #fff; padding: 5px 11px; font-size: 12px; font-weight: 700; color: #4f46e5; cursor: pointer; }
.rel-hint { color: #94a3b8; font-size: 12px; margin: 4px 0 10px; }
.step-card { border: 1px solid #e5ebf3; border-radius: 11px; padding: 12px; margin-bottom: 12px; background: #fbfdff; }
.step-top { display: flex; align-items: center; gap: 9px; margin-bottom: 9px; }
.step-n { display: grid; place-items: center; width: 24px; height: 24px; flex-shrink: 0; border-radius: 7px; background: #eef2ff; color: #4f46e5; font-size: 12px; font-weight: 850; }
.step-title { flex: 1; border: 1px solid #d8e2f0; border-radius: 8px; padding: 8px 10px; font-size: 13px; font-weight: 700; }
.step-move { display: flex; gap: 2px; flex-shrink: 0; }
.step-body { width: 100%; border: 1px solid #d8e2f0; border-radius: 8px; padding: 8px 10px; font-size: 12.5px; font-family: inherit; resize: vertical; margin-bottom: 9px; }
.step-flags { display: flex; gap: 16px; margin-top: 4px; font-size: 12.5px; color: #334155; font-weight: 600; }
.step-flags label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.form-error { background: #fef2f2; color: #dc2626; border-radius: 9px; padding: 11px 12px; font-size: 12.5px; margin-top: 12px; }
.d-foot { flex-shrink: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #eef2f7; }
.modal { background: #fff; border-radius: 14px; padding: 24px; width: 420px; max-width: 92vw; } .modal h2 { margin: 0 0 8px; font-size: 17px; } .modal p { color: #64748b; font-size: 13px; }
.m-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
@media (max-width: 680px) { .gt { padding: 20px 16px; } .drawer { width: 100%; } .row2, .row3 { grid-template-columns: 1fr; } }
</style>
