// @vitest-environment jsdom
//
// A NEW chat's message box gives back text that was not sent. The live check of 52a14b2 (2026-10-16)
// forced a failed start on aadml.com: the warning showed, nothing was sent, and the box was empty,
// because the fix restored only the thread's composer and a new chat types into this one.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const { notify } = vi.hoisted(() => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('../../composables/useNotify', () => ({ notify }))
vi.mock('../../composables/useVoiceInput', () => ({
  useVoiceInput: () => ({
    supported: false, enabled: { value: false }, disabledMessage: { value: '' },
    state: { value: 'idle' }, elapsed: { value: 0 }, maxSeconds: { value: 120 }, info: { value: null },
    recording: { value: false }, transcribing: { value: false },
    toggle: vi.fn(), start: vi.fn(), stop: vi.fn(), cancel: vi.fn(),
    explainDisabled: vi.fn(), refresh: vi.fn(),
  }),
}))
vi.mock('../../services/api', () => ({
  default: { getAgents: vi.fn(() => Promise.resolve({ data: [] })), startAgentChat: vi.fn() },
}))

import ChatWelcome from './ChatWelcome.vue'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'

const stubs = {
  AgentModePicker: { template: '<div />' },
  AgentModelPicker: { template: '<div />' },
  AgentSwitcher: { template: '<div />' },
  AddDocumentUrl: { template: '<div />' },
  RouterLink: { template: '<a><slot /></a>' },
  TurnModeSwitch: { template: '<div />' },
}

const mountW = () => mount(ChatWelcome, { global: { stubs } })

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(notify).forEach((fn) => fn.mockClear())
})

describe('the new-chat box gives back a message that was not sent', () => {
  it('restoreDraft puts the text back into an empty box', async () => {
    const w = mountW()
    w.vm.restoreDraft('Count the ADM issues please')
    await w.vm.$nextTick()
    expect(w.find('textarea.composer-input').element.value).toBe('Count the ADM issues please')
  })

  it('never overwrites what the person typed since', async () => {
    const w = mountW()
    await w.find('textarea.composer-input').setValue('something new')
    w.vm.restoreDraft('the old message')
    await w.vm.$nextTick()
    expect(w.find('textarea.composer-input').element.value).toBe('something new')
  })
})


describe('Create video opens the dedicated studio', () => {
  it('carries the agent, conversation and draft without expanding the chat composer', async () => {
    const chat = useChatStore()
    chat.agents = [{ id: 7, name: 'Video expert', video_model: 86 }]
    chat.selectedAgentId = '7'
    chat.conversationId = 'c1'
    chat.loadAgents = vi.fn().mockResolvedValue()
    const wrapper = mountW()
    await wrapper.get('textarea.composer-input').setValue('Animate this product')
    await wrapper.get('[data-test="welcome-plus"]').trigger('click')
    await wrapper.get('[data-test="welcome-plus-video-mode"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/dashboard/video-studio', query: { agent: '7', conversation: 'c1' } })
    expect(useVideoStore().studioDraft).toBe('Animate this product')
    expect(useVideoStore().mode).toBe(false)
    expect(wrapper.find('[data-test="video-composer-panel"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
