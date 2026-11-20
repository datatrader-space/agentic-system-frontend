// @vitest-environment jsdom
// The export dialog (VIDEO_EDITOR_PRO_PLAN.md I34-I35, contract section 9): 4K only when a source is above 1080p and
// said to count as two exports, the timeline's rate or 60, quality, the selection as the range, every output with the
// reason it is off when it cannot be made, the still at the playhead, a GIF of at most 15 seconds, and the loudness.
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import ClipExportDialog from './ClipExportDialog.vue'
import * as tl from './timelineModel'

const clip = (id, start, len = 4000) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: len, speed: 1 })
const docOf = (extra = {}) => ({ ...tl.newDoc('9:16', 30), tracks: [{ id: 'v1', kind: 'video', items: [clip('a', 0), clip('b', 4000, 20000)] }, { id: 't1', kind: 'text', captions: true, items: [] }], ...extra })
const HD = { m1: { media_type: 'video', width: 1920, height: 1080 } }, UHD = { m1: { media_type: 'video', width: 3840, height: 2160 } }
const mountIt = (props = {}) => mount(ClipExportDialog, { props: { doc: docOf(), media: HD, playhead: 1000, ...props }, global: { stubs: { VideoJobCard: true } }, attachTo: document.body })
const params = w => w.emitted('export').at(-1)[0]

beforeEach(() => setActivePinia(createPinia()))

describe('ClipExportDialog', () => {
  it('offers 4K only with a source above 1080p, and says it counts as two exports', async () => {
    const options = w => w.findAll('[data-test="cx-resolution"] option').map(o => o.element.value)
    expect(options(mountIt())).toEqual(['720p', '1080p'])
    const w = mountIt({ media: UHD })
    expect(options(w)).toEqual(['720p', '1080p', '4k'])
    await w.get('[data-test="cx-resolution"]').setValue('4k')
    expect(w.text()).toContain('counts as two of your two running exports')
    await w.get('[data-test="cx-export"]').trigger('click')
    expect(params(w)).toMatchObject({ resolution: '4k', rate: 30, quality: 'standard', outputs: ['video'], loudness: 'none', aspects: ['9:16'] })
  })

  it('exports the selection, a still at the playhead and sound only', async () => {
    const w = mountIt({ selectionRange: [0, 4000], playhead: 1234 })
    await w.get('[data-test="cx-range-selection"]').setValue(true)
    await w.get('[data-test="cx-out-still"]').setValue(true)
    await w.get('[data-test="cx-out-audio_wav"]').setValue(true)
    expect(w.text()).toContain('The still is the frame at the playhead')
    await w.get('[data-test="cx-export"]').trigger('click')
    expect(params(w)).toMatchObject({ range_ms: [0, 4000], outputs: ['video', 'still', 'audio_wav'], still_at_ms: 1234 })
  })

  it('says why an output cannot be made: a GIF over 15 seconds, captions or chapters missing', async () => {
    const w = mountIt()
    expect(w.get('[data-test="cx-out-gif"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Choose a range of 15 seconds or less.')
    expect(w.get('[data-test="cx-out-srt"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="cx-out-chapters"]').attributes('disabled')).toBeDefined()
    const w2 = mountIt({ selectionRange: [0, 4000], doc: docOf({ markers: [{ id: 'k1', at_ms: 0, name: 'Intro', color: '#F2B341', chapter: true }] }) })
    await w2.get('[data-test="cx-range-selection"]').setValue(true)
    expect(w2.get('[data-test="cx-out-gif"]').attributes('disabled')).toBeUndefined()
    expect(w2.get('[data-test="cx-out-chapters"]').attributes('disabled')).toBeUndefined()
    await w2.get('[data-test="cx-out-gif"]').setValue(true)
    await w2.get('[data-test="cx-export"]').trigger('click')
    expect(params(w2)).toMatchObject({ outputs: ['video', 'gif'], range_ms: [0, 4000] })
    // A short timeline's GIF names the whole timeline as its range.
    const short = mountIt({ doc: { ...tl.newDoc('9:16', 30), tracks: [{ id: 'v1', kind: 'video', items: [clip('a', 0, 6000)] }] } })
    await short.get('[data-test="cx-out-gif"]').setValue(true)
    await short.get('[data-test="cx-export"]').trigger('click')
    expect(params(short).range_ms).toEqual([0, 6000])
    expect(short.get('[data-test="cx-close"]').attributes('data-tip')).toBe('Close (Esc)')
  })

  it('needs an output, and a shape when it makes pictures; sound alone needs no shape; 60 fps and loudness are sent', async () => {
    const w = mountIt()
    await w.get('[data-test="cx-out-video"]').setValue(false)
    expect(w.text()).toContain('Choose at least one thing to make.')
    expect(w.get('[data-test="cx-export"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="cx-out-audio_mp3"]').setValue(true)
    expect(w.find('[data-test="cx-shape-9:16"]').exists()).toBe(false)
    await w.get('[data-test="cx-loudness"]').setValue('-23')
    await w.get('[data-test="cx-export"]').trigger('click')
    expect(params(w)).toMatchObject({ outputs: ['audio_mp3'], loudness: '-23' })
    expect(params(w).range_ms).toBeUndefined()
    await w.get('[data-test="cx-out-video"]').setValue(true)
    await w.get('[data-test="cx-shape-9:16"]').setValue(false)
    expect(w.text()).toContain('Choose at least one shape.')
    await w.get('[data-test="cx-shape-1:1"]').setValue(true)
    await w.get('[data-test="cx-rate"]').setValue('60')
    await w.get('[data-test="cx-quality"]').setValue('draft')
    await w.get('[data-test="cx-export"]').trigger('click')
    expect(params(w)).toMatchObject({ aspects: ['1:1'], rate: 60, quality: 'draft' })
  })
})
