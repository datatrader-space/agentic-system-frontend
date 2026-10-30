// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AdminPanel from './AdminPanel.vue'
const api=vi.hoisted(()=>({get:vi.fn()}))
vi.mock('../services/api',()=>({default:api}))
let wrapper
afterEach(()=>{wrapper?.unmount();vi.useRealTimers()})
function render(){return mount(AdminPanel,{global:{stubs:{AnalyticsPanel:true}}})}
describe('Platform & Users service states',()=>{
  it('uses the documented server paging, sorting, page-size, and debounced search parameters',async()=>{
    vi.useFakeTimers()
    api.get.mockImplementation((path,config)=>{
      if(path==='/auth/check')return Promise.resolve({data:{user:{is_staff:true}}})
      if(path==='/admin/users/'){
        const all=Array.from({length:41},(_,id)=>({id,username:'User '+id,email:'user'+id+'@example.test'})),p=config.params
        return Promise.resolve({data:{total:all.length,users:all.slice(p.offset,p.offset+p.limit)}})
      }
      return Promise.resolve({data:{}})
    })
    wrapper=render();await flushPromises()
    expect(wrapper.findAll('.users-table tbody tr')).toHaveLength(20)
    await wrapper.get('[aria-label="Next user page"]').trigger('click');await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/admin/users/',{params:{sort:'-date',limit:20,offset:20},noCache:true})
    await wrapper.findAll('.users-toolbar select')[0].setValue('name');await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/admin/users/',{params:{sort:'name',limit:20,offset:0},noCache:true})
    await wrapper.findAll('.users-toolbar select')[1].setValue(50);await flushPromises()
    expect(wrapper.findAll('.users-table tbody tr')).toHaveLength(41)
    const before=api.get.mock.calls.length
    await wrapper.get('input[type=search]').setValue(' Alex ')
    expect(api.get).toHaveBeenCalledTimes(before)
    await vi.advanceTimersByTimeAsync(300);await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/admin/users/',{params:{sort:'name',limit:50,offset:0,search:'Alex'},noCache:true})
  })
  it('ignores an old user response after a newer sort completes',async()=>{
    let oldResponse,reads=0
    api.get.mockImplementation(path=>{
      if(path==='/auth/check')return Promise.resolve({data:{user:{is_staff:true}}})
      if(path==='/admin/users/'&&reads++===0)return new Promise(resolve=>{oldResponse=resolve})
      if(path==='/admin/users/')return Promise.resolve({data:{total:1,users:[{id:2,username:'Current user'}]}})
      return Promise.resolve({data:{}})
    })
    wrapper=render();await flushPromises()
    await wrapper.findAll('.users-toolbar select')[0].setValue('name');await flushPromises()
    expect(wrapper.get('.users-table').text()).toContain('Current user')
    oldResponse({data:{total:1,users:[{id:1,username:'Old user'}]}});await flushPromises()
    expect(wrapper.get('.users-table').text()).not.toContain('Old user')
  })
  it('shows a retry on a failed user read, hides a false zero count, and recovers',async()=>{
    let fail=true
    api.get.mockImplementation(path=>{
      if(path==='/auth/check')return Promise.resolve({data:{user:{is_staff:true}}})
      if(path==='/admin/costs/')return Promise.resolve({data:{totals:{cost_usd:1,request_count:3},top_users:[{id:7}]}})
      if(path==='/admin/users/')return fail?Promise.reject(new Error('500')):Promise.resolve({data:{total:1,users:[{id:7,username:'Alex',email:'alex@example.test',agent_count:2,total_cost_usd:1,date_joined:'2026-10-01'}]}})
      return Promise.resolve({data:{}})
    })
    wrapper=render();await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('Could not load users')
    expect(wrapper.find('.badge-count').exists()).toBe(false)
    expect(wrapper.find('.users-table').exists()).toBe(false)
    expect(wrapper.text()).toContain('Users in cost report')
    fail=false;await wrapper.get('[role=alert] button').trigger('click');await flushPromises()
    expect(wrapper.find('[role=alert]').exists()).toBe(false)
    expect(wrapper.get('.badge-count').text()).toBe('1')
    expect(wrapper.get('.users-table').text()).toContain('Alex')
    expect(api.get).toHaveBeenLastCalledWith('/admin/users/',{params:{sort:'-date',limit:20,offset:0},noCache:true})
  })
  it('retains the staff check before requesting protected admin lists',async()=>{
    api.get.mockReset().mockResolvedValue({data:{user:{is_staff:false}}})
    wrapper=render();await flushPromises()
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/auth/check')
    expect(wrapper.text()).toContain('Access Restricted')
    expect(wrapper.find('.admin-grid').exists()).toBe(false)
  })
})
