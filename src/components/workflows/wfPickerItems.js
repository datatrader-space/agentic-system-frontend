// The node picker's items and what choosing one does to the document (plan §3.1). Pure, so it is tested without a
// DOM: `pickerItems` builds the AppCommandList items; `createNode` makes the node for a chosen item; `connectOps`
// returns the operations that add it and wire it where the picker was opened from.
//
// Picker context (where it was opened from):
//   { mode: 'free', position }                                     toolbar +, N, Tab, Ctrl/⌘+K
//   { mode: 'from', source: { nodeId, handle }, position? }        an output's + or a connection dropped on the canvas
//   { mode: 'into', target: { nodeId, handle }, position }         a connection dragged backwards from an input
//   { mode: 'insert', edgeId, position? }                          the + in the middle of a connection
// Every connection made here carries the output's handle (F13: the quick-add edge had no `sourceHandle`, so a step
// added from a condition's "false" output ran on the true branch) and an id of our own (newEdgeId, D1 rule 4).
import { WF_CATEGORIES, WF_CATEGORY_ORDER, wfCategory, wfDefaultData, wfIcon, wfPaletteItems } from '@/config/wfNodeDefinitions'
import { newEdgeId, newNodeId } from '@/utils/wfVarExpr'
import { freeWorkflowPosition } from '@/utils/workflowNodePlacement'

export const RECENT_KEY = 'wfb_recent_nodes_v1'
export const RECENT_SIZE = 6

export const PICKER_GROUPS = [
  { id: 'recent', label: 'Recent' },
  ...WF_CATEGORY_ORDER.map((id) => ({ id, label: WF_CATEGORIES[id].label })),
  { id: 'tools', label: 'Tools' },
]

const isTrigger = (type) => String(type || '').startsWith('trigger.')

/** True when the step being added will get a connection INTO it, so it cannot be a trigger. */
export function needsInput(ctx) { return ctx?.mode === 'from' || ctx?.mode === 'insert' }

/**
 * AppCommandList items. `tab` narrows to one category ('all', a category id, 'tools' or 'mcp').
 * Tools and MCP tools are listed under 'all' only while searching (`searching`), so the first screen is the step
 * types; every matching tool is listed once the person types.
 */
export function pickerItems({ tools = [], mcp = { enabled: false, servers: [] }, recent = [], ctx = null, tab = 'all', searching = false } = {}) {
  const noTriggers = needsInput(ctx)
  const nodeItems = wfPaletteItems()
    .filter((p) => !(noTriggers && isTrigger(p.type)))
    .map((p) => ({
      id: `node:${p.type}`, kind: 'node', nodeType: p.type, label: p.label, description: p.sub,
      group: wfCategory(p.type), icon: p.icon, keywords: [p.type, WF_CATEGORIES[wfCategory(p.type)].label],
    }))
  const toolItems = tools.filter((t) => t && t.name).map((t) => ({
    id: `tool:${t.name}`, kind: 'tool', toolName: t.name, label: t.name, description: t.description || '',
    group: 'tools', icon: wfIcon('action.tool'), badge: t.category_label || t.category || '', keywords: [t.category || ''],
  }))
  const mcpItems = []
  if (mcp?.enabled) {
    for (const s of mcp.servers || []) {
      const group = `mcp:${s.id}`
      mcpItems.push({
        id: `mcpsrv:${s.id}`, kind: 'mcp-server', serverId: s.id, serverName: s.name, label: `${s.name}: the whole server`,
        description: 'An agent decides which of its tools to call', group, icon: wfIcon('agent.run'), badge: 'Agent', keywords: [s.slug || ''],
      })
      for (const t of s.tools || []) {
        mcpItems.push({
          id: `mcptool:${s.id}:${t.name}`, kind: 'mcp-tool', serverId: s.id, serverName: s.name, toolName: t.name,
          label: t.name, description: t.description || `A ${s.name} tool`, group, icon: wfIcon('action.mcp_tool'),
          badge: s.name, keywords: [s.name],
        })
      }
    }
  }
  const byId = new Map([...nodeItems, ...toolItems, ...mcpItems].map((i) => [i.id, i]))
  const recentItems = tab === 'all' && !searching
    ? recent.map((id) => byId.get(id)).filter(Boolean).map((i) => ({ ...i, id: `recent:${i.id}`, sourceId: i.id, group: 'recent' }))
    : []

  if (tab === 'tools') return toolItems
  if (tab === 'mcp') return mcpItems
  if (tab !== 'all') return nodeItems.filter((i) => i.group === tab)
  return [...recentItems, ...nodeItems, ...(searching ? [...toolItems, ...mcpItems] : [])]
}

/** The groups for the items: the fixed ones, then one per MCP server. */
export function pickerGroups(mcp) {
  const servers = mcp?.enabled ? (mcp.servers || []).map((s) => ({ id: `mcp:${s.id}`, label: `MCP · ${s.name}` })) : []
  return [...PICKER_GROUPS, ...servers]
}

/**
 * The node for a chosen item, in the document's edited shape. `agent` ({ id, name }) is required for an MCP tool:
 * the call runs with that agent's credentials and permissions.
 */
export function createNode(item, { existingIds = [], position = { x: 0, y: 0 }, agent = null } = {}) {
  let type
  let data
  if (item.kind === 'tool') {
    type = 'action.tool'
    data = { ...wfDefaultData(type), tool: item.toolName, label: item.toolName }
  } else if (item.kind === 'mcp-server') {
    type = 'agent.run'
    data = { ...wfDefaultData(type), notes: `Use an agent that has the "${item.serverName}" MCP server attached.` }
  } else if (item.kind === 'mcp-tool') {
    if (!agent?.id) throw new Error('Choose the agent whose credentials this MCP tool runs with.')
    type = 'action.mcp_tool'
    data = {
      ...wfDefaultData(type), agent_id: agent.id, agent_name: agent.name || '', server_id: item.serverId,
      server_name: item.serverName, tool_name: item.toolName, label: `${item.serverName}: ${item.toolName}`,
    }
  } else {
    type = item.nodeType
    data = wfDefaultData(type)
  }
  return { id: newNodeId(type, existingIds), type, position: { x: Math.round(position.x), y: Math.round(position.y) }, data }
}

// A condition has no plain output: a connection out of one leaves its "true" output unless the person picks another.
const outHandle = (type) => (type === 'logic.condition' ? 'true' : undefined)

function edge(source, target, edges, { sourceHandle, targetHandle } = {}) {
  const e = { id: newEdgeId(source, target, edges.map((x) => x.id), sourceHandle || null), source, target }
  if (sourceHandle) e.sourceHandle = sourceHandle
  if (targetHandle) e.targetHandle = targetHandle
  return e
}

/** Where a step added from `ctx` goes when the picker was not opened at a point on the canvas. */
export function placeFor(ctx, nodes, edges) {
  const byId = (id) => nodes.find((n) => n.id === id)
  let preferred = ctx?.position
  if (!preferred && ctx?.mode === 'from') {
    const src = byId(ctx.source.nodeId)
    const dy = ctx.source.handle === 'false' ? 112 : ctx.source.handle === 'error' ? 160 : 0
    if (src) preferred = { x: src.position.x + 272, y: src.position.y + dy }
  }
  if (!preferred && ctx?.mode === 'insert') {
    const e = edges.find((x) => x.id === ctx.edgeId)
    const a = e && byId(e.source)
    const b = e && byId(e.target)
    if (a && b) preferred = { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 + 96 }
  }
  return freeWorkflowPosition(nodes, preferred || { x: 0, y: 0 }, { width: 200, height: 64 })
}

/**
 * The operations that add `node` and wire it as `ctx` says. Throws when the connection the picker was opened for
 * no longer exists (it was deleted meanwhile) or would make a trigger a target.
 */
export function connectOps(ctx, node, edges) {
  const ops = [{ op: 'add_node', node }]
  const mode = ctx?.mode || 'free'
  if (needsInput(ctx) && isTrigger(node.type)) throw new Error('A trigger starts a workflow, so nothing can connect into it.')
  if (mode === 'from') {
    ops.push({ op: 'add_edge', edge: edge(ctx.source.nodeId, node.id, edges, { sourceHandle: ctx.source.handle }) })
  } else if (mode === 'into') {
    ops.push({ op: 'add_edge', edge: edge(node.id, ctx.target.nodeId, edges, { sourceHandle: outHandle(node.type), targetHandle: ctx.target.handle }) })
  } else if (mode === 'insert') {
    const old = edges.find((e) => e.id === ctx.edgeId)
    if (!old) throw new Error('That connection is gone, so the step was not inserted.')
    const rest = edges.filter((e) => e.id !== old.id)
    const first = edge(old.source, node.id, rest, { sourceHandle: old.sourceHandle })
    const second = edge(node.id, old.target, [...rest, first], { sourceHandle: outHandle(node.type), targetHandle: old.targetHandle })
    ops.unshift({ op: 'remove_edge', id: old.id })
    ops.push({ op: 'add_edge', edge: first }, { op: 'add_edge', edge: second })
  }
  return ops
}

// Recently added items, per viewer, in this browser only (a convenience; nothing depends on it).
export function loadRecent(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage?.getItem(RECENT_KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch { return [] }
}
export function pushRecent(id, storage = globalThis.localStorage) {
  const next = [id, ...loadRecent(storage).filter((x) => x !== id)].slice(0, RECENT_SIZE)
  try { storage?.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* private mode: no recents */ }
  return next
}
