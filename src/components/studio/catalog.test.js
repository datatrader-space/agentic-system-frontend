import { describe, it, expect } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { STUDIO_GROUPS, studioFeatures, featureLink, studioIcons } from '../../services/studioFeatures'
import { presetsFor, composePreset } from '../../services/studioPresets'
import { studioChildRoutes } from '../../services/studioRoutes'
describe('F0 feature and route catalog', () => {
  it('has every planned page, a working route pattern and honest status metadata', () => {
    expect(studioFeatures.value).toHaveLength(27)
    expect(new Set(studioFeatures.value.map(feature => feature.id)).size).toBe(27)
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/video-studio', component: { template: '<div />' }, children: studioChildRoutes }] })
    for (const feature of studioFeatures.value) {
      expect(STUDIO_GROUPS).toContain(feature.group); expect(studioIcons[feature.icon]).toBeTruthy()
      expect(['live','beta','soon']).toContain(feature.status)
      expect(router.resolve(featureLink(feature)).matched.at(-1).meta.studioFeature).toBe(feature.id)
      // Every page opens a working page: none falls back to a placeholder.
      expect(studioChildRoutes.find(route => route.meta?.studioFeature === feature.id).component).toBeTypeOf('function')
    }
  })
  it('lists every built page as live in the plan (the server may still say a page is not ready for a person)', () => {
    expect(studioFeatures.value.filter(feature => feature.status === 'soon').map(feature => feature.id)).toEqual([])
    for (const id of ['audio','edit','characters','identity-training','motion','swap','effects','avatar','lipsync']) expect(studioFeatures.value.find(f => f.id === id).status).toBe('live')
  })
  it('redirects the old Ingredients address and keeps conversation and other query values', async () => {
    const routes = studioChildRoutes.map(route => ({ ...route, component: route.redirect ? undefined : { template: '<div />' } }))
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/video-studio', component: { template: '<div />' }, children: routes }] })
    await router.push('/video-studio/ingredients?conversation=c9&source=old#saved')
    expect(router.currentRoute.value.path).toBe('/video-studio/elements')
    expect(router.currentRoute.value.query).toEqual({ conversation: 'c9', source: 'old' }); expect(router.currentRoute.value.hash).toBe('#saved')
  })
  it.each(['image','video'])('provides at least eight original %s compositions with declared slots', feature => {
    const presets = presetsFor(feature)
    expect(presets.length).toBeGreaterThanOrEqual(8)
    for (const preset of presets) { expect(preset.promptTemplate).toBeTruthy(); expect(preset.variants.length).toBeGreaterThan(1); expect(composePreset(preset, {}, 'Original detail')).toContain('Original detail'); expect(composePreset(preset)).not.toMatch(/\{[a-z]+\}/) }
  })
})

