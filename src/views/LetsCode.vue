<template>
  <div class="lc vm-scroll">
    <div class="lc-wrap">
      <!-- Header + tab switcher -->
      <div class="lc-head">
        <div>
          <span class="eyebrow"><span class="pip"></span> Coding workspace · Preview</span>
          <h1 class="title"><span class="vm-grad-text">Let's</span> Code</h1>
          <p class="sub">Connect a repository, describe what you want, and ship it to GitHub.</p>
        </div>
        <div class="lc-tabs">
          <button class="tab" :class="{ on: tab === 'code' }" @click="tab = 'code'">
            <Icon icon="lucide:sparkles" class="i" /> Let's Code
          </button>
          <button class="tab" :class="{ on: tab === 'systems' }" @click="tab = 'systems'">
            <Icon icon="lucide:layout-grid" class="i" /> Systems / Repositories
          </button>
        </div>
      </div>

      <!-- ============ LET'S CODE TAB ============ -->
      <div v-if="tab === 'code'" class="lc-grid">
        <!-- Left rail: task list (placeholder for P0) -->
        <aside class="task-rail">
          <div class="rail-head">All Tasks</div>
          <template v-if="tasks.length">
            <div
              v-for="t in tasks"
              :key="t.id"
              class="rail-task"
              :class="{ on: String(t.id) === String(activeTaskId) }"
              @click="activeTaskId = t.id"
            >
              <span class="rt-name">{{ t.prompt }}</span>
              <span class="rt-meta">
                <span class="rt-status" :class="taskStatusCls(t.status)">{{ taskStatusLabel(t.status) }}</span>
                <a
                  v-if="t.pr_url"
                  class="rt-pr"
                  :href="t.pr_url"
                  target="_blank"
                  rel="noopener"
                  title="View pull request"
                  @click.stop
                ><Icon icon="logos:github-icon" /> PR</a>
                <button class="rt-rerun" title="Re-run this task" @click.stop="rerun(t)">
                  <Icon icon="lucide:rotate-cw" />
                </button>
              </span>
            </div>
          </template>
          <div v-else class="rail-empty">
            <span class="re-orb"><Icon icon="lucide:list-checks" /></span>
            <p class="re-title">No coding tasks yet</p>
            <p class="re-sub">Your coding runs will appear here.</p>
          </div>
        </aside>

        <!-- Center: repo picker + prompt, OR the live coding session -->
        <section class="lc-center">
          <CodingSession
            v-if="activeTaskId"
            :system-id="selectedSystemId"
            :repo-id="selectedRepo && selectedRepo.id"
            :task-id="activeTaskId"
            @back="activeTaskId = null"
            @changed="loadTasks"
          />
          <template v-else>
          <!-- Repo picker / CRS status -->
          <div class="repo-card">
            <div class="repo-card-head">
              <span class="rc-step">1</span>
              <span class="rc-title">Choose a repository</span>
              <button class="rc-add" @click="tab = 'systems'">
                <Icon icon="lucide:github" /> Connect / add a repo
              </button>
            </div>

            <div v-if="loadingRepos" class="rc-loading">Loading repositories…</div>

            <div v-else-if="!repoOptions.length" class="rc-none">
              <p>No repositories yet.</p>
              <button class="btn-ghost" @click="tab = 'systems'">
                <Icon icon="lucide:plus" /> Add a repository in Systems
              </button>
            </div>

            <template v-else>
              <div class="rc-selects">
                <div class="sel-field">
                  <Icon icon="lucide:layers" class="ic" />
                  <select v-model="selectedSystemId" @change="onSystemChange">
                    <option v-for="s in systems" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
                  </select>
                </div>
                <div class="sel-field">
                  <Icon icon="lucide:git-branch" class="ic" />
                  <select v-model="selectedRepoId">
                    <option disabled value="">Select a repository…</option>
                    <option v-for="r in repos" :key="r.id" :value="String(r.id)">{{ r.name }}</option>
                  </select>
                </div>
              </div>

              <!-- Selected repo + CRS status -->
              <div v-if="selectedRepo" class="repo-status">
                <span class="rs-icon"><Icon icon="lucide:folder-git-2" /></span>
                <span class="rs-text">
                  <span class="rs-name">{{ selectedRepo.name }}</span>
                  <span class="rs-url">{{ selectedRepo.github_url || '—' }}</span>
                </span>
                <span class="rs-badge" :class="crsState.cls">
                  <span class="vm-orb" :class="crsState.orb"></span>{{ crsState.label }}
                </span>
                <button class="rs-action" :disabled="indexing" @click="indexRepo">
                  <Icon :icon="indexing ? 'lucide:loader' : 'lucide:refresh-cw'" :class="{ spin: indexing }" />
                  {{ indexing ? 'Indexing…' : (crsState.indexed ? 'Re-index' : 'Index repo') }}
                </button>
              </div>
            </template>
          </div>

          <!-- Prompt box -->
          <div class="prompt-card" :class="{ disabled: !selectedRepo }">
            <div class="pc-step"><span class="rc-step">2</span><span class="rc-title">Describe the task</span></div>
            <textarea
              v-model="prompt"
              class="pc-input"
              rows="4"
              placeholder="Code your creativity here… e.g. “Add input validation to the auth serializers and write tests.”"
            ></textarea>
            <div class="pc-bar">
              <span class="pc-hint">{{ selectedRepo ? 'Plans, edits a clone, and shows a diff to review.' : 'Pick a repository first.' }}</span>
              <button class="pc-go" :disabled="!selectedRepo || !prompt.trim()" @click="startCoding">
                Coding <Icon icon="lucide:arrow-right" />
              </button>
            </div>
            <!-- Task chips -->
            <div class="chips">
              <button v-for="c in CHIPS" :key="c" class="chip" @click="prompt = c">{{ c }}</button>
            </div>
          </div>
          </template>
        </section>
      </div>

      <!-- ============ SYSTEMS / REPOSITORIES TAB ============ -->
      <div v-else class="lc-systems">
        <SystemList />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import SystemList from './SystemList.vue'
import CodingSession from '../components/coding/CodingSession.vue'

const router = useRouter()
const route = useRoute()

// Deep-link the Systems tab via ?tab=systems (used by the /dashboard/systems redirect + back buttons).
const tab = ref(route.query.tab === 'systems' ? 'systems' : 'code')
const systems = ref([])
const repos = ref([])
const selectedSystemId = ref('')
const selectedRepoId = ref('')
const loadingRepos = ref(true)
const indexing = ref(false)
const prompt = ref('')

// Coding tasks (left rail) + the open session
const tasks = ref([])
const activeTaskId = ref(null)

const TASK_STATUS = {
  queued: 'Queued', planning: 'Planning', editing: 'Editing', verifying: 'Verifying',
  awaiting_review: 'Ready', failed: 'Failed', cancelled: 'Cancelled',
  exporting: 'Exporting', exported: 'Exported',
}
const taskStatusLabel = (s) => TASK_STATUS[s] || s
const taskStatusCls = (s) =>
  ({ awaiting_review: 'ok', exported: 'ok', failed: 'err', cancelled: 'off' }[s] || 'run')

const CHIPS = ['Refactor this repository', 'Write unit tests', 'Optimize performance', 'Generate README']

const repoOptions = computed(() => repos.value)
const selectedRepo = computed(() => repos.value.find((r) => String(r.id) === String(selectedRepoId.value)) || null)

// CRS index status → pill state (read-only display; reuses repo.crs_status / status).
const crsState = computed(() => {
  const s = (selectedRepo.value && (selectedRepo.value.crs_status || selectedRepo.value.status)) || 'not_started'
  if (s === 'ready') return { indexed: true, label: 'Indexed', cls: 'ok', orb: 'is-live' }
  if (s === 'running' || s === 'crs_running' || s === 'analyzing') return { indexed: false, label: 'Indexing…', cls: 'run', orb: 'is-idle' }
  if (s === 'error') return { indexed: false, label: 'Index failed', cls: 'err', orb: 'is-idle' }
  return { indexed: false, label: 'Not indexed', cls: 'off', orb: 'is-idle' }
})

async function loadSystems() {
  loadingRepos.value = true
  try {
    const { data } = await api.getSystems()
    systems.value = data?.results || data || []
    if (systems.value.length) {
      selectedSystemId.value = String(systems.value[0].id)
      await loadRepos()
    }
  } catch {
    systems.value = []
  } finally {
    loadingRepos.value = false
  }
}

async function loadRepos() {
  repos.value = []
  selectedRepoId.value = ''
  if (!selectedSystemId.value) return
  try {
    const { data } = await api.getRepositories(selectedSystemId.value)
    repos.value = data?.results || data || []
    if (repos.value.length) selectedRepoId.value = String(repos.value[0].id)
  } catch {
    repos.value = []
  }
}

function onSystemChange() { loadRepos() }

// Load this repo's coding tasks for the left rail (endpoint is not flag-gated → returns [] when off).
async function loadTasks() {
  tasks.value = []
  if (!selectedRepo.value) return
  try {
    const { data } = await api.listCodingTasks(selectedSystemId.value, selectedRepo.value.id)
    tasks.value = data?.tasks || []
  } catch {
    tasks.value = []
  }
}
watch(selectedRepoId, () => { activeTaskId.value = null; loadTasks() })

// Reuses the EXISTING CRS run endpoint (read/analyze only — no coding loop, no GitHub write).
async function indexRepo() {
  if (!selectedRepo.value) return
  indexing.value = true
  try {
    await api.runCrs(selectedSystemId.value, selectedRepo.value.id)
    notify.success('Indexing started — check the repository workspace for progress.')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to start indexing')
  } finally {
    indexing.value = false
  }
}

// P1: start a real coding task (plan → edit clone → diff). If the backend flag is OFF
// (403 disabled), fall back to the P0 behaviour: open the existing repo workspace.
async function startCoding() {
  if (!selectedRepo.value || !prompt.value.trim()) return
  const text = prompt.value.trim()
  try {
    const { data } = await api.startCodingTask(selectedSystemId.value, selectedRepo.value.id, text)
    activeTaskId.value = data.id
    prompt.value = ''
    loadTasks()
  } catch (e) {
    if (e?.response?.status === 403 && e.response.data?.disabled) {
      router.push({
        path: `/dashboard/systems/${selectedSystemId.value}/repositories/${selectedRepo.value.id}`,
        query: { prompt: text },
      })
    } else {
      notify.error(e?.response?.data?.error || 'Failed to start coding task')
    }
  }
}

// P5: re-run a previous task with the same prompt (starts a fresh coding run).
async function rerun(t) {
  if (!selectedRepo.value || !t?.prompt) return
  try {
    const { data } = await api.startCodingTask(selectedSystemId.value, selectedRepo.value.id, t.prompt)
    activeTaskId.value = data.id
    loadTasks()
  } catch (e) {
    if (e?.response?.status === 403 && e.response.data?.disabled) {
      notify.warning('Coding workspace is disabled on the server.')
    } else {
      notify.error(e?.response?.data?.error || 'Failed to re-run task')
    }
  }
}

onMounted(loadSystems)
</script>

<style scoped>
.lc { height: 100%; overflow-y: auto; font-family: var(--vm-font-sans); color: var(--vm-ink); }
.lc-wrap { max-width: 1180px; margin: 0 auto; padding: 28px 34px 56px; }

/* header */
.lc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin-bottom: 22px; }
.eyebrow { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--vm-violet-d); background: var(--vm-violet-soft); padding: 5px 11px; border-radius: 999px; margin-bottom: 12px; }
.eyebrow .pip { width: 6px; height: 6px; border-radius: 50%; background: var(--vm-violet); }
.title { font-family: var(--vm-font-display); font-size: 40px; font-weight: 700; line-height: 1.02; letter-spacing: -.025em; }
.sub { color: var(--vm-ink-soft); font-size: 15px; margin-top: 8px; }
.lc-tabs { display: inline-flex; gap: 4px; padding: 5px; border-radius: 999px; background: var(--vm-glass-strong); border: 1px solid var(--vm-line); box-shadow: var(--vm-shadow-m); }
.tab { display: inline-flex; align-items: center; gap: 7px; border: none; background: transparent; cursor: pointer; padding: 9px 16px; border-radius: 999px; font: 700 13px var(--vm-font-sans); color: var(--vm-ink-soft); white-space: nowrap; transition: .2s var(--vm-ease); }
.tab:hover { color: var(--vm-ink); }
.tab.on { background: var(--vm-g-brand); color: #fff; box-shadow: var(--vm-glow-v); }
.tab .i { width: 15px; height: 15px; }

/* code grid */
.lc-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
@media (min-width: 1024px) { .lc-grid { grid-template-columns: 260px 1fr; } }

.task-rail { background: var(--vm-glass-strong); border: 1px solid var(--vm-line); border-radius: var(--vm-r-l); box-shadow: var(--vm-shadow-m); padding: 14px; height: max-content; }
.rail-head { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--vm-ink-faint); padding: 4px 6px 10px; }
.rail-empty { text-align: center; padding: 26px 10px; }
.re-orb { width: 44px; height: 44px; border-radius: 14px; background: var(--vm-violet-soft); color: var(--vm-violet-d); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; }
.re-orb :deep(svg) { width: 20px; height: 20px; }
.re-title { font-size: 13px; font-weight: 700; color: var(--vm-ink); }
.re-sub { font-size: 12px; color: var(--vm-ink-faint); margin-top: 3px; }
.rail-task { width: 100%; display: flex; flex-direction: column; gap: 4px; text-align: left; border: none; background: transparent; cursor: pointer; padding: 9px 10px; border-radius: 11px; transition: background .15s var(--vm-ease2); margin-bottom: 2px; }
.rail-task:hover { background: var(--vm-surface); }
.rail-task.on { background: var(--vm-violet-soft); }
.rt-name { font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rt-status { font: 700 10px var(--vm-font-sans); align-self: flex-start; padding: 2px 8px; border-radius: 999px; }
.rt-status.ok { color: #059669; background: rgba(16,185,129,.12); }
.rt-status.run { color: #B45309; background: rgba(245,158,11,.14); }
.rt-status.err { color: var(--vm-danger); background: rgba(239,68,68,.1); }
.rt-status.off { color: var(--vm-ink-faint); background: var(--vm-bg); }
.rt-meta { display: flex; align-items: center; gap: 6px; }
.rt-pr { display: inline-flex; align-items: center; gap: 4px; font: 700 10px var(--vm-font-sans); color: var(--vm-ink-soft); text-decoration: none; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--vm-line-2); }
.rt-pr:hover { border-color: var(--vm-violet); color: var(--vm-violet-d); }
.rt-pr :deep(svg) { width: 12px; height: 12px; }
.rt-rerun { margin-left: auto; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: none; background: transparent; color: var(--vm-ink-faint); border-radius: 7px; cursor: pointer; opacity: 0; transition: .15s var(--vm-ease2); }
.rail-task:hover .rt-rerun { opacity: 1; }
.rt-rerun:hover { background: var(--vm-surface); color: var(--vm-violet-d); }
.rt-rerun :deep(svg) { width: 13px; height: 13px; }

.lc-center { display: flex; flex-direction: column; gap: 18px; }
.repo-card, .prompt-card { background: var(--vm-glass-strong); border: 1px solid var(--vm-line); border-radius: var(--vm-r-l); box-shadow: var(--vm-shadow-m); padding: 20px; }
.repo-card-head, .pc-step { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.rc-step { width: 24px; height: 24px; border-radius: 8px; background: var(--vm-g-brand); color: #fff; font: 800 12px var(--vm-font-sans); display: inline-flex; align-items: center; justify-content: center; box-shadow: var(--vm-shadow-s); }
.rc-title { font-family: var(--vm-font-display); font-size: 15px; font-weight: 700; }
.rc-add { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink-soft); font: 600 12.5px var(--vm-font-sans); padding: 7px 12px; border-radius: 11px; cursor: pointer; transition: .15s var(--vm-ease); }
.rc-add:hover { color: var(--vm-violet-d); border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.rc-add :deep(svg) { width: 15px; height: 15px; }
.rc-loading, .rc-none { padding: 16px; text-align: center; color: var(--vm-ink-faint); font-size: 13px; }
.rc-none .btn-ghost { margin-top: 10px; }
.btn-ghost { display: inline-flex; align-items: center; gap: 7px; border: 1.5px solid var(--vm-line-2); background: transparent; color: var(--vm-ink-soft); font: 700 13px var(--vm-font-sans); padding: 9px 15px; border-radius: 12px; cursor: pointer; }
.btn-ghost:hover { border-color: var(--vm-violet); color: var(--vm-violet-d); background: var(--vm-violet-soft); }
.btn-ghost :deep(svg) { width: 15px; height: 15px; }

.rc-selects { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 560px) { .rc-selects { grid-template-columns: 1fr; } }
.sel-field { position: relative; display: flex; align-items: center; }
.sel-field .ic { position: absolute; left: 11px; width: 15px; height: 15px; color: var(--vm-ink-faint); pointer-events: none; }
.sel-field select { width: 100%; appearance: none; padding: 10px 30px 10px 33px; border-radius: 12px; border: 1px solid var(--vm-line-2); background: var(--vm-surface); font: 600 13px var(--vm-font-sans); color: var(--vm-ink); cursor: pointer; }
.sel-field select:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(14,165,233,.16); }

.repo-status { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 12px 14px; border-radius: 14px; background: var(--vm-bg); border: 1px solid var(--vm-line); }
.rs-icon { width: 38px; height: 38px; border-radius: 11px; background: var(--vm-violet-soft); color: var(--vm-violet-d); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rs-icon :deep(svg) { width: 18px; height: 18px; }
.rs-text { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.rs-name { font-size: 13.5px; font-weight: 700; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rs-url { font-size: 11.5px; color: var(--vm-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rs-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 999px; flex-shrink: 0; }
.rs-badge.ok { color: #059669; background: rgba(16,185,129,.12); }
.rs-badge.run { color: #B45309; background: rgba(245,158,11,.14); }
.rs-badge.err { color: var(--vm-danger); background: rgba(239,68,68,.1); }
.rs-badge.off { color: var(--vm-ink-faint); background: var(--vm-surface); border: 1px solid var(--vm-line); }
.rs-action { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink-soft); font: 700 12px var(--vm-font-sans); padding: 7px 12px; border-radius: 11px; cursor: pointer; flex-shrink: 0; }
.rs-action:hover:not(:disabled) { color: var(--vm-violet-d); border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.rs-action:disabled { opacity: .6; cursor: default; }
.rs-action :deep(svg) { width: 14px; height: 14px; }
.spin { animation: lcspin .8s linear infinite; }
@keyframes lcspin { to { transform: rotate(360deg); } }

/* prompt */
.prompt-card.disabled { opacity: .92; }
.pc-input { width: 100%; border: 1.5px solid var(--vm-line); border-radius: 15px; background: var(--vm-surface); padding: 14px; font: 500 14.5px var(--vm-font-sans); color: var(--vm-ink); resize: vertical; min-height: 96px; transition: border-color .2s var(--vm-ease2), box-shadow .2s; }
.pc-input:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(14,165,233,.16); }
.pc-input::placeholder { color: var(--vm-ink-faint); }
.pc-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
.pc-hint { font-size: 12px; color: var(--vm-ink-faint); }
.pc-go { display: inline-flex; align-items: center; gap: 8px; border: none; cursor: pointer; padding: 11px 20px; border-radius: 14px; background: var(--vm-g-brand); color: #fff; font: 700 14px var(--vm-font-sans); box-shadow: var(--vm-glow-v); transition: transform .15s var(--vm-ease); }
.pc-go:hover:not(:disabled) { transform: translateY(-2px) scale(1.02); }
.pc-go:disabled { opacity: .45; cursor: default; box-shadow: none; }
.pc-go :deep(svg) { width: 16px; height: 16px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.chip { padding: 8px 14px; font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); background: var(--vm-surface); border: 1px solid var(--vm-line); border-radius: 999px; cursor: pointer; transition: .18s var(--vm-ease); }
.chip:hover { transform: translateY(-1px); color: var(--vm-violet-d); border-color: transparent; background: var(--vm-violet-soft); box-shadow: var(--vm-shadow-s); }

/* systems tab wrapper — the embedded SystemList brings its own layout */
.lc-systems { margin-top: 4px; }

@media (max-width: 640px) { .lc-wrap { padding: 20px 16px 40px; } .title { font-size: 30px; } }
</style>
