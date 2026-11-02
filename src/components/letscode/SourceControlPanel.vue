<template>
  <!-- VS Code–style Source Control over the repo clone. Shows working-tree changes vs HEAD, with
       gitignored files in a separate "local-only" group; click a file to see its diff. -->
  <div class="scm">
    <div class="scm-head">
      <span class="scm-branch" :title="status.branch"><Icon icon="lucide:git-branch" /> {{ status.branch || 'No branch' }}</span>
      <button type="button" class="scm-refresh" :disabled="loading" title="Refresh" aria-label="Refresh source control" @click="load">
        <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" />
      </button>
    </div>

    <div v-if="loading && !loaded" class="scm-empty">Loading changes…</div>
    <div v-else-if="error" class="scm-empty err">{{ error }}</div>
    <div v-else-if="status.clean" class="scm-empty">
      <Icon icon="lucide:check-circle-2" /> No changes. The working tree is clean.
    </div>
    <div v-else class="scm-list">
      <template v-for="g in groups" :key="g.key">
        <div v-if="g.items.length" class="scm-group">
          <div class="scm-group-h">{{ g.label }} <span class="scm-count">{{ g.items.length }}</span></div>
          <button
            v-for="(it, i) in g.items" :key="g.key + i"
            type="button" class="scm-row" :class="{ active: diff.path === it.path }" @click="openDiff(it)"
          >
            <span class="scm-badge" :class="it.status" :title="it.status">{{ letter(it) }}</span>
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
        <button type="button" class="scm-diff-x" title="Close the diff" aria-label="Close the diff" @click="closeDiff"><Icon icon="lucide:x" /></button>
      </div>
      <div v-if="diffLoading" class="scm-note">Loading diff…</div>
      <div v-else-if="diff.redacted" class="scm-note"><Icon icon="lucide:lock" aria-hidden="true" /> Protected file. Its values are hidden for safety.</div>
      <div v-else-if="diff.binary" class="scm-note">Binary file. There is no preview.</div>
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

function closeDiff() { Object.keys(diff).forEach((k) => delete diff[k]) }

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
.scm { display: flex; flex-direction: column; height: 100%; min-height: 0; font: 12.5px var(--vm-font-sans); color: var(--vm-ink); }
.scm-head { display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-bottom: 1px solid var(--vm-line); }
.scm-branch { display: inline-flex; align-items: center; gap: 5px; font: 600 12.5px var(--vm-font-mono); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scm-branch :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; }
.scm-refresh { margin-left: auto; border: none; background: transparent; color: var(--vm-ink-soft); cursor: pointer; border-radius: 6px; width: 28px; height: 28px; display: grid; place-items: center; }
.scm-refresh:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.scm-refresh:disabled { cursor: progress; }
.scm-refresh :deep(svg) { width: 14px; height: 14px; }
.scm-empty { padding: 16px 12px; color: var(--vm-ink-soft); display: flex; align-items: center; gap: 6px; line-height: 1.45; }
.scm-empty.err { color: var(--vm-danger); }
.scm-empty :deep(svg) { width: 14px; height: 14px; flex: 0 0 auto; color: var(--vm-green); }
.scm-list { overflow: auto; flex: 0 1 auto; }
.scm-group-h { display: flex; align-items: center; gap: 6px; padding: 8px 10px 4px; font: 600 12px var(--vm-font-sans); color: var(--vm-ink-soft); }
.scm-count { background: var(--vm-surface-soft); color: var(--vm-ink-soft); border-radius: 8px; padding: 0 6px; font-size: 11px; }
.scm-row { display: flex; align-items: center; gap: 7px; width: 100%; padding: 5px 10px; background: transparent; border: none; cursor: pointer; text-align: left; }
.scm-row:hover { background: var(--vm-surface-soft); }
.scm-row.active { background: var(--vm-violet-soft); }
.scm-badge { flex: 0 0 auto; width: 16px; text-align: center; font: 700 11px var(--vm-font-mono); border-radius: 4px; color: var(--vm-ink-soft); }
.scm-badge.modified { color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
.scm-badge.added, .scm-badge.untracked { color: color-mix(in srgb, var(--vm-green) 65%, var(--vm-ink)); }
.scm-badge.deleted { color: var(--vm-danger); }
.scm-badge.renamed { color: var(--vm-violet); }
.scm-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink); font-family: var(--vm-font-mono); font-size: 12px; }
.scm-tag { --tone: var(--vm-ink-faint); flex: 0 0 auto; font: 600 10.5px var(--vm-font-sans); padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--tone) 16%, transparent); color: color-mix(in srgb, var(--tone) 60%, var(--vm-ink)); }
.scm-tag.gi { color: var(--vm-ink-soft); }
.scm-tag.prot { --tone: var(--vm-amber); }
.scm-diff { border-top: 1px solid var(--vm-line); display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
.scm-diff-head { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: var(--vm-surface-soft); font-weight: 600; color: var(--vm-ink); }
.scm-diff-head :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; }
.scm-diff-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--vm-font-mono); font-size: 12px; }
.scm-diff-x { display: grid; place-items: center; width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; }
.scm-diff-x:hover { background: var(--vm-surface); color: var(--vm-ink); }
.scm-note { display: flex; align-items: center; gap: 6px; padding: 12px; color: var(--vm-ink-soft); }
.scm-note :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; }
.scm-diff-body { overflow: auto; background: var(--vm-surface-soft); flex: 1 1 auto; min-height: 0; padding: 4px 0; }
.dl { padding: 0 10px; font: 11.5px/1.5 var(--vm-font-mono); white-space: pre; }
.dl.ctx { color: var(--vm-ink-soft); }
.dl.add { color: color-mix(in srgb, var(--vm-green) 60%, var(--vm-ink)); background: color-mix(in srgb, var(--vm-green) 14%, transparent); }
.dl.del { color: color-mix(in srgb, var(--vm-danger) 70%, var(--vm-ink)); background: color-mix(in srgb, var(--vm-danger) 12%, transparent); }
.dl.hunk { color: color-mix(in srgb, var(--vm-teal) 55%, var(--vm-ink)); background: color-mix(in srgb, var(--vm-teal) 12%, transparent); }
.dl.meta { color: var(--vm-ink-faint); }
.spin { animation: scm-spin 1s linear infinite; } @keyframes scm-spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .scm-row { min-height: 44px; } .scm-refresh, .scm-diff-x { width: 44px; height: 44px; } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
