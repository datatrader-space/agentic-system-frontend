<template>
  <div class="rg">
    <header class="rg-head">
      <div>
        <h1>Registry Governance</h1>
        <p>Configuration hygiene over the live system — tool schemas that no longer resolve in the code
          registry, MCP tools without a healthy server, imported skills awaiting trust review, and agents
          that are bare (nothing to act with) or paused.</p>
      </div>
      <button class="btn primary" :disabled="loading" @click="load">
        <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" /> Refresh
      </button>
    </header>

    <div v-if="loading && !data" class="state card">Loading…</div>
    <div v-else-if="error" class="state err card">Couldn’t load. <button class="link" @click="load">Retry</button></div>

    <template v-else-if="data">
      <!-- Count tiles -->
      <div class="kpis">
        <div v-for="t in tiles" :key="t.label" class="kpi" :class="t.tone">
          <span class="kpi-label">{{ t.label }}</span>
          <span class="kpi-val">{{ t.value }}</span>
          <span class="kpi-note">{{ t.note }}</span>
        </div>
      </div>

      <!-- Stale tool schemas -->
      <section class="card">
        <div class="card-head">
          <h2>Stale tool schemas</h2>
          <span class="count">{{ stale.checked ? num(stale.count) : '—' }}</span>
        </div>
        <div v-if="!stale.checked" class="state">Live registry unavailable — the stale check was skipped rather than mass-flagging every tool.</div>
        <div v-else-if="!stale.items.length" class="state ok">Every registry-backed tool schema resolves in the live registry ({{ num(stale.registry_size) }} tools).</div>
        <div v-else class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Tool</th><th>Category</th><th>Enabled</th><th>Updated</th></tr></thead>
            <tbody>
              <tr v-for="t in stale.items" :key="t.id">
                <td><strong>{{ t.name }}</strong></td>
                <td class="muted">{{ t.category }}</td>
                <td><span :class="['pill', t.enabled ? 'on' : 'off']">{{ t.enabled ? 'enabled' : 'disabled' }}</span></td>
                <td class="muted">{{ shortDate(t.updated_at) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="stale.count > stale.items.length" class="more">Showing first {{ stale.items.length }} of {{ num(stale.count) }}.</div>
        </div>
      </section>

      <!-- MCP hygiene -->
      <section class="card">
        <div class="card-head">
          <h2>MCP tools &amp; servers</h2>
          <span class="count">{{ num(mcp.orphan_tools?.count || 0) }} orphan · {{ num(mcp.disabled_servers?.count || 0) }} disabled</span>
        </div>
        <div v-if="!(mcp.orphan_tools?.count || mcp.disabled_servers?.count)" class="state ok">Every MCP tool is bound to an enabled server.</div>
        <template v-else>
          <div v-if="mcp.orphan_tools?.count" class="sub-block">
            <div class="sub-title">Tools with no owning server <span class="muted">— the loader can only slug-guess these</span></div>
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>Tool</th><th>Enabled</th></tr></thead>
                <tbody>
                  <tr v-for="t in mcp.orphan_tools.items" :key="t.id">
                    <td><strong>{{ t.name }}</strong></td>
                    <td><span :class="['pill', t.enabled ? 'on' : 'off']">{{ t.enabled ? 'enabled' : 'disabled' }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-if="mcp.disabled_servers?.count" class="sub-block">
            <div class="sub-title">Disabled servers still carrying tool schemas</div>
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>Server</th><th>Slug</th><th>Scope</th><th class="r">Tools</th></tr></thead>
                <tbody>
                  <tr v-for="s in mcp.disabled_servers.items" :key="s.id">
                    <td><strong>{{ s.name }}</strong></td>
                    <td class="muted">{{ s.slug }}</td>
                    <td class="muted">{{ s.is_system_default ? 'system default' : 'user' }}</td>
                    <td class="r">{{ num(s.tool_count) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-if="mcp.tools_on_disabled_servers?.count" class="sub-block">
            <div class="sub-title">Tools bound to those disabled servers</div>
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>Tool</th><th>Server</th></tr></thead>
                <tbody>
                  <tr v-for="t in mcp.tools_on_disabled_servers.items" :key="t.id">
                    <td><strong>{{ t.name }}</strong></td>
                    <td class="muted">{{ t.mcp_server__name }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </section>

      <!-- Skill trust -->
      <section class="card">
        <div class="card-head">
          <h2>Skill trust</h2>
          <span class="count">{{ num(skills.untrusted_imported || 0) }} to review</span>
        </div>
        <div v-if="!(skills.untrusted_imported || 0)" class="state ok">
          No imported skills awaiting trust review ({{ num(skills.untrusted || 0) }} untrusted overall, {{ num(skills.imported || 0) }} imported).
        </div>
        <div v-else class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Skill</th><th>Slug</th><th>Source</th><th>Owner</th></tr></thead>
            <tbody>
              <tr v-for="s in skills.items" :key="s.id">
                <td><strong>{{ s.name }}</strong></td>
                <td class="muted">{{ s.slug }}</td>
                <td class="muted">{{ s.source }}</td>
                <td class="muted">{{ s.created_by__username }}</td>
              </tr>
            </tbody>
          </table>
          <div class="more">Imported skills arrive untrusted — their scripts never run until an admin promotes them.</div>
        </div>
      </section>

      <!-- Agents -->
      <section class="card">
        <div class="card-head">
          <h2>Bare agents</h2>
          <span class="count">{{ num(agents.bare?.count || 0) }}</span>
        </div>
        <div v-if="!(agents.bare?.count || 0)" class="state ok">Every user agent has at least one tool, skill, or knowledge source.</div>
        <div v-else class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Agent</th><th>Owner</th></tr></thead>
            <tbody>
              <tr v-for="a in agents.bare.items" :key="a.id">
                <td><strong>{{ a.name }}</strong></td>
                <td class="muted">{{ a.user__username }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="agents.bare.count > agents.bare.items.length" class="more">Showing first {{ agents.bare.items.length }} of {{ num(agents.bare.count) }}.</div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Paused agents</h2>
          <span class="count">{{ num(agents.paused?.count || 0) }}</span>
        </div>
        <div v-if="!(agents.paused?.count || 0)" class="state ok">No agents are paused.</div>
        <div v-else class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Agent</th><th>Owner</th><th>Reason</th></tr></thead>
            <tbody>
              <tr v-for="a in agents.paused.items" :key="a.id">
                <td><strong>{{ a.name }}</strong></td>
                <td class="muted">{{ a.user__username }}</td>
                <td class="muted">{{ a.paused_reason || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'

const loading = ref(true)
const error = ref(false)
const data = ref(null)

const err = (s) => !!(s && s.error)
const stale = computed(() => err(data.value?.stale_tool_schemas) ? { checked: false, count: 0, items: [], registry_size: 0 } : (data.value?.stale_tool_schemas || { checked: false, count: 0, items: [] }))
const mcp = computed(() => err(data.value?.mcp) ? {} : (data.value?.mcp || {}))
const skills = computed(() => err(data.value?.skills) ? {} : (data.value?.skills || {}))
const agents = computed(() => err(data.value?.agents) ? {} : (data.value?.agents || {}))

const tiles = computed(() => [
  { label: 'Stale schemas', value: stale.value.checked ? num(stale.value.count) : '—',
    tone: stale.value.count > 0 ? 'warn' : 'good',
    note: stale.value.checked ? 'not in the live registry' : 'registry unavailable' },
  { label: 'Orphan MCP tools', value: num(mcp.value.orphan_tools?.count || 0),
    tone: (mcp.value.orphan_tools?.count || 0) > 0 ? 'warn' : 'good', note: 'no owning server' },
  { label: 'Disabled servers', value: num(mcp.value.disabled_servers?.count || 0),
    tone: 'neutral', note: `${num(mcp.value.tools_on_disabled_servers?.count || 0)} tools still bound` },
  { label: 'Skills to review', value: num(skills.value.untrusted_imported || 0),
    tone: (skills.value.untrusted_imported || 0) > 0 ? 'warn' : 'good', note: 'imported + untrusted' },
  { label: 'Bare agents', value: num(agents.value.bare?.count || 0),
    tone: (agents.value.bare?.count || 0) > 0 ? 'warn' : 'good', note: 'no tools, skills, or knowledge' },
  { label: 'Paused agents', value: num(agents.value.paused?.count || 0), tone: 'neutral', note: 'refusing new runs' },
])

const num = (n) => (n ?? 0).toLocaleString()
function shortDate(d) { try { return d ? new Date(d).toLocaleDateString() : '—' } catch { return '—' } }

async function load() {
  loading.value = true; error.value = false
  try {
    const { data: d } = await api.get('/admin/ops/registry-governance/', { noCache: true })
    data.value = d
  } catch (e) { error.value = true }
  loading.value = false
}

onMounted(load)
</script>

<style scoped>
.rg { padding: 28px 32px 60px; }
.rg-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.rg-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.rg-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 680px; line-height: 1.5; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; flex-shrink: 0; }
.btn.primary { background: #4f46e5; color: #fff; }
.btn:disabled { opacity: .6; } .btn svg { width: 15px; height: 15px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }

.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 15px 17px; display: flex; flex-direction: column; }
.kpi.warn { border-color: #fde68a; background: #fffdf5; }
.kpi-label { font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
.kpi-val { font-size: 26px; font-weight: 800; color: #0f172a; margin-top: 7px; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.kpi-note { font-size: 12px; color: #94a3b8; margin-top: 4px; }

.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; margin-bottom: 18px; }
.card-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #eef2f7; }
.card-head h2 { margin: 0; font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: .04em; }
.count { font-size: 12px; font-weight: 700; color: #64748b; background: #f1f5f9; border-radius: 999px; padding: 3px 10px; font-variant-numeric: tabular-nums; }
.state { padding: 30px; text-align: center; color: #64748b; font-size: 13px; }
.state.ok { color: #15803d; }
.state.err { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }

.sub-block { border-bottom: 1px solid #eef2f7; }
.sub-block:last-child { border-bottom: 0; }
.sub-title { padding: 12px 16px 0; font-size: 12px; font-weight: 700; color: #475569; }
.sub-title .muted { font-weight: 500; }

.tbl-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 12px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; white-space: nowrap; }
.tbl th.r, .tbl td.r { text-align: right; }
.tbl td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.tbl tr:last-child td { border-bottom: 0; }
.muted { color: #94a3b8; }
.pill { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; }
.pill.on { background: #dcfce7; color: #16a34a; }
.pill.off { background: #f1f5f9; color: #64748b; }
.more { padding: 10px 16px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }

@media (max-width: 680px) { .rg { padding: 20px 16px; } .rg-head { flex-direction: column; } }
</style>
