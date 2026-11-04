// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StudioPage from './StudioPage.vue'
import source from './StudioPage.vue?raw'
vi.mock('./StudioProjectPicker.vue',()=>({default:{template:'<button>Add to project</button>'}}))
afterEach(() => vi.unstubAllGlobals())
describe('StudioPage', () => {
  it.each([false,true])('all workspace sections remain reachable with mobile=%s', async mobile => {
    vi.stubGlobal('matchMedia', () => ({ matches: mobile, addEventListener() {}, removeEventListener() {} }))
    const w=mount(StudioPage,{props:{title:'Tool',agentMode:true},slots:{form:'<textarea />',presets:'Preview content',looks:'Looks content',results:'Results content',versions:'Versions content'}})
    for (const [index,key] of ['presets','looks','results','versions'].entries()) {
      const selector=mobile?'.st-mobile-tabs button':'.st-tabs button'
      await w.findAll(selector)[index+(mobile?1:0)].trigger('click')
      await w.setProps({activeTab:key})
      expect(w.findAll('[role="tabpanel"]')[index].isVisible()).toBe(true)
    }
    w.unmount()
  })
  it('returns from mobile looks to the editable agent brief without submitting', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    const w = mount(StudioPage, { attachTo: document.body, props: { title: 'Video', agentMode: true }, slots: { form: '<textarea aria-label="Idea"></textarea>', presets: 'Preview', looks: 'Looks', results: 'Results' } })
    await w.findAll('.st-mobile-tabs button')[2].trigger('click')
    expect(w.classes()).toContain('st-mobile-output')
    await w.vm.focusInputs()
    expect(w.classes()).not.toContain('st-mobile-output')
    expect(document.activeElement).toBe(w.get('textarea').element)
    expect(w.emitted('new')).toBeUndefined()
    w.unmount()
  })
  it('links phone tabs to their panels and supports keyboard navigation back to chat', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    const w = mount(StudioPage, { props:{title:'Video',agentMode:true}, slots:{form:'<textarea />',presets:'Preview',looks:'Looks',results:'Results'} })
    const tabs = w.findAll('.st-mobile-tabs button')
    expect(tabs[0].text()).toBe('Chat')
    expect(tabs[0].attributes('aria-controls')).toBe(w.get('.st-controls').attributes('id'))
    await tabs[0].trigger('keydown', { key:'ArrowRight' })
    await w.setProps({activeTab:'presets'})
    const preview = w.get('[role="tabpanel"]')
    expect(tabs[1].attributes('aria-controls')).toBe(preview.attributes('id'))
    expect(preview.attributes('aria-labelledby')).toBe(tabs[1].attributes('id'))
    await tabs[1].trigger('keydown', {key:'Home'})
    expect(w.classes()).not.toContain('st-mobile-output')
    expect(w.emitted('new')).toBeUndefined()
    w.unmount()
  })
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
