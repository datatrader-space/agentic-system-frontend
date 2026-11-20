// @vitest-environment jsdom
// The timeline (VIDEO_CLIP_EDITOR_PLAN.md section 7, VIDEO_EDITOR_PRO_PLAN.md 3.A and P14): one tab stop per track,
// arrows between its items, trim handles and the playhead as sliders, moving without dragging, a tap on the ruler
// seeks; and with the editor, the tools bar, markers, track controls, connected-clip links, keyframe diamonds, the red
// edit point, marquee selection, compound clips and the shortcuts (only while the timeline has focus).
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ClipTimeline from './ClipTimeline.vue'
import { useClipEditor } from './useClipEditor'
import * as tl from './timelineModel'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const clip = (id, start, extra = {}) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: 2000, speed: 1, ...extra })
const doc = () => ({ ...tl.newDoc('16:9', 25), settings: { magnet: false }, tracks: [
  { id: 'v1', kind: 'video', main: true, items: [clip('a', 0), clip('b', 2000)] },
  { id: 't1', kind: 'text', captions: true, items: [{ type: 'text', id: 'q1', start_ms: 520, end_ms: 1520, text: 'Hello', style: { font: 'sans', size: 0.05, color: '#FFFFFF', box: null }, x: 0.5, y: 0.9 }] },
  { id: 'a1', kind: 'audio', items: [] }] })
const mountIt = (props = {}) => mount(ClipTimeline, { attachTo: document.body, props: { doc: doc(), playhead: 1000, zoom: 100, names: { m1: 'beach.mp4' }, ...props } })
// The timeline driven by a real editor (no server: the document is set directly).
function withEditor(d = doc(), media = { m1: { duration_ms: 2000, name: 'beach.mp4' } }) {
  const ed = useClipEditor({ autosaveMs: 60000 })
  ed.doc.value = d
  Object.assign(ed.media, media)
  ed.zoom.value = 100
  const w = mount(ClipTimeline, { attachTo: document.body, props: { editor: ed, names: { m1: 'beach.mp4' } } })
  return { ed, w }
}
const said = async ed => { await Promise.resolve(); return ed.announcement.value }
const press = (el, key, mods = {}) => el.trigger('keydown', { key, ...mods })

describe('ClipTimeline (the first editor\'s events)', () => {
  // ISSUE-11: a track's name is shown whole on its own line above its buttons, with the full name as its title, and the
  // header is as wide at every screen size as the ruler and playhead assume.
  it('shows each track name whole, with its full name on hover and focus', async () => {
    const w = mountIt()
    const names = w.findAll('[data-test="ct-track-name"]')
    expect(names.map(n => n.text())).toEqual(['Video 1', 'Captions 1', 'Sound 1'])
    expect(names.map(n => n.attributes('title'))).toEqual(['Video 1', 'Captions 1', 'Sound 1'])
    w.unmount()
    const src = (await import('./ClipTimeline.vue?raw')).default
    const head = Number(/const HEAD = (\d+)/.exec(src)[1])
    expect(head).toBeGreaterThanOrEqual(112)
    expect(src).toContain(`width:${head}px`)
    expect(src).toMatch(/\.ct-name\{flex:1 0 100%[^}]*overflow-wrap:anywhere/)
    expect(src).not.toMatch(/\.ct-name\{[^}]*white-space:nowrap/)
    // No narrower header on a phone: the ruler and the playhead are placed after HEAD.
    expect(src.slice(src.indexOf('@media (max-width:767px)'))).not.toMatch(/\.ct-head\{[^}]*width:/)
  })

  it('names each track and item, with its times, and marks the selection', () => {
    const w = mountIt({ selection: ['b'] })
    const lanes = w.findAll('[role="listbox"]').map(l => l.attributes('aria-label'))
    expect(lanes).toEqual(['Video 1', 'Captions 1', 'Sound 1'])
    const b = w.get('[data-id="b"]')
    expect(b.attributes('aria-label')).toBe('beach.mp4, 0:02.00 to 0:04.00, selected')
    expect(b.attributes('aria-selected')).toBe('true')
    expect(w.get('[data-id="q1"]').text()).toContain('Hello')
    expect(w.find('[role="toolbar"]').exists()).toBe(false)               // no tools without the editor
    w.unmount()
  })

  it('has one tab stop per track and moves between items with the arrows', async () => {
    const w = mountIt()
    expect(w.findAll('.ct-row')[0].findAll('[role="option"][tabindex="0"]')).toHaveLength(1)
    w.get('[data-id="a"]').element.focus()
    await press(w.get('[data-id="a"]'), 'ArrowRight')
    expect(document.activeElement.dataset.id).toBe('b')
    await press(w.get('[data-id="b"]'), 'ArrowDown')
    expect(document.activeElement.dataset.id).toBe('q1')
    await press(w.get('[data-id="q1"]'), 'Enter')
    expect(w.emitted('select').at(-1)[0]).toEqual({ id: 'q1', add: false })
    w.unmount()
  })

  it('moves an item without dragging: Alt+arrow a frame, Shift a second', async () => {
    const w = mountIt()
    await press(w.get('[data-id="b"]'), 'ArrowLeft', { altKey: true })
    await press(w.get('[data-id="b"]'), 'ArrowRight', { altKey: true, shiftKey: true })
    expect(w.emitted('move').map(e => e[0])).toEqual([{ id: 'b', start: 1960 }, { id: 'b', start: 3000 }])
    w.unmount()
  })

  it('trim handles are sliders: a frame, a second, and the ends', async () => {
    const w = mountIt()
    const end = w.get('[data-id="a"] .ct-handle.end')
    expect(end.attributes('role')).toBe('slider')
    expect(end.attributes('aria-valuetext')).toBe('0:02.00')
    await press(end, 'ArrowLeft')
    await press(end, 'PageUp')
    await press(w.get('[data-id="b"] .ct-handle.start'), 'Home')
    expect(w.emitted('trim').map(e => e[0])).toEqual([
      { id: 'a', edge: 'end', at: 1960 }, { id: 'a', edge: 'end', at: 3000 }, { id: 'b', edge: 'start', at: 0 }])
    w.unmount()
  })

  it('the playhead is a slider read as a time; the ruler seeks on a tap', async () => {
    const w = mountIt()
    const seek = w.get('.ct-slider')
    expect(seek.attributes('aria-valuetext')).toBe('0:01.00')
    await press(seek, 'PageDown')
    await press(seek, 'End')
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
    expect(w.emitted('track').map(e => e[0])).toEqual([{ id: 'v1', changes: { mute: true } }, { id: 't1', changes: { hide: true } }])
    // The page applies them with setTrackOps, which also reads the version 2 names.
    const d = doc()
    expect(tl.applyOps(d, tl.setTrackOps(d, 'v1', { mute: true })).doc.tracks[0].mute).toBe(true)
    w.unmount()
  })
})

describe('ClipTimeline with the editor', () => {
  it('a tools bar with one tab stop; the arrows move along it; a tool is pressed', async () => {
    const { ed, w } = withEditor()
    const bar = w.get('[role="toolbar"]')
    expect(bar.attributes('aria-label')).toBe('Timeline tools')
    await nextTick()
    expect(bar.findAll('button[tabindex="0"]')).toHaveLength(1)
    const first = bar.findAll('button')[0]
    first.element.focus()
    await press(first, 'ArrowRight')
    expect(document.activeElement.dataset.test).toBe('ct-tool-blade')
    await w.get('[data-test="ct-tool-blade"]').trigger('click')
    expect([ed.tool.value, w.get('[data-test="ct-tool-blade"]').attributes('aria-pressed')]).toEqual(['blade', 'true'])
    await w.get('[data-test="ct-tool-trim"]').trigger('click')
    expect(w.text()).toContain('Ripple')
    expect(w.get('[data-test="ct-magnet"]').attributes('aria-pressed')).toBe('false')
    await w.get('[data-test="ct-magnet"]').trigger('click')
    expect(ed.magnet.value).toBe(true)
    w.unmount()
  })

  it('shortcuts work while the timeline has focus and do not reach the page', async () => {
    const { ed, w } = withEditor()
    const outside = vi.fn()
    document.body.addEventListener('keydown', outside)
    await press(w.get('.ct-scroll'), 'b')
    expect(ed.tool.value).toBe('blade')
    ed.seek(1000)
    await press(w.get('.ct-scroll'), 'b', { ctrlKey: true })
    expect(tl.ordered(ed.doc.value.tracks[0])).toHaveLength(3)
    await press(w.get('.ct-scroll'), 'l')
    expect(ed.playback.rate).toBe(1)
    expect(outside).not.toHaveBeenCalled()
    await press(w.get('.ct-scroll'), 'F1')                                   // not a shortcut: the page gets it
    expect(outside).toHaveBeenCalledTimes(1)
    document.body.removeEventListener('keydown', outside)
    w.unmount()
  })

  it('markers on the ruler: added with M, opened to rename, recolour and make a chapter, moved and deleted by keyboard', async () => {
    const { ed, w } = withEditor()
    ed.seek(1000)
    await press(w.get('.ct-scroll'), 'm')
    const flag = w.get('.ct-marker')
    expect(flag.attributes('aria-label')).toBe('Marker at 0:01.00')
    await flag.trigger('click')
    const name = w.get('[data-test="ct-marker-name"]')
    expect(document.activeElement).toBe(name.element)
    await name.setValue('Hook')
    await name.trigger('change')
    await w.findAll('.ct-swatch input')[2].setValue(true)
    await w.get('[data-test="ct-marker-chapter"]').setValue(true)
    expect(ed.doc.value.markers[0]).toMatchObject({ name: 'Hook', color: '#46A758', chapter: true })
    expect(w.get('.ct-marker').attributes('aria-label')).toBe('Chapter Hook, at 0:01.00')
    await press(w.get('[role="dialog"]'), 'Escape')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    await press(w.get('.ct-marker'), 'ArrowRight', { altKey: true })
    expect(ed.doc.value.markers[0].at_ms).toBe(1040)
    await press(w.get('.ct-marker'), 'Delete')
    expect(ed.doc.value.markers).toEqual([])
    w.unmount()
  })

  it('track headers: the main track marked, lock and solo, and settings with name, height and role', async () => {
    const { ed, w } = withEditor()
    expect(w.findAll('.ct-row')[0].find('.ct-badge').text()).toBe('Main')
    await w.get('[aria-label="Lock Video 1"]').trigger('click')
    expect(tl.flag(ed.doc.value.tracks[0], 'lock')).toBe(true)
    expect(w.get('[data-id="a"]').attributes('aria-label')).toContain('locked')
    await w.get('[aria-label="Solo Sound 1"]').trigger('click')
    expect(ed.doc.value.tracks[2].solo).toBe(true)
    await w.get('[data-test="ct-track-settings-a1"]').trigger('click')
    const dialog = w.get('[role="dialog"]')
    await dialog.get('[data-test="ct-track-rename"]').setValue('Voice')
    await dialog.get('[data-test="ct-track-rename"]').trigger('change')
    const height = dialog.get('input[type="range"]')
    expect(height.attributes('aria-valuetext')).toBe('40 pixels')
    await height.setValue('96'); await height.trigger('change')
    await dialog.get('select').setValue('dialogue')
    expect(ed.doc.value.tracks[2]).toMatchObject({ name: 'Voice', height: 96, role: 'dialogue' })
    expect(w.findAll('.ct-row')[2].attributes('style')).toContain('height: 96px')
    expect(await said(ed)).toBe('Voice role dialogue')
    w.unmount()
  })

  it('draws connected clips\' links, keyframe diamonds, and the red edit point at the end of a file', async () => {
    const d = doc()
    d.tracks[0].items[1] = clip('b', 2000, { keyframes: { 'transform.x': [{ t_ms: 0, v: 0, ease: 'linear' }, { t_ms: 1000, v: 1, ease: 'linear' }] } })
    d.tracks.splice(1, 0, { id: 'v2', kind: 'video', items: [clip('o', 2400, { source_out_ms: 400, anchor: { clip: 'b', offset_ms: 400 } })] })
    const { ed, w } = withEditor(d)
    await nextTick()
    expect(w.findAll('.ct-links line')).toHaveLength(1)
    expect(w.get('[data-id="o"]').attributes('aria-label')).toBe('beach.mp4, 0:02.10 to 0:02.20, connected to beach.mp4')
    expect(w.get('[data-id="b"]').findAll('.ct-key')).toHaveLength(2)
    expect(w.get('[data-id="b"]').attributes('aria-label')).toContain('2 keyframes')
    ed.select('a')
    await nextTick()
    const endHandle = w.get('[data-id="a"] .ct-handle.end')
    expect(endHandle.classes()).toContain('limit')                         // a's file is 2 s and it plays all of it
    expect(endHandle.attributes('aria-valuetext')).toBe('0:02.00, the end of the file')
    w.unmount()
  })

  it('compound clips show as one clip; Enter opens one, Escape goes back', async () => {
    const { ed, w } = withEditor()
    ed.select('a'); ed.select('b', { add: true })
    ed.makeCompound('Opening')
    await nextTick()
    const c = w.get('.ct-item.compound')
    expect(c.attributes('aria-label')).toMatch(/^Opening, 0:00.00 to 0:04.00, compound clip, Enter opens it/)
    await press(c, 'Enter')
    expect(w.get('.ct-crumbs').text()).toContain('Opening')
    expect(w.findAll('.ct-row')[0].findAll('.ct-item').map(i => i.attributes('data-id'))).toEqual(['a', 'b'])
    await press(w.get('.ct-scroll'), 'Escape')
    expect(w.find('.ct-crumbs').exists()).toBe(false)
    ed.select(c.attributes('data-id'))
    await nextTick()
    await w.get('[data-test="ct-flatten"]').trigger('click')
    expect(w.find('.ct-item.compound').exists()).toBe(false)
    w.unmount()
  })

  it('the blade cuts where it is clicked; a marquee selects across tracks', async () => {
    const { ed, w } = withEditor()
    ed.setTool('blade')
    await nextTick()
    const lane = w.findAll('.ct-lane')[0]
    lane.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 52 })
    w.get('[data-id="a"]').element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 50, button: 0, bubbles: true }))
    expect(tl.ordered(ed.doc.value.tracks[0]).map(i => i.start_ms)).toEqual([0, 520, 2000])   // 0.5 s at 100 px a second, on the 25 fps grid
    ed.setTool('select')
    await nextTick()
    const rows = w.findAll('.ct-row')
    rows.forEach((r, n) => { Object.defineProperty(r.element, 'offsetTop', { value: 28 + n * 52 }); Object.defineProperty(r.element, 'offsetHeight', { value: 52 }) })
    w.get('.ct-body').element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 2000, height: 300 })
    const textLane = w.findAll('.ct-lane')[1].element
    textLane.dispatchEvent(new MouseEvent('pointerdown', { clientX: 144 + 30, clientY: 100, button: 0, bubbles: true }))
    textLane.dispatchEvent(new MouseEvent('pointermove', { clientX: 144 + 160, clientY: 40, bubbles: true }))
    await nextTick()
    expect(w.find('.ct-marquee').exists()).toBe(true)
    textLane.dispatchEvent(new MouseEvent('pointerup', { clientX: 144 + 160, clientY: 40, bubbles: true }))
    const second = tl.ordered(ed.doc.value.tracks[0])[1].id               // the blade's second part of a
    expect(ed.selection.value.sort()).toEqual(['a', second, 'q1'].sort())
    w.unmount()
  })

  it('paste attributes asks which attributes, with all that apply ticked, and pastes them', async () => {
    const d = doc()
    d.tracks[0].items[0] = clip('a', 0, { transform: { x: 0.2, y: 0.2, scale: 1.5, opacity: 1 }, blend: 'screen' })
    const { ed, w } = withEditor(d)
    ed.select('a'); ed.copy(); ed.select('b')
    await nextTick()
    await w.get('[data-test="ct-paste-attributes"]').trigger('click')
    await nextTick()
    const boxes = w.findAll('[role="dialog"] input[type="checkbox"]')
    expect(boxes.map(b => b.element.checked).every(Boolean)).toBe(true)
    for (const b of boxes) if (b.element.value !== 'blend') await b.setValue(false)
    await w.get('[data-test="ct-paste-go"]').trigger('click')
    expect(tl.find(ed.doc.value, 'b').item).toMatchObject({ blend: 'screen' })
    expect(tl.find(ed.doc.value, 'b').item.transform).toBeUndefined()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    w.unmount()
  })

  it('icon buttons: each has a name, a tooltip with its shortcut, and toggles say whether they are on', async () => {
    const { ed, w } = withEditor()
    ed.select('a'); ed.copy()
    ed.addMarker({ at_ms: 1000 })
    await nextTick()
    const icons = w.findAll('button').filter(b => !b.text().trim() && !b.classes('ct-marker') && !b.element.closest('.ct-transition'))
    expect(icons.length).toBeGreaterThanOrEqual(24)
    for (const b of icons) {
      expect(b.attributes('aria-label'), b.html()).toBeTruthy()
      expect(b.attributes('data-tip'), b.html()).toBeTruthy()
      expect(b.find('svg').attributes('aria-hidden')).toBe('true')
    }
    expect(w.get('[data-test="ct-tool-blade"]').attributes()).toMatchObject({ 'aria-label': 'Blade', 'data-tip': 'Blade (B)', 'aria-keyshortcuts': 'B', 'aria-pressed': 'false' })
    expect(w.get('[data-test="ct-split"]').attributes('data-tip')).toBe('Split at the playhead (Ctrl+B)')
    for (const t of ['select', 'blade', 'trim', 'slip', 'slide']) expect(w.get(`[data-test="ct-tool-${t}"]`).text()).toBe('')
    for (const t of ['ct-magnet', 'ct-snap']) expect(['true', 'false']).toContain(w.get(`[data-test="${t}"]`).attributes('aria-pressed'))
    for (const b of w.findAll('.ct-head .ct-inline')) expect(['true', 'false']).toContain(b.attributes('aria-pressed'))
    // The marker panel's actions and the compound breadcrumb's back button are icons too.
    await w.get('.ct-marker').trigger('click')
    for (const t of ['ct-marker-here', 'ct-marker-delete', 'ct-panel-done']) expect(w.get(`[data-test="${t}"]`).attributes('aria-label')).toBeTruthy()
    await w.get('[data-test="ct-panel-done"]').trigger('click')
    ed.makeCompound()
    await nextTick()
    await press(w.get('.ct-item.compound'), 'Enter')
    expect(w.get('[data-test="ct-crumb-back"]').attributes()).toMatchObject({ 'aria-label': 'Back', 'data-tip': 'Back (Escape)' })
    await w.get('[data-test="ct-crumb-back"]').trigger('click')
    expect(ed.scopeId.value).toBeNull()
    w.unmount()
    // Targets: at least 24 px, 44 px on a phone; a visible focus ring; the tooltip also shows on keyboard focus.
    const src = (await import('./ClipTimeline.vue?raw')).default
    expect(src).toMatch(/\.ct-tb\{[^}]*min-height:28px;min-width:28px/)
    expect(src).toMatch(/\.ct-icon\{[^}]*width:24px;height:24px/)
    const phone = src.slice(src.indexOf('@media (max-width:767px)'))
    expect(phone).toMatch(/\.ct-tb\{min-height:44px;min-width:44px\}/)
    expect(phone).toMatch(/\.ct-icon\{width:44px;height:44px\}/)
    expect(src).toMatch(/\.ct-tb:focus-visible,\.ct-icon:focus-visible[^{]*\{outline:2px solid/)
    expect(src).toMatch(/\.ct-tip\[data-tip\]:focus-visible::after\{content:attr\(data-tip\)\}/)
  })

  it('connect, detach and split sound from the tools bar', async () => {
    const d = doc()
    d.tracks.splice(1, 0, { id: 'v2', kind: 'video', items: [clip('o', 2400, { source_out_ms: 400 })] })
    const { ed, w } = withEditor(d)
    ed.select('o')
    await nextTick()
    await w.get('[data-test="ct-connect"]').trigger('click')
    expect(tl.find(ed.doc.value, 'o').item.anchor).toEqual({ clip: 'b', offset_ms: 400 })
    await w.get('[data-test="ct-detach"]').trigger('click')
    expect(tl.find(ed.doc.value, 'o').item.anchor).toBeUndefined()
    ed.select('a')
    await nextTick()
    await w.get('[data-test="ct-split-audio"]').trigger('click')
    expect(ed.doc.value.tracks.find(t => t.id === 'a1').items[0]).toMatchObject({ media: 'm1', anchor: { clip: 'a', offset_ms: 0 } })
    w.unmount()
  })
})
