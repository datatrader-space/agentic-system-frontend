// @vitest-environment jsdom
// The bin (VIDEO_EDITOR_PRO_PLAN.md section 6): tabs by keyboard, Studio music apart from the person's sound, text
// templates, and the registry's effect and transition catalogues, each added with a button (no drag needed) or
// dragged with the payload the timeline reads.
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClipMediaBin from './ClipMediaBin.vue'
import { registry, setRegistry } from './registry'
// The server's registry, as `manage.py editor_registry_export` writes it; the page reads it before the panels show.
import registryFixture from './__fixtures__/registry.json'
setRegistry(registryFixture)
import { DRAG_TYPE } from './panels/panelModel'
import { useTextTemplates } from './panels/textTemplates'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: { editor_text_templates: [] } })), post: vi.fn(), put: vi.fn() } }))

const project = { assets: [
  { attachment_id: 'v1', media_type: 'video', role: 'edit_source' }, { attachment_id: 's1', media_type: 'audio', role: 'music' },
  { attachment_id: 's2', media_type: 'audio', role: 'edit_source' }] }
const media = { v1: { state: 'ready', media_type: 'video', name: 'beach.mp4', duration_ms: 5000 }, s1: { state: 'ready', media_type: 'audio', name: 'Theme' }, s2: { state: 'ready', media_type: 'audio', name: 'voice.wav' } }
const mountIt = (props = {}) => mount(ClipMediaBin, { props: { projectId: 'p1', project, media, ...props }, attachTo: document.body, global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, VideoLibrary: true } } })

beforeEach(() => { const t = useTextTemplates().state; t.saved = []; t.loaded = false })

describe('ClipMediaBin', () => {
  it('moves between its tabs with the arrow keys', async () => {
    const w = mountIt()
    expect(w.findAll('[role="tab"]').map(t => t.text())).toEqual(['Media', 'Text', 'Audio', 'Effects', 'Transitions'])
    await w.get('[role="tablist"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(w.get('[aria-selected="true"]').text()).toBe('Transitions')
    await w.get('[role="tablist"]').trigger('keydown', { key: 'Home' })
    expect(w.get('[aria-selected="true"]').text()).toBe('Media')
    expect(w.findAll('.cb-file').map(f => f.text())).toEqual([expect.stringContaining('beach.mp4')])
  })

  it('shows Studio music apart from the person\'s own sound', async () => {
    const w = mountIt()
    await w.get('[data-test="bin-tab-audio"]').trigger('click')
    const groups = w.findAll('ul.cb-files')
    expect(groups[0].text()).toContain('Theme')
    expect(groups[1].text()).toContain('voice.wav')
    await groups[1].get('button').trigger('click')
    expect(w.emitted('add')[0][0]).toMatchObject({ attachment_id: 's2' })
  })

  it('adds a text template, an effect and a transition with a button, and drags them with the timeline payload', async () => {
    const w = mountIt({ canApply: true, canJoin: false })
    await w.get('[data-test="bin-tab-text"]').trigger('click')
    await w.get('[data-test="bin-text-lower-third"] button').trigger('click')
    expect(w.emitted('add-text')[0][0]).toMatchObject({ id: 'lower-third', name: 'Lower third' })
    await w.get('[data-test="bin-tab-effects"]').trigger('click')
    expect(w.findAll('[data-test^="bin-effect-"]')).toHaveLength(Object.keys(registry().effects).length)
    await w.get('[data-test="bin-effect-blur"] button').trigger('click')
    expect(w.emitted('add-effect')[0]).toEqual(['blur'])
    const setData = vi.fn()
    await w.get('[data-test="bin-effect-vignette"]').trigger('dragstart', { dataTransfer: { setData, effectAllowed: '' } })
    expect(setData).toHaveBeenCalledWith(DRAG_TYPE, JSON.stringify({ kind: 'effect', id: 'vignette' }))
    await w.get('[data-test="bin-tab-transitions"]').trigger('click')
    expect(w.findAll('[data-test^="bin-transition-"]')).toHaveLength(20)
    expect(w.get('[data-test="bin-transition-circle_open"] button').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Select a video clip that meets the next one')
    await w.setProps({ canJoin: true })
    await w.get('[data-test="bin-transition-circle_open"] button').trigger('click')
    expect(w.emitted('add-transition')[0]).toEqual(['circle_open'])
  })
})
