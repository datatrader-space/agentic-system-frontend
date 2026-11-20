// @vitest-environment jsdom
// Captions and helpers (VIDEO_EDITOR_PRO_PLAN.md F27, J36-J39, G32; contract sections 1 and 7): SRT and VTT in and
// out, split by length, edit as text, caption styles; cutting by file time (pauses, filler words, struck transcript
// words) closes the gap; scene cuts split; beats become markers and cuts; every helper starts its derive job and shows
// its result for review before the timeline changes.
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as tl from '../timelineModel'
import { setRegistry } from '../registry'
// The server's registry, as `manage.py editor_registry_export` writes it; the page reads it before the panels show.
import registryFixture from '../__fixtures__/registry.json'
setRegistry(registryFixture)
import { cutSourceRangesOps, cutToBeatOps, splitAtSourceOps } from './panelModel'
import { parseSubtitles, splitByLength, spreadWords, toSrt, toVtt } from './subtitles'
import ClipHelpers from './ClipHelpers.vue'
import ClipCaptions from '../ClipCaptions.vue'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('../../../services/api', () => ({ default: api }))

const clip = (id, start, extra = {}) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: 4000, speed: 1, volume_db: 0, ...extra })
const cap = (id, start, end, text, extra = {}) => ({ type: 'text', id, start_ms: start, end_ms: end, text, style: { font: 'inter', size: 0.045, color: '#FFFFFF' }, x: 0.5, y: 0.88, ...extra })
const docOf = (videoItems, captions = [], audio = []) => ({ ...tl.newDoc('16:9', 25), tracks: [
  { id: 'v1', kind: 'video', main: true, items: videoItems }, { id: 't1', kind: 'text', captions: true, items: captions }, { id: 'a1', kind: 'audio', items: audio }] })
const after = (d, w) => tl.applyOps(d, w.emitted('ops').at(-1)[0].ops).doc
const items = (d, track = 'v1') => tl.ordered(d.tracks[tl.trackOf(d, track)])

beforeEach(() => { setActivePinia(createPinia()); api.get.mockReset(); api.post.mockReset(); api.put.mockReset(); api.get.mockResolvedValue({ data: {} }) })

describe('subtitles', () => {
  it('reads SRT and VTT (tags dropped, lines joined) and writes them back', () => {
    const srt = '1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>Hello</i>\r\nthere\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nAgain\r\n'
    const cues = parseSubtitles(srt)
    expect(cues).toEqual([{ start_ms: 1000, end_ms: 2500, text: 'Hello there' }, { start_ms: 3000, end_ms: 4000, text: 'Again' }])
    expect(parseSubtitles(toVtt(cues))).toEqual(cues)
    expect(toSrt(cues)).toContain('00:00:01,000 --> 00:00:02,500\nHello there')
    expect(parseSubtitles('WEBVTT\n\n00:01.000 --> 00:02.000 align:start\nShort form\n')).toEqual([{ start_ms: 1000, end_ms: 2000, text: 'Short form' }])
  })

  it('splits a long caption between words, keeping word times, and spreads words over an edited caption', () => {
    const words = [['one', 0, 300], ['two', 300, 600], ['three', 600, 1000], ['four', 1000, 1400]].map(([text, start_ms, end_ms]) => ({ text, start_ms, end_ms }))
    const parts = splitByLength({ text: 'one two three four', start_ms: 0, end_ms: 1500, words }, 8)
    expect(parts.map(p => p.text)).toEqual(['one two', 'three', 'four'])
    expect(parts.map(p => [p.start_ms, p.end_ms])).toEqual([[0, 600], [600, 1000], [1000, 1500]])
    const spread = spreadWords('ab abcd', 0, 800)
    expect(spread).toEqual([{ text: 'ab', start_ms: 0, end_ms: 300 }, { text: 'abcd', start_ms: 300, end_ms: 800 }])
  })
})

describe('cutting by file time', () => {
  it('removes parts of the file, closes the gap and moves later clips back', () => {
    const d = docOf([clip('a', 0), clip('b', 4000)])
    const next = tl.applyOps(d, cutSourceRangesOps(d, 'a', [{ start_ms: 1000, end_ms: 1500 }, { start_ms: 3000, end_ms: 3200 }])).doc
    const list = items(next)
    expect(list.map(i => [i.id, i.start_ms, i.source_in_ms, i.source_out_ms])).toEqual([
      ['a', 0, 0, 1000], ['c1', 1000, 1500, 3000], ['c2', 2520, 3200, 4000], ['b', 3320, 0, 4000]])
    expect(tl.problem(next)).toBe('')
  })

  it('with the magnet on, the cut goes through the editor rules and the transition out moves to the last part', () => {
    let d = docOf([clip('a', 0), clip('b', 4000)])
    d = tl.applyOps(d, tl.addTransitionOps(d, 'a', 'crossfade', 400)).doc
    const ops = cutSourceRangesOps(d, 'a', [{ start_ms: 1000, end_ms: 1500 }])
    const next = tl.applyOps(d, tl.finish(d, ops)).doc                       // as editor.edit makes it
    expect(tl.problem(next)).toBe('')
    expect(items(next).map(i => i.id)).toEqual(['a', 'c1', 'b'])
    expect(next.tracks[0].items.find(i => i.type === 'transition').between).toEqual(['c1', 'b'])
  })

  it('does nothing for a speed ramp or nothing to cut', () => {
    const d = docOf([clip('a', 0, { speed: undefined, speed_curve: [{ x: 0, y: 1 }, { x: 1, y: 2 }] })])
    expect(cutSourceRangesOps(d, 'a', [{ start_ms: 100, end_ms: 900 }])).toEqual([])
    expect(cutSourceRangesOps(docOf([clip('a', 0)]), 'a', [{ start_ms: 5000, end_ms: 6000 }])).toEqual([])
  })

  it('splits at scene cuts inside the clip, and cuts clips to the beat', () => {
    const d = docOf([clip('a', 0)])
    const split = tl.applyOps(d, splitAtSourceOps(d, 'a', [1000, 2500, 9000])).doc
    expect(items(split).map(i => [i.start_ms, i.source_in_ms, i.source_out_ms])).toEqual([[0, 0, 1000], [1000, 1000, 2520], [2520, 2520, 4000]])            // 2500 ms is on the 25 fps grid at 2520
    const two = docOf([clip('a', 0), clip('b', 4000)])
    const beat = tl.applyOps(two, cutToBeatOps(two, ['a', 'b'], [480, 1000, 2000, 3000, 5000])).doc
    expect(items(beat).map(i => [i.id, i.start_ms, tl.itemEnd(i)])).toEqual([['a', 0, 3000], ['b', 3000, 5000]])
  })
})

describe('ClipHelpers', () => {
  it('finds pauses and filler words, lists them for review, and cuts only the ones still ticked', async () => {
    // editor_derive silences: each pause with the part to cut (null: too short once its edges are kept), each filler.
    api.post.mockResolvedValue({ data: { id: 'd1', state: 'ready', result: { silences: [{ start_ms: 950, end_ms: 1650, cut: { start_ms: 1000, end_ms: 1600 } }, { start_ms: 3000, end_ms: 3100, cut: null }],
      fillers: [{ word_index: 4, start_ms: 2000, end_ms: 2300, text: 'um' }], fillers_checked: true, transcript_job_id: 't1', duration_ms: 4000 } } })
    const d = docOf([clip('a', 0)]), w = mount(ClipHelpers, { props: { doc: d, clip: d.tracks[0].items[0] } })
    await w.find('[data-test="hp-silences-find"]').trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/editor/derive/', { media: 'm1', op: 'silences', params: { min_ms: 600, fillers: true } })
    expect(w.text()).toContain('Found 2.')
    expect(w.text()).toContain('“um” at')
    expect(w.emitted('ops')).toBeUndefined()                                  // nothing changes before review
    await w.findAll('[data-test="hp-silences"] input[type="checkbox"]')[0].setValue(false)
    await w.find('[data-test="hp-silences-cut"]').trigger('click')
    expect(items(after(d, w)).map(i => [i.source_in_ms, i.source_out_ms])).toEqual([[0, 2000], [2300, 4000]])
  })

  it('follows a running job to its result, and shows a failure', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      api.post.mockResolvedValue({ data: { id: 'd2', state: 'running', progress: 0.4 } })
      api.get.mockResolvedValue({ data: { id: 'd2', state: 'ready', result: { cuts: [{ ms: 1500, score: 31.2 }], duration_ms: 4000 } } })
      const d = docOf([clip('a', 0)]), w = mount(ClipHelpers, { props: { doc: d, clip: d.tracks[0].items[0] } })
      await w.find('[data-test="hp-scenes-find"]').trigger('click')
      await flushPromises()
      expect(w.text()).toContain('Looking for scene cuts… 40%')
      await vi.advanceTimersByTimeAsync(2100)
      expect(api.get).toHaveBeenCalledWith('/video/editor/derive/d2/')
      await w.find('[data-test="hp-scenes-split"]').trigger('click')
      expect(items(after(d, w))).toHaveLength(2)
      api.post.mockRejectedValue({ response: { status: 400, data: { error: { message: 'This file has no picture.' } } } })
      await w.find('[data-test="hp-scenes-find"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="hp-scenes"] [role="alert"]').text()).toBe('This file has no picture.')
    } finally { vi.useRealTimers() }
  })

  it('a second request while one runs follows the running one (409)', async () => {
    api.post.mockRejectedValue({ response: { status: 409, data: { error: { code: 'running' }, derive: { id: 'd9', op: 'scene_cuts', state: 'running', progress: null } } } })
    const d = docOf([clip('a', 0)]), w = mount(ClipHelpers, { props: { doc: d, clip: d.tracks[0].items[0] } })
    await w.find('[data-test="hp-scenes-find"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Looking for scene cuts…')
    w.unmount()
  })

  it('adds beat markers and cuts the selected video clips to the beat', async () => {
    api.post.mockResolvedValue({ data: { id: 'd3', state: 'ready', result: { bpm: 60, beat_ms: [1000, 2000, 3000], bar_ms: [1000], beats_per_bar: 4, beat_length_ms: 1000, duration_ms: 8000 } } })
    const music = { type: 'clip', id: 'm1c', media: 'song', start_ms: 0, source_in_ms: 0, source_out_ms: 8000, volume_db: 0 }
    const d = docOf([clip('a', 0), clip('b', 4000)], [], [music])
    const w = mount(ClipHelpers, { props: { doc: d, clip: music, selection: ['m1c', 'a', 'b'] } })
    await w.find('[data-test="hp-beats-find"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="hp-beats-markers"]').trigger('click')
    expect(after(d, w).markers.map(m => m.at_ms)).toEqual([1000, 2000, 3000])
    await w.find('[data-test="hp-beats-cut"]').trigger('click')
    expect(items(after(d, w)).map(i => [i.id, i.start_ms, tl.itemEnd(i)])).toEqual([['a', 0, 3000], ['b', 3000, 7000]])
  })
})

describe('ClipCaptions', () => {
  const stubs = { MediaRoutePicker: true, VideoJobCard: { props: ['job'], template: '<div class="job">{{ job.state }}</div>' } }
  const mountIt = (d, clipItem = null) => mount(ClipCaptions, { props: { projectId: 'p1', doc: d, clip: clipItem, rate: 25 }, global: { stubs } })

  it('sets the style of every caption with its highlight colour', async () => {
    const d = docOf([], [cap('q1', 0, 1000, 'Hello there'), cap('q2', 1000, 2000, 'Again')]), w = mountIt(d)
    await w.find('[data-test="cc-mode-karaoke"]').trigger('click')
    expect(items(after(d, w), 't1').map(c => c.caption_style)).toEqual([{ mode: 'karaoke' }, { mode: 'karaoke' }])
    const d2 = after(d, w)
    await w.setProps({ doc: d2 })
    await w.find('[data-test="cc-highlight"]').setValue('#ff0000')
    expect(items(after(d2, w), 't1')[1].caption_style).toEqual({ mode: 'karaoke', highlight_color: '#FF0000' })
  })

  it('splits long captions and edits every caption as text, one a line', async () => {
    const long = cap('q1', 0, 3000, 'a fairly long caption that should be cut', { words: spreadWords('a fairly long caption that should be cut', 0, 3000) })
    const d = docOf([], [long]), w = mountIt(d)
    await w.findAll('input[type="number"]').at(-1).setValue(16)
    await w.find('[data-test="cc-split"]').trigger('click')
    const parts = items(after(d, w), 't1')
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every(p => p.text.length <= 16)).toBe(true)
    expect(parts[0].id).toBe('q1')
    expect(tl.problem(after(d, w))).toBe('')
    const d2 = docOf([], [cap('q1', 0, 1000, 'One'), cap('q2', 1000, 2000, 'Two')]), w2 = mountIt(d2)
    await w2.find('[data-test="cc-text"]').setValue('One\nTwo\nThree')
    await w2.find('[data-test="cc-apply"]').trigger('click')
    expect(w2.text()).toContain('Keep one line for each caption')
    await w2.find('[data-test="cc-text"]').setValue('One\nSecond')
    await w2.find('[data-test="cc-apply"]').trigger('click')
    expect(items(after(d2, w2), 't1').map(c => c.text)).toEqual(['One', 'Second'])
  })

  it('imports an SRT file as captions', async () => {
    const d = docOf([]), w = mountIt(d)
    const file = new File(['1\n00:00:00,500 --> 00:00:01,500\nHi\n'], 'talk.srt', { type: 'application/x-subrip' })
    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()
    expect(w.emitted('captions')[0][0]).toEqual([{ start_ms: 500, end_ms: 1500, text: 'Hi' }])
    expect(w.text()).toContain('1 caption read from talk.srt')
  })

  it('places word-timed captions from speech, and edits the video by striking transcript words', async () => {
    const c = clip('a', 1000, { source_in_ms: 2000, source_out_ms: 6000 })
    const d = docOf([c])
    api.post.mockResolvedValue({ data: { job_id: 'tj', state: 'ready', operation: 'transcribe' } })
    const words = [{ text: 'so', start_ms: 0, end_ms: 400 }, { text: 'um', start_ms: 400, end_ms: 800 }, { text: 'hello', start_ms: 800, end_ms: 1400 }]
    api.get.mockResolvedValue({ data: { cues: [{ text: 'so um hello', start_ms: 0, end_ms: 1400, words }], words } })
    const w = mount(ClipCaptions, { props: { projectId: 'p1', doc: d, clip: c, rate: 25 }, global: { stubs: { ...stubs, MediaRoutePicker: { props: ['modelValue'], template: '<button class="pick" @click="$emit(\'update:modelValue\', \'r1\')">pick</button>' } } } })
    await w.find('.pick').trigger('click')
    await w.find('[data-test="cc-estimate"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="cc-place"]').trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/editor/captions/', { params: { transcript_job_id: 'tj', start_ms: 2000, end_ms: 6000 } })
    expect(w.emitted('captions')[0][0]).toEqual([{ text: 'so um hello', start_ms: 1000, end_ms: 2400,
      words: [{ text: 'so', start_ms: 1000, end_ms: 1400 }, { text: 'um', start_ms: 1400, end_ms: 1800 }, { text: 'hello', start_ms: 1800, end_ms: 2400 }] }])
    await w.find('[data-test="cc-transcript"]').trigger('click')
    await flushPromises()
    const um = w.findAll('.cc-word').find(b => b.text() === 'um')
    await um.trigger('click')
    expect(um.attributes('aria-pressed')).toBe('true')
    await w.find('[data-test="cc-cut"]').trigger('click')
    expect(items(after(d, w)).map(i => [i.source_in_ms, i.source_out_ms])).toEqual([[2000, 2400], [2800, 6000]])
  })
})

describe('ClipHelpers: reframe', () => {
  it('turns the reframe result (crop size, path of top-left corners in file time) into a crop with keyframes', async () => {
    api.post.mockResolvedValue({ data: { id: 'd5', state: 'ready', result: { aspect: '9:16', crop: { w: 0.3164, h: 1 }, method: 'saliency_and_motion', samples_per_second: 4, duration_ms: 4000,
      source: { width: 1920, height: 1080 }, path: [{ t_ms: 0, cx: 0.5, cy: 0.5, x: 0.3418, y: 0 }, { t_ms: 2000, cx: 0.6, cy: 0.5, x: 0.4418, y: 0 }] } } })
    const d = docOf([clip('a', 0)]), w = mount(ClipHelpers, { props: { doc: d, clip: d.tracks[0].items[0] } })
    const box = w.find('[data-test="hp-reframe"]')
    await box.findAll('button').find(b => b.text() === 'Follow the subject').trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/editor/derive/', { media: 'm1', op: 'reframe', params: { aspect: '9:16' } })
    await box.findAll('button').find(b => b.text() === 'Use the reframed crop').trigger('click')
    const it = items(after(d, w))[0]
    expect(it.crop).toEqual({ x: 0.342, y: 0, w: 0.3164, h: 1 })
    expect(it.keyframes['crop.x']).toEqual([{ t_ms: 0, v: 0.342, ease: 'linear' }, { t_ms: 2000, v: 0.442, ease: 'linear' }])
  })
})
