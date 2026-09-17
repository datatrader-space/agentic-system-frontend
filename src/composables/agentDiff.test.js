import { describe, it, expect } from 'vitest'
import { changedFields, snapshot } from './agentDiff'

describe('agent editor saves only what changed', () => {
  it('does not send a field it did not edit, so a run mode changed elsewhere survives', () => {
    const server = snapshot({ id: 1, name: 'A', agent_run_mode: 'manual', tool_ids: [1, 2] })
    const editing = { ...server, name: 'B' }
    expect(changedFields(editing, server)).toEqual({ name: 'B' })
  })

  it('sends nested changes whole', () => {
    const server = snapshot({ tool_ids: [1, 2], policy: { a: 1 } })
    expect(changedFields({ tool_ids: [1, 2, 3], policy: { a: 1 } }, server)).toEqual({ tool_ids: [1, 2, 3] })
  })

  it('sends nothing when nothing changed', () => {
    const server = snapshot({ id: 1, name: 'A' })
    expect(changedFields(snapshot(server), server)).toEqual({})
  })
})
