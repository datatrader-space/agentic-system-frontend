// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StudioPage from './StudioPage.vue'
import source from './StudioPage.vue?raw'
afterEach(() => vi.unstubAllGlobals())
describe('StudioPage', () => {
  it('keeps inputs, a pinned action slot and accessible results tabs in one shell', async () => {
    const w = mount(StudioPage, { props: { title: 'Image', purpose: 'Make an image' }, slots: { form: '<input aria-label="Creative brief" />', quote: '<button>Prepare</button>', presets: '<p>Preset cards</p>', results: '<p>Session results</p>' } })
    expect(w.get('h1').text()).toBe('Image')
    expect(w.get('.st-controls input').attributes('aria-label')).toBe('Creative brief')
    expect(w.get('.st-quote').text()).toBe('Prepare')
    const tabs = w.findAll('[role="tab"]')
    await tabs[0].trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:activeTab')[0]).toEqual(['results'])
    await w.setProps({ activeTab: 'results' })
    expect(tabs[1].attributes('aria-selected')).toBe('true')
    expect(w.findAll('[role="tabpanel"]')[1].isVisible()).toBe(true)
    w.unmount()
  })
})


it('places inputs before output below 1024 px and focuses the first required empty slot', async () => {
  vi.stubGlobal('matchMedia', query => ({ matches: query === '(max-width: 1023px)', addEventListener() {}, removeEventListener() {} }))
  const w = mount(StudioPage, { attachTo: document.body, props: { title: 'Image', presetPicker: true }, slots: { form: '<div tabindex="-1" data-studio-required-empty="false">Filled</div><div tabindex="-1" data-studio-required-empty="true">Required</div>', presets: 'Full gallery', results: 'Session results' } })
  expect(w.find('.st-controls').element.compareDocumentPosition(w.find('.st-output').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(source).toContain('@media(max-width:1023px)')
  expect(source).toContain('.st-controls{order:0;')
  expect(source).toContain('.st-output{order:1;')
  expect(w.text()).not.toContain('Full gallery')
  expect(w.get('.st-results-heading').text()).toBe('My results')
  w.vm.focusInputs()
  expect(document.activeElement).toBe(w.get('[data-studio-required-empty="true"]').element)
  w.unmount()
})
