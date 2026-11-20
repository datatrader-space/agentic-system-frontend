// @vitest-environment jsdom
// The builder's toolbar follows the person's role on the workflow (ADM-1339): a control the role cannot use is not
// shown. The server refuses those requests anyway; this only keeps the page from offering them.
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import WfToolbar from './WfToolbar.vue'

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

async function mountBar(props = {}) {
  wrapper = mount(WfToolbar, { attachTo: document.body, props: { name: 'Customer intake', status: 'published', version: 2, ...props } })
  await nextTick()
  return wrapper
}
const named = () => [...document.body.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent.trim())
async function menuItems() {
  const trigger = wrapper.find('[aria-label="More workflow actions"]')
  // Reka's menu opens on pointerdown (or keyboard); the test opens it from the keyboard.
  await trigger.trigger('keydown', { key: 'Enter' })
  await flushPromises()
  await nextTick()
  return [...document.body.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent.replace(/(Ctrl|⌘)\+S|\?/g, '').trim())
}

describe('WfToolbar roles', () => {
  it('the owner has every control, Share and Archive included, and no role pill', async () => {
    await mountBar({ role: 'owner', dirty: true, saveState: 'dirty' })
    expect(named()).toEqual(expect.arrayContaining(['Add a step', 'Undo', 'Redo', 'Tidy up', 'Test', 'Run', 'Publish']))
    expect(document.body.querySelector('.wfb-pill.is-role')).toBeNull()
    const items = await menuItems()
    expect(items).toEqual(expect.arrayContaining(['Save', 'Discard changes', 'Validate', 'Versions', 'Pause triggers', 'Share', 'Duplicate workflow', 'Archive workflow']))
  })

  it('an editor has everything except Share and Archive', async () => {
    await mountBar({ role: 'editor' })
    expect(named()).toEqual(expect.arrayContaining(['Add a step', 'Test', 'Run', 'Publish']))
    expect(document.body.querySelector('.wfb-pill.is-role').textContent).toBe('Your role: Editor')
    const items = await menuItems()
    expect(items).toEqual(expect.arrayContaining(['Save', 'Validate', 'Pause triggers', 'Duplicate workflow']))
    expect(items).not.toContain('Share')
    expect(items).not.toContain('Archive workflow')
  })

  it('a runner may Test and Run, and nothing that edits', async () => {
    await mountBar({ role: 'runner' })
    const buttons = named()
    expect(buttons).toEqual(expect.arrayContaining(['Test', 'Run', 'Fit the workflow in view']))
    for (const b of ['Add a step', 'Undo', 'Redo', 'Tidy up', 'Publish', 'Rename workflow']) expect(buttons.join('|')).not.toContain(b)
    expect(document.body.querySelector('.wfb-name').tagName).toBe('SPAN')
    const items = await menuItems()
    expect(items).toEqual(['Versions', 'Duplicate workflow', 'Outline', 'Shortcuts', 'Help'])
  })

  it('a viewer sees the workflow only: no Test, Run, Stop or edit control', async () => {
    await mountBar({ role: 'viewer', running: true })
    const buttons = named()
    for (const b of ['Add a step', 'Test', 'Run', 'Stop', 'Publish']) expect(buttons).not.toContain(b)
    expect(document.body.textContent).not.toContain('Saved')
    expect(document.body.querySelector('.wfb-pill.is-role').getAttribute('title')).toContain('Shared with you as Viewer.')
    const items = await menuItems()
    expect(items).toEqual(['Versions', 'Duplicate workflow', 'Outline', 'Shortcuts', 'Help'])
  })

  it('the phone-width menu follows the role too', async () => {
    await mountBar({ role: 'runner', compact: true })
    const items = await menuItems()
    expect(items).toContain('Test')
    expect(items).not.toContain('Publish')
    expect(items).not.toContain('Add a step')
  })
})
