<template>
  <div class="wf-node" :class="[familyClass, 'state-' + statusState, { selected }]" :style="{ '--accent': accent }">
    <span class="wf-stripe"></span>

    <!-- inbound handle (all except triggers) -->
    <Handle v-if="!isTrigger" type="target" :position="Position.Left" class="wf-h wf-h-in" />

    <div class="wf-node-head">
      <span class="wf-ic" :class="familyClass"><Icon :icon="icon" /></span>
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
    <button v-if="quickAdd" class="wf-quickadd" title="Add next node" aria-label="Add next node" @click.stop="quickAdd(id)">＋</button>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { wfDef } from '../../config/wfNodeDefinitions'
import { Icon } from '@iconify/vue'
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
  return (t.startsWith('action.') || t === 'agent.run' || t === 'llm.call'
          || t === 'logic.foreach' || t === 'logic.approval')
})
const FAMILY_ALIAS = { llm: 'agent', media: 'action' }   // no .fam-llm styles exist; a model call IS an agent-family node
const family = computed(() => {
  const f = (props.type || '').split('.')[0]
  return FAMILY_ALIAS[f] || f
})
const familyClass = computed(() => `fam-${family.value}`)

const accent = computed(() => nodeAccent(props.type))

const ICONS = {
  'media.generate': 'lucide:film',
  'trigger.manual': 'lucide:square-play',
  'trigger.schedule': 'lucide:clock-3',
  'trigger.webhook': 'lucide:webhook',
  'trigger.channel': 'lucide:message-square',
  'trigger.connector': 'lucide:plug',
  'agent.run': 'lucide:bot',
  'llm.call': 'lucide:sparkles',
  'action.channel': 'lucide:send',
  'action.tool': 'lucide:wrench',
  'action.mcp_tool': 'lucide:plug-zap',
  'action.script': 'lucide:scan-line',
  'action.http': 'lucide:globe-2',
  'action.subworkflow': 'lucide:workflow',
  'logic.condition': 'lucide:split',
  'logic.delay': 'lucide:timer',
  'logic.approval': 'lucide:badge-check',
  'logic.foreach': 'lucide:repeat-2',
}
const icon = computed(() => ICONS[props.type] || 'lucide:square')

const TITLES = {
  'trigger.manual': 'Manual trigger', 'agent.run': 'Run agent', 'action.channel': 'Send to channel',
  'llm.call': 'Model call',
}
const title = computed(() => props.data?.label || TITLES[props.type] || wfDef(props.type)?.label || props.type)

const subtitle = computed(() => {
  if (props.type === 'agent.run') return props.data?.agent_name || props.data?.agent_id ? `Agent: ${props.data.agent_name || props.data.agent_id}` : 'Pick an agent'
  if (props.type === 'llm.call') {
    const mode = props.data?.output_mode || 'text'
    return mode === 'text' ? 'One model call' : `One model call → ${mode}`
  }
  if (props.type === 'action.channel') return props.data?.slack_channel || `Channel: ${props.data?.kind || 'log'}`
  if (props.type === 'trigger.webhook') return 'Inbound HTTP'
  if (props.type === 'trigger.schedule') return 'Cron trigger'
  if (props.type === 'trigger.channel') return 'Inbound Slack/Telegram/Email'
  if (props.type === 'trigger.connector') return props.data?.provider
    ? `${props.data.provider}${props.data?.event_type ? ' · ' + props.data.event_type : ''}`
    : 'Connector event'
  if (props.type === 'trigger.manual') return 'Runs on demand'
  if (props.type === 'action.http') return props.data?.url ? `${props.data?.method || 'GET'} ${props.data.url}` : 'GET/POST a URL'
  if (props.type === 'action.script') return props.data?.notes || 'Run a saved script'
  if (props.type === 'action.tool') return props.data?.tool || 'Call a registered tool'
  if (props.type === 'logic.condition') return props.data?.expression || 'Logic node'
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
.wf-node{position:relative;width:230px;min-width:210px;max-width:250px;background:#fff;border:1px solid #dce2eb;border-radius:8px;box-shadow:0 2px 6px #0f172a08;font-family:var(--font-sans,Inter,system-ui,sans-serif);color:#334155}
.wf-stripe{position:absolute;inset-block:10px;left:0;width:3px;border-radius:0 3px 3px 0;background:var(--accent);opacity:.7}
.wf-node-head{display:flex;align-items:center;gap:9px;padding:11px 12px}.wf-ic{display:grid;place-items:center;flex-shrink:0;width:30px;height:30px;border-radius:7px;background:color-mix(in srgb,var(--accent) 9%,white);color:var(--accent)}.wf-ic svg{width:16px;height:16px}.wf-node-text{flex:1;min-width:0}.wf-node-title{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wf-node-sub{margin-top:3px;color:#8490a2;font-size:10px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wf-status{flex-shrink:0}.wf-dot{display:block;width:7px;height:7px;border-radius:50%;background:#cbd5e1}.wf-preview,.wf-warn,.wf-note{margin:0 12px 9px;padding:5px 7px;border-radius:4px;overflow:hidden;text-overflow:ellipsis;font-size:10px;line-height:1.4;white-space:nowrap}.wf-preview{background:#f8fafc;color:#64748b;border:1px solid #f1f5f9}.wf-warn,.wf-note{background:#fffbeb;color:#92400e}.wf-warn.err{background:#fff1f2;color:#b91c1c}.wf-note{white-space:normal;max-height:38px}
.wf-node.state-idle{border-style:dashed}.wf-node.state-invalid,.wf-node.state-failed{border-color:#fca5a5}.wf-node.state-success{border-color:#6ee7b7}.wf-node.state-running{border-color:#60a5fa}.wf-node.state-waiting{border-color:#fbbf24}.wf-node.state-skipped{opacity:.65}.wf-node.selected{border-color:#2563eb;box-shadow:0 0 0 2px #2563eb22}.st-configured .wf-dot{background:#60a5fa}.st-success .wf-dot{background:#10b981}.st-running .wf-dot{background:#2563eb}.st-pending .wf-dot,.st-waiting .wf-dot{background:#f59e0b}.st-invalid .wf-dot,.st-failed .wf-dot{background:#ef4444}
.wf-node :deep(.vue-flow__handle){width:10px;height:10px;border:2px solid #fff;background:#94a3b8}.wf-node :deep(.wf-h-out){background:var(--accent)}.wf-node :deep(.h-true){background:#10b981}.wf-node :deep(.h-false){background:#ef4444}.wf-node :deep(.h-err){background:#f59e0b}.h-lbl{position:absolute;font-size:9px;color:#94a3b8;pointer-events:none}.h-lbl-true{right:-30px;top:calc(34% - 5px);color:#059669}.h-lbl-false{right:-33px;top:calc(66% - 5px);color:#dc2626}.h-lbl-err{bottom:-15px;left:50%;transform:translateX(-50%);color:#b45309}.wf-quickadd{position:absolute;right:-10px;bottom:-10px;display:grid;place-items:center;width:24px;height:24px;border:2px solid #fff;border-radius:50%;background:#2563eb;color:#fff;font-size:15px;box-shadow:0 2px 5px #0f172a16;opacity:0;cursor:pointer}.wf-node:hover .wf-quickadd,.wf-node:focus-within .wf-quickadd{opacity:1}.wf-quickadd:focus-visible{outline:2px solid #2563eb;outline-offset:3px}
@media(pointer:coarse){.wf-quickadd{opacity:1;width:28px;height:28px}}
</style>
