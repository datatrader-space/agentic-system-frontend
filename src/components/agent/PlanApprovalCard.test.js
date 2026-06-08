// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanApprovalCard from './PlanApprovalCard.vue'

const btn = (w, text) => w.findAll('button').find((b) => b.text().includes(text))

describe('PlanApprovalCard', () => {
  it('emits approve / reject', async () => {
    const w = mount(PlanApprovalCard, { props: { plan: { title: 'P' } } })
    await btn(w, 'Approve').trigger('click')
    expect(w.emitted('approve')).toBeTruthy()
    await btn(w, 'Reject').trigger('click')
    expect(w.emitted('reject')).toBeTruthy()
  })

  it('reveals a feedback box and emits revise with the typed text', async () => {
    const w = mount(PlanApprovalCard, { props: { plan: { title: 'P' } } })
    expect(w.find('textarea').exists()).toBe(false)            // hidden until requested
    await btn(w, 'Request changes').trigger('click')
    expect(w.find('textarea').exists()).toBe(true)
    await w.find('textarea').setValue('just connect — skip the health checks')
    await btn(w, 'Send to agent').trigger('click')
    expect(w.emitted('revise')[0]).toEqual(['just connect — skip the health checks'])
    expect(w.find('textarea').exists()).toBe(false)            // collapses after sending
  })

  it('does not emit revise for empty/whitespace feedback', async () => {
    const w = mount(PlanApprovalCard, { props: { plan: { title: 'P' } } })
    await btn(w, 'Request changes').trigger('click')
    await w.find('textarea').setValue('   ')
    const send = btn(w, 'Send to agent')
    expect(send.attributes('disabled')).toBeDefined()          // button disabled
    await send.trigger('click')
    expect(w.emitted('revise')).toBeFalsy()
  })
})
