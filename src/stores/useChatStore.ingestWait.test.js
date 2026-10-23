// Phase 5 item 6: the chat waits for "Reading <file>…" only for a document the backend ingests.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    uploadConversationFile: vi.fn((cid, file) => Promise.resolve({ data: { id: 11, attachment_id: `att-${file.name}` } })),
    getAgentFileStatus: vi.fn(() => Promise.resolve({ data: { index_status: 'ready' } })),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
  },
}))

beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

async function send(file) {
  const chat = useChatStore()
  chat._conn = { sendMessage: vi.fn() }
  chat.conversationId = 'c1'
  chat.selectedAgentId = 7
  chat.addAttachments([file])
  await chat.sendMessage('see attached')
  return chat
}

describe('attachment ingest wait', () => {
  it('does not wait on a video (never ingested): Send is not held for a minute', async () => {
    const chat = await send({ name: 'clip.mp4', type: 'video/mp4' })
    expect(api.getAgentFileStatus).not.toHaveBeenCalled()
    expect(chat._conn.sendMessage).toHaveBeenCalled()
  })

  it('does not wait on audio', async () => {
    await send({ name: 'talk.mp3', type: 'audio/mpeg' })
    expect(api.getAgentFileStatus).not.toHaveBeenCalled()
  })

  it('still waits for a PDF to be read before sending', async () => {
    const chat = await send({ name: 'spec.pdf', type: 'application/pdf' })
    expect(api.getAgentFileStatus).toHaveBeenCalledWith(11)
    expect(chat._conn.sendMessage).toHaveBeenCalled()
  })
})
