// @vitest-environment jsdom
// Phase 5 item 11: the Help Assistant widget is not loaded until the assistant is first opened, and a
// question asked from a page reaches it once it has loaded.
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const widget = vi.hoisted(() => ({ loads: 0, ask: null }))
vi.mock('./HelpAssistantWidget.vue', () => {
  widget.loads += 1
  return {
    __esModule: true,
    default: defineComponent({
      props: { open: Boolean, currentPage: String },
      setup(_p, { expose }) {
        widget.ask = vi.fn()
        expose({ ask: (q) => widget.ask(q) })
        return () => h('div', { class: 'widget' })
      },
    }),
  }
})
vi.mock('vue-router', () => ({ useRoute: () => ({ name: 'dashboard-home', path: '/dashboard' }) }))
vi.mock('@iconify/vue', () => ({ Icon: { render: () => null } }))

import GlobalHelpAssistant from './GlobalHelpAssistant.vue'
import { useHelpAssistant } from '../../composables/useHelpAssistant'

const settle = async () => { for (let i = 0; i < 6; i++) { await flushPromises(); await new Promise((r) => setTimeout(r, 0)) } }

describe('GlobalHelpAssistant', () => {
  it('loads the widget only when the assistant is opened, then hands it the question', async () => {
    const w = mount(GlobalHelpAssistant)
    await settle()
    expect(widget.loads).toBe(0)
    expect(w.find('.widget').exists()).toBe(false)

    useHelpAssistant().openAssistant('How do I add a tool?')
    await settle()
    expect(widget.loads).toBe(1)
    expect(w.find('.widget').exists()).toBe(true)
    expect(widget.ask).toHaveBeenCalledWith('How do I add a tool?')
  })
})
