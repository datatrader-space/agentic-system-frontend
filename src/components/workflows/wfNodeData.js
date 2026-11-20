// Workflow Builder: a node's stored data <-> the shape the builder edits, plus the card's one badge line (ADM-1333).
//
// `hydrateNode` / `serializeNode` are handed to useWorkflowDoc: the document holds nodes in the EDITED shape (JSON
// objects as text the node window edits), and saves them in the stored shape the engine reads. `serializeNode`
// throws WorkflowInputError naming the field when a JSON field does not parse, so a bad value is never saved.
//
// Run state is never part of a node's data (plan D1 rule 1): it lives in useWorkflowRun, keyed by node id.
import { hydrateMediaNode, serializeMediaNode } from '@/services/mediaWorkflowNode'
import { workflowJson } from '@/utils/workflowInput'
import { wfDef } from '@/config/wfNodeDefinitions'
import { nodeIsConfigured, nodeConfigPreview } from '@/utils/wfNodeView'

// The node types that take retries, a timeout and an `on_error` choice: the reliability settings in the node window,
// and the same list decides which cards show the `error` output (plan §3.2). One list, used by both.
export const WF_RELIABILITY_TYPES = Object.freeze([
  'agent.run', 'action.channel', 'action.tool', 'action.http', 'action.script',
  'action.subworkflow', 'logic.foreach', 'logic.approval',
])
export function hasReliability(type) { return WF_RELIABILITY_TYPES.includes(type) }

/** Stored node data -> the edited shape (JSON objects as text). */
export function hydrateNode(type, data) {
  if (type === 'media.generate') return hydrateMediaNode(data)
  const d = { ...(data || {}) }
  if (type === 'action.tool' || type === 'action.mcp_tool') d.params_json = JSON.stringify(d.params || {}, null, 2)
  // Empty rather than '{}' when there is no schema: a literal {} reads as "a schema requiring nothing".
  if (type === 'llm.call') d.output_schema_json = d.output_schema ? JSON.stringify(d.output_schema, null, 2) : ''
  if (type === 'action.http') d.json_text = d.json ? JSON.stringify(d.json, null, 2) : ''
  // Empty rather than '{}' when there are no filters: an empty filter set already means "every event".
  if (type === 'trigger.connector') {
    d.filters_json = (d.filters && Object.keys(d.filters).length) ? JSON.stringify(d.filters, null, 2) : ''
  }
  if (type === 'logic.foreach') {
    const inner = d.do || { type: 'action.channel', data: { kind: 'log', message: 'item {{item}}' } }
    const innerData = { ...(inner.data || {}) }
    if (inner.type === 'action.tool') innerData.params_json = JSON.stringify(innerData.params || {}, null, 2)
    d.do = { ...inner, data: innerData }
  }
  return d
}

/** The edited shape -> stored node data. Throws WorkflowInputError when a JSON field does not parse. */
export function serializeNode(type, data) {
  if (type === 'media.generate') return serializeMediaNode(data)
  const { params_json, json_text, output_schema_json, filters_json, ...rest } = (data || {})
  if (type === 'action.tool' || type === 'action.mcp_tool') {
    rest.params = workflowJson(params_json, rest.params || {}, {}, 'Parameters')
  }
  if (type === 'action.http') {
    const body = workflowJson(json_text, rest.json, undefined, 'JSON body')
    if (body === undefined) delete rest.json
    else rest.json = body
  }
  if (type === 'trigger.connector') rest.filters = workflowJson(filters_json, rest.filters || {}, {}, 'Resource filters')
  if (type === 'llm.call') {
    const schema = workflowJson(output_schema_json, rest.output_schema, undefined, 'Output schema')
    if (schema === undefined) delete rest.output_schema
    else rest.output_schema = schema
  }
  if (type === 'logic.foreach' && rest.do) {
    const inner = { type: rest.do.type, data: { ...(rest.do.data || {}) } }
    if (inner.type === 'action.tool') {
      const pj = inner.data.params_json
      inner.data.params = workflowJson(pj, inner.data.params || {}, {}, 'Inner tool parameters')
      delete inner.data.params_json
    }
    rest.do = inner
  }
  return rest
}

const TRIGGER_KIND = {
  'trigger.manual': () => 'Manual',
  'trigger.schedule': (d) => (d.cron ? `Schedule · ${d.cron}` : 'Schedule'),
  'trigger.webhook': () => 'Webhook',
  'trigger.channel': (d) => [d.platform ? d.platform[0].toUpperCase() + d.platform.slice(1) : 'Channel', d.channel].filter(Boolean).join(' · '),
  'trigger.connector': (d) => [d.provider || 'Connector', d.event_type].filter(Boolean).join(' · '),
  'trigger.training.stream_event': (d) => ['Camera', d.source_name || (d.source ? `#${d.source}` : '')].filter(Boolean).join(' · '),
}

/**
 * The card's ONE badge line (plan §3.2): the model, the trigger kind, the tool, or "Needs setup".
 * Returns { text, needsSetup }.
 */
export function nodeBadge(type, data) {
  const d = data || {}
  if (!nodeIsConfigured(type, d)) return { text: 'Needs setup', needsSetup: true }
  if (TRIGGER_KIND[type]) return { text: TRIGGER_KIND[type](d), needsSetup: false }
  if (type === 'llm.call') return { text: d.model_id || 'Default model', needsSetup: false }
  if (type === 'agent.run') return { text: d.agent_name || `Agent #${d.agent_id}`, needsSetup: false }
  if (type === 'logic.condition') return { text: 'true / false', needsSetup: false }
  if (type === 'logic.approval') return { text: 'Waits for approval', needsSetup: false }
  if (type === 'media.generate') return { text: d.operation ? `Media · ${d.operation}` : 'Media', needsSetup: false }
  const preview = nodeConfigPreview(type, d)
  return { text: preview || wfDef(type)?.sub || type, needsSetup: false }
}

/** The card's title: the person's label, else the registry's name for the type. */
export function nodeTitle(type, data) {
  return (data && data.label) || wfDef(type)?.label || type
}

// The keys of password fields (bot tokens): never written to the system clipboard.
export function secretKeys(type) {
  return (wfDef(type)?.fields || []).filter((f) => f.type === 'password').map((f) => f.key)
}
