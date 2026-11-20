// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { runStopKind, fetchAllAgents } from './workflowRunPolling'

describe('workflow run stop states', () => {
  it('stops on every final state, including dead', () => {
    for (const s of ['success', 'failed', 'cancelled', 'dead']) expect(runStopKind(s)).toBe('final')
  })
  it('stops on the states that wait on a person or a delay', () => {
    for (const s of ['waiting', 'paused', 'blocked']) expect(runStopKind(s)).toBe('held')
  })
  it('keeps polling while the run is moving', () => {
    for (const s of ['queued', 'running', undefined, '']) expect(runStopKind(s)).toBe(null)
  })
})

describe('fetchAllAgents', () => {
  it('returns the full list from the picker endpoint', async () => {
    const api = { getAgentPicker: vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] }) }
    expect(await fetchAllAgents(api)).toEqual([{ id: 1 }, { id: 2 }])
  })
  it('accepts a paginated shape', async () => {
    const api = { getAgentPicker: vi.fn().mockResolvedValue({ data: { results: [{ id: 3 }] } }) }
    expect(await fetchAllAgents(api)).toEqual([{ id: 3 }])
  })
})
