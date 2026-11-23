<!--
  The centre pane of the node window: every node type's settings (ADM-1333, plan §3.3). Ported from the old inline
  inspector of WorkflowBuilder.vue, which is deleted: the step name, the type's own fields (SchemaForm for the
  schema-driven types, a settings component for the rest), the inbound address of a trigger, reliability, notes.
  Everything edits through the node editor (history operations only).

  A viewer or runner (ADM-1339) sees every setting in a disabled fieldset: shown, never changed. The approval decision
  sits OUTSIDE it, because an approver may be a viewer.
-->
<template>
  <div class="ns">
    <ApprovalDecision v-if="type === 'logic.approval'" />
    <p v-if="editor.readOnly.value" class="ns-note ns-readonly"><Icon icon="lucide:eye" aria-hidden="true" />Your role on this workflow lets you see this step, not change it.</p>
    <fieldset class="ns-set" :disabled="editor.readOnly.value">
      <div class="ns-field">
        <label class="ns-label" :for="`${uid}-name`">Step name</label>
        <input
          :id="`${uid}-name`" class="ns-in" type="text" :value="data.label ?? ''" :placeholder="def?.label || type"
          autocomplete="off" @focus="editor.begin('Step name')" @blur="editor.end()"
          @input="editor.set('label', $event.target.value || undefined, 'Step name')"
        >
        <p class="ns-help">Id <code translate="no">{{ editor.node.value?.id }}</code>. Later steps read this one as <code translate="no">{{ selfToken }}</code>.</p>
      </div>

      <!-- triggers -->
      <template v-if="type === 'trigger.manual'">
        <div class="ns-field">
          <label class="ns-label" :for="`${uid}-desc`">Description</label>
          <textarea
            :id="`${uid}-desc`" class="ns-in" rows="3" :value="data.description ?? ''" placeholder="When should this workflow be started?"
            @focus="editor.begin('Description')" @blur="editor.end()" @input="editor.set('description', $event.target.value, 'Description')"
          />
        </div>
        <SchemaForm :fields="fields" />
      </template>

      <template v-else-if="type === 'trigger.webhook'">
        <p class="ns-note">Starts the workflow when an HTTP POST request arrives at this address.</p>
        <InboundUrl :path="triggerPath('webhook', 'webhook_path')" label="Endpoint address" method="POST" v-bind="addressNote" />
      </template>

      <template v-else-if="type === 'trigger.channel'">
        <SchemaForm :fields="fields" />
        <ChannelSecretField v-if="signs || data.secret_var" />
        <InboundUrl :path="triggerPath('channel', 'channel_path')" label="Inbound address" method="POST" v-bind="addressNote" />
        <p class="ns-help">Your channel adapter posts each message to this address.</p>
      </template>

      <template v-else-if="type === 'trigger.connector'">
        <SchemaForm :fields="fields" />
        <InboundUrl :path="triggerPath('connector', 'connector_path')" label="Inbound address" method="POST" v-bind="addressNote" />
        <p class="ns-help">
          Register this address with the provider. Sign the body with the binding's secret as
          <code translate="no">X-Signature: sha256=&lt;hmac&gt;</code>; the event type is read from
          <code translate="no">X-GitHub-Event</code> or <code translate="no">X-Event-Type</code>.
        </p>
      </template>

      <!-- steps with their own settings component -->
      <AgentRunSettings v-else-if="type === 'agent.run'" />
      <McpToolSettings v-else-if="type === 'action.mcp_tool'" />
      <ConditionSettings v-else-if="type === 'logic.condition'" />
      <ForeachSettings v-else-if="type === 'logic.foreach'" />

      <SchemaForm v-else-if="type === 'llm.call'" :fields="fields">
        <template #field-model_id><LlmModelField /></template>
      </SchemaForm>

      <template v-else-if="fields">
        <SchemaForm :fields="fields" :derive="derive" />
        <ApproversField v-if="type === 'logic.approval'" />
      </template>

      <p v-else class="ns-note" role="alert">This step type ({{ type }}) has no settings the builder knows. It is saved as it is.</p>

      <p v-if="def?.hint" class="ns-help">{{ def.hint }}</p>

      <ReliabilitySettings v-if="hasReliability(type)" />

      <div class="ns-field ns-notes">
        <label class="ns-label" :for="`${uid}-notes`">Notes</label>
        <textarea
          :id="`${uid}-notes`" class="ns-in" rows="2" :value="data.notes ?? ''" placeholder="Optional note shown on the step"
          @focus="editor.begin('Notes')" @blur="editor.end()" @input="editor.set('notes', $event.target.value, 'Notes')"
        />
      </div>
    </fieldset>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import { Icon } from '@iconify/vue'
import { WF_NODE_DEFS } from '@/config/wfNodeDefinitions'
import SchemaForm from '../SchemaForm.vue'
import AgentRunSettings from './AgentRunSettings.vue'
import McpToolSettings from './McpToolSettings.vue'
import ConditionSettings from './ConditionSettings.vue'
import ForeachSettings from './ForeachSettings.vue'
import LlmModelField from './LlmModelField.vue'
import ReliabilitySettings from './ReliabilitySettings.vue'
import ChannelSecretField from './ChannelSecretField.vue'
import ApprovalDecision from './ApprovalDecision.vue'
import ApproversField from './ApproversField.vue'
import InboundUrl from './InboundUrl.vue'
import { useNodeEditor } from './nodeEditor'
import { hasReliability } from '../wfNodeData'

// The platforms that sign their deliveries (backend triggers.py CHANNEL_SIGNING_SCHEMES).
const SIGNING_PLATFORMS = ['slack', 'telegram']

const editor = useNodeEditor()
const uid = `ns-${useId()}`
const data = computed(() => editor.data.value)
const type = computed(() => editor.type.value)
const def = computed(() => editor.def.value)
// Every declared field, custom types included (their own components above read only what they need).
const fields = computed(() => WF_NODE_DEFS[type.value]?.fields || null)
const signs = computed(() => SIGNING_PLATFORMS.includes(String(data.value.platform || '').toLowerCase()))
const selfToken = computed(() => `{{nodes.${editor.node.value?.id}.output}}`)

// The server sends trigger addresses only to the owner and editors (a request to one starts a run as the owner).
const addressNote = computed(() => (editor.readOnly.value ? { emptyText: 'Only the owner and editors of this workflow see this address.' } : {}))

function triggerPath(kind, key) {
  const id = editor.node.value?.id
  const t = (editor.doc.meta.triggers || []).find((x) => x.node_id === id && x.kind === kind)
  return t?.[key] || ''
}

// Companion keys written with a change, in the same history entry.
function derive(key, value) {
  if (key === 'graph_id') {
    const g = editor.lists.value.graphs.find((x) => String(x[0]) === String(value))
    return { graph_name: g ? g[1] : '' }
  }
  return null
}
</script>

<style scoped>
.ns, .ns-set { display: grid; gap: 16px; }
.ns-set { min-width: 0; margin: 0; padding: 0; border: 0; }
.ns-readonly { display: flex; gap: 6px; align-items: center; padding: 7px 9px; border-radius: 6px; background: var(--vm-surface-soft); }
.ns-readonly :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.ns-field { display: grid; gap: 5px; min-width: 0; }
.ns-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.ns-in {
  width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; resize: vertical;
}
.ns-in::placeholder { color: var(--vm-ink-faint); }
.ns-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.ns-help, .ns-note { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.ns-note { color: var(--vm-ink-soft); }
.ns-help code { font-family: var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink-soft); overflow-wrap: anywhere; }
.ns-notes { border-top: 1px solid var(--vm-line); padding-top: 12px; }
@media (pointer: coarse) { .ns-in { min-height: 44px; } }
</style>
