<template>
  <!-- VS Code–style Source Control over the repo clone. Shows working-tree changes vs HEAD, with
       gitignored files in a separate "local-only" group; click a file to see its diff. -->
  <div class="scm">
    <div class="scm-head">
      <span class="scm-branch" :title="status.branch"><Icon icon="lucide:git-branch" /> {{ status.branch || '—' }}</span>
      <button class="scm-refresh" :disabled="loading" title="Refresh" @click="load">
        <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" />
      </button>
    </div>

    <div v-if="loading && !loaded" class="scm-empty">Loading changes…</div>
    <div v-else-if="error" class="scm-empty err">{{ error }}</div>
    <div v-else-if="status.clean" class="scm-empty">
      <Icon icon="lucide:check-circle-2" /> No changes — working tree is clean.
    </div>
    <div v-else class="scm-list">
      <template v-for="g in groups" :key="g.key">
        <div v-if="g.items.length" class="scm-group">
          <div class="scm-group-h">{{ g.label }} <span class="scm-count">{{ g.items.length }}</span></div>
          <button
            v-for="(it, i) in g.items" :key="g.key + i"
            class="scm-row" :class="{ active: diff.path === it.path }" @click="openDiff(it)"
          >
            <span class="scm-badge" :class="it.status">{{ letter(it) }}</span>
            <span class="scm-path" :title="it.path">{{ it.path }}</span>
            <span v-if="it.protected" class="scm-tag prot">secret</span>
            <span v-else-if="g.local" class="scm-tag gi">local-only</span>
          </button>
        </div>
      </template>
    </div>

    <!-- inline diff for the clicked file -->
    <div v-if="diff.path" class="scm-diff">
      <div class="scm-diff-head">
        <Icon icon="lucide:file-diff" /><span class="scm-diff-path">{{ diff.path }}</span>
        <button class="scm-diff-x" title="Close" @click="diff = {}"><Icon icon="lucide:x" /></button>
      </div>
      <div v-if="diffLoading" class="scm-note">Loading diff…</div>
      <div v-else-if="diff.redacted" class="scm-note">🔒 Protected file — values hidden for safety.</div>
      <div v-else-if="diff.binary" class="scm-note">Binary file — no preview.</div>
      <div v-else-if="!diff.diff_text" class="scm-note">No textual changes.</div>
      <div v-else class="scm-diff-body">
        <div v-for="(ln, i) in diffLines" :key="i" class="dl" :class="ln.cls"><code>{{ ln.text || ' ' }}</code></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
})
const emit = defineEmits(['count'])

const status = reactive({ branch: '', clean: true, changes: [], untracked: [], local_only: [] })
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const diff = reactive({})
const diffLoading = ref(false)

const groups = computed(() => [
  { key: 'changes', label: 'Changes', items: status.changes || [] },
  { key: 'untracked', label: 'Untracked', items: status.untracked || [] },
  { key: 'local', label: 'Local-only (gitignored)', items: status.local_only || [], local: true },
])

const _LETTER = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: 'U' }
function letter(it) { return _LETTER[it.status] || '?' }

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.getSourceControlStatus(props.systemId, props.repoId)
    Object.assign(status, {
      branch: data.branch || '', clean: !!data.clean,
      changes: data.changes || [], untracked: data.untracked || [], local_only: data.local_only || [],
    })
    emit('count', (status.changes.length + status.untracked.length))
  } catch (e) {
    error.value = 'Could not load source control status.'
  } finally {
    loaded.value = true
    loading.value = false
  }
}

async function openDiff(it) {
  Object.keys(diff).forEach((k) => delete diff[k])
  diff.path = it.path
  diffLoading.value = true
  try {
    const { data } = await api.getSourceControlDiff(props.systemId, props.repoId, it.path)
    Object.assign(diff, data)
  } catch (e) {
    diff.diff_text = ''
    diff.error = true
  } finally {
    diffLoading.value = false
  }
}

const diffLines = computed(() => {
  const text = diff.diff_text || ''
  if (!text) return []
  return text.split('\n').map((raw) => {
    let cls = 'ctx'
    if (raw.startsWith('@@')) cls = 'hunk'
    else if (raw.startsWith('diff --git') || raw.startsWith('index ') || raw.startsWith('--- ') ||
             raw.startsWith('+++ ') || raw.startsWith('new file') || raw.startsWith('deleted file')) cls = 'meta'
    else if (raw.startsWith('+')) cls = 'add'
    else if (raw.startsWith('-')) cls = 'del'
    return { cls, text: raw }
  })
})

onMounted(load)
watch(() => [props.systemId, props.repoId], load)
defineExpose({ refresh: load })
</script>

<style scoped>
.scm { display: flex; flex-direction: column; height: 100%; min-height: 0; font: 12px var(--vm-font-sans, sans-serif); }
.scm-head { display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-bottom: 1px solid var(--vm-line, #1f2937); }
.scm-branch { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; color: var(--vm-ink, #e5e7eb); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scm-branch :deep(svg) { width: 13px; height: 13px; }
.scm-refresh { margin-left: auto; border: none; background: transparent; color: var(--vm-ink-faint, #94a3b8); cursor: pointer; border-radius: 6px; width: 26px; height: 26px; display: grid; place-items: center; }
.scm-refresh:hover { background: var(--vm-surface-soft, #1f2937); }
.scm-refresh :deep(svg) { width: 14px; height: 14px; }
.scm-empty { padding: 16px 12px; color: var(--vm-ink-faint, #94a3b8); display: flex; align-items: center; gap: 6px; }
.scm-empty.err { color: #f87171; }
.scm-empty :deep(svg) { width: 14px; height: 14px; }
.scm-list { overflow: auto; flex: 0 1 auto; }
.scm-group-h { display: flex; align-items: center; gap: 6px; padding: 6px 10px 3px; font: 700 10px var(--vm-font-sans); text-transform: uppercase; letter-spacing: .03em; color: var(--vm-ink-faint, #94a3b8); }
.scm-count { background: var(--vm-surface-soft, #1f2937); border-radius: 8px; padding: 0 6px; }
.scm-row { display: flex; align-items: center; gap: 7px; width: 100%; padding: 4px 10px; background: transparent; border: none; cursor: pointer; text-align: left; }
.scm-row:hover { background: var(--vm-surface-soft, #1f2937); }
.scm-row.active { background: var(--vm-violet-soft, #1e293b); }
.scm-badge { flex: 0 0 auto; width: 16px; text-align: center; font: 800 11px ui-monospace, monospace; border-radius: 4px; }
.scm-badge.modified { color: #d97706; } .scm-badge.added { color: #16a34a; } .scm-badge.untracked { color: #16a34a; }
.scm-badge.deleted { color: #dc2626; } .scm-badge.renamed { color: #2563eb; }
.scm-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink, #e5e7eb); }
.scm-tag { flex: 0 0 auto; font: 700 9px var(--vm-font-sans); text-transform: uppercase; padding: 1px 5px; border-radius: 4px; }
.scm-tag.gi { background: rgba(148,163,184,.18); color: #94a3b8; }
.scm-tag.prot { background: rgba(245,158,11,.18); color: #d97706; }
.scm-diff { border-top: 1px solid var(--vm-line, #1f2937); display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
.scm-diff-head { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: var(--vm-surface-soft, #111827); font-weight: 700; color: var(--vm-ink, #e5e7eb); }
.scm-diff-head :deep(svg) { width: 13px; height: 13px; }
.scm-diff-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scm-diff-x { border: none; background: transparent; color: var(--vm-ink-faint, #94a3b8); cursor: pointer; }
.scm-note { padding: 12px; color: var(--vm-ink-faint, #94a3b8); }
.scm-diff-body { overflow: auto; background: #0f172a; flex: 1 1 auto; min-height: 0; padding: 4px 0; }
.dl { padding: 0 10px; font: 11.5px/1.5 ui-monospace, monospace; white-space: pre; }
.dl.ctx { color: #cbd5e1; } .dl.add { color: #86efac; background: rgba(34,197,94,.12); }
.dl.del { color: #fca5a5; background: rgba(239,68,68,.12); } .dl.hunk { color: #67e8f9; background: rgba(8,145,178,.16); }
.dl.meta { color: #64748b; }
.spin { animation: scm-spin 1s linear infinite; } @keyframes scm-spin { to { transform: rotate(360deg); } }
</style>
