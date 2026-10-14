/**
 * The Canvas never frames agent-written code with this app's origin (security audit H-28).
 *
 * The preview frame for a project runs with `allow-same-origin`, which isolates it only while the URL is
 * on ANOTHER origin, so a preview URL on this app's own origin, or not https, is refused rather than framed.
 * The legacy `srcdoc` frame inherits this app's origin whatever it loads, so it has no `allow-same-origin`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import { useCanvasStore } from './useCanvasStore'

describe('a preview URL must be a separate origin', () => {
  let canvas

  beforeEach(() => {
    vi.stubGlobal('window', { location: new URL('https://aadml.com/dashboard') })
    setActivePinia(createPinia())
    canvas = useCanvasStore()
    canvas.loadArtifact = vi.fn()
    canvas.loadPreviewUrl = vi.fn()
    canvas.refreshMeta = vi.fn()
  })

  const ready = (url) => canvas.handleEvent({
    type: 'preview_ready', canvas_id: 'c1', canvas_type: 'static', provider: 'sandbox', url, revision: 1,
  })

  it('accepts the signed sandbox proxy link', () => {
    ready('https://3000-k3j9x2signed.proxy.sandbox.aadml.com')
    expect(canvas.previewUrl).toBe('https://3000-k3j9x2signed.proxy.sandbox.aadml.com')
  })

  it('refuses a link on this app\'s own origin', () => {
    ready('https://aadml.com/api/canvas/c1/artifact/')
    expect(canvas.previewUrl).toBe('')
  })

  it('refuses a relative link, which would resolve to this app', () => {
    ready('/api/anything')
    expect(canvas.previewUrl).toBe('')
  })

  it('refuses a script URL', () => {
    ready('javascript:alert(1)')
    expect(canvas.previewUrl).toBe('')
  })
})

describe('the legacy srcdoc frame', () => {
  it('does not run with this app\'s origin', () => {
    const src = readFileSync(resolve(__dirname, '../components/canvas/CanvasShell.vue'), 'utf8')
    const frame = src.slice(src.indexOf(':srcdoc="frameHtml"'), src.indexOf('title="Design preview"'))
    expect(frame).toContain('sandbox="allow-scripts')
    expect(frame).not.toContain('allow-same-origin')
  })
})
