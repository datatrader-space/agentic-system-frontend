import { describe, it, expect, vi } from 'vitest'
import { usePermission, choiceForLabel } from './usePermission'

describe('usePermission — coding-agent permission cards', () => {
  it('consumes permission_request and ignores other events', () => {
    const send = vi.fn()
    const { permissionRequests, handlePermissionEvent } = usePermission(send, () => 'c1')
    expect(handlePermissionEvent({ type: 'assistant_typing' })).toBe(false)
    const card = { capability: 'create', path: '.env', options: ['Allow once', 'Deny'] }
    expect(handlePermissionEvent({ type: 'permission_request', card })).toBe(true)
    expect(permissionRequests.value).toHaveLength(1)
    expect(permissionRequests.value[0].card.path).toBe('.env')
  })

  it('respondPermission sends a mapped choice and dequeues', () => {
    const send = vi.fn()
    const { permissionRequests, handlePermissionEvent, respondPermission } = usePermission(send, () => 'c1')
    const card = { capability: 'create', path: '.env' }
    handlePermissionEvent({ type: 'permission_request', card })
    const choice = respondPermission(card, 'Always allow for this project')
    expect(choice).toBe('allow_project')
    expect(send).toHaveBeenCalledWith({ type: 'permission_response', card, choice: 'allow_project' })
    expect(permissionRequests.value).toHaveLength(0)
  })

  it('respondPermission accepts raw choice values too', () => {
    const send = vi.fn()
    const { respondPermission } = usePermission(send, () => 'c1')
    expect(respondPermission({}, 'allow_once')).toBe('allow_once')
    expect(respondPermission({}, 'deny')).toBe('deny')
  })

  it('choiceForLabel maps labels and falls back sensibly', () => {
    expect(choiceForLabel('Allow once')).toBe('allow_once')
    expect(choiceForLabel('Allow for this task')).toBe('allow_task')
    expect(choiceForLabel('Always allow for this project')).toBe('allow_project')
    expect(choiceForLabel('Deny')).toBe('deny')
    expect(choiceForLabel('something weird')).toBe('allow_once')
  })
})
