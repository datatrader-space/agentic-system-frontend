import { describe, it, expect } from 'vitest'
import { cameraStarter, cameraWorkflow, CAMERA_EVENT_NODE } from './cameraWorkflow'
import { WF_NODE_DEFS, WF_PALETTE_ORDER, wfDefaultData } from '../config/wfNodeDefinitions'
import { nodeIsConfigured, nodeConfigPreview } from './wfNodeView'

describe('a workflow started from a camera', () => {
  it('reads the camera and rule from the link, and nothing else', () => {
    expect(cameraStarter({ trigger: 'training.stream_event', source: '12', camera: 'Gate camera', rule: '3' }))
      .toEqual({ source: 12, rule: 3, camera: 'Gate camera' })
    expect(cameraStarter({ trigger: 'training.stream_event', source: '12' })).toEqual({ source: 12, rule: null, camera: '' })
    for (const bad of [{}, { trigger: 'webhook', source: '12' }, { trigger: 'training.stream_event', source: 'x' },
      { trigger: 'training.stream_event', source: '0' }, { trigger: 'training.stream_event', source: '-4' }]) {
      expect(cameraStarter(bad)).toBeNull()
    }
    expect(cameraStarter({ trigger: 'training.stream_event', source: '5', rule: 'drop' }).rule).toBeNull()
  })

  it('opens a canvas with the camera-event trigger of that camera', () => {
    const made = cameraWorkflow({ source: 12, rule: 3, camera: 'Gate camera' })
    expect(made.name).toBe('Gate camera events')
    expect(made.graph.nodes).toHaveLength(1)
    expect(made.graph.nodes[0].type).toBe(CAMERA_EVENT_NODE)
    expect(made.graph.nodes[0].data).toEqual({ source: 12, rule: 3, source_name: 'Gate camera' })
    expect(cameraWorkflow({ source: 7 }).name).toBe('Camera 7 events')
  })

  it('is a trigger the builder offers, configured once it names a camera', () => {
    expect(WF_NODE_DEFS[CAMERA_EVENT_NODE].category).toBe('trigger')
    expect(WF_PALETTE_ORDER).toContain(CAMERA_EVENT_NODE)
    expect(nodeIsConfigured(CAMERA_EVENT_NODE, wfDefaultData(CAMERA_EVENT_NODE))).toBe(false)
    expect(nodeIsConfigured(CAMERA_EVENT_NODE, { source: 12 })).toBe(true)
    expect(nodeConfigPreview(CAMERA_EVENT_NODE, { source: 12, source_name: 'Gate camera', rule: 3 })).toBe('Gate camera · rule 3')
  })
})
