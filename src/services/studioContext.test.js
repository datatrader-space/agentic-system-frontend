// The Studio page travels as the message's studio_context field (never as text), and every page's status comes
// from the features API so the home cards and navigation never show "Soon" for a page the server calls live.
import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('./api', () => ({ default: { getStudioFeatures: vi.fn() } }))
import api from './api'
import { ChatConnection } from './chatService'
import { loadStudioFeatures, studioFeatures, getStudioFeature } from './studioFeatures'

describe('studio_context on the wire', () => {
  it('is sent with the message, and left out when there is none', () => {
    vi.stubGlobal('WebSocket', { OPEN: 1 })
    const conn = new ChatConnection(null, {}), sent = []
    conn.ws = { readyState: 1, send: payload => sent.push(JSON.parse(payload)), close() {} }
    conn.isOpen = true
    conn.sendMessage('Make a jingle', 7, null, { studioContext: { page: 'audio', preset: 'intro', preset_title: 'Intro' } })
    conn.sendMessage('Hello', 7, null, {})
    const messages = sent.filter(m => m.message === 'Make a jingle' || m.message === 'Hello')
    expect(messages[0].studio_context).toEqual({ page: 'audio', preset: 'intro', preset_title: 'Intro' })
    expect(messages[0].message).toBe('Make a jingle')
    expect(messages[1].studio_context).toBeUndefined()
  })
})

describe('loadStudioFeatures', () => {
  beforeEach(() => vi.clearAllMocks())
  it("takes each page's status and readiness from the server and keeps the address", async () => {
    api.getStudioFeatures.mockResolvedValue({ data: { features: [
      { id: 'motion', status: 'live', ready: false, code: 'no_proven_model', reason: 'No proven model.', tasks: [] },
      { id: 'audio', status: 'live', ready: true, tasks: ['speech'] },
    ] } })
    await loadStudioFeatures({ force: true })
    expect(getStudioFeature('motion')).toMatchObject({ status: 'live', ready: false, reason: 'No proven model.', route: '/video-studio/motion' })
    expect(getStudioFeature('audio')).toMatchObject({ status: 'live', ready: true, tasks: ['speech'] })
    expect(studioFeatures.value.some(f => f.status === 'soon')).toBe(false)
  })
  it('a failure leaves the plan shown and can be tried again', async () => {
    api.getStudioFeatures.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { features: [] } })
    await expect(loadStudioFeatures({ force: true })).rejects.toThrow('offline')
    await expect(loadStudioFeatures()).resolves.toEqual([])
  })
})
