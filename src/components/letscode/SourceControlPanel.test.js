// @vitest-environment jsdom
// Source control is where the person reviews what the agent changed and decides what happens to it: a diff per file,
// discard, commit (on the branch it is on, or a new branch the person types), push and a pull request (owner,
// 2026-11-09; branch rule 2026-11-10).
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
    publishProject: vi.fn(),
    downloadProjectBackup: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/utils/saveBlob', async (orig) => ({ ...(await orig()), saveBlob: vi.fn() }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

import api from '@/services/api'
import { confirm } from '@/composables/useConfirm'
import SourceControlPanel from './SourceControlPanel.vue'
import { projectCache } from '@/services/projectCache'

const mountPanel = async () => {
  const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 }, global: { stubs: { Icon: true } } })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()               // what an earlier test read is not this test's status
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

  // Owner, 2026-11-10: no branch the person did not ask for; a commit on main is pushed to main.
  it('commits on main when no new branch is typed, then offers Push for main', async () => {
    api.commitSourceControl.mockResolvedValueOnce(dirty({ unpushed: 1, clean: true, changes: [], untracked: [] }))
    const w = await mountPanel()
    expect(w.find('#scm-branch').exists()).toBe(true)
    expect(w.find('#scm-branch').attributes('placeholder')).toBe('Leave empty to commit on main')
    expect(w.find('form.scm-commit button[type="submit"]').text()).toContain('Commit on main')
    await w.find('#scm-message').setValue('Add a footer')
    await w.find('form.scm-commit').trigger('submit')
    await flushPromises()
    expect(api.commitSourceControl).toHaveBeenCalledWith(5, 4, { message: 'Add a footer' })
    expect(w.emitted('changed')).toHaveLength(1)
    expect(w.text()).toContain('Push 1 commit')
    expect(w.text()).not.toContain('Open pull request')
  })

  it('commits to a new branch only when the person types one', async () => {
    api.commitSourceControl.mockResolvedValueOnce(dirty({ branch: 'add-footer', on_default: false, unpushed: 1,
      on_remote: false, clean: true, changes: [], untracked: [] }))
    const w = await mountPanel()
    await w.find('#scm-message').setValue('Add a footer')
    await w.find('#scm-branch').setValue('add-footer')
    expect(w.find('form.scm-commit button[type="submit"]').text()).toContain('Commit to add-footer')
    await w.find('form.scm-commit').trigger('submit')
    await flushPromises()
    expect(api.commitSourceControl).toHaveBeenCalledWith(5, 4, { message: 'Add a footer', branch: 'add-footer' })
    expect(w.text()).toContain('Push 1 commit')
  })

  it('commits on a working branch when no new branch is typed', async () => {
    api.getSourceControlStatus.mockResolvedValueOnce(dirty({ branch: 'feature', on_default: false }))
    api.commitSourceControl.mockResolvedValueOnce(dirty({ branch: 'feature', on_default: false, unpushed: 1, clean: true, changes: [], untracked: [] }))
    const w = await mountPanel()
    expect(w.find('form.scm-commit button[type="submit"]').text()).toContain('Commit on feature')
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
    await pr.trigger('click')                                  // opens the title / description form (ADM-1205)
    await w.find('form.scm-prform').trigger('submit')
    await flushPromises()
    expect(api.openPullRequest).toHaveBeenCalledWith(5, 4, { title: 'feature', body: '' })
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

  it('after a failed first load, a refresh shows "Loading", never a clean working tree it has not read', async () => {
    api.getSourceControlStatus.mockRejectedValueOnce({ response: { status: 502, data: '<html>502</html>' } })
    const w = await mountPanel()
    expect(w.text()).toContain('Could not load source control status.')
    let resolve
    api.getSourceControlStatus.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    w.vm.refresh()
    await w.vm.$nextTick()
    expect(w.text()).toContain('Loading changes')
    expect(w.text()).not.toContain('working tree is clean')
    resolve(dirty())
    await flushPromises()
    expect(w.text()).toContain('app.py')
  })

  describe('a new project with no GitHub repository (ADM-1183)', () => {
    const local = (over = {}) => dirty({ branch: 'main', default_branch: '', on_default: false, on_remote: false,
      has_remote: false, has_commit: false, unpushed: 0, ...over })
    const mountNew = async () => {
      const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4, projectName: 'shop' }, global: { stubs: { Icon: true } } })
      await flushPromises()
      return w
    }

    it('commits on main with no branch field, says to commit before publishing, and warns the files live only in the sandbox', async () => {
      api.getSourceControlStatus.mockResolvedValueOnce(local())
      api.commitSourceControl.mockResolvedValueOnce(local({ has_commit: true, clean: true, changes: [], untracked: [] }))
      const w = await mountNew()
      expect(w.find('#scm-branch').exists()).toBe(false)
      expect(w.find('form.scm-commit button[type="submit"]').text()).toContain('Commit')
      expect(w.find('form.scm-publish').exists()).toBe(false)
      expect(w.text()).toContain('Commit your changes, then publish the project to GitHub.')
      expect(w.find('.scm-foot.warn').text()).toContain('only in its sandbox')
      await w.find('#scm-message').setValue('First version')
      await w.find('form.scm-commit').trigger('submit')
      await flushPromises()
      expect(api.commitSourceControl).toHaveBeenCalledWith(5, 4, { message: 'First version' })
      expect(w.find('form.scm-publish').exists()).toBe(true)
      expect(w.text()).not.toContain('Push')
      expect(w.text()).not.toContain('Open pull request')
    })

    it('publishes with the project name and Private by default, then is an ordinary GitHub project', async () => {
      api.getSourceControlStatus.mockResolvedValueOnce(local({ has_commit: true, clean: true, changes: [], untracked: [] }))
      api.publishProject.mockResolvedValueOnce(dirty({ branch: 'main', default_branch: 'main', on_default: true, has_remote: true,
        has_commit: true, on_remote: true, clean: true, changes: [], untracked: [],
        published: { url: 'https://github.com/ada/shop', branch: 'main', private: true } }))
      const w = await mountNew()
      expect(w.find('#scm-repo').attributes('placeholder')).toBe('shop')
      expect(w.find('#scm-private').element.checked).toBe(true)
      await w.find('form.scm-publish').trigger('submit')
      await flushPromises()
      expect(api.publishProject).toHaveBeenCalledWith(5, 4, { name: 'shop', private: true })
      expect(w.emitted('published')[0][0]).toEqual({ url: 'https://github.com/ada/shop', branch: 'main', private: true })
      expect(w.find('form.scm-publish').exists()).toBe(false)
      expect(w.find('.scm-foot.warn').exists()).toBe(false)
    })

    it('shows why publishing failed, and offers Push when the repository was made but the push failed', async () => {
      api.getSourceControlStatus.mockResolvedValueOnce(local({ has_commit: true, clean: true, changes: [], untracked: [] }))
      api.publishProject.mockRejectedValueOnce({ response: { status: 409, data: {
        error: 'The repository was created (https://github.com/ada/shop) but the push failed: network. Press Push to try again.',
        code: 'PUSH_FAILED', ...local({ has_remote: true, has_commit: true, clean: true, changes: [], untracked: [],
          unpushed: 1, default_branch: '' }).data } } })
      const w = await mountNew()
      await w.find('#scm-repo').setValue('shop-app')
      await w.find('#scm-private').setValue(false)
      await w.find('form.scm-publish').trigger('submit')
      await flushPromises()
      expect(api.publishProject).toHaveBeenCalledWith(5, 4, { name: 'shop-app', private: false })
      expect(w.find('.scm-note.err').text()).toContain('push failed')
      expect(w.find('form.scm-publish').exists()).toBe(false)
      expect(w.text()).toContain('Push 1 commit')
    })
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

describe('SourceControlPanel: the last status shows at once (ADM-1196)', () => {
  it('opened again, it shows what it last read while it reads again, then the fresh status', async () => {
    const first = await mountPanel()
    expect(first.text()).toContain('app.py')
    first.unmount()
    let resolve
    api.getSourceControlStatus.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 }, global: { stubs: { Icon: true } } })
    await w.vm.$nextTick()
    expect(w.text()).toContain('app.py')                 // at once, from the last read
    expect(w.text()).not.toContain('Loading changes')
    resolve(dirty({ changes: [{ path: 'other.py', status: 'modified' }], untracked: [] }))
    await flushPromises()
    expect(w.text()).toContain('other.py')
    expect(w.text()).not.toContain('app.py')
    expect(w.emitted('count').at(-1)).toEqual([1])
    w.unmount()
  })

  it('another project shows nothing kept for this one', async () => {
    ;(await mountPanel()).unmount()
    api.getSourceControlStatus.mockImplementationOnce(() => new Promise(() => {}))
    const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 99 }, global: { stubs: { Icon: true } } })
    await w.vm.$nextTick()
    expect(w.text()).toContain('Loading changes')
    expect(w.text()).not.toContain('app.py')
    w.unmount()
  })

  it('a failed read says so instead of showing the kept list', async () => {
    ;(await mountPanel()).unmount()
    api.getSourceControlStatus.mockRejectedValueOnce({ response: { status: 500, data: { error: 'git failed' } } })
    const w = await mountPanel()
    expect(w.find('[role="alert"]').text()).toContain('git failed')
    expect(w.text()).not.toContain('app.py')
    w.unmount()
  })

  // ADM-1205 phase F item 18: a backup to keep before the sandbox is deleted, saved under the server's file name.
  describe('Download backup', () => {
    it('the header button saves the backup under its own name and changes nothing in the project', async () => {
      const { saveBlob } = await import('@/utils/saveBlob')
      const { notify } = await import('@/composables/useNotify')
      const blob = new Blob(['tgz'])
      api.downloadProjectBackup.mockResolvedValueOnce({
        data: blob, headers: { 'content-disposition': 'attachment; filename="shop-backup-2026-11-12.tar.gz"' } })
      const w = await mountPanel()
      await w.find('[aria-label="Download a backup of the project"]').trigger('click')
      await flushPromises()
      expect(api.downloadProjectBackup).toHaveBeenCalledWith(5, 4)
      expect(saveBlob).toHaveBeenCalledWith(blob, 'shop-backup-2026-11-12.tar.gz')
      expect(notify.success).toHaveBeenCalledWith('Backup downloaded')
      expect(w.emitted('changed')).toBeFalsy()
    })

    it("a project only in its sandbox offers it under the warning; a failure is the server's words", async () => {
      const { notify } = await import('@/composables/useNotify')
      api.getSourceControlStatus.mockResolvedValueOnce(dirty({ has_remote: false, has_commit: true, on_remote: false }))
      api.downloadProjectBackup.mockRejectedValueOnce({ response: { status: 413, data: { error: 'shop is 300 MB.' } } })
      const w = await mountPanel()
      expect(w.find('.scm-foot.warn').text()).toContain('or download a backup')
      await w.find('.scm-backup').trigger('click')
      await flushPromises()
      expect(notify.error).toHaveBeenCalledWith('shop is 300 MB.')
    })
  })
})
