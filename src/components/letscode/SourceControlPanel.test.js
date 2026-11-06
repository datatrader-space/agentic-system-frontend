// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/services/api', () => ({
  default: {
    getSourceControlStatus: vi.fn(() => Promise.resolve({
      data: {
        branch: 'main', clean: false,
        changes: [{ path: 'app.py', status: 'modified' }],
        untracked: [{ path: 'new.py', status: 'untracked' }],
      },
    })),
    getSourceControlDiff: vi.fn(() => Promise.resolve({
      data: { path: 'app.py', diff_text: 'diff --git a/app.py b/app.py\n@@ -1 +1 @@\n-x = 1\n+x = 2\n' },
    })),
  },
}))

import SourceControlPanel from './SourceControlPanel.vue'

describe('SourceControlPanel', () => {
  it('lists the changes, never gitignored files, and opens a clicked change as a diff in the editor', async () => {
    const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 } })
    await flushPromises()
    const text = w.text()
    expect(text).toContain('main')              // branch
    expect(text).toContain('app.py')            // modified (Changes)
    expect(text).toContain('new.py')            // untracked
    expect(text).not.toContain('Local-only')    // gitignored files are not listed (owner 2026-11-06)
    // emits the committable change count (changes + untracked = 2)
    expect(w.emitted('count')[0][0]).toBe(2)
    // click app.py → the editor is asked to open its side-by-side diff
    await w.findAll('.scm-row')[0].trigger('click')
    expect(w.emitted('open-diff')[0][0]).toEqual({ path: 'app.py', status: 'modified' })
  })

  it('shows a clean state', async () => {
    const api = (await import('@/services/api')).default
    api.getSourceControlStatus.mockResolvedValueOnce({
      data: { branch: 'main', clean: true, changes: [], untracked: [] },
    })
    const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 } })
    await flushPromises()
    expect(w.text().toLowerCase()).toContain('clean')
  })

  it("says why when the project's sandbox cannot be used", async () => {
    const api = (await import('@/services/api')).default
    api.getSourceControlStatus.mockRejectedValueOnce({
      response: { status: 503, data: { error: 'Sandboxes are switched off on this deployment.', sandbox_unavailable: true } },
    })
    const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 } })
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toBe('Sandboxes are switched off on this deployment.')
  })

  it('says how long changes are kept', async () => {
    const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 } })
    await flushPromises()
    expect(w.text()).toContain('kept for 3 days')
  })
})
