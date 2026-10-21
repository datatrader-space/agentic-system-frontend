<template>
  <div class="integrations-page min-h-full bg-[#F8FAFC] px-5 py-7 sm:px-7 lg:px-8" :class="{ 'integrations-compact': compact }">
    <div class="mx-auto max-w-[1390px]">
      <!-- Header -->
      <header v-if="!compact" class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-[28px] font-[850] leading-tight tracking-normal text-[#0F172A]">Integrations</h1>
          <p class="mt-2 max-w-[70ch] text-[14px] text-[#52627A]">
            Everything that connects AADML to the outside world, in one place.
          </p>
        </div>
      </header>

      <p v-if="compact" class="compact-integration-intro">Connect your agents to your apps, or use AADML from an MCP client.</p>
      <!-- Two kinds of integration, one tab each (the tab is kept in the address: ?tab=agents|mcp). -->
      <nav class="mb-5 flex gap-1 border-b border-[#DDE6F2]" aria-label="Integrations">
        <button v-for="t in pageTabs" :key="t.id" type="button"
                class="-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold transition"
                :class="tab === t.id ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#52627A] hover:text-[#0F172A]'"
                :aria-current="tab === t.id ? 'page' : undefined" @click="setTab(t.id)">
          <component :is="t.icon" :size="15" /> {{ t.label }}
          <span v-if="t.badge" class="rounded-full bg-[#EFF4FF] px-1.5 py-px text-[11px] font-bold text-[#2563EB]">{{ t.badge }}</span>
        </button>
      </nav>

      <!-- ══ Your agents in your app, backend or website ══ -->
      <AgentIntegrationsList v-if="tab === 'agents'" :compact="compact" />

      <!-- ══ AADML as an MCP server ═══════════════════════════════════════════════════════════════ -->
      <section v-if="tab === 'mcp'" class="rounded-[10px] border border-[#DDE6F2] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <!-- Section header -->
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-[#EDF2F9] px-6 py-5">
          <div class="flex min-w-0 items-start gap-3.5">
            <div class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#0F172A]">
              <Plug :size="19" class="text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-[17px] font-[800] tracking-tight text-[#0F172A]">AADML as an MCP server</h2>
              <p class="mt-1 max-w-[78ch] text-[13px] leading-relaxed text-[#52627A]">
                Connect ChatGPT or Claude to AADML and drive your agents, runs, approvals and sandboxes
                from there. AADML stays the place the work actually runs.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="info && info.enabled"
              class="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-3 py-1 text-[12px] font-bold text-[#067647]"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-[#12B76A]"></span> Available
            </span>
            <span
              v-else-if="info"
              class="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3F2] px-3 py-1 text-[12px] font-bold text-[#B42318]"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-[#F04438]"></span> Turned off
            </span>
          </div>
        </div>

        <!-- Loading / error -->
        <div v-if="loading" class="px-6 py-12 text-center text-[13px] font-semibold text-[#667994]">
          Loading…
        </div>
        <div v-else-if="loadError" class="px-6 py-10">
          <p class="text-[13px] font-semibold text-[#B42318]">{{ loadError }}</p>
          <button
            class="mt-3 h-9 rounded-[8px] border border-[#D8E2F0] bg-white px-4 text-[13px] font-bold text-[#0F172A] hover:bg-[#F8FAFC]"
            @click="load"
          >
            Try again
          </button>
        </div>

        <template v-else-if="info">
          <!-- Gateway disabled: say so plainly, but keep disconnect reachable below. -->
          <div v-if="!info.enabled" class="border-b border-[#FEE4E2] bg-[#FFFBFA] px-6 py-4">
            <p class="text-[13px] leading-relaxed text-[#B42318]">
              <strong class="font-bold">The MCP gateway is switched off on this deployment.</strong>
              New connections cannot be made and existing ones will be refused. Clients you already
              authorized are still listed below so you can disconnect them.
            </p>
          </div>

          <!-- ── 1. How to connect ───────────────────────────────────────────────────────────────── -->
          <div class="mcp-setup-grid grid gap-7 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div class="min-w-0">
              <h3 class="text-[13px] font-[800] uppercase tracking-wide text-[#667994]">Connect a client</h3>

              <!-- Endpoint -->
              <label class="mt-3 block text-[12px] font-bold text-[#475467]">Server URL</label>
              <div class="mt-1.5 flex items-stretch gap-2">
                <code
                  class="min-w-0 flex-1 truncate rounded-[8px] border border-[#D8E2F0] bg-[#F8FAFC] px-3.5 py-2.5 font-mono text-[13px] text-[#0F172A]"
                  :title="info.endpoint"
                >{{ info.endpoint }}</code>
                <button
                  class="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-[8px] border border-[#D8E2F0] bg-white px-3.5 text-[13px] font-bold text-[#0F172A] hover:bg-[#F8FAFC]"
                  @click="copy(info.endpoint, 'Server URL')"
                >
                  <Copy :size="15" /> Copy
                </button>
              </div>

              <!-- The single most misunderstood thing about this integration. -->
              <p class="mt-2.5 flex items-start gap-2 text-[12.5px] leading-relaxed text-[#52627A]">
                <Info :size="15" class="mt-0.5 shrink-0 text-[#667994]" />
                <span>
                  <strong class="font-bold text-[#0F172A]">There is no API key to create.</strong>
                  Paste the URL into your client and it registers itself, then sends you here to sign in
                  and approve exactly which permissions and workspaces it may use.
                </span>
              </p>

              <!-- Per-client instructions -->
              <div class="mt-5 flex gap-1.5">
                <button
                  v-for="c in clients"
                  :key="c.id"
                  class="h-9 rounded-[8px] px-3.5 text-[13px] font-bold transition-colors"
                  :class="clientTab === c.id
                    ? 'bg-[#0F172A] text-white'
                    : 'border border-[#D8E2F0] bg-white text-[#334155] hover:bg-[#F8FAFC]'"
                  @click="clientTab = c.id"
                >{{ c.label }}</button>
              </div>
              <ol class="mt-3.5 space-y-2 rounded-[8px] border border-[#E6EDF7] bg-[#FBFDFF] px-4 py-3.5">
                <li
                  v-for="(step, i) in activeClient.steps"
                  :key="i"
                  class="flex gap-2.5 text-[13px] leading-relaxed text-[#334155]"
                >
                  <span class="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-[11px] font-[800] text-[#475467]">{{ i + 1 }}</span>
                  <span>{{ step }}</span>
                </li>
              </ol>
            </div>

            <!-- What this connection can reach -->
            <aside class="rounded-[10px] border border-[#E6EDF7] bg-[#FBFDFF] p-5">
              <h3 class="text-[13px] font-[800] uppercase tracking-wide text-[#667994]">What it exposes</h3>
              <dl class="mt-3.5 space-y-3">
                <div class="flex items-baseline justify-between gap-3">
                  <dt class="text-[13px] text-[#52627A]">Tools</dt>
                  <dd class="text-[15px] font-[800] text-[#0F172A]">{{ info.tool_count }}</dd>
                </div>
                <div class="flex items-baseline justify-between gap-3">
                  <dt class="text-[13px] text-[#52627A]">Domains</dt>
                  <dd class="text-[15px] font-[800] text-[#0F172A]">{{ (info.domains || []).length }}</dd>
                </div>
                <div class="flex items-baseline justify-between gap-3">
                  <dt class="text-[13px] text-[#52627A]">Calls (7 days)</dt>
                  <dd class="text-[15px] font-[800] text-[#0F172A]">{{ info.usage?.calls_last_7_days ?? 0 }}</dd>
                </div>
                <div class="flex items-baseline justify-between gap-3">
                  <dt class="text-[13px] text-[#52627A]">Live sessions</dt>
                  <dd class="text-[15px] font-[800] text-[#0F172A]">{{ info.usage?.active_sessions ?? 0 }}</dd>
                </div>
              </dl>
              <p class="mt-4 border-t border-[#E6EDF7] pt-3.5 text-[12.5px] leading-relaxed text-[#52627A]">
                A connected client can only do what you approve, and never more than your own role allows.
                It sees your data only — not other members' — even inside a shared workspace.
              </p>
              <p class="mt-2.5 font-mono text-[11.5px] text-[#8497AF]">contract {{ info.contract_version }}</p>
            </aside>
          </div>

          <!-- ── 2. Connected clients ────────────────────────────────────────────────────────────── -->
          <div class="border-t border-[#EDF2F9] px-6 py-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-[13px] font-[800] uppercase tracking-wide text-[#667994]">
                Connected clients
                <span v-if="connections.length" class="ml-1 font-mono text-[12px] text-[#8497AF]">({{ activeCount }} active)</span>
              </h3>
              <button
                class="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#D8E2F0] bg-white px-3.5 text-[13px] font-bold text-[#0F172A] hover:bg-[#F8FAFC]"
                :disabled="refreshing"
                @click="load"
              >
                <RefreshCw :size="14" :class="refreshing ? 'animate-spin' : ''" /> Refresh
              </button>
            </div>

            <!-- Empty -->
            <div
              v-if="!connections.length"
              class="mt-4 rounded-[10px] border border-dashed border-[#D8E2F0] bg-[#FBFDFF] px-6 py-10 text-center"
            >
              <p class="text-[14px] font-bold text-[#0F172A]">No clients connected yet</p>
              <p class="mx-auto mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[#52627A]">
                Paste the server URL above into ChatGPT or Claude. Once you approve the permissions,
                the client appears here and you can disconnect it at any time.
              </p>
            </div>

            <div v-else-if="compact" class="compact-client-list">
              <article v-for="c in connections" :key="c.id" class="compact-client">
                <header><div><strong>{{ c.client_name }}</strong><code>{{ shortId(c.client_id) }}</code></div><span :class="c.is_active ? 'client-active' : 'client-inactive'">{{ c.is_active ? 'Active' : 'Disconnected' }}</span></header>
                <dl><div><dt>Permissions</dt><dd>{{ (c.scope_labels || []).join(', ') || 'None listed' }}</dd></div><div><dt>Workspaces</dt><dd>{{ c.workspaces?.length ? c.workspaces.map(w => w.name).join(', ') : 'All you can reach' }}</dd></div><div><dt>Connected</dt><dd>{{ fmtDate(c.granted_at) }}</dd></div><div><dt>Last used</dt><dd>{{ c.last_used_at ? fmtDate(c.last_used_at) : 'Never' }}<span v-if="c.active_sessions"> / {{ c.active_sessions }} live sessions</span></dd></div></dl>
                <footer><button v-if="c.is_active" type="button" class="compact-disconnect" :disabled="revoking === c.id" @click="disconnect(c)">{{ revoking === c.id ? 'Disconnecting...' : 'Disconnect' }}</button><span v-else>Disconnected {{ fmtDate(c.revoked_at) }}</span></footer>
              </article>
            </div>
            <!-- Table -->
            <div v-else class="mt-4 overflow-x-auto">
              <table class="w-full min-w-[820px] border-separate border-spacing-0">
                <thead>
                  <tr class="text-left">
                    <th class="border-b border-[#E6EDF7] pb-2.5 pr-4 text-[12px] font-[800] uppercase tracking-wide text-[#667994]">Client</th>
                    <th class="border-b border-[#E6EDF7] pb-2.5 pr-4 text-[12px] font-[800] uppercase tracking-wide text-[#667994]">Permissions</th>
                    <th class="border-b border-[#E6EDF7] pb-2.5 pr-4 text-[12px] font-[800] uppercase tracking-wide text-[#667994]">Workspaces</th>
                    <th class="border-b border-[#E6EDF7] pb-2.5 pr-4 text-[12px] font-[800] uppercase tracking-wide text-[#667994]">Last used</th>
                    <th class="border-b border-[#E6EDF7] pb-2.5 text-right text-[12px] font-[800] uppercase tracking-wide text-[#667994]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in connections" :key="c.id" class="align-top">
                    <td class="border-b border-[#F1F5F9] py-4 pr-4">
                      <!-- client_name is CLIENT-SUPPLIED. Rendered as plain text beside the stable
                           client_id so it reads as a label, never as an identity claim. -->
                      <div class="text-[13.5px] font-[800] text-[#0F172A]">{{ c.client_name }}</div>
                      <div class="mt-0.5 font-mono text-[11.5px] text-[#8497AF]">{{ shortId(c.client_id) }}</div>
                      <div class="mt-1 text-[12px] text-[#667994]">Connected {{ fmtDate(c.granted_at) }}</div>
                    </td>
                    <td class="border-b border-[#F1F5F9] py-4 pr-4">
                      <div class="flex max-w-[320px] flex-wrap gap-1.5">
                        <span
                          v-for="(label, i) in (c.scope_labels || []).slice(0, 4)"
                          :key="i"
                          class="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11.5px] font-semibold text-[#334155]"
                        >{{ label }}</span>
                        <span
                          v-if="(c.scope_labels || []).length > 4"
                          class="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11.5px] font-semibold text-[#667994]"
                          :title="(c.scope_labels || []).join(', ')"
                        >+{{ c.scope_labels.length - 4 }} more</span>
                      </div>
                    </td>
                    <td class="border-b border-[#F1F5F9] py-4 pr-4 text-[13px] text-[#334155]">
                      <template v-if="c.workspaces && c.workspaces.length">
                        <div v-for="w in c.workspaces" :key="w.id" class="font-semibold">{{ w.name }}</div>
                      </template>
                      <span v-else class="text-[#667994]">All you can reach</span>
                    </td>
                    <td class="border-b border-[#F1F5F9] py-4 pr-4 text-[13px] text-[#334155]">
                      {{ c.last_used_at ? fmtDate(c.last_used_at) : 'Never' }}
                      <div v-if="c.active_sessions" class="mt-0.5 text-[12px] text-[#667994]">
                        {{ c.active_sessions }} live session{{ c.active_sessions === 1 ? '' : 's' }}
                      </div>
                    </td>
                    <td class="border-b border-[#F1F5F9] py-4 text-right">
                      <div v-if="c.is_active" class="flex items-center justify-end gap-2.5">
                        <span class="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#067647]">
                          <span class="h-1.5 w-1.5 rounded-full bg-[#12B76A]"></span> Active
                        </span>
                        <button
                          class="h-8 rounded-[8px] border border-[#FDA29B] bg-white px-3 text-[12.5px] font-bold text-[#B42318] hover:bg-[#FFFBFA] disabled:opacity-50"
                          :disabled="revoking === c.id"
                          @click="disconnect(c)"
                        >{{ revoking === c.id ? 'Disconnecting…' : 'Disconnect' }}</button>
                      </div>
                      <span v-else class="text-[12px] font-bold text-[#667994]">
                        Disconnected {{ fmtDate(c.revoked_at) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup>
/**
 * Integrations — the AADML MCP section.
 *
 * Scope note: this page is the eventual home for every integration surface (connected accounts,
 * third-party MCP servers, API services, tools, OAuth providers — see INTEGRATIONS_HUB_PLAN.md). Only
 * the AADML MCP section ships here; the others keep their existing pages until their sections exist,
 * which is why the sidebar still carries "Connectors" alongside this entry.
 *
 * "MCP" points two directions in this product and the wording here is deliberate: this section is AADML
 * exposing ITSELF (inbound — ChatGPT/Claude drive AADML). The separate Connectors page manages
 * third-party MCP servers AADML consumes (outbound). Neither is ever labelled bare "MCP".
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bot, Copy, Info, Plug, RefreshCw } from 'lucide-vue-next'

import api from '../services/api'
import AgentIntegrationsList from '../components/integrations/AgentIntegrationsList.vue'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const props = defineProps({ compact: { type: Boolean, default: false } })
const modalTab = ref('agents')
const info = ref(null)
const connections = ref([])
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const revoking = ref(null)
const clientTab = ref('chatgpt')

const activeCount = computed(() => connections.value.filter((c) => c.is_active).length)

const route = useRoute()
const router = useRouter()
const tab = computed(() => props.compact ? modalTab.value : (route.query.tab === 'mcp' ? 'mcp' : 'agents'))
const pageTabs = computed(() => [
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'mcp', label: 'AADML as an MCP server', icon: Plug, badge: activeCount.value || null },
])
function setTab(id) {
  if (props.compact) modalTab.value = id
  else router.replace({ query: { ...route.query, tab: id } })
}

// Instructions are per-client because the two products word the same flow differently, and a user
// following ChatGPT's wording inside Claude gives up rather than translating.
const clients = computed(() => [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    steps: [
      'Open Settings → Connectors and choose to add a custom connector.',
      'Paste the server URL above.',
      'ChatGPT sends you to AADML to sign in and approve the permissions and workspaces it may use.',
      'Approve, and it appears in the list below.',
    ],
  },
  {
    id: 'claude',
    label: 'Claude',
    steps: [
      'Open Settings → Connectors and add a custom connector.',
      'Paste the server URL above.',
      'Claude sends you to AADML to sign in and approve the permissions and workspaces it may use.',
      'Approve, and it appears in the list below.',
    ],
  },
])
const activeClient = computed(
  () => clients.value.find((c) => c.id === clientTab.value) || clients.value[0]
)

function shortId(clientId) {
  if (!clientId) return ''
  return clientId.length > 14 ? `${clientId.slice(0, 8)}…${clientId.slice(-4)}` : clientId
}

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text)
    notify.success(`${what} copied`)
  } catch {
    // Clipboard is permission-gated and blocked outright on insecure origins; the URL is on screen and
    // selectable, so this is an inconvenience rather than a dead end. Say which, and don't throw.
    notify.error('Could not copy automatically — select the URL and copy it manually.')
  }
}

async function load() {
  refreshing.value = true
  loadError.value = ''
  try {
    // Settled, not all: a failure to read usage/info must not blank out the connections list, which is
    // the half a user needs when they came here specifically to disconnect something.
    const [infoRes, connRes] = await Promise.allSettled([
      api.getAadmlMcpInfo(),
      api.getAadmlMcpConnections(),
    ])
    if (infoRes.status === 'fulfilled') info.value = infoRes.value.data
    if (connRes.status === 'fulfilled') connections.value = connRes.value.data?.connections || []
    if (infoRes.status === 'rejected' && connRes.status === 'rejected') {
      loadError.value = 'Could not load the MCP integration. Check your connection and try again.'
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function disconnect(connection) {
  const ok = await confirm({
    title: `Disconnect ${connection.client_name}?`,
    message:
      'It loses access immediately — any run it is in the middle of keeps going, but it cannot start '
      + 'or inspect anything else. Reconnecting later means approving the permissions again.',
    confirmText: 'Disconnect',
    danger: true,
  })
  if (!ok) return

  revoking.value = connection.id
  try {
    const { data } = await api.revokeAadmlMcpConnection(connection.id)
    // Replace in place rather than refetching: the row stays visible as "Disconnected <date>", which is
    // what answers "did I actually disconnect it, and when?" later.
    const i = connections.value.findIndex((c) => c.id === connection.id)
    if (i !== -1 && data?.connection) connections.value[i] = data.connection
    notify.success(`${connection.client_name} disconnected`)
  } catch (e) {
    notify.error(e?.response?.data?.detail || 'Could not disconnect that client. Try again.')
  } finally {
    revoking.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.integrations-page.integrations-compact{padding:16px 0 0;min-height:0;background:transparent}
.compact-integration-intro{font-size:12px;line-height:1.5;color:#718096;margin:0 0 18px}
.integrations-compact>div>nav{gap:4px;margin-bottom:18px}.integrations-compact>div>nav button{font-size:12px;padding:8px 10px}
.integrations-compact .mcp-setup-grid{grid-template-columns:minmax(0,1fr);gap:16px;padding:16px}.integrations-compact section>div{padding:16px}.integrations-compact h2{font-size:14px}.integrations-compact :deep(.lg\:grid-cols-4){grid-template-columns:repeat(2,minmax(0,1fr))}.integrations-compact :deep(.sm\:grid-cols-3){grid-template-columns:1fr}
.compact-client-list{display:grid;gap:12px;margin-top:16px}.compact-client{padding:14px;border:1px solid #e5eaf1;border-radius:9px;background:#fff}.compact-client header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.compact-client header>div{min-width:0;display:grid;gap:4px}.compact-client strong{font-size:13px;color:#263246;overflow-wrap:anywhere}.compact-client code{font-size:10px;color:#8492a7}.compact-client header>span{font-size:10px;border-radius:5px;padding:3px 7px;flex-shrink:0}.client-active{color:#157a53;background:#edf8f1}.client-inactive{color:#64748b;background:#f1f5f9}
.compact-client dl{margin:14px 0 0;display:grid;gap:8px;font-size:11px}.compact-client dl>div{display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px}.compact-client dt{color:#8490a2}.compact-client dd{margin:0;color:#475569;overflow-wrap:anywhere;line-height:1.5}.compact-client footer{display:flex;justify-content:flex-end;border-top:1px solid #f0f2f6;padding-top:10px;margin-top:12px;font-size:11px;color:#8490a2}.compact-disconnect{border:1px solid #f2c6c9;background:#fff;color:#b43c49;border-radius:6px;padding:5px 9px;font-size:11px;cursor:pointer}.compact-disconnect:disabled{opacity:.5}.compact-disconnect:hover{background:#fff5f5}
</style>
