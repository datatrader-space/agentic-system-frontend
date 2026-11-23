import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { nodeStatusState, NODE_STATUS_LABELS, NODE_STATUS_ICONS, nodeAccent, nodeAriaLabel, nodeConfigPreview, nodeIsConfigured } from './wfNodeView'
import { WF_NODE_DEFS, WF_CATEGORIES, WF_CATEGORY_ORDER, wfCategory, wfIcon, wfFields } from '../config/wfNodeDefinitions'

const lucide = createRequire(import.meta.url)('@iconify-json/lucide/icons.json')
const hasLucide = (name) => {
  const [prefix, id] = name.split(':')
  return prefix === 'lucide' && !!(lucide.icons[id] || lucide.aliases?.[id])
}

describe('one icon and category map (registry)', () => {
  it('every node type has a category from the one set and a Lucide icon that exists (no emoji)', () => {
    for (const [type, def] of Object.entries(WF_NODE_DEFS)) {
      expect(WF_CATEGORIES[def.category], type).toBeTruthy()
      expect(hasLucide(def.icon), `${type}: ${def.icon}`).toBe(true)
      expect(wfIcon(type)).toBe(def.icon)
    }
  })
  it('the categories are trigger, agent, action, logic and media, each with a token and an icon', () => {
    expect(WF_CATEGORY_ORDER).toEqual(['trigger', 'agent', 'action', 'logic', 'media'])
    for (const id of WF_CATEGORY_ORDER) {
      expect(WF_CATEGORIES[id].token).toBe(`--wf-cat-${id}`)
      expect(hasLucide(WF_CATEGORIES[id].icon)).toBe(true)
    }
  })
  it('a model call is an AI node and media is its own category', () => {
    expect(wfCategory('llm.call')).toBe('agent')
    expect(wfCategory('media.generate')).toBe('media')
    expect(nodeAccent('llm.call')).toBe('var(--wf-cat-agent)')
    expect(nodeAccent('trigger.webhook')).toBe('var(--wf-cat-trigger)')
  })
  it('the approval step keeps approvers out of its schema fields: they are picked from people (ADM-1339)', () => {
    expect(wfFields('logic.approval').map((f) => f.key)).not.toContain('approvers')
  })
})

describe('node visual state', () => {
  it('shows the C2 run status as sent, never read from the node data', () => {
    for (const s of ['queued', 'running', 'waiting', 'succeeded', 'failed', 'skipped', 'cancelled']) {
      expect(nodeStatusState('action.http', { url: 'x' }, { status: s })).toBe(s)
    }
    expect(nodeStatusState('action.http', { url: 'x', __status: 'running' })).toBe('configured')
  })
  it('falls back to invalid, then configured / idle', () => {
    expect(nodeStatusState('action.http', { url: 'x' }, { invalid: true })).toBe('invalid')
    expect(nodeStatusState('action.http', { url: 'x' })).toBe('configured')
    expect(nodeStatusState('action.http', {})).toBe('idle')
    expect(nodeStatusState('action.http', {}, { status: 'bogus' })).toBe('idle')
  })
  it('every state has a label and an icon', () => {
    for (const s of Object.keys(NODE_STATUS_LABELS)) expect(hasLucide(NODE_STATUS_ICONS[s]), s).toBe(true)
  })
  it('names a node for assistive tech', () => {
    expect(nodeAriaLabel('agent.run', { label: 'Summarise' }, 'succeeded')).toBe('AI step, Summarise, succeeded')
    expect(nodeAriaLabel('trigger.manual', {}, 'idle')).toBe('Trigger step, Manual trigger, needs setup')
  })
  it('the approval preview is its message', () => {
    expect(nodeConfigPreview('logic.approval', { message: 'Ship it?' })).toBe('Ship it?')
    expect(nodeIsConfigured('logic.approval', { message: '' })).toBe(false)
  })
})

describe('the condition step (F3)', () => {
  it('a step built from rules is configured; an empty draft rule is not', () => {
    expect(nodeIsConfigured('logic.condition', { conditions: [{ field: '{{nodes.a.output.n}}', operator: '>', value: '5' }] })).toBe(true)
    expect(nodeIsConfigured('logic.condition', { conditions: [{ field: '  ', operator: '=', value: '' }] })).toBe(false)
    expect(nodeIsConfigured('logic.condition', {})).toBe(false)
    expect(nodeIsConfigured('logic.condition', { expression: "{{trigger.plan}} == 'pro'" })).toBe(true)
    expect(nodeStatusState('logic.condition', { conditions: [{ field: 'x', operator: '=', value: '1' }] })).toBe('configured')
  })

  it('the preview shows the rules joined by the step\'s join, else the expression', () => {
    const conditions = [{ field: 'a', operator: '>', value: '1' }, { field: 'b', operator: 'contains', value: 'x' }, { field: '', operator: '=', value: '' }]
    expect(nodeConfigPreview('logic.condition', { conditions })).toBe('a > 1 and b contains x')
    expect(nodeConfigPreview('logic.condition', { conditions, join: 'OR' })).toBe('a > 1 or b contains x')
    expect(nodeConfigPreview('logic.condition', { expression: 'x == 1' })).toBe('x == 1')
  })
})
