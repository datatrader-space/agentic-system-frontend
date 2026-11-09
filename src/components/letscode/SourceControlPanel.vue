<template>
  <!-- VS Code–style Source Control over the project's repository. The agent edits the files; this is where the
       person sees every change (click one for its side-by-side diff, `open-diff`), discards a file, commits,
       pushes and opens a pull request (owner, 2026-11-09). A new project with no GitHub repository commits on
       its own branch and is published from here (ADM-1183). Gitignored files are not listed. -->
  <div class="scm">
    <div class="scm-head">
      <span class="scm-branch" :title="status.branch"><Icon icon="lucide:git-branch" aria-hidden="true" /> {{ status.branch || 'No branch' }}</span>
      <button type="button" class="scm-refresh" :disabled="loading || busy" title="Refresh" aria-label="Refresh source control" @click="load">
        <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" />
      </button>
    </div>

    <div v-if="waiting" class="scm-empty" role="status" aria-live="polite">
      <Icon icon="lucide:loader" class="spin muted" aria-hidden="true" /> The project's sandbox is starting. Trying again in {{ waiting }}s…
    </div>
    <div v-else-if="loading && !fetched" class="scm-empty">Loading changes…</div>
    <div v-else-if="error" class="scm-empty err" role="alert">{{ error }}</div>

    <template v-else>
      <!-- Commit: a message, and a new branch when on the default branch (it changes only through a pull request). -->
      <form v-if="!status.clean" class="scm-commit" @submit.prevent="commit">
        <label class="sr-only" for="scm-message">Commit message</label>
        <textarea id="scm-message" v-model="message" class="scm-input" rows="2" placeholder="Commit message"
                  :disabled="busy" @keydown.ctrl.enter.prevent="commit" @keydown.meta.enter.prevent="commit"></textarea>
        <div v-if="status.on_default" class="scm-branchrow">
          <label class="scm-label" for="scm-branch">New branch <span class="scm-hint">({{ status.default_branch }} changes through a pull request)</span></label>
          <input id="scm-branch" v-model="branch" class="scm-input" type="text" spellcheck="false" autocomplete="off"
                 :placeholder="suggestedBranch" :disabled="busy" />
        </div>
        <button type="submit" class="scm-btn primary" :disabled="busy || !message.trim()">
          <Icon icon="lucide:check" aria-hidden="true" /> {{ action === 'commit' ? 'Committing…' : (status.on_default ? 'Commit to new branch' : 'Commit') }}
        </button>
      </form>

      <!-- A new project: GitHub enters only here, when the person publishes it. -->
      <form v-if="!status.has_remote && status.has_commit" class="scm-publish" @submit.prevent="publish">
        <p class="scm-publish-h"><Icon icon="lucide:github" aria-hidden="true" /> Publish to GitHub</p>
        <label class="scm-label" for="scm-repo">Repository name</label>
        <input id="scm-repo" v-model="repoName" class="scm-input" type="text" spellcheck="false" autocomplete="off"
               :placeholder="projectName || 'my-project'" :disabled="busy" />
        <label class="scm-check">
          <input id="scm-private" v-model="isPrivate" type="checkbox" :disabled="busy" />
          Private repository
        </label>
        <button type="submit" class="scm-btn primary" :disabled="busy">
          <Icon icon="lucide:upload-cloud" aria-hidden="true" /> {{ action === 'publish' ? 'Publishing…' : 'Publish to GitHub' }}
        </button>
      </form>
      <p v-else-if="!status.has_remote && !status.has_commit && loaded" class="scm-note">
        Commit your changes, then publish the project to GitHub.
      </p>

      <!-- After a commit: push the branch, then open a pull request. -->
      <div v-if="canPush || canOpenPr || prUrl" class="scm-sync">
        <button v-if="canPush" type="button" class="scm-btn" :disabled="busy" @click="push">
          <Icon icon="lucide:upload" aria-hidden="true" />
          {{ action === 'push' ? 'Pushing…' : `Push ${status.unpushed} ${status.unpushed === 1 ? 'commit' : 'commits'}` }}
        </button>
        <button v-if="canOpenPr" type="button" class="scm-btn" :disabled="busy" @click="openPullRequest">
          <Icon icon="lucide:git-pull-request" aria-hidden="true" /> {{ action === 'pr' ? 'Opening…' : 'Open pull request' }}
        </button>
        <a v-if="prUrl" class="scm-pr" :href="prUrl" target="_blank" rel="noopener noreferrer">
          <Icon icon="lucide:external-link" aria-hidden="true" /> View pull request
        </a>
      </div>
      <p v-if="actionError" class="scm-note err" role="alert">{{ actionError }}</p>

      <div v-if="status.clean" class="scm-empty">
        <Icon icon="lucide:check-circle-2" aria-hidden="true" /> No changes. The working tree is clean.
      </div>
      <div v-else class="scm-list">
        <template v-for="g in groups" :key="g.key">
          <div v-if="g.items.length" class="scm-group">
            <div class="scm-group-h">{{ g.label }} <span class="scm-count">{{ g.items.length }}</span></div>
            <div v-for="it in g.items" :key="g.key + it.path" class="scm-rowwrap" :class="{ active: selected === it.path }">
              <button type="button" class="scm-row" :title="`Show the changes in ${it.path}`" @click="openDiff(it)">
                <span class="scm-badge" :class="it.status" :title="it.status">{{ letter(it) }}</span>
                <span class="scm-path">{{ it.path }}</span>
              </button>
              <button type="button" class="scm-discard" :disabled="busy" :aria-label="`Discard the changes in ${it.path}`"
                      title="Discard changes" @click="discard(it)">
                <Icon icon="lucide:undo-2" aria-hidden="true" />
              </button>
            </div>
          </div>
        </template>
        <p v-if="status.has_remote" class="scm-foot">
          <Icon icon="lucide:clock" aria-hidden="true" />
          These changes are in this project's sandbox. Changes you have not pushed are kept for 3 days after
          you last use the project.
        </p>
      </div>
      <p v-if="loaded && !status.has_remote" class="scm-foot warn">
        <Icon icon="lucide:triangle-alert" aria-hidden="true" />
        This project is only in its sandbox, which is deleted 3 days after you last use the project. Publish it
        to GitHub to keep a copy.
      </p>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { whileSandboxStarts } from '@/utils/sandboxStarting'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
  // The project's name: the repository name Publish suggests.
  projectName: { type: String, default: '' },
})
const emit = defineEmits(['count', 'open-diff', 'changed', 'published'])

const status = reactive({ branch: '', default_branch: '', on_default: false, unpushed: 0, on_remote: false,
                          has_remote: true, has_commit: true, clean: true, changes: [], untracked: [] })
const loading = ref(false)
// True once a status has been read. Until then the panel shows "Loading", never the empty default state: after
// a failed first load, a refresh flashed "No branch · The working tree is clean" (live test 2026-11-09).
const fetched = ref(false)
const loaded = computed(() => fetched.value)
const repoName = ref('')
const isPrivate = ref(true)
const error = ref('')
const waiting = ref(0)
const selected = ref('')
const message = ref('')
const branch = ref('')
const action = ref('')            // 'commit' | 'push' | 'pr' | 'discard' | 'publish' while one runs
const actionError = ref('')
const prUrl = ref('')
let gone = false

const busy = computed(() => !!action.value)
const groups = computed(() => [
  { key: 'changes', label: 'Changes', items: status.changes || [] },
  { key: 'untracked', label: 'Untracked', items: status.untracked || [] },
])
const canPush = computed(() => !status.on_default && status.branch && status.unpushed > 0)
const canOpenPr = computed(() => !status.on_default && status.branch && status.on_remote && !status.unpushed && !prUrl.value)
// A branch name from the message, the way the platform names its branches; the person can change it.
const suggestedBranch = computed(() => {
  const slug = message.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return `lets-code/${slug || 'changes'}`
})

const _LETTER = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: 'U' }
function letter(it) { return _LETTER[it.status] || '?' }

function apply(data) {
  Object.assign(status, {
    branch: data.branch || '', default_branch: data.default_branch || '', on_default: !!data.on_default,
    unpushed: data.unpushed || 0, on_remote: !!data.on_remote, clean: !!data.clean,
    has_remote: data.has_remote !== false, has_commit: data.has_commit !== false,
    changes: data.changes || [], untracked: data.untracked || [],
  })
  emit('count', status.changes.length + status.untracked.length)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await whileSandboxStarts(() => api.getSourceControlStatus(props.systemId, props.repoId),
      { onWaiting: (s) => { waiting.value = s }, isCancelled: () => gone })
    apply(data)
    fetched.value = true
  } catch (e) {
    error.value = e?.response?.data?.error || 'Could not load source control status.'
  } finally {
    loading.value = false
  }
}

async function run(kind, call, done) {
  action.value = kind
  actionError.value = ''
  try {
    const { data } = await whileSandboxStarts(call, { onWaiting: (s) => { waiting.value = s }, isCancelled: () => gone })
    if (data && 'clean' in data) apply(data)
    if (done) done(data)
    emit('changed')
  } catch (e) {
    const data = e?.response?.data
    actionError.value = data?.error || 'That did not work. Try again.'
    // Some refusals carry the state that changed anyway (a repository created whose push failed): show it.
    if (data && typeof data === 'object' && 'clean' in data) { apply(data); emit('changed') }
  } finally {
    action.value = ''
  }
}

function publish() {
  if (busy.value) return
  const name = (repoName.value.trim() || props.projectName || '').trim()
  run('publish', () => api.publishProject(props.systemId, props.repoId, { name, private: isPrivate.value }), (data) => {
    notify.success('Published to GitHub')
    emit('published', data.published || {})
  })
}

function commit() {
  if (busy.value || !message.value.trim()) return
  const body = { message: message.value.trim() }
  if (status.on_default) body.branch = (branch.value.trim() || suggestedBranch.value)
  run('commit', () => api.commitSourceControl(props.systemId, props.repoId, body), () => {
    notify.success('Committed')
    message.value = ''
    branch.value = ''
    prUrl.value = ''
  })
}

function push() {
  run('push', () => api.pushSourceControl(props.systemId, props.repoId), (data) => notify.success(`Pushed ${data.pushed}`))
}

function openPullRequest() {
  run('pr', () => api.openPullRequest(props.systemId, props.repoId, { title: status.branch }), (data) => {
    prUrl.value = data.url
    notify.success('Pull request opened')
  })
}

async function discard(it) {
  const ok = await confirm({
    title: `Discard the changes in ${it.path}?`,
    message: it.status === 'untracked' ? 'The new file is deleted.' : 'The file goes back to its last commit.',
    confirmText: 'Discard', danger: true,
  })
  if (!ok) return
  run('discard', () => api.discardSourceControlFile(props.systemId, props.repoId, it.path))
}

// The diff opens in the editor, side by side, as VS Code shows a change.
function openDiff(it) {
  selected.value = it.path
  emit('open-diff', { path: it.path, status: it.status })
}

onMounted(load)
onBeforeUnmount(() => { gone = true })
watch(() => [props.systemId, props.repoId], () => { prUrl.value = ''; load() })
defineExpose({ refresh: load })
</script>

<style scoped>
.scm { display: flex; flex-direction: column; height: 100%; min-height: 0; font: 12.5px var(--vm-font-sans); color: var(--vm-ink); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.scm-head { display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-bottom: 1px solid var(--vm-line); }
.scm-branch { display: inline-flex; align-items: center; gap: 5px; font: 600 12.5px var(--vm-font-mono); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scm-branch :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; }
.scm-refresh { margin-left: auto; border: none; background: transparent; color: var(--vm-ink-soft); cursor: pointer; border-radius: 6px; width: 28px; height: 28px; display: grid; place-items: center; }
.scm-refresh:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.scm-refresh:disabled { cursor: progress; }
.scm-refresh :deep(svg) { width: 14px; height: 14px; }
.scm-empty { padding: 16px 12px; color: var(--vm-ink-soft); display: flex; align-items: center; gap: 6px; line-height: 1.45; }
.scm-empty.err { color: var(--vm-red-ink); }
.scm-empty :deep(svg) { width: 14px; height: 14px; flex: 0 0 auto; color: var(--vm-green); }
.scm-empty :deep(svg.muted) { color: var(--vm-ink-faint); }

.scm-commit { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-bottom: 1px solid var(--vm-line); }
.scm-input { width: 100%; min-width: 0; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 7px; background: var(--vm-surface); color: var(--vm-ink); font: 12.5px/1.45 var(--vm-font-sans); resize: vertical; }
.scm-input:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; border-color: transparent; }
.scm-branchrow { display: flex; flex-direction: column; gap: 4px; }
.scm-label { font-weight: 600; font-size: 12px; color: var(--vm-ink-soft); }
.scm-hint { font-weight: 400; color: var(--vm-ink-faint); }
.scm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: 7px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, border-color .15s; }
.scm-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.scm-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: #fff; }
.scm-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); }
.scm-btn:disabled { opacity: .55; cursor: not-allowed; }
.scm-btn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.scm-btn :deep(svg) { width: 14px; height: 14px; }
.scm-sync { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px; border-bottom: 1px solid var(--vm-line); }
.scm-pr { display: inline-flex; align-items: center; gap: 5px; color: var(--vm-violet); font-weight: 600; text-decoration: none; }
.scm-pr:hover { text-decoration: underline; }
.scm-pr :deep(svg) { width: 13px; height: 13px; }
.scm-note { margin: 6px 10px 0; font-size: 12px; line-height: 1.45; }
.scm-publish { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-bottom: 1px solid var(--vm-line); }
.scm-publish-h { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 2px; font-weight: 700; font-size: 12.5px; color: var(--vm-ink); }
.scm-publish-h :deep(svg) { width: 14px; height: 14px; }
.scm-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--vm-ink-soft); cursor: pointer; }
.scm-check input { width: 15px; height: 15px; accent-color: var(--vm-violet); }
.scm-foot.warn { color: color-mix(in srgb, var(--vm-amber) 55%, var(--vm-ink)); }
.scm-note.err { color: var(--vm-red-ink); }

.scm-list { overflow: auto; flex: 0 1 auto; }
.scm-group-h { display: flex; align-items: center; gap: 6px; padding: 8px 10px 4px; font: 600 12px var(--vm-font-sans); color: var(--vm-ink-soft); }
.scm-count { background: var(--vm-surface-soft); color: var(--vm-ink-soft); border-radius: 8px; padding: 0 6px; font-size: 11px; }
.scm-rowwrap { display: flex; align-items: center; }
.scm-rowwrap:hover, .scm-rowwrap:focus-within { background: var(--vm-surface-soft); }
.scm-rowwrap.active { background: var(--vm-violet-soft); }
.scm-row { display: flex; align-items: center; gap: 7px; flex: 1 1 auto; min-width: 0; padding: 5px 4px 5px 10px; background: transparent; border: none; cursor: pointer; text-align: left; }
.scm-row:focus-visible, .scm-discard:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: -2px; }
.scm-discard { flex: 0 0 auto; display: grid; place-items: center; width: 28px; height: 28px; margin-right: 4px; border: none; border-radius: 6px; background: transparent; color: var(--vm-ink-faint); cursor: pointer; opacity: 0; transition: opacity .12s, color .12s, background-color .12s; }
.scm-rowwrap:hover .scm-discard, .scm-discard:focus-visible { opacity: 1; }
.scm-discard:hover:not(:disabled) { color: var(--vm-red-ink); background: var(--vm-surface); }
.scm-discard :deep(svg) { width: 14px; height: 14px; }
.scm-badge { flex: 0 0 auto; width: 16px; text-align: center; font: 700 11px var(--vm-font-mono); border-radius: 4px; color: var(--vm-ink-soft); }
.scm-badge.modified { color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
.scm-badge.added, .scm-badge.untracked { color: color-mix(in srgb, var(--vm-green) 65%, var(--vm-ink)); }
.scm-badge.deleted { color: var(--vm-red-ink); }
.scm-badge.renamed { color: var(--vm-violet); }
.scm-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink); font-family: var(--vm-font-mono); font-size: 12px; }
.scm-foot { display: flex; align-items: flex-start; gap: 6px; margin: 8px 12px 12px; font-size: 12px; line-height: 1.5; color: var(--vm-ink-soft); }
.scm-foot :deep(svg) { width: 12px; height: 12px; flex: 0 0 auto; margin-top: 3px; }
.spin { animation: scm-spin 1s linear infinite; } @keyframes scm-spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .scm-row { min-height: 44px; } .scm-refresh, .scm-discard { width: 44px; height: 44px; } .scm-discard { opacity: 1; }
  .scm-btn { min-height: 44px; } .scm-input { font-size: 16px; }
}
@media (hover: none) { .scm-discard { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
