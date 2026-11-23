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
  it('the categories are trigger, agent, action, logic, media and vision, each with a token and an icon', () => {
    expect(WF_CATEGORY_ORDER).toEqual(['trigger', 'agent', 'action', 'logic', 'media', 'vision'])
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
  it('a turned-off step says so (ADM-1343); only exactly true is off', () => {
    expect(nodeAriaLabel('agent.run', { label: 'Summarise', disabled: true }, 'configured')).toBe('AI step, Summarise, ready, turned off')
    expect(nodeAriaLabel('agent.run', { label: 'Summarise', disabled: 'yes' }, 'configured')).toBe('AI step, Summarise, ready')
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

describe('the vision steps (ADM-1351)', () => {
  it('are their own category, with Lucide icons, from the server\'s registry', () => {
    for (const type of ['vision.model', 'vision.filter', 'vision.crop', 'vision.draw']) {
      expect(wfCategory(type), type).toBe('vision')
      expect(hasLucide(wfIcon(type)), type).toBe(true)
    }
    expect(nodeAccent('vision.model')).toBe('var(--wf-cat-vision)')
    expect(nodeAriaLabel('vision.model', {}, 'idle')).toBe('Vision step, Find objects, needs setup')
    expect(wfFields('vision.model').find((f) => f.key === 'model').optionsKey).toBe('visionModels')
  })
  it('Find objects is set up with an image and a model; the others with detections', () => {
    expect(nodeIsConfigured('vision.model', { image: '{{trigger.photo}}', model: '' })).toBe(false)
    expect(nodeIsConfigured('vision.model', { image: '', model: 'sam3' })).toBe(false)
    expect(nodeIsConfigured('vision.model', { image: '{{trigger.photo}}', model: 'sam3' })).toBe(true)
    for (const type of ['vision.filter', 'vision.crop', 'vision.draw']) {
      expect(nodeIsConfigured(type, { detections: '' }), type).toBe(false)
      expect(nodeIsConfigured(type, { detections: '{{nodes.find.output.detections}}' }), type).toBe(true)
    }
  })
  it('previews what each step does', () => {
    expect(nodeConfigPreview('vision.model', { classes: 'person, car', threshold: 0.5 })).toBe('find person, car · min 0.5')
    expect(nodeConfigPreview('vision.model', { classes: '', threshold: null })).toBe('')
    expect(nodeConfigPreview('vision.filter', { classes: 'person', min_score: 0.4, zone: 3 })).toBe('keep person · min 0.4 · zone 3')
    expect(nodeConfigPreview('vision.crop', { max: 20, padding: 10 })).toBe('up to 20 crops · 10% padding')
    expect(nodeConfigPreview('vision.crop', { max: 5, padding: 0 })).toBe('up to 5 crops')
    expect(nodeConfigPreview('vision.draw', { labels: true })).toBe('boxes and labels')
    expect(nodeConfigPreview('vision.draw', { labels: false })).toBe('boxes only')
  })
})
