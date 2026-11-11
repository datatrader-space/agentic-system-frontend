// @vitest-environment jsdom
// The one copy of how a chat composer takes files (ADM-1205 phase E): the picker, a pasted image, a long pasted
// text kept as a .txt file, and files dropped on the composer.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

vi.mock('./useNotify', () => ({ notify: { info: vi.fn() } }))
import { notify } from './useNotify'
import { useComposerAttachments, isLongText, stamp } from './useComposerAttachments'

const file = (name, type) => new File(['x'], name, { type })
const clip = ({ images = [], text = '' } = {}) => ({
  items: images.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })),
  getData: () => text,
})
const pasteEvent = (cd) => ({ clipboardData: cd, preventDefault: vi.fn() })
const dragEvent = (files = [], types = ['Files']) => ({ dataTransfer: { types, files, dropEffect: '' }, preventDefault: vi.fn() })

let attach, text, el, afterInsert, off, c
beforeEach(() => {
  vi.clearAllMocks()
  attach = vi.fn()
  text = ref('hello world')
  el = { selectionStart: 5, selectionEnd: 5 }
  afterInsert = vi.fn()
  off = false
  c = useComposerAttachments({ attach, inputEl: ref(el), text, afterInsert, disabled: () => off })
})

describe('useComposerAttachments', () => {
  it('the picker attaches what was chosen and lets the same file be picked again', () => {
    const e = { target: { files: [file('a.pdf', 'application/pdf')], value: 'C:\\fakepath\\a.pdf' } }
    c.onFiles(e)
    expect(attach).toHaveBeenCalledWith(e.target.files)
    expect(e.target.value).toBe('')
  })

  it('a pasted image is attached with a readable name; its text goes in at the cursor', async () => {
    const e = pasteEvent(clip({ images: [file('image.png', 'image/png')], text: ', dear' }))
    c.onPaste(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(attach.mock.calls[0][0][0].name).toMatch(/^pasted-image-\d{8}-\d{6}\.png$/)
    expect(text.value).toBe('hello, dear world')
    await nextTick()
    expect(el.selectionStart).toBe(11)
    expect(afterInsert).toHaveBeenCalled()
  })

  it('a long pasted text becomes a .txt file; a short one pastes as usual', () => {
    const long = 'x\n'.repeat(200)
    const e = pasteEvent(clip({ text: long }))
    c.onPaste(e)
    expect(attach.mock.calls[0][0][0].name).toMatch(/^pasted-text-.*\.txt$/)
    expect(notify.info).toHaveBeenCalled()
    const short = pasteEvent(clip({ text: 'short' }))
    c.onPaste(short)
    expect(short.preventDefault).not.toHaveBeenCalled()
    expect(attach).toHaveBeenCalledTimes(1)
    expect(isLongText('a'.repeat(8001))).toBe(true)
  })

  it('files dropped on the composer are attached; dragged text is left to the browser', () => {
    const f = [file('shot.png', 'image/png')]
    c.onDragEnter(dragEvent(f))
    expect(c.dragging.value).toBe(true)
    c.onDrop(dragEvent(f))
    expect(attach).toHaveBeenCalledWith(f)
    expect(c.dragging.value).toBe(false)
    const textDrag = dragEvent([], ['text/plain'])
    c.onDrop(textDrag)
    expect(textDrag.preventDefault).not.toHaveBeenCalled()
    expect(attach).toHaveBeenCalledTimes(1)
  })

  it('a disabled composer takes nothing', () => {
    off = true
    c.onFiles({ target: { files: [file('a.txt', 'text/plain')], value: 'x' } })
    c.onPaste(pasteEvent(clip({ images: [file('i.png', 'image/png')] })))
    c.onDrop(dragEvent([file('b.txt', 'text/plain')]))
    expect(attach).not.toHaveBeenCalled()
  })

  it('stamp is a sortable date-time', () => {
    expect(stamp(new Date(2026, 10, 12, 9, 5, 7))).toBe('20261112-090507')
  })
})
