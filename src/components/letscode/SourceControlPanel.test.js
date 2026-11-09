// @vitest-environment jsdom
// Source control is where the person reviews what the agent changed and decides what happens to it: a diff per file,
// discard, commit (to a new branch when on the default branch), push and a pull request (owner, 2026-11-09).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const dirty = (over = {}) => ({
  data: {
    branch: 'main', default_branch: 'main', on_default: true, unpushed: 0, on_remote: true, clean: false,
    changes: [{ path: 'app.py', status: 'modified' }],
    untracked: [{ path: 'new.py', status: 'untracked' }],
    ...over,
  },
})

vi.mock('@/services/api', () => ({
  default: {
    getSourceControlStatus: vi.fn(),
    getSourceControlDiff: vi.fn(),
    discardSourceControlFile: vi.fn(),
    commitSourceControl: vi.fn(),
    pushSourceControl: vi.fn(),
    openPullRequest: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

import api from '@/services/api'
import { confirm } from '@/composables/useConfirm'
import SourceControlPanel from './SourceControlPanel.vue'

const mountPanel = async () => {
  const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 }, global: { stubs: { Icon: true } } })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getSourceControlStatus.mockResolvedValue(dirty())
})

describe('SourceControlPanel', () => {
  it('lists the changes, never gitignored files, and opens a clicked change as a diff in the editor', async () => {
    const w = await mountPanel()
    const text = w.text()
    expect(text).toContain('main')
    expect(text).toContain('app.py')
    expect(text).toContain('new.py')
    expect(text).not.toContain('Local-only')
    expect(w.emitted('count')[0][0]).toBe(2)
    await w.findAll('.scm-row')[0].trigger('click')
    expect(w.emitted('open-diff')[0][0]).toEqual({ path: 'app.py', status: 'modified' })
  })

  it('shows a clean state with no commit form', async () => {
    api.getSourceControlStatus.mockResolvedValueOnce(dirty({ clean: true, changes: [], untracked: [] }))
    const w = await mountPanel()
    expect(w.text().toLowerCase()).toContain('clean')
    expect(w.find('form.scm-commit').exists()).toBe(false)
  })

  it("says why when the project's sandbox cannot be used", async () => {
    api.getSourceControlStatus.mockRejectedValueOnce({
      response: { status: 503, data: { error: 'Sandboxes are switched off on this deployment.', sandbox_unavailable: true } },
    })
    const w = await mountPanel()
    expect(w.find('[role="alert"]').text()).toBe('Sandboxes are switched off on this deployment.')
  })

  it('says how long changes are kept', async () => {
    const w = await mountPanel()
    expect(w.text()).toContain('kept for 3 days')
  })

  it('commits to a new branch when on the default branch, named from the message unless the person names it', async () => {
    api.commitSourceControl.mockResolvedValueOnce(dirty({ branch: 'lets-code/add-a-footer', on_default: false, unpushed: 1,
      on_remote: false, clean: true, changes: [], untracked: [] }))
    const w = await mountPanel()
    expect(w.find('#scm-branch').exists()).toBe(true)
    expect(w.text()).toContain('Commit to new branch')
    await w.find('#scm-message').setValue('Add a footer')
    expect(w.find('#scm-branch').attributes('placeholder')).toBe('lets-code/add-a-footer')
    await w.find('form.scm-commit').trigger('submit')
    await flushPromises()
    expect(api.commitSourceControl).toHaveBeenCalledWith(5, 4, { message: 'Add a footer', branch: 'lets-code/add-a-footer' })
    expect(w.emitted('changed')).toHaveLength(1)
    // Now on the new branch with one commit not pushed: Push is offered, a pull request is not yet.
    expect(w.text()).toContain('Push 1 commit')
    expect(w.text()).not.toContain('Open pull request')
  })

  it('commits on a working branch without asking for a branch', async () => {
    api.getSourceControlStatus.mockResolvedValueOnce(dirty({ branch: 'feature', on_default: false }))
    api.commitSourceControl.mockResolvedValueOnce(dirty({ branch: 'feature', on_default: false, unpushed: 1, clean: true, changes: [], untracked: [] }))
    const w = await mountPanel()
    expect(w.find('#scm-branch').exists()).toBe(false)
    await w.find('#scm-message').setValue('Fix it')
    await w.find('form.scm-commit').trigger('submit')
    await flushPromises()
    expect(api.commitSourceControl).toHaveBeenCalledWith(5, 4, { message: 'Fix it' })
  })

  it('pushes, then opens a pull request and links it', async () => {
    api.getSourceControlStatus.mockResolvedValueOnce(dirty({ branch: 'feature', on_default: false, unpushed: 2, on_remote: false,
      clean: true, changes: [], untracked: [] }))
    api.pushSourceControl.mockResolvedValueOnce(dirty({ branch: 'feature', on_default: false, unpushed: 0, on_remote: true,
      clean: true, changes: [], untracked: [], pushed: 2 }))
    api.openPullRequest.mockResolvedValueOnce({ data: { url: 'https://github.com/o/r/pull/7' } })
    const w = await mountPanel()
    const push = w.findAll('.scm-sync .scm-btn').find((b) => b.text().includes('Push 2 commits'))
    await push.trigger('click')
    await flushPromises()
    expect(api.pushSourceControl).toHaveBeenCalledWith(5, 4)
    const pr = w.findAll('.scm-sync .scm-btn').find((b) => b.text().includes('Open pull request'))
    await pr.trigger('click')
    await flushPromises()
    expect(api.openPullRequest).toHaveBeenCalledWith(5, 4, { title: 'feature' })
    const link = w.find('a.scm-pr')
    expect(link.attributes('href')).toBe('https://github.com/o/r/pull/7')
    expect(link.attributes('rel')).toContain('noopener')
    expect(w.text()).not.toContain('Open pull request')
  })

  it('discards a file only after the person confirms', async () => {
    api.discardSourceControlFile.mockResolvedValueOnce(dirty({ changes: [] }))
    const w = await mountPanel()
    confirm.mockResolvedValueOnce(false)
    await w.findAll('.scm-discard')[0].trigger('click')
    await flushPromises()
    expect(api.discardSourceControlFile).not.toHaveBeenCalled()
    await w.findAll('.scm-discard')[0].trigger('click')
    await flushPromises()
    expect(api.discardSourceControlFile).toHaveBeenCalledWith(5, 4, 'app.py')
    expect(w.text()).not.toContain('app.py')
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('shows why an action was refused, next to the buttons', async () => {
    api.commitSourceControl.mockRejectedValueOnce({ response: { status: 400, data: { error: 'That is not a valid branch name.' } } })
    const w = await mountPanel()
    await w.find('#scm-message').setValue('x')
    await w.find('#scm-branch').setValue('bad name')
    await w.find('form.scm-commit').trigger('submit')
    await flushPromises()
    expect(w.find('.scm-note.err').text()).toBe('That is not a valid branch name.')
    expect(w.emitted('changed')).toBeUndefined()
  })

  it('waits while the sandbox starts and then shows the changes', async () => {
    vi.useFakeTimers()
    try {
      api.getSourceControlStatus.mockReset()
      api.getSourceControlStatus
        .mockRejectedValueOnce({ response: { status: 503, headers: { 'retry-after': '5' }, data: { code: 'RUNNER_STARTING', error: 'Starting' } } })
        .mockResolvedValueOnce(dirty())
      const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 }, global: { stubs: { Icon: true } } })
      await flushPromises()
      expect(w.find('[role="status"]').text()).toContain('Trying again in 5s')
      await vi.advanceTimersByTimeAsync(5000)
      await flushPromises()
      expect(w.find('[role="status"]').exists()).toBe(false)
      expect(w.text()).toContain('app.py')
    } finally {
      vi.useRealTimers()
    }
  })
})
