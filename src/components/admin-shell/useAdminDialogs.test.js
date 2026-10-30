// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { useAdminDialogs } from './useAdminDialogs'

describe('Admin dialog focus', () => {
  it('keeps keyboard focus inside a dialog and returns it after cancellation', async () => {
    const visible = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width:100, height:40 }])
    const host = mount({ setup() { useAdminDialogs(); return {} }, template:'<div><button id="open-dialog">Open</button></div>' }, { attachTo:document.body })
    const trigger=host.get('button').element;trigger.focus()
    const overlay=document.createElement('div');overlay.className='admin-overlay'
    overlay.innerHTML='<div class="admin-dialog" role="dialog" tabindex="-1"><button id="cancel-dialog">Cancel</button><button id="save-dialog">Save</button></div>'
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()})
    document.body.appendChild(overlay);await flushPromises()
    const panel=overlay.querySelector('.admin-dialog'),first=overlay.querySelector('#cancel-dialog'),last=overlay.querySelector('#save-dialog')
    expect(document.activeElement).toBe(panel)
    panel.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}))
    expect(document.activeElement).toBe(first)
    last.focus();last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}))
    expect(document.activeElement).toBe(first)
    first.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}))
    expect(document.activeElement).toBe(last)
    last.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await flushPromises()
    expect(document.activeElement).toBe(trigger)
    host.unmount();visible.mockRestore()
  })
})
