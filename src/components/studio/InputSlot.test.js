// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import InputSlot from './InputSlot.vue'
const picker = { name: 'VideoLibrary', props: ['mode','initialTab','allowedKinds'], template: `<div><button @click="$emit('pick', { attachment_id: 7, title: 'Owned image', media_type: 'image' })">Pick image</button><button @click="$emit('pick-element', { files: [{ attachment_id: 8, media_type: 'video' }] })">Pick mixed Element</button></div>` }
describe('InputSlot', () => {
  it('advertises kinds and limits, validates drops, and retains current inputs on invalid additions', async () => {
    const w = mount(InputSlot, { props: { label: 'Your photo', kinds: ['image'], limit: 1 } })
    expect(w.text()).toContain('Optional'); expect(w.text()).toContain('up to 1')
    await w.get('.islot-drop').trigger('drop', { dataTransfer: { files: [new File(['x'],'clip.mp4',{ type: 'video/mp4' })] } })
    expect(w.get('[role="alert"]').text()).toContain('image files only'); expect(w.emitted('add-files')).toBeUndefined()
    const file = new File(['x'],'photo.png',{ type: 'image/png' })
    await w.get('.islot-drop').trigger('drop', { dataTransfer: { files: [file] } })
    expect(w.emitted('add-files')[0]).toEqual([[file]])
    await w.setProps({ items: [{ key: 'saved', name: 'Kept photo' }] })
    await w.get('.islot-drop').trigger('drop', { dataTransfer: { files: [file] } })
    expect(w.text()).toContain('Kept photo'); expect(w.get('[role="alert"]').text()).toContain('Remove a file')
    w.unmount()
  })
  it('uses the existing Library picker without creating a project or silently dropping Element files', async () => {
    const w = mount(InputSlot, { props: { label: 'Reference', kinds: ['image'], limit: 1 }, global: { stubs: { VideoLibrary: picker } } })
    await w.findAll('button').find(button => button.text() === 'From Elements').trigger('click'); await flushPromises()
    expect(w.findComponent(picker).props('mode')).toBe('picker')
    await w.findComponent(picker).findAll('button')[1].trigger('click')
    expect(w.emitted('pick')).toBeUndefined(); expect(w.get('[role="alert"]').text()).toContain('image files only')
    await w.findComponent(picker).findAll('button')[0].trigger('click')
    expect(w.emitted('pick')[0][0][0].attachment_id).toBe(7)
    w.unmount()
  })
  it('says "an image" and "an audio" file, not "a image" (live 2026-10-28)', () => {
    const w = mount(InputSlot, { props: { label: 'Overlay', kinds: ['image'], limit: 1, allowUpload: false } })
    expect(w.text()).toContain('Choose an image from your Library')
    const v = mount(InputSlot, { props: { label: 'Clip', kinds: ['video', 'audio'], limit: 1, allowUpload: false } })
    expect(v.text()).toContain('Choose a video or an audio file from your Library')
    w.unmount(); v.unmount()
  })
})
