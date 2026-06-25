<template>
  <div class="lc">
    <!-- ============================ LANDING ============================ -->
    <div v-if="!active" class="lc-landing vm-scroll">
      <div class="lc-wrap">
        <header class="lc-head">
          <span class="eyebrow"><span class="pip"></span> Coding workspace</span>
          <h1 class="title"><span class="vm-grad-text">Let's</span> Code</h1>
          <p class="sub">Connect GitHub, clone a repo into your workspace, and code it with an AI agent.</p>
        </header>

        <!-- Your projects -->
        <section v-if="projects.length" class="card">
          <div class="card-h"><Icon icon="lucide:folder-git-2" /> Your projects</div>
          <div class="proj-grid">
            <div v-for="p in projects" :key="p.repo_id" class="proj" @click="openProject(p)">
              <div class="proj-top">
                <Icon icon="lucide:folder-code" class="pi" />
                <span class="pn">{{ p.name }}</span>
                <button class="pdel" title="Remove project" @click.stop="removeProject(p)"><Icon icon="lucide:trash-2" /></button>
              </div>
              <div class="pu">{{ p.github_url }}</div>
              <div class="pfoot">
                <span class="pbadge" :class="phaseCls(p)"><span class="vm-orb" :class="phaseOrb(p)"></span>{{ phaseLabel(p) }}</span>
                <button v-if="phaseCls(p) === 'err'" class="pretry" @click.stop="retryProject(p)"><Icon icon="lucide:rotate-cw" /> Retry</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Clone a repository -->
        <section class="card">
          <div class="card-h"><Icon icon="logos:github-icon" /> Clone a repository</div>

          <div v-if="ghNotConnected" class="gh-connect">
            <p class="gh-t">Connect GitHub to browse your repositories</p>
            <p class="gh-s">Uses your connected GitHub account (Connectors) — no token in .env.</p>
            <button class="btn-primary" :disabled="connecting" @click="connectGithub">
              <Icon icon="logos:github-icon" /> {{ connecting ? 'Connecting…' : 'Connect GitHub' }}
            </button>
          </div>

          <template v-else>
            <div class="repo-bar">
              <div class="search">
                <Icon icon="lucide:search" />
                <input v-model="repoQuery" placeholder="Search your repositories…" />
              </div>
              <button class="link" :disabled="connecting" @click="connectGithub">{{ connecting ? '…' : 'Use a different account' }}</button>
            </div>
            <div v-if="loadingRepos" class="muted">Loading repositories…</div>
            <div v-else class="repo-list vm-scroll">
              <div v-for="r in filteredRepos" :key="r.full_name" class="repo">
                <div class="r-main">
                  <span class="r-name">{{ r.name }}</span>
                  <span v-if="r.private" class="r-priv">Private</span>
                  <span class="r-full">{{ r.full_name }}</span>
                </div>
                <button class="btn-clone" :disabled="cloningUrl === r.clone_url" @click="cloneRepo(r)">
                  <Icon :icon="cloningUrl === r.clone_url ? 'lucide:loader-2' : 'lucide:download'" :class="{ spin: cloningUrl === r.clone_url }" />
                  {{ cloningUrl === r.clone_url ? 'Cloning…' : 'Clone' }}
                </button>
              </div>
              <div v-if="!filteredRepos.length" class="muted">No repositories match.</div>
            </div>
          </template>
        </section>
      </div>
    </div>

    <!-- ============================ IDE ============================ -->
    <div v-else class="lc-ide">
      <div class="ide-bar">
        <button class="ide-back" @click="closeProject"><Icon icon="lucide:chevron-left" /> Projects</button>
        <span class="ide-proj"><Icon icon="lucide:folder-code" /> {{ active.name }}</span>
        <label class="ide-branch">
          <Icon icon="lucide:git-branch" />
          <select :value="active.branch" :disabled="switchingBranch || !crsReady" @change="onSwitchBranch($event.target.value)">
            <option :value="active.branch">{{ active.branch }}</option>
            <option v-for="b in branches.filter(b => b !== active.branch)" :key="b" :value="b">{{ b }}</option>
          </select>
        </label>
        <span class="ide-crs" :class="phaseCls(active)"><span class="vm-orb" :class="phaseOrb(active)"></span>{{ phaseLabel(active) }}</span>
        <button v-if="phaseCls(active) === 'err'" class="ide-retry" @click="retryProject(active)"><Icon icon="lucide:rotate-cw" /> Retry</button>
        <div class="ide-right-actions">
          <a class="ide-gh" :href="active.github_url" target="_blank" rel="noopener"><Icon icon="logos:github-icon" /> GitHub</a>
        </div>
      </div>

      <div ref="ideMainEl" class="ide-main">
        <div class="ide-left">
          <div class="ide-editor">
            <CodeBrowser v-if="active.clone_ready" :key="browserKey" :repository-id="Number(active.repo_id)" :system-id="Number(active.system_id)" :editable="true" :decorations="proposalDecorations" />
            <div v-else class="ide-cloning">
              <span class="vm-orb is-live"></span>
              <p>{{ phaseLabel(active) }}…</p>
              <p class="s">Your project is being prepared. The editor opens once files are ready.</p>
            </div>
          </div>
          <div class="ide-bottom" :class="{ collapsed: bottomCollapsed }">
            <BottomPanel :pipeline-log="pipelineLog" :activity="activity" :collapsed="bottomCollapsed" @toggle="bottomCollapsed = !bottomCollapsed" />
          </div>
        </div>
        <div class="ide-rightpane" :style="{ width: rightPaneWidth + 'px' }">
          <!-- Drag the left border to resize the chat area. -->
          <div class="rp-resize" :class="{ active: resizing }" title="Drag to resize" @mousedown="startResize"></div>
          <!-- Unified Coding Agent (flag-gated): one chat, no Code|Ask toggle. The chat owns its own header. -->
          <template v-if="unifiedEnabled">
            <div class="rp-body">
              <UnifiedAgentChat
                :system-id="active.system_id" :repo-id="active.repo_id"
                :crs-ready="crsReady" :export-enabled="unifiedExportEnabled"
                @changed="onChanged" @activity="onActivity" @proposal="onProposal"
              />
            </div>
          </template>
          <!-- Fallback: the existing Code | Ask split. -->
          <template v-else>
            <div class="rp-tabs">
              <button class="rp-tab" :class="{ on: chatMode === 'code' }" @click="chatMode = 'code'">
                <Icon icon="lucide:wand-2" /> Code
              </button>
              <button class="rp-tab" :class="{ on: chatMode === 'ask' }" @click="setAsk">
                <Icon icon="lucide:message-circle" /> Ask
              </button>
            </div>
            <div class="rp-body">
              <AgentChatPanel
                v-show="chatMode === 'code'"
                :system-id="active.system_id" :repo-id="active.repo_id"
                :crs-ready="crsReady" :agent-name="''"
                @changed="onChanged" @activity="onActivity" @proposal="onProposal"
              />
              <RepositoryChat
                v-if="askMounted" v-show="chatMode === 'ask'"
                :repository="{ id: Number(active.repo_id), name: active.name }"
                :system-id="Number(active.system_id)" :hide-header="true"
              />
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { connectOAuth } from '@/composables/useOAuthConnect'
import CodeBrowser from '../components/CodeBrowser.vue'
import RepositoryChat from '../components/RepositoryChat.vue'
import AgentChatPanel from '../components/letscode/AgentChatPanel.vue'
import UnifiedAgentChat from '../components/letscode/UnifiedAgentChat.vue'
import BottomPanel from '../components/letscode/BottomPanel.vue'

const projects = ref([])
const active = ref(null)
const browserKey = ref(0)
const bottomCollapsed = ref(false)
const pipelineLog = ref([])
const activity = ref([])
const chatMode = ref('code')      // 'code' (coding loop) | 'ask' (Q&A over the repo)
const askMounted = ref(false)
function setAsk() { askMounted.value = true; chatMode.value = 'ask' }
// Unified Coding Agent flag (backend UNIFIED_CODING_AGENT_ENABLED) — when on, render the single agent.
const unifiedEnabled = ref(false)
const unifiedExportEnabled = ref(false)
async function loadUnifiedConfig() {
  try {
    const r = await api.unifiedConfig()
    unifiedEnabled.value = !!r?.data?.enabled
    unifiedExportEnabled.value = !!r?.data?.export_enabled
  } catch (e) { unifiedEnabled.value = false }
}
const branches = ref([])
const switchingBranch = ref(false)

// ── Resizable chat pane (drag the left border) ──
const ideMainEl = ref(null)
const RP_MIN = 300
const rightPaneWidth = ref(Number(localStorage.getItem('lc.rightPaneWidth')) || 384)
const resizing = ref(false)
function startResize(e) {
  e.preventDefault()
  resizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
}
function onResize(e) {
  if (!resizing.value) return
  const rect = ideMainEl.value?.getBoundingClientRect()
  if (!rect) return
  const desired = rect.right - e.clientX                  // pane hugs the right edge
  const max = Math.max(RP_MIN, rect.width - 360)          // leave ≥360px for the editor
  rightPaneWidth.value = Math.round(Math.max(RP_MIN, Math.min(desired, max)))
}
function stopResize() {
  resizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
  localStorage.setItem('lc.rightPaneWidth', String(rightPaneWidth.value))
}

// GitHub repo browsing
const ghNotConnected = ref(false)
const connecting = ref(false)
const loadingRepos = ref(false)
const repos = ref([])
const repoQuery = ref('')
const cloningUrl = ref('')
const proposalDecorations = ref({})

let statusTimer = null
let ws = null

const crsReady = computed(() => active.value && (active.value.crs_status === 'ready' || active.value.phase === 'ready'))
const filteredRepos = computed(() => {
  const q = repoQuery.value.trim().toLowerCase()
  return q ? repos.value.filter(r => (r.full_name || '').toLowerCase().includes(q)) : repos.value
})

function phaseLabel(p) {
  return { cloning: 'Cloning', indexing: 'Indexing', switching: 'Switching branch', ready: 'Ready', error: 'Failed', pending: 'Preparing' }[p.phase]
    || (p.crs_status === 'ready' ? 'Ready' : 'Preparing')
}
function phaseCls(p) { return p.phase === 'ready' || p.crs_status === 'ready' ? 'ok' : (p.phase === 'error' ? 'err' : 'run') }
function phaseOrb(p) { return phaseCls(p) === 'ok' ? 'is-live' : 'is-idle' }

async function loadProjects() {
  try { const { data } = await api.listProjects(); projects.value = data.projects || [] }
  catch { projects.value = [] }
}

async function loadGithubRepos() {
  loadingRepos.value = true
  ghNotConnected.value = false
  try {
    const { data } = await api.githubListRepos()
    if (data.success) repos.value = data.repositories || []
    else ghNotConnected.value = true
  } catch (e) {
    if (e?.response?.data?.github_not_connected || e?.response?.status === 401) ghNotConnected.value = true
    else notify.error(e?.response?.data?.error || 'Failed to load repositories')
  } finally { loadingRepos.value = false }
}

async function connectGithub() {
  connecting.value = true
  try {
    await connectOAuth(api, 'github')
    notify.success('GitHub connected')
    repos.value = []
    await loadGithubRepos()
  } catch (e) { notify.error(e?.message || 'GitHub connection failed') }
  finally { connecting.value = false }
}

async function cloneRepo(r) {
  cloningUrl.value = r.clone_url
  try {
    const { data } = await api.createProject({ github_url: r.clone_url, name: r.name, branch: r.default_branch || 'main' })
    await loadProjects()
    openProject(data)
  } catch (e) {
    const d = e?.response?.data || {}
    if (d.github_not_connected) { ghNotConnected.value = true; notify.error('Connect GitHub first') }
    else notify.error(d.error || 'Failed to clone repository')
  } finally { cloningUrl.value = '' }
}

function openProject(p) {
  active.value = { ...p }
  pipelineLog.value = p.log || []
  activity.value = []
  chatMode.value = 'code'
  askMounted.value = false
  proposalDecorations.value = {}
  browserKey.value++
  pollStatus()
  connectWs()
  loadBranches()
}

// Live pipeline progress over WebSocket (polling below is the fallback).
function connectWs() {
  closeWs()
  if (!active.value) return
  try {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env.VITE_WS_HOST || window.location.host
    ws = new WebSocket(`${proto}//${host}/ws/lets-code/${active.value.repo_id}/`)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.event === 'status' && active.value) {
          const wasReady = active.value.clone_ready
          active.value = { ...active.value, ...msg.data }
          if (Array.isArray(msg.data.log)) pipelineLog.value = msg.data.log
          if (msg.data.clone_ready && !wasReady) browserKey.value++
        }
      } catch { /* ignore malformed frames */ }
    }
  } catch { /* WS optional — polling covers it */ }
}
function closeWs() { if (ws) { try { ws.close() } catch {} ws = null } }

async function loadBranches() {
  branches.value = []
  if (!active.value) return
  try { const { data } = await api.getProjectBranches(active.value.repo_id); branches.value = data.branches || [] }
  catch { branches.value = [] }
}

async function onSwitchBranch(branch) {
  if (!active.value || !branch || branch === active.value.branch) return
  const ok = await confirm({
    title: `Switch to "${branch}"?`,
    message: 'This checks out the branch in your workspace and re-indexes it. Unsaved edits and pending agent changes will be discarded.',
    confirmText: 'Switch branch', cancelText: 'Cancel', danger: true,
  })
  if (!ok) return
  switchingBranch.value = true
  try {
    const { data } = await api.switchProjectBranch(active.value.repo_id, branch)
    active.value = { ...active.value, ...data }
    pipelineLog.value = data.log || []
    notify.info(`Switching to ${branch}…`)
    pollStatus()   // phase → switching/indexing → ready; editor remounts when ready
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to switch branch')
  } finally {
    switchingBranch.value = false
  }
}

function pollStatus() {
  if (statusTimer) clearInterval(statusTimer)
  const tick = async () => {
    if (!active.value) return
    try {
      const { data } = await api.getProject(active.value.repo_id)
      const wasReady = active.value.clone_ready
      active.value = { ...active.value, ...data }
      if (data.log) pipelineLog.value = data.log
      if (data.clone_ready && !wasReady) browserKey.value++   // files now exist → mount/refresh editor
      if (data.phase === 'ready' || data.phase === 'error' || data.crs_status === 'ready' || data.crs_status === 'error') {
        if (statusTimer) { clearInterval(statusTimer); statusTimer = null }
      }
    } catch { /* keep polling */ }
  }
  tick()
  statusTimer = setInterval(tick, 7000)   // slow fallback; WebSocket drives live updates
}

function closeProject() {
  if (statusTimer) { clearInterval(statusTimer); statusTimer = null }
  closeWs()
  proposalDecorations.value = {}
  active.value = null
  loadProjects()
}

async function retryProject(p) {
  try {
    const { data } = await api.retryProject(p.repo_id)
    notify.info('Retrying…')
    if (active.value && active.value.repo_id === p.repo_id) {
      active.value = { ...active.value, ...data }
      pipelineLog.value = data.log || []
      pollStatus(); connectWs()
    } else {
      openProject(data)
    }
    loadProjects()
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Retry failed')
  }
}

async function removeProject(p) {
  const ok = await confirm({
    title: 'Remove project?',
    message: `Remove "${p.name}" and its local clone? The GitHub repository is not affected.`,
    confirmText: 'Remove', cancelText: 'Cancel', danger: true,
  })
  if (!ok) return
  try { await api.deleteProject(p.repo_id); notify.success('Project removed'); await loadProjects() }
  catch (e) { notify.error(e?.response?.data?.error || 'Failed to remove project') }
}

function onChanged() { browserKey.value++ }                         // refresh editor after accept/discard
function onActivity(lines) { if (Array.isArray(lines)) activity.value = lines }

// #4 inline decorations: map a proposal's diff → per-file added-line ranges for the editor.
function onProposal(task) { proposalDecorations.value = task ? decorationsFromDiff(task) : {} }
function decorationsFromDiff(task) {
  const text = task?.diff_text || ''
  if (!text) return {}
  const added = {}
  let path = null, newLine = 0
  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git')) { const m = raw.match(/ b\/(.+)$/); path = m ? m[1] : null; continue }
    if (!path) continue
    if (raw.startsWith('@@')) { const m = raw.match(/\+(\d+)/); newLine = m ? parseInt(m[1], 10) : 0; continue }
    if (raw.startsWith('+++') || raw.startsWith('---')) continue
    if (raw.startsWith('+')) { (added[path] = added[path] || []).push(newLine); newLine++ }
    else if (raw.startsWith('-')) { /* deletion — no new-file line */ }
    else { newLine++ }   // context line
  }
  const out = {}
  for (const p in added) out[p] = toRanges(added[p])
  return out
}
function toRanges(lines) {
  const s = [...new Set(lines)].sort((a, b) => a - b)
  const ranges = []
  let start = null, prev = null
  for (const n of s) {
    if (start === null) { start = prev = n; continue }
    if (n === prev + 1) { prev = n; continue }
    ranges.push({ start, end: prev }); start = prev = n
  }
  if (start !== null) ranges.push({ start, end: prev })
  return ranges
}

onMounted(async () => { loadUnifiedConfig(); await loadProjects(); loadGithubRepos() })
onBeforeUnmount(() => {
  if (statusTimer) clearInterval(statusTimer); closeWs()
  window.removeEventListener('mousemove', onResize); window.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.lc { height: 100%; font-family: var(--vm-font-sans); color: var(--vm-ink); }

/* ---------- Landing ---------- */
.lc-landing { height: 100%; overflow-y: auto; }
.lc-wrap { max-width: 900px; margin: 0 auto; padding: 30px 28px 60px; }
.lc-head { margin-bottom: 22px; }
.eyebrow { display: inline-flex; align-items: center; gap: 7px; font: 700 11px var(--vm-font-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--vm-violet-d); background: var(--vm-violet-soft); padding: 5px 11px; border-radius: 999px; }
.eyebrow .pip { width: 6px; height: 6px; border-radius: 50%; background: var(--vm-violet); }
.title { font-family: var(--vm-font-display); font-size: 38px; font-weight: 700; line-height: 1.02; letter-spacing: -.025em; margin-top: 12px; }
.sub { color: var(--vm-ink-soft); font-size: 15px; margin-top: 8px; }
.card { background: var(--vm-surface); border: 1px solid var(--vm-line); border-radius: var(--vm-r-l); box-shadow: var(--vm-shadow-m); padding: 20px; margin-top: 18px; }
.card-h { display: flex; align-items: center; gap: 9px; font: 700 14px var(--vm-font-sans); color: var(--vm-ink); margin-bottom: 14px; }
.card-h :deep(svg) { width: 18px; height: 18px; }
.proj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.proj { border: 1px solid var(--vm-line); border-radius: 14px; padding: 14px; cursor: pointer; transition: .18s var(--vm-ease2); background: var(--vm-surface); }
.proj:hover { border-color: var(--vm-violet); box-shadow: var(--vm-shadow-s); transform: translateY(-1px); }
.proj-top { display: flex; align-items: center; gap: 8px; }
.proj-top .pi { width: 16px; height: 16px; color: var(--vm-violet-d); }
.pn { flex: 1; font: 700 13.5px var(--vm-font-sans); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdel { border: none; background: transparent; color: var(--vm-ink-faint); cursor: pointer; opacity: 0; transition: .15s; }
.proj:hover .pdel { opacity: 1; } .pdel:hover { color: var(--vm-danger); } .pdel :deep(svg) { width: 14px; height: 14px; }
.pu { font-size: 11.5px; color: var(--vm-ink-faint); margin: 6px 0 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pbadge { display: inline-flex; align-items: center; gap: 6px; font: 700 10px var(--vm-font-sans); padding: 3px 9px; border-radius: 999px; }
.pbadge.ok { color: #059669; background: rgba(16,185,129,.12); } .pbadge.run { color: #B45309; background: rgba(245,158,11,.14); } .pbadge.err { color: var(--vm-danger); background: rgba(239,68,68,.1); }
.pfoot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pretry, .ide-retry { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-violet-d); font: 700 11px var(--vm-font-sans); padding: 4px 10px; border-radius: 8px; cursor: pointer; }
.pretry:hover, .ide-retry:hover { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.pretry :deep(svg), .ide-retry :deep(svg) { width: 12px; height: 12px; }

.gh-connect { text-align: center; padding: 22px; border: 1px dashed var(--vm-line-2); border-radius: 14px; }
.gh-t { font: 700 14px var(--vm-font-sans); color: var(--vm-ink); }
.gh-s { font-size: 12.5px; color: var(--vm-ink-soft); margin-top: 4px; }
.btn-primary { margin-top: 14px; display: inline-flex; align-items: center; gap: 8px; background: var(--vm-ink); color: #fff; border: none; padding: 10px 18px; border-radius: 12px; font: 700 13px var(--vm-font-sans); cursor: pointer; }
.btn-primary:hover { background: #000; } .btn-primary:disabled { opacity: .6; } .btn-primary :deep(svg) { width: 16px; height: 16px; }
.repo-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.search { flex: 1; display: flex; align-items: center; gap: 8px; background: var(--vm-surface-soft); border: 1px solid var(--vm-line-2); border-radius: 11px; padding: 8px 12px; }
.search :deep(svg) { width: 15px; height: 15px; color: var(--vm-ink-faint); }
.search input { flex: 1; border: none; background: transparent; outline: none; font: 13px var(--vm-font-sans); color: var(--vm-ink); }
.link { border: none; background: transparent; color: var(--vm-violet-d); font: 600 12.5px var(--vm-font-sans); cursor: pointer; white-space: nowrap; }
.link:hover { text-decoration: underline; }
.repo-list { max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.repo { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--vm-line); border-radius: 11px; }
.repo:hover { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.r-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.r-name { font: 700 13px var(--vm-font-sans); color: var(--vm-ink); }
.r-priv { font: 700 9px var(--vm-font-sans); text-transform: uppercase; color: #B45309; background: rgba(245,158,11,.14); padding: 2px 6px; border-radius: 5px; }
.r-full { font-size: 11.5px; color: var(--vm-ink-faint); }
.btn-clone { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink); font: 700 12px var(--vm-font-sans); padding: 7px 13px; border-radius: 10px; cursor: pointer; }
.btn-clone:hover:not(:disabled) { border-color: var(--vm-violet); color: var(--vm-violet-d); }
.btn-clone:disabled { opacity: .6; cursor: not-allowed; } .btn-clone :deep(svg) { width: 14px; height: 14px; }
.muted { color: var(--vm-ink-faint); font-size: 13px; padding: 14px 2px; }

/* ---------- IDE ---------- */
.lc-ide { display: flex; flex-direction: column; height: 100%; }
.ide-bar { display: flex; align-items: center; gap: 14px; padding: 9px 16px; border-bottom: 1px solid var(--vm-line); background: var(--vm-glass-strong); backdrop-filter: blur(14px); flex: 0 0 auto; }
.ide-back { display: inline-flex; align-items: center; gap: 4px; border: none; background: transparent; color: var(--vm-violet-d); font: 700 13px var(--vm-font-sans); cursor: pointer; }
.ide-back :deep(svg) { width: 16px; height: 16px; }
.ide-proj { display: inline-flex; align-items: center; gap: 7px; font: 800 14px var(--vm-font-display); color: var(--vm-ink); }
.ide-proj :deep(svg) { width: 16px; height: 16px; color: var(--vm-violet-d); }
.ide-branch { display: inline-flex; align-items: center; gap: 5px; font: 600 12px var(--vm-font-sans); color: var(--vm-ink-soft); background: var(--vm-surface-soft); border: 1px solid var(--vm-line); border-radius: 8px; padding: 4px 6px 4px 9px; }
.ide-branch :deep(svg) { width: 13px; height: 13px; }
.ide-branch select { border: none; background: transparent; font: 600 12px var(--vm-font-sans); color: var(--vm-ink); cursor: pointer; outline: none; max-width: 160px; }
.ide-branch select:disabled { cursor: not-allowed; color: var(--vm-ink-faint); }
.ide-crs { display: inline-flex; align-items: center; gap: 6px; font: 700 11px var(--vm-font-sans); padding: 4px 10px; border-radius: 999px; }
.ide-crs.ok { color: #059669; background: rgba(16,185,129,.12); } .ide-crs.run { color: #B45309; background: rgba(245,158,11,.14); } .ide-crs.err { color: var(--vm-danger); background: rgba(239,68,68,.1); }
.ide-right-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.ide-gh { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink); font: 700 12px var(--vm-font-sans); padding: 7px 12px; border-radius: 10px; }
.ide-gh :deep(svg) { width: 15px; height: 15px; }

.ide-main { flex: 1; min-height: 0; display: flex; }
.ide-left { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ide-editor { flex: 1; min-height: 0; position: relative; }
.ide-cloning { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: #0f172a; color: #cbd5e1; text-align: center; }
.ide-cloning p { font: 700 14px var(--vm-font-sans); } .ide-cloning .s { font-weight: 400; font-size: 12.5px; color: #94a3b8; max-width: 34ch; }
.ide-bottom { height: 220px; flex: 0 0 auto; }
.ide-bottom.collapsed { height: 38px; }
.ide-rightpane { position: relative; width: 384px; flex: 0 0 auto; display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--vm-line); }
/* Drag handle sitting over the left border. */
.rp-resize { position: absolute; left: -3px; top: 0; bottom: 0; width: 7px; cursor: col-resize; z-index: 6; }
.rp-resize::after { content: ''; position: absolute; left: 2px; top: 0; bottom: 0; width: 3px; background: transparent; transition: background .15s; }
.rp-resize:hover::after, .rp-resize.active::after { background: var(--vm-violet); }
.rp-tabs { display: flex; gap: 2px; padding: 6px 8px 0; flex: 0 0 auto; background: var(--vm-surface); border-bottom: 1px solid var(--vm-line); }
.rp-tab { display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--vm-ink-faint); font: 700 12px var(--vm-font-sans); padding: 8px 14px; cursor: pointer; border-bottom: 2px solid transparent; }
.rp-tab:hover { color: var(--vm-ink-soft); }
.rp-tab.on { color: var(--vm-violet-d); border-bottom-color: var(--vm-violet); }
.rp-tab :deep(svg) { width: 14px; height: 14px; }
.rp-body { flex: 1; min-height: 0; display: flex; }
.rp-body > * { flex: 1; min-height: 0; min-width: 0; }
/* AgentChatPanel already has its own left border; the pane provides one now */
.rp-body :deep(.acp) { border-left: none; }
</style>
