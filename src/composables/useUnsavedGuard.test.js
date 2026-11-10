// @vitest-environment jsdom
// ADM-1200: unsaved edits were dropped without a question when leaving the project, the page or the browser tab.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'

const confirmMock = vi.fn()
vi.mock('@/composables/useConfirm', () => ({ confirm: (...a) => confirmMock(...a) }))
let routeLeave = null
vi.mock('vue-router', () => ({ onBeforeRouteLeave: (fn) => { routeLeave = fn } }))

import { useUnsavedGuard, unsavedQuestion } from './useUnsavedGuard'

function mountWith(count) {
  let guard
  const C = defineComponent({ setup() { guard = useUnsavedGuard(() => count.value); return () => h('div') } })
  const w = mount(C)
  return { w, guard: () => guard }
}

beforeEach(() => { confirmMock.mockReset(); routeLeave = null })

describe('useUnsavedGuard', () => {
  it('leaves at once when nothing is unsaved', async () => {
    const { w, guard } = mountWith(ref(0))
    expect(await guard().mayLeave()).toBe(true)
    expect(await routeLeave()).toBe(true)
    expect(confirmMock).not.toHaveBeenCalled()
    w.unmount()
  })

  it('asks before leaving with unsaved files, and stays when the person says Stay', async () => {
    const count = ref(2)
    const { w, guard } = mountWith(count)
    confirmMock.mockResolvedValueOnce(false)
    expect(await guard().mayLeave()).toBe(false)
    expect(confirmMock).toHaveBeenCalledWith(unsavedQuestion(2))
    confirmMock.mockResolvedValueOnce(true)
    expect(await routeLeave()).toBe(true)
    w.unmount()
  })

  it('makes the browser ask before the tab closes, only while something is unsaved', () => {
    const count = ref(1)
    const { w } = mountWith(count)
    const ev = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    count.value = 0
    const ev2 = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev2)
    expect(ev2.defaultPrevented).toBe(false)
    w.unmount()
    count.value = 3
    const ev3 = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev3)
    expect(ev3.defaultPrevented).toBe(false)          // removed with the page
  })

  it('names one file or several', () => {
    expect(unsavedQuestion(1).title).toBe('Leave with an unsaved file?')
    expect(unsavedQuestion(3).title).toBe('Leave with 3 unsaved files?')
  })
})
