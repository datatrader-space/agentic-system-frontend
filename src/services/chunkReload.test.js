// @vitest-environment jsdom
// F-C1: a stale chunk after a deploy reloads the page ONCE, and can never loop.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isChunkLoadError, reloadOnceForChunkError, installChunkReload, CHUNK_RELOAD_KEY, RELOAD_WINDOW_MS } from './chunkReload'

beforeEach(() => { sessionStorage.clear() })

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://aadml.com/assets/ChatWorkspace-abc.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
  ])('recognises "%s"', (msg) => { expect(isChunkLoadError(new TypeError(msg))).toBe(true) })

  it('ignores ordinary errors', () => {
    expect(isChunkLoadError(new Error('Request failed with status code 500'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})

describe('reloadOnceForChunkError', () => {
  it('reloads to the target path the first time', () => {
    const assign = vi.fn()
    expect(reloadOnceForChunkError('/dashboard/agents', { now: 1000, assign })).toBe(true)
    expect(assign).toHaveBeenCalledWith('/dashboard/agents')
    expect(JSON.parse(sessionStorage.getItem(CHUNK_RELOAD_KEY))).toEqual({ at: 1000, path: '/dashboard/agents' })
  })

  it('does not reload again inside the window (no loop)', () => {
    const assign = vi.fn()
    reloadOnceForChunkError('/a', { now: 1000, assign })
    expect(reloadOnceForChunkError('/a', { now: 1000 + RELOAD_WINDOW_MS - 1, assign })).toBe(false)
    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('recovers again after the window (a later deploy)', () => {
    const assign = vi.fn()
    reloadOnceForChunkError('/a', { now: 1000, assign })
    expect(reloadOnceForChunkError('/b', { now: 1000 + RELOAD_WINDOW_MS + 1, assign })).toBe(true)
    expect(assign).toHaveBeenLastCalledWith('/b')
  })

  it('never navigates to another origin', () => {
    const assign = vi.fn()
    reloadOnceForChunkError('//evil.example/x', { now: 1, assign })
    expect(assign.mock.calls[0][0].startsWith('/')).toBe(true)
    expect(assign.mock.calls[0][0].startsWith('//')).toBe(false)
  })
})

describe('installChunkReload', () => {
  it('reloads to the failed navigation target from router.onError, once', () => {
    let handler
    const router = { onError: (fn) => { handler = fn } }
    const assign = vi.fn()
    const loc = window.location
    delete window.location
    window.location = { pathname: '/dashboard', search: '', hash: '', assign }
    try {
      installChunkReload(router)
      handler(new TypeError('Failed to fetch dynamically imported module: /assets/X.js'), { fullPath: '/dashboard/tools' })
      handler(new TypeError('Failed to fetch dynamically imported module: /assets/X.js'), { fullPath: '/dashboard/tools' })
      handler(new Error('something else'), { fullPath: '/dashboard/other' })
      expect(assign).toHaveBeenCalledTimes(1)
      expect(assign).toHaveBeenCalledWith('/dashboard/tools')
    } finally {
      window.location = loc
    }
  })
})
