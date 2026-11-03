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
        local_only: [{ path: '.env', status: 'untracked', gitignored: true, protected: true }],
      },
    })),
    getSourceControlDiff: vi.fn(() => Promise.resolve({
      data: { path: 'app.py', diff_text: 'diff --git a/app.py b/app.py\n@@ -1 +1 @@\n-x = 1\n+x = 2\n' },
    })),
  },
}))

import SourceControlPanel from './SourceControlPanel.vue'

describe('SourceControlPanel', () => {
  it('renders change groups with badges and loads a diff on click', async () => {
    const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 } })
    await flushPromises()
    const text = w.text()
    expect(text).toContain('main')              // branch
    expect(text).toContain('app.py')            // modified (Changes)
    expect(text).toContain('new.py')            // untracked
    expect(text).toContain('.env')              // local-only
    expect(text).toContain('secret')            // protected tag on .env
    // emits the committable change count (changes + untracked = 2)
    expect(w.emitted('count')[0][0]).toBe(2)
    // click app.py → diff renders with +/- lines
    await w.findAll('.scm-row')[0].trigger('click')
    await flushPromises()
    expect(w.text()).toContain('+x = 2')
    expect(w.text()).toContain('-x = 1')
  })

  it('shows a clean state', async () => {
    const api = (await import('@/services/api')).default
    api.getSourceControlStatus.mockResolvedValueOnce({
      data: { branch: 'main', clean: true, changes: [], untracked: [], local_only: [] },
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

  it('a diff that cannot load says so, not "no changes", and the 3-day note is shown', async () => {
    const api = (await import('@/services/api')).default
    api.getSourceControlDiff.mockRejectedValueOnce({ response: { status: 503, data: { error: 'Sandbox is starting.' } } })
    const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 } })
    await flushPromises()
    expect(w.text()).toContain('kept for 3 days')
    await w.findAll('.scm-row')[0].trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Sandbox is starting.')
    expect(w.text()).not.toContain('No textual changes')
  })
})
