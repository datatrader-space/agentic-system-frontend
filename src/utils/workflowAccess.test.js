// Who may do what with a workflow, as the server says (ADM-1339). These helpers only choose which controls show.
import { describe, it, expect } from 'vitest'
import { approvalDecider, readApprovers, serverSentence, workflowAbilities, workflowCan, workflowRole } from './workflowAccess'

describe('workflow roles', () => {
  it('each role has the abilities of the contract, and nothing more', () => {
    expect(workflowAbilities('viewer')).toEqual({ read: true, run: false, edit: false, share: false, archive: false })
    expect(workflowAbilities('runner')).toEqual({ read: true, run: true, edit: false, share: false, archive: false })
    expect(workflowAbilities('editor')).toEqual({ read: true, run: true, edit: true, share: false, archive: false })
    expect(workflowAbilities('owner')).toEqual({ read: true, run: true, edit: true, share: true, archive: true })
  })

  it('a missing or unknown role is a viewer, and an unknown ability is never allowed', () => {
    expect(workflowRole(undefined)).toBe('viewer')
    expect(workflowRole('admin')).toBe('viewer')
    expect(workflowCan('admin', 'edit')).toBe(false)
    expect(workflowCan('owner', 'transfer_everything')).toBe(false)
  })
})

describe('approvalDecider', () => {
  it('offers the decision only on can_decide === true', () => {
    expect(approvalDecider({ can_decide: true }).canDecide).toBe(true)
    for (const output of [null, {}, { can_decide: 'true' }, { can_decide: 1 }, { can_decide: false }]) {
      expect(approvalDecider(output).canDecide).toBe(false)
    }
  })

  it('names the approvers, else the owner', () => {
    const two = { can_decide: false, approvers: [{ user_id: 1, name: 'Ann', email: 'a@x' }, { user_id: 2, name: '', email: 'b@x' }] }
    expect(approvalDecider(two).text).toBe('Waiting for Ann or b@x to decide.')
    const three = { approvers: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }
    expect(approvalDecider(three).text).toBe('Waiting for A, B or C to decide.')
    expect(approvalDecider({ approvers: [] }, { name: 'Olga' }).text).toBe('Waiting for the owner, Olga, to decide.')
    expect(approvalDecider({ approvers: [] }).text).toBe('Waiting for the owner to decide.')
  })
})

describe('readApprovers', () => {
  it('reads user ids, and the old free text as legacy', () => {
    expect(readApprovers([3, '4', 3, 'x', 2.5, null])).toEqual({ ids: [3, 4], legacy: '' })
    expect(readApprovers(' a@x, b@x ')).toEqual({ ids: [], legacy: 'a@x, b@x' })
    expect(readApprovers(undefined)).toEqual({ ids: [], legacy: '' })
    expect(readApprovers('')).toEqual({ ids: [], legacy: '' })
  })
})

describe('serverSentence', () => {
  it('prefers the server sentence, then a plain one for the code, then the status', () => {
    expect(serverSentence({ response: { status: 400, data: { error: 'Not a member.', code: 'not_workspace_member' } } }, 'X')).toBe('Not a member.')
    expect(serverSentence({ response: { status: 400, data: { code: 'already_shared' } } }, 'X')).toContain('already shared')
    expect(serverSentence({ response: { status: 500, data: {} } }, 'Not shared')).toBe('Not shared (error 500).')
    expect(serverSentence(new Error('net'), 'Not shared')).toBe('Not shared. Check your connection and try again.')
  })
})
