<template>
  <div class="connectors-container p-6 lg:p-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-g-brand flex items-center justify-center shrink-0 shadow-glow-v">
              <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
            </div>
            Connectors
          </h1>
          <p class="mt-1.5 text-sm sm:text-base text-ink-soft">
            One home for tools, services &amp; MCP — connect with your account, scope globally or per agent.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Preview
          </span>
        </div>
      </div>

      <!-- Toolbar: scope · summary · add connector -->
      <div class="conn-toolbar">
        <div class="scope-box">
          <span class="scope-label">Scope</span>
          <div class="scope-field">
            <svg class="ic" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/><circle cx="12" cy="12" r="9"/></svg>
            <select v-model="scope">
              <option value="global">Global — all your agents</option>
              <optgroup v-if="agents.length" label="Specific agent">
                <option v-for="a in agents" :key="a.id" :value="`agent:${a.id}`">{{ a.name }}</option>
              </optgroup>
            </select>
          </div>
          <span class="scope-hint">{{ scope === 'global' ? 'Available to every agent you own' : 'Only this agent' }}</span>
        </div>
        <div class="toolbar-right">
          <div class="stat-chips">
            <span class="stat-chip"><b class="ok">{{ connected.length }}</b> connected</span>
            <span class="stat-chip"><b>{{ notConnected.length }}</b> available</span>
            <span class="stat-chip"><b>{{ totalTools }}</b> tools</span>
          </div>
          <div class="add-wrap">
            <button class="add-btn" @click="addMenuOpen = !addMenuOpen">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"></path></svg>
              Add connector
            </button>
            <template v-if="addMenuOpen">
              <div class="fixed inset-0 z-10" @click="addMenuOpen = false"></div>
              <div class="add-menu">
                <button @click="openCustomMcp" class="add-menu-item">
                  <span class="add-menu-title">Custom MCP</span>
                  <span class="add-menu-sub">stdio · http · sse server</span>
                </button>
                <button @click="openRegisterService" class="add-menu-item">
                  <span class="add-menu-title">Register service</span>
                  <span class="add-menu-sub">From OpenAPI / Postman spec</span>
                </button>
                <button @click="openDrafts" class="add-menu-item">
                  <span class="add-menu-title">Service drafts</span>
                  <span class="add-menu-sub">Resume or delete drafts</span>
                </button>
                <button @click="openBrowse" class="add-menu-item">
                  <span class="add-menu-title">Browse</span>
                  <span class="add-menu-sub">Integration directory</span>
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 2-pane: connector list · detail -->
      <div class="conn-grid">
        <!-- ── Connector list ── -->
        <section class="pane list-pane">
          <div v-if="loading" class="pane-state">Loading connectors…</div>
          <div v-else-if="error" class="pane-state err">{{ error }}</div>

          <template v-else>
            <!-- Connected -->
            <div class="group-block">
              <div class="group-head">Connected <span>{{ connected.length }}</span></div>
              <p v-if="!connected.length" class="group-empty">Nothing connected in this scope yet.</p>
              <button v-for="c in connected" :key="c.kind + c.id" @click="select(c)" :class="['conn-row', { active: isActive(c) }]">
                <span class="connector-icon" :class="iconTint(c)"><Icon v-if="isIconify(c)" :icon="c.icon" class="w-5 h-5" /><template v-else>{{ iconFor(c) }}</template></span>
                <span class="row-text">
                  <span class="row-name">{{ c.name }}</span>
                  <span class="row-sub">{{ kindLabel(c) }} · {{ c.tool_count_total }} tool{{ c.tool_count_total === 1 ? '' : 's' }}</span>
                </span>
                <span class="status-pill on"><span class="vm-orb is-live"></span>Connected</span>
              </button>
            </div>

            <!-- Not connected -->
            <div class="group-block">
              <div class="group-head">Available <span>{{ notConnected.length }}</span></div>
              <p v-if="!notConnected.length" class="group-empty">Everything available is connected.</p>
              <button v-for="c in notConnected" :key="c.kind + c.id" @click="select(c)" :class="['conn-row', { active: isActive(c) }]">
                <span class="connector-icon" :class="iconTint(c)"><Icon v-if="isIconify(c)" :icon="c.icon" class="w-5 h-5" /><template v-else>{{ iconFor(c) }}</template></span>
                <span class="row-text">
                  <span class="row-name">{{ c.name }}</span>
                  <span class="row-sub">{{ kindLabel(c) }} · {{ authLabel(c) }}</span>
                </span>
                <span class="status-pill off">{{ authLabel(c) }}</span>
              </button>
            </div>
          </template>
        </section>

        <!-- ── Right: detail panel ── -->
        <section class="pane detail-pane">
          <div v-if="!selected" class="detail-empty">
            <div class="de-orb">
              <svg fill="none" viewBox="0 0 24 24" stroke="#fff"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
            </div>
            <p class="de-title">No connector selected</p>
            <p class="de-sub">Pick a connector on the left to connect it and set per-tool permissions.</p>
          </div>

          <div v-else>
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-xl shrink-0"><Icon v-if="isIconify(selected)" :icon="selected.icon" class="w-6 h-6" /><template v-else>{{ iconFor(selected) }}</template></span>
                <div class="min-w-0">
                  <h2 class="text-lg font-bold text-ink truncate">{{ selected.name }}</h2>
                  <p class="text-[12px] text-ink-faint">
                    {{ kindLabel(selected) }} ·
                    <span :class="selected.connected ? 'text-emerald-600' : 'text-slate-400'">
                      {{ selected.connected ? 'Connected' : 'Not connected' }}
                    </span>
                    · {{ authLabel(selected) }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <!-- Built-in services are managed in the Integration Hub -->
                <button
                  v-if="selected.kind === 'builtin'"
                  @click="showHub = true"
                  class="px-3.5 py-2 rounded-xl text-[13px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100"
                >
                  {{ selected.connected ? 'Manage in Integration Hub' : 'Connect in Integration Hub' }}
                </button>
                <!-- OAuth: connect with your account / disconnect -->
                <template v-else-if="selected.auth_kind === 'oauth' && selected.provider_slug">
                  <button
                    v-if="!selected.connected"
                    @click="handleConnect(selected)"
                    :disabled="actionLoading"
                    class="px-3.5 py-2 rounded-xl text-[13px] font-semibold text-white bg-g-brand shadow-glow-v disabled:opacity-60 hover:opacity-95"
                  >
                    {{ actionLoading ? 'Connecting…' : 'Connect with your account' }}
                  </button>
                  <button
                    v-else
                    @click="handleDisconnect(selected)"
                    :disabled="actionLoading"
                    class="px-3.5 py-2 rounded-xl text-[13px] font-semibold text-red-600 bg-red-50 border border-red-200 disabled:opacity-60 hover:bg-red-100"
                  >
                    {{ actionLoading ? 'Working…' : 'Disconnect' }}
                  </button>
                </template>
                <!-- No-auth connectors -->
                <span v-else-if="selected.auth_kind === 'none'" class="text-[12px] text-ink-faint">
                  No connection required
                </span>
                <!-- Credential-backed (API key services, MCP env) -->
                <template v-else>
                  <button
                    @click="handleConnect(selected)"
                    class="px-3.5 py-2 rounded-xl text-[13px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100"
                  >
                    {{ selected.kind === 'mcp' ? 'Manage server' : 'Manage credentials' }}
                  </button>
                  <button
                    v-if="selected.kind === 'mcp'"
                    @click="handleRemoveMcp(selected)"
                    :disabled="actionLoading"
                    class="px-3.5 py-2 rounded-xl text-[13px] font-semibold text-red-600 bg-red-50 border border-red-200 disabled:opacity-60 hover:bg-red-100"
                  >
                    {{ actionLoading ? 'Working…' : 'Remove' }}
                  </button>
                </template>
                <!-- Full service management (edit actions, test, share, activate, delete) -->
                <button
                  v-if="selected.kind === 'service'"
                  @click="openServiceManage(selected)"
                  class="px-3.5 py-2 rounded-xl text-[13px] font-semibold text-ink-soft bg-slate-100 border border-slate-200 hover:bg-slate-200"
                >
                  Manage service
                </button>
              </div>
            </div>

            <p v-if="selected.description" class="mt-4 text-[13px] text-ink-soft leading-relaxed">{{ selected.description }}</p>

            <!-- Tool permissions (P3) -->
            <div class="mt-6">
              <div class="flex items-center justify-between">
                <span class="text-[13px] font-bold text-ink">Tool permissions</span>
                <span class="text-[11px] text-ink-faint">{{ scope === 'global' ? 'Global' : (scopeAgent?.name || 'Agent') }} scope</span>
              </div>

              <div v-if="toolsLoading" class="py-6 text-center text-[12px] text-ink-faint">Loading tools…</div>
              <p v-else-if="!toolGroups.readonly.length && !toolGroups.write.length" class="py-6 text-center text-[12px] text-ink-faint">
                No tools discovered for this connector{{ selected.kind === 'mcp' ? ' — refresh it on the MCP page.' : '.' }}
              </p>

              <template v-else>
                <div class="tool-scroll vm-scroll">
                <!-- Read-only group -->
                <div v-if="toolGroups.readonly.length" class="mt-3">
                  <div class="flex items-center gap-2 px-1 mb-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span class="text-[12px] font-bold text-ink">Read-only tools</span>
                    <span class="text-[11px] text-slate-400">{{ toolGroups.readonly.length }}</span>
                  </div>
                  <div
                    v-for="t in toolGroups.readonly"
                    :key="'ro-' + t.name"
                    class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50"
                  >
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-1.5 min-w-0">
                        <span class="text-[12px] font-semibold text-ink truncate" :title="t.name">{{ t.name }}</span>
                        <span v-if="t.approval_policy && t.approval_policy !== 'none'" :class="['approval-badge', 'ap-' + t.approval_policy]">{{ approvalLabel(t.approval_policy) }}</span>
                      </span>
                      <span v-if="t.locked" class="text-[10px] text-amber-600">Locked by global policy</span>
                    </span>
                    <span class="perm-toggle">
                      <button v-for="opt in PERM_OPTS" :key="opt" :disabled="t.locked || savingTool === t.name"
                        @click="setPermission(t, opt)"
                        :class="['perm-btn', t.permission === opt ? ('perm-' + opt) : 'perm-off']">{{ opt }}</button>
                    </span>
                  </div>
                </div>

                <!-- Write/delete group -->
                <div v-if="toolGroups.write.length" class="mt-3">
                  <div class="flex items-center gap-2 px-1 mb-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span class="text-[12px] font-bold text-ink">Write / delete tools</span>
                    <span class="text-[11px] text-slate-400">{{ toolGroups.write.length }}</span>
                  </div>
                  <div
                    v-for="t in toolGroups.write"
                    :key="'wr-' + t.name"
                    class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50"
                  >
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-1.5 min-w-0">
                        <span class="text-[12px] font-semibold text-ink truncate" :title="t.name">{{ t.name }}</span>
                        <span v-if="t.approval_policy && t.approval_policy !== 'none'" :class="['approval-badge', 'ap-' + t.approval_policy]">{{ approvalLabel(t.approval_policy) }}</span>
                      </span>
                      <span v-if="t.locked" class="text-[10px] text-amber-600">Locked by global policy</span>
                    </span>
                    <span class="perm-toggle">
                      <button v-for="opt in PERM_OPTS" :key="opt" :disabled="t.locked || savingTool === t.name"
                        @click="setPermission(t, opt)"
                        :class="['perm-btn', t.permission === opt ? ('perm-' + opt) : 'perm-off']">{{ opt }}</button>
                    </span>
                  </div>
                </div>
                </div>

                <p class="mt-3 text-[11px] text-ink-faint">
                  <strong>Allow</strong> runs automatically · <strong>Deny</strong> blocks the tool.
                  <span class="text-slate-400">“Ask” (human approval) is reserved — wiring lands in a later phase.</span>
                </p>
              </template>
            </div>
          </div>
        </section>
      </div>

      <!-- ── Execution sandboxes (Workspace, distinct section) ── -->
      <section class="sandboxes">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-xl bg-g-teal flex items-center justify-center shrink-0 shadow-glow-v">
              <svg class="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
            </span>
            <div>
              <h2 class="font-display text-[16px] font-bold text-ink leading-tight">Execution sandboxes</h2>
              <p class="text-[12px] text-ink-faint mt-0.5">The machines agents run tools on — a distinct section inside Connectors.</p>
            </div>
          </div>
          <button @click="openCreateWs" class="add-btn shrink-0">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"></path></svg>
            New sandbox
          </button>
        </div>

        <div v-if="wsLoading" class="py-8 text-center text-[13px] text-ink-faint">Loading sandboxes…</div>
        <div v-else-if="!workspaces.length" class="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 py-8 text-center">
          <p class="text-[13px] font-medium text-ink-soft">No execution sandboxes yet</p>
          <p class="text-[11px] text-ink-faint mt-0.5">A sandbox is a machine an agent runs its tools on.</p>
          <button @click="openCreateWs" class="mt-3 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100">Create your first sandbox</button>
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button v-for="w in workspaces" :key="w.id" @click="manageWs = w"
            class="group text-left rounded-xl border border-slate-200/70 bg-white px-4 py-3.5 flex items-center gap-3 hover:border-violet-300 hover:shadow-sm transition-all">
            <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 shrink-0">
              <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-[13px] font-bold text-ink truncate">{{ w.name }}</div>
              <div class="text-[11px] text-ink-faint truncate">
                <span :class="w.status === 'connected' ? 'text-emerald-600 font-semibold' : 'text-slate-400'">{{ wsStatusLabel(w.status) }}</span>
                · {{ (w.assigned_agents?.length || 0) }} agent{{ (w.assigned_agents?.length || 0) === 1 ? '' : 's' }}
              </div>
            </div>
            <span class="text-[11px] font-semibold text-violet-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Manage →</span>
          </button>
        </div>
      </section>
    </div>

    <!-- Credential slide-over (reuses the existing CredentialManager) -->
    <div
      v-if="credModalConnector"
      class="fixed inset-0 z-50 flex justify-end bg-black/30"
      @click.self="closeCredModal"
    >
      <div class="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <div class="text-[13px] font-bold text-ink truncate">
            {{ credModalConnector.name }} · credentials
            <span class="text-ink-faint font-medium">({{ scope === 'global' ? 'Global' : (scopeAgent?.name || 'Agent') }})</span>
          </div>
          <button @click="closeCredModal" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        <div class="flex-1 min-h-0 overflow-hidden">
          <CredentialManager :agentProfile="scopeAgent" :key="scopeAgent?.id || 'global'" />
        </div>
      </div>
    </div>

    <!-- Add / edit MCP server (reuses the existing MCPServerModal) — no redirect -->
    <MCPServerModal v-if="showMcpModal" :server="editMcpServer" @close="showMcpModal = false; editMcpServer = null" @saved="onMcpSaved" />

    <!-- Integration Hub directory (opened from + → Browse) -->
    <IntegrationHubModal v-if="showHub" :connectors="connectors" @close="showHub = false" @installed="loadConnectors" />

    <!-- Manage MCP server in-page (reuses MCPServerDetailModal) — no redirect to /dashboard/mcp -->
    <MCPServerDetailModal v-if="mcpDetail" :server="mcpDetail" @close="closeMcpDetail" @updated="openMcpManageRefresh" @edit="onMcpDetailEdit" />

    <!-- Register a service in-page (reuses ServiceRegistrationModal) — no redirect to the wizard page -->
    <ServiceRegistrationModal v-if="showServiceReg" @close="showServiceReg = false" @registered="onServiceRegistered" />

    <!-- Full service management in-page (edit actions, test, share, activate, delete) -->
    <ServiceDetailModal v-if="serviceManage" :service="serviceManage" @close="closeServiceManage" @updated="loadConnectors" />

    <!-- Service drafts (resume / delete incomplete registrations) -->
    <div v-if="showDrafts" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="showDrafts = false">
      <div class="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-[15px] font-bold text-ink">Service drafts</h3>
          <button @click="showDrafts = false" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        <p v-if="draftsLoading" class="py-6 text-center text-[13px] text-ink-faint">Loading…</p>
        <p v-else-if="!drafts.length" class="py-6 text-center text-[13px] text-ink-faint">No drafts. Start a new registration with “Register service”.</p>
        <div v-else class="space-y-2 max-h-80 overflow-y-auto">
          <div v-for="d in drafts" :key="d.id" class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
            <div class="min-w-0">
              <div class="text-[13px] font-semibold text-ink truncate">{{ d.name || 'Untitled draft' }}</div>
              <div class="text-[11px] text-ink-faint">Step {{ d.last_saved_step || 1 }} · draft</div>
            </div>
            <button @click="deleteDraft(d)" class="text-[12px] font-semibold text-red-600 hover:underline shrink-0">Delete</button>
          </div>
        </div>
        <p class="mt-3 text-[11px] text-ink-faint">Drafts auto-save during registration. To continue one, start “Register service” — your latest draft is restored.</p>
      </div>
    </div>

    <!-- Manage an execution sandbox in-page — no redirect to /dashboard/workspaces -->
    <WorkspaceManageModal v-if="manageWs" :workspace="manageWs" @close="manageWs = null" @changed="loadWorkspaces" />

    <!-- Create a sandbox -->
    <div v-if="showCreateWs" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="showCreateWs = false">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5">
        <h3 class="text-[15px] font-bold text-ink">New execution sandbox</h3>
        <p class="text-[12px] text-ink-faint mt-1">A sandbox represents a machine an agent runs its tools on.</p>
        <input
          v-model="newWsName"
          @keydown.enter="createWs"
          placeholder="e.g. Production server, Dev machine"
          class="mt-3 w-full px-3 py-2.5 text-[13px] text-ink bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
          autofocus
        />
        <div class="mt-4 flex justify-end gap-2">
          <button @click="showCreateWs = false" class="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-ink-soft bg-slate-100 hover:bg-slate-200">Cancel</button>
          <button @click="createWs" :disabled="!newWsName.trim() || creatingWs" class="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
            {{ creatingWs ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { connectOAuth } from '@/composables/useOAuthConnect'
import CredentialManager from '../components/tools/CredentialManager.vue'
import MCPServerModal from '../components/mcp/MCPServerModal.vue'
import MCPServerDetailModal from '../components/mcp/MCPServerDetailModal.vue'
import ServiceRegistrationModal from '../components/services/ServiceRegistrationModal.vue'
import ServiceDetailModal from '../components/services/ServiceDetailModal.vue'
import WorkspaceManageModal from '../components/connectors/WorkspaceManageModal.vue'
import IntegrationHubModal from '../components/connectors/IntegrationHubModal.vue'

const route = useRoute()

const loading = ref(true)
const error = ref('')
const connectors = ref([])
const agents = ref([])
const scope = ref('global')
const selected = ref(null)

const workspaces = ref([])
const wsLoading = ref(true)
const manageWs = ref(null)
const showCreateWs = ref(false)
const newWsName = ref('')
const creatingWs = ref(false)

const wsStatusLabel = (s) =>
  ({ connected: 'Connected', disconnected: 'Offline', pending: 'Pending' }[s] || s || 'Unknown')

function openCreateWs() {
  newWsName.value = ''
  showCreateWs.value = true
}
async function createWs() {
  if (!newWsName.value.trim()) return
  creatingWs.value = true
  try {
    const { data } = await api.post('/workspaces/', { name: newWsName.value.trim() })
    showCreateWs.value = false
    notify.success('Sandbox created')
    await loadWorkspaces()
    if (data?.id) manageWs.value = data
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to create sandbox')
  } finally {
    creatingWs.value = false
  }
}

const actionLoading = ref(false)
const credModalConnector = ref(null)
const addMenuOpen = ref(false)
const showMcpModal = ref(false)
const showServiceReg = ref(false)
const showHub = ref(false)
const mcpDetail = ref(null) // fetched { server, tools, ... } for the MCP manage modal
const editMcpServer = ref(null) // server object when editing config from the detail modal

function openCustomMcp() {
  addMenuOpen.value = false
  editMcpServer.value = null
  showMcpModal.value = true
}
function openBrowse() {
  addMenuOpen.value = false
  showHub.value = true
}
function openRegisterService() {
  addMenuOpen.value = false
  showServiceReg.value = true
}

// ── Full service management (ServiceDetailModal: edit/test/share/activate/delete) ──
const serviceManage = ref(null)
async function openServiceManage(c) {
  try {
    const { data } = await api.getService(c.id)
    serviceManage.value = data.service || data
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to load service')
  }
}
function closeServiceManage() {
  serviceManage.value = null
  loadConnectors()
}

// ── Service drafts ──
const showDrafts = ref(false)
const drafts = ref([])
const draftsLoading = ref(false)
async function openDrafts() {
  addMenuOpen.value = false
  showDrafts.value = true
  draftsLoading.value = true
  try {
    const { data } = await api.listDrafts()
    drafts.value = data.drafts || data.services || data || []
  } catch {
    drafts.value = []
  } finally {
    draftsLoading.value = false
  }
}
async function deleteDraft(d) {
  if (!(await confirm({ title: 'Delete draft?', message: `Delete the draft "${d.name || 'Untitled'}"?`, confirmText: 'Delete', danger: true }))) return
  try {
    await api.deleteService(d.id)
    drafts.value = drafts.value.filter((x) => x.id !== d.id)
    notify.success('Draft deleted')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to delete draft')
  }
}
function onMcpSaved() {
  showMcpModal.value = false
  editMcpServer.value = null
  notify.success('MCP server saved')
  loadConnectors()
}
function onServiceRegistered() {
  showServiceReg.value = false
  notify.success('Service registered')
  loadConnectors()
}

// Remove (delete) an MCP server connector entirely — in-page, with confirm.
async function handleRemoveMcp(c) {
  if (!(await confirm({
    title: 'Remove connector?',
    message: `Remove "${c.name}"? This deletes the MCP server configuration and its tools. This cannot be undone.`,
    confirmText: 'Remove',
    danger: true,
  }))) return
  actionLoading.value = true
  try {
    await api.deleteMCPServer(c.id)
    notify.success(`Removed ${c.name}`)
    selected.value = null
    await loadConnectors()
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to remove connector')
  } finally {
    actionLoading.value = false
  }
}

// Open the MCP server manager IN-PAGE (no redirect to the old MCP page).
async function openMcpManage(c) {
  try {
    const { data } = await api.getMCPServer(c.id)
    mcpDetail.value = data
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to load MCP server')
  }
}
function onMcpDetailEdit() {
  editMcpServer.value = mcpDetail.value?.server || null
  mcpDetail.value = null
  showMcpModal.value = true
}
async function openMcpManageRefresh() {
  const id = mcpDetail.value?.server?.id
  if (!id) return
  try {
    const { data } = await api.getMCPServer(id)
    mcpDetail.value = data
  } catch {
    /* keep the current view on refresh failure */
  }
}
function closeMcpDetail() {
  mcpDetail.value = null
  loadConnectors()
}

const connected = computed(() => connectors.value.filter((c) => c.connected))
const notConnected = computed(() => connectors.value.filter((c) => !c.connected))
const totalTools = computed(() => connectors.value.reduce((n, c) => n + (c.tool_count_total || 0), 0))
const isActive = (c) => !!selected.value && selected.value.kind === c.kind && selected.value.id === c.id

// The agent object backing the current scope (null = global). Passed to
// CredentialManager so created credentials land in the right scope.
const scopeAgent = computed(() => {
  if (scope.value === 'global') return null
  const id = Number(scope.value.split(':')[1])
  return agents.value.find((a) => a.id === id) || null
})

async function handleConnect(c) {
  if (c.auth_kind === 'oauth' && c.provider_slug) {
    actionLoading.value = true
    try {
      await connectOAuth(api, c.provider_slug, {})
      notify.success(`Connected to ${c.name}`)
      await loadConnectors()
    } catch (e) {
      notify.error(e.message || 'Connection failed')
    } finally {
      actionLoading.value = false
    }
    return
  }
  if (c.kind === 'service') {
    credModalConnector.value = c
    return
  }
  if (c.kind === 'mcp') {
    openMcpManage(c)
  }
}

async function handleDisconnect(c) {
  if (c.auth_kind === 'oauth' && c.provider_slug) {
    if (!(await confirm(`Disconnect from ${c.name}? Agents using this connection will lose access.`))) return
    actionLoading.value = true
    try {
      await api.disconnectConnection(c.provider_slug)
      notify.success(`Disconnected ${c.name}`)
      await loadConnectors()
    } catch (e) {
      notify.error(e?.response?.data?.error || 'Failed to disconnect')
    } finally {
      actionLoading.value = false
    }
    return
  }
  if (c.kind === 'service') {
    credModalConnector.value = c
  } else if (c.kind === 'mcp') {
    openMcpManage(c)
  }
}

function closeCredModal() {
  credModalConnector.value = null
  loadConnectors()
}

// ── P3: per-tool permissions ──
const PERM_OPTS = ['allow', 'ask', 'deny']
const toolsLoading = ref(false)
const toolGroups = ref({ readonly: [], write: [] })
const savingTool = ref(null)

async function loadConnectorTools() {
  if (!selected.value) {
    toolGroups.value = { readonly: [], write: [] }
    return
  }
  toolsLoading.value = true
  try {
    const { data } = await api.getConnectorTools(selected.value.kind, selected.value.id, scope.value)
    toolGroups.value = { readonly: data.readonly || [], write: data.write || [] }
  } catch (e) {
    toolGroups.value = { readonly: [], write: [] }
    notify.error(e?.response?.data?.error || 'Failed to load tools')
  } finally {
    toolsLoading.value = false
  }
}

async function setPermission(tool, perm) {
  if (tool.locked || tool.permission === perm) return
  savingTool.value = tool.name
  const prev = tool.permission
  tool.permission = perm // optimistic
  try {
    await api.updateConnectorPermissions(selected.value.kind, selected.value.id, scope.value, {
      [tool.name]: perm,
    })
  } catch (e) {
    tool.permission = prev
    notify.error(e?.response?.data?.error || 'Failed to update permission')
  } finally {
    savingTool.value = null
  }
}

watch(selected, loadConnectorTools)

function kindLabel(c) {
  return { mcp: 'MCP server', builtin: 'Built-in service' }[c.kind] || 'Service'
}
function authLabel(c) {
  return {
    oauth: 'OAuth', oauth2: 'OAuth', api_key: 'API key', env: 'Env vars', none: 'No auth',
    personal_access_token: 'Personal token', github_app: 'GitHub App',
  }[c.auth_kind] || c.auth_kind || ''
}
function isIconify(c) {
  return !!c.icon && c.icon.includes(':')
}
function iconFor(c) {
  if (c.icon && /\p{Extended_Pictographic}/u.test(c.icon)) return c.icon
  if (c.icon && c.icon.length <= 2) return c.icon
  return (c.name || '?').trim().charAt(0).toUpperCase()
}
function rowClass(c) {
  const active = selected.value && selected.value.kind === c.kind && selected.value.id === c.id
  return [
    'w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-colors',
    active ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-slate-50',
  ]
}
function iconTint(c) {
  return c.kind === 'mcp' ? 'tint-mcp' : 'tint-service'
}
function approvalLabel(p) {
  return { recommended: 'approval rec.', required: 'approval req.', hard: 'hard approval' }[p] || ''
}
function select(c) {
  selected.value = c
}

async function loadConnectors() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.getConnectors(scope.value)
    connectors.value = data.connectors || []
    // Keep selection if it still exists in the new scope, else clear.
    if (selected.value) {
      const match = connectors.value.find(
        (c) => c.kind === selected.value.kind && c.id === selected.value.id
      )
      selected.value = match || null
    }
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to load connectors.'
    notify.error(error.value)
  } finally {
    loading.value = false
  }
}

async function loadAgents() {
  try {
    const { data } = await api.getAgents()
    agents.value = data?.results || data || []
  } catch {
    agents.value = []
  }
}

async function loadWorkspaces() {
  wsLoading.value = true
  try {
    const { data } = await api.getWorkspaces()
    workspaces.value = data?.results || data?.workspaces || data || []
  } catch {
    workspaces.value = []
  } finally {
    wsLoading.value = false
  }
}

watch(scope, loadConnectors)

onMounted(async () => {
  // Deep-link: ?scope=agent:<id> (e.g. opened from the agent builder Tools step).
  const qScope = route.query.scope
  if (typeof qScope === 'string' && (qScope === 'global' || qScope.startsWith('agent:'))) {
    scope.value = qScope
  }
  // Parallel — independent loads (was: loadAgents awaited, blocking the rest).
  Promise.all([loadAgents(), loadConnectors(), loadWorkspaces()])
})
</script>

<style scoped>
/* ===== Connectors page — Vibrant Light Mesh layout ===== */
.conn-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  margin-bottom: 18px; padding: 12px 14px;
  background: var(--vm-glass-strong); border: 1px solid var(--vm-line); border-radius: var(--vm-r);
  box-shadow: var(--vm-shadow-s);
}
.scope-box { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
.scope-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--vm-ink-faint); }
.scope-field { position: relative; display: flex; align-items: center; }
.scope-field .ic { position: absolute; left: 11px; width: 15px; height: 15px; color: var(--vm-ink-faint); pointer-events: none; }
.scope-field select {
  appearance: none; padding: 9px 30px 9px 33px; border-radius: 12px; border: 1px solid var(--vm-line-2);
  background: var(--vm-surface); font: 600 13px var(--vm-font-sans); color: var(--vm-ink); cursor: pointer; min-width: 210px;
}
.scope-field select:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(14,165,233,.16); }
.scope-hint { font-size: 12px; color: var(--vm-ink-faint); }
.toolbar-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.stat-chips { display: flex; gap: 8px; }
.stat-chip { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); background: var(--vm-bg); border: 1px solid var(--vm-line); border-radius: 999px; padding: 5px 12px; }
.stat-chip b { color: var(--vm-ink); font-weight: 800; } .stat-chip b.ok { color: var(--vm-green); }
.add-wrap { position: relative; }
.add-btn {
  display: inline-flex; align-items: center; gap: 7px; border: none; cursor: pointer;
  padding: 9px 16px; border-radius: 12px; background: var(--vm-g-brand); color: #fff;
  font: 700 13px var(--vm-font-sans); box-shadow: var(--vm-glow-v); transition: transform .15s var(--vm-ease);
}
.add-btn:hover { transform: translateY(-1px); }
.add-btn svg { width: 15px; height: 15px; }
.add-menu { position: absolute; right: 0; top: calc(100% + 8px); width: 230px; z-index: 20;
  background: var(--vm-glass-strong); backdrop-filter: blur(18px); border: 1px solid var(--vm-line);
  border-radius: 14px; box-shadow: var(--vm-shadow-l); padding: 6px; }

.conn-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
@media (min-width: 1024px) { .conn-grid { grid-template-columns: minmax(320px, 380px) 1fr; } }
.pane { background: var(--vm-glass-strong); border: 1px solid var(--vm-line); border-radius: var(--vm-r-l); box-shadow: var(--vm-shadow-m); }
.list-pane { padding: 12px; min-height: 460px; }
.detail-pane { padding: 22px; min-height: 460px; }
.pane-state { padding: 48px 12px; text-align: center; font-size: 13px; color: var(--vm-ink-faint); }
.pane-state.err { color: var(--vm-danger); }

.group-block + .group-block { margin-top: 16px; }
.group-head { display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--vm-ink-faint); }
.group-head span { color: var(--vm-ink-faint); background: var(--vm-bg); border: 1px solid var(--vm-line); border-radius: 999px; padding: 0 7px; font-size: 10px; }
.group-empty { padding: 10px 12px; font-size: 12px; color: var(--vm-ink-faint); }

.conn-row {
  width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 12px; border: 1px solid transparent;
  border-radius: 15px; cursor: pointer; transition: background .15s var(--vm-ease2), box-shadow .15s, transform .15s var(--vm-ease2), border-color .15s;
}
.conn-row:hover { background: var(--vm-surface); box-shadow: var(--vm-shadow-s); transform: translateX(2px); }
.conn-row.active { background: var(--vm-surface); border-color: rgba(124,58,237,.3); box-shadow: var(--vm-shadow-m); }
.row-text { min-width: 0; flex: 1; text-align: left; display: flex; flex-direction: column; }
.row-name { font-size: 13px; font-weight: 700; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-sub { font-size: 11px; color: var(--vm-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
.status-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 999px; flex-shrink: 0; }
.status-pill.on { color: #059669; background: rgba(16,185,129,.12); }
.status-pill.off { color: var(--vm-ink-faint); background: var(--vm-bg); border: 1px solid var(--vm-line); }

.detail-empty { height: 100%; min-height: 380px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.de-orb { width: 64px; height: 64px; border-radius: 20px; background: var(--vm-g-brand); display: flex; align-items: center; justify-content: center; box-shadow: var(--vm-glow-v); margin-bottom: 16px; animation: vmFloat 5s ease-in-out infinite; }
.de-orb svg { width: 28px; height: 28px; }
.de-title { font-family: var(--vm-font-display); font-size: 15px; font-weight: 700; color: var(--vm-ink); }
.de-sub { font-size: 12.5px; color: var(--vm-ink-faint); margin-top: 6px; max-width: 260px; }

.sandboxes { margin-top: 18px; background: var(--vm-glass-strong); border: 1px solid var(--vm-line); border-radius: var(--vm-r-l); box-shadow: var(--vm-shadow-m); padding: 20px; }

/* Tool-permissions list scrolls within a fixed height (header + footer note stay put) */
.tool-scroll { max-height: 48vh; overflow-y: auto; margin-top: 4px; padding-right: 4px; }

.connector-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  font-weight: 800;
  border-radius: 11px;
}
.tint-service {
  background: linear-gradient(135deg, #ede9fe, #eef2ff);
  border: 1px solid #ddd6fe;
  color: #1D4ED8;
}
.tint-mcp {
  background: linear-gradient(135deg, #f1f5f9, #f8fafc);
  border: 1px solid #e2e8f0;
  color: #475569;
}
.add-menu-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 9px;
  transition: background 0.12s;
}
.add-menu-item:not(.cursor-not-allowed):hover {
  background: #f1f5f9;
}
.add-menu-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--vm-ink, #0f172a);
}
.add-menu-sub {
  font-size: 0.6875rem;
  color: var(--vm-ink-faint, #94a3b8);
  margin-top: 1px;
}

/* Per-tool permission segmented toggle */
.perm-toggle {
  display: inline-flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 2px;
  background: #f1f5f9;
  border-radius: 9px;
}
.perm-btn {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: capitalize;
  padding: 3px 9px;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  color: #94a3b8;
  background: transparent;
  transition: all 0.12s;
}
.perm-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.perm-off:hover:not(:disabled) {
  color: #475569;
}
.perm-allow {
  background: #dcfce7;
  color: #15803d;
}
.perm-ask {
  background: #fef3c7;
  color: #b45309;
}
.perm-deny {
  background: #fee2e2;
  color: #dc2626;
}

/* Approval-policy badge on per-tool rows */
.approval-badge {
  flex-shrink: 0;
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 1px 5px;
  border-radius: 5px;
  white-space: nowrap;
}
.ap-recommended { background: #fef3c7; color: #b45309; }
.ap-required { background: #ffedd5; color: #c2410c; }
.ap-hard { background: #fee2e2; color: #dc2626; }
</style>
