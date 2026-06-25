<template>
  <div class="wf-node" :class="[familyClass, 'state-' + statusState, { selected }]" :style="{ '--accent': accent }">
    <span class="wf-stripe"></span>

    <!-- inbound handle (all except triggers) -->
    <Handle v-if="!isTrigger" type="target" :position="Position.Left" class="wf-h wf-h-in" />

    <div class="wf-node-head">
      <span class="wf-ic" :class="familyClass">{{ icon }}</span>
      <div class="wf-node-text">
        <div class="wf-node-title">{{ title }}</div>
        <div class="wf-node-sub">{{ subtitle }}</div>
      </div>
      <span class="wf-status" :class="'st-' + statusState" :title="statusLabel">
        <span class="wf-dot"></span>
      </span>
    </div>

    <!-- compact config preview (helps scanning the canvas) -->
    <div v-if="configPreview" class="wf-preview" :title="configPreview">{{ configPreview }}</div>
    <div v-else-if="isUnconfigured" class="wf-warn">⚠ Needs setup</div>
    <div v-if="isInvalid && data.__error" class="wf-warn err" :title="data.__error">⚠ {{ data.__error }}</div>

    <div v-if="data?.notes" class="wf-note" :title="data.notes">📝 {{ data.notes }}</div>

    <!-- condition: true/false branch handles -->
    <template v-if="type === 'logic.condition'">
      <Handle id="true" type="source" :position="Position.Right" :style="{ top: '34%' }" class="wf-h h-true" />
      <span class="h-lbl h-lbl-true">true</span>
      <Handle id="false" type="source" :position="Position.Right" :style="{ top: '66%' }" class="wf-h h-false" />
      <span class="h-lbl h-lbl-false">false</span>
    </template>
    <!-- normal outbound handle -->
    <Handle v-else type="source" :position="Position.Right" class="wf-h wf-h-out" />
    <!-- error branch handle (failable nodes) -->
    <template v-if="canError">
      <Handle id="error" type="source" :position="Position.Bottom" class="wf-h h-err" />
      <span class="h-lbl h-lbl-err">on error</span>
    </template>

    <!-- hover quick-add: drop + auto-connect the next node -->
    <button v-if="quickAdd" class="wf-quickadd" title="Add next node" @click.stop="quickAdd(id)">＋</button>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { nodeConfigPreview, nodeStatusState, nodeAccent, NODE_STATUS_LABELS } from '../../utils/wfNodeView'

const props = defineProps({
  id: String,
  type: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

// Quick-add: WorkflowBuilder provides this; clicking + opens the palette pre-wired to connect from here.
const quickAdd = inject('wfQuickAdd', null)

const isTrigger = computed(() => (props.type || '').startsWith('trigger.'))
const canError = computed(() => {
  const t = props.type || ''
  return (t.startsWith('action.') || t === 'agent.run' || t === 'logic.foreach' || t === 'logic.approval')
})
const family = computed(() => (props.type || '').split('.')[0])
const familyClass = computed(() => `fam-${family.value}`)

const accent = computed(() => nodeAccent(props.type))

const ICONS = {
  'trigger.manual': '▶', 'trigger.schedule': '⏰', 'trigger.webhook': '🔗', 'trigger.channel': '💬',
  'agent.run': '🤖',
  'action.channel': '📣', 'action.tool': '🛠️', 'action.mcp_tool': '🔧', 'action.script': '📜', 'action.http': '🌐',
  'action.subworkflow': '🧩',
  'logic.condition': '🔀', 'logic.delay': '⏳', 'logic.approval': '✋', 'logic.foreach': '🔁',
}
const icon = computed(() => ICONS[props.type] || '◻')

const TITLES = {
  'trigger.manual': 'Manual trigger', 'agent.run': 'Run agent', 'action.channel': 'Send to channel',
}
const title = computed(() => props.data?.label || TITLES[props.type] || props.type)

const subtitle = computed(() => {
  if (props.type === 'agent.run') return props.data?.agent_name || props.data?.agent_id ? `Agent: ${props.data.agent_name || props.data.agent_id}` : 'Pick an agent'
  if (props.type === 'action.channel') return `Channel: ${props.data?.kind || 'log'}`
  if (props.type === 'trigger.manual') return 'Runs on demand'
  if (props.type === 'logic.approval') return props.data?.message || 'Wait for approval'
  if (props.type === 'logic.foreach') return `For each → ${props.data?.do?.type || 'action'}`
  if (props.type === 'action.subworkflow') return props.data?.graph_name ? `Graph: ${props.data.graph_name}` : 'Pick a graph'
  if (props.type === 'action.mcp_tool') return props.data?.tool_name ? `MCP: ${props.data.server_name || '?'}.${props.data.tool_name}` : 'Pick an MCP tool'
  return props.type
})

// compact config preview + visual status state (pure logic in wfNodeView.js)
const configPreview = computed(() => nodeConfigPreview(props.type, props.data))
const statusState = computed(() => nodeStatusState(props.type, props.data))
const statusLabel = computed(() => NODE_STATUS_LABELS[statusState.value] || statusState.value)
const isUnconfigured = computed(() => statusState.value === 'idle')
const isInvalid = computed(() => statusState.value === 'invalid' || !!props.data?.__error)
</script>

<style scoped>
.wf-node {
  position: relative;
  min-width: 190px; max-width: 250px;
  background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06); padding: 0 0 0 4px; font-family: var(--vm-font-sans, inherit);
  transition: box-shadow .15s, border-color .15s;
}
/* left category stripe */
.wf-stripe { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; border-radius: 12px 0 0 12px; background: var(--accent); opacity: .85; }
/* category top accent + icon tint */
.wf-node.fam-trigger { border-top: 3px solid var(--accent); }
.wf-node.fam-agent   { border-top: 3px solid var(--accent); }
.wf-node.fam-action  { border-top: 3px solid var(--accent); }
.wf-node.fam-logic   { border-top: 3px solid var(--accent); }

/* ── status treatments (subtle borders/glow, no heavy gradients) ── */
.wf-node.state-idle { border-style: dashed; border-color: #cbd5e1; }
.wf-node.state-invalid { border-style: dashed; border-color: #fca5a5; box-shadow: 0 0 0 2px rgba(239,68,68,.10); }
.wf-node.state-pending { border-color: #fcd34d; }
.wf-node.state-configured { border-color: #e2e8f0; }
.wf-node.state-success { border-color: #6ee7b7; box-shadow: 0 0 0 1px rgba(16,185,129,.18); }
.wf-node.state-failed { border-color: #fca5a5; box-shadow: 0 0 0 1px rgba(239,68,68,.18); }
.wf-node.state-skipped { border-color: #e2e8f0; opacity: .7; }
.wf-node.state-running { border-color: #10b981 !important; animation: wfRunGlow 1.2s ease-in-out infinite; }
.wf-node.state-waiting { border-color: #f59e0b !important; animation: wfWaitGlow 1.4s ease-in-out infinite; }
.wf-node.selected { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,.18); }
@keyframes wfRunGlow {
  0%, 100% { box-shadow: 0 0 0 2px rgba(16,185,129,.30), 0 0 8px rgba(16,185,129,.25); }
  50%      { box-shadow: 0 0 0 5px rgba(16,185,129,.12), 0 0 20px rgba(16,185,129,.55); }
}
@keyframes wfWaitGlow {
  0%, 100% { box-shadow: 0 0 0 2px rgba(245,158,11,.25); }
  50%      { box-shadow: 0 0 0 5px rgba(245,158,11,.10), 0 0 14px rgba(245,158,11,.4); }
}

.wf-node-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; }
.wf-ic { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; background: color-mix(in srgb, var(--accent) 16%, #fff); }
.wf-node-text { min-width: 0; flex: 1; }
.wf-node-title { font-size: 12.5px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wf-node-sub { font-size: 10.5px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wf-preview { margin: 0 12px 9px; padding: 4px 7px; font-size: 10px; font-family: ui-monospace, Menlo, monospace; color: #475569; background: #f8fafc; border: 1px solid #eef2f7; border-radius: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wf-warn { margin: 0 12px 9px; padding: 4px 7px; font-size: 10px; font-weight: 600; color: #92722a; background: #fffbeb; border: 1px solid #fde68a; border-radius: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wf-warn.err { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
.wf-note { margin: 0 12px 9px; padding: 5px 7px; font-size: 10px; color: #92722a; background: #fffbeb; border: 1px solid #fde68a; border-radius: 7px; line-height: 1.35; max-height: 42px; overflow: hidden; }

/* status dot */
.wf-status { flex-shrink: 0; display: flex; align-items: center; }
.wf-dot { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
.st-idle .wf-dot { background: #cbd5e1; box-shadow: inset 0 0 0 2px #fff, 0 0 0 1px #cbd5e1; }
.st-configured .wf-dot { background: #60a5fa; }
.st-pending .wf-dot { background: #fbbf24; }
.st-running .wf-dot { background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.25); animation: wfpulse 1s infinite; }
.st-waiting .wf-dot { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,.25); animation: wfpulse 1s infinite; }
.st-success .wf-dot { background: #10b981; }
.st-failed .wf-dot { background: #ef4444; }
.st-skipped .wf-dot { background: #cbd5e1; }
.st-invalid .wf-dot { background: #ef4444; }
@keyframes wfpulse { 0%,100% { opacity: 1 } 50% { opacity: .4 } }

/* handles + connection affordance */
.wf-node :deep(.vue-flow__handle) { width: 11px; height: 11px; border: 2px solid #fff; background: #94a3b8; transition: transform .12s, background .12s; }
.wf-node :deep(.vue-flow__handle.wf-h-in) { background: #64748b; }
.wf-node :deep(.vue-flow__handle.wf-h-out) { background: var(--accent); }
.wf-node:hover :deep(.vue-flow__handle) { transform: scale(1.25); }
.wf-node :deep(.vue-flow__handle.h-true) { background: #10b981; }
.wf-node :deep(.vue-flow__handle.h-false) { background: #ef4444; }
.wf-node :deep(.vue-flow__handle.h-err) { background: #f59e0b; }
.h-lbl { position: absolute; font-size: 8.5px; font-weight: 700; color: #94a3b8; pointer-events: none; }
.h-lbl-true { right: -30px; top: calc(34% - 6px); color: #10b981; }
.h-lbl-false { right: -33px; top: calc(66% - 6px); color: #ef4444; }
.h-lbl-err { bottom: -14px; left: 50%; transform: translateX(-50%); color: #f59e0b; }

/* hover quick-add */
.wf-quickadd { position: absolute; right: -10px; bottom: -10px; width: 22px; height: 22px; border-radius: 50%;
  background: var(--accent); color: #fff; font-size: 14px; line-height: 1; font-weight: 700;
  box-shadow: 0 2px 6px rgba(0,0,0,.18); opacity: 0; transform: scale(.85); transition: opacity .12s, transform .12s; z-index: 4; }
.wf-node:hover .wf-quickadd { opacity: 1; transform: scale(1); }
.wf-quickadd:hover { filter: brightness(1.08); transform: scale(1.12); }
</style>
