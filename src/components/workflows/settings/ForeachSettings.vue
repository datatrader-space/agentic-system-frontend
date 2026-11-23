<!--
  A for-each step's settings (ADM-1333, F6): the list to walk, and the one step run for each item.

  F6: the old placeholder showed `{{node.<id>.text}}`, a legacy syntax. The engine's own is
  `{{nodes.<id>.output.items}}` (D3), or the list written as JSON. Since B10 the engine no longer splits text on commas,
  so the window does not offer that either. The inner step's fields can use {{item}}. The inner step is written whole
  (`do: { type, data }`) through the history, never changed in place.

  ADM-1351: the steps offered are the engine's rule, kept in one place (wfNodeDefinitions.js wfForeachInnerTypes): the
  five actions and every vision step, named and ordered by the server's registry. A vision step's settings are drawn
  from its registry fields (ForeachInnerForm, SchemaForm) and start from its registry defaults; only the five actions
  keep the forms below. In a frame workflow only the steps a frame can run are offered; an inner step saved before
  that stays shown, marked, with what to choose instead.
-->
<template>
  <div class="fe">
    <div class="fe-field">
      <label class="fe-label" :for="`${uid}-items`">List to walk</label>
      <WfVarField
        :id="`${uid}-items`" label="List to walk" mono :describedby="`${uid}-items-help`"
        :placeholder="ITEMS_PLACEHOLDER"
        v-bind="editor.bindText('items_template', 'List to walk')"
      />
      <p :id="`${uid}-items-help`" class="fe-help">
        A token for an upstream list, such as <code translate="no">{{ ITEMS_PLACEHOLDER }}</code>, or the list written as JSON,
        such as <code translate="no">["a", "b"]</code>. Each entry is available as <code translate="no">{{ ITEM_TOKEN }}</code> in the step below.
      </p>
    </div>

    <div class="fe-field">
      <label class="fe-label" :for="`${uid}-type`">Step to run for each item</label>
      <select
        :id="`${uid}-type`" class="fe-in" :value="inner.type" :aria-invalid="notOffered ? 'true' : undefined"
        :aria-describedby="notOffered ? `${uid}-type-warn` : undefined" @change="changeType($event.target.value)"
      >
        <option v-if="notOffered" :value="inner.type" disabled>{{ typeLabel(inner.type) }} (not on a camera frame)</option>
        <option v-for="t in innerTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
      <p v-if="notOffered" :id="`${uid}-type-warn`" class="fe-warn">
        A stream cannot run {{ typeLabel(inner.type) }} on a camera frame. Choose one of: {{ innerTypes.map((t) => t.label).join(', ') }}.
      </p>
    </div>

    <div class="fe-inner" role="group" :aria-label="`Settings of the step run for each item`">
      <template v-if="inner.type === 'action.channel'">
        <div class="fe-field">
          <label class="fe-label" :for="`${uid}-kind`">Channel</label>
          <select :id="`${uid}-kind`" class="fe-in" :value="innerData.kind || 'log'" @change="setInner('kind', $event.target.value, 'Channel')">
            <option value="log">Log</option><option value="slack">Slack</option><option value="webhook">Webhook</option>
            <option value="telegram">Telegram</option><option value="email">Email</option>
          </select>
        </div>
        <div v-if="CHANNEL_TARGET[innerData.kind]" class="fe-field">
          <label class="fe-label" :for="`${uid}-target`">{{ CHANNEL_TARGET[innerData.kind].label }}</label>
          <WfVarField
            :id="`${uid}-target`" :label="CHANNEL_TARGET[innerData.kind].label" :placeholder="CHANNEL_TARGET[innerData.kind].ph"
            v-bind="innerText(CHANNEL_TARGET[innerData.kind].key, CHANNEL_TARGET[innerData.kind].label)"
          />
        </div>
        <div class="fe-field">
          <label class="fe-label" :for="`${uid}-msg`">Message</label>
          <WfVarField :id="`${uid}-msg`" label="Message" multiline :rows="3" placeholder="Hello {{item}}" v-bind="innerText('message', 'Message')" />
        </div>
      </template>

      <template v-else-if="inner.type === 'action.tool'">
        <div class="fe-field">
          <label class="fe-label" :for="`${uid}-tool`">Tool name</label>
          <input
            :id="`${uid}-tool`" class="fe-in mono" type="text" :list="`${uid}-tools`" placeholder="TOOL_NAME"
            :value="innerData.tool || ''" autocomplete="off" spellcheck="false"
            @focus="editor.begin('Tool name')" @blur="editor.end()" @input="setInner('tool', $event.target.value, 'Tool name')"
          >
          <datalist :id="`${uid}-tools`"><option v-for="t in editor.lists.value.tools" :key="t" :value="t" /></datalist>
        </div>
        <div class="fe-field">
          <label class="fe-label" :for="`${uid}-params`">Parameters (JSON)</label>
          <WfVarField :id="`${uid}-params`" label="Parameters" multiline mono :rows="4" placeholder='{ "q": "{{item}}" }' v-bind="innerText('params_json', 'Parameters')" />
        </div>
      </template>

      <template v-else-if="inner.type === 'action.http'">
        <div class="fe-field">
          <label class="fe-label" :for="`${uid}-method`">Method</label>
          <select :id="`${uid}-method`" class="fe-in" :value="innerData.method || 'GET'" @change="setInner('method', $event.target.value, 'Method')">
            <option v-for="m in METHODS" :key="m">{{ m }}</option>
          </select>
        </div>
        <div class="fe-field">
          <label class="fe-label" :for="`${uid}-url`">URL</label>
          <WfVarField :id="`${uid}-url`" label="URL" placeholder="https://example.com/items/{{item}}" v-bind="innerText('url', 'URL')" />
        </div>
      </template>

      <template v-else-if="inner.type === 'agent.run'">
        <div class="fe-field">
          <label class="fe-label" :for="`${uid}-agent`">Agent</label>
          <select :id="`${uid}-agent`" class="fe-in" :value="agentIndex" @change="pickAgent($event.target.value)">
            <option v-if="agentIndex === ''" value="" disabled>Choose an agent…</option>
            <option v-for="(a, i) in editor.lists.value.agents" :key="a.id" :value="String(i)">{{ a.name }}</option>
          </select>
        </div>
        <div class="fe-field">
          <label class="fe-label" :for="`${uid}-prompt`">Prompt</label>
          <WfVarField :id="`${uid}-prompt`" label="Prompt" multiline :rows="3" placeholder="Process {{item}}" v-bind="innerText('prompt', 'Prompt')" />
        </div>
      </template>

      <template v-else-if="inner.type === 'action.subworkflow'">
        <div class="fe-field">
          <label class="fe-label" :for="`${uid}-graph`">Workflow to run</label>
          <select :id="`${uid}-graph`" class="fe-in" :value="graphIndex" @change="pickGraph($event.target.value)">
            <option v-if="graphIndex === ''" value="" disabled>Choose a workflow…</option>
            <option v-for="(g, i) in editor.lists.value.graphs" :key="g[0]" :value="String(i)">{{ g[1] }}</option>
          </select>
          <p class="fe-help">Each item runs the chosen workflow. <code translate="no">{{ ITEM_TOKEN }}</code> is passed in its trigger payload.</p>
        </div>
      </template>

      <template v-else-if="fromRegistry">
        <p class="fe-help">
          <code translate="no">{{ ITEM_TOKEN }}</code> is each entry, for example each cropped image of
          <code translate="no">{{ CROPS_EXAMPLE }}</code>.
        </p>
        <ForeachInnerForm :type="inner.type" :data="innerData" :write="writeInner" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import WfVarField from '../WfVarField.vue'
import ForeachInnerForm from './ForeachInnerForm.vue'
import { useNodeEditor } from './nodeEditor'
import { wfDef, wfDefaultData, wfForeachInnerTypes } from '@/config/wfNodeDefinitions'

const ITEMS_PLACEHOLDER = '{{nodes.<id>.output.items}}'
const ITEM_TOKEN = '{{item}}'
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const CROPS_EXAMPLE = '{{nodes.crop.output.images}}'
// The settings a new inner step starts with, for the five actions drawn by the forms above (the same seeds the old
// inspector used). Any other step starts from its registry defaults.
const SEEDS = {
  'action.channel': { kind: 'log', message: 'item {{item}}' },
  'action.tool': { tool: '', params_json: '{}' },
  'action.http': { method: 'GET', url: '' },
  'agent.run': { prompt: 'Process {{item}}' },
  'action.subworkflow': {},
}
const CHANNEL_TARGET = {
  slack: { key: 'slack_channel', label: 'Slack channel', ph: '#general' },
  webhook: { key: 'url', label: 'Webhook URL', ph: 'https://example.com/hook' },
  telegram: { key: 'chat_id', label: 'Telegram chat id', ph: '123456789' },
  email: { key: 'to', label: 'Recipient', ph: 'to@example.com' },
}

const editor = useNodeEditor()
const uid = `fe-${useId()}`

const inner = computed(() => {
  const d = editor.data.value.do
  return d && typeof d === 'object' ? { type: d.type || 'action.channel', data: d.data || {} } : { type: 'action.channel', data: {} }
})
const innerData = computed(() => inner.value.data)
// The steps offered (the engine's rule; in a frame workflow, only those a frame can run), and whether the saved one is.
const innerTypes = computed(() => wfForeachInnerTypes({ frame: !!editor.frameWorkflow?.value }))
const notOffered = computed(() => !innerTypes.value.some((t) => t.value === inner.value.type))
const fromRegistry = computed(() => !(inner.value.type in SEEDS) && !!wfDef(inner.value.type))
const typeLabel = (type) => wfDef(type)?.label || type

function writeInner(nextData, title) {
  editor.patch({ do: { type: inner.value.type, data: nextData } }, title)
}
function setInner(key, value, title) { writeInner({ ...innerData.value, [key]: value }, title) }
function innerText(key, title) {
  return editor.bindCustom(title, () => innerData.value[key], (v) => setInner(key, v, title))
}
function changeType(type) {
  if (type === inner.value.type) return
  const seed = type in SEEDS ? JSON.parse(JSON.stringify(SEEDS[type])) : wfDefaultData(type)
  editor.patch({ do: { type, data: seed } }, 'Step to run for each item')
}

const agentIndex = computed(() => {
  const i = editor.lists.value.agents.findIndex((a) => String(a.id) === String(innerData.value.agent_id))
  return i === -1 ? '' : String(i)
})
function pickAgent(index) {
  const a = editor.lists.value.agents[Number(index)]
  if (a) writeInner({ ...innerData.value, agent_id: a.id }, 'Agent')
}
const graphIndex = computed(() => {
  const i = editor.lists.value.graphs.findIndex((g) => String(g[0]) === String(innerData.value.graph_id))
  return i === -1 ? '' : String(i)
})
function pickGraph(index) {
  const g = editor.lists.value.graphs[Number(index)]
  if (g) writeInner({ ...innerData.value, graph_id: g[0] }, 'Workflow to run')
}
</script>

<style scoped>
.fe { display: grid; gap: 14px; }
.fe-inner { display: grid; gap: 14px; padding: 12px; border: 1px solid var(--vm-line); border-radius: 8px; background: var(--vm-surface-soft); }
.fe-field { display: grid; gap: 5px; min-width: 0; }
.fe-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.fe-help { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.fe-warn { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-amber-ink); }
.fe-help code { font-family: var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink-soft); overflow-wrap: anywhere; }
.fe-in {
  width: 100%; min-height: 34px; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.fe-in.mono { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; }
.fe-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
@media (pointer: coarse) { .fe-in { min-height: 44px; } }
</style>
