<template>
  <div class="lc">
    <!-- ============================ LANDING ============================ -->
    <div v-if="!active" class="lc-landing vm-scroll">
      <div class="lc-wrap">
        <header class="lc-head">
          <div class="lc-head-text">
            <h1 class="lc-title">Let's Code</h1>
            <p class="lc-sub">Start a new project or clone a GitHub repository, and build it with the coding agent.</p>
          </div>
          <div v-if="ghAccount && !ghNotConnected" class="lc-account">
            <span class="lc-account-name"><Icon icon="lucide:github" aria-hidden="true" /> GitHub: <b>{{ ghAccount }}</b></span>
            <button type="button" class="lc-textbtn" :disabled="connecting" @click="connectGithub">
              {{ connecting ? 'Connecting' : 'Switch account' }}
            </button>
          </div>
        </header>

        <div class="lc-cols">
          <!-- Your projects -->
          <section class="lc-col" aria-labelledby="lc-projects-h">
            <h2 id="lc-projects-h" class="lc-col-h">Your projects</h2>

            <!-- A new project needs no GitHub repository: it is published from Source control when the person wants. -->
            <form class="lc-new" @submit.prevent="createNewProject">
              <label class="lc-new-label" for="lc-new-name">New project</label>
              <div class="lc-new-row">
                <input id="lc-new-name" v-model="newName" class="lc-new-input" type="text" spellcheck="false" autocomplete="off"
                       placeholder="my-app" maxlength="100" :disabled="creating" :aria-invalid="!!newError" aria-describedby="lc-new-hint" />
                <button type="submit" class="lc-btn primary" :disabled="creating || !newName.trim()">
                  <Icon :icon="creating ? 'lucide:loader-2' : 'lucide:plus'" :class="{ spin: creating }" />
                  {{ creating ? 'Creating' : 'Create' }}
                </button>
              </div>
              <p v-if="newError" id="lc-new-hint" class="lc-new-err" role="alert">{{ newError }}</p>
              <p v-else id="lc-new-hint" class="lc-new-hint">Starts empty. No GitHub repository needed; publish it later from Source control.</p>
            </form>

            <ul v-if="projectsLoading" class="lc-list" aria-busy="true" aria-label="Loading projects">
              <li v-for="n in 3" :key="n" class="lc-skel-row"><span class="lc-skel w40"></span><span class="lc-skel w15"></span><span class="lc-skel w12 pill"></span></li>
            </ul>

            <p v-else-if="!projects.length" class="lc-empty">No projects yet. Start a new one above, or clone a repository.</p>

            <ul v-else class="lc-list">
              <li v-for="p in projects" :key="p.repo_id" class="proj" :class="{ failed: isFailed(p) }" @click="openProject(p)">
                <div class="proj-row">
                  <button type="button" class="proj-name" :title="`Open ${p.name}`" @click.stop="openProject(p)">{{ p.name }}</button>
                  <span v-if="p.branch" class="proj-branch"><Icon icon="lucide:git-branch" aria-hidden="true" />{{ p.branch }}</span>
                  <span v-if="p.is_new" class="proj-local" title="Not on GitHub yet: publish it from Source control">Not on GitHub</span>
                  <StatusPill :project="p" class="proj-pill" />
                  <button v-if="!isFailed(p)" type="button" class="proj-del" :aria-label="`Remove ${p.name}`" title="Remove project" @click.stop="removeProject(p)">
                    <Icon icon="lucide:trash-2" />
                  </button>
                </div>
                <div v-if="isFailed(p)" class="proj-fail" @click.stop>
                  <p class="proj-fail-msg"><Icon icon="lucide:circle-alert" aria-hidden="true" />{{ p.error_message || 'Preparing stopped without a reason. Retry to run it again.' }}</p>
                  <div class="proj-fail-actions">
                    <button type="button" class="lc-btn" :disabled="retryingId === p.repo_id" @click="retryProject(p, { startEmpty: p.failed_step === 'lost' })">
                      <Icon :icon="retryingId === p.repo_id ? 'lucide:loader-2' : (p.failed_step === 'lost' ? 'lucide:file-plus' : 'lucide:rotate-cw')" :class="{ spin: retryingId === p.repo_id }" />
                      {{ p.failed_step === 'lost' ? 'Start again empty' : 'Retry' }}
                    </button>
                    <button type="button" class="lc-btn danger" @click="removeProject(p)"><Icon icon="lucide:trash-2" /> Remove</button>
                  </div>
                </div>
              </li>
            </ul>
          </section>

          <!-- Clone from GitHub -->
          <section class="lc-col" aria-labelledby="lc-clone-h">
            <h2 id="lc-clone-h" class="lc-col-h">Clone from GitHub</h2>

            <div v-if="ghNotConnected" class="gh-connect">
              <Icon icon="lucide:github" class="gh-connect-ic" aria-hidden="true" />
              <p class="gh-t">Connect GitHub to see your repositories</p>
              <p class="gh-s">Let's Code lists the repositories of the GitHub account you connect, private ones included.</p>
              <button type="button" class="lc-btn primary" :disabled="connecting" @click="connectGithub">
                <Icon :icon="connecting ? 'lucide:loader-2' : 'lucide:github'" :class="{ spin: connecting }" />
                {{ connecting ? 'Connecting' : 'Connect GitHub' }}
              </button>
            </div>

            <template v-else>
              <label class="lc-search">
                <span class="sr-only">Search repositories</span>
                <Icon icon="lucide:search" aria-hidden="true" />
                <input v-model="repoQuery" type="search" placeholder="Search repositories" autocomplete="off" />
              </label>

              <ul v-if="loadingRepos" class="lc-list" aria-busy="true" aria-label="Loading repositories">
                <li v-for="n in 5" :key="n" class="lc-skel-row"><span class="lc-skel w35"></span><span class="lc-skel w20"></span><span class="lc-skel w12 btn"></span></li>
              </ul>
              <p v-else-if="!repos.length" class="lc-empty">This GitHub account has no repositories.</p>
              <p v-else-if="!filteredRepos.length" class="lc-empty">No repositories match "{{ repoQuery.trim() }}".</p>
              <ul v-else class="lc-list repo-list vm-scroll">
                <li v-for="r in filteredRepos" :key="r.full_name" class="repo">
                  <div class="repo-main">
                    <div class="repo-top">
                      <span class="repo-name" :title="r.full_name">{{ r.name }}</span>
                      <span v-if="r.private" class="repo-priv"><Icon icon="lucide:lock" aria-hidden="true" />Private</span>
                    </div>
                    <div class="repo-meta">
                      <span v-if="r.language && r.language !== 'Unknown'">{{ r.language }}</span>
                      <span v-if="r.pushed_at">Updated {{ relativeTime(r.pushed_at) }}</span>
                    </div>
                  </div>
                  <button type="button" class="lc-btn" :disabled="!!cloningUrl" :aria-label="`Clone ${r.full_name}`" @click="cloneRepo(r)">
                    <Icon :icon="cloningUrl === r.clone_url ? 'lucide:loader-2' : 'lucide:download'" :class="{ spin: cloningUrl === r.clone_url }" />
                    {{ cloningUrl === r.clone_url ? 'Cloning' : 'Clone' }}
                  </button>
                </li>
              </ul>
            </template>
          </section>
        </div>
      </div>
    </div>

    <!-- ============================ WORKSPACE ============================ -->
    <div v-else class="lc-ide">
      <div class="ide-bar">
        <button type="button" class="ide-back" @click="closeProject"><Icon icon="lucide:chevron-left" /> Projects</button>
        <span class="ide-proj" :title="active.name">{{ active.name }}</span>
        <span v-if="active.is_new" class="ide-branch off" title="Branches come with GitHub: publish the project from Source control">
          <Icon icon="lucide:git-branch" aria-hidden="true" /> {{ active.branch || 'main' }}
        </span>
        <label v-else class="ide-branch" :class="{ off: switchingBranch || !ready }">
          <span class="sr-only">Branch</span>
          <Icon icon="lucide:git-branch" aria-hidden="true" />
          <select :value="active.branch" :disabled="switchingBranch || !ready" @change="onSwitchBranch($event.target.value)">
            <option :value="active.branch">{{ active.branch }}</option>
            <option v-for="b in branches.filter(b => b !== active.branch)" :key="b" :value="b">{{ b }}</option>
          </select>
        </label>
        <StatusPill :project="active" />
        <a v-if="active.github_url" class="ide-gh" :href="githubWebUrl(active.github_url)" target="_blank" rel="noopener noreferrer" aria-label="Open on GitHub">
          <Icon icon="lucide:github" aria-hidden="true" /> <span class="ide-gh-t">Open on GitHub</span> <Icon icon="lucide:external-link" class="ext" aria-hidden="true" />
        </a>
      </div>

      <div ref="ideMainEl" class="ide-main">
        <div class="ide-left">
          <div class="ide-editor">
            <PipelineStepper v-if="!ready" :project="active" :log="pipelineLog" :retrying="retryingId === active.repo_id" @retry="(o) => retryProject(active, o)" />
            <CodeBrowser v-else ref="codeBrowser" :key="browserKey" :repository-id="Number(active.repo_id)" :system-id="Number(active.system_id)" :editable="true" :project-name="active.name" @published="onPublished" />
          </div>
          <div v-if="ready" class="ide-bottom" :class="{ collapsed: bottomCollapsed }">
            <BottomPanel :pipeline-log="pipelineLog" :activity="activity" :collapsed="bottomCollapsed" :repo-id="Number(active.repo_id)" :ready="ready" :agent-commands="agentCommands" @toggle="bottomCollapsed = !bottomCollapsed" />
          </div>
        </div>
        <div class="ide-rightpane" :style="{ '--rp-w': rightPaneWidth + 'px' }">
          <!-- Drag the left border to resize the chat area (arrow keys work too when focused). -->
          <div
            class="rp-resize" :class="{ active: resizing }" role="separator" aria-orientation="vertical"
            aria-label="Resize the chat" tabindex="0" :aria-valuenow="rightPaneWidth"
            @mousedown="startResize" @keydown="onResizeKey"
          ></div>
          <UnifiedAgentChat
            :key="active.repo_id"
            :system-id="active.system_id" :repo-id="active.repo_id" :crs-ready="ready"
            @changes="onChanges" @activity="onActivity" @view-changes="onViewChanges"
          />
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
import { usePoller } from '@/composables/usePoller'
import { reconnectingSocket } from '@/utils/reconnectingSocket'
import CodeBrowser from '../components/CodeBrowser.vue'
import UnifiedAgentChat from '../components/letscode/UnifiedAgentChat.vue'
import BottomPanel from '../components/letscode/BottomPanel.vue'
import PipelineStepper from '../components/letscode/PipelineStepper.vue'
import StatusPill from '../components/letscode/StatusPill.vue'
import { isReady, phaseTone, relativeTime, githubWebUrl } from '../components/letscode/projectStatus'

const projects = ref([])
const projectsLoading = ref(true)
const active = ref(null)
const browserKey = ref(0)
const codeBrowser = ref(null)
const bottomCollapsed = ref(false)
const pipelineLog = ref([])
const activity = ref([])
// The commands the Coding Agent ran in this project, for the Terminal tab's "Coding Agent" entry (ADM-1196).
const agentCommands = ref([])
const branches = ref([])
const switchingBranch = ref(false)
const retryingId = ref(null)

const ready = computed(() => isReady(active.value))
const isFailed = (p) => phaseTone(p) === 'err'

// ── Resizable chat pane (drag the left border, or arrow keys on the handle) ──
const ideMainEl = ref(null)
const RP_MIN = 300
const rightPaneWidth = ref(Number(localStorage.getItem('lc.rightPaneWidth')) || 384)
const resizing = ref(false)
function clampWidth(w) {
  const rect = ideMainEl.value?.getBoundingClientRect()
  const max = rect ? Math.max(RP_MIN, rect.width - 360) : 900    // leave ≥360px for the editor
  return Math.round(Math.max(RP_MIN, Math.min(w, max)))
}
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
  rightPaneWidth.value = clampWidth(rect.right - e.clientX)     // pane hugs the right edge
}
function stopResize() {
  resizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
  localStorage.setItem('lc.rightPaneWidth', String(rightPaneWidth.value))
}
function onResizeKey(e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  rightPaneWidth.value = clampWidth(rightPaneWidth.value + (e.key === 'ArrowLeft' ? 24 : -24))
  localStorage.setItem('lc.rightPaneWidth', String(rightPaneWidth.value))
}

// ── GitHub repositories ──
const ghNotConnected = ref(false)
const ghAccount = ref('')
const connecting = ref(false)
const loadingRepos = ref(false)
const repos = ref([])
const repoQuery = ref('')
const cloningUrl = ref('')

// ── New project (no GitHub repository, ADM-1183) ──
const newName = ref('')
const newError = ref('')
const creating = ref(false)

async function createNewProject() {
  const name = newName.value.trim()
  if (!name || creating.value) return
  creating.value = true
  newError.value = ''
  try {
    const { data } = await api.createProject({ name })
    newName.value = ''
    await loadProjects()
    openProject(data)
  } catch (e) {
    newError.value = e?.response?.data?.error || 'Could not create the project'
  } finally { creating.value = false }
}

const filteredRepos = computed(() => {
  const q = repoQuery.value.trim().toLowerCase()
  if (!q) return repos.value
  return repos.value.filter(r => (r.name || '').toLowerCase().includes(q) || (r.full_name || '').toLowerCase().includes(q))
})

async function loadProjects() {
  try { const { data } = await api.listProjects(); projects.value = data.projects || [] }
  catch { projects.value = [] }
  finally { projectsLoading.value = false }
}

async function loadGithubRepos() {
  loadingRepos.value = true
  ghNotConnected.value = false
  try {
    const { data } = await api.githubListRepos()
    if (data.success) { repos.value = data.repositories || []; ghAccount.value = data.account || '' }
    else ghNotConnected.value = true
  } catch (e) {
    if (e?.response?.data?.github_not_connected) ghNotConnected.value = true
    else notify.error(e?.response?.data?.error || 'Could not load your GitHub repositories')
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
  if (cloningUrl.value) return
  cloningUrl.value = r.clone_url
  try {
    const { data } = await api.createProject({ github_url: r.clone_url, name: r.name, branch: r.default_branch })
    await loadProjects()
    openProject(data)
  } catch (e) {
    const d = e?.response?.data || {}
    if (d.github_not_connected) { ghNotConnected.value = true; notify.error('Connect GitHub first') }
    else notify.error(d.error || 'Could not clone the repository')
  } finally { cloningUrl.value = '' }
}

function openProject(p) {
  active.value = { ...p }
  pipelineLog.value = p.log || []
  activity.value = []
  agentCommands.value = []
  browserKey.value++
  pollStatus()
  connectWs()
  loadBranches()
}

// Apply a status update to the open project. The editor remounts the moment the project turns ready.
function applyStatus(data) {
  const wasReady = isReady(active.value)
  active.value = { ...active.value, ...data }
  if (Array.isArray(data.log)) pipelineLog.value = data.log
  if (isReady(active.value) && !wasReady) browserKey.value++
}

// Live pipeline progress over WebSocket (polling below is the fallback). Reconnects after a drop; one
// socket, for the open project only.
const ws = reconnectingSocket({
  onOpen: () => sendWatch(),
  onMessage: (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      if (msg.event === 'status' && active.value && msg.data) { applyStatus(msg.data); sendWatch() }
      else if (msg.event === 'fs_changed' && msg.data) codeBrowser.value?.onFilesChanged?.(msg.data)
      else if (msg.event === 'watch' && msg.data) onWatchState(msg.data)
      else if (msg.event === 'agent_command' && msg.data) agentCommands.value = [...agentCommands.value, msg.data]
    } catch { /* ignore malformed frames */ }
  },
})

// LIVE FILE CHANGES (ADM-1196, Phase 2). While the editor is shown, the socket asks AADML to watch the project's
// files, and the editor reads again only what changed. Hidden tab: no watching. The person working says so at most
// once a minute; after 30 minutes without them AADML pauses watching (`paused`), and their next move resumes it. A
// watch never counts as use of the sandbox.
const watchState = ref('')
let lastActiveSent = 0
let saidWatchError = ''
function wantWatch() { return !!active.value && isReady(active.value) && !document.hidden }
function sendWatch() { ws.send(JSON.stringify({ type: wantWatch() ? 'watch' : 'unwatch' })) }
function onWatchState({ state, error }) {
  watchState.value = state || ''
  // Said once per project, in words: the editor still works and Refresh still reads the files.
  if (state === 'stopped' && error && saidWatchError !== `${active.value?.repo_id}:${error}`) {
    saidWatchError = `${active.value?.repo_id}:${error}`
    notify.warning(error)
  }
}
function onPersonActive() {
  if (!wantWatch()) return
  if (watchState.value === 'paused' || watchState.value === 'stopped') { lastActiveSent = Date.now(); sendWatch(); return }
  if (Date.now() - lastActiveSent < 60000) return
  lastActiveSent = Date.now()
  ws.send(JSON.stringify({ type: 'active' }))
}
function onVisibilityForWatch() { sendWatch() }
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityForWatch)
  window.addEventListener('pointerdown', onPersonActive, { passive: true })
  window.addEventListener('keydown', onPersonActive, { passive: true })
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityForWatch)
  window.removeEventListener('pointerdown', onPersonActive)
  window.removeEventListener('keydown', onPersonActive)
})
function connectWs() {
  if (!active.value) { ws.close(); return }
  const repoId = active.value.repo_id
  watchState.value = ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = import.meta.env.VITE_WS_HOST || window.location.host
  ws.connect(() => `${proto}//${host}/ws/lets-code/${repoId}/`)
}
function closeWs() { ws.close() }

async function loadBranches() {
  branches.value = []
  if (!active.value || active.value.is_new) return      // branches come with GitHub
  try { const { data } = await api.getProjectBranches(active.value.repo_id); branches.value = data.branches || [] }
  catch { branches.value = [] }
}

async function onSwitchBranch(branch) {
  if (!active.value || !branch || branch === active.value.branch) return
  const ok = await confirm({
    title: `Switch to "${branch}"?`,
    message: 'This checks out the branch in your workspace and indexes it again. Unsaved edits and pending agent changes are discarded.',
    confirmText: 'Switch branch', cancelText: 'Cancel', danger: true,
  })
  if (!ok) { active.value = { ...active.value }; return }   // re-render puts the select back on the current branch
  switchingBranch.value = true
  try {
    const { data } = await api.switchProjectBranch(active.value.repo_id, branch)
    applyStatus(data)
    notify.info(`Switching to ${branch}`)
    pollStatus()   // phase → switching/indexing → ready; editor remounts when ready
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Could not switch the branch')
    active.value = { ...active.value }
  } finally {
    switchingBranch.value = false
  }
}

// Slow fallback (7 s); the WebSocket drives live updates. One poller: paused while the tab is hidden, backs
// off on errors, stops on a final phase and on leave, and never applies a reply for a project that is no
// longer the open one.
const isFinalStatus = (d) => !d || d.phase === 'ready' || d.phase === 'error'
const statusPoller = usePoller(async () => {
  const repoId = active.value?.repo_id
  if (!repoId) return null
  const { data } = await api.getProject(repoId)
  if (!active.value || active.value.repo_id !== repoId) return null
  applyStatus(data)
  return data
}, { interval: 7000, stopWhen: isFinalStatus })

function pollStatus() {
  statusPoller.stop()
  statusPoller.start()
}

function closeProject() {
  statusPoller.stop()
  closeWs()
  active.value = null
  loadProjects()
}

async function retryProject(p, { startEmpty = false } = {}) {
  if (retryingId.value) return
  if (startEmpty) {
    const ok = await confirm({
      title: `Start ${p.name} again empty?`,
      message: 'Its files are gone and cannot be brought back. The project starts again with no files.',
      confirmText: 'Start again empty', cancelText: 'Cancel', danger: true,
    })
    if (!ok) return
  }
  retryingId.value = p.repo_id
  try {
    const { data } = await api.retryProject(p.repo_id, startEmpty ? { start_empty: true } : {})
    notify.info(startEmpty ? `Starting ${p.name} again` : `Retrying ${p.name}`)
    if (active.value && active.value.repo_id === p.repo_id) {
      applyStatus(data)
      pollStatus(); connectWs()
    } else {
      openProject({ ...p, ...data })
    }
    loadProjects()
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Retry failed')
  } finally {
    retryingId.value = null
  }
}

async function removeProject(p) {
  const ok = await confirm({
    title: 'Remove project?',
    message: p.is_new
      ? `Remove "${p.name}"? It is not on GitHub, so its files are deleted for good.`
      : `Remove "${p.name}" and its copy in your workspace? The GitHub repository is not affected.`,
    confirmText: 'Remove', cancelText: 'Cancel', danger: true,
  })
  if (!ok) return
  try { await api.deleteProject(p.repo_id); notify.success('Project removed'); await loadProjects() }
  catch (e) { notify.error(e?.response?.data?.error || 'Could not remove the project') }
}

// Published to GitHub from Source control: the project now has its GitHub address and branches.
async function onPublished() {
  if (!active.value) return
  try { const { data } = await api.getProject(active.value.repo_id); active.value = { ...active.value, ...data } }
  catch { /* the next status update brings it */ }
  loadBranches()
  loadProjects()
}

// A turn changed files: the tree, Source control and open tabs reload in place.
function onChanges() { codeBrowser.value?.refresh?.() }
// "View changes" under an answer: the Source control list, where each file opens its diff.
function onViewChanges() { codeBrowser.value?.showSourceControl?.() }
function onActivity(lines) { if (Array.isArray(lines)) activity.value = lines }

onMounted(async () => { await loadProjects(); loadGithubRepos() })
onBeforeUnmount(() => {
  statusPoller.stop(); closeWs()
  window.removeEventListener('mousemove', onResize); window.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.lc {
  --lc-on-solid: white;   /* text on a solid primary fill: the same in both themes */
  height: 100%; font-family: var(--vm-font-sans); color: var(--vm-ink); background: var(--vm-bg);
}
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.spin { animation: lc-spin 1s linear infinite; }
@keyframes lc-spin { to { transform: rotate(360deg); } }

/* ---------- Landing ---------- */
.lc-landing { height: 100%; overflow-y: auto; }
.lc-wrap { max-width: 1200px; margin: 0 auto; padding: 32px 32px 64px; }
.lc-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; padding-bottom: 24px; border-bottom: 1px solid var(--vm-line); }
.lc-head-text { min-width: 0; }
.lc-title { margin: 0; font: 700 30px/1.15 var(--vm-font-display); letter-spacing: -.02em; color: var(--vm-ink); }
.lc-sub { margin: 6px 0 0; font-size: 15px; line-height: 1.5; color: var(--vm-ink-soft); }
.lc-account { display: flex; align-items: center; gap: 4px 14px; flex-wrap: wrap; font-size: 13.5px; color: var(--vm-ink-soft); }
.lc-account-name { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
.lc-account-name b { font-weight: 600; color: var(--vm-ink); }
.lc-account-name :deep(svg) { width: 16px; height: 16px; flex: 0 0 auto; }
.lc-textbtn { border: none; background: transparent; padding: 6px 2px; color: var(--vm-violet-d); font: 600 13.5px var(--vm-font-sans); cursor: pointer; border-radius: 6px; }
.lc-textbtn:hover:not(:disabled) { text-decoration: underline; text-underline-offset: 3px; }
.lc-textbtn:disabled { opacity: .6; cursor: progress; }
[data-theme="dark"] .lc-textbtn { color: color-mix(in srgb, var(--vm-violet) 55%, var(--vm-ink)); }

.lc-cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; margin-top: 28px; }
@media (min-width: 1024px) { .lc-cols { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; } }
.lc-col { min-width: 0; }
.lc-col-h { margin: 0 0 12px; font: 700 16px/1.3 var(--vm-font-sans); color: var(--vm-ink); }
.lc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border: 1px solid var(--vm-line); border-radius: var(--vm-r); background: var(--vm-surface); overflow: hidden; }
.lc-list > li + li { border-top: 1px solid var(--vm-line); }
.lc-empty { margin: 0; padding: 20px 16px; border: 1px dashed var(--vm-line-2); border-radius: var(--vm-r); font-size: 14px; color: var(--vm-ink-soft); }

/* Buttons */
.lc-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 0 13px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: border-color .15s, background-color .15s, color .15s; }
.lc-btn :deep(svg) { width: 15px; height: 15px; }
.lc-btn:hover:not(:disabled) { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.lc-btn:disabled { opacity: .55; cursor: not-allowed; }
.lc-btn.danger { color: var(--vm-danger); }
.lc-btn.danger:hover:not(:disabled) { border-color: var(--vm-danger); background: color-mix(in srgb, var(--vm-danger) 8%, transparent); }
.lc-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: var(--lc-on-solid); }
.lc-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); border-color: var(--vm-violet-d); }

/* Project rows */
.proj { padding: 12px 14px; cursor: pointer; transition: background-color .15s; }
.proj:hover { background: var(--vm-surface-soft); }
.proj-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.proj-name { flex: 0 1 auto; min-width: 0; border: none; background: transparent; padding: 4px 0; text-align: left; font: 600 14.5px/1.3 var(--vm-font-sans); color: var(--vm-ink); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 4px; }
.proj:hover .proj-name { color: var(--vm-violet-d); }
[data-theme="dark"] .proj:hover .proj-name { color: color-mix(in srgb, var(--vm-violet) 55%, var(--vm-ink)); }
.proj-branch { flex: 0 1 auto; min-width: 0; display: inline-flex; align-items: center; gap: 4px; font: 12.5px var(--vm-font-mono); color: var(--vm-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proj-branch :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; color: var(--vm-ink-faint); }
.proj-local { flex: 0 0 auto; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--vm-line-2); font-size: 11.5px; font-weight: 600; color: var(--vm-ink-soft); white-space: nowrap; }
/* New project: the same field look as the repository search. */
.lc-new { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.lc-new-label { font-size: 13px; font-weight: 600; color: var(--vm-ink); }
.lc-new-row { display: flex; gap: 8px; }
.lc-new-input { flex: 1; min-width: 0; min-height: 40px; padding: 0 12px; background: var(--vm-surface); border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); font: 14px var(--vm-font-mono); color: var(--vm-ink); outline: none; transition: border-color .15s, box-shadow .15s; }
.lc-new-input::placeholder { color: var(--vm-ink-faint); }
.lc-new-input:focus { border-color: var(--vm-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus) 22%, transparent); }
.lc-new-input[aria-invalid="true"] { border-color: var(--vm-danger); }
.lc-new .lc-btn { min-height: 40px; }
.lc-new-hint, .lc-new-err { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--vm-ink-soft); }
.lc-new-err { color: var(--vm-danger); }
@media (max-width: 640px) { .lc-new-input { font-size: 16px; min-height: 44px; } .lc-new .lc-btn { min-height: 44px; } }
.proj-pill { margin-left: auto; }
.proj-del { flex: 0 0 auto; display: grid; place-items: center; width: 32px; height: 32px; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-faint); cursor: pointer; transition: color .15s, background-color .15s; }
.proj-del:hover { color: var(--vm-danger); background: color-mix(in srgb, var(--vm-danger) 8%, transparent); }
.proj-del :deep(svg) { width: 15px; height: 15px; }
.proj-fail { margin-top: 8px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; cursor: default; }
.proj-fail-msg { flex: 1 1 240px; min-width: 0; margin: 0; display: flex; gap: 7px; font-size: 13.5px; line-height: 1.5; color: var(--vm-ink-soft); overflow-wrap: anywhere; }
.proj-fail-msg :deep(svg) { width: 15px; height: 15px; flex: 0 0 auto; margin-top: 3px; color: var(--vm-danger); }
.proj-fail-actions { display: flex; gap: 8px; }

/* GitHub connect */
.gh-connect { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 22px 20px; border: 1px solid var(--vm-line); border-radius: var(--vm-r); background: var(--vm-surface); }
.gh-connect-ic { width: 26px; height: 26px; color: var(--vm-ink); margin-bottom: 4px; }
.gh-t { margin: 0; font: 600 15px/1.35 var(--vm-font-sans); color: var(--vm-ink); }
.gh-s { margin: 0 0 10px; font-size: 13.5px; line-height: 1.5; color: var(--vm-ink-soft); max-width: 46ch; }

/* Repo search + rows */
.lc-search { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding: 0 12px; min-height: 40px; background: var(--vm-surface); border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); cursor: text; transition: border-color .15s, box-shadow .15s; }
.lc-search:focus-within { border-color: var(--vm-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus) 22%, transparent); }
.lc-search :deep(svg) { width: 16px; height: 16px; color: var(--vm-ink-faint); flex: 0 0 auto; }
.lc-search input { flex: 1; min-width: 0; border: none; background: transparent; outline: none; font: 14px var(--vm-font-sans); color: var(--vm-ink); padding: 9px 0; }
.lc-search input::placeholder { color: var(--vm-ink-faint); }
.repo-list { max-height: min(62vh, 620px); overflow-y: auto; }
.repo { display: flex; align-items: center; gap: 12px; padding: 11px 14px; }
.repo:hover { background: var(--vm-surface-soft); }
.repo-main { flex: 1; min-width: 0; }
.repo-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.repo-name { min-width: 0; font: 600 14px/1.35 var(--vm-font-sans); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.repo-priv { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 3px; font: 600 11.5px/1 var(--vm-font-sans); padding: 3px 7px; border-radius: 999px; color: color-mix(in srgb, var(--vm-amber) 55%, var(--vm-ink)); background: color-mix(in srgb, var(--vm-amber) 14%, transparent); }
.repo-priv :deep(svg) { width: 11px; height: 11px; }
.repo-meta { display: flex; flex-wrap: wrap; gap: 2px 14px; margin-top: 3px; font-size: 12.5px; color: var(--vm-ink-faint); }

/* Skeleton rows */
.lc-skel-row { display: flex; align-items: center; gap: 12px; padding: 15px 14px; }
.lc-skel { display: block; height: 12px; border-radius: 6px; background: var(--vm-surface-soft); position: relative; overflow: hidden; }
.lc-skel::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--vm-ink) 6%, transparent), transparent); animation: lc-shimmer 1.4s infinite; }
.lc-skel.w40 { width: 40%; } .lc-skel.w35 { width: 35%; } .lc-skel.w20 { width: 20%; } .lc-skel.w15 { width: 15%; }
.lc-skel.w12 { width: 12%; margin-left: auto; }
.lc-skel.pill { height: 22px; border-radius: 999px; }
.lc-skel.btn { height: 32px; border-radius: var(--vm-r); }
@keyframes lc-shimmer { 100% { transform: translateX(100%); } }

/* ---------- Workspace ---------- */
.lc-ide { display: flex; flex-direction: column; height: 100%; }
.ide-bar { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; padding: 8px 14px; border-bottom: 1px solid var(--vm-line); background: var(--vm-surface); flex: 0 0 auto; }
.ide-back { display: inline-flex; align-items: center; gap: 2px; min-height: 34px; padding: 0 8px 0 4px; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, color .15s; }
.ide-back:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.ide-back :deep(svg) { width: 17px; height: 17px; }
.ide-proj { min-width: 0; max-width: 32ch; font: 700 15px/1.3 var(--vm-font-display); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ide-branch { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 0 6px 0 9px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink-soft); cursor: pointer; }
.ide-branch:focus-within { border-color: var(--vm-focus); }
.ide-branch.off { cursor: not-allowed; }
.ide-branch :deep(svg) { width: 14px; height: 14px; flex: 0 0 auto; }
.ide-branch select { border: none; background: transparent; font: 13px var(--vm-font-mono); color: var(--vm-ink); cursor: pointer; outline: none; max-width: 180px; padding: 4px 0; }
.ide-branch select:disabled { cursor: not-allowed; color: var(--vm-ink-faint); }
.ide-branch select option { background: var(--vm-surface); color: var(--vm-ink); }
.ide-gh { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px; text-decoration: none; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); transition: border-color .15s, background-color .15s; }
.ide-gh:hover { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.ide-gh :deep(svg) { width: 15px; height: 15px; }
.ide-gh .ext { width: 13px; height: 13px; color: var(--vm-ink-faint); }

.ide-main { flex: 1; min-height: 0; display: flex; }
.ide-left { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ide-editor { flex: 1; min-height: 0; position: relative; }
.ide-bottom { height: 220px; flex: 0 0 auto; }
.ide-bottom.collapsed { height: auto; }
.ide-rightpane { position: relative; width: var(--rp-w, 384px); flex: 0 0 auto; display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--vm-line); }
.ide-rightpane > :not(.rp-resize) { flex: 1; min-height: 0; min-width: 0; }
/* Drag handle sitting over the left border. */
.rp-resize { position: absolute; left: -4px; top: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 6; border-radius: 0; }
.rp-resize::after { content: ''; position: absolute; left: 3px; top: 0; bottom: 0; width: 2px; background: transparent; transition: background-color .15s; }
.rp-resize:hover::after, .rp-resize.active::after, .rp-resize:focus-visible::after { background: var(--vm-violet); }
.rp-resize:focus-visible { outline: none; }

/* Narrow screens: editor on top, chat below; the page scrolls instead of squeezing both side by side. */
@media (max-width: 900px) {
  .lc { overflow-y: auto; }
  .lc-ide { height: auto; min-height: 100%; }
  .ide-main { flex-direction: column; }
  .ide-left { min-height: 70vh; }
  .ide-rightpane { width: 100%; height: 80vh; border-left: none; border-top: 1px solid var(--vm-line); }
  .rp-resize { display: none; }
  .ide-gh { margin-left: 0; }
}
@media (max-width: 640px) {
  .lc-wrap { padding: 24px 16px 48px; }
  .lc-title { font-size: 26px; }
  .lc-btn, .lc-textbtn, .ide-back, .ide-gh, .ide-branch { min-height: 44px; }
  .proj-del { width: 44px; height: 44px; }
  .proj-row { flex-wrap: wrap; }
  .proj-name { flex-basis: 100%; }
  .proj-pill { margin-left: 0; }
  .proj-del { margin-left: auto; }
  .ide-gh-t { display: none; }
  .ide-proj { max-width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .spin, .lc-skel::after { animation: none; }
}
</style>
