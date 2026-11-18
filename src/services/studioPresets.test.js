// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./api', () => ({ default: { getStudioRecipes: vi.fn() } }))
import api from './api'
import { allLooks, composePreset, forgetPresets, loadAllPresets, loadPresets, presetsFor, presetsLoaded } from './studioPresets'
import { studioLooks } from './studioLooks'

// The shapes GET /api/video/recipes/?page=image|video serves (video_studio/services/studio_presets.json).
const TABLETOP = { id: 'tabletop-product', feature: 'image', title: 'Quiet tabletop', purpose: 'A product study.', category: 'Product', slots: [{ id: 'product', label: 'Your product', role: 'subject', required: true, limit: 1, kinds: ['image'] }], settings: { aspect_ratio: '1:1' }, promptTemplate: 'Photograph {product} on a matte tabletop.', variants: ['Use a pale stone surface.'] }
const LOOK = { id: 'image-look-1', feature: 'image', title: 'Softbox product portrait', purpose: 'A clean campaign image.', category: 'Images', slots: [], settings: {}, promptTemplate: 'Create a refined image of {Subject}.', variants: ['Keep the prepared direction.'], clientOnly: true, variables: [{ id: 'subject', label: 'Subject', default: 'Your product' }] }
const UNVEIL = { id: 'product-unveil', feature: 'video', title: 'A measured reveal', purpose: 'Introduce a product.', category: 'Product', slots: [], settings: { duration: 5 }, promptTemplate: 'Reveal the product.', variants: ['A slow lateral slide.'] }
beforeEach(() => {
  forgetPresets()
  vi.mocked(api.getStudioRecipes).mockReset()
  vi.mocked(api.getStudioRecipes).mockImplementation(page => Promise.resolve({ data: { page, recipes: [], presets: page === 'image' ? [TABLETOP, LOOK] : [UNVEIL] } }))
})
describe('studioPresets', () => {
  it('reads the Image and Video presets from the Recipe API, once', async () => {
    expect(presetsLoaded('image')).toBe(false)
    expect(presetsFor('image')).toEqual([])
    const [a, b] = await Promise.all([loadPresets('image'), loadPresets('image')])
    expect(a).toEqual([TABLETOP, LOOK]); expect(b).toBe(a)
    expect(api.getStudioRecipes).toHaveBeenCalledTimes(1)
    expect(api.getStudioRecipes).toHaveBeenCalledWith('image')
    expect(presetsFor('image').map(p => p.id)).toEqual(['tabletop-product', 'image-look-1'])
    await loadPresets('image'); expect(api.getStudioRecipes).toHaveBeenCalledTimes(1)
  })
  it('keeps the other pages on their own looks, with no Image or Video copy left in the app', async () => {
    expect(studioLooks.some(look => ['image', 'video'].includes(look.feature))).toBe(false)
    expect(presetsFor('audio').length).toBeGreaterThan(0)
    expect(await loadPresets('audio')).toEqual(presetsFor('audio'))
    expect(api.getStudioRecipes).not.toHaveBeenCalled()
  })
  it('lists the Image and Video looks first among every look once read', async () => {
    expect(allLooks().some(look => look.feature === 'image')).toBe(false)
    await loadAllPresets()
    const looks = allLooks()
    expect(looks[0].id).toBe('image-look-1')                         // a look; a plain preset is not on Discover
    expect(looks.some(look => look.id === 'tabletop-product')).toBe(false)
    expect(looks.length).toBe(studioLooks.length + 1)
  })
  it('rejects a failed read and reads again next time', async () => {
    vi.mocked(api.getStudioRecipes).mockRejectedValueOnce(new Error('offline'))
    await expect(loadPresets('video')).rejects.toThrow('offline')
    expect(presetsLoaded('video')).toBe(false)
    expect((await loadPresets('video')).map(p => p.id)).toEqual(['product-unveil'])
  })
  it('composes a served preset exactly as before', async () => {
    await loadPresets('image')
    expect(composePreset(presetsFor('image')[0], { product: [{}] })).toBe('Photograph the supplied your product on a matte tabletop. Use a pale stone surface.')
    expect(composePreset(presetsFor('image')[1], { subject: 'A teapot' })).toBe('Create a refined image of A teapot. Keep the prepared direction.')
  })
})
