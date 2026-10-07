// @vitest-environment jsdom
// The Browser pane: watching is read-only, driving needs a confirmed take, and a credential is a plate.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))

// The socket is replaced by a recorder that hands the test its handlers.
const sock = { handlers: null, connected: [], closed: 0, inputs: [], syncs: 0, hidden: [] }
vi.mock('../../composables/useBrowserLive', () => ({
  createBrowserLive: (handlers) => {
    sock.handlers = handlers
    return {
      connect: (id) => sock.connected.push(id),
      close: () => { sock.closed += 1 },
      input: (e) => { if (e) sock.inputs.push(e) },
      sync: () => { sock.syncs += 1 },
      setHidden: (h) => sock.hidden.push(h),
    }
  },
}))

const confirmMock = vi.fn()
vi.mock('../../composables/useConfirm', () => ({ confirm: (...args) => confirmMock(...args) }))

import BrowserPanel from './BrowserPanel.vue'
import { useBrowserStore } from '../../stores/useBrowserStore'

const card = (over = {}) => ({
  session_id: 'bs_1', state: 'ACTIVE', site: 'shop.example', address: 'https://shop.example/cart',
  watchable: true, action_count: 3, challenge: '', control: { holder: 'agent', epoch: 1, mine: false }, ...over,
})
const mineCard = (over = {}) => card({ control: { holder: 'human', epoch: 2, mine: true }, ...over })

let browser
function open(session = card(), props = {}) {
  browser.applySession(session)
  browser.show()
  return mount(BrowserPanel, { props, attachTo: document.body })
}
const frame = (header = {}, bytes = 3) => sock.handlers.onFrame({ t: 'frame', seq: 1, w: 1440, h: 900, ...header }, new Uint8Array(bytes))


// jsdom's pointer events take no coordinates through test-utils' `trigger`, so they are built by hand:
// a MouseEvent of the right name, with the pointer's own fields added.
function pointer(wrapper, type, init = {}) {
  const { pointerType = 'mouse', pointerId = 1, ...mouse } = init
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...mouse })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  wrapper.element.dispatchEvent(event)
  return nextTick()
}

beforeEach(() => {
  setActivePinia(createPinia())
  browser = useBrowserStore()
  Object.assign(sock, { handlers: null, connected: [], closed: 0, inputs: [], syncs: 0, hidden: [] })
  confirmMock.mockReset()
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:picture')
  URL.revokeObjectURL = vi.fn()
  document.body.innerHTML = ''
})

describe('watching', () => {
  it('connects to the session and says it is connecting', () => {
    const w = open()
    expect(sock.connected).toEqual(['bs_1'])
    expect(w.find('[data-test="bl-overlay"]').text()).toContain('Connecting to the browser')
    expect(w.find('[data-test="bl-site"]').text()).toBe('shop.example')
  })

  it('shows the picture, the address it came with, and LIVE', async () => {
    const w = open()
    sock.handlers.onStatus('live')
    frame({ address: 'https://shop.example/checkout' })
    await nextTick()
    expect(w.find('[data-test="bl-img"]').attributes('src')).toBe('blob:picture')
    expect(w.find('[data-test="bl-overlay"]').exists()).toBe(false)
    expect(w.find('[data-test="bl-live"]').exists()).toBe(true)
    expect(w.text()).toContain('https://shop.example/checkout')
    expect(w.find('[data-test="bl-hint"]').text()).toContain('The agent is driving')
  })

  it('keeps each picture only while it is on screen', async () => {
    URL.createObjectURL = vi.fn().mockReturnValueOnce('blob:one').mockReturnValueOnce('blob:two')
    const w = open()
    frame(); frame()
    await nextTick()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one')
    w.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:two')
    expect(sock.closed).toBeGreaterThan(0)
  })

  it('a watcher\'s mouse and keys go nowhere', async () => {
    const w = open()
    frame()
    await nextTick()
    await w.find('[data-test="bl-stage"]').trigger('keydown', { key: 'a' })
    await pointer(w.find('[data-test="bl-img"]'), 'pointermove', { clientX: 10, clientY: 10 })
    expect(sock.inputs).toEqual([])
  })

  it('a credential being typed is a plate, and the picture comes back after it', async () => {
    const w = open()
    frame()
    frame({ masked: 'secret' }, 0)
    await nextTick()
    expect(w.find('[data-test="bl-plate"]').text()).toContain('saved credential')
    frame()
    await nextTick()
    expect(w.find('[data-test="bl-plate"]').exists()).toBe(false)
  })

  it('pauses the stream behind another tab, and resumes in front', async () => {
    const w = open(card(), { active: false })
    expect(sock.hidden.at(-1)).toBe(true)
    await w.setProps({ active: true })
    expect(sock.hidden.at(-1)).toBe(false)
  })

  it('follows the session card the socket reports', async () => {
    const w = open()
    sock.handlers.onSession(card({ state: 'WAITING_HUMAN', challenge: 'CAPTCHA' }))
    await nextTick()
    expect(w.find('[data-test="bl-banner"]').text()).toContain('only a person')
    expect(w.find('[data-test="bl-hint"]').text()).toContain('waiting for you')
  })
})

describe('taking control', () => {
  it('asks first, and does nothing when the answer is no', async () => {
    confirmMock.mockResolvedValue(false)
    const api = (await import('../../services/api')).default
    const w = open()
    await w.find('[data-test="bl-take"]').trigger('click')
    await nextTick()
    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(confirmMock.mock.calls[0][0].message).toContain('not recorded')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('a click on the page is an offer to take control, never a click on the site', async () => {
    confirmMock.mockResolvedValue(false)
    const w = open()
    frame()
    await nextTick()
    await pointer(w.find('[data-test="bl-img"]'), 'pointerdown', { clientX: 10, clientY: 10, button: 0 })
    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(sock.inputs).toEqual([])
  })

  it('on yes, takes the lease and tells the relay to re-read it', async () => {
    confirmMock.mockResolvedValue(true)
    const api = (await import('../../services/api')).default
    api.post.mockResolvedValue({ data: {} })
    api.get.mockResolvedValue({ data: { session: mineCard() } })
    const w = open()
    await w.find('[data-test="bl-take"]').trigger('click')
    await vi.waitFor(() => expect(sock.syncs).toBe(1))
    await nextTick()
    expect(api.post).toHaveBeenCalledWith('/browser/sessions/bs_1/take-control/', {})
    expect(w.find('[data-test="bl-release"]').exists()).toBe(true)
    expect(w.find('[data-test="bl-hint"]').text()).toContain('You are in control')
  })

  it('is not offered for a browser that has ended or is held elsewhere', () => {
    expect(open(card({ state: 'STOPPED', watchable: false })).find('[data-test="bl-take"]').exists()).toBe(false)
    document.body.innerHTML = ''
    const held = open(card({ control: { holder: 'human', epoch: 2, mine: false } }))
    expect(held.find('[data-test="bl-take"]').exists()).toBe(false)
    expect(held.find('[data-test="bl-hint"]').text()).toContain('another window')
  })
})

describe('driving', () => {
  async function driving() {
    const w = open(mineCard())
    frame()
    await nextTick()
    // jsdom lays nothing out: give the picture the box a real one would have (half size).
    w.find('[data-test="bl-img"]').element.getBoundingClientRect = () => ({ left: 100, top: 50, width: 720, height: 450 })
    return w
  }

  it('a click lands on the same spot of the remote page', async () => {
    const w = await driving()
    const img = w.find('[data-test="bl-img"]')
    await pointer(img, 'pointerdown', { clientX: 250, clientY: 112.5, button: 0, detail: 1, pointerId: 1 })
    await pointer(img, 'pointerup', { clientX: 250, clientY: 112.5, button: 0, detail: 1, pointerId: 1 })
    expect(sock.inputs).toEqual([
      { t: 'pointer', k: 'down', x: 300, y: 125, b: 'left', c: 1 },
      { t: 'pointer', k: 'up', x: 300, y: 125, b: 'left', c: 1 },
    ])
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('keys go to the remote page, and paste goes as text from our own clipboard event', async () => {
    const w = await driving()
    const stage = w.find('[data-test="bl-stage"]')
    await stage.trigger('keydown', { key: 'Enter' })
    await stage.trigger('keyup', { key: 'Enter' })
    await stage.trigger('keydown', { key: 'v', ctrlKey: true })
    await stage.trigger('paste', { clipboardData: { getData: () => 'pasted text' } })
    expect(sock.inputs).toEqual([
      { t: 'key', k: 'down', key: 'Enter' },
      { t: 'key', k: 'up', key: 'Enter' },
      { t: 'text', text: 'pasted text' },
    ])
  })

  it('a finger tap is a click and a finger drag is a scroll', async () => {
    const w = await driving()
    const img = w.find('[data-test="bl-img"]')
    await pointer(img, 'pointerdown', { clientX: 250, clientY: 112.5, pointerType: 'touch', pointerId: 2 })
    await pointer(img, 'pointerup', { clientX: 250, clientY: 112.5, pointerType: 'touch', pointerId: 2 })
    expect(sock.inputs.map((e) => e.k)).toEqual(['down', 'up'])
    sock.inputs.length = 0
    await pointer(img, 'pointerdown', { clientX: 250, clientY: 300, pointerType: 'touch', pointerId: 3 })
    await pointer(img, 'pointermove', { clientX: 250, clientY: 250, pointerType: 'touch', pointerId: 3 })
    await pointer(img, 'pointerup', { clientX: 250, clientY: 250, pointerType: 'touch', pointerId: 3 })
    expect(sock.inputs).toEqual([{ t: 'wheel', x: 300, y: 400, dx: 0, dy: 100 }])
  })

  it('handing back releases the lease and tells the relay', async () => {
    const api = (await import('../../services/api')).default
    api.post.mockResolvedValue({ data: {} })
    api.get.mockResolvedValue({ data: { session: card({ control: { holder: 'agent', epoch: 3, mine: false } }) } })
    const w = await driving()
    await w.find('[data-test="bl-release"]').trigger('click')
    await vi.waitFor(() => expect(sock.syncs).toBe(1))
    await nextTick()
    expect(api.post).toHaveBeenCalledWith('/browser/sessions/bs_1/release-control/', {})
    expect(w.find('[data-test="bl-take"]').exists()).toBe(true)
  })
})

describe('when there is nothing to stream', () => {
  it('a browser that has gone shows its last picture and says so', async () => {
    const w = open()
    sock.handlers.onStatus('unavailable', 'NOT_RUNNING')
    frame({ still: true })
    await nextTick()
    expect(w.find('[data-test="bl-overlay"]').exists()).toBe(false)
    expect(w.find('[data-test="bl-hint"]').text()).toContain('last picture')
    expect(w.find('[data-test="bl-take"]').exists()).toBe(false)
  })

  it('an ended session is marked ended', async () => {
    const w = open()
    sock.handlers.onSession(card({ state: 'STOPPED', watchable: false }))
    sock.handlers.onEnd('ended')
    await nextTick()
    expect(w.find('[data-test="bl-ended"]').exists()).toBe(true)
    expect(w.find('[data-test="bl-live"]').exists()).toBe(false)
  })

  it('too many windows is explained', async () => {
    const w = open()
    sock.handlers.onStatus('unavailable', 'TOO_MANY_VIEWERS')
    await nextTick()
    expect(w.find('[data-test="bl-overlay"]').text()).toContain('three other windows')
  })
})
