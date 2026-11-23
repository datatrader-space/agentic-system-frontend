// @vitest-environment jsdom
// The step card: run state to look and words, the badge line, and the outputs' + buttons (ADM-1333 plan §3.2, F13).
import { describe, it, expect, vi } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('@vue-flow/core', () => ({
  Handle: { name: 'Handle', props: ['id', 'type', 'position', 'connectable'], render() { return h('span', { class: ['vf-handle', `vf-handle--${this.type}`], 'data-handle': this.id ?? '' }) } },
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}))
vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', props: ['icon'], render() { return h('i', { 'data-icon': this.icon }) } },
}))
vi.mock('@vue-flow/node-toolbar', () => ({
  NodeToolbar: { name: 'NodeToolbar', props: ['isVisible', 'position', 'offset'], render() { return this.isVisible ? h('div', { class: 'vf-toolbar' }, this.$slots.default?.()) : null } },
}))

const { default: WfNode } = await import('./WfNode.vue')
const { WF_CANVAS } = await import('./wfCanvasContext')

function ctxWith(view = {}, extra = {}) {
  return {
    nodeView: () => ({ state: 'configured', issue: '', error: '', mark: null, hunk: null, ghost: false, readOnly: false, running: false, connected: new Set(), ...view }),
    edgeView: () => ({}),
    singleSelected: () => false,
    open: vi.fn(), pick: vi.fn(), testUntil: vi.fn(), rename: vi.fn(), duplicate: vi.fn(), remove: vi.fn(), accept: vi.fn(), reject: vi.fn(),
    ...extra,
  }
}
function card(props, ctx = ctxWith()) {
  return { w: mount(WfNode, { props: { id: 'n1', ...props }, global: { provide: { [WF_CANVAS]: ctx } } }), ctx }
}

describe('WfNode', () => {
  it('shows a title and ONE badge line, never fields', () => {
    const { w } = card({ type: 'llm.call', data: { label: 'Summarise', prompt: 'p', model_id: 'gpt-x' } })
    expect(w.find('.wf-node__title').text()).toBe('Summarise')
    expect(w.find('.wf-node__badge').text()).toBe('gpt-x')
    expect(w.findAll('input, textarea, select')).toHaveLength(0)
  })

  it('says "Needs setup" with an icon, not by colour alone', () => {
    const { w } = card({ type: 'agent.run', data: {} }, ctxWith({ state: 'idle' }))
    const badge = w.find('.wf-node__badge')
    expect(badge.text()).toBe('Needs setup')
    expect(badge.classes()).toContain('is-setup')
    expect(badge.find('[data-icon="lucide:circle-dashed"]').exists()).toBe(true)
  })

  it.each([
    ['queued', 'lucide:clock'], ['running', 'lucide:loader-circle'], ['waiting', 'lucide:hand'],
    ['succeeded', 'lucide:circle-check'], ['failed', 'lucide:circle-alert'], ['skipped', 'lucide:circle-slash'],
    ['cancelled', 'lucide:ban'], ['invalid', 'lucide:circle-alert'],
  ])('draws the %s state with its ring class and its icon', (state, icon) => {
    const { w } = card({ type: 'action.http', data: { url: 'https://x' } }, ctxWith({ state }))
    expect(w.find('.wf-node').classes()).toContain(`is-${state}`)
    expect(w.find(`.wf-node__status [data-icon="${icon}"]`).exists()).toBe(true)
  })

  it('shows no corner badge for idle or ready steps', () => {
    const { w } = card({ type: 'action.http', data: { url: 'https://x' } })
    expect(w.find('.wf-node__status').exists()).toBe(false)
  })

  it('puts the error on the status badge title', () => {
    const { w } = card({ type: 'action.http', data: { url: 'x' } }, ctxWith({ state: 'failed', error: 'HTTP 500' }))
    expect(w.find('.wf-node__status').attributes('title')).toBe('Failed: HTTP 500')
  })

  it('a condition has labelled true and false outputs whose + carries the handle (F13)', () => {
    const { w, ctx } = card({ type: 'logic.condition', data: { expression: 'a == b' } })
    expect(w.findAll('.vf-handle--source').map((x) => x.attributes('data-handle'))).toEqual(['true', 'false'])
    expect(w.findAll('.wf-h-label').map((x) => x.text())).toEqual(['true', 'false'])
    w.find('.wf-plus--false').trigger('click')
    expect(ctx.pick).toHaveBeenCalledWith({ mode: 'from', source: { nodeId: 'n1', handle: 'false' } })
  })

  it('hides the + of an output that is already connected', () => {
    const { w } = card({ type: 'logic.condition', data: { expression: 'x' } }, ctxWith({ connected: new Set(['true']) }))
    expect(w.find('.wf-plus--true').exists()).toBe(false)
    expect(w.find('.wf-plus--false').exists()).toBe(true)
  })

  it('shows the error output only on step types that retry', () => {
    expect(card({ type: 'action.http', data: { url: 'x' } }).w.find('[data-handle="error"]').exists()).toBe(true)
    expect(card({ type: 'logic.condition', data: { expression: 'x' } }).w.find('[data-handle="error"]').exists()).toBe(false)
    expect(card({ type: 'llm.call', data: { prompt: 'p' } }).w.find('[data-handle="error"]').exists()).toBe(false)
  })

  it('a trigger has no input', () => {
    const { w } = card({ type: 'trigger.manual', data: {} })
    expect(w.find('.vf-handle--target').exists()).toBe(false)
    expect(w.find('.wf-node').classes()).toContain('is-trigger')
  })

  it('a proposed step is a ghost: no +, no toolbar, with Accept and Reject', async () => {
    const { w, ctx } = card({ type: 'logic.delay', data: { seconds: 1 } }, ctxWith({ ghost: true, mark: 'add', hunk: 3 }))
    expect(w.find('.wf-node').classes()).toEqual(expect.arrayContaining(['is-ghost', 'mark-add']))
    expect(w.find('.wf-plus').exists()).toBe(false)
    expect(w.find('.wf-node__mark').text()).toBe('+')
    await w.find('.wf-hunk-btn.is-accept').trigger('click')
    await w.find('.wf-hunk-btn.is-reject').trigger('click')
    expect(ctx.accept).toHaveBeenCalledWith(3)
    expect(ctx.reject).toHaveBeenCalledWith(3)
  })

  it('a step the proposal removes is outlined with "−"', () => {
    const { w } = card({ type: 'logic.delay', data: { seconds: 1 } }, ctxWith({ mark: 'remove', hunk: 0 }))
    expect(w.find('.wf-node').classes()).toContain('mark-remove')
    expect(w.find('.wf-node__mark').text()).toBe('−')
  })

  it('the hover toolbar opens, tests up to here and deletes through the canvas', async () => {
    const { w, ctx } = card({ type: 'action.http', data: { label: 'Fetch', url: 'x' } })
    await w.find('.wf-node').trigger('mouseenter')
    const bar = w.find('.vf-toolbar')
    expect(bar.exists()).toBe(true)
    await bar.find('[aria-label="Open Fetch"]').trigger('click')
    await bar.find('[aria-label="Test up to Fetch"]').trigger('click')
    await bar.find('[aria-label="Delete Fetch"]').trigger('click')
    expect(ctx.open).toHaveBeenCalledWith('n1')
    expect(ctx.testUntil).toHaveBeenCalledWith('n1')
    expect(ctx.remove).toHaveBeenCalledWith({ nodeIds: ['n1'] })
    expect(bar.findAll('button').every((b) => b.attributes('aria-label'))).toBe(true)
  })

  it('read only (ADM-1339): a runner gets Open and Test up to here, a viewer only Open; no + and no edit', async () => {
    for (const [canRun, labels] of [[true, ['Open Fetch', 'Test up to Fetch']], [false, ['Open Fetch']]]) {
      const { w } = card({ type: 'action.http', data: { label: 'Fetch', url: 'x' } }, ctxWith({ readOnly: true, canRun }))
      await w.find('.wf-node').trigger('mouseenter')
      expect(w.find('.vf-toolbar').findAll('button').map((b) => b.attributes('aria-label'))).toEqual(labels)
      expect(w.findAll('.wf-plus')).toHaveLength(0)
      w.unmount()
    }
  })
})
