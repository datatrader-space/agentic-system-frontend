// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../../stores/useChatStore'
import { modelAliases, retryText, studioError, useStudioChat } from './studioForm'

describe('studioError', () => {
  it("puts a model error at the form's model menu, whatever the backend calls it", () => {
    for (const field of ['model', 'model_id', 'route_id']) expect(studioError({ code: 'not_verified', field, message: 'Checking.' }, ['route_id'], modelAliases('route_id')).field).toBe('route_id')
  })
  it('a field the form does not have is a general message', () => {
    expect(studioError({ field: 'page', message: 'Unknown page.' }, ['route_id'])).toMatchObject({ field: '', message: 'Unknown page.' })
    expect(studioError({ field: 'request.n', message: 'Too many.' }, ['n']).field).toBe('n')
  })
  it('a 429 says when to try again', () => {
    expect(studioError({ message: 'Too many requests.', retry_after: 1 }).message).toBe('Too many requests. Try again in 1 second.')
    expect(retryText(61)).toBe('Try again in 2 minutes.')
    expect(retryText(0)).toBe('')
  })
})

describe('useStudioChat', () => {
  const host = (look, ctx) => {
    const pinia = createPinia(); setActivePinia(pinia)
    const chat = useChatStore(pinia); chat.conversationId = 'c7'; chat.studioContext = ctx
    let api
    const w = mount(defineComponent({ setup() { api = useStudioChat(() => 'storyboard'); return () => null } }), { global: { plugins: [pinia], provide: look ? { studioPreparedLook: ref(look) } : {} } })
    return { w, api: () => api }
  }
  it('sends the open chat, the page and the preset chosen there', async () => {
    const { w, api } = host({ id: 'board-ad', title: 'Ad board' }, { page: 'storyboard' })
    expect(await api().chatFields()).toEqual({ conversation_id: 'c7', studio_context: { page: 'storyboard', preset: 'board-ad', preset_title: 'Ad board' } })
    w.unmount()
  })
  it('a preset the page already names in the chat wins; with none it sends empty preset fields', () => {
    let h = host({ id: 'old', title: 'Old' }, { page: 'cinema', preset: 'new', preset_title: 'New' })
    expect(h.api().studioContext()).toEqual({ page: 'cinema', preset: 'new', preset_title: 'New' }); h.w.unmount()
    h = host(null, null)
    expect(h.api().studioContext()).toEqual({ page: 'storyboard', preset: '', preset_title: '' }); h.w.unmount()
  })
})
