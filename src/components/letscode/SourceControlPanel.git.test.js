// @vitest-environment jsdom
// More of git in Source control (ADM-1321): staged files and a commit of only what is staged, stash, tags, the commit
// graph, and a conflicted file opened in the merge editor.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = (over = {}) => ({
  data: {
    branch: 'main', default_branch: 'main', on_default: true, unpushed: 0, on_remote: true, clean: false,
    has_remote: true, has_commit: true, merging: false,
    changes: [{ path: 'app.py', status: 'modified', code: 'MM' }, { path: 'lib.py', status: 'modified', code: ' M' }],
    untracked: [{ path: 'new.py', status: 'untracked', code: '??' }],
    ...over,
  },
})

vi.mock('@/services/api', () => ({
  default: {
    getSourceControlStatus: vi.fn(), commitSourceControl: vi.fn(), stageSourceControlChange: vi.fn(),
    getStashes: vi.fn(), stashSourceControl: vi.fn(), getTags: vi.fn(), changeTag: vi.fn(), pushTag: vi.fn(),
    getSourceControlLog: vi.fn(), getCommitFiles: vi.fn(), discardSourceControlFile: vi.fn(), markResolved: vi.fn(),
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
const STASH = { index: 0, ref: 'stash@{0}', sha: 'a'.repeat(40), date: new Date().toISOString(), branch: 'main', message: 'half done' }

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()
  api.getSourceControlStatus.mockResolvedValue(state())
})

describe('staging', () => {
  it('a file staged in part is in both groups; Commit then takes only what is staged', async () => {
    api.commitSourceControl.mockResolvedValue({ data: { ...state({ changes: [], untracked: [] }).data, clean: true } })
    const w = await mountPanel()
    const labels = w.findAll('.scm-group-h').map((g) => g.text().replace(/\s+/g, ' ').trim())
    expect(labels).toEqual(['Staged 1', 'Changes 2', 'Untracked 1'])
    expect(w.find('.scm-tick').exists()).toBe(false)                 // the ticks step aside while files are staged
    expect(btn(w, 'Unstage app.py').exists()).toBe(true)
    expect(btn(w, 'Stage app.py').exists()).toBe(true)
    await w.find('#scm-message').setValue('Only the staged part')
    expect(w.find('.scm-commit button[type="submit"]').text()).toContain('Commit 1 staged file on main')
    await w.find('.scm-commit').trigger('submit')
    await flushPromises()
    expect(api.commitSourceControl).toHaveBeenCalledWith(5, 4, { message: 'Only the staged part', staged: true })
  })

  it('stages and unstages a whole file', async () => {
    api.stageSourceControlChange.mockResolvedValue(state())
    const w = await mountPanel()
    await btn(w, 'Stage lib.py').trigger('click')
    await flushPromises()
    expect(api.stageSourceControlChange).toHaveBeenCalledWith(5, 4, { path: 'lib.py', unstage: false })
    await btn(w, 'Unstage app.py').trigger('click')
    await flushPromises()
    expect(api.stageSourceControlChange).toHaveBeenLastCalledWith(5, 4, { path: 'app.py', unstage: true })
    expect(notify.success).toHaveBeenLastCalledWith('Unstaged app.py')
  })
})

describe('stash', () => {
  it('stashes with a message and new files, applies, and drops only after asking', async () => {
    api.getStashes.mockResolvedValue({ data: { stashes: [] } })
    api.stashSourceControl.mockResolvedValue({ data: { ...state().data, stashes: [STASH], stashed: true } })
    const w = await mountPanel()
    await btn(w, 'Stashes').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('No stashes.')
    await w.find('#scm-stashmsg').setValue('half done')
    await w.find('#scm-stashnew').setValue(true)
    await w.find('.scm-section form').trigger('submit')
    await flushPromises()
    expect(api.stashSourceControl).toHaveBeenCalledWith(5, 4, { op: 'push', include_untracked: true, message: 'half done' })
    expect(w.find('.scm-item-name').text()).toBe('half done')

    await btn(w, 'Apply the stash half done').trigger('click')
    await flushPromises()
    expect(api.stashSourceControl).toHaveBeenLastCalledWith(5, 4, { op: 'apply', index: 0, sha: 'a'.repeat(40) })

    confirm.mockResolvedValueOnce(false)
    await btn(w, 'Drop the stash half done').trigger('click')
    await flushPromises()
    expect(api.stashSourceControl).toHaveBeenCalledTimes(2)              // not dropped: the person said no
    api.stashSourceControl.mockResolvedValue({ data: { ...state().data, stashes: [], dropped: true } })
    await btn(w, 'Drop the stash half done').trigger('click')
    await flushPromises()
    expect(api.stashSourceControl).toHaveBeenLastCalledWith(5, 4, { op: 'drop', index: 0, sha: 'a'.repeat(40) })
    expect(w.text()).toContain('No stashes.')
  })

  it('a stash that conflicts says so and keeps the list it answered', async () => {
    api.getStashes.mockResolvedValue({ data: { stashes: [STASH] } })
    api.stashSourceControl.mockRejectedValue({ response: { status: 409, data: { ...state().data, stashes: [STASH],
      code: 'STASH_CONFLICT', error: 'The stash was applied, with conflicts in 1 file.' } } })
    const w = await mountPanel()
    await btn(w, 'Stashes').trigger('click')
    await flushPromises()
    await btn(w, 'Pop the stash half done').trigger('click')
    await flushPromises()
    expect(w.find('.scm-section .scm-note.err').text()).toBe('The stash was applied, with conflicts in 1 file.')
    expect(w.findAll('.scm-item-name')).toHaveLength(1)
  })
})

describe('tags', () => {
  it('creates an annotated tag, pushes it, and deletes one only after asking', async () => {
    const tag = { name: 'v1.0.0', annotated: true, sha: 'c'.repeat(40), date: '', message: 'First release' }
    api.getTags.mockResolvedValue({ data: { tags: [] } })
    api.changeTag.mockResolvedValue({ data: { tags: [tag], created: 'v1.0.0' } })
    api.pushTag.mockResolvedValue({ data: { tags: [tag], pushed_tag: 'v1.0.0' } })
    const w = await mountPanel()
    await btn(w, 'Tags').trigger('click')
    await flushPromises()
    await w.find('#scm-tagname').setValue('v1.0.0')
    await w.find('#scm-tagmsg').setValue('First release')
    await w.findAll('.scm-section form')[0].trigger('submit')
    await flushPromises()
    expect(api.changeTag).toHaveBeenCalledWith(5, 4, { op: 'create', name: 'v1.0.0', message: 'First release' })
    expect(w.find('.scm-item-meta').text()).toContain('First release')

    await btn(w, 'Push the tag v1.0.0 to GitHub').trigger('click')
    await flushPromises()
    expect(api.pushTag).toHaveBeenCalledWith(5, 4, 'v1.0.0')
    expect(notify.success).toHaveBeenLastCalledWith('Pushed the tag v1.0.0 to GitHub')

    confirm.mockResolvedValueOnce(false)
    await btn(w, 'Delete the tag v1.0.0').trigger('click')
    await flushPromises()
    expect(api.changeTag).toHaveBeenCalledTimes(1)
    api.changeTag.mockResolvedValue({ data: { tags: [], deleted: 'v1.0.0' } })
    await btn(w, 'Delete the tag v1.0.0').trigger('click')
    await flushPromises()
    expect(api.changeTag).toHaveBeenLastCalledWith(5, 4, { op: 'delete', name: 'v1.0.0' })
    expect(w.text()).toContain('No tags.')
  })

  it('a refused tag says why', async () => {
    api.getTags.mockResolvedValue({ data: { tags: [] } })
    api.changeTag.mockRejectedValue({ response: { status: 409, data: { tags: [], code: 'TAG_EXISTS', error: 'A tag named v1 already exists.' } } })
    const w = await mountPanel()
    await btn(w, 'Tags').trigger('click')
    await flushPromises()
    await w.find('#scm-tagname').setValue('v1')
    await w.findAll('.scm-section form')[0].trigger('submit')
    await flushPromises()
    expect(w.find('.scm-section .scm-note.err').text()).toBe('A tag named v1 already exists.')
  })
})

describe('the commit graph', () => {
  it('draws a lane per branch line, marks the branches and tags, and reads every branch when asked', async () => {
    const at = new Date().toISOString()
    api.getSourceControlLog.mockResolvedValue({ data: { more: false, page: 0, commits: [
      { sha: 'm', short: 'm', author: 'Ana', date: at, subject: 'Merge feature', parents: ['a', 'f'],
        refs: [{ name: 'HEAD', kind: 'head' }, { name: 'main', kind: 'branch' }, { name: 'origin/main', kind: 'remote' }] },
      { sha: 'a', short: 'a', author: 'Ana', date: at, subject: 'Main work', parents: ['b'], refs: [{ name: 'v1', kind: 'tag' }] },
      { sha: 'f', short: 'f', author: 'Bo', date: at, subject: 'Feature work', parents: ['b'], refs: [] },
      { sha: 'b', short: 'b', author: 'Bo', date: at, subject: 'init', parents: [], refs: [] },
    ] } })
    const w = await mountPanel()
    await btn(w, 'History').trigger('click')
    await flushPromises()
    expect(api.getSourceControlLog).toHaveBeenCalledWith(5, 4, 0)
    const rows = w.findAll('.scm-commitrow')
    expect(rows[0].find('.scm-dot').classes()).toContain('merge')
    expect(rows[0].findAll('path')).toHaveLength(2)                    // a merge opens a second lane
    expect(rows[0].findAll('.scm-ref').map((r) => r.text())).toEqual(['main', 'origin/main'])
    expect(rows[0].find('.scm-ref.current').text()).toBe('main')
    expect(rows[1].find('.scm-ref.tag').text()).toBe('v1')
    expect(w.findAll('.scm-subject').map((s) => s.text())).toEqual(['Merge feature', 'Main work', 'Feature work', 'init'])
    await w.find('#scm-graph').setValue(true)
    await flushPromises()
    expect(api.getSourceControlLog).toHaveBeenLastCalledWith(5, 4, 0, { graph: true })
  })

  it('tags a commit from the history', async () => {
    api.getSourceControlLog.mockResolvedValue({ data: { more: false, page: 0, commits: [
      { sha: 'b'.repeat(40), short: 'bbbbbbb', author: 'Bo', date: '', subject: 'init', parents: [], refs: [] }] } })
    api.getCommitFiles.mockResolvedValue({ data: { files: [] } })
    api.getTags.mockResolvedValue({ data: { tags: [] } })
    api.changeTag.mockResolvedValue({ data: { tags: [], created: 'v0' } })
    const w = await mountPanel()
    await btn(w, 'History').trigger('click')
    await flushPromises()
    await w.find('.scm-commitbtn').trigger('click')
    await flushPromises()
    await w.findAll('.scm-linkbtn').find((b) => b.text().includes('Tag this commit')).trigger('click')
    await flushPromises()
    expect(w.find('label[for="scm-tagname"]').text()).toContain('bbbbbbb')
    await w.find('#scm-tagname').setValue('v0')
    await w.findAll('.scm-section form')[0].trigger('submit')
    await flushPromises()
    expect(api.changeTag).toHaveBeenCalledWith(5, 4, { op: 'create', name: 'v0', sha: 'b'.repeat(40) })
  })
})

describe('the merge editor', () => {
  it('a conflicted file offers the merge editor', async () => {
    api.getSourceControlStatus.mockResolvedValue(state({ merging: true, changes: [{ path: 'app.py', status: 'conflict', code: 'UU' }], untracked: [] }))
    const w = await mountPanel()
    expect(btn(w, 'Stage app.py').exists()).toBe(false)                 // a conflict is resolved, not staged
    await btn(w, 'Open app.py in the merge editor').trigger('click')
    expect(w.emitted('open-merge')[0]).toEqual(['app.py'])
  })
})
