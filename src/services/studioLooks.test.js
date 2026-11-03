import { beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('./api', () => ({ default: api }))
import { studioLooks, loadLookResult, safeMediaUrl, LOOK_ID } from './studioLooks'
import { composePreset, presetsFor } from './studioPresets'
import { getStudioFeature } from './studioFeatures'

describe('Approved Studio look presentation', () => {
  it('covers all 23 creative tools with 69 unique looks that carry no media of their own', () => {
    expect(studioLooks).toHaveLength(69)
    expect(new Set(studioLooks.map(look => look.id)).size).toBe(69)
    expect(new Set(studioLooks.map(look => look.feature)).size).toBe(23)
    for (const look of studioLooks) {
      expect(getStudioFeature(look.feature)).toBeTruthy()
      expect(look.clientOnly).toBe(true)
      // No stock media: a look shows the person's own results, read from the backend.
      expect(look.previewUrl).toBeUndefined(); expect(look.poster).toBeUndefined()
      expect(JSON.stringify(look)).not.toMatch(/\/studio\/looks\/|\.(mp4|jpg|png|webp)\b|chanel/i)
      expect(look.id).toMatch(LOOK_ID)
      expect(composePreset(look)).not.toMatch(/\{[^}]+\}/)
      expect(presetsFor(look.feature).some(preset => preset.id === look.id)).toBe(true)
    }
  })
  it('retains existing server-recognized preset identifiers separately from client-only looks', () => {
    expect(presetsFor('image').find(preset => preset.id === 'tabletop-product')?.clientOnly).toBeUndefined()
    expect(presetsFor('video').find(preset => preset.id === 'product-unveil')?.clientOnly).toBeUndefined()
    expect(presetsFor('missing-feature')).toEqual([])
  })
})

describe("A look's own results", () => {
  beforeEach(() => { api.get.mockReset() })
  it('the stock look media is gone from public/', () => {
    const dir = fileURLToPath(new URL('../../public/studio/looks/', import.meta.url))
    // Nothing is left: the creative canvas shows the person's own newest result too.
    expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([])
  })
  it('asks once per batch of at most 200 ids and answers each id, an unknown one as empty', async () => {
    api.get.mockImplementation(async (url, config) => { if (url !== '/video/library/presets/') throw new Error(`unexpected ${url}`); return { data: { presets: Object.fromEntries(config.params.ids.split(',').filter(id => id === 'look-7').map(id => [id, { count: 2, latest: { media_type: 'image', url: '/m.png', thumbnail_url: '' } }])) } } })
    const ids = Array.from({ length: 250 }, (_, i) => `look-${i}`)
    const answers = await Promise.all([...ids, 'look-7'].map(loadLookResult))
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(api.get.mock.calls.map(call => call[1].params.ids.split(',').length)).toEqual([200, 50])
    expect(answers[7]).toEqual({ count: 2, latest: { media_type: 'image', url: '/m.png', thumbnail_url: '' } })
    expect(answers[250]).toBe(answers[7])
    expect(answers[0]).toEqual({ count: 0, latest: null })
  })
  it('keeps only http(s) and same-origin media addresses', () => {
    expect(safeMediaUrl('/media/a.png')).toBe('/media/a.png')
    expect(safeMediaUrl('https://cdn.example.test/a.png')).toBe('https://cdn.example.test/a.png')
    for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AAAA', '//evil.test/a.png', '', null]) expect(safeMediaUrl(bad)).toBe('')
  })
})
