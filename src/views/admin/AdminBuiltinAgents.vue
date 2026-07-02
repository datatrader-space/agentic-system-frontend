<template>
  <div class="ba">
    <header class="ba-head">
      <div>
        <h1>Built-in Agents</h1>
        <p>System-owned agents available to users by scope. They never appear in users' agent lists.
          New agents default to <strong>admin</strong> scope — switch to <strong>user</strong> to expose to everyone.</p>
      </div>
      <button class="btn primary" @click="openCreate"><Icon icon="lucide:plus" /> New built-in agent</button>
    </header>

    <section class="card">
      <div v-if="loading" class="state">Loading…</div>
      <div v-else-if="error" class="state err">Couldn’t load. <button class="link" @click="load">Retry</button></div>
      <div v-else-if="!rows.length" class="state">No built-in agents yet. <button class="link" @click="openCreate">Create one</button>.</div>
      <table v-else class="tbl">
        <thead><tr><th>Name</th><th>Scope</th><th>Status</th><th>Updated</th><th class="r">Actions</th></tr></thead>
        <tbody>
          <tr v-for="a in rows" :key="a.id">
            <td>
              <strong>{{ a.name }}</strong>
              <span v-if="a.id === assistantId" class="asst-badge"><Icon icon="lucide:sparkles" /> AI Assistant</span>
              <div class="sub">{{ a.description }}</div>
            </td>
            <td><span :class="['scope', a.builtin_visibility]">{{ a.builtin_visibility }}</span></td>
            <td><span :class="['status', a.builtin_enabled ? 'on' : 'off']">{{ a.builtin_enabled ? 'Enabled' : 'Disabled' }}</span></td>
            <td class="muted">{{ shortDate(a.updated_at) }}</td>
            <td class="actions">
              <button class="ic" :class="{ active: a.id === assistantId }"
                :title="a.id === assistantId ? 'Powers the AI Assistant widget' : 'Set as the AI Assistant'"
                :disabled="a.id === assistantId || !a.builtin_enabled" @click="setAssistant(a)">
                <Icon icon="lucide:sparkles" />
              </button>
              <button class="ic" title="Duplicate to an editable agent (original stays unchanged)" :disabled="cloning === a.id" @click="cloneAgent(a)"><Icon :icon="cloning === a.id ? 'lucide:loader-2' : 'lucide:copy'" :class="{ spin: cloning === a.id }" /></button>
              <button class="ic" title="Edit" @click="openEdit(a)"><Icon icon="lucide:pencil" /></button>
              <button class="ic" :title="a.builtin_enabled ? 'Disable' : 'Enable'" @click="toggle(a)"><Icon :icon="a.builtin_enabled ? 'lucide:eye-off' : 'lucide:eye'" /></button>
              <button class="ic danger" title="Delete" @click="confirmRow = a"><Icon icon="lucide:trash-2" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Editor drawer -->
    <div v-if="editorOpen" class="backdrop" @click.self="editorOpen = false">
      <aside class="drawer">
        <header class="d-head"><h2>{{ form.id ? 'Edit built-in agent' : 'New built-in agent' }}</h2><button class="ic" @click="editorOpen = false"><Icon icon="lucide:x" /></button></header>
        <div class="d-body">
          <!-- Basic -->
          <h3 class="sec">Basic</h3>
          <label class="field"><span>Name <em>*</em></span><input v-model="form.name" placeholder="Help Assistant" /></label>
          <label class="field"><span>Key <em>*</em></span>
            <input v-model="form.builtin_key" :disabled="!!form.id" placeholder="help-assistant"
                   @input="form.builtin_key = (form.builtin_key||'').toLowerCase()" />
            <small class="fhint">Lowercase, hyphenated, unique. {{ form.id ? 'Locked after creation.' : '' }}</small>
          </label>
          <label class="field"><span>Description</span><input v-model="form.description" placeholder="Short description shown to users" /></label>

          <!-- Visibility -->
          <h3 class="sec">Visibility</h3>
          <div class="row2">
            <label class="field"><span>Scope <em>*</em></span>
              <select v-model="form.builtin_visibility">
                <option value="admin">Admin only</option>
                <option value="user">All users</option>
                <option value="system">System (internal)</option>
              </select>
            </label>
            <label class="field check"><input type="checkbox" v-model="form.builtin_enabled" /> <span>Enabled</span></label>
          </div>
          <p class="hint">Scope <strong>user</strong> exposes this agent to every signed-in user. <strong>system</strong> keeps it internal (never shown in any UI). Enabling requires instructions.</p>

          <!-- Instructions -->
          <h3 class="sec">Instructions</h3>
          <label class="field"><span>System prompt</span><textarea v-model="form.instructions" rows="5" placeholder="How the agent should behave…"></textarea></label>

          <!-- Model -->
          <h3 class="sec">Model</h3>
          <div class="row2">
            <label class="field"><span>Default model</span>
              <select v-model="form.default_model">
                <option :value="null">Platform default</option>
                <option v-for="m in models" :key="m.id" :value="m.id">{{ m.label }}</option>
              </select>
            </label>
            <label class="field"><span>Temperature</span>
              <input type="number" v-model.number="form.temperature" min="0" max="2" step="0.1" placeholder="0.7" />
            </label>
          </div>

          <!-- Tool access -->
          <h3 class="sec">Tool access</h3>
          <p v-if="groundingRequired" class="warn"><Icon icon="lucide:shield-check" /> Help Assistant must remain grounded to Help Center content.</p>
          <div class="tools">
            <label v-for="t in catalog.safe_tools" :key="t.name" class="tool"
                   :class="{ locked: isGroundingTool(t.name) }">
              <input type="checkbox" :value="t.name" v-model="form.tool_names"
                     :disabled="isGroundingTool(t.name)" />
              <span class="t-label">{{ t.label }}</span>
              <span class="t-group safe">{{ t.group }}</span>
              <span v-if="isGroundingTool(t.name)" class="t-group lock">required</span>
            </label>
          </div>
          <details class="blocked" v-if="catalog.blocked_examples?.length">
            <summary>Blocked tools ({{ catalog.blocked_examples.length }}) — never allowed on built-ins</summary>
            <label v-for="b in catalog.blocked_examples" :key="b.label" class="tool disabled">
              <input type="checkbox" disabled />
              <span class="t-label">{{ b.label }}</span>
              <span class="t-group unsafe">{{ b.reason }}</span>
            </label>
          </details>

          <!-- Knowledge sources (shared KnowledgeSources — e.g. Help Center) -->
          <h3 class="sec">Knowledge sources</h3>
          <p class="hint" style="margin-bottom:10px">Attach shared knowledge bases so this agent can answer from them. Generate the Help Center source in <strong>Help Center → Generate KB embeddings</strong>.</p>
          <div v-if="kbSources.length" class="tools">
            <label v-for="s in kbSources" :key="s.id" class="tool">
              <input type="checkbox" :value="s.id" v-model="form.knowledge_source_ids" />
              <span class="t-label">{{ s.name }}</span>
              <span class="t-group safe">{{ s.scope }}</span>
              <span class="t-group" style="background:#f1f5f9;color:#64748b">{{ s.chunk_count || 0 }} chunks</span>
            </label>
          </div>
          <p v-else class="hint">No shared knowledge bases yet. Create one in Help Center → Generate KB embeddings.</p>

          <div v-if="formError" class="form-error">{{ formError }}</div>
        </div>
        <footer class="d-foot">
          <button class="btn ghost" @click="editorOpen = false">Cancel</button>
          <button class="btn primary" @click="save" :disabled="saving || !isValid">{{ saving ? 'Saving…' : (form.id ? 'Save' : 'Create') }}</button>
        </footer>
      </aside>
    </div>

    <!-- Delete confirm -->
    <div v-if="confirmRow" class="backdrop center" @click.self="confirmRow = null">
      <div class="modal">
        <h2>Delete “{{ confirmRow.name }}”?</h2>
        <p>This built-in agent will be removed for everyone in its scope.</p>
        <div class="m-actions"><button class="btn ghost" @click="confirmRow = null">Cancel</button><button class="btn danger" @click="remove">Delete</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'

const router = useRouter()
import api from '../../services/api'

const notify = inject('notify', (m) => console.log(m))
const rows = ref([])
const assistantId = ref(null)   // which built-in currently powers the AI Assistant widget

async function loadAssistant() {
  try { const { data } = await api.adminGetAssistantConfig(); assistantId.value = data?.agent_id || null }
  catch (e) { /* leave unset */ }
}
const cloning = ref(null)
async function cloneAgent(a) {
  cloning.value = a.id
  try {
    const { data } = await api.adminCloneBuiltinAgent(a.id)
    notify(`Copied "${a.name}" to an editable agent`, 'success')
    if (data?.id) router.push(`/dashboard/agents/${data.id}/editor`)
  } catch (e) { notify(e?.response?.data?.detail || 'Could not duplicate', 'error') }
  cloning.value = null
}
async function setAssistant(a) {
  if (a.id === assistantId.value) return
  try {
    await api.adminSetAssistantAgent(a.id)
    assistantId.value = a.id
    notify(`"${a.name}" is now the AI Assistant`, 'success')
  } catch (e) { notify(e?.response?.data?.detail || 'Could not set the AI Assistant', 'error') }
}
const loading = ref(true)
const error = ref(false)
const editorOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const confirmRow = ref(null)
const form = reactive({ tool_names: [], knowledge_source_ids: [] })
const catalog = ref({ safe_tools: [], blocked_examples: [], grounding_required: {} })
const models = ref([])
const kbSources = ref([])   // shared KnowledgeSources (Help Center etc.) selectable here

function shortDate(d) { try { return new Date(d).toLocaleDateString() } catch { return '' } }

// The grounding tool locked to the current key (if any). Help Assistant ⇒ SEARCH_HELP_CONTENT.
const groundingTool = computed(() => catalog.value.grounding_required?.[form.builtin_key] || null)
const groundingRequired = computed(() => !!groundingTool.value)
function isGroundingTool(name) { return groundingTool.value === name }

const isValid = computed(() => {
  if (!form.name?.trim()) return false
  if (!form.id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.builtin_key || '')) return false
  if (groundingRequired.value && !(form.tool_names || []).includes(groundingTool.value)) return false
  return true
})

async function load() {
  loading.value = true; error.value = false
  try { const { data } = await api.adminListBuiltinAgents(); rows.value = Array.isArray(data) ? data : (data.results || []) }
  catch (e) { error.value = true }
  loading.value = false
}

async function loadMeta() {
  try { const { data } = await api.adminBuiltinToolCatalog(); catalog.value = data } catch (e) { /* keep empty */ }
  try {
    const { data } = await api.getLLMModels()
    const list = Array.isArray(data) ? data : (data.results || [])
    models.value = list.map(m => ({ id: m.id, label: m.display_name || m.model_id || `Model ${m.id}` }))
  } catch (e) { /* picker shows platform default only */ }
  try {
    const { data } = await api.listKnowledgeSources()
    kbSources.value = data?.sources || data?.results || (Array.isArray(data) ? data : [])
  } catch (e) { /* no shared sources available */ }
}

function ensureGrounding() {
  // Keep the grounding tool checked whenever the key requires it.
  if (groundingTool.value && !form.tool_names.includes(groundingTool.value)) form.tool_names.push(groundingTool.value)
}

function openCreate() {
  Object.assign(form, { id: null, name: '', builtin_key: '', description: '', instructions: '',
    builtin_visibility: 'admin', builtin_enabled: false, default_model: null, temperature: 0.7,
    tool_names: [], knowledge_source_ids: [] })
  formError.value = ''; editorOpen.value = true
}
function openEdit(a) {
  Object.assign(form, { id: a.id, name: a.name, builtin_key: a.builtin_key, description: a.description,
    instructions: a.instructions, builtin_visibility: a.builtin_visibility, builtin_enabled: a.builtin_enabled,
    default_model: a.default_model ?? null, temperature: a.temperature ?? 0.7, tool_names: [...(a.tool_names || [])],
    knowledge_source_ids: (a.knowledge_sources || []).map(s => s.id) })
  ensureGrounding()
  formError.value = ''; editorOpen.value = true
}

async function save() {
  ensureGrounding()
  if (!isValid.value) { formError.value = 'Fill the required fields (and keep the grounding tool).'; return }
  saving.value = true; formError.value = ''
  const payload = {
    name: form.name, description: form.description, instructions: form.instructions,
    builtin_visibility: form.builtin_visibility, builtin_enabled: form.builtin_enabled,
    default_model: form.default_model, temperature: form.temperature, tool_names: form.tool_names,
    knowledge_source_ids: form.knowledge_source_ids,
  }
  if (!form.id) payload.builtin_key = form.builtin_key
  try {
    if (form.id) await api.adminUpdateBuiltinAgent(form.id, payload)
    else await api.adminCreateBuiltinAgent(payload)
    notify('Saved', 'success'); editorOpen.value = false; load()
  } catch (e) {
    const d = e?.response?.data
    formError.value = d?.non_field_errors?.[0] || d?.tools?.[0] || d?.builtin_key?.[0] || d?.builtin_enabled?.[0] ||
      (d && typeof d === 'object' ? JSON.stringify(d) : 'Save failed')
  }
  saving.value = false
}
async function toggle(a) { try { await api.adminToggleBuiltinAgent(a.id, !a.builtin_enabled); load() } catch (e) { notify(e?.response?.data?.builtin_enabled?.[0] || 'Could not update', 'error') } }
async function remove() { const a = confirmRow.value; try { await api.adminDeleteBuiltinAgent(a.id); notify('Deleted', 'success'); confirmRow.value = null; load() } catch (e) { notify('Delete failed', 'error') } }

onMounted(() => { load(); loadMeta(); loadAssistant() })
</script>

<style scoped>
.ba { padding: 28px 32px 60px; }
.ba-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.ba-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.ba-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 640px; line-height: 1.5; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.primary { background: #4f46e5; color: #fff; } .btn.ghost { background: #fff; border-color: #d8e2f0; color: #334155; } .btn.danger { background: #dc2626; color: #fff; }
.btn:disabled { opacity: .6; } .btn svg { width: 15px; height: 15px; }
.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; }
.state { padding: 44px; text-align: center; color: #64748b; } .state.err { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 12px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; }
.tbl th.r { text-align: right; }
.tbl td { padding: 13px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
.tbl tr:last-child td { border-bottom: 0; }
.sub { color: #94a3b8; font-size: 11.5px; margin-top: 3px; }
.muted { color: #94a3b8; }
.scope { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; }
.scope.user { background: #dff8ef; color: #059669; } .scope.admin { background: #eef4ff; color: #2563eb; } .scope.system { background: #f1f5f9; color: #64748b; }
.status { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; } .status.on { background: #dcfce7; color: #16a34a; } .status.off { background: #f1f5f9; color: #64748b; }
.actions { text-align: right; white-space: nowrap; }
.ic { display: inline-grid; place-items: center; width: 32px; height: 32px; border: 0; background: transparent; border-radius: 8px; color: #64748b; cursor: pointer; }
.ic:hover { background: #eef2f7; color: #0f172a; } .ic.danger:hover { background: #fee2e2; color: #dc2626; } .ic svg { width: 16px; height: 16px; }
.ic.active { color: #7c3aed; } .ic:disabled { opacity: .4; cursor: default; } .ic:disabled:hover { background: transparent; }
.asst-badge { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 850; text-transform: uppercase; letter-spacing: .03em; background: #f5f3ff; color: #7c3aed; }
.asst-badge svg { width: 12px; height: 12px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; justify-content: flex-end; z-index: 60; }
.backdrop.center { align-items: center; justify-content: center; padding: 20px; }
.drawer { width: 520px; max-width: 100%; height: 100vh; background: #fff; display: flex; flex-direction: column; }
.d-head { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #eef2f7; } .d-head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.d-body { flex: 1; overflow-y: auto; padding: 18px 20px; }
.field { display: block; margin-bottom: 14px; } .field > span { display: block; font-size: 12.5px; font-weight: 700; color: #334155; margin-bottom: 6px; } .field em { color: #dc2626; font-style: normal; }
.field input, .field select, .field textarea { width: 100%; border: 1px solid #d8e2f0; border-radius: 9px; padding: 9px 11px; font-size: 13px; font-family: inherit; }
.field input:focus, .field select:focus, .field textarea:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.field.check { display: flex; align-items: center; gap: 8px; } .field.check input { width: auto; } .field.check span { margin: 0; }
.row2 { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: end; }
.hint { color: #94a3b8; font-size: 11.5px; margin: 4px 0 0; }
.sec { margin: 20px 0 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 800; padding-bottom: 6px; border-bottom: 1px solid #eef2f7; }
.sec:first-child { margin-top: 0; }
.fhint { display: block; color: #94a3b8; font-size: 11px; margin-top: 4px; }
.warn { display: flex; align-items: center; gap: 7px; background: #fff7ed; color: #b45309; border: 1px solid #fed7aa; border-radius: 9px; padding: 9px 11px; font-size: 12px; font-weight: 600; margin: 0 0 12px; }
.warn svg { width: 15px; height: 15px; flex-shrink: 0; }
.tools { display: grid; gap: 8px; }
.tool { display: flex; align-items: center; gap: 9px; border: 1px solid #e5ebf3; border-radius: 9px; padding: 9px 11px; font-size: 12.5px; cursor: pointer; }
.tool input { width: auto; } .tool.locked { background: #f0fdf4; border-color: #bbf7d0; } .tool.disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
.t-label { flex: 1; font-weight: 600; color: #334155; }
.t-group { border-radius: 5px; padding: 2px 7px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; }
.t-group.safe { background: #eef2ff; color: #4f46e5; } .t-group.lock { background: #dcfce7; color: #16a34a; } .t-group.unsafe { background: #fee2e2; color: #dc2626; }
.blocked { margin-top: 12px; } .blocked summary { cursor: pointer; color: #64748b; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.blocked .tool { margin-top: 8px; }
.form-error { background: #fef2f2; color: #dc2626; border-radius: 9px; padding: 11px 12px; font-size: 12.5px; margin-top: 12px; }
.d-foot { flex-shrink: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #eef2f7; }
.modal { background: #fff; border-radius: 14px; padding: 24px; width: 420px; max-width: 92vw; } .modal h2 { margin: 0 0 8px; font-size: 17px; } .modal p { color: #64748b; font-size: 13px; }
.m-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
@media (max-width: 680px) { .ba { padding: 20px 16px; } .drawer { width: 100%; } }
</style>
