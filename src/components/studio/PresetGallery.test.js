// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PresetGallery from './PresetGallery.vue'
import source from './PresetGallery.vue?raw'
const presets = [{ id: 'a', title: 'A quiet object', purpose: 'A product study', feature: 'image', category: 'Product' }, { id: 'b', title: 'A gentle move', purpose: 'A slow shot', feature: 'video', category: 'Camera', previewUrl: '/synthetic-preview.mp4' }]
afterEach(() => vi.unstubAllGlobals())
describe('PresetGallery', () => {
  it('filters and selects original presets with native keyboard-accessible buttons', async () => {
    const w = mount(PresetGallery, { props: { presets } })
    expect(w.findAll('.pg-card')).toHaveLength(2)
    await w.get('input').setValue('gentle')
    expect(w.findAll('.pg-card')).toHaveLength(1)
    await w.get('.pg-card').trigger('click'); expect(w.emitted('select')[0]).toEqual([presets[1]])
    await w.get('input').setValue('no matching preset'); expect(w.get('[role="status"]').text()).toContain('No presets match')
    w.unmount()
  })
  it('never plays previews for reduced motion, and starts one only on hover otherwise', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    let w = mount(PresetGallery, { props: { presets } })
    await w.findAll('.pg-card')[1].trigger('mouseenter'); expect(w.find('video').exists()).toBe(false); w.unmount()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    w = mount(PresetGallery, { props: { presets } })
    expect(w.find('video').exists()).toBe(false)
    await w.findAll('.pg-card')[1].trigger('focus'); expect(w.get('video').attributes('preload')).toBe('none')
    await w.findAll('.pg-card')[1].trigger('blur'); expect(w.find('video').exists()).toBe(false)
    w.unmount()
  })
  it('keeps honest loading, error and disabled-preview states', async () => {
    const w = mount(PresetGallery, { props: { presets, loading: true } })
    expect(w.text()).toContain('Loading presets')
    await w.setProps({ loading: false, error: 'Could not load presets.' })
    await w.get('[role="alert"] button').trigger('click'); expect(w.emitted('retry')).toHaveLength(1)
    await w.setProps({ error: '', disabled: true }); expect(w.findAll('.pg-card').every(card => card.attributes('disabled') !== undefined)).toBe(true)
    w.unmount()
  })
})


it('keeps title, description and category hierarchy at desktop and phone sizes', () => {
  const w = mount(PresetGallery, { props: { presets } })
  expect(w.get('.pg-title').text()).toBe(presets[0].title)
  expect(w.get('.pg-description').text()).toBe(presets[0].purpose)
  expect(w.get('.pg-category').text()).toBe(presets[0].category)
  expect(source).toMatch(/\.pg-title\{font-size:16px;[^}]*font-weight:600/)
  expect(source).toContain('.pg-description{font-size:14px;')
  expect(source).toContain('.pg-category{font-size:12px;')
  expect(source).toContain('.pg-title{font-size:15px}.pg-description{font-size:13px}')
  w.unmount()
})
