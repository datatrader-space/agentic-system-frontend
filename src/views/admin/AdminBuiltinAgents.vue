<template>
  <div class="ba">
    <header class="ba-head">
      <div>
        <h1>Built-in Agents</h1>
        <p>System-owned agents every user can run (scope-gated) — including the <strong>Platform Super
          Agent</strong>, the default chat agent. They never appear in users' agent lists, and each user runs
          them on <strong>their own AI provider</strong> (your Default model is the preferred spec).
          Authoring happens in the full agent builder — set the scope in its <em>Scope &amp; Assistant</em> step.</p>
      </div>
      <button class="btn primary" @click="openCreate"><Icon icon="lucide:plus" /> New built-in agent</button>
    </header>

    <section class="card">
      <div v-if="loading" class="state">Loading…</div>
      <div v-else-if="error" class="state err">Couldn’t load. <button class="link" @click="load">Retry</button></div>
      <div v-else-if="!rows.length" class="state">No built-in agents yet. <button class="link" @click="openCreate">Create one</button>.</div>
      <table v-else class="tbl">
        <thead><tr><th>Name</th><th>Scope</th><th>Model (preferred)</th><th>Status</th><th>Updated</th><th class="r">Actions</th></tr></thead>
        <tbody>
          <tr v-for="a in rows" :key="a.id">
            <td>
              <strong>{{ a.name }}</strong>
              <span v-if="a.is_platform_super_agent" class="super-badge"><Icon icon="lucide:crown" /> Super Agent</span>
              <span v-if="a.id === assistantId" class="asst-badge"><Icon icon="lucide:sparkles" /> AI Assistant</span>
              <div class="sub">{{ a.description }}</div>
            </td>
            <td><span :class="['scope', a.builtin_visibility]">{{ a.builtin_visibility }}</span></td>
            <td class="muted">{{ a.default_model_name || 'user’s best model' }}</td>
            <td><span :class="['status', a.builtin_enabled ? 'on' : 'off']">{{ a.builtin_enabled ? 'Enabled' : 'Disabled' }}</span></td>
            <td class="muted">{{ shortDate(a.updated_at) }}</td>
            <td class="actions">
              <button v-if="a.is_platform_super_agent" class="ic" title="Open the Super Agent overview"
                      @click="router.push('/admin-dashboard/super-agent')"><Icon icon="lucide:layout-dashboard" /></button>
              <button class="ic" :class="{ active: a.id === assistantId }"
                :title="a.id === assistantId ? 'Powers the AI Assistant widget' : 'Set as the AI Assistant'"
                :disabled="a.id === assistantId || !a.builtin_enabled" @click="setAssistant(a)">
                <Icon icon="lucide:sparkles" />
              </button>
              <button class="ic" title="Duplicate to an editable agent (original stays unchanged)" :disabled="cloning === a.id" @click="cloneAgent(a)"><Icon :icon="cloning === a.id ? 'lucide:loader-2' : 'lucide:copy'" :class="{ spin: cloning === a.id }" /></button>
              <button class="ic" title="Edit in the agent builder" @click="openEdit(a)"><Icon icon="lucide:pencil" /></button>
              <button class="ic" :title="a.builtin_enabled ? 'Disable' : 'Enable'" @click="toggle(a)"><Icon :icon="a.builtin_enabled ? 'lucide:eye-off' : 'lucide:eye'" /></button>
              <button v-if="!a.is_platform_super_agent" class="ic danger" title="Delete" @click="confirmRow = a"><Icon icon="lucide:trash-2" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

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
// Console = list / inspect / enable / clone / delete. AUTHORING lives in the full agent builder —
// the SAME AgentEditor component, mounted inside the ADMIN shell (/admin-dashboard/agents/...) so
// staff stay on the admin side instead of being bounced into the user dashboard. Staff mark an
// agent built-in in the builder's Scope & Assistant step. ONE editor, no duplicate drawer form.
// A CLONE is a normal user-owned agent, so that one opens in the user dashboard on purpose.
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../../services/api'

const router = useRouter()
const notify = inject('notify', (m) => console.log(m))
const rows = ref([])
const assistantId = ref(null)   // which built-in currently powers the AI Assistant widget
const loading = ref(true)
const error = ref(false)
const cloning = ref(null)
const confirmRow = ref(null)

function shortDate(d) { try { return new Date(d).toLocaleDateString() } catch { return '' } }

const openCreate = () => router.push('/admin-dashboard/agents/new')
const openEdit = (a) => router.push(`/admin-dashboard/agents/${a.id}/editor`)

async function loadAllPages() {
  // The console is server-paginated (68 ECC built-ins and counting) — walk every page.
  const all = []
  let page = 1
  for (;;) {
    const { data } = await api.adminListBuiltinAgents({ page, page_size: 100 })
    const chunk = Array.isArray(data) ? data : (data.results || [])
    all.push(...chunk)
    if (Array.isArray(data) || !data?.next) break
    page += 1
  }
  return all
}

async function load() {
  loading.value = true; error.value = false
  try {
    rows.value = await loadAllPages()
    // First visit on a fresh platform: the shared Platform Super Agent is provisioned lazily —
    // ensure it exists so the console always shows it.
    if (!rows.value.some((a) => a.is_platform_super_agent)) {
      await api.getSuperAgent()
      rows.value = await loadAllPages()
    }
  } catch (e) { error.value = true }
  loading.value = false
}

async function loadAssistant() {
  try { const { data } = await api.adminGetAssistantConfig(); assistantId.value = data?.agent_id || null }
  catch (e) { /* leave unset */ }
}

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

async function toggle(a) {
  try { await api.adminToggleBuiltinAgent(a.id, !a.builtin_enabled); load() }
  catch (e) { notify(e?.response?.data?.builtin_enabled?.[0] || 'Could not update', 'error') }
}

async function remove() {
  const a = confirmRow.value
  try { await api.adminDeleteBuiltinAgent(a.id); notify('Deleted', 'success'); confirmRow.value = null; load() }
  catch (e) { notify(e?.response?.data?.detail || 'Delete failed', 'error') }
}

onMounted(() => { load(); loadAssistant() })
</script>

<style scoped>
.ba { padding: 28px 32px 60px; }
.ba-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.ba-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.ba-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 680px; line-height: 1.5; }
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
.super-badge { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 850; text-transform: uppercase; letter-spacing: .03em; background: #fef3c7; color: #b45309; }
.super-badge svg { width: 12px; height: 12px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; justify-content: flex-end; z-index: 60; }
.backdrop.center { align-items: center; justify-content: center; padding: 20px; }
.modal { background: #fff; border-radius: 14px; padding: 24px; width: 420px; max-width: 92vw; } .modal h2 { margin: 0 0 8px; font-size: 17px; } .modal p { color: #64748b; font-size: 13px; }
.m-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
@media (max-width: 680px) { .ba { padding: 20px 16px; } }
</style>
