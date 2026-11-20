// @vitest-environment jsdom
// The Share dialog (ADM-1339): the owner row and the people with their roles; add by email and role, change a role,
// remove after the app's own confirm; every refusal shown in the server's own words.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'

vi.mock('@/services/api', () => ({ default: {} }))
const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/composables/useConfirm', () => ({ confirm: confirmMock }))

import WfShareDialog from './WfShareDialog.vue'

const tick = async () => { await flushPromises(); await nextTick(); await new Promise((r) => setTimeout(r, 0)); await nextTick() }
const q = (sel) => document.body.querySelector(sel)
const qa = (sel) => [...document.body.querySelectorAll(sel)]
const button = (text) => qa('button').find((b) => b.textContent.trim() === text)

const OWNER = { id: 1, email: 'olga@x.test', name: 'Olga Owner' }
const ANN = { user_id: 7, email: 'ann@x.test', name: 'Ann', role: 'viewer', added_by: 1, created_at: '2026-11-20T10:00:00Z' }

let api
let wrapper
function mountDialog() {
  const open = ref(true)
  const Host = defineComponent({
    setup: () => () => h(WfShareDialog, { open: open.value, 'onUpdate:open': (v) => { open.value = v }, graphId: 86, name: 'Customer intake', api }),
  })
  wrapper = mount(Host, { attachTo: document.body })
  return { open }
}
const refusal = (status, error, code) => ({ response: { status, data: { error, code } } })

beforeEach(() => {
  confirmMock.mockClear()
  confirmMock.mockResolvedValue(true)
  api = {
    getWorkflowShares: vi.fn(async () => ({ data: { owner: OWNER, results: [ANN] } })),
    addWorkflowShare: vi.fn(async (_id, { email, role }) => ({ data: { user_id: 9, email, name: 'Bo', role } })),
    updateWorkflowShare: vi.fn(async (_id, userId, role) => ({ data: { ...ANN, user_id: userId, role } })),
    removeWorkflowShare: vi.fn(async () => ({ data: null })),
  }
})
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

describe('WfShareDialog', () => {
  it('opens as a labelled dialog with the owner and each person with their role', async () => {
    mountDialog()
    await tick()
    const dialog = q('[role="dialog"]')
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('Share workflow')
    expect(api.getWorkflowShares).toHaveBeenCalledWith(86)
    const rows = qa('.wfs-row')
    expect(rows[0].textContent).toContain('Olga Owner')
    expect(rows[0].textContent).toContain('Owner')
    expect(rows[0].querySelector('select')).toBeNull()
    const role = rows[1].querySelector('select')
    expect(role.getAttribute('aria-label')).toBe('Role of Ann')
    expect(role.value).toBe('viewer')
    expect([...role.options].map((o) => o.textContent)).toEqual(['Viewer', 'Runner', 'Editor'])
    const remove = rows[1].querySelector('button')
    expect(remove.getAttribute('aria-label')).toBe('Remove Ann')
    expect(remove.getAttribute('title')).toBe('Remove Ann')
  })

  it('adds a person by email and role', async () => {
    mountDialog()
    await tick()
    const email = q('input[name="share-email"]')
    email.value = ' bo@x.test '
    email.dispatchEvent(new Event('input'))
    const role = q('select[name="share-role"]')
    role.value = 'editor'
    role.dispatchEvent(new Event('change'))
    await tick()
    q('form.wfs-add').dispatchEvent(new Event('submit'))
    await tick()
    expect(api.addWorkflowShare).toHaveBeenCalledWith(86, { email: 'bo@x.test', role: 'editor' })
    expect(qa('.wfs-row')).toHaveLength(3)
    expect(qa('.wfs-row')[2].querySelector('select').value).toBe('editor')
    expect(email.value).toBe('')
    expect(document.body.textContent).toContain('Shared with Bo as Editor.')
  })

  for (const [code, error] of [
    ['not_workspace_member', 'bo@x.test is not a member of this workspace.'],
    ['already_shared', 'This workflow is already shared with bo@x.test.'],
    ['bad_role', 'Choose viewer, runner or editor.'],
    ['is_owner', 'You own this workflow.'],
  ]) {
    it(`shows the server sentence when adding is refused (${code})`, async () => {
      api.addWorkflowShare.mockRejectedValueOnce(refusal(400, error, code))
      mountDialog()
      await tick()
      const email = q('input[name="share-email"]')
      email.value = 'bo@x.test'
      email.dispatchEvent(new Event('input'))
      await tick()
      q('form.wfs-add').dispatchEvent(new Event('submit'))
      await tick()
      expect(q('.wfs-msg.is-error[role="alert"]').textContent).toContain(error)
      expect(qa('.wfs-row')).toHaveLength(2)
      expect(email.value).toBe('bo@x.test')
    })
  }

  it('changes a role at once, and a refused change goes back to the role the server has', async () => {
    mountDialog()
    await tick()
    const role = qa('.wfs-row')[1].querySelector('select')
    role.value = 'runner'
    role.dispatchEvent(new Event('change'))
    await tick()
    expect(api.updateWorkflowShare).toHaveBeenCalledWith(86, 7, 'runner')
    expect(qa('.wfs-row')[1].querySelector('select').value).toBe('runner')

    api.updateWorkflowShare.mockRejectedValueOnce(refusal(403, 'Only the owner can share this workflow.', 'forbidden_role'))
    const again = qa('.wfs-row')[1].querySelector('select')
    again.value = 'editor'
    again.dispatchEvent(new Event('change'))
    await tick()
    expect(q('[role="alert"]').textContent).toContain('Only the owner can share this workflow.')
    expect(qa('.wfs-row')[1].querySelector('select').value).toBe('runner')
  })

  it('removes a person only after the app confirm (never a native dialog)', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm')
    mountDialog()
    await tick()
    confirmMock.mockResolvedValueOnce(false)
    qa('.wfs-row')[1].querySelector('button').click()
    await tick()
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Remove Ann?', confirmText: 'Remove', danger: true }))
    expect(api.removeWorkflowShare).not.toHaveBeenCalled()
    qa('.wfs-row')[1].querySelector('button').click()
    await tick()
    expect(api.removeWorkflowShare).toHaveBeenCalledWith(86, 7)
    expect(qa('.wfs-row')).toHaveLength(1)
    expect(document.body.textContent).toContain('Not shared with anyone yet.')
    expect(nativeConfirm).not.toHaveBeenCalled()
    nativeConfirm.mockRestore()
  })

  it('a refused list (not the owner) shows the server sentence and Try again', async () => {
    api.getWorkflowShares.mockRejectedValueOnce(refusal(403, 'Only the owner can see who this workflow is shared with.', 'forbidden_role'))
    mountDialog()
    await tick()
    expect(q('[role="alert"]').textContent).toContain('Only the owner can see who this workflow is shared with.')
    button('Try again').click()
    await tick()
    expect(qa('.wfs-row')).toHaveLength(2)
  })

  it('a share whose person left the workspace is shown as inactive (it grants nothing) and can be removed', async () => {
    api.getWorkflowShares.mockResolvedValueOnce({ data: { owner: OWNER, results: [{ ...ANN, active: false }, { ...ANN, user_id: 8, name: 'Cy', email: 'cy@x.test', active: true }] } })
    mountDialog()
    await tick()
    const [, gone, kept] = qa('.wfs-row')
    expect(gone.classList.contains('is-inactive')).toBe(true)
    expect(gone.textContent).toContain('Inactive: no longer in this workspace, so this share grants nothing.')
    expect(kept.classList.contains('is-inactive')).toBe(false)
    expect(gone.querySelector('[aria-label="Remove Ann"]').disabled).toBe(false)
  })

  it('Done closes it', async () => {
    const { open } = mountDialog()
    await tick()
    button('Done').click()
    await tick()
    expect(open.value).toBe(false)
  })
})
