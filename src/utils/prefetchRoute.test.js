import { describe, it, expect, vi } from 'vitest'
import { prefetchRoute, prefetchFromEvent } from './prefetchRoute'

function routerWith(loader) {
  return { resolve: () => ({ matched: [{ components: { default: loader } }] }) }
}

describe('prefetchRoute', () => {
  it('calls a lazy route loader once, however often the link is pointed at', () => {
    const loader = vi.fn(() => Promise.resolve({}))
    const router = routerWith(loader)
    prefetchRoute(router, '/dashboard/agents')
    prefetchRoute(router, '/dashboard/agents')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('ignores an already-resolved component object', () => {
    const router = routerWith({ name: 'Resolved' })
    expect(() => prefetchRoute(router, '/x')).not.toThrow()
  })

  it('forgets a failed prefetch so a later one can try again', async () => {
    const loader = vi.fn(() => Promise.reject(new Error('offline')))
    const router = routerWith(loader)
    prefetchRoute(router, '/x')
    await new Promise((r) => setTimeout(r, 0))
    prefetchRoute(router, '/x')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('only follows same-app links from a nav event', () => {
    const resolve = vi.fn(() => ({ matched: [] }))
    const router = { resolve }
    const link = (href) => ({ target: { closest: () => ({ getAttribute: () => href }) } })
    prefetchFromEvent(router, link('/dashboard/tools'))
    prefetchFromEvent(router, link('https://evil.example/'))
    prefetchFromEvent(router, link('//evil.example/'))
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledWith('/dashboard/tools')
  })
})
