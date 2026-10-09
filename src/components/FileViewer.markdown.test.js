// A workspace file is written by an agent, or fetched from wherever the agent went, so its markdown is
// untrusted. The viewer puts the rendered HTML into `v-html`; with plain `marked`, a file containing
// `<img src=x onerror=…>` ran script on our origin. It goes through the sanitising renderer the chat uses.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { renderUntrustedMarkdown } from '../utils/safeMarkdown'

const source = readFileSync(fileURLToPath(new URL('./FileViewer.vue', import.meta.url)), 'utf8')

describe('markdown in the file viewer', () => {
  it('is rendered by the sanitising renderer, never by marked directly', () => {
    expect(source).toContain("import { renderUntrustedMarkdown } from '../utils/safeMarkdown'")
    expect(source).toContain('return renderUntrustedMarkdown(content.value)')
    expect(source).not.toMatch(/from ['"]marked['"]/)
    expect(source).not.toMatch(/\bmarked\(/)
  })

  it('that renderer drops what would run', () => {
    const html = renderUntrustedMarkdown('# Notes\n\n<img src=x onerror="alert(1)">\n\n<script>alert(2)</script>\n\n[a](javascript:alert(3))')
    expect(html).toContain('Notes')
    // Raw HTML comes out as text a person can read, not as a tag the page would run.
    expect(html).not.toMatch(/<img/i)
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/href\s*=\s*["']?\s*javascript:/i)
  })
})
