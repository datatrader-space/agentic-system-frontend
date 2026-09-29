// @vitest-environment jsdom
//
// A new chat's first message decides what Canvas builds, and the welcome composer had no way to choose it:
// the chip read "Canvas ×" and the kind was silently whatever was picked last. A Next.js request went out as
// Static (prod conv 2102, 2026-09-29). The chip now carries the kind picker, as the in-thread composer does.
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
import { useCanvasStore } from '../../stores/useCanvasStore'

const stubs = {
  AgentModePicker: { template: '<div />' },
  AgentModelPicker: { template: '<div />' },
  AgentSwitcher: { template: '<div />' },
  AddDocumentUrl: { template: '<div />' },
  TurnModeSwitch: { template: '<div />' },
}

beforeEach(() => {
  setActivePinia(createPinia())
  try { localStorage.removeItem('cv.kind') } catch (_e) { /* jsdom */ }
})

describe('the new-chat Canvas chip chooses what gets built', () => {
  it('shows the current kind and offers all three', async () => {
    const canvas = useCanvasStore()
    canvas.setMode(true)
    const w = mount(ChatWelcome, { global: { stubs } })
    await w.vm.$nextTick()
    const toggle = w.find('[data-test="welcome-canvas-kind-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toContain('Static')
    await toggle.trigger('click')
    for (const k of ['static', 'nextjs', 'web_builder']) {
      expect(w.find(`[data-test="welcome-canvas-kind-${k}"]`).exists()).toBe(true)
    }
  })

  it('picking Next.js sets the kind the message will carry', async () => {
    const canvas = useCanvasStore()
    canvas.setMode(true)
    const w = mount(ChatWelcome, { global: { stubs } })
    await w.vm.$nextTick()
    await w.find('[data-test="welcome-canvas-kind-toggle"]').trigger('click')
    await w.find('[data-test="welcome-canvas-kind-nextjs"]').trigger('click')
    expect(canvas.kind).toBe('nextjs')
    expect(w.find('[data-test="welcome-canvas-kind-toggle"]').text()).toContain('Next.js')
    expect(w.find('[data-test="welcome-canvas-kind-menu"]').exists()).toBe(false)
  })

  it('there is no kind picker while Canvas is off', () => {
    useCanvasStore().setMode(false)          // the mode persists between mounts, like the kind does
    const w = mount(ChatWelcome, { global: { stubs } })
    expect(w.find('[data-test="welcome-canvas-kind-toggle"]').exists()).toBe(false)
  })
})
