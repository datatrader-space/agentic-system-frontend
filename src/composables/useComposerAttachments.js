// How every chat composer takes files (the main chat's ChatComposer and ChatWelcome, and the Let's Code chat): the
// file picker, a pasted image, a long pasted text kept as a .txt file, and files dropped on the composer. One copy
// (ADM-1205 phase E; the two main-chat composers each had their own until then). The files go to the chat store's
// addAttachments, which uploads them when the message is sent.
import { ref, nextTick } from 'vue'
import { notify } from './useNotify'

// Long pasted text becomes a .txt attachment instead of a giant inline blob (which would bloat the prompt and can't
// be retrieved/cited). Generous on purpose: normal messages, short snippets and small code blocks paste normally.
export const LONG_PASTE_CHAR_LIMIT = 8000
export const LONG_PASTE_LINE_LIMIT = 150

export const isLongText = (text) =>
  text.length > LONG_PASTE_CHAR_LIMIT || text.split('\n').length > LONG_PASTE_LINE_LIMIT

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// Images on the clipboard, as files with a stable, human name (screenshots arrive as a generic "image.png").
export function clipboardImages(cd) {
  const out = []
  for (const item of Array.from(cd?.items || [])) {
    if (item.kind === 'file' && /^image\//.test(item.type || '')) {
      const f = item.getAsFile()
      if (!f) continue
      const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
      out.push(new File([f], `pasted-image-${stamp()}.${ext}`, { type: f.type || 'image/png' }))
    }
  }
  return out
}

const hasFiles = (e) => Array.from(e?.dataTransfer?.types || []).includes('Files')

/**
 * @param {object} opts
 * @param {(files: File[] | FileList) => void} opts.attach  where files go (the chat store's addAttachments, or emit)
 * @param {import('vue').Ref<HTMLTextAreaElement|null>} opts.inputEl  the composer's text box
 * @param {import('vue').Ref<string>} opts.text             the text box's model
 * @param {() => void} [opts.afterInsert]                   after pasted text went in (the box grows)
 * @param {() => boolean} [opts.disabled]                   true while the composer takes nothing
 */
export function useComposerAttachments({ attach, inputEl, text, afterInsert = () => {}, disabled = () => false }) {
  const dragging = ref(false)
  let depth = 0

  // Pasted text that comes with an image goes where the cursor is, and the cursor after it.
  function insertText(pasted) {
    const el = inputEl?.value
    const current = String(text.value ?? '')
    if (!el) { text.value = current + pasted; nextTick(afterInsert); return }
    const start = el.selectionStart ?? current.length
    const end = el.selectionEnd ?? current.length
    text.value = current.slice(0, start) + pasted + current.slice(end)
    nextTick(() => {
      afterInsert()
      const pos = start + pasted.length
      try { el.selectionStart = el.selectionEnd = pos } catch { /* the box went away */ }
    })
  }

  const attachLongText = (text) => {
    attach([new File([text], `pasted-text-${stamp()}.txt`, { type: 'text/plain' })])
    notify.info('Long pasted text was attached as a text file.')
  }

  // The hidden <input type="file" multiple>.
  function onFiles(e) {
    const files = e.target.files
    if (!disabled() && files && files.length) attach(files)
    e.target.value = ''                        // the same file can be picked again
  }

  // A clipboard image is attached (never base64 in the box); a long text becomes a .txt; anything else pastes.
  function onPaste(e) {
    if (disabled()) return
    const cd = e.clipboardData || window.clipboardData
    if (!cd) return
    let images = []
    try { images = clipboardImages(cd) } catch { images = [] }
    const text = (() => { try { return cd.getData('text/plain') || '' } catch { return '' } })()
    const longText = text && isLongText(text)
    if (images.length) {
      e.preventDefault()
      attach(images)
      if (longText) attachLongText(text)
      else if (text) insertText(text)
      return
    }
    if (longText) {
      e.preventDefault()
      attachLongText(text)
    }
  }

  // Files dragged onto the composer. Only a drag that carries files is taken; dragged text is left to the browser.
  function onDragEnter(e) {
    if (disabled() || !hasFiles(e)) return
    e.preventDefault()
    depth += 1
    dragging.value = true
  }
  function onDragOver(e) {
    if (disabled() || !hasFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }
  function onDragLeave(e) {
    if (!hasFiles(e)) return
    depth = Math.max(0, depth - 1)
    if (!depth) dragging.value = false
  }
  function onDrop(e) {
    if (!hasFiles(e)) return
    e.preventDefault()
    depth = 0
    dragging.value = false
    if (disabled()) return
    const files = e.dataTransfer?.files
    if (files && files.length) attach(files)
  }

  return { dragging, onFiles, onPaste, onDragEnter, onDragOver, onDragLeave, onDrop }
}
