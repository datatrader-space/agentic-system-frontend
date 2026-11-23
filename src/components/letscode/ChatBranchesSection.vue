<template>
  <!-- Chats' branches (backend phase 7b): a Coding Agent chat may work in its own copy of the project (a git worktree on
       its own branch), so two chats never edit the same files at once. Here the person sees each one, opens its
       changes, merges its branch into the shared copy, or discards it. Hidden while no chat has a copy of its own. -->
  <section v-if="list.length || error" class="cbs" aria-labelledby="cbs-h" data-test="chat-branches">
    <div class="cbs-h">
      <h4 id="cbs-h" class="cbs-title">Chats' branches <span class="cbs-count">{{ list.length }}</span></h4>
      <span v-if="into" class="cbs-into">merge into <code>{{ into }}</code></span>
      <button type="button" class="cbs-icon" :disabled="loading || !!busy" title="Refresh the chats' branches"
              aria-label="Refresh the chats' branches" @click="load">
        <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" aria-hidden="true" />
      </button>
    </div>
    <p v-if="error" class="cbs-note err" role="alert">{{ error }}</p>

    <ul class="cbs-list">
      <li v-for="w in list" :key="w.chat_id" class="cbs-item" :data-test="`cbs-row-${w.chat_id}`">
        <div class="cbs-row">
          <button type="button" class="cbs-open" :aria-expanded="openId === key(w) ? 'true' : 'false'"
                  :disabled="!w.present" :title="w.present ? 'Show this chat\'s changes' : 'This chat\'s copy is not there any more'"
                  @click="toggle(w)">
            <Icon :icon="openId === key(w) ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="cbs-chev" aria-hidden="true" />
            <span class="cbs-name">{{ title(w) }}</span>
          </button>
          <span v-if="w.working" class="cbs-pill working" data-test="cbs-working">
            <Icon icon="lucide:loader" class="spin" aria-hidden="true" /> Working
          </span>
        </div>
        <div class="cbs-meta">
          <code class="cbs-branch" translate="no" :title="w.branch"><Icon icon="lucide:git-branch" aria-hidden="true" /> {{ w.branch }}</code>
          <span class="cbs-facts">{{ facts(w) }}</span>
        </div>

        <!-- The chat's own changes, read from its copy (`chat=`). -->
        <ul v-if="openId === key(w)" class="cbs-files">
          <li v-if="files[key(w)] === undefined" class="cbs-note">Loading the changes…</li>
          <li v-else-if="!files[key(w)].length" class="cbs-note">No changes waiting to be committed.</li>
          <li v-for="f in files[key(w)] || []" :key="f.path">
            <button type="button" class="cbs-file" :title="`Show the changes in ${f.path}`" @click="openDiff(w, f)">
              <span class="cbs-badge" :class="f.status">{{ letter(f) }}</span>
              <span class="cbs-path">{{ f.path }}</span>
            </button>
          </li>
        </ul>

        <!-- Merging a chat that has changes not committed commits them first, with this message. -->
        <form v-if="messageFor === key(w)" class="cbs-form" @submit.prevent="merge(w)">
          <label class="cbs-label" :for="`cbs-msg-${key(w)}`">This chat has changes not committed. Commit message <span class="cbs-hint">(required)</span></label>
          <input :id="`cbs-msg-${key(w)}`" v-model="message" class="cbs-input" type="text" autocomplete="off"
                 :disabled="!!busy" name="chat-merge-message" placeholder="What this chat changed…" data-test="cbs-message"
                 :aria-invalid="triedMessage && !message.trim() ? 'true' : 'false'" />
          <p v-if="triedMessage && !message.trim()" class="cbs-note err" role="alert">Write a commit message for this chat's changes.</p>
          <div class="cbs-actions">
            <button type="submit" class="cbs-btn primary" :disabled="!!busy" data-test="cbs-commit-merge">
              <Icon icon="lucide:git-merge" aria-hidden="true" /> {{ busy === 'merge:' + key(w) ? 'Merging…' : 'Commit and merge' }}
            </button>
            <button type="button" class="cbs-btn" :disabled="!!busy" @click="messageFor = ''">Cancel</button>
          </div>
        </form>
        <div v-else class="cbs-actions">
          <button type="button" class="cbs-btn" :disabled="!!busy || w.working || !w.has_work"
                  :title="mergeHint(w)" :data-test="`cbs-merge-${w.chat_id}`" @click="startMerge(w)">
            <Icon icon="lucide:git-merge" aria-hidden="true" /> {{ busy === 'merge:' + key(w) ? 'Merging…' : `Merge into ${into || 'the project'}` }}
          </button>
          <!-- ADM-1327: the chat's branch to a pull request (pushed first when GitHub lacks its commits), and links. -->
          <a v-if="w.pull_request_url" class="cbs-btn" :href="w.pull_request_url" target="_blank" rel="noopener noreferrer"
             title="Open the pull request on GitHub" :data-test="`cbs-pr-link-${w.chat_id}`">
            <Icon icon="lucide:git-pull-request" aria-hidden="true" /> Pull request
          </a>
          <button v-else-if="w.chat_exists !== false" type="button" class="cbs-btn" :disabled="!!busy || !!pullRequestBlocker(w)"
                  :title="pullRequestBlocker(w) || `Open a pull request from ${w.branch} into ${w.base || 'the project\'s branch'}`"
                  :data-test="`cbs-open-pr-${w.chat_id}`" @click="openPr(w)">
            <Icon icon="lucide:git-pull-request" aria-hidden="true" /> {{ busy === 'pr:' + key(w) ? 'Opening…' : 'Open pull request' }}
          </button>
          <a v-if="w.preview && w.preview.state === 'READY' && w.preview.url" class="cbs-btn" :href="w.preview.url" target="_blank"
             rel="noopener noreferrer" title="Open this branch's Vercel preview" :data-test="`cbs-preview-link-${w.chat_id}`">
            <Icon icon="lucide:external-link" aria-hidden="true" /> Preview
          </a>
          <button type="button" class="cbs-btn danger" :disabled="!!busy || w.working"
                  :title="w.working ? 'The chat is working. Try when it stops.' : 'Delete this chat\'s copy and its branch'"
                  :aria-label="`Discard ${w.branch}`" :data-test="`cbs-discard-${w.chat_id}`" @click="discard(w)">
            <Icon icon="lucide:trash-2" aria-hidden="true" /> {{ busy === 'discard:' + key(w) ? 'Discarding…' : 'Discard' }}
          </button>
        </div>
        <p v-if="notes[key(w)]" class="cbs-note" :class="{ err: notes[key(w)].err }" role="alert" :data-test="`cbs-note-${w.chat_id}`">
          {{ notes[key(w)].text }}
        </p>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { openPullRequestFor, pullRequestBlocker } from '@/services/chatBranchApi'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
})
// open-diff: { path, status, chat, chatLabel } — a file as that chat's copy changed it.
// changed: the shared copy changed (a merge, or a merge that stopped on conflicts).
// branches: the list read, so the chat tabs show their branch. merge-conflict: { branch, conflicts }.
const emit = defineEmits(['open-diff', 'changed', 'branches', 'merge-conflict'])

const list = ref([])
const into = ref('')
const loading = ref(false)
const error = ref('')
const busy = ref('')                  // 'merge:<chat>' | 'discard:<chat>' while one runs
const openId = ref('')
const files = reactive({})
const notes = reactive({})            // chat -> { text, err }
const messageFor = ref('')
const message = ref('')
const triedMessage = ref(false)
let gone = false

const key = (w) => String(w.chat_id)
const title = (w) => (w.chat_exists === false ? 'A deleted chat' : (String(w.chat_title || '').trim() || 'Untitled chat'))
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function facts(w) {
  const out = []
  if (w.ahead) out.push(`${plural(w.ahead, 'commit', 'commits')} to merge`)
  if (w.behind) out.push(`${w.behind} behind ${into.value || 'the project'}`)
  if (w.changes) out.push(`${plural(w.changes, 'change', 'changes')} not committed`)
  if (!out.length) out.push(w.has_work ? 'Ready to merge' : 'No work yet')
  return out.join(' · ')
}
function mergeHint(w) {
  if (w.working) return 'The chat is working. Try when it stops.'
  if (!w.has_work) return 'Nothing to merge yet'
  return `Bring this chat's work into ${into.value || 'the project'}`
}
const _LETTER = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: 'U', conflict: '!' }
const letter = (f) => _LETTER[f.status] || '?'
function setNote(w, text, err = true) {
  if (text) notes[key(w)] = { text, err }
  else delete notes[key(w)]
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.getChatWorktrees(props.systemId, props.repoId)
    if (gone) return
    list.value = Array.isArray(data?.worktrees) ? data.worktrees : []
    into.value = data?.into || ''
    emit('branches', list.value)
  } catch (e) {
    // No chats' branches to show is the usual case; a failure is said only when there were some on screen.
    if (list.value.length) error.value = e?.response?.data?.error || 'The chats\' branches could not be loaded.'
  } finally {
    loading.value = false
  }
}

async function toggle(w) {
  const k = key(w)
  openId.value = openId.value === k ? '' : k
  if (!openId.value) return
  delete files[k]
  try {
    const { data } = await api.getSourceControlStatus(props.systemId, props.repoId, { chat: w.chat_id })
    files[k] = [...(data?.changes || []), ...(data?.untracked || [])]
  } catch (e) {
    files[k] = []
    setNote(w, e?.response?.data?.error || 'This chat\'s changes could not be loaded.')
  }
}
function openDiff(w, f) {
  emit('open-diff', { path: f.path, status: f.status, chat: String(w.chat_id), chatLabel: w.branch || 'chat' })
}

function startMerge(w) {
  setNote(w, '')
  if (w.changes > 0) { messageFor.value = key(w); message.value = ''; triedMessage.value = false; return }
  merge(w)
}

function heldText(h) {
  if (!h) return 'Another merge or discard is running on this project. Try when it ends.'
  const who = [h.chat_title && `"${h.chat_title}"`, h.person].filter(Boolean).join(', ')
  const since = h.since ? new Date(h.since) : null
  const at = since && !Number.isNaN(since.getTime()) ? ` since ${since.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''
  return `Another chat's branch is being ${h.step || 'merged'}${who ? ` (${who})` : ''}${at}. Try when it ends.`
}

async function merge(w) {
  if (busy.value) return
  const text = messageFor.value === key(w) ? message.value.trim() : ''
  if (messageFor.value === key(w) && !text) { triedMessage.value = true; return }
  triedMessage.value = false
  busy.value = 'merge:' + key(w)
  setNote(w, '')
  try {
    await api.mergeChatWorktree(props.systemId, props.repoId, w.chat_id, text || undefined)
    notify.success(`Merged ${w.branch} into ${into.value || 'the project'}`)
    messageFor.value = ''
    message.value = ''
    emit('changed')
    await load()
  } catch (e) {
    const d = e?.response?.data || {}
    switch (d.code) {
      case 'CHAT_HAS_CHANGES':
        messageFor.value = key(w)
        setNote(w, 'This chat has changes not committed. Write a commit message, and they are committed before the merge.', false)
        break
      case 'CHAT_WORKING':
        setNote(w, 'The chat is working. Try when it stops.')
        break
      case 'NOTHING_TO_MERGE':
        setNote(w, `Nothing to merge: ${into.value || 'the project'} already has everything on this branch.`, false)
        break
      case 'BUSY':
        setNote(w, heldText(d.held_by))
        break
      case 'MERGE_CONFLICT': {
        const c = Array.isArray(d.conflicts) ? d.conflicts : []
        const names = c.map((x) => (typeof x === 'string' ? x : x?.path)).filter(Boolean)
        setNote(w, `The merge stopped on ${plural(names.length || c.length, 'file', 'files')} changed on both sides`
          + `${names.length ? `: ${names.join(', ')}` : ''}. Resolve them above, in the shared copy: open each one, keep the lines`
          + ' you want, then Mark resolved and Commit, or Abort merge.')
        messageFor.value = ''
        emit('merge-conflict', { branch: w.branch, conflicts: names })
        emit('changed')
        break
      }
      default:
        setNote(w, d.error || 'The merge did not work. Try again.')
    }
  } finally {
    busy.value = ''
  }
}

// "Open pull request" (ADM-1327): the person's own press, as them; the server works on that chat's own copy.
async function openPr(w) {
  if (busy.value || pullRequestBlocker(w)) return
  busy.value = 'pr:' + key(w)
  setNote(w, '')
  try {
    const { data } = await openPullRequestFor(props.systemId, props.repoId, w)
    notify.success(data?.existing ? 'The pull request was already open' : `Opened a pull request from ${w.branch}`)
    await load()
  } catch (e) {
    const d = e?.response?.data || {}
    setNote(w, d.code === 'GITHUB_NOT_CONNECTED' ? 'Connect GitHub first, then open the pull request.'
      : (d.error || 'The pull request was not opened. Try again.'))
  } finally {
    busy.value = ''
  }
}

async function discard(w) {
  if (busy.value) return
  const lost = []
  if (w.changes) lost.push(`${plural(w.changes, 'change', 'changes')} not committed`)
  if (w.ahead) lost.push(`${plural(w.ahead, 'commit', 'commits')} not merged into ${into.value || 'the project'}`)
  const ok = await confirm({
    title: `Discard the branch ${w.branch}?`,
    message: `This deletes the copy of the project that "${title(w)}" works in, and its branch. `
      + (lost.length ? `Lost for good: ${lost.join(' and ')}.` : 'It holds no work that is not in the project.')
      + ' The chat itself stays in Chat history.',
    confirmText: 'Discard', danger: true,
  })
  if (!ok) return
  busy.value = 'discard:' + key(w)
  setNote(w, '')
  try {
    await api.discardChatWorktree(props.systemId, props.repoId, w.chat_id)
    notify.success(`Discarded ${w.branch}`)
    if (openId.value === key(w)) openId.value = ''
    await load()
  } catch (e) {
    const d = e?.response?.data || {}
    if (d.code === 'CHAT_WORKING') setNote(w, 'The chat is working. Try when it stops.')
    else if (d.code === 'BUSY') setNote(w, heldText(d.held_by))
    else if (d.code === 'NO_WORKTREE') { notify.success('This chat has no copy of its own any more.'); await load() }
    else setNote(w, d.error || 'The branch could not be discarded. Try again.')
  } finally {
    busy.value = ''
  }
}

onMounted(load)
onBeforeUnmount(() => { gone = true })
watch(() => [props.systemId, props.repoId], () => { list.value = []; openId.value = ''; load() })
defineExpose({ refresh: load })
</script>

<style scoped>
.cbs { border-top: 1px solid var(--vm-line); padding-bottom: 8px; }
.cbs-h { display: flex; align-items: center; gap: 6px; padding: 8px 10px 4px; }
.cbs-title { margin: 0; display: flex; align-items: center; gap: 6px; font: 600 12px var(--vm-font-sans); color: var(--vm-ink-soft); }
.cbs-count { background: var(--vm-surface-soft); color: var(--vm-ink-soft); border-radius: 8px; padding: 0 6px; font-size: 11px; }
.cbs-into { font-size: 11.5px; color: var(--vm-ink-faint); }
.cbs-into code { font: 11px var(--vm-font-mono); }
.cbs-icon { margin-left: auto; border: none; background: transparent; color: var(--vm-ink-soft); cursor: pointer; border-radius: 6px;
            width: 28px; height: 28px; display: grid; place-items: center; }
.cbs-icon:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.cbs-icon :deep(svg) { width: 13px; height: 13px; }
.cbs-list, .cbs-files { list-style: none; margin: 0; padding: 0; }
.cbs-item { padding: 6px 10px 8px; border-bottom: 1px solid var(--vm-line); }
.cbs-item:last-child { border-bottom: none; }
.cbs-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.cbs-open { display: flex; align-items: center; gap: 4px; flex: 1 1 auto; min-width: 0; padding: 2px 0; border: none; background: transparent;
            color: var(--vm-ink); cursor: pointer; text-align: left; font: 600 12.5px var(--vm-font-sans); }
.cbs-open:disabled { cursor: default; color: var(--vm-ink-soft); }
.cbs-chev { width: 12px; height: 12px; flex: 0 0 auto; color: var(--vm-ink-faint); }
.cbs-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cbs-pill { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.cbs-pill.working { background: var(--vm-violet-soft); color: var(--vm-violet-ink); }
.cbs-pill :deep(svg) { width: 11px; height: 11px; }
.cbs-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin: 3px 0 6px 16px; }
.cbs-branch { display: inline-flex; align-items: center; gap: 3px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
              font: 600 11.5px var(--vm-font-mono); color: var(--vm-ink); }
.cbs-branch :deep(svg) { width: 11px; height: 11px; flex: 0 0 auto; }
.cbs-facts { font-size: 11.5px; color: var(--vm-ink-soft); }
.cbs-files { margin: 0 0 6px 10px; }
.cbs-file { display: flex; align-items: center; gap: 7px; width: 100%; min-width: 0; padding: 4px 6px; border: none; border-radius: 6px;
            background: transparent; cursor: pointer; text-align: left; }
.cbs-file:hover { background: var(--vm-surface-soft); }
.cbs-badge { flex: 0 0 auto; width: 16px; text-align: center; font: 700 11px var(--vm-font-mono); color: var(--vm-ink-soft); }
.cbs-badge.modified { color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
.cbs-badge.added, .cbs-badge.untracked { color: color-mix(in srgb, var(--vm-green) 65%, var(--vm-ink)); }
.cbs-badge.deleted { color: var(--vm-red-ink); }
.cbs-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 12px var(--vm-font-mono); color: var(--vm-ink); }
.cbs-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-left: 16px; }
.cbs-form { display: flex; flex-direction: column; gap: 6px; margin-left: 16px; }
.cbs-form .cbs-actions { margin-left: 0; }
.cbs-label { font-weight: 600; font-size: 12px; color: var(--vm-ink-soft); }
.cbs-hint { font-weight: 400; color: var(--vm-ink-faint); }
.cbs-input { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 7px; background: var(--vm-surface);
             color: var(--vm-ink); font: 12.5px/1.45 var(--vm-font-sans); }
.cbs-input[aria-invalid='true'] { border-color: var(--vm-danger); }
.cbs-form .cbs-note { margin-left: 0; }
.cbs-input::placeholder { color: var(--vm-ink-faint); opacity: 1; }
a.cbs-btn { text-decoration: none; }
.cbs-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 10px; border: 1px solid var(--vm-line-2); border-radius: 7px;
           background: var(--vm-surface); color: var(--vm-ink); font: 600 12px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, border-color .15s, color .15s; }
.cbs-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.cbs-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: #fff; }
.cbs-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d, var(--vm-violet)); }
.cbs-btn.danger:hover:not(:disabled) { color: var(--vm-red-ink); border-color: var(--vm-red-ink); }
.cbs-btn:disabled { opacity: .55; cursor: not-allowed; }
.cbs-btn :deep(svg) { width: 13px; height: 13px; }
.cbs-btn:focus-visible, .cbs-open:focus-visible, .cbs-file:focus-visible, .cbs-icon:focus-visible, .cbs-input:focus-visible {
  outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.cbs-note { margin: 6px 0 0 16px; font-size: 12px; line-height: 1.45; color: var(--vm-ink-soft); }
.cbs-files .cbs-note { margin: 2px 0; }
.cbs-note.err { color: var(--vm-red-ink); }
.spin { animation: cbs-spin 1s linear infinite; } @keyframes cbs-spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .cbs-btn, .cbs-file, .cbs-open { min-height: 44px; } .cbs-icon { width: 44px; height: 44px; } .cbs-input { font-size: 16px; } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
