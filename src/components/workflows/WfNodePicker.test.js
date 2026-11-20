// @vitest-environment jsdom
// The node picker: choosing a step, the MCP agent step, and a failed catalog that can be tried again (ADM-1333, F11).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import WfNodePicker from './WfNodePicker.vue'

const AppDialogStub = { props: ['open', 'title', 'description', 'size'], template: '<div v-if="open" class="dlg" :data-title="title"><slot /></div>' }
const AppCommandListStub = {
  name: 'AppCommandList',
  props: ['items', 'groups', 'label', 'placeholder', 'search', 'emptyText'],
  emits: ['select', 'update:search'],
  template: '<div class="cmd"><slot name="header" /><button v-for="i in items" :key="i.id" class="item" :data-id="i.id" @click="$emit(\'select\', i)">{{ i.label }}</button></div>',
  methods: { focus() {} },
}

function catalog({ error = '' } = {}) {
  return {
    tools: ref([{ name: 'SLACK_POST', description: 'Post', category: 'slack' }]),
    mcp: ref({ enabled: true, servers: [{ id: 7, name: 'Fixture MCP', tools: [{ name: 'fixture_read' }] }] }),
    error: ref(error), loading: ref(false), load: vi.fn().mockResolvedValue(true),
  }
}
function picker(props = {}) {
  const cat = props.catalog || catalog()
  const w = mount(WfNodePicker, {
    props: { open: false, ctx: { mode: 'free' }, catalog: cat, agents: [{ id: 1, name: 'Fixture agent' }], ...props },
    global: { stubs: { AppDialog: AppDialogStub, AppCommandList: AppCommandListStub, Icon: true } },
  })
  return { w, cat }
}

beforeEach(() => { try { localStorage.clear() } catch { /* none */ } })

describe('WfNodePicker', () => {
  it('loads the catalog when it opens and emits the chosen step', async () => {
    const { w, cat } = picker()
    await w.setProps({ open: true })
    expect(cat.load).toHaveBeenCalled()
    await w.find('[data-id="node:logic.delay"]').trigger('click')
    expect(w.emitted('choose')[0][0].item).toMatchObject({ kind: 'node', nodeType: 'logic.delay' })
  })

  it('asks for the agent before adding an MCP tool step', async () => {
    const { w } = picker()
    await w.setProps({ open: true })
    w.findComponent(AppCommandListStub).vm.$emit('select', { id: 'mcptool:7:fixture_read', kind: 'mcp-tool', serverId: 7, serverName: 'Fixture MCP', toolName: 'fixture_read' })
    await nextTick()
    const add = w.findAll('button').find((b) => b.text() === 'Add MCP tool step')
    expect(add.attributes('disabled')).toBeDefined()
    await w.find('select').setValue('1')
    await add.trigger('click')
    expect(w.emitted('choose')[0][0]).toMatchObject({ item: { toolName: 'fixture_read' }, agent: { id: 1, name: 'Fixture agent' } })
  })

  it('has no Triggers tab when the new step is connected from an output', async () => {
    const { w } = picker({ ctx: { mode: 'from', source: { nodeId: 'a', handle: null } } })
    await w.setProps({ open: true })
    const tabs = w.findAll('.wfb-tab').map((b) => b.text())
    expect(tabs).not.toContain('Triggers')
    expect(tabs).toContain('Tools')
    expect(w.find('.dlg').attributes('data-title')).toBe('Add a connected step')
    expect(w.findAll('.item').some((b) => b.attributes('data-id').startsWith('node:trigger.'))).toBe(false)
  })

  it('says why the tools did not load, and tries again (F11)', async () => {
    const cat = catalog({ error: 'Could not load the tools (error 503).' })
    const { w } = picker({ catalog: cat })
    await w.setProps({ open: true })
    expect(w.find('[role="alert"]').text()).toContain('Could not load the tools (error 503).')
    cat.load.mockClear()
    await w.findAll('button').find((b) => b.text() === 'Try again').trigger('click')
    expect(cat.load).toHaveBeenCalledTimes(1)
  })

  it('the Tools tab lists the tools', async () => {
    const { w } = picker()
    await w.setProps({ open: true })
    await w.findAll('.wfb-tab').find((b) => b.text() === 'Tools').trigger('click')
    await flushPromises()
    expect(w.findAll('.item').map((b) => b.attributes('data-id'))).toEqual(['tool:SLACK_POST'])
  })
})
