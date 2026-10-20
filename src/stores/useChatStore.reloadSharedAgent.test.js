import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import api from '../services/api'

// Reloading a chat held by a SHARED agent (the Platform Super Agent, a built-in) left the composer on
// "Choose an agent" with no agent name: the library list never carries shared agents and /agents/<id>/ does
// not return them, so selectedAgentId pointed at nothing (production conv 2879, 2026-10-20).
vi.mock('../services/api', () => ({
  default: {
    getConversation: vi.fn(),
    getAgents: vi.fn(),
    getSuperAgentCard: vi.fn(),
    listBuiltinAgents: vi.fn(),
    getAgent: vi.fn(),
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.getAgents.mockResolvedValue({ data: [{ id: 7, name: 'Mine' }] })
  api.getSuperAgentCard.mockResolvedValue({ data: { id: 3052, name: 'Platform Super Agent', is_platform_super_agent: true } })
  api.listBuiltinAgents.mockResolvedValue({ data: [{ id: 4100, name: 'Video Studio' }] })
  api.getAgent.mockRejectedValue(new Error('404'))
})

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('a reloaded shared-agent conversation keeps its agent', () => {
  it('resolves the Platform Super Agent so the composer and header show it', async () => {
    const chat = useChatStore()
    chat._connect = vi.fn()
    api.getConversation.mockResolvedValue({ data: { agent_profile: 3052, messages: [] } })
    await chat.openConversation(2879)
    await flush()
    expect(chat.selectedAgentId).toBe('3052')
    expect(chat.currentAgent && chat.currentAgent.name).toBe('Platform Super Agent')
    expect(chat.isSharedAgent).toBe(true)
  })

  it('resolves a built-in agent the same way', async () => {
    const chat = useChatStore()
    expect((await chat.ensureAgent(4100)).name).toBe('Video Studio')
    expect(chat.selectedAgentId).not.toBe('4100')   // resolving does not select it
  })

  it('falls back to the agent by id, and returns null for one the person cannot see', async () => {
    const chat = useChatStore()
    api.getAgent.mockImplementation(async (id) => {
      if (String(id) === '55') return { data: { id: 55, name: 'Team agent' } }
      throw new Error('404')
    })
    expect((await chat.ensureAgent(55)).name).toBe('Team agent')
    expect(await chat.ensureAgent(999)).toBe(null)
  })

  it('does not fetch anything when the agent is already known', async () => {
    const chat = useChatStore()
    chat.agents = [{ id: 7, name: 'Mine' }]
    expect((await chat.ensureAgent('7')).name).toBe('Mine')
    expect(api.getSuperAgentCard).not.toHaveBeenCalled()
    expect(api.getAgent).not.toHaveBeenCalled()
  })
})
