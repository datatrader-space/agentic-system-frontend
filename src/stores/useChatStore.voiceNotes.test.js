// Voice notes in the chat store (VOICE_NOTES_PLAN.md): a recording is sent as the whole message with `voice_note`,
// the person's bubble plays it, the answer's voice note arrives as `voice_reply` frames, and a note that could not be
// heard is said where the person looks.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import api from '../services/api'
import { voiceReplyOf } from '../utils/voiceNotes'

vi.mock('../services/api', () => ({
  default: {
    uploadConversationFile: vi.fn(() => Promise.resolve({ data: { id: 9, attachment_id: 'u-voice' } })),
    startAgentChat: vi.fn(),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
  },
}))

beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

const note = () => ({ file: { name: 'voice-note.webm', type: 'audio/webm' }, name: 'voice-note.webm',
  mime: 'audio/webm', isImage: false, isAudio: true, isVoiceNote: true, url: 'blob:note' })

function ready(chat) {
  const sendMessage = vi.fn()
  chat._conn = { sendMessage }
  chat.conversationId = 'c1'
  chat.selectedAgentId = 7
  return sendMessage
}

describe('sending a voice note', () => {
  it('uploads the recording and sends it as the whole message, flagged as a voice note', async () => {
    const chat = useChatStore()
    const send = ready(chat)
    expect(await chat.sendMessage('', { voiceNote: note() })).toBe(true)
    expect(api.uploadConversationFile).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'voice-note.webm' }))
    expect(send).toHaveBeenCalledWith('', 7, null, expect.objectContaining({
      voiceNote: true, attachmentIds: ['u-voice'], clientMessageId: expect.any(String) }))
    const bubble = chat.messages.find((m) => m.role === 'user')
    expect(bubble.content).toBe('')
    expect(bubble.attachments).toEqual([expect.objectContaining({ isVoiceNote: true, isAudio: true, url: 'blob:note' })])
  })

  it('leaves the files waiting in the composer for the next typed message', async () => {
    const chat = useChatStore()
    ready(chat)
    chat.addAttachments([{ name: 'a.png', type: 'image/png' }])
    await chat.sendMessage('', { voiceNote: note() })
    expect(chat.pendingAttachments.map((a) => a.name)).toEqual(['a.png'])
    expect(api.uploadConversationFile).toHaveBeenCalledTimes(1)
  })

  it('a typed message is not a voice note', async () => {
    const chat = useChatStore()
    const send = ready(chat)
    await chat.sendMessage('hello')
    expect(send.mock.calls[0][3].voiceNote).toBe(false)
  })

  it('while the agent works it is sent as a steer, still a voice note', async () => {
    const chat = useChatStore()
    const send = ready(chat)
    chat.isStreaming = true
    await chat.sendMessage('', { voiceNote: note() })
    expect(send).toHaveBeenCalledWith('', 7, null, expect.objectContaining({ voiceNote: true }))
    expect(chat.messages.find((m) => m.role === 'user').queued).toBe(true)
  })
})

describe('the answer spoken back', () => {
  function answered(chat) {
    chat.conversationId = 'c1'
    chat.messages.push({ id: 'a1', role: 'assistant', content: 'Booked.', status: 'done', serverId: 55 })
    return chat.messages[chat.messages.length - 1]
  }

  it('shows recording, then the playable note', () => {
    const chat = useChatStore()
    const a = answered(chat)
    chat._onEvent({ type: 'voice_reply', state: 'pending', message_id: 55, conversation_id: 'c1' })
    expect(a.voiceReply).toEqual({ state: 'pending' })
    chat._onEvent({ type: 'voice_reply', state: 'ready', message_id: 55, conversation_id: 'c1',
      artifact: { file_url: '/media/r.mp3', mime_type: 'audio/mpeg' } })
    expect(a.voiceReply).toEqual({ state: 'ready', url: '/media/r.mp3', mime: 'audio/mpeg' })
  })

  it('says why there is none', () => {
    const chat = useChatStore()
    const a = answered(chat)
    chat._onEvent({ type: 'voice_reply', state: 'failed', message_id: 55, conversation_id: 'c1',
      code: 'BALANCE_TOO_LOW', message: 'Top up to hear replies.' })
    expect(a.voiceReply).toEqual({ state: 'failed', message: 'Top up to hear replies.' })
  })

  it("another conversation's answer is not touched", () => {
    const chat = useChatStore()
    const a = answered(chat)
    chat._onEvent({ type: 'voice_reply', state: 'pending', message_id: 55, conversation_id: 'c2' })
    expect(a.voiceReply).toBeUndefined()
  })

  it('a reloaded answer keeps its voice note', () => {
    expect(voiceReplyOf({ media_artifacts: [{ tool_name: 'GENERATE_IMAGE', file_url: '/i.png' },
      { tool_name: 'VOICE_REPLY', file_url: '/media/r.mp3', mime_type: 'audio/mpeg' }] }))
      .toEqual({ state: 'ready', url: '/media/r.mp3', mime: 'audio/mpeg' })
    expect(voiceReplyOf({ media_artifacts: [] })).toBeNull()
  })
})

describe('a voice note that could not be heard', () => {
  it('a steer: said on the note, and the running answer carries on', async () => {
    const chat = useChatStore()
    ready(chat)
    chat.isStreaming = true
    chat.messages.push({ id: 'run', role: 'assistant', content: 'working', status: 'streaming' })
    await chat.sendMessage('', { voiceNote: note() })
    const steer = chat.messages.find((m) => m.role === 'user')
    chat._onEvent({ type: 'voice_note_failed', conversation_id: 'c1', client_message_id: steer.clientMessageId,
      code: 'NO_SPEECH', error: "Couldn't hear anything in that voice note. Record it again." })
    expect(steer.queued).toBe(false)
    expect(steer.voiceNoteError).toMatch(/Couldn't hear/)
    expect(chat.messages.find((m) => m.id === 'run').status).toBe('streaming')
  })
})
