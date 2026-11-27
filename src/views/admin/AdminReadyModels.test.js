// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  readyModelsAdmin: vi.fn(),
  readyModelStart: vi.fn(),
  readyModelStop: vi.fn(),
  readyModelSetPrice: vi.fn(),
  readyModelSetAdminOnly: vi.fn(),
  readyModelAcceptLicence: vi.fn(),
  readyModelCameraAdd: vi.fn(),
  readyModelCameraFetch: vi.fn(),
  readyModelCameraRemove: vi.fn(),
  readyModelSearch: vi.fn(),
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

// Only the model chosen is shown in the panel: choose it in the list as the admin does, then read its panel.
async function showModel(key) {
  await w.get(`[data-test="rm-row-${key}"]`).trigger('click')
  return w.get(`[data-test="rm-model-${key}"]`)
}
async function render() { w = mount(AdminReadyModels, { attachTo: document.body }); await flushPromises(); return w }

describe('AdminReadyModels', () => {
  it('lists each model from the API with its state, place, price words and free tries', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { machines, models: [
      sam({ state: 'on', host: 'machine', machine: { id: 4, name: 'Studio PC', gpu: 'RTX 4090 24 GB' },
        usd_per_image: '0.002', price_text: '$0.002 an image', started_by: 'sajid', started_at: '2026-11-19T10:00:00Z' }),
      sam({ key: 'other', name: 'Other model', state: 'failed', failure_reason: 'RunPod has no GPU free.' }),
    ] } })
    await render()
    const card = (await showModel('sam3'))
    expect(card.get('[data-test="rm-state"]').text()).toBe('On')
    expect(card.get('[data-test="rm-where"]').text()).toBe('Studio PC · RTX 4090 24 GB')
    expect(card.get('[data-test="rm-started"]').text()).toContain('by sajid')
    expect(card.get('[data-test="rm-free"]').text()).toBe('20 a person a day')
    expect(card.get('[data-test="rm-price-now"]').text()).toContain('$0.002 an image')
    expect(card.find('[data-test="rm-stop"]').exists()).toBe(true)
    const failed = (await showModel('other'))
    expect(failed.get('[data-test="rm-state"]').text()).toBe('Failed')
    expect(failed.get('[data-test="rm-failure"]').text()).toBe('RunPod has no GPU free.')
    expect(failed.get('[data-test="rm-price-now"]').text()).toContain('Every paid call is refused until a price is set')
  })

  it('offers RunPod and the machines, a machine that cannot run it disabled with its reason', async () => {
    await render()
    const opts = w.get('[data-test="rm-host"]').findAll('option')
    expect(opts.map(o => o.text())).toEqual(['Choose where it runs', 'RunPod', 'Studio PC · RTX 4090 24 GB',
      'Old box · GTX 1060 6 GB (The SAM License is not accepted for Lab.)'])
    expect(opts[3].attributes('disabled')).toBeDefined()
    expect(opts[2].attributes('disabled')).toBeUndefined()
    expect(w.get('[data-test="rm-host"]').element.value).toBe('runpod')    // no platform machine chosen: RunPod
  })

  // ADM-1365 phase 3: the platform machine is the default place; when it cannot take the model, nothing is picked.
  it('picks the platform machine by default, and nothing (never RunPod) when it cannot run the model', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam({ platform_machine: { id: 4, name: 'Studio PC' } })],
      machines, kinds } })
    await render()
    expect(w.get('[data-test="rm-host"]').element.value).toBe('machine:4')
    w.unmount()
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam({ platform_machine: { id: 5, name: 'Old box' } })],
      machines, kinds } })
    await render()
    expect(w.get('[data-test="rm-host"]').element.value).toBe('')
    expect(w.get('[data-test="rm-start"]').attributes('disabled')).toBeDefined()
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

  // Camera models (backend camera_models.py): rows the admin adds from Hugging Face, hosted and priced like SAM 3.
  const qwen = (over = {}) => sam({ key: 'qwen3-vl-8b', name: 'Qwen3-VL 8B', kind: 'vision', kind_label: 'Vision assistant',
    licence: 'Apache 2.0', gpu_gb: 22, files_ready: true, needs_licence: false,
    camera_model: { key: 'qwen3-vl-8b', parts: [{ repo: 'Qwen/Qwen3-VL-8B-Instruct', revision: '0c351dd01ed8', bytes: 1 }] },
    ...over })
  const fitted = [
    { ...machines[0], fits: { sam3: '', 'qwen3-vl-8b': '' } },
    { ...machines[1], gpu: 'RTX 3070 8 GB', fits: { sam3: 'The SAM License is not accepted for Lab.',
      'qwen3-vl-8b': 'Old box has no NVIDIA GPU with 22 GB of memory or more, which Qwen3-VL 8B needs.' } },
  ]
  const kinds = [{ key: 'detector', label: 'Object detector' }, { key: 'vision', label: 'Vision assistant' },
    { key: 'search', label: 'Search embeddings' }]

  it('says what a camera model does, its licence and GPU memory, and judges each machine for that model', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam(), qwen()], machines: fitted, kinds } })
    await render()
    const card = (await showModel('qwen3-vl-8b'))
    expect(card.get('[data-test="rm-kind"]').text()).toBe('Vision assistant')
    expect(card.get('[data-test="rm-licence"]').text()).toBe('Apache 2.0')
    expect(card.get('[data-test="rm-gpu"]').text()).toBe('22 GB')
    expect(card.get('[data-test="rm-files"]').text()).toContain('Qwen/Qwen3-VL-8B-Instruct @ 0c351dd01ed8')
    const opts = card.get('[data-test="rm-host"]').findAll('option')
    expect(opts[3].text()).toContain('no NVIDIA GPU with 22 GB')
    expect(opts[3].attributes('disabled')).toBeDefined()
    expect(card.find('[data-test="rm-remove"]').exists()).toBe(true)
    expect((await showModel('sam3')).find('[data-test="rm-remove"]').exists()).toBe(false)
  })

  // ADM-1344 part F: the two published models AADML hosts (kind walls) say where their files stand and can have them
  // made again, and are never removed (they are no camera models).
  it('shows a hosted walls model\'s files and offers to make them ready while they are not', async () => {
    const walls = (over = {}) => sam({ key: 'segformer-b0', name: 'Aadml-Vision-seg-A0', kind: 'walls',
      kind_label: 'Semantic segmentation: marks walls, windows and doors (fmw-predict.v1)',
      licence: 'NVIDIA research licence: research or evaluation use only', gpu_gb: 0, files_ready: false,
      files_text: 'Its files are being made ready by AADML.', ...over })
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam(), walls()], machines: fitted, kinds } })
    await render()
    const card = (await showModel('segformer-b0'))
    expect(card.get('[data-test="rm-fetching"]').text()).toBe('Its files are being made ready by AADML.')
    expect(card.get('[data-test="rm-files"]').text()).toBe('Being fetched (progress above)')
    expect(card.get('[data-test="rm-gpu"]').text()).toBe('None: it runs on a CPU too')
    expect(card.find('[data-test="rm-fetch"]').exists()).toBe(true)
    expect(card.find('[data-test="rm-remove"]').exists()).toBe(false)
    expect((await showModel('sam3')).find('[data-test="rm-files"]').exists()).toBe(false)
    w.unmount()
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [walls({ files_ready: true, files_text: '' })], machines: fitted, kinds } })
    await render()
    const ready = (await showModel('segformer-b0'))
    expect(ready.get('[data-test="rm-files"]').text()).toBe('Ready')
    expect(ready.find('[data-test="rm-fetch"]').exists()).toBe(false)
  })

  it('adds a camera model with the right call, checks the form first and shows the server\'s refusal', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam()], machines: fitted, kinds } })
    api.readyModelCameraAdd.mockRejectedValueOnce({ response: { status: 400, data: {
      error: 'Qwen/Qwen2.5-VL-3B-Instruct has no licence that allows commercial use (other).' } } })
    await render()
    const form = w.get('[data-test="rm-add"]')
    await form.get('form.rm-add-form').trigger('submit')
    expect(form.get('[data-test="rm-add-error"]').text()).toContain('owner/name')
    expect(api.readyModelCameraAdd).not.toHaveBeenCalled()
    await form.get('[data-test="rm-add-kind"]').setValue('vision')
    await form.get('[data-test="rm-add-repo"]').setValue('Qwen/Qwen2.5-VL-3B-Instruct')
    await form.get('[data-test="rm-add-key"]').setValue('qwen-3b')
    await form.get('form.rm-add-form').trigger('submit')
    await flushPromises()
    expect(form.get('[data-test="rm-add-error"]').text()).toContain('no licence that allows commercial use')
    api.readyModelCameraAdd.mockResolvedValueOnce({ data: qwen({ files_ready: false }) })
    await form.get('[data-test="rm-add-repo"]').setValue('Qwen/Qwen3-VL-8B-Instruct')
    await form.get('[data-test="rm-add-key"]').setValue('qwen3-vl-8b')
    await form.get('[data-test="rm-add-name"]').setValue('Qwen3-VL 8B')
    await form.get('[data-test="rm-add-gpu"]').setValue('22')
    await form.get('form.rm-add-form').trigger('submit')
    await flushPromises()
    expect(api.readyModelCameraAdd).toHaveBeenLastCalledWith({ key: 'qwen3-vl-8b', name: 'Qwen3-VL 8B', kind: 'vision',
      gpu_gb: 22, parts: [{ repo: 'Qwen/Qwen3-VL-8B-Instruct' }] })
    expect((await showModel('qwen3-vl-8b')).get('[data-test="rm-files"]').text()).toContain('Being fetched')
    expect(w.find('[data-test="rm-fetch"]').exists()).toBe(true)
  })

  it('sends a kind\'s own number with it', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam()], machines: fitted, kinds } })
    api.readyModelCameraAdd.mockResolvedValue({ data: qwen({ key: 'bge', kind: 'search' }) })
    await render()
    const form = w.get('[data-test="rm-add"]')
    await form.get('[data-test="rm-add-kind"]').setValue('search')
    await form.get('[data-test="rm-add-repo"]').setValue('BAAI/bge-small-en-v1.5')
    await form.get('[data-test="rm-add-key"]').setValue('bge')
    await form.get('[data-test="rm-add-tuning"]').setValue('0.7')
    await form.get('form.rm-add-form').trigger('submit')
    await flushPromises()
    expect(api.readyModelCameraAdd.mock.calls[0][0].tuning).toEqual({ near: 0.7 })
  })

  it('shows the machine\'s own progress while a model starts there, and updates it as it polls', async () => {
    vi.useFakeTimers()
    const starting = (label, percent) => qwen({ state: 'starting', host: 'machine', machine: { id: 4, name: 'Studio PC' },
      progress: { label, percent } })
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [starting('Downloading the model: model files, 1 GB of 4.3 GB (23%)', 23)],
      machines: fitted, kinds } })
    await render()
    const shown = w.get('[data-test="rm-model-qwen3-vl-8b"] [data-test="rm-progress"]')
    expect(shown.text()).toContain('model files, 1 GB of 4.3 GB (23%)')
    expect(shown.get('progress').attributes('value')).toBe('23')
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [starting('Downloading the model: its server image, 2 GB of 3.5 GB (57%)', 57)],
      machines: fitted, kinds } })
    await vi.advanceTimersByTimeAsync(5000)
    expect(w.get('[data-test="rm-progress"]').text()).toContain('its server image')
  })

  it('removes a camera model only after the in-page confirmation', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam(), qwen()], machines: fitted, kinds } })
    api.readyModelCameraRemove.mockResolvedValue({ status: 204 })
    await render()
    await (await showModel('qwen3-vl-8b')).get('[data-test="rm-remove"]').trigger('click')
    expect(w.get('[data-test="rm-remove-confirm"]').text()).toContain('Remove Qwen3-VL 8B from the list?')
    expect(api.readyModelCameraRemove).not.toHaveBeenCalled()
    await w.get('[data-test="rm-remove-yes"]').trigger('click')
    await flushPromises()
    expect(api.readyModelCameraRemove).toHaveBeenCalledExactlyOnceWith('qwen3-vl-8b')
    expect(w.find('[data-test="rm-model-qwen3-vl-8b"]').exists()).toBe(false)
  })

  // ADM-1365 phase 2b: the admin's chat and photo models, gated and non-commercial ones too.
  const allKinds = [...kinds, { key: 'chat', label: 'Chat model' }, { key: 'photo', label: 'Photo model' }]

  it('searches Hugging Face, says a non-commercial or gated model plainly, and fills the form from a result', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam()], machines: fitted, kinds: allKinds } })
    api.readyModelSearch.mockResolvedValue({ data: { results: [
      { repo: 'acme/research-lm', name: 'research-lm', licence_name: 'CC BY-NC 4.0', commercial: false, gated: false, kind: 'chat', addable: true },
      { repo: 'black-forest-labs/FLUX.1-dev', name: 'FLUX.1-dev', task: 'text-to-image', addable: false, kind: '',
        why_not: 'AADML has no server for text-to-image models yet, so it cannot be added now.' },
      { repo: 'meta-llama/Llama-3.2-1B-Instruct', name: 'Llama-3.2-1B-Instruct', licence_name: 'Llama 3.2', commercial: true,
        kind: 'chat', addable: true, gated: true, gated_note: "Accept its terms on AADML's Hugging Face account first." }] } })
    await render()
    const add = w.get('[data-test="rm-add"]')
    await add.get('[data-test="rm-search-q"]').setValue('llama')
    await add.get('form.rm-search').trigger('submit')
    await flushPromises()
    expect(api.readyModelSearch).toHaveBeenCalledWith({ q: 'llama', kind: 'all' })
    const found = add.get('[data-test="rm-found"]').text()
    expect(found).toContain('Not for commercial use: yours to test only')
    expect(found).toContain("Accept its terms on AADML's Hugging Face account first.")
    expect(found).toContain('no server for text-to-image models yet')
    expect(add.get('[data-test="rm-found-use-black-forest-labs/FLUX.1-dev"]').attributes('disabled')).toBeDefined()
    await add.get('[data-test="rm-found-use-meta-llama/Llama-3.2-1B-Instruct"]').trigger('click')
    expect(add.get('[data-test="rm-add-repo"]').element.value).toBe('meta-llama/Llama-3.2-1B-Instruct')
    expect(add.get('[data-test="rm-add-kind"]').element.value).toBe('chat')
    expect(add.get('[data-test="rm-add-key"]').element.value).toBe('llama-3-2-1b-instruct')
  })

  it('asks a photo model for its task before adding it, and sends it', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam()], machines: fitted, kinds: allKinds } })
    api.readyModelCameraAdd.mockResolvedValue({ data: qwen({ key: 'segformer-x', kind: 'photo' }) })
    await render()
    const form = w.get('[data-test="rm-add"]')
    await form.get('[data-test="rm-add-kind"]').setValue('photo')
    await form.get('[data-test="rm-add-repo"]').setValue('nvidia/segformer-x')
    await form.get('[data-test="rm-add-key"]').setValue('segformer-x')
    await form.get('form.rm-add-form').trigger('submit')
    expect(form.get('[data-test="rm-add-error"]').text()).toContain('Choose what the photo model does')
    expect(api.readyModelCameraAdd).not.toHaveBeenCalled()
    await form.get('[data-test="rm-add-task"]').setValue('image-segmentation')
    await form.get('form.rm-add-form').trigger('submit')
    await flushPromises()
    expect(api.readyModelCameraAdd.mock.calls[0][0].task).toBe('image-segmentation')
  })

  it('prices a chat model per 1,000 tokens and never prices a non-commercial one', async () => {
    const chat = qwen({ key: 'qwen3-small', kind: 'chat', price_unit: 'per 1,000 tokens', for_sale: true })
    const own = qwen({ key: 'research-lm', kind: 'chat', price_unit: 'per 1,000 tokens', for_sale: false })
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [chat, own], machines: fitted, kinds: allKinds } })
    await render()
    expect((await showModel('qwen3-small')).text()).toContain('Price per 1,000 tokens (USD)')
    const mine = (await showModel('research-lm'))
    expect(mine.get('[data-test="rm-price"]').attributes('disabled')).toBeDefined()
    expect(mine.get('[data-test="rm-price-now"]').text()).toContain('never offered to people or sold')
  })

  it('searches as the admin types, after a short pause, and shows only the newest answer', async () => {
    vi.useFakeTimers()
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam()], machines: fitted, kinds: allKinds } })
    let answerOld
    api.readyModelSearch
      .mockImplementationOnce(() => new Promise(resolve => { answerOld = resolve }))
      .mockResolvedValueOnce({ data: { results: [{ repo: 'Qwen/Qwen3-0.6B', name: 'Qwen3-0.6B', licence_name: 'Apache 2.0',
        commercial: true, gated: false, size: '0.6B', downloads: 1200, kind: 'chat', addable: true }] } })
    await render()
    const add = w.get('[data-test="rm-add"]')
    await add.get('[data-test="rm-search-q"]').setValue('q')
    await vi.advanceTimersByTimeAsync(500)
    expect(api.readyModelSearch).not.toHaveBeenCalled()                     // one letter: nothing asked
    expect(add.get('[data-test="rm-search-said"]').text()).toContain('Type at least 2 letters')
    await add.get('[data-test="rm-search-q"]').setValue('qw')
    await vi.advanceTimersByTimeAsync(200)
    expect(api.readyModelSearch).not.toHaveBeenCalled()                     // still typing
    await vi.advanceTimersByTimeAsync(300)
    expect(api.readyModelSearch).toHaveBeenLastCalledWith({ q: 'qw', kind: 'all' })
    await add.get('[data-test="rm-search-q"]').setValue('qwen3 0.6b')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
    expect(api.readyModelSearch).toHaveBeenLastCalledWith({ q: 'qwen3 0.6b', kind: 'all' })
    answerOld({ data: { results: [{ repo: 'old/answer', name: 'old' }] } })   // the older answer arrives last
    await flushPromises()
    const found = add.get('[data-test="rm-found"]').text()
    expect(found).toContain('Qwen/Qwen3-0.6B')
    expect(found).not.toContain('old/answer')
    expect(add.get('[data-test="rm-search-said"]').text()).toContain('The model for "qwen3 0.6b"')
    await add.get('[data-test="rm-found-use-Qwen/Qwen3-0.6B"]').trigger('click')
    expect(add.get('[data-test="rm-add-key"]').element.value).toBe('qwen3-0-6b')
    expect(add.find('[data-test="rm-found"]').exists()).toBe(false)                  // closed once one is chosen
    expect(add.get('[data-test="rm-search-said"]').text()).toContain('Qwen/Qwen3-0.6B is chosen')
  })

  // The owner, 2026-11-27: every model in one list; the chosen one opens its details beside it.
  const shownRows = () => w.get('[data-test="rm-table"]').findAll('button[data-test^="rm-row-"]').map(r => r.attributes('data-test'))

  it('shows one panel for the model chosen, a running one first, and a list of every model that opens a model', async () => {
    const on = qwen({ state: 'on', host: 'machine', machine: { id: 4, name: 'Studio PC' }, price_text: '$0.002 an image' })
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam(), on], machines: fitted, kinds } })
    await render()
    expect(w.findAll('[data-test^="rm-model-"]').length).toBe(1)
    expect(w.find('[data-test="rm-model-qwen3-vl-8b"]').exists()).toBe(true)                  // the running one first
    expect(w.get('[data-test="rm-row-qwen3-vl-8b"]').attributes('aria-current')).toBe('true')
    expect(shownRows()).toEqual(['rm-row-qwen3-vl-8b', 'rm-row-sam3'])
    expect(w.get('[data-test="rm-row-qwen3-vl-8b"]').text()).toContain('$0.002 an image')
    await w.get('[data-test="rm-row-sam3"]').trigger('click')
    expect(w.get('[data-test="rm-row-sam3"]').attributes('aria-current')).toBe('true')
    expect(w.find('[data-test="rm-model-sam3"]').exists()).toBe(true)
    expect(w.find('[data-test="rm-model-qwen3-vl-8b"]').exists()).toBe(false)
  })

  it('lists every model with its state in words, and says how many of all run', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { machines: fitted, kinds, models: [
      sam(), qwen({ state: 'on', host: 'runpod' }), qwen({ key: 'bad', name: 'Bad one', state: 'failed' }),
      qwen({ key: 'warm', name: 'Warm one', state: 'starting', host: 'runpod' })] } })
    await render()
    const states = Object.fromEntries(['sam3', 'qwen3-vl-8b', 'bad', 'warm'].map(k =>
      [k, w.get(`[data-test="rm-row-${k}"] [data-test="rm-row-state"]`).text()]))
    expect(states).toEqual({ sam3: 'Off', 'qwen3-vl-8b': 'On', bad: 'Failed', warm: 'Starting' })
    expect(w.get('[data-test="rm-running"]').text()).toBe('1 of 4 running')
    expect(w.get('[data-test="rm-filter-failed"]').text()).toContain('1')
  })

  it('filters the list by state, kind and name, and offers to show every model when none matches', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { machines: fitted, kinds, models: [
      sam({ kind: 'segment', kind_label: 'Outlines (SAM 3)' }), qwen({ state: 'on', host: 'runpod' }),
      qwen({ key: 'bge', name: 'BGE small', kind: 'search', kind_label: 'Search embeddings' })] } })
    await render()
    await w.get('[data-test="rm-filter-on"]').trigger('click')
    expect(w.get('[data-test="rm-filter-on"]').attributes('aria-pressed')).toBe('true')
    expect(shownRows()).toEqual(['rm-row-qwen3-vl-8b'])
    await w.get('[data-test="rm-filter-all"]').trigger('click')
    await w.get('[data-test="rm-kind-filter"]').setValue('search')
    expect(shownRows()).toEqual(['rm-row-bge'])
    await w.get('[data-test="rm-kind-filter"]').setValue('')
    await w.get('[data-test="rm-name-filter"]').setValue('sam')
    expect(shownRows()).toEqual(['rm-row-sam3'])
    await w.get('[data-test="rm-name-filter"]').setValue('nothing like it')
    expect(w.get('[data-test="rm-none"]').text()).toContain('No model matches')
    await w.get('[data-test="rm-none"] button').trigger('click')
    expect(shownRows().length).toBe(3)
  })

  it("shows the fetch of a model's files as progress, with a bar when the server gives its share", async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { machines: fitted, kinds, models: [qwen({ files_ready: false,
      files_text: 'Uploading its files to AADML from Studio PC: 1.8 of 5.1 GB (35%), 2.4 MB/s.' })] } })
    await render()
    const wait = w.get('[data-test="rm-fetching"]')
    expect(wait.text()).toContain('1.8 of 5.1 GB (35%)')
    expect(wait.get('[data-test="rm-files-bar"]').attributes('value')).toBe('35')
    expect(w.get('[data-test="rm-row-qwen3-vl-8b"]').text()).toContain('Fetching its files')
  })

  it('polls every 5 seconds only while a model starts or its files are fetched, and stops when nothing is', async () => {
    vi.useFakeTimers()
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam(), qwen()], machines: fitted, kinds } })
    await render()
    await vi.advanceTimersByTimeAsync(20000)
    expect(api.readyModelsAdmin).toHaveBeenCalledTimes(1)                    // nothing in progress: no polling
    w.unmount()
    api.readyModelsAdmin.mockReset()
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam(), qwen({ files_ready: false, files_text: 'Fetching its files on Studio PC.' })],
      machines: fitted, kinds } })
    await render()
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.readyModelsAdmin).toHaveBeenCalledTimes(2)
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam(), qwen()], machines: fitted, kinds } })
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.readyModelsAdmin).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(20000)
    expect(api.readyModelsAdmin).toHaveBeenCalledTimes(3)                    // files ready: no more polling
    w.unmount()
    api.readyModelsAdmin.mockReset()
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [qwen({ files_ready: false,
      files_text: 'Its files could not be fetched: the disk is full.' })], machines: fitted, kinds } })
    await render()
    await vi.advanceTimersByTimeAsync(20000)
    expect(api.readyModelsAdmin).toHaveBeenCalledTimes(1)                    // a failed fetch is not in progress
    expect(w.get('[data-test="rm-files"]').text()).toContain('could not be fetched')
  })

  it('asks in a dialog before a remove, keeps the model on Keep it, and cannot remove a running one', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam(), qwen()], machines: fitted, kinds } })
    await render()
    await (await showModel('qwen3-vl-8b')).get('[data-test="rm-remove"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="rm-remove-confirm"]').attributes('role')).toBe('alertdialog')
    expect(document.activeElement).toBe(w.get('[data-test="rm-remove-no"]').element)   // the safe choice first
    await w.get('[data-test="rm-remove-no"]').trigger('click')
    expect(w.find('[data-test="rm-remove-confirm"]').exists()).toBe(false)
    expect(api.readyModelCameraRemove).not.toHaveBeenCalled()
    w.unmount()
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [qwen({ state: 'on', host: 'runpod' })], machines: fitted, kinds } })
    await render()
    expect(w.get('[data-test="rm-remove"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="rm-model-qwen3-vl-8b"]').text()).toContain('Stop it first to remove it.')
  })

  it('says why Start cannot be pressed', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam({ platform_machine: { id: 5, name: 'Old box' } })], machines, kinds } })
    await render()
    expect(w.get('[data-test="rm-start"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="rm-host-help"]').text()).toBe('Choose where it runs to start it.')
  })

  it('fills the GPU memory from the search row, and never says a GPU kind runs on a CPU', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam()], machines: fitted, kinds: allKinds } })
    api.readyModelSearch.mockResolvedValue({ data: { results: [
      { repo: 'Qwen/Qwen3-8B', name: 'Qwen3-8B', kind: 'chat', task: 'text-generation', addable: true, parameters: 8e9, need_gb_run: 20 },
      { repo: 'acme/no-size', name: 'no-size', kind: 'chat', task: 'text-generation', addable: true }] } })
    api.readyModelCameraAdd.mockResolvedValue({ data: qwen({ key: 'qwen3-8b', kind: 'chat' }) })
    await render()
    const add = w.get('[data-test="rm-add"]')
    await add.get('[data-test="rm-search-q"]').setValue('qwen')
    await add.get('form.rm-search').trigger('submit')
    await flushPromises()
    expect(add.get('[data-test="rm-found"]').text()).toContain('To run: about 20 GB GPU')
    await add.get('[data-test="rm-found-use-Qwen/Qwen3-8B"]').trigger('click')
    expect(add.get('[data-test="rm-add-gpu"]').element.value).toBe('20')
    expect(add.get('[data-test="rm-add-gpu-help"]').text()).toContain('About 20 GB to run')
    await add.get('form.rm-add-form').trigger('submit')
    await flushPromises()
    expect(api.readyModelCameraAdd.mock.calls[0][0]).toMatchObject({ key: 'qwen3-8b', kind: 'chat', gpu_gb: 20, task: 'text-generation' })
    // No size in the row: the field stays empty (the server works it out), and its words never say a CPU will do.
    await add.get('[data-test="rm-search-q"]').setValue('size')
    await add.get('form.rm-search').trigger('submit')
    await flushPromises()
    await add.get('[data-test="rm-found-use-acme/no-size"]').trigger('click')
    const gpu = add.get('[data-test="rm-add-gpu"]')
    expect(gpu.element.value).toBe('')
    expect(gpu.attributes('placeholder')).not.toContain('CPU')
    await gpu.setValue('0')
    expect(add.get('[data-test="rm-add-gpu-help"]').text()).toContain('runs only on a GPU')
    await add.get('form.rm-add-form').trigger('submit')
    expect(api.readyModelCameraAdd).toHaveBeenCalledTimes(1)
  })

  it('checks the key as the admin types it', async () => {
    await render()
    const add = w.get('[data-test="rm-add"]')
    await add.get('[data-test="rm-add-key"]').setValue('Bad Key')
    expect(add.get('[data-test="rm-add-key"]').attributes('aria-invalid')).toBe('true')
    expect(add.get('[data-test="rm-add-key-help"]').text()).toContain('3 to 40 lowercase letters')
    expect(add.get('[data-test="rm-add-key-help"]').classes()).toContain('rm-error')
    await add.get('[data-test="rm-add-key"]').setValue('good-key')
    expect(add.get('[data-test="rm-add-key"]').attributes('aria-invalid')).toBe('false')
  })

  it('shows at most 10 results, and opens the list again when the admin types', async () => {
    vi.useFakeTimers()
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam()], machines: fitted, kinds: allKinds } })
    const many = Array.from({ length: 50 }, (_, i) => ({ repo: `org/model-${i}`, name: `model-${i}`, kind: 'chat', addable: true }))
    api.readyModelSearch.mockResolvedValue({ data: { results: many } })
    await render()
    const add = w.get('[data-test="rm-add"]')
    await add.get('[data-test="rm-search-q"]').setValue('model')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
    expect(add.get('[data-test="rm-found"]').findAll('li').length).toBe(10)
    await add.get('[data-test="rm-found-use-org/model-3"]').trigger('click')
    expect(add.find('[data-test="rm-found"]').exists()).toBe(false)
    await add.get('[data-test="rm-search-q"]').setValue('model x')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
    expect(add.find('[data-test="rm-found"]').exists()).toBe(true)
  })

  // Admin only (owner, 2026-11-26): everyone sees it in Ready to use; only platform administrators use it.
  it('ticks Admin only with its own call, and a licence-locked model cannot be unticked', async () => {
    api.readyModelSetAdminOnly.mockResolvedValueOnce({ data: sam({ admin_only: true }) })
    await render()
    const box = w.get('[data-test="rm-admin-only"]')
    expect(box.element.checked).toBe(false)
    await box.setValue(true)
    await flushPromises()
    expect(api.readyModelSetAdminOnly).toHaveBeenLastCalledWith('sam3', true)
    expect(w.get('[data-test="rm-admin-only-help"]').text()).toContain('only platform administrators')
    expect(w.get('[data-test="rm-admin-tag"]').text()).toBe('Admin only')
  })

  it('shows a non-commercial model as admin only, locked', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: payload(sam({ admin_only: true, admin_only_locked: true, for_sale: false })) })
    await render()
    const box = w.get('[data-test="rm-admin-only"]')
    expect(box.element.checked).toBe(true)
    expect(box.attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="rm-admin-only-help"]').text()).toContain('stays admin only')
  })

  // ADM-1365 phase 2c: image and video generation models are added from the same form.
  it('offers Image generation and Video generation, and sends a generation model with its task', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam()], machines: fitted, kinds: allKinds } })
    api.readyModelCameraAdd.mockResolvedValue({ data: qwen({ key: 'sdxl-turbo', kind: 'image_gen', price_unit: 'an image' }) })
    await render()
    const form = w.get('[data-test="rm-add"]')
    const options = form.get('[data-test="rm-add-kind"]').findAll('option')
    expect(options.map(o => [o.element.value, o.text()])).toEqual(expect.arrayContaining([['image_gen', 'Image generation'], ['video_gen', 'Video generation']]))
    await form.get('[data-test="rm-add-kind"]').setValue('image_gen')
    expect(form.get('[data-test="rm-add-media-task"]').findAll('option').map(o => o.element.value)).toEqual(['', 'text-to-image', 'image-to-image'])
    await form.get('[data-test="rm-add-repo"]').setValue('stabilityai/sdxl-turbo')
    await form.get('[data-test="rm-add-key"]').setValue('sdxl-turbo')
    await form.get('form.rm-add-form').trigger('submit')
    expect(form.get('[data-test="rm-add-error"]').text()).toContain('Choose what the model makes its result from')
    expect(api.readyModelCameraAdd).not.toHaveBeenCalled()
    await form.get('[data-test="rm-add-media-task"]').setValue('text-to-image')
    await form.get('form.rm-add-form').trigger('submit')
    await flushPromises()
    expect(api.readyModelCameraAdd.mock.calls[0][0]).toMatchObject({ kind: 'image_gen', task: 'text-to-image', key: 'sdxl-turbo' })
    await form.get('[data-test="rm-add-kind"]').setValue('video_gen')
    expect(form.get('[data-test="rm-add-media-task"]').findAll('option').map(o => o.element.value)).toEqual(['', 'text-to-video', 'image-to-video'])
  })

  it('fills the kind and task from a generation or video understanding search result', async () => {
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [sam()], machines: fitted, kinds: allKinds } })
    api.readyModelSearch.mockResolvedValue({ data: { results: [
      { repo: 'stabilityai/sdxl-turbo', name: 'sdxl-turbo', task: 'text-to-image', kind: 'image_generation', addable: true },
      { repo: 'timbrooks/instruct-pix2pix', name: 'instruct-pix2pix', task: 'image-to-image', kind: 'image_generation', addable: true },
      { repo: 'Wan-AI/Wan2.1-T2V-1.3B', name: 'Wan2.1-T2V-1.3B', task: 'text-to-video', kind: 'video_generation', addable: true },
      { repo: 'Wan-AI/Wan2.1-I2V-14B', name: 'Wan2.1-I2V-14B', task: 'image-to-video', kind: 'video_generation', addable: true },
      { repo: 'llava-hf/LLaVA-NeXT-Video-7B-hf', name: 'LLaVA-NeXT-Video-7B-hf', task: 'video-text-to-text', kind: 'video_understanding', addable: true },
    ] } })
    await render()
    const add = w.get('[data-test="rm-add"]')
    const pick = async repo => {
      await add.get('[data-test="rm-search-q"]').setValue(`find ${repo}`)
      await add.get('form.rm-search').trigger('submit')
      await flushPromises()
      await add.get(`[data-test="rm-found-use-${repo}"]`).trigger('click')
      const task = add.find('[data-test="rm-add-media-task"]')
      return [add.get('[data-test="rm-add-kind"]').element.value, task.exists() ? task.element.value : '']
    }
    expect(await pick('stabilityai/sdxl-turbo')).toEqual(['image_gen', 'text-to-image'])
    expect(await pick('timbrooks/instruct-pix2pix')).toEqual(['image_gen', 'image-to-image'])
    expect(await pick('Wan-AI/Wan2.1-T2V-1.3B')).toEqual(['video_gen', 'text-to-video'])
    expect(await pick('Wan-AI/Wan2.1-I2V-14B')).toEqual(['video_gen', 'image-to-video'])
    expect(await pick('llava-hf/LLaVA-NeXT-Video-7B-hf')).toEqual(['chat', ''])
  })

  it('prices a generation model as the backend says: an image, or a second of video', async () => {
    const image = qwen({ key: 'sdxl-turbo', kind: 'image_gen', kind_label: 'Image generation', price_unit: 'an image', for_sale: true })
    const video = qwen({ key: 'wan-t2v', kind: 'video_gen', kind_label: 'Video generation', price_unit: 'a second of video', for_sale: true })
    api.readyModelsAdmin.mockResolvedValue({ data: { models: [image, video], machines: fitted, kinds: allKinds } })
    await render()
    expect((await showModel('sdxl-turbo')).text()).toContain('Price an image (USD)')
    expect((await showModel('wan-t2v')).text()).toContain('Price a second of video (USD)')
  })
})
