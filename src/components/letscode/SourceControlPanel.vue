<template>
  <!-- VS Code–style Source Control over the project's repository: the working tree's changes vs HEAD (gitignored
       files are not listed). Clicking a file opens its side-by-side diff in the editor (`open-diff`). -->
  <div class="scm">
    <div class="scm-head">
      <span class="scm-branch" :title="status.branch"><Icon icon="lucide:git-branch" /> {{ status.branch || 'No branch' }}</span>
      <button type="button" class="scm-refresh" :disabled="loading" title="Refresh" aria-label="Refresh source control" @click="load">
        <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" />
      </button>
    </div>

    <div v-if="loading && !loaded" class="scm-empty">Loading changes…</div>
    <div v-else-if="error" class="scm-empty err" role="alert">{{ error }}</div>
    <div v-else-if="status.clean" class="scm-empty">
      <Icon icon="lucide:check-circle-2" /> No changes. The working tree is clean.
    </div>
    <div v-else class="scm-list">
      <template v-for="g in groups" :key="g.key">
        <div v-if="g.items.length" class="scm-group">
          <div class="scm-group-h">{{ g.label }} <span class="scm-count">{{ g.items.length }}</span></div>
          <button
            v-for="(it, i) in g.items" :key="g.key + i"
            type="button" class="scm-row" :class="{ active: selected === it.path }" @click="openDiff(it)"
          >
            <span class="scm-badge" :class="it.status" :title="it.status">{{ letter(it) }}</span>
            <span class="scm-path" :title="it.path">{{ it.path }}</span>
          </button>
        </div>
      </template>
      <p class="scm-foot">
        <Icon icon="lucide:clock" aria-hidden="true" />
        These changes are in this project's sandbox. Changes you have not exported are kept for 3 days after
        you last use the project.
      </p>
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
const emit = defineEmits(['count', 'open-diff'])

const status = reactive({ branch: '', clean: true, changes: [], untracked: [] })
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const selected = ref('')

const groups = computed(() => [
  { key: 'changes', label: 'Changes', items: status.changes || [] },
  { key: 'untracked', label: 'Untracked', items: status.untracked || [] },
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
      changes: data.changes || [], untracked: data.untracked || [],
    })
    emit('count', (status.changes.length + status.untracked.length))
  } catch (e) {
    error.value = e?.response?.data?.error || 'Could not load source control status.'
  } finally {
    loaded.value = true
    loading.value = false
  }
}

// The diff opens in the editor, side by side, as VS Code shows a change.
function openDiff(it) {
  selected.value = it.path
  emit('open-diff', { path: it.path, status: it.status })
}

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
.scm-foot { display: flex; align-items: flex-start; gap: 6px; margin: 8px 12px 12px; font-size: 12px; line-height: 1.5; color: var(--vm-ink-soft); }
.scm-foot :deep(svg) { width: 12px; height: 12px; flex: 0 0 auto; margin-top: 3px; }
.spin { animation: scm-spin 1s linear infinite; } @keyframes scm-spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .scm-row { min-height: 44px; } .scm-refresh { width: 44px; height: 44px; } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
