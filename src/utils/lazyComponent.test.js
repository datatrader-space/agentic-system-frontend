// @vitest-environment jsdom
// F-C1: a lazy component that fails to load shows an error with Reload (never a blank area), and a
// stale chunk reloads the page once.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const reload = vi.hoisted(() => ({ fn: vi.fn(() => true) }))
vi.mock('@/services/chunkReload', async (orig) => ({ ...(await orig()), reloadOnceForChunkError: reload.fn }))

import { lazyComponent } from './lazyComponent'

beforeEach(() => { reload.fn.mockClear() })

const wait = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise((r) => setTimeout(r, 0)) } }

describe('lazyComponent', () => {
  it('renders the component when it loads', async () => {
    const C = lazyComponent(() => Promise.resolve(defineComponent({ render: () => h('p', 'loaded') })), { delay: 0 })
    const w = mount(defineComponent({ render: () => h('div', [h(C)]) }))
    await wait()
    expect(w.text()).toContain('loaded')
  })

  it('retries a failure once, then shows the error state with a Reload button (also inside Suspense)', async () => {
    const loader = vi.fn(() => Promise.reject(new Error('network down')))
    const C = lazyComponent(loader, { delay: 0 })
    const Host = defineComponent({ render: () => h(Suspense, { timeout: 0 }, { default: () => h(C), fallback: () => h('i', 'fallback') }) })
    const w = mount(Host)
    await wait()
    expect(loader).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain("didn't load")
    expect(w.find('button').text()).toBe('Reload')
    expect(reload.fn).not.toHaveBeenCalled()
  })

  it('a stale chunk asks for the one guarded reload instead of retrying', async () => {
    const loader = vi.fn(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/X.js')))
    const C = lazyComponent(loader, { delay: 0 })
    mount(C)
    await wait()
    expect(reload.fn).toHaveBeenCalledTimes(1)
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

// Every lazy component in the app goes through lazyComponent: a bare defineAsyncComponent has no
// error state, so a chunk that fails to load leaves a blank area.
describe('no bare defineAsyncComponent', () => {
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.(vue|js)$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [join(dir, e.name)] : [])
  it('outside utils/lazyComponent.js', () => {
    const src = resolve(process.cwd(), 'src')
    const bare = files(src).filter((f) => !f.endsWith(join('utils', 'lazyComponent.js')) && /defineAsyncComponent\s*\(/.test(readFileSync(f, 'utf8')))
    expect(bare).toEqual([])
  }, 30000)   // reads every source file: slow on a loaded machine
})
