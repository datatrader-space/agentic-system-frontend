<template>
  <div class="bp">
    <div class="bp-tabs">
      <button v-for="t in tabs" :key="t" class="bp-tab" :class="{ on: tab === t }" @click="tab = t">{{ t }}</button>
      <button class="bp-collapse" @click="$emit('toggle')" :title="collapsed ? 'Expand' : 'Collapse'">
        <Icon :icon="collapsed ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
      </button>
    </div>
    <div v-show="!collapsed" ref="body" class="bp-body vm-scroll">
      <pre v-if="lines.length"><span v-for="(l, i) in lines" :key="i" class="ln" :class="lineClass(l)">{{ l }}</span></pre>
      <div v-else class="bp-empty">No output yet.</div>
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
defineEmits(['toggle'])

const tabs = ['Terminal', 'Output', 'Debug Console']
const tab = ref('Terminal')
const body = ref(null)

const lines = computed(() => (tab.value === 'Output' ? props.activity : props.pipelineLog))
function lineClass(l) {
  if (/\[error\]|error|failed/i.test(l)) return 'err'
  if (/\[crs\]|\[clone\]|ready|done/i.test(l)) return 'ok'
  return ''
}
watch(lines, () => nextTick(() => { const e = body.value; if (e) e.scrollTop = e.scrollHeight }), { deep: true })
</script>

<style scoped>
.bp { display: flex; flex-direction: column; height: 100%; background: #0f172a; color: #cbd5e1; border-top: 1px solid #1e293b; }
.bp-tabs { display: flex; align-items: center; gap: 2px; padding: 0 8px; border-bottom: 1px solid #1e293b; flex: 0 0 auto; }
.bp-tab { background: transparent; border: none; color: #94a3b8; font: 700 11px var(--vm-font-sans); text-transform: uppercase; letter-spacing: .04em; padding: 9px 12px; cursor: pointer; border-bottom: 2px solid transparent; }
.bp-tab:hover { color: #e2e8f0; }
.bp-tab.on { color: #fff; border-bottom-color: var(--vm-violet); }
.bp-collapse { margin-left: auto; background: transparent; border: none; color: #94a3b8; cursor: pointer; display: inline-flex; }
.bp-collapse :deep(svg) { width: 16px; height: 16px; }
.bp-body { flex: 1; min-height: 0; overflow: auto; padding: 10px 14px; }
.bp-body pre { margin: 0; font: 12px/1.6 ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; }
.ln { display: block; } .ln.ok { color: #86efac; } .ln.err { color: #fca5a5; }
.bp-empty { color: #64748b; font-size: 12.5px; }
</style>
