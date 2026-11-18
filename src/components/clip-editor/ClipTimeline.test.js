// @vitest-environment jsdom
// The timeline's keyboard and labels (VIDEO_CLIP_EDITOR_PLAN.md section 7): one tab stop per track, arrows between its
// items, trim handles and the playhead as sliders (a frame, a second, the ends), moving without dragging, and a tap
// on the ruler seeks.
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ClipTimeline from './ClipTimeline.vue'
import * as tl from './timelineModel'

const clip = (id, start, extra = {}) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: 2000, speed: 1, ...extra })
const doc = () => ({ ...tl.newDoc('16:9', 25), tracks: [
  { id: 'v1', kind: 'video', items: [clip('a', 0), clip('b', 2000)] },
  { id: 't1', kind: 'text', captions: true, items: [{ type: 'text', id: 'q1', start_ms: 500, end_ms: 1500, text: 'Hello', style: { font: 'sans', size: 0.05, color: '#FFFFFF', box: null }, x: 0.5, y: 0.9 }] },
  { id: 'a1', kind: 'audio', items: [] }] })
const mountIt = (props = {}) => mount(ClipTimeline, { attachTo: document.body, props: { doc: doc(), playhead: 1000, zoom: 100, names: { m1: 'beach.mp4' }, ...props } })

describe('ClipTimeline', () => {
  it('names each track and item, with its times, and marks the selection', () => {
    const w = mountIt({ selection: ['b'] })
    const lanes = w.findAll('[role="listbox"]').map(l => l.attributes('aria-label'))
    expect(lanes).toEqual(['Video 1', 'Captions 1', 'Sound 1'])
    const b = w.get('[data-id="b"]')
    expect(b.attributes('aria-label')).toBe('beach.mp4, 0:02.00 to 0:04.00, selected')
    expect(b.attributes('aria-selected')).toBe('true')
    expect(w.get('[data-id="q1"]').text()).toContain('Hello')
    w.unmount()
  })

  it('has one tab stop per track and moves between items with the arrows', async () => {
    const w = mountIt()
    expect(w.findAll('.ct-row')[0].findAll('[role="option"][tabindex="0"]')).toHaveLength(1)
    w.get('[data-id="a"]').element.focus()
    await w.get('[data-id="a"]').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement.dataset.id).toBe('b')
    await w.get('[data-id="b"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement.dataset.id).toBe('q1')
    await w.get('[data-id="q1"]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('select').at(-1)[0]).toEqual({ id: 'q1', add: false })
    w.unmount()
  })

  it('moves an item without dragging: Alt+arrow a frame, Shift a second', async () => {
    const w = mountIt()
    await w.get('[data-id="b"]').trigger('keydown', { key: 'ArrowLeft', altKey: true })
    await w.get('[data-id="b"]').trigger('keydown', { key: 'ArrowRight', altKey: true, shiftKey: true })
    expect(w.emitted('move').map(e => e[0])).toEqual([{ id: 'b', start: 1960 }, { id: 'b', start: 3000 }])
    w.unmount()
  })

  it('trim handles are sliders: a frame, a second, and the ends', async () => {
    const w = mountIt()
    const end = w.get('[data-id="a"] .ct-handle.end')
    expect(end.attributes('role')).toBe('slider')
    expect(end.attributes('aria-valuetext')).toBe('0:02.00')
    await end.trigger('keydown', { key: 'ArrowLeft' })
    await end.trigger('keydown', { key: 'PageUp' })
    const start = w.get('[data-id="b"] .ct-handle.start')
    await start.trigger('keydown', { key: 'Home' })
    expect(w.emitted('trim').map(e => e[0])).toEqual([
      { id: 'a', edge: 'end', at: 1960 }, { id: 'a', edge: 'end', at: 3000 }, { id: 'b', edge: 'start', at: 0 }])
    w.unmount()
  })

  it('the playhead is a slider read as a time; the ruler seeks on a tap', async () => {
    const w = mountIt()
    const seek = w.get('.ct-slider')
    expect(seek.attributes('aria-valuetext')).toBe('0:01.00')
    await seek.trigger('keydown', { key: 'PageDown' })
    await seek.trigger('keydown', { key: 'End' })
    const ruler = w.get('.ct-ruler')
    ruler.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 24 })
    ruler.element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 250, bubbles: true }))
    expect(w.emitted('seek').map(e => e[0])).toEqual([0, 4000, 2520])
    w.unmount()
  })

  it('a track can be muted and hidden from its header', async () => {
    const w = mountIt()
    await w.get('[aria-label="Mute Video 1"]').trigger('click')
    await w.get('[aria-label="Hide Captions 1"]').trigger('click')
    expect(w.emitted('track').map(e => e[0])).toEqual([{ id: 'v1', changes: { muted: true } }, { id: 't1', changes: { hidden: true } }])
    w.unmount()
  })
})
