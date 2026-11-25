import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  startOpen, endOpen, noteApiResponse, noteApiError, noteLanguageServer, openProgress, progressLabel,
  prefetchWake, _setClock, _current, _resetPrefetch, PREFETCH_EVERY_MS, CHAT_WARM_EVERY_MS, EDITOR_WINDOW_MS,
} from './projectOpenTiming'

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }   // microtasks only (timers are fake)

function fakeApi(answer = { open_id: 'o-1', sandbox: 'parked' }) {
  return {
    startProjectOpen: vi.fn(() => Promise.resolve({ data: answer })),
    reportProjectOpen: vi.fn(() => Promise.resolve({ data: {} })),
    wakeProject: vi.fn(() => Promise.resolve({ data: { state: 'started' } })),
  }
}
const tree = (repo = 7, params = {}) => ({ url: `/systems/3/repositories/${repo}/files/`, params })
const content = (repo = 7) => ({ url: `/systems/3/repositories/${repo}/files/content/`, params: { path: 'a.js' } })
const sent = (api) => Object.assign({}, ...api.reportProjectOpen.mock.calls.map((c) => c[2].steps || {}))

describe('projectOpenTiming', () => {
  let t
  beforeEach(() => { t = 0; _setClock(() => t); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] }) })
  afterEach(() => { endOpen(); vi.useRealTimers(); _setClock(null); _resetPrefetch() })

  it('records each step once, after the click, and only for the project being opened', async () => {
    const api = fakeApi()
    startOpen({ repo_id: 7 }, api)
    t = 80; await vi.runOnlyPendingTimersAsync(); await flush()
    expect(api.startProjectOpen).toHaveBeenCalledWith(7)
    t = 500; noteApiResponse(tree(8))                       // another project's listing
    t = 900; noteApiResponse(tree(7, { path: 'src' }))      // a sub-folder is not the tree
    t = 1200; noteApiResponse(tree(7))
    t = 1300; noteApiResponse(tree(7))
    t = 1900; noteApiResponse(content(7))
    t = 4000; noteLanguageServer('wss://x/ws/lets-code/7/lsp/typescript/')
    await vi.runOnlyPendingTimersAsync()
    expect(sent(api)).toEqual({ project_api: 80, sandbox_ready: 900, tree: 1200, editor: 1900, language_server: 4000 })
    expect(api.reportProjectOpen.mock.calls.every((c) => c[0] === 7 && c[1] === 'o-1')).toBe(true)
  })

  it('a file opened long after the tree is not the editor answering', async () => {
    const api = fakeApi()
    startOpen({ repo_id: 7 }, api); await flush()
    t = 1000; noteApiResponse(tree(7))
    t = 1000 + EDITOR_WINDOW_MS + 1; noteApiResponse(content(7))
    await vi.runOnlyPendingTimersAsync()
    expect(sent(api).editor).toBeUndefined()
  })

  it('shows what it waits for while not ready, then nothing', async () => {
    const api = fakeApi({ open_id: 'o-2', sandbox: 'awake' })
    startOpen({ repo_id: 7 }, api); await flush()
    expect(progressLabel(openProgress.value)).toBe('')               // nothing for the first second
    t = 2400; vi.advanceTimersByTime(1000)
    expect(openProgress.value).toMatchObject({ repoId: 7, phase: 'files', seconds: 2 })
    expect(progressLabel(openProgress.value)).toBe('Loading the files…')
    noteApiError({ config: tree(7), response: { status: 503, data: { code: 'RUNNER_STARTING' } } })
    expect(progressLabel(openProgress.value)).toBe('Loading the files…')   // an awake sandbox's first answer: files
    noteApiResponse(tree(7))
    expect(openProgress.value).toBeNull()
  })

  it('a parked sandbox reads as waking until a file request answers', async () => {
    startOpen({ repo_id: 7 }, fakeApi()); await flush()
    t = 5000; vi.advanceTimersByTime(1000)
    expect(progressLabel(openProgress.value)).toBe("Waking the project's sandbox…")
  })

  it('leaving before ready, or the tree failing, ends the open with that outcome', async () => {
    const api = fakeApi()
    startOpen({ repo_id: 7 }, api); await flush()
    endOpen()
    expect(api.reportProjectOpen).toHaveBeenLastCalledWith(7, 'o-1', expect.objectContaining({ outcome: 'left' }))
    expect(_current()).toBeNull()
    const api2 = fakeApi({ open_id: 'o-3', sandbox: 'awake' })
    startOpen({ repo_id: 7 }, api2); await flush()
    noteApiError({ config: tree(7), response: { status: 500, data: {} } })
    expect(api2.reportProjectOpen).toHaveBeenLastCalledWith(7, 'o-3', expect.objectContaining({ outcome: 'error' }))
  })

  it('an open the server did not record sends nothing and never breaks the page', async () => {
    const api = fakeApi()
    api.startProjectOpen = vi.fn(() => Promise.reject(new Error('409')))
    startOpen({ repo_id: 7 }, api); await flush()
    noteApiResponse(tree(7))
    await vi.runOnlyPendingTimersAsync()
    expect(api.reportProjectOpen).not.toHaveBeenCalled()
  })

  it('the hover asks for a wake once per project in a while', () => {
    const api = fakeApi()
    expect(prefetchWake({ repo_id: 7 }, api, 1000)).toBe(true)
    expect(prefetchWake({ repo_id: 7 }, api, 2000)).toBe(false)
    expect(prefetchWake({ repo_id: 9 }, api, 2000)).toBe(true)
    expect(prefetchWake({ repo_id: 7 }, api, 1000 + PREFETCH_EVERY_MS)).toBe(true)
    expect(api.wakeProject.mock.calls).toEqual([[7], [9], [7]])
    expect(prefetchWake({}, api)).toBe(false)
  })

  it('the chat warms with the same helper, at most once a minute per project; a hover just before counts', () => {
    const api = fakeApi()
    expect(prefetchWake({ repo_id: 7 }, api, 1000, CHAT_WARM_EVERY_MS)).toBe(true)
    expect(prefetchWake({ repo_id: 7 }, api, 1000 + CHAT_WARM_EVERY_MS - 1, CHAT_WARM_EVERY_MS)).toBe(false)
    expect(prefetchWake({ repo_id: 7 }, api, 1000 + CHAT_WARM_EVERY_MS, CHAT_WARM_EVERY_MS)).toBe(true)
    expect(api.wakeProject).toHaveBeenCalledTimes(2)
  })

  it('a wake that fails or throws never reaches the page', () => {
    const throws = { wakeProject: vi.fn(() => { throw new Error('offline') }) }
    expect(() => prefetchWake({ repo_id: 11 }, throws, 1)).not.toThrow()
    const rejects = { wakeProject: vi.fn(() => Promise.reject(new Error('429'))) }
    expect(prefetchWake({ repo_id: 12 }, rejects, 1)).toBe(true)
  })
})
