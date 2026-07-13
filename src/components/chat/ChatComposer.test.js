// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { notify } = vi.hoisted(() => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('../../composables/useNotify', () => ({ notify }))
// Speech is unsupported in tests (no mic) — the mic button is hidden.
vi.mock('../../composables/useSpeech', () => ({
  useSpeech: () => ({ supported: false, listening: { value: false }, toggle: vi.fn() }),
}))

import ChatComposer from './ChatComposer.vue'

const stubs = {
  AgentModePicker: { template: '<div class="mode-stub" />' },
  AddDocumentUrl: { template: '<div class="adu-stub" data-test="adu-stub" />' },
}

const mountC = (props = {}) =>
  mount(ChatComposer, { props: { agentId: 7, conversationId: 'c1', ...props }, global: { stubs } })

// Dispatch a real paste event on the textarea (jsdom's paste carries no clipboardData by default, so
// we attach a synthetic one). Dispatching directly means the component handler receives THIS event
// object — so our preventDefault spy is the one it calls. Returns the spy.
const dispatchPaste = async (w, { text = '', files = [] } = {}) => {
  const items = [
    ...(text ? [{ kind: 'string', type: 'text/plain' }] : []),
    ...files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })),
  ]
  const ev = new Event('paste', { bubbles: true, cancelable: true })
  ev.clipboardData = { items, getData: (t) => (t === 'text/plain' ? text : '') }
  const preventDefault = vi.fn()
  ev.preventDefault = preventDefault
  w.find('textarea').element.dispatchEvent(ev)
  await w.vm.$nextTick()
  return preventDefault
}

beforeEach(() => {
  // ChatComposer calls useCanvasStore() in setup — a fresh active Pinia is required per test.
  setActivePinia(createPinia())
  Object.values(notify).forEach((fn) => fn.mockClear())
})

describe('ChatComposer — "+" attachment menu', () => {
  it('menu is closed by default and toggles open on "+" click', async () => {
    const w = mountC()
    expect(w.find('[data-test="composer-plus-menu"]').exists()).toBe(false)
    await w.find('[data-test="composer-plus"]').trigger('click')
    expect(w.find('[data-test="composer-plus-menu"]').exists()).toBe(true)
    // both options render
    expect(w.find('[data-test="plus-add-files"]').exists()).toBe(true)
    expect(w.find('[data-test="plus-add-link"]').exists()).toBe(true)
  })

  it('clicking "+" again closes the menu', async () => {
    const w = mountC()
    const plus = w.find('[data-test="composer-plus"]')
    await plus.trigger('click')
    expect(w.find('[data-test="composer-plus-menu"]').exists()).toBe(true)
    await plus.trigger('click')
    expect(w.find('[data-test="composer-plus-menu"]').exists()).toBe(false)
  })

  it('Escape closes the menu', async () => {
    const w = mountC()
    await w.find('[data-test="composer-plus"]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="composer-plus-menu"]').exists()).toBe(false)
  })

  it('an outside click closes the menu', async () => {
    const w = mountC({ attachTo: document.body })
    await w.find('[data-test="composer-plus"]').trigger('click')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="composer-plus-menu"]').exists()).toBe(false)
    w.unmount()
  })

  it('"Add photos & files" opens the (hidden) native file picker and closes the menu', async () => {
    const w = mountC()
    await w.find('[data-test="composer-plus"]').trigger('click')
    const clickSpy = vi.spyOn(w.find('input[type="file"]').element, 'click').mockImplementation(() => {})
    await w.find('[data-test="plus-add-files"]').trigger('click')
    expect(clickSpy).toHaveBeenCalled()
    expect(w.find('[data-test="composer-plus-menu"]').exists()).toBe(false)
  })

  it('file input accepts any type (not image-only) so documents can be attached', () => {
    const w = mountC()
    expect(w.find('input[type="file"]').attributes('accept')).toBeUndefined()
  })

  it('selecting files emits "attach" with the FileList', async () => {
    const w = mountC()
    const input = w.find('input[type="file"]')
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    expect(w.emitted('attach')).toBeTruthy()
    expect(Array.from(w.emitted('attach')[0][0])[0].name).toBe('doc.pdf')
  })

  it('"Ask about a link" opens the URL importer (conversation scope)', async () => {
    const w = mountC()
    await w.find('[data-test="composer-plus"]').trigger('click')
    await w.find('[data-test="plus-add-link"]').trigger('click')
    expect(w.find('[data-test="composer-url-panel"]').exists()).toBe(true)
    expect(w.find('[data-test="adu-stub"]').exists()).toBe(true)
  })

  it('"Ask about a link" is disabled before a conversation exists', async () => {
    const w = mountC({ conversationId: null })
    await w.find('[data-test="composer-plus"]').trigger('click')
    expect(w.find('[data-test="plus-add-link"]').element.disabled).toBe(true)
  })
})

describe('ChatComposer — paste image', () => {
  it('a pasted image is attached as a file and never inlined as text', async () => {
    const w = mountC()
    const img = new File(['bytes'], 'image.png', { type: 'image/png' })
    const pd = await dispatchPaste(w, { files: [img] })
    expect(pd).toHaveBeenCalled()
    const attached = w.emitted('attach')
    expect(attached).toBeTruthy()
    const f = attached[0][0][0]
    expect(f.type).toBe('image/png')
    expect(f.name).toMatch(/^pasted-image-\d{8}-\d{6}\.png$/)
    // nothing dumped into the textarea
    expect(w.find('textarea').element.value).toBe('')
  })

  it('image + short text: image attaches, text is preserved in the box', async () => {
    const w = mountC()
    const img = new File(['bytes'], 'image.png', { type: 'image/png' })
    await dispatchPaste(w, { text: 'look here', files: [img] })
    expect(w.emitted('attach')).toBeTruthy()
    expect(w.find('textarea').element.value).toContain('look here')
  })
})

describe('ChatComposer — paste text', () => {
  it('short text pastes normally (no attach, no preventDefault)', async () => {
    const w = mountC()
    const pd = await dispatchPaste(w, { text: 'a short message' })
    expect(pd).not.toHaveBeenCalled()
    expect(w.emitted('attach')).toBeFalsy()
  })

  it('long pasted text (> char limit) becomes a .txt attachment, not inline', async () => {
    const w = mountC()
    const big = 'x'.repeat(8001)
    const pd = await dispatchPaste(w, { text: big })
    expect(pd).toHaveBeenCalled()
    const f = w.emitted('attach')[0][0][0]
    expect(f.name).toMatch(/^pasted-text-\d{8}-\d{6}\.txt$/)
    expect(f.type).toBe('text/plain')
    expect(notify.info).toHaveBeenCalledWith('Long pasted text was attached as a text file.')
    expect(w.find('textarea').element.value).toBe('')
  })

  it('many-line paste (> line limit) also becomes a .txt attachment', async () => {
    const w = mountC()
    const manyLines = Array.from({ length: 151 }, (_, i) => `line ${i}`).join('\n')
    const pd = await dispatchPaste(w, { text: manyLines })
    expect(pd).toHaveBeenCalled()
    expect(w.emitted('attach')[0][0][0].name).toMatch(/\.txt$/)
  })

  it('a fake/empty clipboard is handled safely (no throw, no attach)', async () => {
    const w = mountC()
    const ev = new Event('paste', { bubbles: true, cancelable: true })
    ev.clipboardData = null
    w.find('textarea').element.dispatchEvent(ev)
    await w.vm.$nextTick()
    expect(w.emitted('attach')).toBeFalsy()
  })
})

describe('ChatComposer — send', () => {
  it('Enter emits "send" with the trimmed draft', async () => {
    const w = mountC()
    const ta = w.find('textarea')
    await ta.setValue('  hello world  ')
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')[0]).toEqual(['hello world'])
  })
})
