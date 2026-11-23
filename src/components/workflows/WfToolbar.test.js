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

describe('WfToolbar in a frame workflow (ADM-1351)', () => {
  it('keeps Run in place but aria-disabled and described by the page note; Test stays; pressing Run still asks the page', async () => {
    const note = 'Runs on each frame of a stream: start a stream with it in Training Data.'
    await mountBar({ role: 'owner', runBlocked: note, runBlockedBy: 'wfb-frame-note' })
    const run = [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Run')
    expect(run.getAttribute('aria-disabled')).toBe('true')
    expect(run.getAttribute('aria-describedby')).toBe('wfb-frame-note')
    expect(run.getAttribute('title')).toBe(note)
    expect(run.classList.contains('is-blocked')).toBe(true)
    expect(run.disabled).toBe(false)
    const test = [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Test')
    expect(test.disabled).toBe(false)
    expect(test.getAttribute('title')).toBe('Test on a photo that stands in for a camera frame')
    run.click()
    expect(wrapper.emitted('run')).toHaveLength(1)
  })

  it('an ordinary workflow has a plain Run', async () => {
    await mountBar({ role: 'owner' })
    const run = [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Run')
    expect(run.hasAttribute('aria-disabled')).toBe(false)
    expect(run.hasAttribute('aria-describedby')).toBe(false)
  })
})
