/**
 * A Canvas project served out of the sandbox renders from a URL, not from srcdoc.
 *
 * A Next.js or React Canvas has a build step and a dev server, and its pages reference files that only
 * resolve over http — so there is nothing to put in an iframe's `srcdoc`. It renders the way the
 * storefront does, through `<iframe :src>`, while keeping none of the storefront's chrome.
 *
 * The URL arrives ON the event, a freshly SIGNED link (`https://{port}-{token}.{proxy}`). Signed, because
 * a token on the query authenticated only the page and not the stylesheets and scripts it loads (conv
 * 2118: a Next.js page with no CSS). On the event, because the backend served the project and signed the
 * link in the same call; fetching again would sign a second one and race the first. A reopened
 * conversation, or Refresh, asks for a new one.
 */
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import api from '../services/api'
import { useCanvasStore } from './useCanvasStore'

const URL_WITH_TOKEN = 'https://3000-k3j9x2signed.proxy.sandbox.aadml.com'

describe('a sandbox project canvas', () => {
  let canvas

  beforeEach(() => {
    setActivePinia(createPinia())
    canvas = useCanvasStore()
    canvas.loadArtifact = vi.fn()
    canvas.loadPreviewUrl = vi.fn()
    canvas.refreshMeta = vi.fn()
  })

  const ready = (extra = {}) => canvas.handleEvent({
    type: 'preview_ready',
    canvas_id: 'c1',
    canvas_type: 'static',
    provider: 'sandbox',
    url: URL_WITH_TOKEN,
    revision: 3,
    project_type: 'node',
    first: true,
    ...extra,
  })

  it('is recognised as its own provider', () => {
    ready()
    expect(canvas.provider).toBe('sandbox')
  })

  it('takes the preview url straight off the event', () => {
    ready()
    expect(canvas.previewUrl).toBe(URL_WITH_TOKEN)
    expect(canvas.status).toBe('live')
  })

  it('does not fetch a second url', () => {
    // A second mint would race the token the event already carries.
    ready()
    expect(canvas.loadPreviewUrl).not.toHaveBeenCalled()
  })

  it('does not load an artifact into srcdoc', () => {
    // There is no single document to load; the project is many files behind a dev server.
    ready()
    expect(canvas.loadArtifact).not.toHaveBeenCalled()
  })

  it('renders through a url rather than srcdoc', () => {
    ready()
    expect(canvas.capabilities.crossOrigin).toBe(true)
  })

  it('offers no storefront chrome', () => {
    ready()
    expect(canvas.capabilities.routeSelector).toBe(false)
    expect(canvas.capabilities.publish).toBe(false)
    expect(canvas.capabilities.storeInfo).toBe(false)
  })

  it('offers no code inspector, because the files live in the sandbox', () => {
    ready()
    expect(canvas.capabilities.codeTabs).toBe(false)
    expect(canvas.capabilities.tabs).toEqual(['Preview'])
  })

  it('offers no element selection, because it has no bridge', () => {
    // Neither bridge fits: no srcdoc to inject into, and the served app answers no `arm` handshake.
    ready()
    expect(canvas.capabilities.select).toBe(false)
  })

  it('opens the panel on the first preview', () => {
    ready()
    expect(canvas.open).toBe(true)
  })

  it('keeps the revision, so the work is attributable to a save', () => {
    ready()
    expect(canvas.activeRevision).toBe(3)
  })

  it('says so when the url is missing rather than showing an empty frame', () => {
    ready({ url: '' })
    expect(canvas.status).toBe('error')
    expect(canvas.previewError).toBeTruthy()
  })

  it('refreshes in place on a later update', () => {
    ready()
    const next = URL_WITH_TOKEN.replace('k3j9x2signed', 'p7q2m4signed')
    canvas.handleEvent({
      type: 'preview_updated', canvas_id: 'c1', provider: 'sandbox', url: next, revision: 4,
    })
    // A link expires, so a later event carries a NEW one and it has to win — a remembered one is a
    // credential that died without saying so.
    expect(canvas.previewUrl).toBe(next)
    expect(canvas.activeRevision).toBe(4)
  })
})

describe('the other providers are untouched', () => {
  let canvas

  beforeEach(() => {
    setActivePinia(createPinia())
    canvas = useCanvasStore()
    canvas.loadArtifact = vi.fn()
    canvas.loadPreviewUrl = vi.fn()
    canvas.refreshMeta = vi.fn()
  })

  it('a static canvas still renders from srcdoc', () => {
    canvas.handleEvent({ type: 'preview_ready', canvas_id: 'c2', provider: 'static', revision: 1 })
    expect(canvas.provider).toBe('static')
    expect(canvas.capabilities.crossOrigin).toBe(false)
    expect(canvas.loadArtifact).toHaveBeenCalled()
  })

  it('a storefront canvas still fetches its signed url', () => {
    canvas.handleEvent({ type: 'preview_ready', canvas_id: 'c3', provider: 'web_builder' })
    expect(canvas.provider).toBe('web_builder')
    expect(canvas.loadPreviewUrl).toHaveBeenCalled()
  })
})

describe('the store remembers what the served project is', () => {
  // Conv 2106 (2026-09-29): the footer called a Next.js app "index.html · HTML Document" because nothing
  // told it otherwise. The event now names the framework, file count and port, and the store keeps them.
  let canvas
  beforeEach(() => {
    setActivePinia(createPinia())
    canvas = useCanvasStore()
    canvas.loadArtifact = vi.fn()
    canvas.loadPreviewUrl = vi.fn()
    canvas.refreshMeta = vi.fn()
  })

  it('keeps the framework, file count and port', () => {
    canvas.handleEvent({ type: 'preview_ready', canvas_id: 'c1', canvas_type: 'static', provider: 'sandbox',
      url: URL_WITH_TOKEN, revision: 3, project_type: 'node', framework: 'Next.js', file_count: 6, port: 3000,
      first: true })
    expect(canvas.project).toEqual({ type: 'node', framework: 'Next.js', fileCount: 6, port: 3000 })
  })

  it('an older event without the new fields keeps what it knew', () => {
    canvas.handleEvent({ type: 'preview_ready', canvas_id: 'c1', provider: 'sandbox', url: URL_WITH_TOKEN,
      project_type: 'node', framework: 'Next.js', file_count: 6, port: 3000, first: true })
    canvas.handleEvent({ type: 'preview_updated', canvas_id: 'c1', provider: 'sandbox', url: URL_WITH_TOKEN })
    expect(canvas.project.framework).toBe('Next.js')
    expect(canvas.project.fileCount).toBe(6)
  })
})

describe('a sandbox project gets a fresh link whenever it is looked at again', () => {
  // The link from the turn that built the project expires, and its sandbox parks. Before this, a reopened
  // conversation did not know its Canvas was a sandbox project at all and rendered the stored source files.
  const SIGNED = 'https://3000-z9y8x7signed.proxy.sandbox.aadml.com'
  let canvas

  beforeEach(() => {
    setActivePinia(createPinia())
    canvas = useCanvasStore()
    canvas.loadArtifact = vi.fn()
    canvas.refreshMeta = vi.fn()
    canvas.loadBuilderVersions = vi.fn()
    api.get.mockReset()
  })

  const answers = (canvasBody, previewBody) => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/conversations/')) return Promise.resolve({ data: { canvas: canvasBody } })
      if (path.startsWith('/canvas/')) return Promise.resolve({ data: previewBody })
      return Promise.reject(new Error(`unexpected ${path}`))
    })
  }

  it('a reopened conversation asks for a new link instead of rendering the stored files', async () => {
    answers(
      { canvas_id: 'c1', canvas_type: 'static', provider: 'sandbox', status: 'live', active_revision: 2,
        project: { type: 'node', framework: 'Next.js', file_count: 7, port: 3000 } },
      { canvas_id: 'c1', provider: 'sandbox', url: SIGNED, expires_at: '2099-01-01T00:00:00Z', port: 3000 })
    await canvas.adoptConversation(2118)
    expect(api.get).toHaveBeenCalledWith('/canvas/c1/preview/', expect.anything())
    expect(canvas.previewUrl).toBe(SIGNED)
    expect(canvas.previewExpiresAt).toBe('2099-01-01T00:00:00Z')
    expect(canvas.project).toMatchObject({ framework: 'Next.js', fileCount: 7, port: 3000 })
    expect(canvas.loadArtifact).not.toHaveBeenCalled()
  })

  it('a project that cannot come back says why, with a way to retry', async () => {
    api.get.mockImplementation((path) => (path.startsWith('/conversations/')
      ? Promise.resolve({ data: { canvas: { canvas_id: 'c1', provider: 'sandbox', status: 'live' } } })
      : Promise.reject({ response: { data: { error: "The project preview couldn't be opened: no answer" } } })))
    await canvas.adoptConversation(2118)
    expect(canvas.previewUrl).toBe('')
    expect(canvas.status).toBe('error')
    expect(canvas.previewError).toContain("couldn't be opened")
  })

  it('refresh signs a new link rather than reloading an expired one', () => {
    canvas.loadPreviewUrl = vi.fn()
    canvas.provider = 'sandbox'
    canvas.refreshPreview()
    expect(canvas.loadPreviewUrl).toHaveBeenCalled()
  })

  it('an expired link is replaced when the panel is opened', () => {
    canvas.loadPreviewUrl = vi.fn()
    Object.assign(canvas, { canvasId: 'c1', provider: 'sandbox', previewUrl: SIGNED,
      previewExpiresAt: '2000-01-01T00:00:00Z' })
    canvas.show()
    expect(canvas.open).toBe(true)
    expect(canvas.loadPreviewUrl).toHaveBeenCalled()
  })

  it('a live link is left alone when the panel is opened', () => {
    canvas.loadPreviewUrl = vi.fn()
    Object.assign(canvas, { canvasId: 'c1', provider: 'sandbox', previewUrl: SIGNED,
      previewExpiresAt: '2099-01-01T00:00:00Z' })
    canvas.show()
    expect(canvas.loadPreviewUrl).not.toHaveBeenCalled()
  })

  it('the event records when its link expires', () => {
    canvas.handleEvent({ type: 'preview_ready', canvas_id: 'c1', provider: 'sandbox', url: SIGNED,
      expires_at: '2099-01-01T00:00:00Z', first: true })
    expect(canvas.previewExpiresAt).toBe('2099-01-01T00:00:00Z')
  })

  it('a link that arrives after the person moved to another canvas is dropped', async () => {
    let release
    api.get.mockImplementation(() => new Promise((resolve) => { release = resolve }))
    Object.assign(canvas, { canvasId: 'c1', provider: 'sandbox', previewUrl: '' })
    const pending = canvas.loadPreviewUrl()
    canvas.canvasId = 'c2'
    release({ data: { provider: 'sandbox', url: SIGNED, port: 3000 } })
    await pending
    expect(canvas.previewUrl).toBe('')
  })
})
