// @vitest-environment jsdom
//
// Conv 1689: the report downloaded as "d48a6524-…" with no extension — the object URL was revoked in the same
// tick as the click, and Chrome named the file after the blob. These pin the two facts that prevent it.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { saveBlob, _REVOKE_AFTER_MS } from './saveBlob'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('saveBlob', () => {
  it('clicks an attached anchor carrying the file name', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    let seen = null
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      seen = { download: this.download, attached: document.body.contains(this) }
    })
    saveBlob(new Blob(['# hi']), 'latest-stable-releases.md')
    expect(click).toHaveBeenCalledOnce()
    expect(seen).toEqual({ download: 'latest-stable-releases.md', attached: true })
  })

  it('does not revoke the URL in the same tick — that is what lost the name', () => {
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => 'blob:y')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    saveBlob(new Blob(['a']), 'a.md')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(_REVOKE_AFTER_MS)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:y')
  })

  it('no download button revokes synchronously any more', () => {
    for (const f of ['../components/FileViewer.vue', '../views/BudgetsPage.vue', '../views/KnowledgeRag.vue',
      '../views/WorkflowsList.vue', '../views/TrainingDataPage.vue', '../views/admin/AdminPartnerKeys.vue']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf-8')
      expect(src, f).toContain('saveBlob(')
      expect(src, f).not.toMatch(/a\.click\(\)[\s\S]{0,80}URL\.revokeObjectURL\(url\)/)
    }
  })
})
