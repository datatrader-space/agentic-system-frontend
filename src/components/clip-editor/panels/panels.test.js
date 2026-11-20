// @vitest-environment jsdom
// The inspector panels (VIDEO_EDITOR_PRO_PLAN.md F3-F7, contract sections 1, 3, 4, 5): every value stays in its
// registry range, the keyframe buttons add, remove and step between keyframes at the playhead, every change becomes
// ops through the op API, and a paid job shows its price card before anything is spent.
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as tl from '../timelineModel'
import { setRegistry } from '../registry'
// The server's registry, as `manage.py editor_registry_export` writes it; the page reads it before the panels show.
import registryFixture from '../__fixtures__/registry.json'
setRegistry(registryFixture)
import * as br from './bridge'
import ParamRow from './ParamRow.vue'
import VideoPanel from './VideoPanel.vue'
import SpeedPanel from './SpeedPanel.vue'
import ColourPanel from './ColourPanel.vue'
import EffectsPanel from './EffectsPanel.vue'
import TextPanel from './TextPanel.vue'
import AudioPanel from './AudioPanel.vue'
import { useTextTemplates } from './textTemplates'
import { useVideoStore } from '../../../stores/useVideoStore'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('../../../services/api', () => ({ default: api }))

const clip = (id, start, extra = {}) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: 2000, speed: 1, volume_db: 0, fit: 'contain', transform: { x: 0.5, y: 0.5, scale: 1, opacity: 1 }, ...extra })
const text = (extra = {}) => ({ type: 'text', id: 'x1', start_ms: 0, end_ms: 2000, text: 'Hi', style: { font: 'inter', size: 0.07, color: '#FFFFFF' }, x: 0.5, y: 0.5, ...extra })
const docOf = (a = clip('a', 0), more = []) => ({ ...tl.newDoc('16:9', 25), tracks: [{ id: 'v1', kind: 'video', items: [a, clip('b', 2000), ...more] }, { id: 't1', kind: 'text', items: [text()] }, { id: 'a1', kind: 'audio', items: [] }] })
const itemIn = (d, id) => tl.find(d, id).item
const trackIn = (d, id) => tl.find(d, id).track
const props = (d, id, extra = {}) => ({ doc: d, item: itemIn(d, id), track: trackIn(d, id), tRel: null, ...extra })
const type = async (input, value) => { input.element.value = value; await input.trigger('change') }
const last = w => w.emitted('ops').at(-1)[0]
const after = (d, w) => tl.applyOps(d, last(w).ops).doc

beforeEach(() => { setActivePinia(createPinia()); api.get.mockReset(); api.post.mockReset(); api.put.mockReset(); api.get.mockResolvedValue({ data: {} }) })

describe('the bridge (contract section 11)', () => {
  it('is the real modules, so the panels share one implementation of each', async () => {
    const [kf, sc, reg] = await Promise.all([import('../keyframes'), import('../speedCurve'), import('../registry')])
    expect([br.snap, br.setKeyframeOps, br.addEffectOps, br.setEffectOps, br.pasteAttributesOps]).toEqual([tl.snap, tl.setKeyframeOps, tl.addEffectOps, tl.setEffectOps, tl.pasteAttributesOps])
    expect([br.evaluate, br.curveLength, br.registry, br.effectPaid]).toEqual([kf.evaluate, sc.curveLength, reg.registry, reg.effectPaid])
    expect(br.snap(1020, 30)).toBe(1033)
    expect(br.curveLength([{ x: 0, y: 2 }, { x: 1, y: 2 }], 4000)).toBe(2000)
  })
})

describe('ParamRow and its keyframe diamond', () => {
  const spec = { min: 0.05, max: 4, default: 1, step: 0.01, label: 'Size', animatable: true }
  const row = (d, extra = {}) => mount(ParamRow, { props: { doc: d, item: itemIn(d, 'a'), path: 'transform.scale', spec, scale: 100, unit: '%', ...extra } })

  it('keeps a typed or slid value inside the registry range and explains an unreadable one', async () => {
    const d = docOf(), w = row(d)
    await type(w.find('input.pn-num'), '999')
    expect(itemIn(after(d, w), 'a').transform.scale).toBe(4)
    await type(w.find('input[type="range"]'), '1')
    expect(itemIn(after(d, w), 'a').transform.scale).toBe(0.05)
    await type(w.find('input.pn-num'), 'big')
    expect(w.text()).toContain('Type a number from 5 to 400')
  })

  it('adds a keyframe at the playhead (on the frame grid, relative to the clip) and removes it again', async () => {
    const d = docOf(clip('a', 1000)), w = row(d, { item: itemIn(d, 'a'), tRel: 520 })
    const diamond = w.find('[data-test="kf-toggle"]')
    expect(diamond.attributes('aria-label')).toBe('Add a keyframe of Size at the playhead')
    await diamond.trigger('click')
    const d2 = after(d, w)
    expect(itemIn(d2, 'a').keyframes['transform.scale']).toEqual([{ t_ms: 520, v: 1, ease: 'linear' }])
    await w.setProps({ doc: d2, item: itemIn(d2, 'a') })
    expect(w.find('[data-test="kf-toggle"]').attributes('aria-pressed')).toBe('true')
    await w.find('[data-test="kf-toggle"]').trigger('click')
    expect(itemIn(after(d2, w), 'a').keyframes).toBeUndefined()
  })

  it('on an animated value a change sets the keyframe at the playhead; previous and next seek; easing has a custom curve', async () => {
    const a = clip('a', 1000, { keyframes: { 'transform.scale': [{ t_ms: 0, v: 1, ease: 'linear' }, { t_ms: 1000, v: 2, ease: 'linear' }] } })
    const d = docOf(a), w = row(d, { item: itemIn(d, 'a'), tRel: 1000 })
    await type(w.find('input.pn-num'), '300')
    expect(itemIn(after(d, w), 'a').keyframes['transform.scale'][1]).toEqual({ t_ms: 1000, v: 3, ease: 'linear' })
    expect(itemIn(after(d, w), 'a').transform.scale).toBe(1)                 // the static value is untouched
    await w.find('[data-test="kf-prev"]').trigger('click')
    expect(w.emitted('seek').at(-1)).toEqual([1000])                         // timeline time of the first keyframe
    expect(w.find('[data-test="kf-next"]').attributes('disabled')).toBeDefined()
    await w.setProps({ tRel: 0 })
    await w.find('[data-test="kf-ease"]').setValue('bezier')
    expect(itemIn(after(d, w), 'a').keyframes['transform.scale'][0]).toMatchObject({ ease: 'bezier', bez: [0.25, 0.1, 0.25, 1] })
  })

  it('with the playhead outside the clip, no keyframe can be set and an animated value says why it cannot change', async () => {
    const a = clip('a', 0, { keyframes: { 'transform.scale': [{ t_ms: 0, v: 1 }, { t_ms: 500, v: 2 }] } })
    const d = docOf(a), w = row(d, { item: itemIn(d, 'a'), tRel: null })
    expect(w.find('[data-test="kf-toggle"]').attributes('disabled')).toBeDefined()
    await type(w.find('input.pn-num'), '120')
    expect(w.emitted('ops')).toBeUndefined()
    expect(w.text()).toContain('move the playhead inside the clip')
  })

  it('a phone offers no custom curve', async () => {
    const a = clip('a', 0, { keyframes: { 'transform.scale': [{ t_ms: 0, v: 1 }, { t_ms: 500, v: 2 }] } })
    const d = docOf(a), w = row(d, { item: itemIn(d, 'a'), tRel: 0, compact: true })
    expect(w.find('[data-test="kf-ease"] option[value="bezier"]').attributes('disabled')).toBeDefined()
  })
})

describe('VideoPanel', () => {
  it('rotates, flips and blends; the safe-area guides are in the monitor, not here', async () => {
    const d = docOf(), w = mount(VideoPanel, { props: props(d, 'a', { media: {} }) })
    await type(w.find('[data-test="param-transform.rotation"] input.pn-num'), '450')
    expect(itemIn(after(d, w), 'a').transform.rotation).toBe(360)
    await w.find('[data-test="flip-x"]').trigger('click')
    expect(itemIn(after(d, w), 'a').transform).toMatchObject({ flip_x: true, flip_y: false })
    await w.find('[data-test="blend"]').setValue('screen')
    expect(itemIn(after(d, w), 'a').blend).toBe('screen')
    expect(w.findAll('[data-test="blend"] option').map(o => o.element.value)).toEqual(br.ids(br.registry().blend_modes))
    expect(w.find('[data-test="safe-area"]').exists()).toBe(false)
  })

  it('a picture background waits until a picture is chosen', async () => {
    const d = docOf(), w = mount(VideoPanel, { props: { doc: d, media: {} } })
    await w.find('[data-test="bg-image"]').trigger('click')
    expect(w.emitted('ops')).toBeUndefined()
    expect(w.text()).toContain('Upload or bring a picture')
  })
})

describe('SpeedPanel', () => {
  it('a preset becomes a speed curve in place of the constant speed, with its exact length', async () => {
    const d = docOf(), w = mount(SpeedPanel, { props: props(d, 'a') })
    await w.find('[data-test="speed-curve"]').trigger('click')
    await w.setProps({ doc: after(d, w), item: itemIn(after(d, w), 'a') })
    const d2 = w.props('doc')
    await w.find('[data-test="preset-montage"]').trigger('click')
    const it = itemIn(after(d2, w), 'a')
    expect(it.speed).toBeUndefined()
    expect(it.speed_curve[0]).toEqual({ x: 0, y: 1 })
    expect(it.speed_curve.at(-1)).toEqual({ x: 1, y: 1 })
    expect(it.speed_curve).toHaveLength(6)
    await w.setProps({ doc: after(d2, w), item: it })
    expect(w.find('[data-test="ramp-length"]').text()).toContain(tl.timecode(br.snap(br.curveLength(it.speed_curve, 2000), 25), 25))
  })

  it('refuses a point outside the speed range and keeps the curve', async () => {
    const a = clip('a', 0, { speed: undefined, speed_curve: [{ x: 0, y: 1 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }] })
    const d = docOf(a), w = mount(SpeedPanel, { props: props(d, 'a') })
    const speeds = w.findAll('.sp-point input').filter((_, n) => n % 2 === 1)
    await type(speeds[1], '50')
    expect(w.emitted('ops')).toBeUndefined()
    expect(w.text()).toContain('Speeds go from 0.1× to 10×')
  })

  it('keeps pitch by default, and freezes the frame under the playhead for the clip\'s length', async () => {
    const d = docOf(clip('a', 1000)), w = mount(SpeedPanel, { props: props(d, 'a', { tRel: 400, playhead: 1400 }) })
    expect(w.find('[data-test="keep-pitch"]').element.checked).toBe(true)
    await w.find('[data-test="keep-pitch"]').setValue(false)
    expect(itemIn(after(d, w), 'a').keep_pitch).toBe(false)
    await w.find('[data-test="freeze"]').trigger('click')
    expect(itemIn(after(d, w), 'a')).toMatchObject({ freeze_at_ms: 400, hold_ms: 2000 })
  })

  it('reverse asks the server for the reversed copy', async () => {
    api.post.mockResolvedValue({ data: { id: 'd1', state: 'running', progress: 0.2 } })
    const d = docOf(), w = mount(SpeedPanel, { props: props(d, 'a') })
    await w.find('[data-test="reverse"]').setValue(true)
    expect(itemIn(after(d, w), 'a').reverse).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/video/editor/derive/', { media: 'm1', op: 'reverse', params: {} })
  })
})

describe('ColourPanel', () => {
  it('the first adjust change adds the adjust effect in the same edit, with the registry defaults', async () => {
    const d = docOf(), w = mount(ColourPanel, { props: props(d, 'a') })
    await type(w.find('[data-test="param-fx.fx1.exposure"] input.pn-num'), '0.5')
    expect(w.emitted('ops')).toHaveLength(1)                                 // one edit: add the effect and set it
    const fx = itemIn(after(d, w), 'a').effects[0]
    expect(fx).toMatchObject({ id: 'fx1', kind: 'adjust', enabled: true })
    expect(fx.params).toMatchObject({ exposure: 0.5, contrast: 1, saturation: 1 })
  })

  it('curves add a point without a pointer, and HSL shows one colour range at a time', async () => {
    const d = docOf(), w = mount(ColourPanel, { props: props(d, 'a') })
    await w.find('[data-test="curve-add"]').trigger('click')
    expect(itemIn(after(d, w), 'a').effects[0]).toMatchObject({ kind: 'curves', params: { master: [[0, 0], [0.5, 0.5], [1, 1]] } })
    // HSL: the colour ranges in the wheel's order, one at a time; a value is params.<colour>.<h|s|l>.
    expect(w.findAll('[data-test^="hsl-"]').map(b => b.attributes('data-test'))).toEqual(['hsl-red', 'hsl-yellow', 'hsl-green', 'hsl-cyan', 'hsl-blue', 'hsl-magenta'])
    await w.find('[data-test="hsl-blue"]').trigger('click')
    expect(w.find('[data-test="param-fx.fx1.blue.h"]').exists()).toBe(true)
    expect(w.find('[data-test="param-fx.fx1.red.h"]').exists()).toBe(false)
    await type(w.find('[data-test="param-fx.fx1.blue.s"] input.pn-num'), '0.4')
    expect(itemIn(after(d, w), 'a').effects[0]).toMatchObject({ kind: 'hsl', params: { blue: { h: 0, s: 0.4, l: 0 }, red: { h: 0, s: 0, l: 0 } } })
  })

  it('copies the colour and effects (paste attributes, "Colour and effects") to the chosen clips, in place of their own', async () => {
    const a = clip('a', 0, { effects: [{ id: 'fx1', kind: 'adjust', enabled: true, params: { exposure: 1 } }, { id: 'fx2', kind: 'blur', enabled: true, params: { radius: 3 } }],
      keyframes: { 'fx.fx1.exposure': [{ t_ms: 0, v: 1, ease: 'linear' }] } })
    const b = clip('b', 2000, { effects: [{ id: 'fx9', kind: 'vignette', enabled: true, params: { amount: 1, size: 0.5 } }] })
    const d = { ...docOf(a), tracks: [{ id: 'v1', kind: 'video', items: [a, b] }, ...docOf(a).tracks.slice(1)] }
    const w = mount(ColourPanel, { props: props(d, 'a') })
    await w.find('[data-test="copy-grade"] input[type="checkbox"]').setValue(true)
    await w.find('[data-test="copy-grade"] button').trigger('click')
    const got = itemIn(after(d, w), 'b')
    expect(got.effects).toEqual(a.effects)
    expect(got.keyframes).toEqual(a.keyframes)
  })

  it('offers the platform looks and the project own .cube files (media_type lut), never other files', async () => {
    const d = docOf(), media = { cube1: { media_type: 'lut', state: 'ready', name: 'film.cube' }, m1: { media_type: 'video', state: 'ready', name: 'beach.mp4' } }
    const w = mount(ColourPanel, { props: props(d, 'a', { media }) })
    const opts = w.findAll('[data-test="lut-look"] option').map(o => o.element.value)
    expect(opts).toEqual(['', 'look:warm', 'look:cool', 'look:teal_orange', 'look:mono', 'look:faded', 'look:vivid', 'cube1'])
    await w.find('[data-test="lut-look"]').setValue('look:teal_orange')
    expect(itemIn(after(d, w), 'a').effects[0]).toMatchObject({ kind: 'lut', params: { media: 'look:teal_orange', intensity: 1 } })
  })

  it('a phone keeps Adjust only', () => {
    const d = docOf(), w = mount(ColourPanel, { props: props(d, 'a', { compact: true }) })
    expect(w.find('[data-test="curves"]').exists()).toBe(false)
    expect(w.find('[data-test="copy-grade"]').exists()).toBe(false)
  })
})

describe('EffectsPanel', () => {
  it('adds, reorders, switches off and removes effects', async () => {
    let d = docOf()
    const w = mount(EffectsPanel, { props: props(d, 'a') })
    const step = async () => { d = after(d, w); await w.setProps({ doc: d, item: itemIn(d, 'a') }) }
    await w.find('[data-test="effect-kind"]').setValue('blur'); await w.find('[data-test="effect-add"]').trigger('click'); await step()
    await w.find('[data-test="effect-kind"]').setValue('vignette'); await w.find('[data-test="effect-add"]').trigger('click'); await step()
    expect(itemIn(d, 'a').effects.map(e => e.kind)).toEqual(['blur', 'vignette'])
    await w.find('[data-test="effect-vignette"] [data-test="effect-up"]').trigger('click'); await step()
    expect(itemIn(d, 'a').effects.map(e => e.kind)).toEqual(['vignette', 'blur'])
    await w.find('[data-test="effect-blur"] input[type="checkbox"]').setValue(false); await step()
    expect(itemIn(d, 'a').effects[1].enabled).toBe(false)
    await w.find('[data-test="effect-blur"] [data-test="effect-remove"]').trigger('click'); await step()
    expect(itemIn(d, 'a').effects.map(e => e.kind)).toEqual(['vignette'])
  })

  it('offers no mask on a phone and never adds background removal from the list', () => {
    const d = docOf()
    const kinds = w => w.findAll('[data-test="effect-kind"] option').map(o => o.element.value)
    expect(kinds(mount(EffectsPanel, { props: props(d, 'a') }))).toContain('mask')
    expect(kinds(mount(EffectsPanel, { props: props(d, 'a', { compact: true }) }))).not.toContain('mask')
    expect(kinds(mount(EffectsPanel, { props: props(d, 'a') }))).not.toContain('bg_removal')
  })

  it('a chroma key takes a typed colour; a mask changes shape', async () => {
    const a = clip('a', 0, { effects: [{ id: 'fx1', kind: 'chroma_key', enabled: true, params: { color: '#00FF00', similarity: 0.1, smoothness: 0.08, spill: 0.5 } },
      { id: 'fx2', kind: 'mask', enabled: true, params: { shape: 'ellipse', x: 0.5, y: 0.5, w: 0.6, h: 0.6, rotation: 0, feather: 0.1, invert: false } }] })
    const d = docOf(a), w = mount(EffectsPanel, { props: props(d, 'a') })
    await type(w.find('[data-test="effect-color-color"]'), '#0000ff')
    expect(itemIn(after(d, w), 'a').effects[0].params.color).toBe('#0000FF')
    await w.find('[data-test="mask-shape"]').setValue('rect')
    expect(itemIn(after(d, w), 'a').effects[1].params.shape).toBe('rect')
  })

  it('background removal shows its price card first and adds the effect only once the paid job is done', async () => {
    const job = { job_id: 'j1', operation: 'bg_removal', state: 'awaiting_authorization', allowed_actions: ['start', 'decline'], quote: { pricing_status: 'known', estimate_usd: 0.42, max_usd: 0.5 } }
    // The derive record carries its paid job (record.job); once the job is done, the record is read again.
    api.post.mockResolvedValue({ data: { id: 'dr1', op: 'bg_removal', state: 'running', paid: true, progress: null, result: null, job } })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const d = docOf(), w = mount(EffectsPanel, { props: props(d, 'a') })
    await w.find('[data-test="bg-quote"]').trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/editor/derive/', { media: 'm1', op: 'bg_removal', params: {} })
    expect(w.find('[data-test="video-job-awaiting_authorization"]').exists()).toBe(true)
    expect(w.find('[data-test="video-generate"]').exists()).toBe(true)
    expect(w.emitted('ops')).toBeUndefined()                                 // nothing changes before Generate
    try {
      useVideoStore()._put({ ...job, state: 'ready', allowed_actions: [], output: { attachment_id: 'matte1' } })
      api.get.mockImplementation(async url => (url === '/video/editor/derive/dr1/' ? { data: { id: 'dr1', op: 'bg_removal', state: 'ready', result: { media: 'matte1' } } } : { data: { ...job, state: 'ready', allowed_actions: [] } }))
      await vi.advanceTimersByTimeAsync(4100)
      await flushPromises()
      expect(api.get).toHaveBeenCalledWith('/video/editor/derive/dr1/')
    } finally { vi.useRealTimers() }
    await flushPromises()
    expect(itemIn(after(d, w), 'a').effects).toEqual([{ id: 'fx1', kind: 'bg_removal', enabled: true, params: {} }])
    expect(w.emitted('refresh-media')[0]).toEqual(['m1'])                    // the editor reads matte_url again
  })
})

describe('TextPanel', () => {
  beforeEach(() => { const t = useTextTemplates().state; t.saved = []; t.loaded = false; t.error = '' })
  const d = () => docOf()

  it('offers the 16 fonts, and styles: bold, alignment, outline width in range', async () => {
    const doc = d(), w = mount(TextPanel, { props: props(doc, 'x1') })
    expect(w.findAll('[data-test="text-font"] option')).toHaveLength(16)
    await w.find('[data-test="text-bold"]').trigger('click')
    expect(itemIn(after(doc, w), 'x1').style.bold).toBe(true)
    await w.find('[data-test="align-left"]').trigger('click')
    expect(itemIn(after(doc, w), 'x1').style.align).toBe('left')
    await type(w.find('[data-test="param-style.stroke_width"] input.pn-num'), '50')
    expect(itemIn(after(doc, w), 'x1').style.stroke_width).toBe(0.02)
  })

  it('animations in, out and looping, with a length in range', async () => {
    const doc = d(), w = mount(TextPanel, { props: props(doc, 'x1') })
    await w.find('[data-test="anim-in"]').setValue('typewriter')
    expect(itemIn(after(doc, w), 'x1').anim).toEqual({ in: { kind: 'typewriter', ms: 400 } })
    const d2 = after(doc, w)
    await w.setProps({ doc: d2, item: itemIn(d2, 'x1') })
    await type(w.find('[data-test="anim-in-ms"]'), '9')
    expect(w.text()).toContain('An animation lasts 0.1 to 3 seconds')
    await w.find('[data-test="anim-loop"]').setValue('pulse')
    expect(itemIn(after(d2, w), 'x1').anim).toEqual({ in: { kind: 'typewriter', ms: 400 }, loop: { kind: 'pulse' } })
  })

  it('uses a template and saves the person\'s own on their account', async () => {
    api.put.mockImplementation(async (url, body) => ({ data: body }))
    const doc = d(), w = mount(TextPanel, { props: props(doc, 'x1') })
    await w.find('[data-test="template-pick"]').setValue('lower-third')
    await w.find('[data-test="template-apply"]').trigger('click')
    expect(itemIn(after(doc, w), 'x1')).toMatchObject({ text: 'Hi', x: 0.3, y: 0.82, style: { font: 'inter', box_radius: 0.3 } })
    await w.find('[data-test="template-name"]').setValue('My title')
    await w.find('[data-test="template-save"]').trigger('click')
    await flushPromises()
    expect(api.put).toHaveBeenCalledWith('/video/preferences/', { editor_text_templates: [expect.objectContaining({ name: 'My title', text: 'Hi' })] })
    expect(w.text()).toContain('Template “My title” saved')
  })

  it('a refused template save is said, not kept in this browser', async () => {
    api.put.mockRejectedValue({ response: { data: { error: { message: 'Send favorite_looks.' } } } })
    const doc = d(), w = mount(TextPanel, { props: props(doc, 'x1') })
    await w.find('[data-test="template-name"]').setValue('Mine')
    await w.find('[data-test="template-save"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toBe('Send favorite_looks.')
    expect(useTextTemplates().state.saved).toEqual([])
  })
})

describe('AudioPanel', () => {
  it('volume in dB stays from -60 to 12, pan takes a keyframe, the EQ and role are set', async () => {
    const d = docOf(), w = mount(AudioPanel, { props: props(d, 'a', { tRel: 0 }) })
    await type(w.find('[data-test="param-volume_db"] input.pn-num'), '-90')
    expect(itemIn(after(d, w), 'a').volume_db).toBe(-60)
    await w.find('[data-test="param-pan"] [data-test="kf-toggle"]').trigger('click')
    expect(itemIn(after(d, w), 'a').keyframes.pan).toEqual([{ t_ms: 0, v: 0, ease: 'linear' }])
    await type(w.find('[data-test="param-eq.low_db"] input.pn-num'), '20')
    expect(itemIn(after(d, w), 'a').eq).toEqual({ low_db: 12 })
    expect(w.find('[data-test="role"]').element.value).toBe('dialogue')
    await w.find('[data-test="role"]').setValue('music')
    expect(itemIn(after(d, w), 'a').role).toBe('music')
    await w.find('[data-test="voice-enhance"]').setValue(true)
    expect(itemIn(after(d, w), 'a').voice_enhance).toBe(true)
    await type(w.find('[data-test="fade-in"]'), '5')
    expect(w.text()).toContain('A fade lasts from 0 seconds to the length of the clip')
  })
})
