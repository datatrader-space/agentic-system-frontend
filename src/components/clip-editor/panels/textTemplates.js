// Text templates (plan F28): title cards and lower thirds made of a text's style, animation and place. A few are
// platform-made; the person's own are kept on their account with their other Studio preferences
// (GET/PUT /api/video/preferences/, key `editor_text_templates`), so every device shows the same. A save that the
// server refuses is said, never kept only in this browser.
import { reactive } from 'vue'
import api from '../../../services/api'

export const MAX_TEMPLATES = 50
export const BUILT_IN_TEMPLATES = [
  { id: 'title-card', name: 'Title card', builtIn: true, text: 'Your title', x: 0.5, y: 0.45,
    style: { font: 'bebas-neue', size: 0.14, color: '#FFFFFF', align: 'center', letter_spacing: 0.05 }, anim: { in: { kind: 'pop', ms: 400 }, out: { kind: 'fade', ms: 300 } } },
  { id: 'lower-third', name: 'Lower third', builtIn: true, text: 'Name Surname', x: 0.3, y: 0.82,
    style: { font: 'inter', size: 0.05, color: '#FFFFFF', bold: true, align: 'left', box: '#000000B3', box_radius: 0.3 }, anim: { in: { kind: 'slide_right', ms: 400 }, out: { kind: 'fade', ms: 300 } } },
  { id: 'bold-caption', name: 'Bold caption', builtIn: true, text: 'Caption', x: 0.5, y: 0.8,
    style: { font: 'montserrat', size: 0.06, color: '#FFFFFF', bold: true, align: 'center', stroke_color: '#000000', stroke_width: 0.008 }, anim: { in: { kind: 'pop', ms: 200 } } },
  { id: 'quote', name: 'Quote', builtIn: true, text: '“A line worth remembering”', x: 0.5, y: 0.5,
    style: { font: 'playfair-display', size: 0.07, color: '#FFFFFF', italic: true, align: 'center', shadow_color: '#000000', shadow_x: 0.004, shadow_y: 0.004 }, anim: { in: { kind: 'fade', ms: 600 }, out: { kind: 'fade', ms: 600 } } },
  { id: 'note', name: 'Handwritten note', builtIn: true, text: 'Note to self', x: 0.5, y: 0.3,
    style: { font: 'caveat', size: 0.08, color: '#F5C76A', align: 'center' }, anim: { in: { kind: 'typewriter', ms: 1200 }, loop: { kind: 'float' } } },
]

// The parts of a text item a template carries.
export function templateOf(item, name) {
  return { id: `t${Date.now().toString(36)}`, name: String(name || '').trim().slice(0, 60), text: item.text, x: item.x, y: item.y,
    style: { ...item.style }, ...(item.anim ? { anim: JSON.parse(JSON.stringify(item.anim)) } : {}) }
}
export function applyTemplateChanges(t, { keepText = true } = {}) {
  return { style: { ...t.style }, anim: t.anim ? JSON.parse(JSON.stringify(t.anim)) : undefined, x: t.x, y: t.y, ...(keepText ? {} : { text: t.text }) }
}

const shared = reactive({ saved: [], loaded: false, busy: false, error: '' })
function errorText(e, fallback) { const d = e?.response?.data; return d?.error?.message || (typeof d?.error === 'string' ? d.error : '') || fallback }
export function useTextTemplates() {
  async function load() {
    if (shared.loaded) return
    try {
      const { data } = await api.get('/video/preferences/')
      shared.saved = Array.isArray(data?.editor_text_templates) ? data.editor_text_templates : []
      shared.loaded = true
    } catch (e) { shared.error = errorText(e, 'Your saved templates could not be read.') }
  }
  async function put(next, done) {
    shared.busy = true; shared.error = ''
    try {
      const { data } = await api.put('/video/preferences/', { editor_text_templates: next })
      shared.saved = Array.isArray(data?.editor_text_templates) ? data.editor_text_templates : next
      return done
    } catch (e) { shared.error = errorText(e, 'The template could not be saved.'); return '' }
    finally { shared.busy = false }
  }
  function save(t) {
    if (!t.name) { shared.error = 'Give the template a name.'; return Promise.resolve('') }
    if (shared.saved.length >= MAX_TEMPLATES) { shared.error = `You can keep ${MAX_TEMPLATES} templates. Remove one first.`; return Promise.resolve('') }
    return put([...shared.saved, t], `Template “${t.name}” saved`)
  }
  function remove(id) { return put(shared.saved.filter(t => t.id !== id), 'Template removed') }
  return { state: shared, load, save, remove }
}
