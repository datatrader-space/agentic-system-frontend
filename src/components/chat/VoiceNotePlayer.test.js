// @vitest-environment jsdom
//
// The voice-note bubbles (VOICE_NOTES_PLAN.md): a player anyone can operate (labelled buttons, a seekable bar,
// speed), the answer's "recording / ready / why not" states, and a voice note never shown as its transcript.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VoiceNotePlayer from './VoiceNotePlayer.vue'
import VoiceReply from './VoiceReply.vue'

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
  window.HTMLMediaElement.prototype.pause = vi.fn()
})

describe('VoiceNotePlayer', () => {
  it('has labelled controls and the recorded length until the file reports its own', () => {
    const w = mount(VoiceNotePlayer, { props: { src: '/media/n.m4a', label: 'your voice note', seconds: 12.4 } })
    expect(w.get('[data-test="voice-note-play"]').attributes('aria-label')).toBe('Play your voice note')
    expect(w.get('[data-test="voice-note-seek"]').attributes('aria-valuetext')).toBe('0:00 of 0:12')
    expect(w.text()).toContain('0:12')
    expect(w.get('audio').attributes('src')).toBe('/media/n.m4a')
  })

  it('plays and pauses', async () => {
    const w = mount(VoiceNotePlayer, { props: { src: '/media/n.m4a' } })
    await w.get('[data-test="voice-note-play"]').trigger('click')
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it('cycles the speed 1x → 1.5x → 2x → 1x', async () => {
    const w = mount(VoiceNotePlayer, { props: { src: '/media/n.m4a' } })
    const b = w.get('[data-test="voice-note-speed"]')
    expect(b.text()).toBe('1×')
    await b.trigger('click')
    expect(b.text()).toBe('1.5×')
    expect(w.get('audio').element.playbackRate).toBe(1.5)
    await b.trigger('click')
    expect(b.text()).toBe('2×')
    await b.trigger('click')
    expect(b.text()).toBe('1×')
  })

  it('without a file there is nothing to play', () => {
    const w = mount(VoiceNotePlayer, { props: { src: '' } })
    expect(w.get('[data-test="voice-note-play"]').attributes('disabled')).toBeDefined()
  })
})

describe('VoiceReply', () => {
  it('says it is recording, politely, for screen readers', () => {
    const w = mount(VoiceReply, { props: { reply: { state: 'pending' } } })
    const s = w.get('[role="status"]')
    expect(s.attributes('aria-live')).toBe('polite')
    expect(s.text()).toContain('Recording voice reply')
  })

  it('plays the answer when it is ready', () => {
    const w = mount(VoiceReply, { props: { reply: { state: 'ready', url: '/media/r.mp3' } } })
    expect(w.get('audio').attributes('src')).toBe('/media/r.mp3')
    expect(w.get('[data-test="voice-note-play"]').attributes('aria-label')).toBe('Play voice reply')
  })

  it('says why there is none', () => {
    const w = mount(VoiceReply, { props: { reply: { state: 'failed', message: 'Top up to hear replies.' } } })
    expect(w.get('[role="alert"]').text()).toContain('Top up to hear replies.')
    expect(w.find('audio').exists()).toBe(false)
  })
})
