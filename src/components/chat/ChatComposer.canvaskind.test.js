// @vitest-environment jsdom
//
// Canvas kind — Static · Next.js · Web Builder. The "+" menu owns the yes/no; the CHIP picks WHICH Canvas,
// because each kind gets a different toolset on the backend (agent/services/capability_modes.py
// canvas_tools_for): static builds plain files in a sandbox, nextjs scaffolds and serves a Next.js app in
// the same sandbox, web_builder edits a page on the user's Kurumera storefront. One boolean could not say
// which, so a Kurumera connector used to decide for the user.
//
// The values are pinned to the backend's closed vocabulary — an unknown value is ignored there, which
// would read in the product as "I picked Next.js and got something else".
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
import { useCanvasStore, CANVAS_KINDS } from '../../stores/useCanvasStore'
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

beforeEach(() => {
  try { localStorage.clear() } catch (_e) { /* jsdom */ }
  setActivePinia(createPinia())
  Object.values(notify).forEach((fn) => fn.mockClear())
})

describe('Canvas kind — the vocabulary', () => {
  it('matches the backend exactly, in the order the chip offers it', () => {
    expect(CANVAS_KINDS).toEqual(['static', 'nextjs', 'web_builder'])
  })

  it('defaults to static, the kind that needs nothing connected and runs no shell', () => {
    expect(useCanvasStore().kind).toBe('static')
  })

  it('remembers the pick, because it is a standing preference', () => {
    useCanvasStore().setKind('nextjs')
    expect(localStorage.getItem('cv.kind')).toBe('nextjs')
    setActivePinia(createPinia())
    expect(useCanvasStore().kind).toBe('nextjs')
  })

  it('ignores a value the backend would not recognise', () => {
    const canvas = useCanvasStore()
    canvas.setKind('wordpress')
    expect(canvas.kind).toBe('static')
  })

  it('a corrupted saved value falls back rather than being sent', () => {
    localStorage.setItem('cv.kind', 'root_shell')
    setActivePinia(createPinia())
    expect(useCanvasStore().kind).toBe('static')
  })
})

describe('Canvas kind — the chip', () => {
  it('is not shown while Canvas is off', () => {
    expect(mountC().find('[data-test="canvas-kind-toggle"]').exists()).toBe(false)
  })

  it('shows the current kind on the chip', async () => {
    const canvas = useCanvasStore()
    canvas.setMode(true)
    canvas.setKind('nextjs')
    const w = mountC()
    expect(w.find('[data-test="canvas-kind-toggle"]').text()).toContain('Next.js')
  })

  it('opens a menu offering all three kinds', async () => {
    useCanvasStore().setMode(true)
    const w = mountC()
    await w.find('[data-test="canvas-kind-toggle"]').trigger('click')
    for (const k of CANVAS_KINDS) {
      expect(w.find(`[data-test="canvas-kind-${k}"]`).exists()).toBe(true)
    }
  })

  it('picking one sets it, closes the menu and says what the agent will do', async () => {
    const canvas = useCanvasStore()
    canvas.setMode(true)
    const w = mountC()
    await w.find('[data-test="canvas-kind-toggle"]').trigger('click')
    await w.find('[data-test="canvas-kind-web_builder"]').trigger('click')
    expect(canvas.kind).toBe('web_builder')
    expect(w.find('[data-test="canvas-kind-menu"]').exists()).toBe(false)
    expect(notify.info.mock.calls[0][0]).toContain('Kurumera')
  })

  it('marks the current kind as the checked option', async () => {
    const canvas = useCanvasStore()
    canvas.setMode(true)
    canvas.setKind('nextjs')
    const w = mountC()
    await w.find('[data-test="canvas-kind-toggle"]').trigger('click')
    expect(w.find('[data-test="canvas-kind-nextjs"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[data-test="canvas-kind-static"]').attributes('aria-checked')).toBe('false')
  })

  it('Escape closes the menu', async () => {
    useCanvasStore().setMode(true)
    const w = mountC({}, { attachTo: document.body })
    await w.find('[data-test="canvas-kind-toggle"]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="canvas-kind-menu"]').exists()).toBe(false)
  })
})

describe('Canvas kind — what is sent', () => {
  it('goes with the message while Canvas is on', () => {
    const canvas = useCanvasStore()
    canvas.setMode(true)
    canvas.setKind('nextjs')
    expect(useChatStore()._canvasSendOpts()).toMatchObject({ canvasMode: true, canvasKind: 'nextjs' })
  })

  it('is not sent with Canvas off — a kind means nothing without it', () => {
    const canvas = useCanvasStore()
    canvas.setKind('nextjs')
    canvas.setMode(false)
    expect(useChatStore()._canvasSendOpts().canvasKind).toBeUndefined()
  })
})
