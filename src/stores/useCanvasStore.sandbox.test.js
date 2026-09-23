/**
 * A Canvas project served out of the sandbox renders from a URL, not from srcdoc.
 *
 * A Next.js or React Canvas has a build step and a dev server, and its pages reference files that only
 * resolve over http — so there is nothing to put in an iframe's `srcdoc`. It renders the way the
 * storefront does, through `<iframe :src>`, while keeping none of the storefront's chrome.
 *
 * The URL arrives ON the event, already carrying a freshly minted access token. That matters: unlike
 * web_builder there is nothing to fetch, because the backend served the project and minted the token in
 * the same call that produced the event. Fetching again would mint a second token and race the first.
 */
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasStore } from './useCanvasStore'

const URL_WITH_TOKEN =
  'https://3000-sbx.proxy.sandbox.aadml.com/?NORTHRAYS_SANDBOX_AUTH_KEY=tok-live'

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
    const next = URL_WITH_TOKEN.replace('tok-live', 'tok-rotated')
    canvas.handleEvent({
      type: 'preview_updated', canvas_id: 'c1', provider: 'sandbox', url: next, revision: 4,
    })
    // The token rotates when a sandbox stops and starts, so a later event carries a NEW url and it
    // has to win — a remembered one is a credential that died without saying so.
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
