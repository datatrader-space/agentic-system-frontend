// @vitest-environment jsdom
// ADM-1363: a Data table step routes by exists / missing while its operation is Exists, like a condition's true /
// false: the card draws one output per branch (each with its + button), a step added after it connects to its first
// branch, and every other operation keeps the one plain output. Also the Data steps' card lines.
import { describe, it, expect, vi } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { WF_CATEGORIES, wfBranchHandles, wfCategory, wfDef, wfIcon } from '@/config/wfNodeDefinitions'
import { nodeConfigPreview, nodeIsConfigured } from '@/utils/wfNodeView'
import { connectOps } from './wfPickerItems'

vi.mock('@vue-flow/core', () => ({
  Handle: { name: 'Handle', props: ['id', 'type', 'position', 'connectable'], render() { return h('span', { class: ['vf-handle', `vf-handle--${this.type}`], 'data-handle': this.id ?? '' }) } },
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}))
vi.mock('@iconify/vue', () => ({ Icon: { name: 'Icon', props: ['icon'], render() { return h('i', { 'data-icon': this.icon }) } } }))
vi.mock('@vue-flow/node-toolbar', () => ({ NodeToolbar: { name: 'NodeToolbar', render() { return null } } }))

const { default: WfNode } = await import('./WfNode.vue')
const { WF_CANVAS } = await import('./wfCanvasContext')

function ctxWith(view = {}) {
  return {
    nodeView: () => ({ state: 'configured', issue: '', error: '', mark: null, hunk: null, ghost: false, readOnly: false, running: false, connected: new Set(), ...view }),
    edgeView: () => ({}), singleSelected: () => false,
    open: vi.fn(), pick: vi.fn(), testUntil: vi.fn(), rename: vi.fn(), duplicate: vi.fn(), remove: vi.fn(), toggleOff: vi.fn(), accept: vi.fn(), reject: vi.fn(),
  }
}
const card = (props, ctx = ctxWith()) => ({ w: mount(WfNode, { props: { id: 'n1', ...props }, global: { provide: { [WF_CANVAS]: ctx } } }), ctx })
const sources = (w) => w.findAll('.vf-handle--source').map((x) => x.attributes('data-handle'))

describe('branch handles from the registry', () => {
  it('a condition always has true / false; a Data table step only while it is Exists', () => {
    expect(wfBranchHandles('logic.condition', {})).toEqual(['true', 'false'])
    expect(wfDef('data.table').branches).toEqual(['exists', 'missing'])
    expect(wfBranchHandles('data.table', { operation: 'exists' })).toEqual(['exists', 'missing'])
    expect(wfBranchHandles('data.table', { operation: 'get_rows' })).toEqual([])
    expect(wfBranchHandles('action.http', { operation: 'exists' })).toEqual([])
  })

  it('the card draws exists and missing outputs, each with its + that picks on that branch', async () => {
    const { w, ctx } = card({ type: 'data.table', data: { operation: 'exists', table: 1 } })
    expect(sources(w)).toEqual(['exists', 'missing'])
    expect(w.findAll('.wf-h-label').map((x) => x.text())).toEqual(['exists', 'missing'])
    const plus = w.find('button[aria-label="Add a step on the missing branch of Data table"]')
    await plus.trigger('click')
    expect(ctx.pick).toHaveBeenCalledWith({ mode: 'from', source: { nodeId: 'n1', handle: 'missing' } })
  })

  it('any other operation has the one plain output', () => {
    const { w } = card({ type: 'data.table', data: { operation: 'insert', table: 1 } })
    expect(sources(w)).toEqual([''])
  })

  it('a connection out of a deciding step keeps its branch; a new Exists step connects onward from "exists"', () => {
    const from = connectOps({ mode: 'from', source: { nodeId: 'd1', handle: 'missing' } }, { id: 'h1', type: 'action.http', data: {} }, [])
    expect(from.find((o) => o.op === 'add_edge').edge).toMatchObject({ source: 'd1', target: 'h1', sourceHandle: 'missing' })
    const exists = { id: 'd2', type: 'data.table', data: { operation: 'exists', table: 1 } }
    const into = connectOps({ mode: 'into', target: { nodeId: 'h1', handle: null } }, exists, [])
    expect(into.find((o) => o.op === 'add_edge').edge).toMatchObject({ source: 'd2', target: 'h1', sourceHandle: 'exists' })
    const insert = connectOps({ mode: 'into', target: { nodeId: 'h1', handle: null } }, { ...exists, data: { operation: 'insert' } }, [])
    expect(insert.find((o) => o.op === 'add_edge').edge.sourceHandle).toBeUndefined()
  })
})

describe('the Data steps on the canvas', () => {
  it('belong to the Data category, with their own icons', () => {
    expect(wfCategory('data.sql')).toBe('data')
    expect(WF_CATEGORIES.data.token).toBe('--wf-cat-data')
    expect(wfIcon('data.table')).toBe('lucide:table-2')
    expect(wfIcon('trigger.database')).toBe('lucide:database-zap')
  })

  it('need their table or connection before they are ready', () => {
    expect(nodeIsConfigured('data.table', { operation: 'insert', table: null })).toBe(false)
    expect(nodeIsConfigured('data.table', { operation: 'insert', table: 3 })).toBe(true)
    expect(nodeIsConfigured('data.sql', { connection: 1, operation: 'query', query: '' })).toBe(false)
    expect(nodeIsConfigured('data.sql', { connection: 1, operation: 'select', table: 'public.orders' })).toBe(true)
    expect(nodeIsConfigured('trigger.database', { connection: 1, table: 'orders', cursor_column: '' })).toBe(false)
    expect(nodeIsConfigured('data.redis', { connection: 1, operation: 'scan' })).toBe(true)
  })

  it('say what they do in one line', () => {
    expect(nodeConfigPreview('data.table', { operation: 'get_rows' })).toBe('Get rows')
    expect(nodeConfigPreview('data.table', { operation: 'exists' })).toBe('exists / missing')
    expect(nodeConfigPreview('trigger.table', { on: 'added_or_changed' })).toBe('A row is added or changed')
    expect(nodeConfigPreview('data.sql', { operation: 'select', table: 'public.orders' })).toBe('Select rows · public.orders')
    expect(nodeConfigPreview('data.mongo', { operation: 'find', collection: 'users' })).toBe('Find · users')
    expect(nodeConfigPreview('data.redis', { operation: 'scan', pattern: 'user:*' })).toBe('Find keys (SCAN) user:*')
    expect(nodeConfigPreview('trigger.database', { table: 'orders', every: 5 })).toBe('orders · every 5 min')
  })
})
