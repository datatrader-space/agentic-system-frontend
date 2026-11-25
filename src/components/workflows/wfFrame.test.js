// A frame workflow (ADM-1351 phase 2): it starts with "Each camera frame"; a stream runs it, never a Run; its Test takes
// a photo for {{trigger.image}}; only the registry's frame-mode steps can follow it.
import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '@/config/__fixtures__/wfStepTypes.json'
import { setStepRegistry } from '@/config/wfNodeDefinitions'
import { FRAME_RUN_NOTE, FRAME_TRIGGER, frameRefusal, frameStepLabels, isFrameWorkflow, runInputs } from './wfFrame'

beforeEach(() => { setStepRegistry(JSON.parse(JSON.stringify(fixture))) })

const frame = { id: 'frame', type: FRAME_TRIGGER, data: {} }
const manual = { id: 'start', type: 'trigger.manual', data: { inputs: [{ key: 'city', default: 'Oslo' }, { key: '', default: 'x' }, { key: 'photo', type: 'image' }] } }

describe('a frame workflow', () => {
  it('is one with an "Each camera frame" trigger', () => {
    expect(isFrameWorkflow([frame, { id: 'a', type: 'vision.model', data: {} }])).toBe(true)
    expect(isFrameWorkflow([manual])).toBe(false)
    expect(isFrameWorkflow([])).toBe(false)
    expect(isFrameWorkflow(null)).toBe(false)
    expect(FRAME_RUN_NOTE).toBe('Runs on each frame of a stream: start a stream with it in Training Data.')
  })

  it('asks for one photo under `image` before a test; any other workflow asks for its manual inputs', () => {
    expect(runInputs([frame])).toEqual([{ key: 'image', type: 'image', default: '' }])
    expect(runInputs([manual])).toEqual([{ key: 'city', default: 'Oslo' }, { key: 'photo', type: 'image' }])
    expect(runInputs([{ id: 'w', type: 'trigger.webhook', data: {} }])).toEqual([])
    expect(runInputs(undefined)).toEqual([])
  })

  it('refuses every step the server does not mark frame_mode, and a second trigger', () => {
    for (const type of ['vision.model', 'vision.filter', 'vision.crop', 'vision.draw', 'logic.condition', 'logic.foreach']) {
      expect(frameRefusal(type), type).toBe('')
    }
    for (const type of ['agent.run', 'llm.call', 'action.http', 'action.tool', 'action.mcp_tool', 'action.channel', 'logic.approval', 'logic.delay', 'media.generate']) {
      expect(frameRefusal(type), type).toBe('A stream cannot run this step on a camera frame.')
    }
    expect(frameRefusal('trigger.manual')).toBe('This workflow already starts on each camera frame.')
    expect(frameRefusal(FRAME_TRIGGER)).toBe('This workflow already starts on each camera frame.')
    expect(frameRefusal('no.such_step')).toBe('')
  })

  it('names the steps that may follow the frame, in the registry order, by their labels', () => {
    const labels = frameStepLabels()
    // The four vision steps, Condition, For-each and (ADM-1363) Data table and SQL database.
    expect(labels).toHaveLength(8)
    expect(labels).toContain('Data table')
    expect(labels).not.toContain('Each camera frame')
    const json = JSON.parse(JSON.stringify(fixture))
    json.steps.find((s) => s.type === 'logic.delay').frame_mode = true
    setStepRegistry(json)
    expect(frameStepLabels()).toHaveLength(9)
  })
})
