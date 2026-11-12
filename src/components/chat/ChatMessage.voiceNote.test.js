// @vitest-environment jsdom
//
// A voice note in the thread (VOICE_NOTES_PLAN.md, owner 2026-11-12): the person's message shows ONLY the playable
// note, never its transcript (which is the message's text, for the agent and history); the answer to it carries its
// own voice note under the text.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ChatMessage from './ChatMessage.vue'

const mountIt = (message) => mount(ChatMessage, {
  props: { message },
  global: { stubs: { TokenUsage: true, SourcesList: true, ProvenanceFooter: true, MediaThumb: true } },
})

describe('ChatMessage — voice notes', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it("the person's voice note is the playable note, not its transcript, and cannot be edited", () => {
    const w = mountIt({
      id: 'u1', role: 'user', status: 'done', content: 'book me a flight to Lahore on Monday',
      attachments: [{ name: 'voice-note.m4a', mime: 'audio/mp4', isAudio: true, isVoiceNote: true, url: '/media/n.m4a' }],
    })
    expect(w.find('audio').attributes('src')).toBe('/media/n.m4a')
    expect(w.text()).not.toContain('book me a flight')
    expect(w.find('.user-attach-file').exists()).toBe(false)
    expect(w.find('.user-actions').exists()).toBe(false)
  })

  it('a typed message is unchanged', () => {
    const w = mountIt({ id: 'u2', role: 'user', status: 'done', content: 'typed words', attachments: [] })
    expect(w.text()).toContain('typed words')
    expect(w.find('audio').exists()).toBe(false)
  })

  it('a voice note that could not be heard says so on the note', () => {
    const w = mountIt({
      id: 'u3', role: 'user', status: 'done', content: '', voiceNoteError: "Couldn't hear anything in that voice note.",
      attachments: [{ name: 'voice-note.webm', isAudio: true, isVoiceNote: true, url: 'blob:x' }],
    })
    expect(w.get('[role="alert"]').text()).toContain("Couldn't hear anything")
  })

  it('the answer carries its voice note under the text', () => {
    const w = mountIt({
      id: 'a1', role: 'assistant', status: 'complete', content: 'Your flight is booked.', toolCalls: [],
      planArtifacts: [], voiceReply: { state: 'ready', url: '/media/r.mp3' },
    })
    expect(w.text()).toContain('Your flight is booked.')
    expect(w.get('[data-test="voice-reply"] audio').attributes('src')).toBe('/media/r.mp3')
  })
})
