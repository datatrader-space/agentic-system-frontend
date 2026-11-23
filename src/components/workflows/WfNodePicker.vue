<!--
  The node picker (plan §3.1): a command dialog with a search box, category tabs, Recent, arrow keys and Enter.
  Opened by the toolbar +, an output's +, a connection's +, a connection dropped on the canvas, N, Tab or Ctrl/⌘+K.
  It is not on screen otherwise. The tools and MCP list loads on first open; a failed load says why and can be
  tried again (F11); every matching tool is listed.

  Choosing an MCP tool asks for the agent it runs with first: the call uses that agent's credentials and permissions.

  `frame` (ADM-1351): the workflow starts with "Each camera frame". The steps a stream cannot run on a frame are listed
  disabled with the reason (wfPickerItems.js), and a note names the steps that can follow the frame.
-->
<template>
  <AppDialog :open="open" :title="title" :description="description" size="md" @update:open="emit('update:open', $event)">
    <div class="wfb-layer wfb-root wfb-picker">
      <template v-if="mcpPick">
        <button type="button" class="wfb-link-btn" @click="mcpPick = null"><Icon icon="lucide:arrow-left" aria-hidden="true" />Back to the list</button>
        <p class="wfb-picker__note">
          <strong translate="no">{{ mcpPick.serverName }}: {{ mcpPick.toolName }}</strong> runs with an agent's credentials and permissions.
          The agent needs the {{ mcpPick.serverName }} server attached, or the step fails with that reason.
        </p>
        <label class="wfb-field">
          <span class="wfb-field__label">Agent</span>
          <select v-model="mcpAgentId" class="wfb-input" name="mcp-agent">
            <option :value="null" disabled>Choose an agent…</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <p v-if="!agents.length" class="wfb-picker__note" role="status">You have no agents yet. Create one on the Agents page first.</p>
        <div class="wfb-picker__foot">
          <button type="button" class="wfb-btn" @click="mcpPick = null">Back</button>
          <button type="button" class="wfb-btn is-primary" :disabled="!mcpAgentId" @click="chooseMcp">Add MCP tool step</button>
        </div>
      </template>
      <AppCommandList
        v-else
        ref="list"
        v-model:search="search"
        :items="items"
        :groups="groups"
        label="Steps you can add"
        placeholder="Search steps, tools and MCP servers"
        :empty-text="emptyText"
        @select="onSelect"
      >
        <template #header>
          <div class="wfb-picker__tabs" role="group" aria-label="Show">
            <button v-for="t in tabs" :key="t.id" type="button" class="wfb-tab" :aria-pressed="tab === t.id" @click="setTab(t.id)">{{ t.label }}</button>
          </div>
          <p v-if="frame" class="wfb-picker__note" role="note">
            This workflow starts on each camera frame, so only these steps can follow it: {{ frameSteps }}.
          </p>
          <p v-if="catalog.error.value" class="wfb-picker__error" role="alert">
            {{ catalog.error.value }}
            <button type="button" class="wfb-link-btn" :disabled="catalog.loading.value" @click="catalog.load()">Try again</button>
          </p>
          <p v-else-if="catalog.loading.value" class="wfb-picker__note" role="status">Loading tools and MCP servers…</p>
          <p v-else-if="tab === 'all' && !search && catalog.tools.value.length" class="wfb-picker__note">
            Type to search {{ catalog.tools.value.length.toLocaleString() }} tools, or open the Tools tab.
          </p>
        </template>
      </AppCommandList>
    </div>
  </AppDialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppCommandList from '@/components/common/AppCommandList.vue'
import { WF_CATEGORIES, WF_CATEGORY_ORDER } from '@/config/wfNodeDefinitions'
import { pickerItems, pickerGroups, loadRecent, needsInput } from './wfPickerItems'
import { frameStepLabels } from './wfFrame'

const props = defineProps({
  open: { type: Boolean, default: false },
  ctx: { type: Object, default: null },
  catalog: { type: Object, required: true },
  agents: { type: Array, default: () => [] },
  // The workflow starts with "Each camera frame" (wfFrame.js).
  frame: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'choose'])

const search = ref('')
const tab = ref('all')
const recent = ref([])
const mcpPick = ref(null)
const mcpAgentId = ref(null)
const list = ref(null)

const tabs = computed(() => [
  { id: 'all', label: 'All' },
  ...WF_CATEGORY_ORDER
    .filter((id) => !(id === 'trigger' && needsInput(props.ctx)))
    .map((id) => ({ id, label: WF_CATEGORIES[id].label })),
  { id: 'tools', label: 'Tools' },
  ...(props.catalog.mcp.value?.enabled ? [{ id: 'mcp', label: 'MCP' }] : []),
])

const title = computed(() => {
  const m = props.ctx?.mode
  if (m === 'insert') return 'Insert a step'
  if (m === 'from' || m === 'into') return 'Add a connected step'
  return 'Add a step'
})
const description = computed(() => (mcpPick.value ? 'Choose the agent this MCP tool runs with.' : 'Search, then press Enter or click to add.'))

const items = computed(() => pickerItems({
  tools: props.catalog.tools.value, mcp: props.catalog.mcp.value, recent: recent.value,
  ctx: props.ctx, tab: tab.value, searching: !!search.value.trim(), frame: props.frame,
}))
const frameSteps = computed(() => frameStepLabels().join(', '))
const groups = computed(() => pickerGroups(props.catalog.mcp.value, { frame: props.frame }))
const emptyText = computed(() => (tab.value === 'tools' && props.catalog.loading.value ? 'Loading tools…' : 'Nothing to show here.'))

watch(() => props.open, (now) => {
  if (!now) return
  search.value = ''
  tab.value = 'all'
  mcpPick.value = null
  mcpAgentId.value = null
  recent.value = loadRecent()
  props.catalog.load()
})

function setTab(id) {
  tab.value = id
  nextTick(() => list.value?.focus())
}

function onSelect(item) {
  const real = item.sourceId ? items.value.find((i) => i.id === item.sourceId) || { ...item, id: item.sourceId } : item
  if (real.kind === 'mcp-tool') {
    mcpPick.value = real
    mcpAgentId.value = null
    return
  }
  emit('choose', { item: real })
}
function chooseMcp() {
  const agent = props.agents.find((a) => a.id === mcpAgentId.value)
  if (!agent || !mcpPick.value) return
  emit('choose', { item: mcpPick.value, agent })
}
</script>
