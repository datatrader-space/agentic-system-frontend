<!--
  ChatBranchBar (ADM-1327, plan G14): the branch the chat on screen works on, when it works in its own copy of the
  project, and what comes next for it: "Open pull request" (pushed first when GitHub lacks its last commits), its
  Vercel preview when the person has Vercel connected, and the links to both. Every press is the person's own; the
  server acts as them, on THIS chat's copy only. Production is never deployed from here. No native dialogs.
-->
<template>
  <div v-if="row" class="cbb" role="group" :aria-label="`This chat's branch ${row.branch}`" data-test="chat-branch-bar">
    <code class="cbb-branch" translate="no" :title="branchTitle">
      <Icon icon="lucide:git-branch" aria-hidden="true" /> {{ row.branch }}
    </code>
    <span class="cbb-facts" data-test="cbb-facts">{{ facts }}</span>

    <div class="cbb-actions">
      <a v-if="row.pull_request_url" class="cbb-link" :href="row.pull_request_url" target="_blank" rel="noopener noreferrer"
         title="Open the pull request on GitHub" data-test="cbb-pr-link">
        <Icon icon="lucide:git-pull-request" aria-hidden="true" /> Pull request
      </a>
      <button v-if="row.pull_request_url && row.unpushed > 0" type="button" class="cbb-icon" :disabled="!!busy || row.working"
              :title="`Push ${plural(row.unpushed, 'commit', 'commits')} to the pull request`"
              :aria-label="`Push ${plural(row.unpushed, 'commit', 'commits')} to the pull request`" data-test="cbb-push" @click="push">
        <Icon :icon="busy === 'push' ? 'lucide:loader-2' : 'lucide:upload'" :class="{ spin: busy === 'push' }" aria-hidden="true" />
      </button>
      <button v-if="!row.pull_request_url" type="button" class="cbb-btn primary" :disabled="!!busy || !!blocker"
              :title="blocker || `Open a pull request from ${row.branch} into ${row.base || 'the project\'s branch'}`"
              data-test="cbb-open-pr" @click="openPr">
        <Icon :icon="busy === 'pr' ? 'lucide:loader-2' : 'lucide:git-pull-request'" :class="{ spin: busy === 'pr' }" aria-hidden="true" />
        {{ busy === 'pr' ? 'Opening…' : 'Open pull request' }}
      </button>

      <a v-if="previewUrl" class="cbb-link" :href="previewUrl" target="_blank" rel="noopener noreferrer"
         title="Open this branch's Vercel preview" data-test="cbb-preview-link">
        <Icon icon="lucide:external-link" aria-hidden="true" /> Preview
      </a>
      <button v-if="vercelConnected" type="button" class="cbb-icon" :disabled="!!busy || previewActive || row.working"
              :title="previewActive ? 'The preview is building on Vercel' : `Deploy a Vercel preview of ${row.branch}`"
              :aria-label="previewActive ? 'The preview is building on Vercel' : `Deploy a Vercel preview of ${row.branch}`"
              data-test="cbb-deploy-preview" @click="deployPreview">
        <Icon :icon="previewActive || busy === 'preview' ? 'lucide:loader-2' : 'lucide:rocket'"
              :class="{ spin: previewActive || busy === 'preview' }" aria-hidden="true" />
      </button>
    </div>
    <p v-if="note" class="cbb-note" :class="{ err: note.err }" role="alert" data-test="cbb-note">{{ note.text }}</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import chatBranchApi, { openPullRequestFor, pullRequestBlocker } from '@/services/chatBranchApi'
import { notify } from '@/composables/useNotify'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
  chatId: { type: [String, Number], default: null },
  // Bumped by the chat after each of this chat's turns (`lets_code_branch`): the branch is read again.
  refreshKey: { type: Number, default: 0 },
})
const emit = defineEmits(['branch'])

const row = ref(null)
const vercelConnected = ref(false)
const busy = ref('')                   // 'pr' | 'push' | 'preview'
const note = ref(null)                 // { text, err }
let gone = false
let timer = null
let polls = 0
const POLL_MS = 5000
const MAX_POLLS = 150                  // a preview build is followed for about 12 minutes, then read on the next turn

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const blocker = computed(() => pullRequestBlocker(row.value))
const preview = computed(() => row.value?.preview || null)
const previewActive = computed(() => !!preview.value?.active)
const previewUrl = computed(() => (preview.value?.state === 'READY' && preview.value?.url) || '')
const branchTitle = computed(() => (row.value?.own_branch
  ? `This chat was started on its own branch, from ${row.value.base || "the project's branch"}`
  : `This chat works in its own copy of the project, from ${row.value?.base || "the project's branch"}`))
const facts = computed(() => {
  const w = row.value
  if (!w) return ''
  const out = []
  if (w.working) out.push('Working')
  out.push(w.ahead ? plural(w.ahead, 'commit', 'commits') : 'No commits yet')
  if (w.changes) out.push(`${plural(w.changes, 'change', 'changes')} not committed`)
  if (w.ahead) out.push(!w.on_remote ? 'Not on GitHub yet' : (w.unpushed ? `${w.unpushed} not pushed` : 'Pushed'))
  if (previewActive.value) out.push('Preview building')
  else if (preview.value?.error) out.push('Preview failed')
  return out.join(' · ')
})

function say(text, err = true) { note.value = text ? { text, err } : null }
function errorText(e, fallback) {
  const d = e?.response?.data || {}
  if (d.code === 'GITHUB_NOT_CONNECTED') return 'Connect GitHub first, then open the pull request.'
  if (d.code === 'VERCEL_NOT_CONNECTED') return 'Connect Vercel in the Deploy panel first.'
  if (d.code === 'DEPLOY_RUNNING') return 'A preview of this branch is already building.'
  return (typeof d.error === 'string' && d.error) || fallback
}

async function load() {
  clearTimeout(timer)
  if (!props.chatId) { row.value = null; return }
  try {
    const { data } = await api.getChatWorktrees(props.systemId, props.repoId)
    if (gone) return
    const list = Array.isArray(data?.worktrees) ? data.worktrees : []
    row.value = list.find((w) => String(w.chat_id) === String(props.chatId) && w.present !== false) || null
    if (row.value) emit('branch', { chatId: String(props.chatId), branch: row.value.branch })
  } catch { /* the bar stays as it was; the next turn reads it again */ }
  if (previewActive.value && polls < MAX_POLLS && !gone) { polls += 1; timer = setTimeout(load, POLL_MS) }
}
async function loadVercel() {
  try {
    const { data } = await api.getVercelConnection()
    if (!gone) vercelConnected.value = !!data?.connected
  } catch { vercelConnected.value = false }
}

async function openPr() {
  if (busy.value || blocker.value || !row.value) return
  busy.value = 'pr'
  say('')
  try {
    const { data } = await openPullRequestFor(props.systemId, props.repoId, row.value)
    notify.success(data?.existing ? 'The pull request was already open' : `Opened a pull request from ${row.value.branch}`)
    await load()
  } catch (e) {
    say(errorText(e, 'The pull request was not opened. Try again.'))
  } finally {
    busy.value = ''
  }
}
async function push() {
  if (busy.value || !row.value) return
  busy.value = 'push'
  say('')
  try {
    await chatBranchApi.pushChatBranch(props.systemId, props.repoId, row.value.chat_id)
    notify.success(`Pushed ${row.value.branch}`)
    await load()
  } catch (e) {
    say(errorText(e, 'The branch was not pushed. Try again.'))
  } finally {
    busy.value = ''
  }
}
async function deployPreview() {
  if (busy.value || previewActive.value || !row.value) return
  busy.value = 'preview'
  say('')
  try {
    await chatBranchApi.deployChatPreview(props.repoId, row.value.chat_id)
    notify.success(`Deploying a preview of ${row.value.branch}`)
    polls = 0
    await load()
  } catch (e) {
    say(errorText(e, 'The preview did not start. Try again.'))
  } finally {
    busy.value = ''
  }
}

watch(() => [props.systemId, props.repoId, props.chatId], () => { row.value = null; say(''); polls = 0; load() }, { immediate: true })
watch(() => props.refreshKey, () => { polls = 0; load() })
loadVercel()
onBeforeUnmount(() => { gone = true; clearTimeout(timer) })
defineExpose({ refresh: load })
</script>

<style scoped>
.cbb { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; padding: 6px 10px; border-top: 1px solid var(--vm-line);
       background: var(--vm-bg); font: 12px var(--vm-font-sans); color: var(--vm-ink-soft); }
.cbb + :deep(.uac-composer) { border-top: none; }
.cbb-branch { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis;
              white-space: nowrap; font: 600 12px var(--vm-font-mono); color: var(--vm-ink); }
.cbb-branch :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; color: var(--vm-violet); }
.cbb-facts { min-width: 0; color: var(--vm-ink-soft); }
.cbb-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-left: auto; }
.cbb-btn, .cbb-link { display: inline-flex; align-items: center; gap: 5px; min-height: 28px; padding: 0 10px; border: 1px solid var(--vm-line-2);
                      border-radius: 7px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12px var(--vm-font-sans);
                      text-decoration: none; cursor: pointer; transition: background-color .15s, border-color .15s, color .15s; }
.cbb-btn:hover:not(:disabled), .cbb-link:hover { background: var(--vm-surface-soft); }
.cbb-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: #fff; }
.cbb-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d, var(--vm-violet)); }
.cbb-btn:disabled, .cbb-icon:disabled { opacity: .5; cursor: not-allowed; }
.cbb-icon { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid transparent; border-radius: 7px; background: transparent;
            color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; }
.cbb-icon:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.cbb-btn :deep(svg), .cbb-link :deep(svg), .cbb-icon :deep(svg) { width: 14px; height: 14px; flex: 0 0 auto; }
.cbb-btn:focus-visible, .cbb-link:focus-visible, .cbb-icon:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
.cbb-note { flex-basis: 100%; margin: 2px 0 0; line-height: 1.45; color: var(--vm-ink-soft); }
.cbb-note.err { color: var(--vm-red-ink); }
.spin { animation: cbb-spin 1s linear infinite; } @keyframes cbb-spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .cbb-btn, .cbb-link { min-height: 44px; }
  .cbb-icon { width: 44px; height: 44px; }
}
@media (pointer: coarse) { .cbb-icon { width: 44px; height: 44px; } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
