// @vitest-environment jsdom
// The inline edit's prompt and its Accept / Reject / Retry (ADM-1315): Enter sends, Shift+Enter is a new line, Escape
// closes (or rejects a change), no key reaches the editor under it, every icon button has a name and a tooltip, the
// change is announced ("Suggested change ready") and its code is there for a screen reader, the cost is what the person
// pays from their balance.
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import InlineEditWidget from './InlineEditWidget.vue'

function widget(props = {}) {
  return mount(InlineEditWidget, {
    attachTo: document.body,
    props: { startLine: 3, endLine: 4, ...props },
    global: { stubs: { Icon: true } },
  })
}
const press = (el, key, o = {}) => el.trigger('keydown', { key, ...o })

describe('InlineEditWidget', () => {
  it('opens with the box focused, labelled with the lines', async () => {
    const w = widget()
    await flushPromises()
    const input = w.find('[data-test="ie-input"]')
    expect(document.activeElement).toBe(input.element)
    expect(w.find(`label[for="${input.attributes('id')}"]`).text()).toBe('What should change in lines 3–4?')
    expect(w.attributes('aria-label')).toBe('Edit lines 3–4 with the Coding Agent')
    w.unmount()
  })

  it('Enter sends the words, Shift+Enter does not, an empty box sends nothing', async () => {
    const w = widget()
    const input = w.find('[data-test="ie-input"]')
    await press(input, 'Enter')
    expect(w.emitted('send')).toBeUndefined()
    await input.setValue('  use const  ')
    await press(input, 'Enter', { shiftKey: true })
    expect(w.emitted('send')).toBeUndefined()
    await press(input, 'Enter')
    expect(w.emitted('send')).toEqual([['use const']])
    w.unmount()
  })

  it('no key reaches the editor under it', async () => {
    const w = widget()
    let reached = 0
    const outer = (e) => { if (w.element.contains(e.target)) reached++ }
    document.body.addEventListener('keydown', outer)
    await press(w.find('[data-test="ie-input"]'), 'k', { ctrlKey: true })
    await press(w.find('[data-test="ie-input"]'), 'Tab')
    document.body.removeEventListener('keydown', outer)
    expect(reached).toBe(0)
    w.unmount()
  })

  it('Escape closes the prompt, and rejects a change that is shown', async () => {
    const w = widget()
    await press(w.find('[data-test="ie-input"]'), 'Escape')
    expect(w.emitted('close')).toHaveLength(1)
    await w.setProps({ state: 'ready', original: 'let a = 1', replacement: 'const a = 1' })
    await press(w.find('[data-test="ie-accept"]'), 'Escape')
    expect(w.emitted('reject')).toHaveLength(1)
    w.unmount()
  })

  it('running: the box waits, the send button gives way to a status', async () => {
    const w = widget({ state: 'running', instruction: 'use const' })
    expect(w.find('[data-test="ie-input"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="ie-send"]').exists()).toBe(false)
    expect(w.find('[data-test="ie-busy"]').text()).toContain('Making the change')
    expect(w.find('[data-test="ie-status"]').text()).toBe('Making the change.')
    w.unmount()
  })

  it('ready: the change is announced, Accept takes the focus, the code is read out, the price is shown', async () => {
    const w = widget({ instruction: 'use const' })
    await w.setProps({ state: 'ready', original: 'let a = 1\nlet b = 2', replacement: 'const a = 1\nconst b = 2',
      usage: { cost_usd: 0.002, price_usd: 0.0024 } })
    await flushPromises()
    const status = w.find('[data-test="ie-status"]')
    expect(status.attributes('role')).toBe('status')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toBe('Suggested change ready: 2 lines become 2 lines. Accept, Reject or Retry.')
    expect(document.activeElement).toBe(w.find('[data-test="ie-accept"]').element)
    expect(w.find('[data-test="ie-sr-code"]').text()).toContain('const a = 1\nconst b = 2')
    expect(w.find('[data-test="ie-cost"]').text()).toBe('$0.002, paid from your balance')
    for (const t of ['ie-accept', 'ie-reject', 'ie-retry', 'ie-close']) {
      const b = w.find(`[data-test="${t}"]`)
      expect(b.attributes('aria-label')).toBeTruthy()
      expect(b.attributes('title')).toBeTruthy()
    }
    await w.find('[data-test="ie-accept"]').trigger('click')
    await w.find('[data-test="ie-reject"]').trigger('click')
    await w.find('[data-test="ie-retry"]').trigger('click')
    expect(w.emitted('accept')).toHaveLength(1)
    expect(w.emitted('reject')).toHaveLength(1)
    expect(w.emitted('send')).toEqual([['use const']])
    w.unmount()
  })

  it('error: said as an alert, with what the agent said and a Retry', async () => {
    const w = widget({ state: 'error', instruction: 'x', error: 'The Coding Agent did not return a change.',
      detail: 'I need more context.' })
    expect(w.find('[data-test="ie-error"]').attributes('role')).toBe('alert')
    expect(w.text()).toContain('The Coding Agent did not return a change.')
    expect(w.text()).toContain('I need more context.')
    await w.find('[data-test="ie-error-retry"]').trigger('click')
    expect(w.emitted('send')).toEqual([['x']])
    w.unmount()
  })
})
