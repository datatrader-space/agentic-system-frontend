// @vitest-environment jsdom
// The inspector (VIDEO_CLIP_EDITOR_PLAN.md P3 and WCAG 2.5.7): every change is a typed or stepped value that becomes
// one edit, and a value the server would refuse is explained instead of sent.
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ClipInspector from './ClipInspector.vue'
import * as tl from './timelineModel'

const clip = (id, start, extra = {}) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: 2000, speed: 1, volume_db: 0, fit: 'contain', transform: { x: 0.5, y: 0.5, scale: 1, opacity: 1 }, ...extra })
const doc = () => ({ ...tl.newDoc('16:9', 25), tracks: [{ id: 'v1', kind: 'video', items: [clip('a', 0), clip('b', 2000)] }, { id: 'a1', kind: 'audio', items: [] }] })
const mountIt = (selectedId, d = doc()) => mount(ClipInspector, { props: { doc: d, selectedId, media: { m1: { duration_ms: 3000, media_type: 'video' } } } })
// A typed value as a browser delivers it: the field holds the text when its change event fires.
const type = async (input, value) => { input.element.value = value; await input.trigger('change') }
const after = (d, w) => tl.applyOps(d, w.emitted('ops').at(-1)[0].ops).doc

describe('ClipInspector', () => {
  it('with nothing selected, sets the shape, rate and background', async () => {
    const w = mountIt('')
    await w.findAll('select')[0].setValue('9:16')
    expect(w.emitted('ops')[0][0]).toEqual({ ops: [{ op: 'set', path: ['canvas', 'aspect'], value: '9:16' }], label: 'Shape changed' })
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

  it('speed, mute and a crop become edits; a crop outside the picture is refused', async () => {
    const d = doc(), w = mountIt('a', d)
    await w.findAll('select').find(s => s.findAll('option').some(o => o.text() === '2×')).setValue('2')
    expect(tl.find(after(d, w), 'a').item.speed).toBe(2)
    await w.findAll('input[type="checkbox"]').find(c => c.element.closest('label').textContent.includes('Mute')).setValue(true)
    expect(tl.find(after(d, w), 'a').item.muted).toBe(true)
    const width = w.findAll('input[type="number"]').find(i => i.element.closest('label').textContent.startsWith('Width'))
    await type(width, '50')
    expect(tl.find(after(d, w), 'a').item.crop).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    const left = w.findAll('input[type="number"]').find(i => i.element.closest('label').textContent.startsWith('Left'))
    await type(left, '99')
    expect(w.text()).toContain('The crop must stay inside the picture')
  })

  it('joins a clip to the next with a crossfade when they meet', async () => {
    const d = doc(), w = mountIt('a', d)
    await w.findAll('button').find(b => b.text() === 'Add a crossfade').trigger('click')
    const next = after(d, w)
    expect(next.tracks[0].items.find(i => i.type === 'transition')).toMatchObject({ kind: 'crossfade', ms: 500, between: ['a', 'b'] })
    expect(tl.problem(next)).toBe('')
  })
})
