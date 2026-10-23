import { describe, expect, it } from 'vitest'
import { hydrateMediaNode, serializeMediaNode } from './mediaWorkflowNode'
describe('media workflow data', () => {
  it('preserves structured parameters and attachment variables through editing', () => {
    const node={operation:'video',route_id:'r',prompt:'test',params:{duration:5},references:[{attachment_id:'{{nodes.one.attachment_id}}',role:'first_frame'}],cinema:{shot:'wide'}}
    expect(serializeMediaNode(hydrateMediaNode(node))).toEqual(node)
  })
  it.each(['invalid','[]','null','"string"'])('rejects malformed parameters %s', params_json => expect(()=>serializeMediaNode({params_json})).toThrow())
  it('rejects an object in place of the reference array',()=>expect(()=>serializeMediaNode({references_json:'{}'})).toThrow())
  it('omits video camera controls from other operations',()=>expect(serializeMediaNode({operation:'music',cinema:{shot:'wide'}})).not.toHaveProperty('cinema'))
})
