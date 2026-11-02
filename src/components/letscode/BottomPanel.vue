<template>
  <div class="bp">
    <div class="bp-tabs" role="tablist" aria-label="Workspace output">
      <button
        v-for="t in tabs" :key="t.id" type="button" role="tab" class="bp-tab" :class="{ on: tab === t.id }"
        :aria-selected="tab === t.id ? 'true' : 'false'" @click="selectTab(t.id)"
      >{{ t.label }}</button>
      <button type="button" class="bp-collapse" :title="collapsed ? 'Expand' : 'Collapse'" :aria-label="collapsed ? 'Expand the output panel' : 'Collapse the output panel'" :aria-expanded="collapsed ? 'false' : 'true'" @click="$emit('toggle')">
        <Icon :icon="collapsed ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
      </button>
    </div>
    <div v-show="!collapsed" ref="body" class="bp-body vm-scroll" role="tabpanel" tabindex="0">
      <pre v-if="lines.length"><span v-for="(l, i) in lines" :key="i" class="ln" :class="lineClass(l)">{{ l }}</span></pre>
      <div v-else class="bp-empty">{{ tab === 'activity' ? 'The coding agent has not run a tool yet.' : 'No log lines yet.' }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  pipelineLog: { type: Array, default: () => [] },
  activity: { type: Array, default: () => [] },
  collapsed: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle'])

// Log = the project's clone/index pipeline log; Activity = the coding agent's tool calls.
const tabs = [
  { id: 'log', label: 'Log' },
  { id: 'activity', label: 'Activity' },
]
const tab = ref('log')
const body = ref(null)

function selectTab(id) {
  tab.value = id
  if (props.collapsed) emit('toggle')
}

const lines = computed(() => (tab.value === 'activity' ? props.activity : props.pipelineLog))
function lineClass(l) {
  if (/\[error\]|error|failed/i.test(l)) return 'err'
  if (/\[crs\]|\[clone\]|ready|done/i.test(l)) return 'ok'
  return ''
}
watch(lines, () => nextTick(() => { const e = body.value; if (e) e.scrollTop = e.scrollHeight }), { deep: true })
</script>

<style scoped>
.bp { display: flex; flex-direction: column; height: 100%; background: var(--vm-surface); color: var(--vm-ink-soft); border-top: 1px solid var(--vm-line); }
.bp-tabs { display: flex; align-items: center; gap: 2px; padding: 0 8px; border-bottom: 1px solid var(--vm-line); flex: 0 0 auto; }
.bp-tab { background: transparent; border: none; color: var(--vm-ink-soft); font: 600 12.5px var(--vm-font-sans); padding: 10px 12px 8px; cursor: pointer; border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; }
.bp-tab:hover { color: var(--vm-ink); }
.bp-tab.on { color: var(--vm-ink); border-bottom-color: var(--vm-violet); }
.bp-collapse { margin-left: auto; display: grid; place-items: center; width: 30px; height: 30px; background: transparent; border: none; border-radius: 6px; color: var(--vm-ink-soft); cursor: pointer; }
.bp-collapse:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.bp-collapse :deep(svg) { width: 16px; height: 16px; }
.bp-body { flex: 1; min-height: 0; overflow: auto; padding: 10px 14px; }
.bp-body pre { margin: 0; font: 12px/1.6 var(--vm-font-mono); white-space: pre-wrap; word-break: break-word; }
.ln { display: block; }
.ln.ok { color: color-mix(in srgb, var(--vm-green) 62%, var(--vm-ink)); }
.ln.err { color: var(--vm-danger); }
.bp-empty { color: var(--vm-ink-faint); font-size: 13px; }
@media (max-width: 640px) { .bp-tab { min-height: 44px; } .bp-collapse { width: 44px; height: 44px; } }
</style>
