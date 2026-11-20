<!--
  An MCP tool step's settings (ADM-1333): the agent whose credentials and assigned tools the call runs with, the server
  and tool (chosen when the step was added, shown here), and the call's parameters. The output is { text, result, … }:
  `result` keeps the tool's structure (backend B10), so later steps read nodes.<id>.output.result.<path>.
-->
<template>
  <div class="mt">
    <div class="mt-field">
      <label class="mt-label" :for="`${uid}-agent`">Agent</label>
      <select :id="`${uid}-agent`" class="mt-in" :value="agentIndex" :aria-describedby="`${uid}-agent-help`" @change="pickAgent($event.target.value)">
        <option v-if="agentIndex === ''" value="" disabled>Choose an agent…</option>
        <option v-for="(a, i) in agents" :key="a.id" :value="String(i)">{{ a.name }}</option>
      </select>
      <p :id="`${uid}-agent-help`" class="mt-help">The call runs with this agent's connections and assigned tools.</p>
    </div>
    <dl class="mt-facts">
      <div><dt>MCP server</dt><dd translate="no">{{ editor.data.value.server_name || (editor.data.value.server_id ? `#${editor.data.value.server_id}` : 'Not set') }}</dd></div>
      <div><dt>Tool</dt><dd translate="no">{{ editor.data.value.tool_name || 'Not set' }}</dd></div>
    </dl>
    <div class="mt-field">
      <label class="mt-label" :for="`${uid}-params`">Parameters (JSON)</label>
      <WfVarField
        :id="`${uid}-params`" label="Parameters" multiline mono :rows="6" placeholder='{ "query": "{{trigger.keyword}}" }'
        v-bind="editor.bindText('params_json', 'Parameters')"
      />
    </div>
    <p class="mt-help">One direct MCP call, no model. A tool that writes or deletes is blocked when the run is unattended.</p>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import WfVarField from '../WfVarField.vue'
import { useNodeEditor } from './nodeEditor'

const editor = useNodeEditor()
const uid = `mt-${useId()}`
const agents = computed(() => editor.lists.value.agents)
const agentIndex = computed(() => {
  const i = agents.value.findIndex((a) => String(a.id) === String(editor.data.value.agent_id))
  return i === -1 ? '' : String(i)
})
function pickAgent(index) {
  const a = agents.value[Number(index)]
  if (a) editor.patch({ agent_id: a.id, agent_name: a.name }, 'Agent')
}
</script>

<style scoped>
.mt { display: grid; gap: 14px; }
.mt-field { display: grid; gap: 5px; }
.mt-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.mt-in {
  width: 100%; min-height: 34px; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.mt-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.mt-help { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.mt-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin: 0; }
.mt-facts div { padding: 8px 10px; border: 1px solid var(--vm-line); border-radius: 6px; background: var(--vm-surface-soft); }
.mt-facts dt { font-size: 11px; font-weight: 600; color: var(--vm-ink-faint); }
.mt-facts dd { margin: 2px 0 0; font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; color: var(--vm-ink); overflow-wrap: anywhere; }
@media (pointer: coarse) { .mt-in { min-height: 44px; } }
</style>
