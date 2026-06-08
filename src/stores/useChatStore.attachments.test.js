import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    uploadConversationFile: vi.fn(() => Promise.resolve({ data: { id: 1 } })),
    startAgentChat: vi.fn(),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
  },
}))

// node test env has no object-URL impl
beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

const imgFile = (name = 'a.png') => ({ name, type: 'image/png' })
const txtFile = (name = 'a.txt') => ({ name, type: 'text/plain' })

describe('useChatStore — attachments', () => {
  it('stages files, marking images and creating preview urls', () => {
    const chat = useChatStore()
    chat.addAttachments([imgFile('pic.png'), txtFile('notes.txt')])
    expect(chat.pendingAttachments).toHaveLength(2)
    expect(chat.pendingAttachments[0]).toMatchObject({ name: 'pic.png', isImage: true, url: 'blob:x' })
    expect(chat.pendingAttachments[1]).toMatchObject({ name: 'notes.txt', isImage: false, url: '' })
  })

  it('removeAttachment drops the right one', () => {
    const chat = useChatStore()
    chat.addAttachments([imgFile('a.png'), imgFile('b.png')])
    chat.removeAttachment(0)
    expect(chat.pendingAttachments.map((a) => a.name)).toEqual(['b.png'])
  })

  it('sendMessage uploads each staged attachment before sending, then clears the strip', async () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.conversationId = 'c1'
    chat.selectedAgentId = 7
    chat.addAttachments([imgFile('a.png'), imgFile('b.png')])

    await chat.sendMessage('look at these')

    expect(api.uploadConversationFile).toHaveBeenCalledTimes(2)
    expect(api.uploadConversationFile).toHaveBeenNthCalledWith(1, 'c1', expect.objectContaining({ name: 'a.png' }))
    expect(sendMessage).toHaveBeenCalledWith('look at these', 7)
    expect(chat.pendingAttachments).toHaveLength(0)
    // the user bubble keeps the attachment previews
    const userMsg = chat.messages.find((m) => m.role === 'user')
    expect(userMsg.attachments).toHaveLength(2)
  })

  it('allows sending with only attachments (no text)', async () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.conversationId = 'c1'
    chat.selectedAgentId = 7
    chat.addAttachments([imgFile('a.png')])

    await chat.sendMessage('')

    expect(api.uploadConversationFile).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith('', 7)
  })

  it('does nothing when there is neither text nor attachments', async () => {
    const chat = useChatStore()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage }
    chat.conversationId = 'c1'
    await chat.sendMessage('   ')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(api.uploadConversationFile).not.toHaveBeenCalled()
  })

  it('reset clears staged attachments', () => {
    const chat = useChatStore()
    chat.addAttachments([imgFile('a.png')])
    chat.reset()
    expect(chat.pendingAttachments).toHaveLength(0)
  })
})
