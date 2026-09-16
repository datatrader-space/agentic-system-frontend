import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import api from '../services/api'

// The server stamps a work run's continuation prompts `model_info.authored_by = 'system'`. The store has
// TWO independent mappers from a server row to a client message — the main loader and the reconnect
// recovery path — and the marker has to survive BOTH. If only one carried it, a thread would render
// correctly on open and then resurrect the machine prompts as user bubbles after a dropped socket, which
// is exactly the kind of fix that looks shipped and is not. (Production conv 1561, 2026-09-16.)
vi.mock('../services/api', () => ({
  default: { getConversation: vi.fn() },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

const row = (role, content, model_info) => ({ id: Math.random(), role, content, model_info })

describe('useChatStore — authoredBy', () => {
  describe('main loader (_mapServerMessage)', () => {
    it('maps a system-authored continuation', () => {
      const chat = useChatStore()
      const m = chat._mapServerMessage(row('user', 'DO THE NEXT PIECE OF WORK', { authored_by: 'system' }), 1561)
      expect(m.authoredBy).toBe('system')
    })

    it('defaults to the user when the server wrote no marker', () => {
      const chat = useChatStore()
      expect(chat._mapServerMessage(row('user', 'hi', null), 1).authoredBy).toBe('user')
      expect(chat._mapServerMessage(row('user', 'hi', {}), 1).authoredBy).toBe('user')
    })
  })

  describe('reconnect recovery (_refreshHistory)', () => {
    it('carries the marker too, so a dropped socket cannot resurrect the bubbles', async () => {
      const chat = useChatStore()
      chat.conversationId = 1561
      api.getConversation.mockResolvedValue({
        data: {
          messages: [
            row('user', 'Detect the walls', null),
            row('user', 'Continue the task… DO THE NEXT PIECE OF WORK', { authored_by: 'system' }),
            row('assistant', 'attempt 2', {}),
          ],
        },
      })

      const landed = await chat._refreshHistory()

      expect(landed).toBe(true)
      expect(chat.messages.map((m) => m.authoredBy)).toEqual(['user', 'system', 'user'])
    })
  })
})
