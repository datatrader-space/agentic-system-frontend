// @vitest-environment jsdom
// F14 (ADM-1333): "Copied" only after the clipboard write resolves; otherwise the error and a selectable field.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import InboundUrl from './InboundUrl.vue'

let wrapper
const realClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
function setClipboard(value) { Object.defineProperty(navigator, 'clipboard', { value, configurable: true }) }
afterEach(() => {
  wrapper?.unmount(); wrapper = null
  if (realClipboard) Object.defineProperty(navigator, 'clipboard', realClipboard)
  else delete navigator.clipboard
})

describe('InboundUrl (F14)', () => {
  it('before the first save there is no address and no Copy button', () => {
    wrapper = mount(InboundUrl, { props: { path: '', label: 'Endpoint address' } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Save the workflow to get the address.')
  })

  it('says "Copied" only after writeText resolves, and copies the full address', async () => {
    let resolve
    const writeText = vi.fn(() => new Promise((r) => { resolve = r }))
    setClipboard({ writeText })
    wrapper = mount(InboundUrl, { props: { path: '/api/workflow-graph-hooks/abc/', label: 'Endpoint address', method: 'POST' } })
    await wrapper.get('button').trigger('click')
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/api/workflow-graph-hooks/abc/`)
    expect(wrapper.text()).not.toContain('Copied')
    resolve()
    await flushPromises()
    expect(wrapper.get('button').text()).toContain('Copied')
    expect(wrapper.get('[role="status"]').text()).toContain('on your clipboard')
  })

  it('a refused write shows the error and a selected read-only field, never "Copied"', async () => {
    setClipboard({ writeText: vi.fn(() => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }))) })
    wrapper = mount(InboundUrl, { props: { path: 'https://x.example/hook', label: 'Endpoint address' }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Copied')
    expect(wrapper.get('[role="alert"]').text()).toContain('refused access to the clipboard')
    const manual = wrapper.get('input[readonly]')
    expect(manual.element.value).toBe('https://x.example/hook')
    expect(document.activeElement).toBe(manual.element)
  })

  it('a browser with no clipboard says so instead of pretending', async () => {
    setClipboard(undefined)
    wrapper = mount(InboundUrl, { props: { path: '/hook/', label: 'Endpoint address' } })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Copied')
    expect(wrapper.get('[role="alert"]').text()).toContain('does not allow it')
  })
})
