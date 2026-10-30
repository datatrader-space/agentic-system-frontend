// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AdminOverview from './AdminOverview.vue'
const api=vi.hoisted(()=>({get:vi.fn()}))
vi.mock('../../services/api',()=>({default:api}))
let wrapper
afterEach(()=>wrapper?.unmount())
const render=()=>mount(AdminOverview,{global:{stubs:{RouterLink:{props:['to'],template:'<a :href="to"><slot /></a>'}}}})
describe('Admin overview',()=>{
  it('uses real report values and labels the report user subset accurately',async()=>{
    api.get.mockResolvedValue({data:{totals:{cost_usd:0.00000017,request_count:1250,avg_latency_ms:240},top_users:[{id:1}]}})
    wrapper=render();await flushPromises()
    expect(wrapper.text()).toContain('$0.00000017')
    expect(wrapper.text()).toContain('Users in report')
    expect(wrapper.text()).not.toContain('Active Users')
    expect(wrapper.findAll('.ov-tool')).toHaveLength(29)
    await wrapper.get('input[type=search]').setValue('prepaid')
    expect(wrapper.findAll('.ov-tool')).toHaveLength(1)
    expect(wrapper.get('.ov-tool').attributes('href')).toBe('/admin-dashboard/billing')
  })
  it('shows an honest error and retries rather than presenting a failed request as zero',async()=>{
    api.get.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({data:{totals:{request_count:0}}})
    wrapper=render();await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('could not be loaded')
    expect(wrapper.findAll('.admin-value').map(e=>e.text())).toEqual(['—','—','—','—'])
    await wrapper.get('[role=alert] button').trigger('click');await flushPromises()
    expect(wrapper.find('[role=alert]').exists()).toBe(false)
    expect(wrapper.findAll('.admin-value')[1].text()).toBe('0')
  })
})
