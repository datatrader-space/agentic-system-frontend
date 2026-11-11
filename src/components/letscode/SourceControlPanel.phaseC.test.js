// @vitest-environment jsdom
// Source control, the rest of VS Code's (ADM-1205, phase C): pull, a merge's conflicts (Mark resolved, Abort merge),
// committing only the ticked files, Discard all, a new branch that keeps the changes, a pull request with a
// description, and the history with each commit's files.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = (over = {}) => ({
  data: {
    branch: 'feature/x', default_branch: 'main', on_default: false, unpushed: 0, on_remote: true, clean: false,
    has_remote: true, has_commit: true, merging: false,
    changes: [{ path: 'app.py', status: 'modified' }, { path: 'lib.py', status: 'modified' }],
    untracked: [{ path: 'new.py', status: 'untracked' }],
    ...over,
  },
})

vi.mock('@/services/api', () => ({
  default: {
    getSourceControlStatus: vi.fn(), getSourceControlDiff: vi.fn(), discardSourceControlFile: vi.fn(),
    commitSourceControl: vi.fn(), pushSourceControl: vi.fn(), openPullRequest: vi.fn(), publishProject: vi.fn(),
    pullSourceControl: vi.fn(), abortMerge: vi.fn(), markResolved: vi.fn(), discardAllSourceControl: vi.fn(),
    createBranch: vi.fn(), getSourceControlLog: vi.fn(), getCommitFiles: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import SourceControlPanel from './SourceControlPanel.vue'
import { projectCache } from '@/services/projectCache'

const mountPanel = async () => {
  const w = mount(SourceControlPanel, { props: { systemId: 5, repoId: 4 }, global: { stubs: { Icon: true } } })
  await flushPromises()
  return w
}
const btn = (w, label) => w.find(`[aria-label="${label}"]`)

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()
  api.getSourceControlStatus.mockResolvedValue(state())
})

describe('pull', () => {
  it('brings in GitHub\'s commits and says how many', async () => {
    api.pullSourceControl.mockResolvedValue({ data: { ...state().data, pulled: { branch: 'feature/x', commits: 2 } } })
    const w = await mountPanel()
    await btn(w, 'Pull from GitHub').trigger('click')
    await flushPromises()
    expect(api.pullSourceControl).toHaveBeenCalledWith(5, 4)
    expect(notify.success).toHaveBeenCalledWith('Pulled 2 commits from GitHub')
  })

  it('a conflict shows the merge: the conflicted file, Mark resolved, Abort merge; no commit until resolved', async () => {
    const merging = state({ merging: true, changes: [{ path: 'app.py', status: 'conflict' }], untracked: [] }).data
    api.pullSourceControl.mockRejectedValue({ response: { status: 409, data: { ...merging, code: 'MERGE_CONFLICT',
      conflicts: ['app.py'], error: 'The pull stopped: 1 file(s) changed on both sides.' } } })
    const w = await mountPanel()
    await btn(w, 'Pull from GitHub').trigger('click')
    await flushPromises()
    expect(w.find('.scm-merge').text()).toContain('1 file has a conflict')
    expect(w.find('.scm-badge.conflict').text()).toBe('!')
    expect(w.find('.scm-tick').exists()).toBe(false)                  // a merge is committed whole
    expect(w.findAll('.scm-conflict-actions .scm-resolve').map((b) => b.text())).toEqual(['Keep mine', "Keep GitHub's", 'Mark resolved'])
    await w.find('textarea').setValue('Merge')
    expect(w.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(w.find('button[type="submit"]').text()).toContain('Resolve the conflicts')
    await w.find('.scm-row').trigger('click')
    expect(w.emitted('open-file')[0]).toEqual(['app.py'])           // opens the file to resolve it
    api.markResolved.mockResolvedValue({ data: { ...merging, changes: [{ path: 'app.py', status: 'modified' }], resolved: 'app.py' } })
    await btn(w, "Keep GitHub's version of app.py").trigger('click')
    await flushPromises()
    expect(api.markResolved).toHaveBeenCalledWith(5, 4, 'app.py', 'theirs')
    expect(notify.success).toHaveBeenCalledWith("Kept GitHub's version of app.py")
    expect(w.find('button[type="submit"]').text()).toContain('Commit the merge')
    api.abortMerge.mockResolvedValue({ data: state().data })
    await w.find('.scm-merge .scm-btn').trigger('click')
    await flushPromises()
    expect(api.abortMerge).toHaveBeenCalledWith(5, 4)
    expect(w.find('.scm-merge').exists()).toBe(false)
  })
})

describe('commit only the ticked files', () => {
  it('every file is ticked by default; unticking one commits the others and says how many', async () => {
    api.commitSourceControl.mockResolvedValue({ data: state({ changes: [{ path: 'lib.py', status: 'modified' }], untracked: [] }).data })
    const w = await mountPanel()
    expect(w.find('button[type="submit"]').text()).toContain('Commit on feature/x')
    await w.find('[aria-label="Commit lib.py"]').setValue(false)
    expect(w.find('button[type="submit"]').text()).toContain('Commit 2 files on feature/x')
    await w.find('textarea').setValue('Two of three')
    await w.find('form.scm-commit').trigger('submit')
    await flushPromises()
    expect(api.commitSourceControl).toHaveBeenCalledWith(5, 4, { message: 'Two of three', paths: ['app.py', 'new.py'] })
  })

  it('all ticked sends no list (every change), and a group can be unticked at once', async () => {
    api.commitSourceControl.mockResolvedValue({ data: state({ clean: true, changes: [], untracked: [] }).data })
    const w = await mountPanel()
    await w.find('textarea').setValue('All')
    await w.find('form.scm-commit').trigger('submit')
    await flushPromises()
    expect(api.commitSourceControl.mock.calls[0][2]).toEqual({ message: 'All' })
    api.getSourceControlStatus.mockResolvedValue(state())
    const v = await mountPanel()
    await v.find('[aria-label="Commit every file in Changes"]').setValue(false)
    expect(v.find('button[type="submit"]').text()).toContain('Commit 1 file')
  })
})

describe('discard all, a new branch, a pull request with a description', () => {
  it('Discard all asks first, naming that ignored files stay', async () => {
    api.discardAllSourceControl.mockResolvedValue({ data: state({ clean: true, changes: [], untracked: [] }).data })
    const w = await mountPanel()
    await btn(w, 'Discard all changes').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard all 3 changes?', danger: true }))
    expect(confirm.mock.calls[0][0].message).toContain('.env')
    expect(api.discardAllSourceControl).toHaveBeenCalledWith(5, 4)
  })

  it('a new branch keeps the changes', async () => {
    api.createBranch.mockResolvedValue({ data: { ...state({ branch: 'fix/login' }).data, created: 'fix/login' } })
    const w = await mountPanel()
    await btn(w, 'New branch').trigger('click')
    await w.find('#scm-newbranch').setValue('fix/login')
    await w.find('form.scm-newbranch').trigger('submit')
    await flushPromises()
    expect(api.createBranch).toHaveBeenCalledWith(5, 4, 'fix/login')
    expect(w.find('.scm-branch').text()).toContain('fix/login')
  })

  it('a pull request has a title and a description', async () => {
    api.getSourceControlStatus.mockResolvedValue(state({ clean: true, changes: [], untracked: [] }))
    api.openPullRequest.mockResolvedValue({ data: { url: 'https://github.com/acme/shop/pull/7', existing: false } })
    const w = await mountPanel()
    await w.findAll('.scm-sync .scm-btn').find((b) => b.text().includes('Open pull request')).trigger('click')
    expect(w.find('#scm-prtitle').element.value).toBe('feature/x')
    await w.find('#scm-prtitle').setValue('Login page')
    await w.find('#scm-prbody').setValue('Adds the login form.')
    await w.find('form.scm-prform').trigger('submit')
    await flushPromises()
    expect(api.openPullRequest).toHaveBeenCalledWith(5, 4, { title: 'Login page', body: 'Adds the login form.' })
    expect(w.find('.scm-pr').attributes('href')).toBe('https://github.com/acme/shop/pull/7')
  })
})

describe('history', () => {
  it('lists the commits page by page; a commit opens to its files; a file opens as that commit changed it', async () => {
    api.getSourceControlLog.mockImplementation((_s, _r, page) => Promise.resolve({ data: page === 0
      ? { commits: [{ sha: 'a'.repeat(40), short: 'aaaaaaa', author: 'Ana', date: new Date().toISOString(), subject: 'Login page' }], more: true, page: 0 }
      : { commits: [{ sha: 'b'.repeat(40), short: 'bbbbbbb', author: 'Bo', date: '2020-01-01T00:00:00Z', subject: 'init' }], more: false, page: 1 } }))
    api.getCommitFiles.mockResolvedValue({ data: { files: [{ path: 'app.py', status: 'modified' }] } })
    const w = await mountPanel()
    await btn(w, 'History').trigger('click')
    await flushPromises()
    expect(w.findAll('.scm-subject').map((s) => s.text())).toEqual(['Login page'])
    await w.find('.scm-older').trigger('click')
    await flushPromises()
    expect(w.findAll('.scm-subject').map((s) => s.text())).toEqual(['Login page', 'init'])
    expect(w.find('.scm-older').exists()).toBe(false)
    expect(w.findAll('.scm-meta')[1].text()).toContain('years ago')
    await w.findAll('.scm-commitbtn')[0].trigger('click')
    await flushPromises()
    expect(api.getCommitFiles).toHaveBeenCalledWith(5, 4, 'a'.repeat(40))
    await w.find('.scm-cfiles .scm-row').trigger('click')
    expect(w.emitted('open-diff').at(-1)[0]).toEqual({ path: 'app.py', status: 'modified', sha: 'a'.repeat(40), short: 'aaaaaaa', from: '' })
  })
})
