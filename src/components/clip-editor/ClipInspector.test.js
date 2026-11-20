// @vitest-environment jsdom
// The inspector (VIDEO_CLIP_EDITOR_PLAN.md P3, VIDEO_EDITOR_PRO_PLAN.md section 6, WCAG 2.5.7): every change is a typed
// or stepped value that becomes one edit; a value the server would refuse is explained instead of sent; the tabs fit
// what is selected and are reached by keyboard.
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClipInspector from './ClipInspector.vue'
import * as tl from './timelineModel'
import { registry, setRegistry } from './registry'
// The server's registry, as `manage.py editor_registry_export` writes it; the page reads it before the panels show.
import registryFixture from './__fixtures__/registry.json'
setRegistry(registryFixture)

vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: {} })), post: vi.fn(), put: vi.fn() } }))

const clip = (id, start, extra = {}) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: 2000, speed: 1, volume_db: 0, fit: 'contain', transform: { x: 0.5, y: 0.5, scale: 1, opacity: 1 }, ...extra })
// Free placement (magnet off), with the main track every version 3 timeline has.
const doc = () => ({ ...tl.newDoc('16:9', 25), settings: { magnet: false }, tracks: [
  { id: 'v1', kind: 'video', main: true, items: [clip('a', 0), clip('b', 2000), { type: 'clip', id: 'p', media: 'img', start_ms: 4000, hold_ms: 3000, fit: 'contain' }] },
  { id: 't1', kind: 'text', items: [{ type: 'text', id: 'x1', start_ms: 0, end_ms: 1000, text: 'Hi', style: { font: 'inter', size: 0.07, color: '#FFFFFF' }, x: 0.5, y: 0.5 }] },
  { id: 'a1', kind: 'audio', items: [{ type: 'clip', id: 'm', media: 'snd', start_ms: 0, source_in_ms: 0, source_out_ms: 3000, volume_db: 0 }] }] })
const MEDIA = { m1: { duration_ms: 3000, media_type: 'video', has_audio: true }, img: { media_type: 'image' }, snd: { media_type: 'audio', duration_ms: 3000 } }
const mountIt = (selectedId, d = doc(), extra = {}) => mount(ClipInspector, { props: { doc: d, selectedId, media: MEDIA, ...extra }, attachTo: document.body })
// A typed value as a browser delivers it: the field holds the text when its change event fires.
const type = async (input, value) => { input.element.value = value; await input.trigger('change') }
const after = (d, w) => tl.applyOps(d, w.emitted('ops').at(-1)[0].ops).doc
// A tab's panel loads on first use (P12): its import, then its render.
const settle = async () => { await vi.dynamicImportSettled(); await flushPromises(); await new Promise(r => setTimeout(r)); await flushPromises() }
const tabNames = w => w.findAll('[role="tab"]').map(t => t.text())

beforeEach(() => setActivePinia(createPinia()))

describe('ClipInspector', () => {
  it('with nothing selected, sets the shape, and a blurred background in the version 3 form', async () => {
    const d = doc(), w = mountIt('', d)
    await w.find('[data-test="canvas"] select').setValue('9:16')
    expect(w.emitted('ops')[0][0]).toEqual({ ops: [{ op: 'set', path: ['canvas', 'aspect'], value: '9:16' }], label: 'Shape changed' })
    await w.find('[data-test="bg-blur"]').trigger('click')
    expect(after(d, w).canvas.background).toEqual({ kind: 'blur', strength: 2 })
    // 60 fps is offered (contract section 1).
    expect(w.findAll('[data-test="canvas"] option').map(o => o.text())).toContain('60 frames a second')
  })

  it('a typed start time moves the clip; a typed in point keeps it in place', async () => {
    const d = doc(), w = mountIt('b', d)
    const [startsAt, , fromFile] = w.findAll('input.st-input')
    await type(startsAt, '2.5')
    expect(tl.find(after(d, w), 'b').item.start_ms).toBe(2520)            // snapped to the 25 fps frame grid
    await type(fromFile, '0.4')
    const moved = tl.find(after(d, w), 'b').item
    expect([moved.start_ms, moved.source_in_ms]).toEqual([2000, 400])
  })

  it('explains a time it cannot read, and an out point past the file', async () => {
    const w = mountIt('a')
    const inputs = w.findAll('input.st-input')
    await type(inputs[0], 'soon')
    expect(w.text()).toContain('Type a time in seconds')
    await type(inputs[3], '9')
    expect(w.text()).toContain('inside its file')
    expect(w.emitted('ops')).toBeUndefined()
  })

  it('offers the tabs that fit the selection', async () => {
    expect(tabNames(mountIt('a'))).toEqual(['Video', 'Speed', 'Colour', 'Effects', 'Audio'])
    expect(tabNames(mountIt('p'))).toEqual(['Video', 'Colour', 'Effects'])
    expect(tabNames(mountIt('x1'))).toEqual(['Text'])
    expect(tabNames(mountIt('m'))).toEqual(['Audio', 'Speed'])
  })

  it('moves between tabs with the arrow keys, Home and End, and loads a tab when it opens', async () => {
    const w = mountIt('a')
    const list = w.find('[role="tablist"]')
    await list.trigger('keydown', { key: 'ArrowRight' })
    expect(w.find('[aria-selected="true"]').text()).toBe('Speed')
    await list.trigger('keydown', { key: 'End' })
    expect(w.find('[aria-selected="true"]').text()).toBe('Audio')
    await list.trigger('keydown', { key: 'ArrowRight' })
    expect(w.find('[aria-selected="true"]').text()).toBe('Video')
    await w.find('[data-test="tab-audio"]').trigger('click')
    await settle()
    expect(w.find('[data-test="panel-audio"]').exists()).toBe(true)
    expect(w.find('[role="tabpanel"]').attributes('aria-labelledby')).toBe('ci-tab-audio')
  })

  it('mute and a crop become edits; a crop outside the picture is refused', async () => {
    const d = doc(), w = mountIt('a', d)
    const width = w.find('[data-test="param-crop.w"] input.pn-num')
    await type(width, '50')
    expect(tl.find(after(d, w), 'a').item.crop).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    const left = w.find('[data-test="param-crop.x"] input.pn-num')
    await type(left, '30')
    expect(w.text()).toContain('The crop must stay inside the picture')
    await w.find('[data-test="tab-audio"]').trigger('click'); await settle()
    await w.find('[data-test="mute"]').setValue(true)
    expect(tl.find(after(d, w), 'a').item.muted).toBe(true)
  })

  it('joins a clip to the next with a crossfade when they meet, and offers every registry transition', async () => {
    const d = doc(), w = mountIt('a', d)
    await w.findAll('button').find(b => b.text() === 'Add a crossfade').trigger('click')
    const next = after(d, w)
    const tr = next.tracks[0].items.find(i => i.type === 'transition')
    // 500 ms asked; at 25 fps a transition is a whole number of 40 ms grid periods (contract 2): 520.
    expect(tr).toMatchObject({ kind: 'crossfade', ms: 520, between: ['a', 'b'] })
    expect(tl.problem(next)).toBe('')
    const w2 = mountIt(tr.id, next)
    expect(w2.findAll('[data-test="transition-kind"] option')).toHaveLength(registry().transitions.length)
    expect(registry().transitions).toHaveLength(20)
  })
})
