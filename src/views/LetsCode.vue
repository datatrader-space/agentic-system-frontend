<template>
  <div class="lc">
    <!-- ============================ LANDING ============================ -->
    <div v-if="!active" class="lc-landing vm-scroll">
      <div class="lc-wrap">
        <header class="lc-head">
          <div class="lc-head-text">
            <h1 class="lc-title">{{ t('landing.title') }}</h1>
            <p class="lc-sub">{{ t('landing.sub') }}</p>
          </div>
        </header>

        <div class="lc-cols">
          <!-- Your projects -->
          <section class="lc-col" aria-labelledby="lc-projects-h">
            <div class="lc-col-head">
              <h2 id="lc-projects-h" class="lc-col-h">{{ t('landing.projects') }}</h2>
              <span v-if="!projectsLoading && projects.length" class="lc-count" :aria-label="t('landing.projectsCount', { n: projects.length })">{{ projects.length }}</span>
            </div>

            <!-- A new project needs no GitHub repository: it is published from Source control when the person wants. -->
            <form class="lc-new" @submit.prevent="createNewProject">
              <label class="lc-new-label" for="lc-new-name">{{ t('landing.newProject') }}</label>
              <div class="lc-new-row">
                <input id="lc-new-name" v-model="newName" class="lc-new-input" type="text" spellcheck="false" autocomplete="off"
                       placeholder="my-app" maxlength="100" :disabled="creating" :aria-invalid="!!newError" aria-describedby="lc-new-hint" />
                <button type="submit" class="lc-btn primary" :disabled="creating || !newName.trim()">
                  <Icon :icon="creating ? 'lucide:loader-2' : 'lucide:plus'" :class="{ spin: creating }" />
                  {{ creating ? t('landing.creating') : t('landing.create') }}
                </button>
              </div>
              <p v-if="newError" id="lc-new-hint" class="lc-new-err" role="alert">{{ newError }}</p>
              <p v-else id="lc-new-hint" class="lc-new-hint">{{ t('landing.newHint') }}</p>
            </form>

            <ul v-if="projectsLoading" class="lc-list" aria-busy="true" :aria-label="t('landing.loadingProjects')">
              <li v-for="n in 3" :key="n" class="lc-skel-row"><span class="lc-skel w40"></span><span class="lc-skel w15"></span><span class="lc-skel w12 pill"></span></li>
            </ul>

            <div v-else-if="!projects.length" class="lc-empty">
              <Icon icon="lucide:folder-code" class="lc-empty-ic" aria-hidden="true" />
              <p>{{ t('landing.noProjects') }}</p>
            </div>

            <ul v-else class="lc-list">
              <li v-for="p in projects" :key="p.repo_id" class="proj" :class="{ failed: isFailed(p) }" @click="openProject(p)"
                  @pointerenter="onCardPointer(p, $event)" @pointerleave="onCardLeave">
                <div class="proj-row">
                  <button type="button" class="proj-name" :title="t('landing.openProject', { name: p.name })" @click.stop="openProject(p)" @focus="onCardFocus(p)">{{ p.name }}</button>
                  <span v-if="p.branch" class="proj-branch"><Icon icon="lucide:git-branch" aria-hidden="true" />{{ p.branch }}</span>
                  <span v-if="p.is_new" class="proj-local" :title="t('landing.notOnGithubTitle')">{{ t('landing.notOnGithub') }}</span>
                  <StatusPill :project="p" class="proj-pill" />
                  <button v-if="!isFailed(p)" type="button" class="proj-del" :aria-label="t('landing.removeNamed', { name: p.name })" :title="t('landing.removeProjectTitle')" @click.stop="removeProject(p)">
                    <Icon icon="lucide:trash-2" />
                  </button>
                </div>
                <div v-if="isFailed(p)" class="proj-fail" @click.stop>
                  <p class="proj-fail-msg"><Icon icon="lucide:circle-alert" aria-hidden="true" />{{ p.error_message || t('landing.preparingStopped') }}</p>
                  <div class="proj-fail-actions">
                    <button type="button" class="lc-btn" :disabled="retryingId === p.repo_id" @click="retryProject(p, { startEmpty: p.failed_step === 'lost' })">
                      <Icon :icon="retryingId === p.repo_id ? 'lucide:loader-2' : (p.failed_step === 'lost' ? 'lucide:file-plus' : 'lucide:rotate-cw')" :class="{ spin: retryingId === p.repo_id }" />
                      {{ p.failed_step === 'lost' ? t('landing.startAgainEmpty') : t('landing.retry') }}
                    </button>
                    <button type="button" class="lc-btn danger" @click="removeProject(p)"><Icon icon="lucide:trash-2" /> {{ t('landing.remove') }}</button>
                  </div>
                </div>
              </li>
            </ul>
          </section>

          <!-- Clone from GitHub -->
          <section class="lc-col" aria-labelledby="lc-clone-h">
            <div class="lc-col-head">
              <h2 id="lc-clone-h" class="lc-col-h">{{ t('landing.cloneFromGithub') }}</h2>
              <span v-if="!ghNotConnected && !loadingRepos && repos.length" class="lc-count" :aria-label="t('landing.reposCount', { n: repos.length })">{{ repos.length }}</span>
            </div>

            <div v-if="ghNotConnected" class="gh-connect">
              <span class="gh-mark" aria-hidden="true"><Icon icon="lucide:github" /></span>
              <div class="gh-connect-body">
                <p class="gh-t">{{ t('landing.connectTitle') }}</p>
                <p class="gh-s">{{ t('landing.connectText') }}</p>
                <button type="button" class="lc-btn primary" :disabled="!!ghBusy" @click="connectGithub">
                  <Icon :icon="ghBusy === 'connect' ? 'lucide:loader-2' : 'lucide:github'" :class="{ spin: ghBusy === 'connect' }" />
                  {{ ghBusy === 'connect' ? t('landing.connecting') : t('landing.connect') }}
                </button>
              </div>
            </div>

            <template v-else>
              <!-- The connected account, with the two things a person does with it. -->
              <div v-if="ghAccount" class="gh-acct">
                <span class="gh-mark sm" aria-hidden="true"><Icon icon="lucide:github" /></span>
                <p class="gh-acct-id">
                  <span class="gh-acct-k">{{ t('landing.connectedAs') }}</span>
                  <span class="gh-acct-name" :title="ghAccount">{{ ghAccount }}</span>
                </p>
                <div class="gh-acct-actions">
                  <button type="button" class="lc-btn sm" :disabled="!!ghBusy" @click="switchGithubAccount">
                    <Icon :icon="ghBusy === 'switch' ? 'lucide:loader-2' : 'lucide:repeat'" :class="{ spin: ghBusy === 'switch' }" />
                    {{ ghBusy === 'switch' ? t('landing.switching') : t('landing.switchAccount') }}
                  </button>
                  <button type="button" class="lc-btn sm quiet-danger" :disabled="!!ghBusy" @click="disconnectGithub">
                    <Icon :icon="ghBusy === 'disconnect' ? 'lucide:loader-2' : 'lucide:unplug'" :class="{ spin: ghBusy === 'disconnect' }" />
                    {{ ghBusy === 'disconnect' ? t('landing.disconnecting') : t('landing.disconnect') }}
                  </button>
                </div>
              </div>
              <!-- Any GitHub repository by its address, on a branch if one is named (ADM-1205, phase C). -->
              <form class="lc-byurl" @submit.prevent="cloneByUrl">
                <label class="lc-byurl-l" for="lc-url">{{ t('landing.cloneByAddress') }}</label>
                <div class="lc-byurl-row">
                  <input id="lc-url" v-model="cloneUrl" class="lc-byurl-in" type="url" inputmode="url" spellcheck="false"
                         autocomplete="off" placeholder="https://github.com/owner/repository" :disabled="!!cloningUrl" />
                  <input v-model="cloneBranch" class="lc-byurl-in br" type="text" spellcheck="false" autocomplete="off"
                         :placeholder="t('landing.branchOptional')" :aria-label="t('landing.branchOptional')" :disabled="!!cloningUrl" />
                  <button type="submit" class="lc-btn" :disabled="!!cloningUrl || !cloneUrl.trim()">
                    <Icon :icon="cloningByAddress ? 'lucide:loader-2' : 'lucide:download'" :class="{ spin: cloningByAddress }" />
                    {{ cloningByAddress ? t('landing.cloning') : t('landing.clone') }}
                  </button>
                </div>
                <p v-if="cloneUrlError" class="lc-byurl-err" role="alert">{{ cloneUrlError }}</p>
              </form>
              <label class="lc-search">
                <span class="sr-only">{{ t('landing.searchRepos') }}</span>
                <Icon icon="lucide:search" aria-hidden="true" />
                <input v-model="repoQuery" type="search" :placeholder="t('landing.searchRepos')" autocomplete="off" />
              </label>

              <ul v-if="loadingRepos" class="lc-list" aria-busy="true" :aria-label="t('landing.loadingRepos')">
                <li v-for="n in 5" :key="n" class="lc-skel-row"><span class="lc-skel w35"></span><span class="lc-skel w20"></span><span class="lc-skel w12 btn"></span></li>
              </ul>
              <p v-else-if="!repos.length" class="lc-empty">{{ t('landing.noRepos') }}</p>
              <p v-else-if="!filteredRepos.length" class="lc-empty">{{ t('landing.noReposMatch', { q: repoQuery.trim() }) }}</p>
              <ul v-else class="lc-list repo-list vm-scroll">
                <li v-for="r in filteredRepos" :key="r.full_name" class="repo">
                  <div class="repo-main">
                    <div class="repo-top">
                      <span class="repo-name" :title="r.full_name">{{ r.name }}</span>
                      <span v-if="r.private" class="repo-priv"><Icon icon="lucide:lock" aria-hidden="true" />{{ t('landing.private') }}</span>
                    </div>
                    <div class="repo-meta">
                      <span v-if="r.language && r.language !== 'Unknown'">{{ r.language }}</span>
                      <span v-if="r.pushed_at">{{ t('landing.updated', { when: relativeTime(r.pushed_at) }) }}</span>
                    </div>
                  </div>
                  <button type="button" class="lc-btn" :disabled="!!cloningUrl" :aria-label="t('landing.cloneNamed', { name: r.full_name })" @click="cloneRepo(r)">
                    <Icon :icon="cloningUrl === r.clone_url ? 'lucide:loader-2' : 'lucide:download'" :class="{ spin: cloningUrl === r.clone_url }" />
                    {{ cloningUrl === r.clone_url ? t('landing.cloning') : t('landing.clone') }}
                  </button>
                </li>
              </ul>
            </template>
          </section>
        </div>
      </div>
    </div>

    <!-- ============================ PHONE VIEW (ADM-1330) ============================ -->
    <!-- The light project view: the project's chats, their task lists and approval cards, Stop and reply, and the
         preview link, without the editor. A phone opens it; "Full editor" switches (remembered on this device). -->
    <LetsCodeLight v-else-if="lightView" :key="`light-${active.repo_id}`" :project="active" :ready="ready"
                   :chat-id="linkedChatId" :theme="ideTheme"
                   @back="closeProject" @full-editor="setView('editor')" @chat-opened="onChatOpened" />

    <!-- ============================ WORKSPACE ============================ -->
    <div v-else class="lc-ide" :data-theme="ideTheme">
      <div class="ide-bar">
        <button type="button" class="ide-back" :title="t('ide.projects')" @click="onBackToProjects"><Icon icon="lucide:chevron-left" aria-hidden="true" /> <span class="ide-back-t">{{ t('ide.projects') }}</span></button>
        <span class="ide-proj" :title="active.name">{{ active.name }}</span>
        <span v-if="active.is_new" class="ide-branch off" :title="t('ide.branchesNeedGithub')">
          <Icon icon="lucide:git-branch" aria-hidden="true" /> {{ active.branch || 'main' }}
        </span>
        <label v-else class="ide-branch" :class="{ off: switchingBranch || !ready }">
          <span class="sr-only">{{ t('ide.branch') }}</span>
          <Icon icon="lucide:git-branch" aria-hidden="true" />
          <select :value="active.branch" :disabled="switchingBranch || !ready" @change="onSwitchBranch($event.target.value)">
            <option :value="active.branch">{{ active.branch }}</option>
            <option v-for="b in branches.filter(b => b !== active.branch)" :key="b" :value="b">{{ b }}</option>
          </select>
        </label>
        <StatusPill :project="active" />
        <!-- The phone view (ADM-1330): only offered on a narrow screen, where the editor shows one pane at a time. -->
        <button type="button" class="ide-phone" :title="t('ide.phoneViewTitle')" :aria-label="t('ide.phoneView')" data-test="ide-phone-view" @click="toPhoneView">
          <Icon icon="lucide:monitor-smartphone" aria-hidden="true" />
        </button>
        <!-- The editor's own light or dark (ADM-1205): only Let's Code changes, never the rest of AADML. -->
        <button type="button" class="ide-theme" :aria-pressed="ideDark ? 'true' : 'false'"
                :aria-label="ideDark ? t('ide.darkEditor') : t('ide.lightEditor')"
                :title="ideDark ? t('ide.toLight') : t('ide.toDark')" @click="toggleIdeTheme">
          <Icon :icon="ideDark ? 'lucide:moon' : 'lucide:sun'" aria-hidden="true" />
        </button>
        <a v-if="active.github_url" class="ide-gh" :href="githubWebUrl(active.github_url)" target="_blank" rel="noopener noreferrer" :aria-label="t('ide.openOnGithub')">
          <Icon icon="lucide:github" aria-hidden="true" /> <span class="ide-gh-t">{{ t('ide.openOnGithub') }}</span> <Icon icon="lucide:external-link" class="ext" aria-hidden="true" />
        </a>
        <!-- How the project is installed, built, tested and run: the agent fills these in, the person corrects them. -->
        <ProjectCommands :repo-id="Number(active.repo_id)" :ready="ready" />
        <!-- The project's environment variables, for the Terminal and the Coding Agent's commands (ADM-1205 phase D). -->
        <ProjectEnv :repo-id="Number(active.repo_id)" />
        <!-- Background tasks that end in a pull request, and GitHub's checks and reviews coming back as fixes (ADM-1328). -->
        <ProjectTasks :repo-id="Number(active.repo_id)" @open-chat="onOpenTaskChat" />
        <DeployButton :repo-id="Number(active.repo_id)" :project-name="active.name" :branch="active.branch || ''" :ready="ready" />
      </div>

      <div class="ide-main">
        <div ref="ideLeftEl" class="ide-left" :class="{ 'bottom-max': bottomMax && !bottomCollapsed && ready }">
          <div class="ide-editor">
            <!-- While the project opens: what it is waiting for, and for how long (ADM-1326). Floats, so the editor
                 does not move when it goes. -->
            <p v-if="openLabel" class="ide-open" role="status" aria-live="polite">
              <Icon icon="lucide:loader-2" class="spin" aria-hidden="true" />
              <span>{{ openLabel }}</span>
              <span class="ide-open-s" aria-hidden="true">{{ openProgress.seconds }}&nbsp;s</span>
            </p>
            <PipelineStepper v-if="!ready" :project="active" :log="pipelineLog" :retrying="retryingId === active.repo_id" @retry="(o) => retryProject(active, o)" />
            <CodeBrowser v-else ref="codeBrowser" :key="browserKey" :repository-id="Number(active.repo_id)" :system-id="Number(active.system_id)" :editable="true" :project-name="active.name" @published="onPublished" @branch="onBranchSeen" @ask-selection="onAskSelection" @send-review="onSendReview">
              <!-- The Coding Agent's chats are editor tabs, as Claude Code's are in VS Code (ADM-1221, owner 2026-11-12). -->
              <template #chat>
                <UnifiedAgentChat
                  ref="agentChat"
                  :key="active.repo_id"
                  :system-id="active.system_id" :repo-id="active.repo_id" :crs-ready="ready"
                  :chat-id="linkedChatId" @chat-opened="onChatOpened"
                  @changes="onChanges" @activity="onActivity" @view-changes="onViewChanges" @review-changes="onReviewChanges"
                  @open-preview="onOpenPreview"
                />
              </template>
            </CodeBrowser>
          </div>
          <div v-if="ready" class="ide-bottom" :class="{ collapsed: bottomCollapsed, max: bottomMax && !bottomCollapsed }"
               :style="{ '--bp-h': bottomHeight + 'px' }">
            <!-- Drag the top border to resize the panel (arrow keys when focused; a double click restores it). -->
            <div v-if="!bottomCollapsed && !bottomMax" class="bp-resize" :class="{ active: bottomResizing }"
                 role="separator" aria-orientation="horizontal" :aria-label="t('ide.resizeBottom')" tabindex="0"
                 :aria-valuenow="bottomHeight" @mousedown="startBottomResize" @keydown="onBottomResizeKey"
                 @dblclick="setBottomHeight(BP_DEFAULT)"></div>
            <BottomPanel ref="bottomPanel" :pipeline-log="pipelineLog" :activity="activity" :collapsed="bottomCollapsed" :repo-id="Number(active.repo_id)" :ready="ready" :agent-commands="agentCommands" :maximized="bottomMax && !bottomCollapsed" @toggle="bottomCollapsed = !bottomCollapsed" @maximize="toggleBottomMax" @ask-agent="onAskFromPreview" @open-file="onOpenFromPreview" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, provide } from 'vue'
import { lazyComponent } from '@/utils/lazyComponent'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { connectGithubService, disconnectGithubService } from '@/composables/useGithubConnect'
import { usePoller } from '@/composables/usePoller'
import { reconnectingSocket } from '@/utils/reconnectingSocket'
import { notifyProjectJob, isFollowed } from '@/services/projectJobs'
import { saveBlob, filenameFrom } from '@/utils/saveBlob'
import { useUnsavedGuard } from '@/composables/useUnsavedGuard'
import { useIdeTheme } from '@/composables/useIdeTheme'
import { cloneRequest } from '@/utils/cloneByUrl'
import { startOpen, endOpen, openProgress, progressLabel, prefetchWake, HOVER_DWELL_MS } from '@/utils/projectOpenTiming'
import CodeBrowser from '../components/CodeBrowser.vue'
import UnifiedAgentChat from '../components/letscode/UnifiedAgentChat.vue'
import { CODING_CHAT_TABS, createCodingChatTabs } from '@/stores/useCodingChatTabs'
import { LANGUAGE_SERVERS, createLanguageServers } from '@/stores/useLanguageServers'
import { DEBUGGER, createDebugger } from '@/stores/useDebugger'
import BottomPanel from '../components/letscode/BottomPanel.vue'
import DeployButton from '../components/letscode/DeployButton.vue'
import ProjectCommands from '../components/letscode/ProjectCommands.vue'
import ProjectEnv from '../components/letscode/ProjectEnv.vue'
import ProjectTasks from '../components/letscode/ProjectTasks.vue'
import PipelineStepper from '../components/letscode/PipelineStepper.vue'
import StatusPill from '../components/letscode/StatusPill.vue'
import { isReady, phaseTone, relativeTime, githubWebUrl, linkedProject, openQuery } from '../components/letscode/projectStatus'
import { useChatStore } from '@/stores/useChatStore'
import { usePlanReviewStore } from '@/stores/usePlanReviewStore'
import { t } from '../components/letscode/messages'
// The phone view is its own chunk, fetched only when it is shown (ADM-1330).
const LetsCodeLight = lazyComponent(() => import('../components/letscode/LetsCodeLight.vue'), { loadingLabel: 'Loading the project…' })

const route = useRoute()
const router = useRouter()
const projects = ref([])
const projectsLoading = ref(true)
const active = ref(null)
const browserKey = ref(0)
const codeBrowser = ref(null)
const bottomCollapsed = ref(false)
const bottomPanel = ref(null)
const agentChat = ref(null)
// The editor's "Ask the Coding Agent about this" (ADM-1205 phase E): the chat tab comes in front and the selected code
// goes to its box.
const chatTabs = createCodingChatTabs()
provide(CODING_CHAT_TABS, chatTabs)
// The editor's language servers and the bottom panel's Problems / References (ADM-1205 phase F item 16): one store,
// for the project that is open; another project starts from nothing.
const languages = createLanguageServers({ systemId: () => Number(active.value?.system_id),
  repoId: () => Number(active.value?.repo_id) })
provide(LANGUAGE_SERVERS, languages)
watch(() => active.value && active.value.repo_id, () => languages.reset())
// The editor's debugger (ADM-1205 phase F item 17): Run and Debug, breakpoints, the Debug Console; one per project.
const debuggerStore = createDebugger({ systemId: () => Number(active.value?.system_id),
  repoId: () => Number(active.value?.repo_id) })
provide(DEBUGGER, debuggerStore)
watch(() => active.value && active.value.repo_id, () => debuggerStore.reset())
function onAskSelection(sel) { chatTabs.showChat(); agentChat.value?.addSelection(sel) }
// The plan under review (plan mode, PLAN_REVIEW_LIKE_CLAUDE_PLAN.md) is read beside the chat as the editor's rendered
// preview of the project's `docs/plans/<date>-<request>-<run>.md`. The chat and the editor share one pane here, so a plan that opens by itself is
// added as a tab behind the chat (its card stays in view); "Open the plan" brings it to the front. The editor's tab is
// this page's panel, so the request is taken and the flag cleared.
const chat = useChatStore()
const planReview = usePlanReviewStore()
watch(() => [planReview.open, planReview.review && planReview.review.key, codeBrowser.value], ([open]) => {
  const review = open ? planReview.forConversation(chat.conversationId) : null
  if (!review || !codeBrowser.value) return
  codeBrowser.value.openMarkdownPreview(review.path || 'plan.md', review.content, { focus: planReview.focus })
  planReview.closePanel()
})

// The Review tab's comments (ADM-1329): one message, sent in the chat that made the change; the tab hears whether the
// chat took it (its comments are cleared only then).
async function onSendReview({ conversationId, text, done }) {
  let ok = false
  try { ok = !!(await agentChat.value?.sendReview({ conversationId, text })) } catch { ok = false }
  if (typeof done === 'function') done(ok)
}
// The Preview tab's "Ask the agent" about an element (ADM-1318): one message, with the preview's picture, to the chat in
// front, the same path as the Review tab's comments; the tab hears whether the chat took it.
async function onAskFromPreview({ text, files, done }) {
  let ok = false
  try { ok = !!(await agentChat.value?.sendReview({ text, files })) } catch { ok = false }
  if (typeof done === 'function') done(ok)
}
// A place the Preview tab found the selected element at (ADM-1318): that file, at that line, in the editor.
function onOpenFromPreview(loc) { codeBrowser.value?.openAt?.(loc) }
// The chat's "Open preview" (ADM-1205 phase D): the bottom panel's Preview tab, on that port.
function onOpenPreview(port) {
  if (bottomPanel.value) bottomPanel.value.openPreview(port)
  else window.open(`/preview/lets-code/${active.value?.repo_id}/${port}`, '_blank')   // the panel shows once ready
}
// The terminal's Maximize (ADM-1211): the bottom panel fills the editor's column; the editor stays open underneath.
const bottomMax = ref(false)
function toggleBottomMax() {
  if (bottomCollapsed.value) bottomCollapsed.value = false
  bottomMax.value = !bottomMax.value
}
const pipelineLog = ref([])
const activity = ref([])
// The commands the Coding Agent ran in this project, for the Terminal tab's "Coding Agent" entry (ADM-1196).
const agentCommands = ref([])
const branches = ref([])
const switchingBranch = ref(false)
const retryingId = ref(null)

const ready = computed(() => isReady(active.value))
const isFailed = (p) => phaseTone(p) === 'err'

// ── Resizable bottom panel (drag its top border, or arrow keys on the handle; ADM-1205) ──
const ideLeftEl = ref(null)
const BP_MIN = 120
const BP_DEFAULT = 220
const BP_EDITOR_MIN = 140                       // the editor always keeps this much
const bottomHeight = ref(Number(localStorage.getItem('lc.bottomHeight')) || BP_DEFAULT)
const bottomResizing = ref(false)
function clampHeight(h) {
  const rect = ideLeftEl.value?.getBoundingClientRect()
  const max = rect ? Math.max(BP_MIN, rect.height - BP_EDITOR_MIN) : 900
  return Math.round(Math.max(BP_MIN, Math.min(h, max)))
}
function setBottomHeight(h) {
  bottomHeight.value = clampHeight(h)
  try { localStorage.setItem('lc.bottomHeight', String(bottomHeight.value)) } catch { /* kept for this visit */ }
}
function startBottomResize(e) {
  e.preventDefault()
  bottomResizing.value = true
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onBottomResize)
  window.addEventListener('mouseup', stopBottomResize)
}
function onBottomResize(e) {
  if (!bottomResizing.value) return
  const rect = ideLeftEl.value?.getBoundingClientRect()
  if (!rect) return
  bottomHeight.value = clampHeight(rect.bottom - e.clientY)      // the panel hugs the column's bottom
}
function stopBottomResize() {
  bottomResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onBottomResize)
  window.removeEventListener('mouseup', stopBottomResize)
  setBottomHeight(bottomHeight.value)
}
function onBottomResizeKey(e) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  e.preventDefault()
  setBottomHeight(bottomHeight.value + (e.key === 'ArrowUp' ? 24 : -24))
}
onBeforeUnmount(() => { if (bottomResizing.value) stopBottomResize() })

// ── GitHub repositories ──
const ghNotConnected = ref(false)
const ghAccount = ref('')
const ghBusy = ref('')            // 'connect' | 'switch' | 'disconnect' while one runs
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
    newError.value = e?.response?.data?.error || t('landing.createFailed')
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
    else notify.error(e?.response?.data?.error || t('landing.reposFailed'))
  } finally { loadingRepos.value = false }
}

// Connect, or switch to another account (GitHub shows its account picker). Both go through the GitHub
// service's own sign-in, as the Connectors page does. The popup must open inside the click: nothing awaits first.
async function signInGithub(kind) {
  if (ghBusy.value) return
  ghBusy.value = kind
  const before = ghAccount.value
  try {
    await connectGithubService(api, { switchAccount: kind === 'switch' })
    repos.value = []
    await loadGithubRepos()
    if (kind === 'switch') {
      notify.success(ghAccount.value && ghAccount.value !== before
        ? t('landing.switchedTo', { account: ghAccount.value }) : t('landing.stillConnectedAs', { account: ghAccount.value || before }))
    } else {
      notify.success(ghAccount.value ? t('landing.connectedAsNamed', { account: ghAccount.value }) : t('landing.connected'))
    }
  } catch (e) { notify.error(e?.message || t('landing.connectFailed')) }
  finally { ghBusy.value = '' }
}
const connectGithub = () => signInGithub('connect')
const switchGithubAccount = () => signInGithub('switch')

async function disconnectGithub() {
  if (ghBusy.value) return
  const ok = await confirm({
    title: t('landing.disconnectTitle'),
    message: t('landing.disconnectMessage', { account: ghAccount.value || t('landing.thisAccount') }),
    confirmText: t('landing.disconnect'), cancelText: t('common.cancel'), danger: true,
  })
  if (!ok) return
  ghBusy.value = 'disconnect'
  try {
    await disconnectGithubService(api)
    repos.value = []
    ghAccount.value = ''
    repoQuery.value = ''
    ghNotConnected.value = true
    notify.success(t('landing.disconnected'))
  } catch (e) { notify.error(e?.message || t('landing.disconnectFailed')) }
  finally { ghBusy.value = '' }
}

// Clone by address: any https://github.com/owner/repository, on a branch if one is named (ADM-1205, phase C). The
// server checks the address and the branch name again; these are the same rules, said before anything is sent.
const cloneUrl = ref('')
const cloneBranch = ref('')
const cloneUrlError = ref('')
// The address form's own clone is running. Its button compared `cloningUrl` with the typed address, and idle with
// the box empty both are '', so it said "Cloning" with a spinner while nothing ran (ADM-1128, 2026-11-17).
const cloningByAddress = ref(false)
async function cloneByUrl() {
  cloneUrlError.value = ''
  const req = cloneRequest(cloneUrl.value, cloneBranch.value)
  if (req.error) { cloneUrlError.value = req.error; return }
  if (cloningUrl.value) return
  cloningUrl.value = req.body.github_url
  cloningByAddress.value = true
  try {
    const { data } = await api.createProject(req.body)
    cloneUrl.value = ''
    cloneBranch.value = ''
    await loadProjects()
    openProject(data)
  } catch (e) {
    const d = e?.response?.data || {}
    if (d.github_not_connected) { ghNotConnected.value = true; cloneUrlError.value = t('landing.connectFirst') }
    else cloneUrlError.value = d.error || t('landing.cloneFailed')
  } finally { cloningUrl.value = ''; cloningByAddress.value = false }
}

async function cloneRepo(r) {
  if (cloningUrl.value) return
  cloningUrl.value = r.clone_url
  try {
    // No branch: the server clones the repository's own default branch, read from the remote itself (GitHub's
    // listing says "main" even for an empty repository, and that clone then failed on a branch that does not exist).
    const { data } = await api.createProject({ github_url: r.clone_url, name: r.name })
    await loadProjects()
    openProject(data)
  } catch (e) {
    const d = e?.response?.data || {}
    if (d.github_not_connected) { ghNotConnected.value = true; notify.error(t('landing.connectFirstShort')) }
    else notify.error(d.error || t('landing.cloneRepoFailed'))
  } finally { cloningUrl.value = '' }
}

// OPENING A PROJECT, MEASURED (ADM-1326): each step to "ready" (the tree and the editor answering) is recorded, and the
// person sees one line saying what it waits for. A project still being prepared is not measured (its stepper shows).
const openLabel = computed(() => (active.value && openProgress.value
  && openProgress.value.repoId === Number(active.value.repo_id) ? progressLabel(openProgress.value) : ''))

// The pointer resting on a project's card, or its keyboard focus, wakes the project's parked sandbox early, so the
// click finds it waking or awake. A touch opens straight away (the open asks for the wake too).
let hoverTimer = null
function mayPrefetch(p) { return isReady(p) && !isFailed(p) }
function onCardPointer(p, e) {
  if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
  clearTimeout(hoverTimer)
  if (mayPrefetch(p)) hoverTimer = setTimeout(() => prefetchWake(p, api), HOVER_DWELL_MS)
}
function onCardLeave() { clearTimeout(hoverTimer) }
function onCardFocus(p) { if (mayPrefetch(p)) prefetchWake(p, api) }
onBeforeUnmount(() => clearTimeout(hoverTimer))

function openProject(p) {
  // The address names the open project (and, once one is open, its chat), so a reload opens both again. A chat named
  // there is kept only for the project it belongs to.
  const sameProject = String(route.query.project || '') === String(p.repo_id)
  router.replace({ query: openQuery(route.query, { project: p.repo_id, chat: sameProject ? route.query.chat : null }) })
  clearTimeout(hoverTimer)
  if (isReady(p)) startOpen(p, api)
  else endOpen()
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
      else if (msg.event === 'job' && msg.data) notifyProjectJob(msg.data)
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
// The phone view shows no files, so nothing is watched for it.
function wantWatch() { return !!active.value && isReady(active.value) && !document.hidden && !lightView.value }
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
  resumeProjectJobs()
}

// THE LONG BUTTONS KEEP RUNNING (ADM-1269). Check project, commit, push, pull, publish, a pull request, a download
// and a backup run as background jobs. A page opened again while one runs follows it: the person is told it is still
// running and when it ends; Check project's problems reach the Problems tab and a download is saved.
const JOB_KINDS = new Set(['check', 'commit', 'push', 'pull', 'publish', 'pull_request', 'download', 'backup'])
async function resumeProjectJobs() {
  const a = active.value
  if (!a?.repo_id || !a.system_id) return
  let jobs = []
  try { jobs = (await api.getRunningProjectJobs(a.system_id, a.repo_id)).data?.jobs || [] } catch { return }
  for (const job of jobs) if (!isFollowed(job.id)) followResumedJob(a, job)
}
async function followResumedJob(a, job) {
  const label = t(JOB_KINDS.has(job.kind) ? `ide.job.${job.kind}` : 'ide.job.other')
  if (job.kind === 'check') { languages.check(job); return }
  notify.info(t('ide.jobStillRunning', { label }))
  const stillHere = () => active.value?.repo_id === a.repo_id
  try {
    const { data } = await api.waitForProjectJob(a.system_id, a.repo_id, job, { isCancelled: () => !stillHere() })
    if (job.kind === 'download' || job.kind === 'backup') {
      const file = await api.getProjectJobFile(a.system_id, a.repo_id, job.id)
      saveBlob(file.data, filenameFrom(file.headers, data?.name || 'download'))
    }
    notify.success(t('ide.jobFinished', { label }))
    if (stillHere()) codeBrowser.value?.refresh?.()
  } catch (e) {
    if (e?.name !== 'AbortError') notify.error(e?.response?.data?.error || t('ide.jobFailed', { label }))
  }
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
    title: t('ide.switchBranchTitle', { branch }),
    message: t('ide.switchBranchMessage'),
    confirmText: t('ide.switchBranch'), cancelText: t('common.cancel'), danger: true,
  })
  if (!ok) { active.value = { ...active.value }; return }   // re-render puts the select back on the current branch
  switchingBranch.value = true
  try {
    const { data } = await api.switchProjectBranch(active.value.repo_id, branch)
    applyStatus(data)
    notify.info(t('ide.switchingTo', { branch }))
    pollStatus()   // phase → switching/indexing → ready; editor remounts when ready
  } catch (e) {
    notify.error(e?.response?.data?.error || t('ide.switchFailed'))
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

// ── The phone view or the full editor (ADM-1330) ──
// A phone-width screen opens a project in the light view; the person's own choice ("Full editor" / "Phone view") is
// kept on this device and wins. `?view=light|editor` in the address names one for that visit (a link, a live check).
const PHONE = '(max-width: 640px)'
const VIEW_KEY = 'lc.view'
const phoneQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(PHONE) : null
const isPhone = ref(!!phoneQuery?.matches)
function onPhoneChange(e) { isPhone.value = !!e.matches }
phoneQuery?.addEventListener?.('change', onPhoneChange)
onBeforeUnmount(() => phoneQuery?.removeEventListener?.('change', onPhoneChange))
function readViewPref() {
  try { const v = localStorage.getItem(VIEW_KEY); return v === 'light' || v === 'editor' ? v : '' } catch { return '' }
}
const viewPref = ref(readViewPref())
const lightView = computed(() => {
  const asked = String(route.query.view || '')
  if (asked === 'light' || asked === 'editor') return asked === 'light'
  if (viewPref.value) return viewPref.value === 'light'
  return isPhone.value
})
function setView(v) {
  viewPref.value = v
  try { localStorage.setItem(VIEW_KEY, v) } catch { /* kept for this visit */ }
  if (route.query.view) {
    const { view: _drop, ...rest } = route.query
    router.replace({ query: rest })
  }
}
// From the editor: its unsaved edits are asked about first, as on leaving the project.
async function toPhoneView() {
  if (await unsavedGuard.mayLeave()) setView('light')
}
watch(lightView, () => { if (active.value) sendWatch() })

// Unsaved edits are never lost without a question: leaving the project, another page, closing the tab (ADM-1200).
const unsavedGuard = useUnsavedGuard(() => codeBrowser.value?.unsavedCount)
// The editor's own light or dark, toggled in its bar (ADM-1205).
const { theme: ideTheme, isDark: ideDark, toggle: toggleIdeTheme } = useIdeTheme()

async function onBackToProjects() {
  if (await unsavedGuard.mayLeave()) closeProject()
}

function closeProject() {
  router.replace({ query: openQuery(route.query, {}) })
  endOpen()
  statusPoller.stop()
  closeWs()
  active.value = null
  loadProjects()
}

async function retryProject(p, { startEmpty = false } = {}) {
  if (retryingId.value) return
  if (startEmpty) {
    const ok = await confirm({
      title: t('landing.startEmptyTitle', { name: p.name }),
      message: t('landing.startEmptyMessage'),
      confirmText: t('landing.startAgainEmpty'), cancelText: t('common.cancel'), danger: true,
    })
    if (!ok) return
  }
  retryingId.value = p.repo_id
  try {
    const { data } = await api.retryProject(p.repo_id, startEmpty ? { start_empty: true } : {})
    notify.info(t(startEmpty ? 'landing.startingAgain' : 'landing.retrying', { name: p.name }))
    if (active.value && active.value.repo_id === p.repo_id) {
      applyStatus(data)
      pollStatus(); connectWs()
    } else {
      openProject({ ...p, ...data })
    }
    loadProjects()
  } catch (e) {
    notify.error(e?.response?.data?.error || t('landing.retryFailed'))
  } finally {
    retryingId.value = null
  }
}

async function removeProject(p) {
  const ok = await confirm({
    title: t('landing.removeTitle'),
    message: t(p.is_new ? 'landing.removeNewMessage' : 'landing.removeMessage', { name: p.name }),
    confirmText: t('landing.remove'), cancelText: t('common.cancel'), danger: true,
  })
  if (!ok) return
  try { await api.deleteProject(p.repo_id); notify.success(t('landing.removed')); await loadProjects() }
  catch (e) { notify.error(e?.response?.data?.error || t('landing.removeFailed')) }
}

// Published to GitHub from Source control: the project now has its GitHub address and branches.
async function onPublished() {
  if (!active.value) return
  try { const { data } = await api.getProject(active.value.repo_id); active.value = { ...active.value, ...data } }
  catch { /* the next status update brings it */ }
  loadBranches()
  loadProjects()
}

// Source control made or moved to a branch (New branch, or a commit on a new branch): the branch picker shows the
// branch git reports, and lists it. Not while a switch is under way: that switch decides the branch.
function onBranchSeen(branch) {
  if (!active.value || !branch || switchingBranch.value || !ready.value || branch === active.value.branch) return
  active.value = { ...active.value, branch }
  loadBranches()
}

// A turn changed files: the tree, Source control and open tabs reload in place.
function onChanges() { codeBrowser.value?.refresh?.() }
// "View changes" under an answer: the Source control list, where each file opens its diff.
function onViewChanges() { codeBrowser.value?.showSourceControl?.() }
// "Review changes" under an answer (ADM-1314): that turn's changes, one at a time, in the editor's Review tab.
function onReviewChanges(p) { codeBrowser.value?.openReview?.(p) }
function onActivity(lines) { if (Array.isArray(lines)) activity.value = lines }

onMounted(async () => { await loadProjects(); openLinkedProject(); loadGithubRepos() })

// `/dashboard/lets-code?project=<id>&chat=<id>` opens that project and its chat: the page keeps them there, so a reload
// comes back to them, and the notification before a sandbox is deleted links to a project the same way (ADM-1205 phase
// F item 18). Only one of the person's own projects opens; another one's link is removed from the address.
function openLinkedProject() {
  const link = linkedProject(projects.value, route.query)
  if (!link) return
  if (link.project) {
    openProject(link.project)
    return
  }
  notify.error(t('landing.projectGone'))
  router.replace({ query: link.query })
}
// The chat the address names, for the open project's chat panel to open first.
const linkedChatId = computed(() => (route.query.chat ? String(route.query.chat) : null))
// A background task's chat, opened from the Tasks panel: its tab in the chat panel (ADM-1328).
function onOpenTaskChat(id) {
  agentChat.value?.openChat?.(id)
}
// The chat panel opened a chat (or gave a new one its id): the address names it.
function onChatOpened(id) {
  if (!active.value) return
  if (String(route.query.chat || '') === String(id || '')) return
  router.replace({ query: openQuery(route.query, { project: active.value.repo_id, chat: id || null }) })
}
onBeforeUnmount(() => {
  endOpen(); statusPoller.stop(); closeWs(); languages.dispose(); debuggerStore.dispose()
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
.lc-cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 36px; margin-top: 28px; }
@media (min-width: 1024px) { .lc-cols { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; } }
.lc-col { min-width: 0; display: flex; flex-direction: column; }
/* Column header: the title, and how many there are. Both columns line up on it. */
.lc-col-head { display: flex; align-items: center; gap: 8px; min-height: 28px; margin-bottom: 14px; }
.lc-col-h { margin: 0; font: 700 17px/1.3 var(--vm-font-display); letter-spacing: -.01em; color: var(--vm-ink); }
.lc-count { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; background: var(--vm-surface-soft); border: 1px solid var(--vm-line); font: 600 12px/1 var(--vm-font-sans); font-variant-numeric: tabular-nums; color: var(--vm-ink-soft); }
.lc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border: 1px solid var(--vm-line); border-radius: var(--vm-r); background: var(--vm-surface); overflow: hidden; }
.lc-list > li + li { border-top: 1px solid var(--vm-line); }
.lc-empty { margin: 0; display: flex; align-items: center; gap: 12px; padding: 18px 16px; border: 1px dashed var(--vm-line-2); border-radius: var(--vm-r); font-size: 14px; line-height: 1.5; color: var(--vm-ink-soft); }
.lc-empty p { margin: 0; }
.lc-empty-ic { width: 22px; height: 22px; flex: 0 0 auto; color: var(--vm-ink-faint); }

/* Buttons */
.lc-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 0 13px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: border-color .15s, background-color .15s, color .15s; }
.lc-btn :deep(svg) { width: 15px; height: 15px; }
.lc-btn:hover:not(:disabled) { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.lc-btn:disabled { opacity: .55; cursor: not-allowed; }
.lc-btn.danger { color: var(--vm-danger); }
.lc-btn.danger:hover:not(:disabled) { border-color: var(--vm-danger); background: color-mix(in srgb, var(--vm-danger) 8%, transparent); }
.lc-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: var(--lc-on-solid); }
.lc-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); border-color: var(--vm-violet-d); }
.lc-btn:focus-visible, .proj-name:focus-visible, .proj-del:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.lc-btn.sm { min-height: 32px; padding: 0 11px; font-size: 12.5px; }
.lc-btn.sm :deep(svg) { width: 14px; height: 14px; }
/* Disconnect: quiet until pointed at, so it never competes with the account's main action. */
.lc-btn.quiet-danger { color: var(--vm-ink-soft); }
.lc-btn.quiet-danger:hover:not(:disabled) { color: var(--vm-danger); border-color: var(--vm-danger); background: color-mix(in srgb, var(--vm-danger) 8%, transparent); }

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
.gh-mark { display: grid; place-items: center; width: 44px; height: 44px; flex: 0 0 auto; border-radius: 12px; background: var(--vm-ink); color: var(--vm-surface); }
.gh-mark :deep(svg) { width: 22px; height: 22px; }
.gh-mark.sm { width: 34px; height: 34px; border-radius: 9px; }
.gh-mark.sm :deep(svg) { width: 17px; height: 17px; }
.gh-connect { display: flex; align-items: flex-start; gap: 16px; padding: 22px 20px; border: 1px solid var(--vm-line); border-radius: var(--vm-r); background: var(--vm-surface); }
.gh-connect-body { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.gh-t { margin: 0; font: 600 15px/1.35 var(--vm-font-sans); color: var(--vm-ink); }
.gh-s { margin: 0 0 10px; font-size: 13.5px; line-height: 1.5; color: var(--vm-ink-soft); max-width: 52ch; }

/* The connected GitHub account: who, then Switch account and Disconnect. */
.gh-acct { display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; margin-bottom: 12px; padding: 10px 12px; border: 1px solid var(--vm-line); border-radius: var(--vm-r); background: var(--vm-surface); }
/* The account name is shown in full: when it and the buttons do not fit on one line, the buttons move to
   their own line, right-aligned (it was cut to "sajid-the-backend-engin..." live, 2026-11-10). */
.gh-acct-id { flex: 1 1 auto; min-width: 0; margin: 0; display: flex; flex-direction: column; gap: 1px; }
.gh-acct-k { font-size: 12px; line-height: 1.3; color: var(--vm-ink-soft); }
.gh-acct-name { font: 600 14px/1.3 var(--vm-font-mono); color: var(--vm-ink); overflow-wrap: anywhere; }
.gh-acct-actions { display: flex; gap: 8px; flex: 0 0 auto; margin-left: auto; }

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
.lc-ide { display: flex; flex-direction: column; height: 100%; background: var(--vm-bg); color: var(--vm-ink); color-scheme: light; }
.lc-ide[data-theme="dark"] { color-scheme: dark; }
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
.ide-gh { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px; text-decoration: none; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); transition: border-color .15s, background-color .15s; }
.ide-gh:hover { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.ide-gh :deep(svg) { width: 15px; height: 15px; }
.ide-gh .ext { width: 13px; height: 13px; color: var(--vm-ink-faint); }
/* With no GitHub link the Deploy button takes the link's place at the end of the bar. */
.ide-theme {
  margin-left: auto; display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; padding: 0; border: 1px solid var(--vm-line-2); border-radius: 8px;
  background: var(--vm-surface); color: var(--vm-ink-soft); cursor: pointer;
  transition: border-color .15s, background-color .15s, color .15s;
}
.ide-theme:hover { border-color: var(--vm-violet); background: var(--vm-violet-soft); color: var(--vm-ink); }
/* The phone view's switch: shown only on a narrow screen (below). */
.ide-phone { display: none; place-items: center; width: 34px; height: 34px; flex: 0 0 auto; padding: 0; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink-soft); cursor: pointer; transition: border-color .15s, background-color .15s, color .15s; }
.ide-phone:hover { border-color: var(--vm-violet); background: var(--vm-violet-soft); color: var(--vm-ink); }
.ide-phone:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.ide-phone :deep(svg) { width: 16px; height: 16px; }
.ide-theme:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.ide-theme :deep(svg) { width: 16px; height: 16px; }

.ide-main { flex: 1; min-height: 0; display: flex; }
.ide-left { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ide-editor { flex: 1; min-height: 0; position: relative; }
/* The opening line (ADM-1326): a quiet pill over the editor's foot, out of the layout. */
.ide-open {
  position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 20; max-width: calc(100% - 32px);
  display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 7px 14px; border-radius: 999px;
  border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink-soft);
  font: 500 13px/1.3 var(--vm-font-sans); box-shadow: 0 4px 16px color-mix(in srgb, var(--vm-ink) 10%, transparent);
  pointer-events: none; white-space: nowrap;
}
.ide-open :deep(svg) { width: 14px; height: 14px; flex: 0 0 auto; color: var(--vm-violet); }
.ide-open span:first-of-type { overflow: hidden; text-overflow: ellipsis; }
.ide-open-s { font-variant-numeric: tabular-nums; color: var(--vm-ink-soft); }
.lc-byurl { display: flex; flex-direction: column; gap: 6px; margin: 0 0 12px; }
.lc-byurl-l { font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); }
.lc-byurl-row { display: flex; gap: 6px; flex-wrap: wrap; }
.lc-byurl-in {
  flex: 1 1 220px; min-width: 0; padding: 7px 10px; font: 13px var(--vm-font-sans); color: var(--vm-ink);
  background: var(--vm-surface); border: 1px solid var(--vm-line-2); border-radius: 8px;
}
.lc-byurl-in.br { flex: 0 1 160px; }
.lc-byurl-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; border-color: transparent; }
.lc-byurl-err { margin: 0; font-size: 12.5px; color: var(--vm-red-ink); }
.ide-bottom { position: relative; height: var(--bp-h, 220px); flex: 0 0 auto; }
/* Drag handle over the bottom panel's top border. */
.bp-resize { position: absolute; left: 0; right: 0; top: -4px; height: 8px; cursor: row-resize; z-index: 6; }
.bp-resize::after { content: ''; position: absolute; left: 0; right: 0; top: 3px; height: 2px; background: transparent; transition: background-color .15s; }
.bp-resize:hover::after, .bp-resize.active::after, .bp-resize:focus-visible::after { background: var(--vm-violet); }
.bp-resize:focus-visible { outline: none; }
.ide-bottom.collapsed { height: auto; }
.ide-left.bottom-max .ide-editor { flex: 0 0 0; overflow: hidden; }
.ide-bottom.max { flex: 1 1 auto; height: auto; min-height: 0; }

/* Narrow screens: the page scrolls instead of squeezing the editor. */
@media (max-width: 900px) {
  .lc { overflow-y: auto; }
  .lc-ide { height: auto; min-height: 100%; }
  .ide-main { flex-direction: column; }
  .ide-left { min-height: 70vh; }
  /* The editor fills its area. Here the area's height comes from flex, so the editor's own `height: 100%` resolved to
     its content: at 375 px, one pane at a time, the editor was 63 px tall in a 354 px area (ADM-1128, 2026-11-17). */
  .ide-editor > :deep(.code-browser) { position: absolute; inset: 0; height: auto; }
  .ide-gh { margin-left: 0; }
}
@media (max-width: 640px) {
  .lc-wrap { padding: 24px 16px 48px; }
  .lc-title { font-size: 26px; }
  .lc-btn, .ide-back, .ide-gh, .ide-branch { min-height: 44px; }
  .ide-theme { width: 44px; height: 44px; }
  .ide-phone { display: grid; width: 44px; height: 44px; }
  .gh-acct-actions { width: 100%; }
  .gh-acct-actions .lc-btn { flex: 1; }
  .proj-del { width: 44px; height: 44px; }
  .proj-row { flex-wrap: wrap; }
  .proj-name { flex-basis: 100%; }
  .proj-pill { margin-left: 0; }
  .proj-del { margin-left: auto; }
  .ide-gh-t { display: none; }
  .ide-proj { max-width: 100%; }
  /* The header in two rows, not three (ADM-1267, 2026-11-17: 165 px of an 812 px screen at 375 px). Row one: back,
     the project, its status, the editor theme. Row two: the branch, then GitHub, Commands, Variables, Deploy. The
     zero-height item is the break between them; wider screens keep one bar. */
  .ide-bar { gap: 6px; padding: 6px 8px; }
  .ide-bar::after { content: ''; order: 5; flex: 0 0 100%; height: 0; }
  .ide-back { order: 1; min-width: 44px; justify-content: center; padding: 0 6px; }
  .ide-back-t { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .ide-proj { order: 2; flex: 1 1 0; }
  .ide-bar > .lc-pill { order: 3; }
  .ide-theme { order: 4; }
  .ide-phone { order: 4; }
  .ide-branch { order: 6; flex: 1 1 0; min-width: 0; }
  .ide-branch select { min-width: 0; width: 100%; }
  .ide-gh { order: 7; }
  .ide-bar > .pc { order: 8; }
  .ide-bar > .pe { order: 9; }
  .ide-bar > .dp { order: 10; }
}
@media (prefers-reduced-motion: reduce) {
  .spin, .lc-skel::after { animation: none; }
}
</style>
