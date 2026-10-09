// Which agent fields an editor save must send: only what differs from the server's last confirmed copy.
//
// The Agent Editor used to PATCH the whole object it loaded and kept in memory. A field changed elsewhere
// since — the run mode switched from the chat composer, above all — was written back to its old value by the
// next editor save (2026-09-17: an agent switched to Autonomous in chat came back as Manual).

export const snapshot = (a) => JSON.parse(JSON.stringify(a || {}))

export function changedFields(current, base) {
  const out = {}
  for (const [k, v] of Object.entries(current || {})) {
    if (JSON.stringify(v) !== JSON.stringify(base ? base[k] : undefined)) out[k] = v
  }
  return out
}

// Keys the agent endpoint only ever RETURNS. The editor holds them (a step reads `agent.tools`, a child
// merges `sub_agents` back in), so they can differ from the server copy — but a save must never send
// them: the writable twins are `tool_ids`, `knowledge_source_ids`, `sub_agent_ids`, `skill_ids`, and
// `web_intelligence` saves through its own endpoint.
export const READ_ONLY_KEYS = ['tools', 'knowledge_sources', 'sub_agents', 'skills', 'knowledge_files', 'web_intelligence']

export function withoutReadOnly(changes) {
  const out = { ...(changes || {}) }
  for (const k of READ_ONLY_KEYS) delete out[k]
  return out
}

// Each write-only id list and the read-only rows it mirrors.
const ID_LISTS = { tool_ids: 'tools', knowledge_source_ids: 'knowledge_sources', sub_agent_ids: 'sub_agents', skill_ids: 'skills' }

// The id lists of an agent the SERVER returned, derived from its rows (a response never carries the id
// lists themselves). Taken before the snapshot, so a step that reads `skill_ids` finds it already there
// and merely opening that step no longer makes the draft differ from the server copy.
//
// A list whose rows are missing comes out empty, as `tool_ids` always did. `onlyReturned` skips those
// instead — for merging a partial response over an agent that already holds its lists.
export function idListsFrom(agent, { onlyReturned = false } = {}) {
  const out = {}
  for (const [ids, rows] of Object.entries(ID_LISTS)) {
    if (Array.isArray(agent?.[rows])) out[ids] = agent[rows].map(r => r.id)
    else if (!onlyReturned) out[ids] = []
  }
  return out
}
