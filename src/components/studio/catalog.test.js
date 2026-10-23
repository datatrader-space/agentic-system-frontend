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
      if (feature.status === 'soon') { expect(feature.phase).toMatch(/^P[0-6]$/); expect(router.resolve(feature.liveAlternative).matched.length).toBeGreaterThan(1) }
    }
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


it('gives every planned card a distinct original purpose in the feature catalog', () => {
  const purposes = []
  for (const feature of studioFeatures.value.filter(feature => feature.status === 'soon')) {
    expect(feature.plannedCards.length).toBeGreaterThan(0)
    for (const card of feature.plannedCards) {
      expect(card.title).toBeTruthy()
      expect(card.purpose.length).toBeGreaterThan(20)
      expect(card.purpose).not.toBe(feature.purpose)
      purposes.push(card.purpose)
    }
    for (const mode of feature.modes) expect(feature.plannedCards.some(card => card.title === mode)).toBe(true)
  }
  expect(new Set(purposes).size).toBe(purposes.length)
})
