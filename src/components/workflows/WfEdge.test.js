// @vitest-environment jsdom
// A connection: the middle + inserts a step, the delete button removes it, a run colours it (ADM-1333 plan §3.2).
import { describe, it, expect, vi } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('@/utils/wfFlow', () => ({
  BaseEdge: { name: 'BaseEdge', props: ['id', 'path', 'markerEnd', 'interactionWidth'], render() { return h('path', { class: 'base-edge', d: this.path }) } },
  EdgeLabelRenderer: { name: 'EdgeLabelRenderer', render() { return h('div', { class: 'labels' }, this.$slots.default?.()) } },
  getBezierPath: () => ['M 0 0 C 1 1 2 2 3 3', 50, 60],
}))
const { default: WfEdge } = await import('./WfEdge.vue')
const { WF_CANVAS } = await import('./wfCanvasContext')

function edge(view = {}, props = {}) {
  const ctx = {
    edgeView: () => ({ ghost: false, readOnly: false, ran: false, items: null, mark: null, hunk: null, ...view }),
    pick: vi.fn(), remove: vi.fn(), accept: vi.fn(), reject: vi.fn(),
  }
  const w = mount(WfEdge, {
    props: { id: 'e_a_b', source: 'a', target: 'b', sourceX: 0, sourceY: 0, targetX: 300, targetY: 0, ...props },
    global: { provide: { [WF_CANVAS]: ctx }, stubs: { Icon: true } },
  })
  return { w, ctx }
}

describe('WfEdge', () => {
  it('has a 40 px hover target', () => {
    expect(edge().w.find('.wf-edge-hit').attributes('stroke-width')).toBe('40')
  })

  it('the middle + inserts a step into this connection', async () => {
    const { w, ctx } = edge()
    const plus = w.find('[aria-label="Insert a step between a and b"]')
    expect(plus.classes()).toContain('wf-edge-btn')
    expect(w.find('.wf-edge-mid').classes()).toEqual(expect.arrayContaining(['nodrag', 'nopan']))
    await plus.trigger('click')
    expect(ctx.pick).toHaveBeenCalledWith({ mode: 'insert', edgeId: 'e_a_b' })
  })

  it('delete goes through the canvas (one delete path, D1 rule 7)', async () => {
    const { w, ctx } = edge()
    await w.find('[aria-label="Delete the connection from a to b"]').trigger('click')
    expect(ctx.remove).toHaveBeenCalledWith({ edgeIds: ['e_a_b'] })
  })

  it('shows its buttons on hover', async () => {
    const { w } = edge()
    expect(w.find('.wf-edge-mid').classes()).not.toContain('is-open')
    await w.find('.wf-edge-hit').trigger('pointerenter')
    expect(w.find('.wf-edge-mid').classes()).toContain('is-open')
  })

  it('is drawn in the success colour after a run, with the item count', () => {
    const { w } = edge({ ran: true, items: 3 })
    expect(w.find('.base-edge').classes()).toContain('is-ran')
    expect(w.find('.wf-edge-items').text()).toBe('3 items')
  })

  it('a backwards connection loops under its source', () => {
    const { w } = edge({}, { sourceX: 500, targetX: 100, sourceY: 10, targetY: 10 })
    expect(w.find('.base-edge').attributes('d')).toMatch(/^M 500 10 C 564 10/)
  })

  it('a proposed connection offers Accept and Reject instead of + and delete', async () => {
    const { w, ctx } = edge({ ghost: true, mark: 'add', hunk: 2 })
    expect(w.find('.wf-edge-btn').exists()).toBe(false)
    await w.find('.wf-hunk-btn.is-accept').trigger('click')
    expect(ctx.accept).toHaveBeenCalledWith(2)
  })
})
