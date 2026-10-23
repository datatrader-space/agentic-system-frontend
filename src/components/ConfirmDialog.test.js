// @vitest-environment jsdom
// F-H8: the confirm dialog sits above every modal, and Enter confirms ONLY from the confirm button.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { confirm, confirmState, _settleConfirm } from '../composables/useConfirm'

let wrapper
beforeEach(() => {
  document.body.innerHTML = ''
  wrapper = mount(ConfirmDialog, { attachTo: document.body })
})
afterEach(() => {
  if (confirmState.open) _settleConfirm(false)
  wrapper.unmount()
})

const tick = async () => { await nextTick(); await nextTick() }
const press = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
const buttons = () => [...document.body.querySelectorAll('[role="alertdialog"] button')]
const confirmBtn = () => buttons().find((b) => b.textContent.trim() === confirmState.confirmText)
const cancelBtn = () => buttons().find((b) => b.textContent.trim() === confirmState.cancelText)

describe('ConfirmDialog', () => {
  it('stacks above HITLModal (9999) and the z-1000 backdrops', async () => {
    confirm('Sure?')
    await tick()
    const layer = document.body.querySelector('[role="alertdialog"]').parentElement
    expect(Number(layer.style.zIndex)).toBeGreaterThanOrEqual(10000)
  })

  it('Enter confirms when the confirm button has focus', async () => {
    const result = confirm({ message: 'Rename?' })
    await tick()
    expect(document.activeElement).toBe(confirmBtn())
    press('Enter')
    await expect(result).resolves.toBe(true)
  })

  it('Enter does NOT confirm when focus is elsewhere', async () => {
    let settled = null
    confirm({ message: 'Rename?' }).then((v) => { settled = v })
    await tick()
    cancelBtn().focus()
    press('Enter')
    await tick()
    expect(settled).toBe(null)
    expect(confirmState.open).toBe(true)
  })

  it('a destructive dialog opens with focus on Cancel, so a stray Enter never deletes', async () => {
    let settled = null
    confirm({ title: 'Delete organisation?', danger: true, confirmText: 'Delete' }).then((v) => { settled = v })
    await tick()
    expect(document.activeElement).toBe(cancelBtn())
    press('Enter')
    await tick()
    expect(settled).toBe(null)
  })

  it('Escape still cancels', async () => {
    const result = confirm('Sure?')
    await tick()
    press('Escape')
    await expect(result).resolves.toBe(false)
  })
})
