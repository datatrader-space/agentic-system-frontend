<template>
  <div class="pcc">
    <div class="pcc-head">
      <Icon icon="lucide:git-pull-request-arrow" />
      <span>Proposed Changes</span>
      <span class="pcc-sum" v-if="summary.files_changed">
        {{ summary.files_changed }} files · <b class="add">+{{ summary.additions }}</b> / <b class="del">-{{ summary.deletions }}</b>
      </span>
    </div>

    <!-- per-file collapsible diff -->
    <div v-for="(f, fi) in files" :key="f.path" class="pcc-file">
      <div class="pcc-filerow">
        <button class="pcc-fileexp" @click="open[fi] = !open[fi]">
          <Icon :icon="open[fi] ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="chev" />
          <span class="fp">{{ f.path }}</span>
          <span class="add">+{{ f.additions }}</span><span class="del">-{{ f.deletions }}</span>
        </button>
        <button class="pcc-reject" title="Reject this file" :disabled="busy" @click.stop="$emit('revertFile', f.path)">
          <Icon icon="lucide:x" />
        </button>
      </div>
      <div v-show="open[fi]" class="pcc-body vm-scroll">
        <div v-for="h in f.hunks" :key="h.index" class="pcc-hunk">
          <div class="pcc-hunkhdr">
            <code class="hh">{{ h.header }}</code>
            <button class="pcc-hunkreject" title="Reject just this change" :disabled="busy"
                    @click="$emit('revertHunk', { path: f.path, hunk: h.index })">
              <Icon icon="lucide:undo-2" /> Reject
            </button>
          </div>
          <div v-for="(ln, li) in h.lines" :key="li" class="dl" :class="ln.cls"><code>{{ ln.text || ' ' }}</code></div>
        </div>
      </div>
    </div>
    <p v-if="!files.length && !workspaceItems.length" class="pcc-empty">No file changes were produced.</p>

    <!-- Workspace truth (Coding Agent Runtime): files the Git diff can't show — gitignored/local-only,
         protected (secret values hidden), or binary — surfaced from the WorkspaceChangeProposal. -->
    <div v-if="warnings.length" class="pcc-warn">
      <div v-for="(w, wi) in warnings" :key="wi"><Icon icon="lucide:alert-triangle" /> {{ w }}</div>
    </div>
    <div v-if="workspaceItems.length" class="pcc-ws">
      <div class="pcc-ws-h"><Icon icon="lucide:folder-git-2" /> Local-only / workspace changes (not committable)</div>
      <div v-for="(it, ii) in workspaceItems" :key="ii" class="pcc-ws-row">
        <span class="fp">{{ it.path }}</span>
        <span class="ws-badges">
          <span v-if="it.ignored" class="badge gi">local-only</span>
          <span v-if="it.protected" class="badge prot">protected</span>
          <span v-if="it.binary" class="badge bin">binary</span>
          <span v-if="it.content_display === 'redacted'" class="badge red">values hidden</span>
          <span v-if="it.verified" class="badge ok">✓ verified</span>
        </span>
      </div>
    </div>

    <!-- exported PR -->
    <a v-if="task.pr_url" :href="task.pr_url" target="_blank" rel="noopener" class="pcc-pr">
      <Icon icon="logos:github-icon" /> Pull request opened <Icon icon="lucide:external-link" class="ext" />
    </a>

    <div class="pcc-actions" v-if="files.length">
      <button class="act ghost" @click="$emit('copy')"><Icon icon="lucide:copy" /> Copy patch</button>
      <button class="act danger" @click="$emit('discard')" :disabled="busy"><Icon icon="lucide:x" /> Discard</button>
      <button v-if="task.export_enabled" class="act primary" @click="$emit('accept')" :disabled="busy || exporting">
        <Icon :icon="exporting ? 'lucide:loader-2' : 'lucide:check'" :class="{ spin: exporting }" />
        {{ task.pr_url ? 'Re-export' : 'Accept & open PR' }}
      </button>
      <button v-else class="act primary" @click="$emit('keep')" :disabled="busy"><Icon icon="lucide:check" /> Accept</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  task: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  exporting: { type: Boolean, default: false },
})
defineEmits(['accept', 'keep', 'discard', 'copy', 'export', 'revertFile', 'revertHunk'])

const open = reactive({})
const summary = computed(() => props.task?.diff_summary || { files_changed: 0, additions: 0, deletions: 0 })

// WorkspaceChangeProposal (Coding Agent Runtime): surface what the Git diff can't show.
const proposal = computed(() => props.task?.diff_summary?.proposal || null)
const warnings = computed(() => (proposal.value && Array.isArray(proposal.value.warnings)) ? proposal.value.warnings : [])
const workspaceItems = computed(() => {
  const p = proposal.value
  if (!p || !Array.isArray(p.items)) return []
  return p.items.filter((i) => i && i.content_display !== 'diff')   // anything not shown as a unified diff
})

// Parse the unified diff into files → hunks (hunk index matches the backend's per-file order).
const files = computed(() => {
  const text = props.task?.diff_text || ''
  if (!text) return []
  const out = []
  let cur = null, hunk = null
  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git')) {
      const m = raw.match(/ b\/(.+)$/)
      cur = { path: m ? m[1] : raw.replace('diff --git ', ''), additions: 0, deletions: 0, hunks: [] }
      out.push(cur); hunk = null; continue
    }
    if (!cur) continue
    if (raw.startsWith('@@')) { hunk = { header: raw, lines: [], index: cur.hunks.length }; cur.hunks.push(hunk); continue }
    if (raw.startsWith('index ') || raw.startsWith('--- ') || raw.startsWith('+++ ') ||
        raw.startsWith('new file') || raw.startsWith('deleted file') ||
        raw.startsWith('similarity ') || raw.startsWith('rename ') || raw.startsWith('\\ No newline')) continue
    if (!hunk) continue
    let cls = 'ctx'
    if (raw.startsWith('+')) { cls = 'add'; cur.additions++ }
    else if (raw.startsWith('-')) { cls = 'del'; cur.deletions++ }
    hunk.lines.push({ cls, text: raw })
  }
  if (out.length) open[0] = open[0] ?? true
  return out
})
</script>

<style scoped>
.pcc { border: 1px solid var(--vm-line-2); border-radius: 12px; overflow: hidden; background: var(--vm-surface); margin-top: 8px; }
.pcc-head { display: flex; align-items: center; gap: 7px; padding: 9px 11px; font: 700 12px var(--vm-font-sans); color: var(--vm-ink); border-bottom: 1px solid var(--vm-line); background: var(--vm-surface-soft); }
.pcc-head :deep(svg) { width: 15px; height: 15px; color: var(--vm-violet-d); }
.pcc-sum { margin-left: auto; font-weight: 600; color: var(--vm-ink-soft); }
.pcc-file { border-bottom: 1px solid var(--vm-line); }
.pcc-filerow { display: flex; align-items: center; gap: 4px; width: 100%; padding: 0 6px 0 0; }
.pcc-filerow:hover { background: var(--vm-surface-soft); }
.pcc-fileexp { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 8px 11px; background: transparent; border: 0; cursor: pointer; }
.pcc-fileexp .chev { width: 14px; height: 14px; color: var(--vm-ink-faint); }
.pcc-reject { flex: 0 0 auto; border: none; background: transparent; color: var(--vm-ink-faint); cursor: pointer; width: 24px; height: 24px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; }
.pcc-reject:hover:not(:disabled) { color: var(--vm-danger); background: rgba(239,68,68,.08); }
.pcc-reject:disabled { opacity: .4; cursor: not-allowed; }
.pcc-reject :deep(svg) { width: 14px; height: 14px; }
.fp { flex: 1; min-width: 0; text-align: left; font: 600 12px var(--vm-font-sans); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.add { color: #059669; font: 700 11px var(--vm-font-sans); } .del { color: var(--vm-danger); font: 700 11px var(--vm-font-sans); margin-left: 6px; }
.pcc-body { max-height: 320px; overflow: auto; background: #0f172a; padding: 0; }
.pcc-hunk { border-top: 1px solid #1e293b; }
.pcc-hunkhdr { display: flex; align-items: center; gap: 8px; padding: 4px 10px; background: #111827; }
.pcc-hunkhdr .hh { flex: 1; min-width: 0; font: 11px ui-monospace, monospace; color: #67e8f9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pcc-hunkreject { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; border: 1px solid #334155; background: transparent; color: #cbd5e1; font: 700 10px var(--vm-font-sans); padding: 3px 8px; border-radius: 6px; cursor: pointer; }
.pcc-hunkreject:hover:not(:disabled) { color: #fca5a5; border-color: #7f1d1d; background: rgba(239,68,68,.12); }
.pcc-hunkreject:disabled { opacity: .5; cursor: not-allowed; }
.pcc-hunkreject :deep(svg) { width: 11px; height: 11px; }
.pcc-body .dl { padding: 0 10px; }
.dl { display: block; padding: 0 11px; font: 11.5px/1.5 ui-monospace, monospace; white-space: pre; }
.dl.ctx { color: #cbd5e1; } .dl.add { color: #86efac; background: rgba(34,197,94,.12); }
.dl.del { color: #fca5a5; background: rgba(239,68,68,.12); } .dl.hunk { color: #67e8f9; background: rgba(8,145,178,.16); }
.pcc-empty { padding: 12px; font-size: 12.5px; color: var(--vm-ink-faint); }
.pcc-warn { padding: 8px 11px; border-top: 1px solid var(--vm-line); background: rgba(245,158,11,.08); }
.pcc-warn > div { display: flex; align-items: center; gap: 6px; font: 600 11.5px var(--vm-font-sans); color: #92400e; }
.pcc-warn :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; }
.pcc-ws { border-top: 1px solid var(--vm-line); }
.pcc-ws-h { display: flex; align-items: center; gap: 6px; padding: 7px 11px; font: 700 11px var(--vm-font-sans); color: var(--vm-ink-soft); background: var(--vm-surface-soft); }
.pcc-ws-h :deep(svg) { width: 13px; height: 13px; }
.pcc-ws-row { display: flex; align-items: center; gap: 8px; padding: 6px 11px; border-top: 1px solid var(--vm-line); }
.ws-badges { margin-left: auto; display: flex; flex-wrap: wrap; gap: 4px; }
.badge { font: 700 9.5px var(--vm-font-sans); padding: 2px 6px; border-radius: 5px; white-space: nowrap; }
.badge.gi { background: rgba(100,116,139,.15); color: #475569; }
.badge.prot { background: rgba(245,158,11,.15); color: #92400e; }
.badge.bin { background: rgba(139,92,246,.13); color: var(--vm-violet-d); }
.badge.red { background: rgba(239,68,68,.12); color: var(--vm-danger); }
.badge.ok { background: rgba(16,185,129,.13); color: #047857; }
.pcc-pr { display: flex; align-items: center; gap: 7px; padding: 9px 11px; font: 700 12px var(--vm-font-sans); color: var(--vm-ink); text-decoration: none; border-top: 1px solid var(--vm-line); }
.pcc-pr :deep(svg) { width: 15px; height: 15px; } .pcc-pr .ext { color: var(--vm-ink-faint); }
.pcc-actions { display: flex; flex-wrap: wrap; gap: 7px; padding: 10px 11px; border-top: 1px solid var(--vm-line); }
.act { display: inline-flex; align-items: center; gap: 6px; font: 700 12px var(--vm-font-sans); padding: 7px 12px; border-radius: 9px; cursor: pointer; border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink-soft); }
.act :deep(svg) { width: 14px; height: 14px; }
.act.ghost:hover { border-color: var(--vm-violet); color: var(--vm-violet-d); }
.act.danger { color: var(--vm-danger); border-color: rgba(239,68,68,.3); }
.act.danger:hover { background: rgba(239,68,68,.07); }
.act.primary { background: var(--vm-g-brand); color: #fff; border: none; }
.act:disabled { opacity: .55; cursor: not-allowed; }
.spin { animation: pcc-spin 1s linear infinite; } @keyframes pcc-spin { to { transform: rotate(360deg); } }
</style>
