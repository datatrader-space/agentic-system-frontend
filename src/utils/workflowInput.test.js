import { describe, expect, it } from 'vitest'
import { WorkflowInputError, workflowJson } from './workflowInput'
describe('workflow JSON input', () => {
  it('blocks invalid JSON without exposing the entered value in its error', () => {
    expect(() => workflowJson('{private-value', { safe: true }, {}, 'Parameters')).toThrow(WorkflowInputError)
    expect(() => workflowJson('{private-value', {}, {}, 'Parameters')).toThrow('Enter valid JSON for Parameters.')
  })
  it('distinguishes untouched data from an intentionally cleared field', () => {
    expect(workflowJson(undefined, { original: true }, {}, 'Parameters')).toEqual({ original: true })
    expect(workflowJson(' ', { original: true }, {}, 'Parameters')).toEqual({})
    expect(workflowJson('', { original: true }, undefined, 'JSON body')).toBeUndefined()
  })
  it('parses objects, arrays and interpolated strings without executing them', () => {
    expect(workflowJson('{"input":"{{nodes.start.output.text}}"}', {}, {}, 'Parameters')).toEqual({ input: '{{nodes.start.output.text}}' })
    expect(workflowJson('[0,false]', undefined, undefined, 'JSON body')).toEqual([0, false])
  })
})
