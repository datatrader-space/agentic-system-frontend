// @vitest-environment jsdom
//
// Deep Research mode — the composer half. The "+" menu owns the yes/no; the CHIP is the depth control,
// because the depth is a cost decision (3 / 6 / 12 sub-questions, 2 / 4 / 8 sources each) and a cost
// decision has to be visible and one click from changing while the user is still typing the request it
// applies to. The numbers in the labels are pinned to the backend's single definition
// (agent/services/research_depth.py) — a drift there is a user promised a budget nothing enforces.
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

import ChatComposer from './ChatComposer.vue'
import { useChatStore } from '../../stores/useChatStore'

const stubs = {
  AgentModePicker: { template: '<div class="mode-stub" />' },
  AgentModelPicker: { template: '<div class="model-stub" />' },
  AgentSwitcher: { template: '<div class="switcher-stub" />' },
  AddDocumentUrl: { template: '<div class="adu-stub" />' },
  TurnModeSwitch: { template: '<div class="tms-stub" />' },
}

const mountC = (props = {}) =>
  mount(ChatComposer, { props: { agentId: 7, conversationId: 'c1', ...props }, global: { stubs } })

const openMenu = async (w) => {
  await w.find('[data-test="composer-plus"]').trigger('click')
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(notify).forEach((fn) => fn.mockClear())
})

describe('ChatComposer — Deep Research mode', () => {
  it('offers Deep research in the "+" menu', async () => {
    const w = await openMenu(mountC())
    const item = w.find('[data-test="plus-deep-research"]')
    expect(item.exists()).toBe(true)
    expect(item.text()).toContain('Deep research')
  })

  it('the menu search finds it by what a user would type', async () => {
    const w = await openMenu(mountC())
    // Read v-show off the element's own style, not wrapper.isVisible(): a wrapper's visibility result
    // does not track a LATER re-render, so the second filter below silently re-asserts the first.
    const shown = (t) => w.find(`[data-test="${t}"]`).element.style.display !== 'none'
    await w.find('[data-test="plus-search"]').setValue('research')
    expect([shown('plus-deep-research'), shown('plus-add-files')]).toEqual([true, false])
    await w.find('[data-test="plus-search"]').setValue('photos')
    expect([shown('plus-deep-research'), shown('plus-add-files')]).toEqual([false, true])
  })

  it('turning it on sets the store, closes the menu and says what the depth costs', async () => {
    const chat = useChatStore()
    const w = await openMenu(mountC())
    await w.find('[data-test="plus-deep-research"]').trigger('click')
    expect(chat.researchMode).toBe(true)
    expect(w.find('[data-test="composer-plus-menu"]').exists()).toBe(false)
    expect(notify.info).toHaveBeenCalled()
    expect(notify.info.mock.calls[0][0]).toContain('6 sub-questions')
  })

  it('the mode is off until the user asks for it', () => {
    const chat = useChatStore()
    expect(chat.researchMode).toBe(false)
    expect(mountC().find('.research-chip').exists()).toBe(false)
  })

  it('the chip names the armed depth and keeps the options behind a dropdown', async () => {
    // Three inline segments made the chip wide enough to push the send button off the composer at
    // 1560px (seen live). One pill that opens upward is what every other control in this row does.
    const chat = useChatStore()
    chat.researchMode = true
    const w = mountC()
    await w.vm.$nextTick()
    expect(w.find('.research-chip').exists()).toBe(true)
    expect(w.find('[data-test="research-depth-toggle"]').text()).toContain('Standard')
    expect(w.find('[data-test="research-depth-menu"]').exists()).toBe(false)
    await w.find('[data-test="research-depth-toggle"]').trigger('click')
    expect(w.findAll('.rs-opt-label').map((b) => b.text())).toEqual(['Quick', 'Standard', 'Deep'])
    expect(w.find('[data-test="research-depth-standard"]').classes()).toContain('is-on')
    expect(w.find('[data-test="research-depth-standard"]').attributes('aria-checked')).toBe('true')
  })

  it('picking a depth records it, closes the dropdown and reports its budget', async () => {
    const chat = useChatStore()
    chat.researchMode = true
    const w = mountC()
    await w.vm.$nextTick()
    await w.find('[data-test="research-depth-toggle"]').trigger('click')
    await w.find('[data-test="research-depth-deep"]').trigger('click')
    expect(chat.researchDepth).toBe('deep')
    expect(w.find('[data-test="research-depth-menu"]').exists()).toBe(false)
    expect(w.find('[data-test="research-depth-toggle"]').text()).toContain('Deep')
    expect(notify.info.mock.calls.at(-1)[0]).toContain('12 sub-questions')
  })

  it('every option states both budgets, so the cost is never implied', async () => {
    const chat = useChatStore()
    chat.researchMode = true
    const w = mountC()
    await w.vm.$nextTick()
    await w.find('[data-test="research-depth-toggle"]').trigger('click')
    const hints = w.findAll('.rs-opt-hint').map((b) => b.text())
    expect(hints[0]).toContain('3 sub-questions')
    expect(hints[0]).toContain('2 sources each')
    expect(hints[1]).toContain('6 sub-questions')
    expect(hints[1]).toContain('4 sources each')
    expect(hints[2]).toContain('12 sub-questions')
    expect(hints[2]).toContain('8 sources each')
  })

  it('the × on the chip turns the mode off', async () => {
    const chat = useChatStore()
    chat.researchMode = true
    const w = mountC()
    await w.vm.$nextTick()
    await w.find('.research-chip .canvas-chip-x').trigger('click')
    expect(chat.researchMode).toBe(false)
  })

  it('the menu badge shows WHICH depth is armed, not just "On"', async () => {
    const chat = useChatStore()
    chat.researchMode = true
    chat.researchDepth = 'quick'
    const w = await openMenu(mountC())
    expect(w.find('[data-test="plus-deep-research"] .plus-badge').text()).toBe('Quick')
  })
})
