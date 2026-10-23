// F-M1: a param watcher fires only for this page's own route, never on the way out.
import { describe, it, expect, vi } from 'vitest'
import { reactive, nextTick } from 'vue'
import { watchOwnRouteParam, isOwnParamChange } from './useOwnRouteParam'

describe('watchOwnRouteParam', () => {
  it('reloads when the id changes on this page', async () => {
    const route = reactive({ name: 'agent-monitor', params: { id: '1' } })
    const cb = vi.fn()
    watchOwnRouteParam('id', cb, route)
    route.params.id = '2'
    await nextTick()
    expect(cb).toHaveBeenCalledWith('2', '1')
  })

  it('does nothing when leaving (id becomes undefined)', async () => {
    const route = reactive({ name: 'agent-monitor', params: { id: '1' } })
    const cb = vi.fn()
    watchOwnRouteParam('id', cb, route)
    route.name = 'dashboard-chat'
    route.params = {}
    await nextTick()
    expect(cb).not.toHaveBeenCalled()
  })

  it("does nothing when the NEXT page has a param of the same name", async () => {
    const route = reactive({ name: 'help-article', params: { slug: 'a' } })
    const cb = vi.fn()
    watchOwnRouteParam('slug', cb, route)
    route.name = 'blog-post'
    route.params = { slug: 'b' }
    await nextTick()
    expect(cb).not.toHaveBeenCalled()
  })

  it('isOwnParamChange ignores same value', () => {
    expect(isOwnParamChange({ name: 'x' }, 'x', 5, '5')).toBe(false)
  })
})
