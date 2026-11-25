// @vitest-environment jsdom
// The admin page "Platform work" (backend platform_work.py, PLATFORM_OFF_RUNPOD_PLAN.md, ADM-1365): the platform machine
// and where images are built; each change is saved one at a time and the server's refusal is said as it is.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({ platformWorkAdmin: vi.fn(), platformWorkSet: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))
const notifyMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('../../composables/useNotify', () => ({ notify: notifyMock }))

import AdminPlatformWork from './AdminPlatformWork.vue'

const places = [{ value: 'machine', label: 'The platform machine' }, { value: 'runpod', label: 'RunPod' }]
const machines = [{ id: 3, name: 'cd2ccc296f7f', workspace: 'Default', online: true },
  { id: 9, name: 'old box', workspace: 'Lab', online: false }]
const payload = (over = {}) => ({ machine: null, machine_refusal: 'No platform machine is chosen. Choose one in Admin → Platform work.',
  builds_on: 'machine', builds_on_words: 'The platform machine', places, updated_by: '', updated_at: null, machines, ...over })

let w
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { w?.unmount() })

describe('Platform work', () => {
  it('says no machine is chosen, lists the admin\'s machines and saves the one picked', async () => {
    api.platformWorkAdmin.mockResolvedValue({ data: payload() })
    api.platformWorkSet.mockResolvedValue({ data: payload({ machine: { id: 3, name: 'cd2ccc296f7f', workspace: 'Default' }, machine_refusal: '' }) })
    w = mount(AdminPlatformWork); await flushPromises()
    expect(w.get('[data-test="pw-machine-state"]').text()).toContain('No platform machine is chosen')
    expect(w.findAll('#pw-machine-pick option').map(o => o.text())).toEqual(['Choose a machine', 'cd2ccc296f7f · Default', 'old box · Lab (offline)'])
    await w.get('#pw-machine-pick').setValue('3')
    await w.get('[data-test="pw-machine-save"]').trigger('click'); await flushPromises()
    expect(api.platformWorkSet).toHaveBeenCalledWith({ machine: 3 })
    expect(w.get('[data-test="pw-machine-state"]').text()).toContain('cd2ccc296f7f is online and can run platform work.')
    expect(notifyMock.success).toHaveBeenCalledWith('Platform machine saved.')
  })

  it('chooses RunPod for builds only when the admin picks it, and says a refusal in the server\'s words', async () => {
    api.platformWorkAdmin.mockResolvedValue({ data: payload() })
    api.platformWorkSet.mockResolvedValueOnce({ data: payload({ builds_on: 'runpod', builds_on_words: 'RunPod' }) })
    w = mount(AdminPlatformWork); await flushPromises()
    expect(api.platformWorkSet).not.toHaveBeenCalled()                    // nothing is chosen by the page itself
    await w.findAll('input[name="pw-builds-on"]')[1].setValue(true); await flushPromises()
    expect(api.platformWorkSet).toHaveBeenCalledWith({ builds_on: 'runpod' })
    expect(notifyMock.success).toHaveBeenCalledWith('Images are built on RunPod from now on.')
    api.platformWorkSet.mockRejectedValueOnce({ response: { data: { error: 'That machine is not one of yours.' } } })
    await w.get('#pw-machine-pick').setValue('9')
    await w.get('[data-test="pw-machine-save"]').trigger('click'); await flushPromises()
    expect(notifyMock.error).toHaveBeenCalledWith('That machine is not one of yours.')
  })

  it('says why the settings could not be read', async () => {
    api.platformWorkAdmin.mockRejectedValue({ response: { status: 403, data: { error: 'Platform administrators only.' } } })
    w = mount(AdminPlatformWork); await flushPromises()
    expect(w.get('[data-test="pw-load-error"]').text()).toContain('Platform administrators only.')
  })
})
