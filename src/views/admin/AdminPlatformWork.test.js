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
  builds_on: 'machine', builds_on_words: 'The platform machine', prepares_on: 'machine',
  prepares_on_words: 'The platform machine', places, updated_by: '', updated_at: null, machines, ...over })

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

  it('chooses where models are prepared and downloaded, one setting at a time', async () => {
    api.platformWorkAdmin.mockResolvedValue({ data: payload() })
    api.platformWorkSet.mockResolvedValueOnce({ data: payload({ prepares_on: 'runpod', prepares_on_words: 'RunPod' }) })
    w = mount(AdminPlatformWork); await flushPromises()
    const radios = w.findAll('input[name="pw-prepares-on"]')
    expect(radios[0].element.checked).toBe(true)
    await radios[1].setValue(true); await flushPromises()
    expect(api.platformWorkSet).toHaveBeenCalledWith({ prepares_on: 'runpod' })
    expect(notifyMock.success).toHaveBeenCalledWith('Models are prepared and downloaded on RunPod from now on.')
  })

  it('shows each platform job with its live stage, build step and last lines, and reads them again while one runs', async () => {
    vi.useFakeTimers()
    try {
      const running = { id: 41, kind: 'image_build', job_kind: 'image_build', family: 'chat-serve', state: 'running',
        state_label: 'Running', machine: { id: 3, name: 'cd2ccc296f7f' }, stage: 'running', build_step: '12/40',
        log_tail: ['INFO[0042] RUN pip install torch', 'Collecting torch'], failure: '', log_end: '', reported_at: null }
      const failed = { id: 40, kind: 'image_build', job_kind: 'image_build', family: 'vision-serve', state: 'failed',
        state_label: 'Failed', machine: { id: 3, name: 'cd2ccc296f7f' }, stage: 'running', build_step: '', log_tail: [],
        failure: 'cd2ccc296f7f stopped answering: no heartbeat for 3 minutes.', log_end: 'last line', reported_at: null }
      api.platformWorkAdmin.mockResolvedValue({ data: payload({ jobs: [running, failed] }) })
      w = mount(AdminPlatformWork); await flushPromises()
      const job = w.get('[data-test="pw-job-41"]')
      expect(job.text()).toContain('Build of chat-serve')
      expect(job.text()).toContain('stage running')
      expect(job.text()).toContain('step 12/40')
      const fold = job.get('button.pw-fold')
      expect(fold.attributes('aria-expanded')).toBe('false')
      await fold.trigger('click')
      expect(fold.attributes('aria-expanded')).toBe('true')
      expect(job.get('pre').text()).toBe('INFO[0042] RUN pip install torch\nCollecting torch')
      const ended = w.get('[data-test="pw-job-40"]')
      expect(ended.text()).toContain('stopped answering')
      expect(ended.text()).toContain('The end of its log')
      expect(api.platformWorkAdmin).toHaveBeenCalledTimes(1)
      api.platformWorkAdmin.mockResolvedValue({ data: payload({ jobs: [{ ...running, state: 'done', state_label: 'Done', log_tail: [] }] }) })
      await vi.advanceTimersByTimeAsync(10000); await flushPromises()
      expect(api.platformWorkAdmin).toHaveBeenCalledTimes(2)                  // read again while one ran
      expect(w.get('[data-test="pw-job-41"]').text()).toContain('Done')
      await vi.advanceTimersByTimeAsync(30000); await flushPromises()
      expect(api.platformWorkAdmin).toHaveBeenCalledTimes(2)                  // none runs: not read again
    } finally { vi.useRealTimers() }
  })

  it('says when no platform job has run', async () => {
    api.platformWorkAdmin.mockResolvedValue({ data: payload() })
    w = mount(AdminPlatformWork); await flushPromises()
    expect(w.get('[data-test="pw-jobs-empty"]').text()).toContain('No platform job has run yet.')
  })

  it('says why the settings could not be read', async () => {
    api.platformWorkAdmin.mockRejectedValue({ response: { status: 403, data: { error: 'Platform administrators only.' } } })
    w = mount(AdminPlatformWork); await flushPromises()
    expect(w.get('[data-test="pw-load-error"]').text()).toContain('Platform administrators only.')
  })
})
