// @vitest-environment jsdom
// The strip under the browser picture: one mark per action the agent's browser took, in order. A mark that
// left a picture can be stepped to; LIVE goes back to the page as it is now. It can never drive the browser.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))

import api from '../../services/api'
import BrowserScrubber from './BrowserScrubber.vue'
import { useBrowserStore } from '../../stores/useBrowserStore'

const step = (n, over = {}) => ({
  action_id: `a${n}`, sequence: n, action: 'click', label: 'Clicked', state: 'VERIFIED', keyframe: true,
  title: `Page ${n}`, address: `https://shop.example/${n}`, ...over,
})

let browser
const strip = (actions) => {
  browser.session = { session_id: 'bs_1', state: 'ACTIVE', control: { holder: 'agent', mine: false } }
  browser.timeline = actions
  return mount(BrowserScrubber, { attachTo: document.body })
}

beforeEach(() => {
  setActivePinia(createPinia())
  browser = useBrowserStore()
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('the strip', () => {
  it('is not there until the browser has done something', () => {
    expect(strip([]).find('[data-test="bl-scrubber"]').exists()).toBe(false)
  })

  it('has one mark for every action, in the order they happened', () => {
    const w = strip([step(1, { action: 'navigate', label: 'Opened a page' }), step(2), step(3)])
    const marks = w.findAll('[data-test="bl-mark"]')
    expect(marks).toHaveLength(3)
    expect(marks[0].attributes('title')).toBe('Opened a page · Page 1')
    expect(w.find('[data-test="bl-count"]').text()).toBe('3 steps')
  })

  it('names every action, however many there are', () => {
    const w = strip(Array.from({ length: 140 }, (_, i) => step(i + 1)))
    expect(w.findAll('[data-test="bl-mark"]')).toHaveLength(140)
    expect(w.find('[data-test="bl-count"]').text()).toBe('140 steps')
  })

  it('says one step, not one steps', () => {
    expect(strip([step(1)]).find('[data-test="bl-count"]').text()).toBe('1 step')
  })

  it('a mark with no picture cannot be stepped to and says why', async () => {
    const w = strip([step(1), step(2, { action: 'observe', label: 'Looked at the page', keyframe: false, title: '', address: '' })])
    const looked = w.findAll('[data-test="bl-mark"]')[1]
    expect(looked.attributes('disabled')).toBeDefined()
    expect(looked.attributes('title')).toBe('Looked at the page (no picture kept)')
    await looked.trigger('click')
    expect(browser.viewing).toBeNull()
  })

  it('a mark for an action that did not go through says so', () => {
    const w = strip([step(1, { state: 'BLOCKED', keyframe: false })])
    const mark = w.find('[data-test="bl-mark"]')
    expect(mark.classes()).toContain('bad')
    expect(mark.attributes('title')).toBe('Clicked · Page 1 (it did not go through)')
  })

  it('falls back to the address when the page had no title', () => {
    const w = strip([step(1, { title: '' })])
    expect(w.find('[data-test="bl-mark"]').attributes('title')).toBe('Clicked · https://shop.example/1')
  })
})

describe('stepping', () => {
  it('a click on a mark looks at that moment, and LIVE goes back', async () => {
    const w = strip([step(1), step(2), step(3)])
    expect(w.find('[data-test="bl-back-live"]').classes()).toContain('on')
    await w.findAll('[data-test="bl-mark"]')[1].trigger('click')
    expect(browser.viewing).toBe('a2')
    expect(w.findAll('[data-test="bl-mark"]')[1].classes()).toContain('on')
    expect(w.findAll('[data-test="bl-mark"]')[1].attributes('aria-selected')).toBe('true')
    expect(w.find('[data-test="bl-count"]').text()).toBe('2 of 3')
    expect(w.find('[data-test="bl-back-live"]').classes()).not.toContain('on')
    await w.find('[data-test="bl-back-live"]').trigger('click')
    expect(browser.viewing).toBeNull()
  })

  it('the arrow keys step among the pictured marks, and End or Escape goes live', async () => {
    const w = strip([step(1), step(2, { keyframe: false }), step(3)])
    const track = w.find('.bs-track')
    await track.trigger('keydown', { key: 'ArrowLeft' })
    expect(browser.viewing).toBe('a3')
    await track.trigger('keydown', { key: 'ArrowLeft' })
    expect(browser.viewing).toBe('a1')
    await track.trigger('keydown', { key: 'ArrowRight' })
    expect(browser.viewing).toBe('a3')
    await track.trigger('keydown', { key: 'End' })
    expect(browser.viewing).toBeNull()
    await track.trigger('keydown', { key: 'ArrowLeft' })
    await track.trigger('keydown', { key: 'Escape' })
    expect(browser.viewing).toBeNull()
  })

  it('counts position among the marks that have a picture', async () => {
    const w = strip([step(1), step(2, { keyframe: false }), step(3)])
    browser.view('a3')
    await nextTick()
    expect(w.find('[data-test="bl-count"]').text()).toBe('2 of 2')
  })

  it('never asks the backend to do anything', async () => {
    const w = strip([step(1), step(2)])
    await w.findAll('[data-test="bl-mark"]')[0].trigger('click')
    await w.find('[data-test="bl-back-live"]').trigger('click')
    expect(api.post).not.toHaveBeenCalled()
  })
})
