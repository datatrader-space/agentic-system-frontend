// @vitest-environment jsdom
// The shared canvas (ADM-1248): notes live in the Yjs document the y-websocket provider syncs; an editor adds, edits,
// colours and deletes them; a viewer never writes; another person's cursor shows with the name the server gave it;
// a refusal (4403) ends the connection with a reason instead of reconnecting.
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const providers = []
vi.mock('y-websocket', () => {
  class FakeAwareness {
    constructor() { this.states = new Map(); this.handlers = {}; this.local = null }
    setLocalState(s) { this.local = s }
    setLocalStateField(k, v) { this.local = { ...(this.local || {}), [k]: v } }
    getStates() { return this.states }
    on(e, fn) { this.handlers[e] = fn }
    emitChange() { this.handlers.change?.() }
  }
  class WebsocketProvider {
    constructor(url, room, doc) { this.url = url; this.room = room; this.doc = doc; this.awareness = new FakeAwareness(); this.handlers = {}; this.destroyed = false; providers.push(this) }
    on(e, fn) { this.handlers[e] = fn }
    emit(e, arg) { this.handlers[e]?.(arg) }
    disconnect() {}
    destroy() { this.destroyed = true }
  }
  return { WebsocketProvider }
})

import ProjectCanvas from './ProjectCanvas.vue'

describe('ProjectCanvas', () => {
  beforeEach(() => { providers.length = 0 })

  it('connects to the project room and lets an editor add, edit, colour and delete a note', async () => {
    const w = mount(ProjectCanvas, { props: { projectId: 'p1', canEdit: true }, attachTo: document.body })
    const p = providers[0]
    expect(p.url).toMatch(/\/ws\/video\/canvas$/); expect(p.room).toBe('p1')
    p.emit('status', { status: 'connected' }); await flushPromises()
    expect(w.get('[data-test="canvas-status"]').text()).toBe('Live')
    await w.get('[data-test="canvas-add"]').trigger('click'); await flushPromises()
    const cards = p.doc.getMap('cards')
    expect(cards.size).toBe(1)
    const [id] = [...cards.keys()]
    await w.get('[data-test="canvas-text"]').setValue('Open on the city')
    await w.get('[data-test="canvas-text"]').trigger('change'); await flushPromises()
    expect(cards.get(id).text).toBe('Open on the city')
    await w.get('button[aria-label="Make it green"]').trigger('click'); await flushPromises()
    expect(cards.get(id).color).toBe('green')
    await w.get('[data-test="canvas-delete"]').trigger('click'); await flushPromises()
    expect(cards.size).toBe(0)
    w.unmount()
    expect(p.destroyed).toBe(true)
  })

  it('shows what others wrote, checked, and never writes for a viewer', async () => {
    const w = mount(ProjectCanvas, { props: { projectId: 'p1', canEdit: false } })
    const p = providers[0]
    p.emit('status', { status: 'connected' })
    p.doc.getMap('cards').set('n1', { id: 'n1', x: -500, y: 99999, w: 2, h: 2, text: 'From Ben', color: 'javascript:alert(1)', kind: 'weird' })
    await flushPromises()
    const card = w.get('[data-test="canvas-card"]')
    expect(card.attributes('class')).toContain('plain')
    expect(card.attributes('class')).toContain('note')
    expect(card.attributes('style')).toContain('translate(0px, 1520px)')
    expect(w.get('[data-test="canvas-text"]').attributes('readonly')).toBeDefined()
    expect(w.find('[data-test="canvas-add"]').exists()).toBe(false)
    expect(w.find('[data-test="canvas-delete"]').exists()).toBe(false)
    expect(w.get('[data-test="canvas-readonly"]').text()).toContain('You can view this canvas')
    w.unmount()
  })

  it('shows another person with the name the server set, and their cursor', async () => {
    const w = mount(ProjectCanvas, { props: { projectId: 'p1', canEdit: true } })
    const p = providers[0]
    p.awareness.states.set(p.doc.clientID, { user: { name: 'Me' } })
    p.awareness.states.set(424242, { user: { id: 2, name: 'Ben Editor' }, cursor: { x: 120, y: 80 } })
    p.awareness.emitChange(); await flushPromises()
    expect(w.findAll('.pcv-people li')).toHaveLength(1)
    expect(w.get('.pcv-cursor').text()).toBe('Ben Editor')
    w.unmount()
  })

  it('stops with the reason when the server refuses access', async () => {
    const w = mount(ProjectCanvas, { props: { projectId: 'p1', canEdit: true } })
    providers[0].emit('closed', { code: 4403, reason: 'forbidden' }); await flushPromises()
    expect(w.get('[data-test="canvas-fatal"]').text()).toBe('You no longer have access to this canvas.')
    expect(w.find('[data-test="canvas-add"]').exists()).toBe(false)
    w.unmount()
  })

  it('places the storyboard scenes that are not on the board yet', async () => {
    const w = mount(ProjectCanvas, { props: { projectId: 'p1', canEdit: true, scenes: [{ scene_id: 's1', title: 'Opening' }, { scene_id: 's2', title: 'Ending' }] } })
    const p = providers[0]
    p.emit('status', { status: 'connected' }); await flushPromises()
    await w.get('[data-test="canvas-add-scenes"]').trigger('click'); await flushPromises()
    const cards = [...p.doc.getMap('cards').values()]
    expect(cards.map(c => [c.kind, c.scene_id, c.text])).toEqual([['scene', 's1', 'Opening'], ['scene', 's2', 'Ending']])
    expect(w.find('[data-test="canvas-add-scenes"]').exists()).toBe(false)
    w.unmount()
  })
})
