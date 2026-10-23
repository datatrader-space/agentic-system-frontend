import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import api from '../services/api'

// A Super Agent chat waited for the agent LIBRARY list (the slowest of three requests, 16.7s on a loaded
// machine) before it had its agent, and when the list came first it picked the first library agent, so the
// page loaded that agent's model, voice and effort settings before switching (2026-10-22).
vi.mock('../services/api', () => ({
  default: {
    getAgents: vi.fn(),
    getSuperAgentCard: vi.fn(),
    listBuiltinAgents: vi.fn(),
    getAgent: vi.fn(),
  },
}))

const SUPER = { id: 3261, name: 'Platform Super Agent', is_platform_super_agent: true }

let releaseList
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.getAgents.mockReturnValue(new Promise((resolve) => {
    releaseList = () => resolve({ data: [{ id: 2971, name: 'Kurumera Agent' }] })
  }))
  api.getSuperAgentCard.mockResolvedValue({ data: SUPER })
  api.listBuiltinAgents.mockResolvedValue({ data: [] })
  api.getAgent.mockRejectedValue(new Error('404'))
})

describe('a chat has its agent without waiting for the agent library', () => {
  it('resolves the Super Agent while the library list is still loading', async () => {
    const chat = useChatStore()
    const agent = await chat.ensureAgent(3261)
    expect(agent && agent.name).toBe('Platform Super Agent')
    expect(chat.agentsLoaded).toBe(false)        // the list has not answered yet
    releaseList()
  })

  it('still finds an own agent that only the library list carries', async () => {
    const chat = useChatStore()
    const pending = chat.ensureAgent(2971)
    releaseList()
    expect((await pending).name).toBe('Kurumera Agent')
    expect(api.getAgent).not.toHaveBeenCalled()
  })

  it('the library list never picks an agent for the chat', async () => {
    const chat = useChatStore()
    const loading = chat.loadAgents()
    releaseList()
    await loading
    expect(chat.agents.map((a) => a.id)).toContain(2971)
    expect(chat.selectedAgentId).toBe(null)
  })

  it('asks for the Super Agent card once when several callers want it at the same time', async () => {
    const chat = useChatStore()
    await Promise.all([chat.ensureSuperAgent(), chat.ensureSuperAgent(), chat.ensureAgent(3261)])
    expect(api.getSuperAgentCard).toHaveBeenCalledTimes(1)
    releaseList()
  })
})
