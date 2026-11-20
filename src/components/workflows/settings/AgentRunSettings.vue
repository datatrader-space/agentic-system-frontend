<!--
  A "Run agent" step's settings (ADM-1333): the agent, the prompt, and the output (text, a JSON object, or typed schema
  fields that downstream steps pick as nodes.<id>.output.<field>). Every change is a history operation; the schema rows
  are written as a whole list.
-->
<template>
  <div class="ar">
    <div class="ar-field">
      <label class="ar-label" :for="`${uid}-agent`">Agent</label>
      <select :id="`${uid}-agent`" class="ar-in" :value="agentIndex" @change="pickAgent($event.target.value)">
        <option v-if="agentIndex === ''" value="" disabled>{{ editor.data.value.agent_id ? `Saved agent #${editor.data.value.agent_id} (not in your list)` : 'Choose an agent…' }}</option>
        <option v-for="(a, i) in agents" :key="a.id" :value="String(i)">{{ a.name }}</option>
      </select>
      <p v-if="editor.doc.agentsError.value" class="ar-warn" role="alert">{{ editor.doc.agentsError.value }}</p>
    </div>

    <div class="ar-field">
      <label class="ar-label" :for="`${uid}-prompt`">Prompt</label>
      <WfVarField
        :id="`${uid}-prompt`" label="Prompt" multiline :rows="6"
        placeholder="What should the agent do? Type {{ to insert a value from an earlier step."
        v-bind="editor.bindText('prompt', 'Prompt')"
      />
    </div>

    <div class="ar-field">
      <label class="ar-label" :for="`${uid}-mode`">Output</label>
      <select :id="`${uid}-mode`" class="ar-in" :value="mode" @change="editor.set('output_mode', $event.target.value, 'Output')">
        <option value="text">Text</option>
        <option value="json">JSON object</option>
        <option value="schema">Typed fields (JSON schema)</option>
      </select>
    </div>

    <fieldset v-if="mode === 'schema'" class="ar-schema">
      <legend class="ar-label">Output fields</legend>
      <div v-for="(f, i) in schema" :key="i" class="ar-row">
        <input
          class="ar-in mono" type="text" placeholder="field" :aria-label="`Field ${i + 1} name`" :value="f.name"
          autocomplete="off" spellcheck="false"
          @focus="editor.begin('Output fields')" @blur="editor.end()" @input="setField(i, { name: $event.target.value })"
        >
        <select class="ar-in ar-type" :aria-label="`Field ${i + 1} type`" :value="f.type || 'string'" @change="setField(i, { type: $event.target.value })">
          <option v-for="t in TYPES" :key="t">{{ t }}</option>
        </select>
        <label class="ar-req"><input type="checkbox" :checked="!!f.required" @change="setField(i, { required: $event.target.checked })">Required</label>
        <button type="button" class="ar-icon-btn" :aria-label="`Remove field ${i + 1}`" @click="removeField(i)">
          <Icon icon="lucide:x" aria-hidden="true" />
        </button>
      </div>
      <button type="button" class="ar-add" @click="addField"><Icon icon="lucide:plus" aria-hidden="true" />Add field</button>
      <p class="ar-help">The agent must answer with these fields; later steps read them as <code translate="no">nodes.&lt;id&gt;.output.&lt;field&gt;</code>.</p>
    </fieldset>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import { Icon } from '@iconify/vue'
import WfVarField from '../WfVarField.vue'
import { useNodeEditor } from './nodeEditor'

const TYPES = ['string', 'number', 'boolean', 'object', 'array']
const editor = useNodeEditor()
const uid = `ar-${useId()}`
const agents = computed(() => editor.lists.value.agents)
const mode = computed(() => editor.data.value.output_mode || 'text')
const schema = computed(() => (Array.isArray(editor.data.value.output_schema) ? editor.data.value.output_schema : []))

const agentIndex = computed(() => {
  const i = agents.value.findIndex((a) => String(a.id) === String(editor.data.value.agent_id))
  return i === -1 ? '' : String(i)
})
function pickAgent(index) {
  const a = agents.value[Number(index)]
  if (a) editor.patch({ agent_id: a.id, agent_name: a.name }, 'Agent')
}

const writeSchema = (next) => editor.set('output_schema', next, 'Output fields')
function setField(i, change) { writeSchema(schema.value.map((f, j) => (j === i ? { ...f, ...change } : f))) }
function addField() { writeSchema([...schema.value, { name: '', type: 'string', required: false }]) }
function removeField(i) { writeSchema(schema.value.filter((_, j) => j !== i)) }
</script>

<style scoped>
.ar { display: grid; gap: 14px; }
.ar-field { display: grid; gap: 5px; min-width: 0; }
.ar-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.ar-in {
  width: 100%; min-height: 34px; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.ar-in.mono { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; }
.ar-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.ar-warn { margin: 0; font-size: 12px; color: var(--vm-amber-ink); }
.ar-schema { display: grid; gap: 8px; margin: 0; padding: 10px; border: 1px solid var(--vm-line); border-radius: 8px; }
.ar-row { display: flex; gap: 6px; align-items: center; }
.ar-row .ar-in { flex: 1; min-width: 0; }
.ar-row .ar-type { flex: 0 0 110px; }
.ar-req { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--vm-ink-soft); white-space: nowrap; cursor: pointer; }
.ar-req input { accent-color: var(--vm-primary); }
.ar-icon-btn {
  display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid transparent; border-radius: 6px;
  background: none; color: var(--vm-ink-faint); cursor: pointer;
}
.ar-icon-btn:hover { color: var(--vm-red-ink); background: var(--vm-red-soft); }
.ar-icon-btn :deep(svg), .ar-add :deep(svg) { width: 14px; height: 14px; }
.ar-icon-btn:focus-visible, .ar-add:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.ar-add {
  justify-self: start; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 5px 10px;
  border: 1px dashed var(--vm-line-2); border-radius: 6px; background: none; color: var(--vm-link); font: inherit; font-size: 12px; cursor: pointer;
}
.ar-add:hover { background: var(--vm-primary-soft); border-color: var(--vm-primary-line); }
.ar-help { margin: 0; font-size: 12px; color: var(--vm-ink-faint); }
.ar-help code { font-family: var(--vm-font-mono, ui-monospace, monospace); }
@media (pointer: coarse) { .ar-in, .ar-add { min-height: 44px; } .ar-icon-btn { width: 44px; height: 44px; } }
</style>
