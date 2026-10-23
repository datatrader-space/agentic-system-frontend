// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
const get = vi.hoisted(() => vi.fn())
vi.mock('../../services/api', () => ({ default: { get } }))
import { ref } from 'vue'
import HomeFeatures from './HomeFeatures.vue'
import { studioFeatures } from '../../services/studioFeatures'
let wrapper
const RouterLink = { props: ['to'], template: `<a :href="typeof to === 'string' ? to : to.path + '?conversation=' + to.query.conversation"><slot /></a>` }
beforeEach(() => { localStorage.clear(); get.mockReset(); get.mockImplementation(path => Promise.resolve({ data: path === '/video/chats/' ? { results: [{ id: 'c9', name: 'A saved creative brief' }] } : { projects: [{ project_id: 'p1', title: 'Launch film', conversation_id: 'c9' }] } })) })
afterEach(() => wrapper?.unmount())
describe('HomeFeatures', () => {
  it('renders every catalog page, filters groups, and links existing recent work', async () => {
    wrapper = mount(HomeFeatures, { global: { stubs: { RouterLink } } }); await flushPromises()
    expect(wrapper.findAll('.hf-card')).toHaveLength(studioFeatures.value.length - 1)
    expect(wrapper.find('[data-test="studio-feature-home"]').exists()).toBe(false)
    expect(wrapper.findAll('.hf-card').some(card => card.attributes('href') === '/video-studio')).toBe(false)
    expect(wrapper.text()).toContain('Continue'); expect(wrapper.text()).toContain('A saved creative brief'); expect(wrapper.text()).toContain('Launch film')
    expect(get).toHaveBeenCalledWith('/video/chats/', { params: { page: 1, page_size: 6 } })
    await wrapper.get('select').setValue('Marketing')
    expect(wrapper.findAll('.hf-card')).toHaveLength(3)
    expect(wrapper.get('.hf-card').text()).not.toContain('Soon')          // Ads, Product videos, Ad remix are live
  })
  it('keeps features usable when recent-work reads fail', async () => {
    get.mockRejectedValue(new Error('network'))
    wrapper = mount(HomeFeatures, { global: { stubs: { RouterLink } } }); await flushPromises()
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(3)
    expect(wrapper.findAll('.hf-card')).toHaveLength(studioFeatures.value.length - 1)
  })
})

it('orders quick tools before Continue and All tools, newest six across all existing sources', async () => {
  get.mockImplementation(path => Promise.resolve({ data: path === '/video/chats/' ? { results: [{ id:'c', name:'Old brief', updated_at:'2026-10-01' }] } : path === '/video/projects/' ? { projects:[{ project_id:'p', title:'Recent project', updated_at:'2026-10-20' }] } : { items:Array.from({length:6}, (_,i) => ({ attachment_id:i+1, title:`Result ${i}`, media_type:'image', conversation_id:'c', created_at:`2026-10-${21-i}` })) } }))
  wrapper = mount(HomeFeatures, { global:{ stubs:{ RouterLink } } }); await flushPromises()
  expect(wrapper.findAll('.hf-recent-grid li')).toHaveLength(6)
  expect(wrapper.find('.hf-recent-grid li').text()).toContain('Result 0')
  expect(wrapper.find('.hf-start').exists()).toBe(false)
  expect(wrapper.findAll('.hf-quick a')).toHaveLength(6)
  expect(wrapper.get('[data-test="studio-quick-image"]').attributes('href')).toContain('/video-studio/image')
  expect(wrapper.html().indexOf('hf-quick')).toBeLessThan(wrapper.html().indexOf('hf-continue'))
  expect(wrapper.html().indexOf('hf-continue')).toBeLessThan(wrapper.html().indexOf('hf-heading'))
})
it('shows three preset starts only on an empty first visit', async () => {
  get.mockResolvedValue({data:{results:[],projects:[],items:[]}})
  wrapper = mount(HomeFeatures, { global:{ stubs:{ RouterLink } } }); await flushPromises()
  expect(wrapper.find('.hf-continue').exists()).toBe(false)
  expect(wrapper.findAll('.hf-start-grid a')).toHaveLength(3)
  for (const start of wrapper.findAllComponents(RouterLink).filter(link => link.props('to')?.query?.preset)) expect(start.props('to').query.preset).toBeTruthy()
})

it('remembers an empty Home visit for the signed-in person without hiding another person?s starts', async () => {
  get.mockResolvedValue({data:{results:[],projects:[],items:[]}})
  const user = ref({id:'person'})
  wrapper = mount(HomeFeatures,{global:{stubs:{RouterLink},provide:{studioUser:user}}}); await flushPromises()
  expect(wrapper.find('.hf-start').exists()).toBe(true)
  wrapper.unmount()
  wrapper = mount(HomeFeatures,{global:{stubs:{RouterLink},provide:{studioUser:user}}}); await flushPromises()
  expect(wrapper.find('.hf-start').exists()).toBe(false)
  user.value={id:'other'}; await flushPromises()
  expect(wrapper.find('.hf-start').exists()).toBe(true)
})

it('reopens a new chat in its originating feature using only local navigation metadata', async () => {
  localStorage.setItem('aadml.studio.origins.person', JSON.stringify({'conversation:c9':'image'}))
  wrapper=mount(HomeFeatures,{global:{stubs:{RouterLink},provide:{studioUser:ref({id:'person'})}}}); await flushPromises()
  const recent = wrapper.findAllComponents(RouterLink).find(link => link.props('to')?.query?.conversation === 'c9' && link.props('to')?.path === '/video-studio/image')
  expect(recent.exists()).toBe(true)
  expect(recent.text()).toContain('Image')
})

it('cleans Continue names and shows unknown origins as neutral Chat', async () => {
  get.mockResolvedValue({data:{results:[{id:1,name:'I am on the Image page. My chosen preset is Quiet tabletop.',studio_feature:'image'},{id:2,name:'I am on the Video page in Manual mode. Suggest settings only as JSON.'},{id:3,name:'HI'}],projects:[],items:[]}})
  wrapper = mount(HomeFeatures,{global:{stubs:{RouterLink}}}); await flushPromises()
  const rows = wrapper.findAll('.hf-recent-grid li')
  expect(rows[0].get('strong').text()).toBe('Image chat '+String.fromCharCode(183)+' Quiet tabletop')
  expect(rows[0].get('small').text()).toBe('Image '+String.fromCharCode(183)+' Chat')
  expect(rows[1].get('strong').text()).toBe('Video chat')
  expect(rows[1].get('small').text()).toBe('Chat')
  expect(rows[2].get('small').text()).toBe('Chat')
  const { studioIcons } = await import('../../services/studioFeatures')
  expect(rows[2].get('path').attributes('d')).toBe(studioIcons.chat)
})
