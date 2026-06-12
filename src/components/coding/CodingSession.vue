<template>
  <div class="cs">
    <div class="cs-head">
      <button class="back" @click="$emit('back')"><Icon icon="lucide:arrow-left" /> Tasks</button>
      <span class="cs-status" :class="statusCls">
        <span class="vm-orb" :class="running ? 'is-live' : 'is-idle'"></span>{{ statusLabel }}
      </span>
    </div>

    <p class="cs-prompt">{{ task && task.prompt }}</p>

    <div v-if="task && task.error_message" class="cs-error">
      <Icon icon="lucide:alert-triangle" /> {{ task.error_message }}
    </div>

    <!-- Exported PR badge -->
    <a v-if="task && task.pr_url" :href="task.pr_url" target="_blank" rel="noopener" class="cs-pr">
      <Icon icon="logos:github-icon" /> Pull request opened
      <span class="cs-pr-branch" v-if="task.branch_name">{{ task.branch_name }}</span>
      <Icon icon="lucide:external-link" class="cs-pr-ext" />
    </a>

    <!-- Plan -->
    <div v-if="task && task.plan && task.plan.length" class="cs-card">
      <div class="cs-card-h">Plan</div>
      <ol class="cs-plan"><li v-for="(s, i) in task.plan" :key="i">{{ s }}</li></ol>
    </div>

    <!-- Live activity (while running) -->
    <div v-if="running && task && task.steps && task.steps.length" class="cs-card">
      <div class="cs-card-h">Activity</div>
      <div class="cs-steps">
        <div v-for="(st, i) in task.steps" :key="i" class="cs-step">
          <span class="vm-orb is-live"></span>{{ st.message }}
        </div>
      </div>
    </div>

    <!-- Changed files + diff viewer -->
    <div v-if="files.length" class="cs-card">
      <div class="cs-card-h">
        Changes
        <span class="cs-sum">
          <span v-if="verify" class="cs-verify" :class="verify.ok ? 'ok' : 'bad'">
            <Icon :icon="verify.ok ? 'lucide:shield-check' : 'lucide:shield-alert'" />
            {{ verify.ok ? 'Verified' : 'Checks failed' }}
          </span>
          {{ summary.files_changed }} files · <b class="add">+{{ summary.additions }}</b> / <b class="del">-{{ summary.deletions }}</b>
        </span>
      </div>

      <!-- Per-file diff (collapsible) -->
      <div v-for="(f, fi) in parsedDiff" :key="f.path" class="cs-fileblock">
        <button class="cs-filerow" @click="toggle(fi)">
          <Icon :icon="open[fi] ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="chev" />
          <Icon icon="lucide:file-code" class="fi" />
          <span class="fp">{{ f.path }}</span>
          <span class="add">+{{ f.additions }}</span>
          <span class="del">-{{ f.deletions }}</span>
        </button>
        <div v-show="open[fi]" class="cs-diffbody vm-scroll">
          <div v-for="(ln, li) in f.lines" :key="li" class="dl" :class="ln.cls">
            <code>{{ ln.text || ' ' }}</code>
          </div>
        </div>
      </div>

      <!-- Fallback: file summary only (no diff text) -->
      <template v-if="!parsedDiff.length">
        <div v-for="f in files" :key="f.path" class="cs-file">
          <Icon icon="lucide:file-code" class="fi" />
          <span class="fp">{{ f.path }}</span>
          <span class="add">+{{ f.additions }}</span>
          <span class="del">-{{ f.deletions }}</span>
        </div>
      </template>

      <!-- Review action bar -->
      <div class="cs-actions" v-if="reviewable || task.export_enabled">
        <button class="act ghost" @click="copyPatch" :disabled="!task.diff_text">
          <Icon icon="lucide:copy" /> Copy patch
        </button>
        <button class="act danger" @click="discard" :disabled="busy">
          <Icon icon="lucide:trash-2" /> Discard
        </button>
        <button
          v-if="task.export_enabled"
          class="act primary"
          @click="exportPr"
          :disabled="busy || exporting"
        >
          <Icon :icon="exporting ? 'lucide:loader-2' : 'logos:github-icon'" :class="{ spin: exporting }" />
          {{ task.pr_url ? 'Re-export' : 'Export to GitHub' }}
        </button>
        <span v-else class="cs-note inline">
          <Icon icon="lucide:info" /> Enable <code>GITHUB_PR_EXPORT_ENABLED</code> to push a branch + PR.
        </span>
      </div>
    </div>

    <div v-if="running" class="cs-running">
      <span class="vm-orb is-live"></span> {{ statusLabel }}…
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
  taskId: { type: [String, Number], required: true },
})
const emit = defineEmits(['back', 'changed'])

const task = ref(null)
const open = reactive({})
const busy = ref(false)
const exporting = ref(false)
let timer = null

const running = computed(() => ['queued', 'planning', 'editing', 'verifying', 'exporting'].includes(task.value?.status))
const reviewable = computed(() => task.value?.status === 'awaiting_review')
const files = computed(() => (task.value?.diff_summary?.files) || [])
const summary = computed(() => task.value?.diff_summary || { files_changed: 0, additions: 0, deletions: 0 })
const verify = computed(() => task.value?.diff_summary?.verify || null)

const statusLabel = computed(() => ({
  queued: 'Queued', planning: 'Planning', editing: 'Editing', verifying: 'Verifying',
  awaiting_review: 'Ready for review', failed: 'Failed', cancelled: 'Cancelled',
  exporting: 'Exporting…', exported: 'Exported',
}[task.value?.status] || task.value?.status || '…'))
const statusCls = computed(() => ({
  awaiting_review: 'ok', exported: 'ok', failed: 'err', cancelled: 'off',
}[task.value?.status] || 'run'))

// Parse the unified diff into per-file colored line blocks.
const parsedDiff = computed(() => {
  const text = task.value?.diff_text || ''
  if (!text) return []
  const out = []
  let cur = null
  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git')) {
      const m = raw.match(/ b\/(.+)$/)
      cur = { path: m ? m[1] : raw.replace('diff --git ', ''), lines: [], additions: 0, deletions: 0 }
      out.push(cur)
      continue
    }
    if (!cur) continue
    if (raw.startsWith('index ') || raw.startsWith('--- ') || raw.startsWith('+++ ') ||
        raw.startsWith('new file') || raw.startsWith('deleted file') ||
        raw.startsWith('similarity ') || raw.startsWith('rename ') || raw.startsWith('\\ No newline')) continue
    let cls = 'ctx'
    if (raw.startsWith('@@')) cls = 'hunk'
    else if (raw.startsWith('+')) { cls = 'add'; cur.additions++ }
    else if (raw.startsWith('-')) { cls = 'del'; cur.deletions++ }
    cur.lines.push({ cls, text: raw })
  }
  return out
})

function toggle(i) { open[i] = !open[i] }

async function copyPatch() {
  try {
    await navigator.clipboard.writeText(task.value?.diff_text || '')
    notify.success('Patch copied to clipboard')
  } catch {
    notify.error('Could not copy patch')
  }
}

async function discard() {
  const ok = await confirm({
    title: 'Discard these changes?',
    message: 'The local edits will be reverted and this task marked cancelled. This cannot be undone.',
    confirmText: 'Discard', cancelText: 'Keep', danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    const { data } = await api.discardCodingTask(props.systemId, props.repoId, props.taskId)
    task.value = data
    notify.success('Changes discarded')
    emit('changed')
    emit('back')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Discard failed')
  } finally {
    busy.value = false
  }
}

async function exportPr() {
  const ok = await confirm({
    title: 'Export to GitHub?',
    message: 'This pushes a new feature branch and opens a pull request. The default branch is never touched.',
    confirmText: 'Export', cancelText: 'Cancel',
  })
  if (!ok) return
  exporting.value = true
  try {
    const { data } = await api.exportCodingTask(props.systemId, props.repoId, props.taskId)
    task.value = data
    notify.info('Export started — opening branch + PR…')
    startPolling()
    emit('changed')
  } catch (e) {
    const d = e?.response?.data || {}
    notify.error(d.error || 'Export failed')
  } finally {
    exporting.value = false
  }
}

async function poll() {
  try {
    const { data } = await api.getCodingTask(props.systemId, props.repoId, props.taskId)
    task.value = data
    if (!running.value && timer) { clearInterval(timer); timer = null; emit('changed') }
  } catch {
    if (timer) { clearInterval(timer); timer = null }
  }
}

function startPolling() {
  if (timer) clearInterval(timer)
  poll()
  timer = setInterval(poll, 1600)
}

onMounted(startPolling)
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.cs { font-family: var(--vm-font-sans); }
.cs-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.back { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink-soft); font: 700 13px var(--vm-font-sans); padding: 8px 13px; border-radius: 11px; cursor: pointer; }
.back:hover { color: var(--vm-violet-d); border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.back :deep(svg) { width: 15px; height: 15px; }
.cs-status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 999px; }
.cs-status.ok { color: #059669; background: rgba(16,185,129,.12); }
.cs-status.run { color: #B45309; background: rgba(245,158,11,.14); }
.cs-status.err { color: var(--vm-danger); background: rgba(239,68,68,.1); }
.cs-status.off { color: var(--vm-ink-faint); background: var(--vm-bg); border: 1px solid var(--vm-line); }
.cs-prompt { font-family: var(--vm-font-display); font-size: 16px; font-weight: 700; color: var(--vm-ink); margin: 4px 0 14px; }
.cs-error { display: flex; align-items: center; gap: 8px; color: var(--vm-danger); background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2); border-radius: 12px; padding: 10px 12px; font-size: 13px; margin-bottom: 14px; }
.cs-error :deep(svg) { width: 16px; height: 16px; }
.cs-pr { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: var(--vm-ink); background: var(--vm-surface); border: 1px solid var(--vm-line-2); border-radius: 12px; padding: 9px 13px; font: 700 13px var(--vm-font-sans); margin-bottom: 14px; box-shadow: var(--vm-shadow-s); }
.cs-pr:hover { border-color: var(--vm-violet); }
.cs-pr :deep(svg) { width: 17px; height: 17px; }
.cs-pr-branch { font: 600 11.5px ui-monospace, monospace; color: var(--vm-violet-d); background: var(--vm-violet-soft); padding: 2px 8px; border-radius: 7px; }
.cs-pr-ext { margin-left: 2px; color: var(--vm-ink-faint); }
.cs-card { background: var(--vm-surface); border: 1px solid var(--vm-line); border-radius: var(--vm-r); box-shadow: var(--vm-shadow-s); padding: 16px; margin-bottom: 14px; }
.cs-card-h { display: flex; align-items: center; justify-content: space-between; font: 700 12px var(--vm-font-sans); text-transform: uppercase; letter-spacing: .05em; color: var(--vm-ink-faint); margin-bottom: 10px; }
.cs-sum { display: inline-flex; align-items: center; gap: 10px; text-transform: none; letter-spacing: 0; font-weight: 600; color: var(--vm-ink-soft); }
.cs-verify { display: inline-flex; align-items: center; gap: 5px; font: 700 11px var(--vm-font-sans); padding: 3px 9px; border-radius: 999px; }
.cs-verify :deep(svg) { width: 13px; height: 13px; }
.cs-verify.ok { color: #059669; background: rgba(16,185,129,.12); }
.cs-verify.bad { color: var(--vm-danger); background: rgba(239,68,68,.1); }
.cs-plan { margin: 0; padding-left: 20px; }
.cs-plan li { font-size: 13.5px; color: var(--vm-ink-soft); margin: 4px 0; }
.cs-steps { display: flex; flex-direction: column; gap: 6px; }
.cs-step { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--vm-ink-soft); }
.cs-file { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; }
.cs-file:hover { background: var(--vm-bg); }
.cs-file .fi { width: 15px; height: 15px; color: var(--vm-ink-faint); }
.cs-file .fp, .cs-filerow .fp { flex: 1; min-width: 0; font: 600 13px var(--vm-font-sans); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.add { color: #059669; font: 700 12px var(--vm-font-sans); } .del { color: var(--vm-danger); font: 700 12px var(--vm-font-sans); }
/* per-file diff blocks */
.cs-fileblock { border: 1px solid var(--vm-line); border-radius: 12px; overflow: hidden; margin-bottom: 8px; }
.cs-filerow { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px 11px; background: var(--vm-bg); border: 0; cursor: pointer; }
.cs-filerow:hover { background: var(--vm-violet-soft); }
.cs-filerow .chev { width: 15px; height: 15px; color: var(--vm-ink-faint); }
.cs-filerow .fi { width: 15px; height: 15px; color: var(--vm-ink-faint); }
.cs-diffbody { max-height: 360px; overflow: auto; background: #0f172a; padding: 8px 0; }
.dl { display: block; padding: 0 12px; font: 12px/1.55 ui-monospace, "SF Mono", monospace; white-space: pre; }
.dl code { font: inherit; }
.dl.ctx { color: #cbd5e1; }
.dl.add { color: #86efac; background: rgba(34,197,94,.12); }
.dl.del { color: #fca5a5; background: rgba(239,68,68,.12); }
.dl.hunk { color: #67e8f9; background: rgba(8,145,178,.16); }
/* actions */
.cs-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--vm-line); }
.act { display: inline-flex; align-items: center; gap: 7px; font: 700 13px var(--vm-font-sans); padding: 9px 15px; border-radius: 11px; cursor: pointer; border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink-soft); }
.act :deep(svg) { width: 15px; height: 15px; }
.act.ghost:hover { border-color: var(--vm-violet); color: var(--vm-violet-d); background: var(--vm-violet-soft); }
.act.danger { color: var(--vm-danger); border-color: rgba(239,68,68,.3); }
.act.danger:hover { background: rgba(239,68,68,.08); }
.act.primary { color: #fff; background: var(--vm-ink); border-color: var(--vm-ink); }
.act.primary:hover { background: #000; }
.act:disabled { opacity: .55; cursor: not-allowed; }
.spin { animation: cs-spin 1s linear infinite; }
@keyframes cs-spin { to { transform: rotate(360deg); } }
.cs-note { margin-top: 10px; font-size: 11.5px; color: var(--vm-ink-faint); }
.cs-note.inline { margin-top: 0; display: inline-flex; align-items: center; gap: 5px; }
.cs-note code { font: 600 11px ui-monospace, monospace; background: var(--vm-bg); padding: 1px 5px; border-radius: 5px; }
.cs-running { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--vm-ink-soft); padding: 6px 2px; }
</style>
