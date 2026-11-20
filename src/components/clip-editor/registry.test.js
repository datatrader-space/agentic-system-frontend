// The editor registry client (VIDEO_EDITOR_PRO_CONTRACT.md section 3): read once from the server and kept for the
// session, a failed read tried again next time, and the helpers the panels use on its shape.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/registry.json'
import { clampParam, editorLimits, effectDefaults, effectDerive, effectPaid, fontFor, ids, isAnimatable, labelOf, loadRegistry, paramSpec, registry, resetRegistry, setRegistry, transitionLabel } from './registry'
import { TRANSITIONS, EFFECT_KINDS, BLEND_MODES, ROLES, EASES } from './timelineModel'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))

beforeEach(() => { resetRegistry(); api.get.mockReset() })

describe('registry', () => {
  it('is read once from the server and kept for the session', async () => {
    api.get.mockResolvedValue({ data: fixture })
    const [a, b] = await Promise.all([loadRegistry(), loadRegistry()])
    expect(await loadRegistry()).toBe(a)
    expect(b).toBe(a)
    expect(registry()).toBe(a)
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenCalledWith('/video/editor/registry/')
  })

  it('a failed or empty read is not kept; the next call asks again', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: fixture })
    await expect(loadRegistry()).rejects.toThrow('offline')
    await expect(loadRegistry()).rejects.toThrow(/could not be read/)
    expect(registry()).toBeNull()
    expect((await loadRegistry()).version).toBe(1)
    expect(api.get).toHaveBeenCalledTimes(3)
  })

  // The fixture is the server's own registry, written by `manage.py editor_registry_export` (keys sorted).
  it('the fixture has the contract\'s shape and agrees with the model\'s lists', () => {
    for (const k of ['blend_modes', 'easings', 'effects', 'fonts', 'limits', 'roles', 'text_anims', 'transitions', 'version', 'lut_looks', 'rates', 'keyframe_paths', 'derive_ops']) expect(fixture).toHaveProperty(k)
    expect(fixture.transitions.map(t => t.id)).toEqual(TRANSITIONS)
    expect(Object.keys(fixture.effects).sort()).toEqual([...EFFECT_KINDS].sort())
    expect([ids(fixture.blend_modes), ids(fixture.roles), ids(fixture.easings)]).toEqual([BLEND_MODES, ROLES, EASES])
    expect(fixture.rates).toEqual([24, 25, 30, 60])
    expect(fixture.fonts).toHaveLength(20)
    expect(paramSpec(fixture, 'adjust', 'exposure')).toMatchObject({ type: 'number', min: -2, max: 2, default: 0, animatable: true })
  })

  it('reads HSL\'s nested params by path, with their defaults and what can animate', () => {
    expect(Object.keys(fixture.effects.hsl.params).sort()).toEqual(['blue', 'cyan', 'green', 'magenta', 'red', 'yellow'])
    expect(fixture.effects.hsl.params.red.type).toBe('group')
    expect(paramSpec(fixture, 'hsl', 'red.h')).toMatchObject({ type: 'number', min: -30, max: 30, default: 0 })
    expect(paramSpec(fixture, 'hsl', 'red')).toBeNull()
    expect(effectDefaults(fixture, 'hsl').magenta).toEqual({ h: 0, s: 0, l: 0 })
    expect(clampParam(fixture, 'hsl', 'cyan.s', 4)).toBe(1)
    const item = { effects: [{ id: 'e1', kind: 'hsl', params: {} }] }
    expect([isAnimatable(fixture, item, 'fx.e1.red.h'), isAnimatable(fixture, item, 'fx.e1.red')]).toEqual([true, false])
  })

  it('gives an effect\'s defaults, keeps a number in range and on its step, and says what can animate', () => {
    expect(effectDefaults(fixture, 'vignette')).toEqual({ amount: 0.5, size: 0.7 })
    expect([clampParam(fixture, 'adjust', 'exposure', 9), clampParam(fixture, 'adjust', 'exposure', 0.123), clampParam(fixture, 'adjust', 'exposure', 'x')]).toEqual([2, 0.12, 0])
    const item = { effects: [{ id: 'e1', kind: 'mask', params: {} }] }
    expect([isAnimatable(fixture, item, 'fx.e1.feather'), isAnimatable(fixture, item, 'fx.e1.shape'), isAnimatable(fixture, item, 'fx.e2.x'), isAnimatable(fixture, item, 'transform.x')]).toEqual([true, false, false, true])
    expect([transitionLabel(fixture, 'fade_black'), transitionLabel(null, 'circle_open'), fontFor(fixture, 'bebas-neue').family]).toEqual(['Fade to black', 'circle open', 'Bebas Neue'])
  })

  it('names the paid server job an effect needs, and gives the panels their ranges from the registry', () => {
    expect([effectDerive(fixture, 'bg_removal'), effectPaid(fixture, 'bg_removal'), effectPaid(fixture, 'blur'), effectDerive(fixture, 'blur')]).toEqual(['bg_removal', true, false, null])
    const L = editorLimits(fixture)
    expect([L.volume_db, L.pan, L.scale, L.rotation, L.rates, L.effects_per_clip]).toEqual([[-60, 12], [-1, 1], [0.05, 4], [-360, 360], [24, 25, 30, 60], 20])
    expect([L.eq_db, L.text_size, L.gif_max_ms]).toEqual([[-12, 12], [0.02, 0.3], 15000])     // the contract's, until the registry lists them
    expect([labelOf(fixture.roles, 'music'), labelOf(fixture.blend_modes, 'add'), labelOf([], 'zoom_in')]).toEqual(['Music', 'Add', 'zoom in'])
  })

  it('takes a registry as read (tests, or a page that has it already)', () => {
    setRegistry(fixture)
    expect(registry()).toBe(fixture)
  })
})
