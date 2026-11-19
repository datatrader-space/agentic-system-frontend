// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  readyModelsAdmin: vi.fn(),
  readyModelStart: vi.fn(),
  readyModelStop: vi.fn(),
  readyModelSetPrice: vi.fn(),
  readyModelAcceptLicence: vi.fn(),
}))
vi.mock('../../services/api', () => ({ default: api }))
const notifyMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('../../composables/useNotify', () => ({ notify: notifyMock }))

import AdminReadyModels from './AdminReadyModels.vue'

// The admin API shapes (backend FIND_OBJECTS_AND_OWN_CLASSES_PLAN.md section 10.5).
const sam = (over = {}) => ({ key: 'sam3', name: 'SAM 3', state: 'off', host: '', machine: null, usd_per_image: null,
  price_text: '', started_by: null, started_at: null, stopped_at: null, failure_reason: '', free_per_day: 20, ...over })
const machines = [
  { id: 4, name: 'Studio PC', workspace: 'Northrays', gpu: 'RTX 4090 24 GB', online: true, licence: 'accepted', unavailable: '' },
  { id: 5, name: 'Old box', workspace: 'Lab', gpu: 'GTX 1060 6 GB', online: true, licence: 'needed', unavailable: 'The SAM License is not accepted for Lab.' },
]
const payload = (model = sam()) => ({ models: [model], machines })

let w
beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  notifyMock.error.mockReset(); notifyMock.success.mockReset()
  api.readyModelsAdmin.mockResolvedValue({ data: payload() })
})
afterEach(() => { w?.unmount(); vi.useRealTimers() })

async function render() { w = mount(AdminReadyModels, { attachTo: document.body }); await flushPromises(); return w }

describe('AdminReadyModels', () => {
  it('lists each model from the API with its state, place, price words and free tries', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { machines, models: [
      sam({ state: 'on', host: 'machine', machine: { id: 4, name: 'Studio PC', gpu: 'RTX 4090 24 GB' },
        usd_per_image: '0.002', price_text: '$0.002 an image', started_by: 'sajid', started_at: '2026-11-19T10:00:00Z' }),
      sam({ key: 'other', name: 'Other model', state: 'failed', failure_reason: 'RunPod has no GPU free.' }),
    ] } })
    await render()
    const card = w.get('[data-test="rm-model-sam3"]')
    expect(card.get('[data-test="rm-state"]').text()).toBe('On')
    expect(card.get('[data-test="rm-where"]').text()).toBe('Studio PC · RTX 4090 24 GB')
    expect(card.get('[data-test="rm-started"]').text()).toContain('by sajid')
    expect(card.get('[data-test="rm-free"]').text()).toBe('20 a person a day')
    expect(card.get('[data-test="rm-price-now"]').text()).toContain('$0.002 an image')
    expect(card.find('[data-test="rm-stop"]').exists()).toBe(true)
    const failed = w.get('[data-test="rm-model-other"]')
    expect(failed.get('[data-test="rm-state"]').text()).toBe('Failed')
    expect(failed.get('[data-test="rm-failure"]').text()).toBe('RunPod has no GPU free.')
    expect(failed.get('[data-test="rm-price-now"]').text()).toContain('Every paid call is refused until a price is set')
  })

  it('offers RunPod and the machines, a machine that cannot run it disabled with its reason', async () => {
    await render()
    const opts = w.get('[data-test="rm-host"]').findAll('option')
    expect(opts.map(o => o.text())).toEqual(['RunPod', 'Studio PC · RTX 4090 24 GB',
      'Old box · GTX 1060 6 GB (The SAM License is not accepted for Lab.)'])
    expect(opts[2].attributes('disabled')).toBeDefined()
    expect(opts[1].attributes('disabled')).toBeUndefined()
  })

  it('starts on RunPod with the right call and shows Starting, then polls every 5 seconds until it is on', async () => {
    vi.useFakeTimers()
    api.readyModelStart.mockResolvedValue({ data: sam({ state: 'starting', host: 'runpod' }) })
    await render()
    await w.get('[data-test="rm-start"]').trigger('click')
    await flushPromises()
    expect(api.readyModelStart).toHaveBeenCalledExactlyOnceWith('sam3', { host: 'runpod' })
    expect(w.get('[data-test="rm-state"]').text()).toBe('Starting')
    expect(w.get('[data-test="rm-live"]').text()).toBe('SAM 3 is Starting.')
    api.readyModelsAdmin.mockResolvedValue({ data: payload(sam({ state: 'on', host: 'runpod' })) })
    expect(api.readyModelsAdmin).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.readyModelsAdmin).toHaveBeenCalledTimes(2)
    expect(w.get('[data-test="rm-state"]').text()).toBe('On')
    await vi.advanceTimersByTimeAsync(15000)
    expect(api.readyModelsAdmin).toHaveBeenCalledTimes(2)   // nothing is starting: no more polling
  })

  it('stops polling when the page is left', async () => {
    vi.useFakeTimers()
    api.readyModelsAdmin.mockResolvedValue({ data: payload(sam({ state: 'starting', host: 'runpod' })) })
    await render()
    w.unmount(); w = null
    await vi.advanceTimersByTimeAsync(20000)
    expect(api.readyModelsAdmin).toHaveBeenCalledTimes(1)
  })

  it('starts on a machine with its id', async () => {
    api.readyModelStart.mockResolvedValue({ data: sam({ state: 'starting', host: 'machine', machine: { id: 4, name: 'Studio PC', gpu: 'RTX 4090 24 GB' } }) })
    await render()
    await w.get('[data-test="rm-host"]').setValue('machine:4')
    await w.get('[data-test="rm-start"]').trigger('click')
    await flushPromises()
    expect(api.readyModelStart).toHaveBeenCalledExactlyOnceWith('sam3', { host: 'machine', machine: 4 })
  })

  it('asks in the page before a stop, and stops only on yes', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: payload(sam({ state: 'on', host: 'runpod' })) })
    api.readyModelStop.mockResolvedValue({ data: sam({ state: 'off', stopped_at: '2026-11-19T11:00:00Z' }) })
    await render()
    await w.get('[data-test="rm-stop"]').trigger('click')
    expect(w.get('[data-test="rm-stop-confirm"]').text()).toContain('Stop SAM 3? Every call is refused until it is started again')
    expect(api.readyModelStop).not.toHaveBeenCalled()
    await w.get('[data-test="rm-stop-yes"]').trigger('click')
    await flushPromises()
    expect(api.readyModelStop).toHaveBeenCalledExactlyOnceWith('sam3')
    expect(w.find('[data-test="rm-stop-confirm"]').exists()).toBe(false)
    expect(w.get('[data-test="rm-state"]').text()).toBe('Off')
  })

  it('saves the price as usd_per_image, and empty as not for sale', async () => {
    api.readyModelSetPrice.mockResolvedValueOnce({ data: sam({ usd_per_image: '0.002', price_text: '$0.002 an image' }) })
    await render()
    await w.get('[data-test="rm-price"]').setValue('0.002')
    await w.get('form.rm-price').trigger('submit')
    await flushPromises()
    expect(api.readyModelSetPrice).toHaveBeenLastCalledWith('sam3', '0.002')
    expect(w.get('[data-test="rm-price-now"]').text()).toContain('$0.002 an image')
    api.readyModelSetPrice.mockResolvedValueOnce({ data: sam() })
    await w.get('[data-test="rm-price"]').setValue('')
    await w.get('form.rm-price').trigger('submit')
    await flushPromises()
    expect(api.readyModelSetPrice).toHaveBeenLastCalledWith('sam3', null)
  })

  it('refuses a price that is not a number, without a call', async () => {
    await render()
    for (const bad of ['abc', '-1', '0', '1e3']) {
      await w.get('[data-test="rm-price"]').setValue(bad)
      await w.get('form.rm-price').trigger('submit')
      expect(w.find('[data-test="rm-price-error"]').exists()).toBe(true)
    }
    expect(api.readyModelSetPrice).not.toHaveBeenCalled()
  })

  it("shows the server's words when a start is refused", async () => {
    api.readyModelStart.mockRejectedValue({ response: { status: 400, data: { error: 'Studio PC is offline.' } } })
    await render()
    await w.get('[data-test="rm-start"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="rm-error"]').text()).toBe('Studio PC is offline.')
    expect(notifyMock.error).toHaveBeenCalledWith('Studio PC is offline.')
  })

  it('accepts the SAM License for a workspace only after the in-page confirmation', async () => {
    api.readyModelAcceptLicence.mockResolvedValue({ data: { ...machines[1], licence: 'accepted', unavailable: '' } })
    await render()
    await w.get('[data-test="rm-licence-5"]').trigger('click')
    expect(w.get('[data-test="rm-licence-confirm"]').text()).toContain('Accept the SAM License for Lab?')
    expect(api.readyModelAcceptLicence).not.toHaveBeenCalled()
    await w.get('[data-test="rm-licence-yes"]').trigger('click')
    await flushPromises()
    expect(api.readyModelAcceptLicence).toHaveBeenCalledExactlyOnceWith(5)
    expect(api.readyModelsAdmin).toHaveBeenCalledTimes(2)
  })

  it('says so when nothing is in the catalogue, and shows a load error with Try again', async () => {
    api.readyModelsAdmin.mockResolvedValueOnce({ data: { models: [], machines: [] } })
    await render()
    expect(w.get('[data-test="rm-empty"]').text()).toContain('No ready-to-use model')
    w.unmount()
    api.readyModelsAdmin.mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Platform administrators only.' } } })
    await render()
    expect(w.get('[data-test="rm-load-error"]').text()).toContain('Platform administrators only.')
  })
})
