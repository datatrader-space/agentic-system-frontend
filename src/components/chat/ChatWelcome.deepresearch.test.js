// @vitest-environment jsdom
//
// The welcome screen has its OWN composer and its own "+" menu, and it is where a research request
// actually starts — the first message of a new chat. Deep Research being only in the mid-thread composer
// (ChatComposer.vue) made the mode unreachable exactly where it is wanted; found live on aadml.com,
// 2026-09-18, when [data-test="composer-plus"] did not exist on the page the user was looking at.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

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

const stubs = {
  AgentModePicker: { template: '<div />' },
  AgentModelPicker: { template: '<div />' },
  AgentSwitcher: { template: '<div />' },
  AddDocumentUrl: { template: '<div />' },
  TurnModeSwitch: { template: '<div />' },
}

const mountW = () => mount(ChatWelcome, { global: { stubs } })

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(notify).forEach((fn) => fn.mockClear())
})

describe('ChatWelcome — Deep Research is reachable on the first message', () => {
  it('the "+" menu offers it', async () => {
    const w = mountW()
    await w.find('[data-test="welcome-plus"]').trigger('click')
    const item = w.find('[data-test="welcome-plus-deep-research"]')
    expect(item.exists()).toBe(true)
    expect(item.text()).toContain('Deep research')
  })

  it('turning it on sets the same store the mid-thread composer uses', async () => {
    const chat = useChatStore()
    const w = mountW()
    await w.find('[data-test="welcome-plus"]').trigger('click')
    await w.find('[data-test="welcome-plus-deep-research"]').trigger('click')
    expect(chat.researchMode).toBe(true)
    expect(w.find('[data-test="welcome-plus-menu"]').exists()).toBe(false)
  })

  it('the chip names the armed depth and keeps the options behind a dropdown', async () => {
    const chat = useChatStore()
    chat.researchMode = true
    const w = mountW()
    await w.vm.$nextTick()
    expect(w.find('[data-test="welcome-research-depth-toggle"]').text()).toContain('Standard')
    expect(w.find('[data-test="welcome-research-depth-menu"]').exists()).toBe(false)
    await w.find('[data-test="welcome-research-depth-toggle"]').trigger('click')
    expect(w.findAll('.rs-opt-label').map((b) => b.text())).toEqual(['Quick', 'Standard', 'Deep'])
    expect(w.find('[data-test="welcome-research-depth-standard"]').classes()).toContain('is-on')
  })

  it('picking a depth records it and closes the dropdown', async () => {
    const chat = useChatStore()
    chat.researchMode = true
    const w = mountW()
    await w.vm.$nextTick()
    await w.find('[data-test="welcome-research-depth-toggle"]').trigger('click')
    await w.find('[data-test="welcome-research-depth-quick"]').trigger('click')
    expect(chat.researchDepth).toBe('quick')
    expect(w.find('[data-test="welcome-research-depth-menu"]').exists()).toBe(false)
    expect(notify.info.mock.calls.at(-1)[0]).toContain('3 sub-questions')
  })

  it('every option states both budgets here too', async () => {
    const chat = useChatStore()
    chat.researchMode = true
    const w = mountW()
    await w.vm.$nextTick()
    await w.find('[data-test="welcome-research-depth-toggle"]').trigger('click')
    const hints = w.findAll('.rs-opt-hint').map((b) => b.text())
    expect(hints.map((t) => t.split('·')[0].trim())).toEqual(
      ['3 sub-questions', '6 sub-questions', '12 sub-questions'])
    expect(hints.map((t) => t.split('·')[1].trim())).toEqual(
      ['2 sources each', '4 sources each', '8 sources each'])
  })

  it('the × turns it off', async () => {
    const chat = useChatStore()
    chat.researchMode = true
    const w = mountW()
    await w.vm.$nextTick()
    await w.find('.research-chip .canvas-chip-x').trigger('click')
    expect(chat.researchMode).toBe(false)
  })
})
