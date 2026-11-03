// @vitest-environment jsdom
// Recent Video Studio chats in the Studio's navigation (owner, 2026-10-20): newest first, each opens in the Studio.
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: { conversation: '2874' } }) }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => ({ conversationId: '2874', isBusy: false }) }))

import api from '../../services/api'
import StudioRecentChats from './StudioRecentChats.vue'

const flush = () => new Promise((r) => setTimeout(r, 0))
const stubs = { global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } } }

describe('StudioRecentChats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the sidebar to three recent chats and opens the existing full-history surface', async () => {
    api.get.mockResolvedValueOnce({data:{count:5,results:Array.from({length:5},(_,i)=>({id:i+1,name:`Chat ${i+1}`}))}})
    const w=mount(StudioRecentChats,{...stubs,props:{limit:3}})
    await flush()
    expect(w.findAll('[data-test="studio-recent-chat"]')).toHaveLength(3)
    expect(w.find('[data-test="studio-recent-more"]').exists()).toBe(false)
    await w.get('.vrc-view-all').trigger('click')
    expect(w.emitted('history')).toHaveLength(1)
    expect(api.get).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('lists the Studio agent\'s chats newest first, marks the open one, and pages older ones', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 3, results: [
      { id: 2874, name: 'Candle reel', updated_at: '2026-10-20T12:30:00Z' }, { id: 2873, name: 'Make a lavender candle reel', updated_at: '2026-10-20T11:58:00Z' }] } })
    const w = mount(StudioRecentChats, stubs)
    await flush()
    expect(api.get).toHaveBeenCalledWith('/video/chats/', { params: { page: 1, page_size: 15 } })
    const links = w.findAll('[data-test="studio-recent-chat"]')
    expect(links.map((a) => a.find('.vrc-name').text())).toEqual(['Candle reel', 'Make a lavender candle reel'])   // the server names a chat by what was asked
    expect(JSON.parse(links[0].attributes('data-to'))).toEqual({ path: '/video-studio/dashboard', query: { conversation: '2874' } })
    expect(links[0].classes()).toContain('active')
    api.get.mockResolvedValueOnce({ data: { count: 3, results: [{ id: 2600, name: 'Older', updated_at: '2026-10-16T10:00:00Z' }] } })
    await w.get('[data-test="studio-recent-more"]').trigger('click')
    await flush()
    expect(w.findAll('[data-test="studio-recent-chat"]')).toHaveLength(3)
    expect(w.find('[data-test="studio-recent-more"]').exists()).toBe(false)
  })

  it('opens each chat on its own page and names an unnamed one after that page', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 2, results: [
      { id: 31, name: 'Untitled chat', page: 'edit', updated_at: '2026-10-27T10:00:00Z' },
      { id: 32, name: 'A jingle for the shop', page: 'audio', updated_at: '2026-10-27T09:00:00Z' }] } })
    const w = mount(StudioRecentChats, stubs)
    await flush()
    const links = w.findAll('[data-test="studio-recent-chat"]')
    expect(links.map((a) => a.find('.vrc-name').text())).toEqual(['Image edit chat', 'A jingle for the shop'])
    expect(JSON.parse(links[0].attributes('data-to'))).toEqual({ path: '/video-studio/edit', query: { conversation: '31' } })
    expect(JSON.parse(links[1].attributes('data-to'))).toEqual({ path: '/video-studio/audio', query: { conversation: '32' } })
  })

  it('shows nothing when there is no chat yet', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 0, results: [] } })
    const w = mount(StudioRecentChats, stubs)
    await flush()
    expect(w.find('[data-test="studio-recent-chats"]').exists()).toBe(false)
  })
})

it('cleans recent names and uses a page fallback for hidden instructions', async () => {
  api.get.mockResolvedValueOnce({data:{count:3,results:[{id:1,name:'I am on the Image page. My chosen preset is Quiet tabletop.'},{id:2,name:'I am on the Video page. My chosen preset is A measured reveal.\n\nA bottle reveal'},{id:3,name:'I am on the Enhance page in Manual mode. Write an editable creative prompt.'}]}})
  const w = mount(StudioRecentChats,stubs); await flush()
  expect(w.findAll('.vrc-name').map(n=>n.text())).toEqual(['Image chat '+String.fromCharCode(183)+' Quiet tabletop','A bottle reveal','Enhance chat'])
  w.unmount()
})

it('drops a previous account response when the signed-in person changes during history loading', async () => {
  let previous
  const person=ref({id:'first-person'})
  api.get.mockImplementationOnce(()=>new Promise(resolve=>{previous=resolve})).mockResolvedValueOnce({data:{count:1,results:[{id:20,name:'Current account chat'}]}})
  const w=mount(StudioRecentChats,{props:{history:true},global:{...stubs.global,provide:{studioUser:person}}})
  person.value={id:'second-person'}
  await flushPromises()
  previous({data:{count:1,results:[{id:10,name:'Previous account private chat'}]}})
  await flushPromises()
  expect(w.text()).toContain('Current account chat')
  expect(w.text()).not.toContain('Previous account private chat')
  w.unmount()
})

describe('Chat history search (GET /api/video/chats/?q=)', () => {
  const historyMount = () => mount(StudioRecentChats, { props: { history: true }, global: { ...stubs.global, provide: { studioUser: ref({ id: 'person' }) } } })
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('asks the server after a pause in typing, pages the matches, and shows what the server found', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 1, results: [{ id: 1, name: 'Loaded chat' }] } })
    const w = historyMount(); await flushPromises()
    api.get.mockResolvedValueOnce({ data: { count: 16, results: [{ id: 9, name: 'Older candle chat', studio_feature: 'image' }] } })
    await w.get('[data-test="studio-recent-search"]').setValue('can')
    await w.get('[data-test="studio-recent-search"]').setValue('candle')
    vi.advanceTimersByTime(299); expect(api.get).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1); await flushPromises()
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(api.get).toHaveBeenLastCalledWith('/video/chats/', { params: { page: 1, page_size: 15, q: 'candle' } })
    const links = w.findAll('[data-test="studio-recent-chat"]')
    expect(links.map(a => a.find('.vrc-name').text())).toEqual(['Older candle chat'])   // a chat that was never loaded
    expect(JSON.parse(links[0].attributes('data-to'))).toEqual({ path: '/video-studio/image', query: { conversation: '9' } })
    api.get.mockResolvedValueOnce({ data: { count: 16, results: [{ id: 8, name: 'Second page match' }] } })
    await w.get('[data-test="studio-recent-more"]').trigger('click'); await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/video/chats/', { params: { page: 2, page_size: 15, q: 'candle' } })
    expect(w.findAll('[data-test="studio-recent-chat"]')).toHaveLength(2)
    w.unmount()
  })

  it('drops an older search answer that arrives after a newer one', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 0, results: [] } })
    const w = historyMount(); await flushPromises()
    let slow
    api.get.mockImplementationOnce(() => new Promise(resolve => { slow = resolve }))
      .mockResolvedValueOnce({ data: { count: 1, results: [{ id: 2, name: 'Jingle for the shop' }] } })
    await w.get('[data-test="studio-recent-search"]').setValue('candle'); vi.advanceTimersByTime(300); await flushPromises()
    await w.get('[data-test="studio-recent-search"]').setValue('jingle'); vi.advanceTimersByTime(300); await flushPromises()
    slow({ data: { count: 1, results: [{ id: 1, name: 'Candle reel' }] } }); await flushPromises()
    expect(w.text()).toContain('Jingle for the shop'); expect(w.text()).not.toContain('Candle reel')
    w.unmount()
  })

  it('says so when nothing matches', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 1, results: [{ id: 1, name: 'Candle reel' }] } }).mockResolvedValueOnce({ data: { count: 0, results: [] } })
    const w = historyMount(); await flushPromises()
    await w.get('[data-test="studio-recent-search"]').setValue('zebra'); vi.advanceTimersByTime(300); await flushPromises()
    expect(w.findAll('[data-test="studio-recent-chat"]')).toHaveLength(0)
    expect(w.get('[data-test="studio-recent-empty"]').text()).toContain('No conversation matches “zebra”')
    w.unmount()
  })
})
