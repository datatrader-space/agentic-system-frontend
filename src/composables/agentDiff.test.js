import { describe, it, expect } from 'vitest'
import { changedFields, snapshot, withoutReadOnly, idListsFrom } from './agentDiff'

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

describe('agent editor never sends what the server only returns', () => {
  it('drops every read-only key and keeps the writable ones', () => {
    const changes = {
      name: 'B', tool_ids: [1], knowledge_source_ids: [2], sub_agent_ids: [3], skill_ids: [4],
      tools: [{ id: 1 }], knowledge_sources: [{ id: 2 }], sub_agents: [{ id: 3 }], skills: [{ id: 4 }],
      knowledge_files: [{ id: 5 }], web_intelligence: { search_model: null },
    }
    expect(withoutReadOnly(changes)).toEqual({
      name: 'B', tool_ids: [1], knowledge_source_ids: [2], sub_agent_ids: [3], skill_ids: [4],
    })
  })

  it('does not mutate what it was given, and tolerates nothing', () => {
    const changes = { tools: [{ id: 1 }], name: 'B' }
    withoutReadOnly(changes)
    expect(changes).toEqual({ tools: [{ id: 1 }], name: 'B' })
    expect(withoutReadOnly(undefined)).toEqual({})
  })
})

describe('agent editor derives the id lists from what the server returned', () => {
  const loaded = {
    id: 1, name: 'A',
    tools: [{ id: 1 }, { id: 2 }], knowledge_sources: [{ id: 7 }], sub_agents: [{ id: 9, name: 'x' }], skills: [],
  }

  it('derives all four, so opening a step no longer dirties the draft', () => {
    const a = { ...loaded, ...idListsFrom(loaded) }
    expect(a.tool_ids).toEqual([1, 2])
    expect(a.knowledge_source_ids).toEqual([7])
    expect(a.sub_agent_ids).toEqual([9])
    expect(a.skill_ids).toEqual([])
    // What a step's own ensureIds() would have set is already there: nothing to send.
    const server = snapshot(a)
    expect(withoutReadOnly(changedFields({ ...a, skill_ids: a.skills.map(s => s.id) }, server))).toEqual({})
  })

  it('gives an empty list for rows the server did not return', () => {
    expect(idListsFrom({ id: 1 })).toEqual({ tool_ids: [], knowledge_source_ids: [], sub_agent_ids: [], skill_ids: [] })
    expect(idListsFrom(undefined)).toEqual({ tool_ids: [], knowledge_source_ids: [], sub_agent_ids: [], skill_ids: [] })
  })

  it('leaves alone the lists a partial response says nothing about', () => {
    expect(idListsFrom({ sub_agents: [{ id: 3 }] }, { onlyReturned: true })).toEqual({ sub_agent_ids: [3] })
    expect(idListsFrom({ knowledge_source_ids: [4] }, { onlyReturned: true })).toEqual({})
  })
})
