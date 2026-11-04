// "My templates": a person's own saved directions on their account (owner's delegate, 2026-11-04).
// GET /api/video/templates/ -> {templates: [row]} newest first; POST creates (201 row), PATCH /<id>/ changes any field
// (row), DELETE /<id>/ (204). A row is {id, page, base_look, title, prompt, variables: {name: text},
// settings: {aspect_ratio?, duration?, resolution?, sound?, n?}, created_at, updated_at}. Another person's id is 404.
// Errors are {error: {code, message, field}}. Using a template only fills a page: nothing here sends, runs or spends.
import { inject, provide, ref, watch } from 'vue'
import api from '../services/api'
import { notify } from './useNotify'
import { composePreset } from '../services/studioPresets'
const key = Symbol('studio-templates')
export const TEMPLATE_TITLE_MAX = 80, TEMPLATE_PROMPT_MAX = 4000
const SETTINGS = { aspect_ratio: 'string', duration: 'number', resolution: 'string', sound: 'boolean', n: 'number' }
const refusal = (err, fallback) => err?.response?.data?.error?.message || fallback
const notFound = err => err?.response?.status === 404 || err?.response?.data?.error?.code === 'not_found'
const GONE = 'This template is no longer on your account.'

// Only the settings the backend keeps, with their own types.
export function templateSettings(source) {
  const out = {}
  for (const [name, type] of Object.entries(SETTINGS)) {
    const value = source?.[name]
    if (typeof value === type && value !== '' && (type !== 'number' || Number.isFinite(value))) out[name] = value
  }
  return out
}
function row(value) {
  if (!value || typeof value !== 'object' || value.id == null) return null
  const variables = {}
  if (value.variables && typeof value.variables === 'object' && !Array.isArray(value.variables)) for (const [name, text] of Object.entries(value.variables)) if (typeof text === 'string') variables[name] = text
  return { id: value.id, page: String(value.page || ''), base_look: value.base_look ? String(value.base_look) : '', title: String(value.title || ''),
    prompt: String(value.prompt || ''), variables, settings: templateSettings(value.settings), created_at: value.created_at || '', updated_at: value.updated_at || '' }
}
const rows = list => Array.isArray(list) ? list.map(row).filter(Boolean) : []

export function provideStudioTemplates(user) {
  const templates = ref([]), ready = ref(false), loading = ref(false), error = ref('')
  // A change of signed-in person starts a new sequence: an answer for the previous person is dropped.
  let sequence = 0
  async function load(person) {
    const seq = ++sequence
    templates.value = []; ready.value = false; error.value = ''; loading.value = !!person
    if (!person) return
    try {
      const { data } = await api.get('/video/templates/')
      if (seq !== sequence) return
      templates.value = rows(data?.templates); ready.value = true
    } catch (err) {
      if (seq === sequence) error.value = refusal(err, 'Could not load your templates.')
    } finally { if (seq === sequence) loading.value = false }
  }
  watch(() => user.value?.id, id => load(id ? String(id) : ''), { immediate: true })

  // Each call answers {ok, template?, error?, field?}; a refusal is also shown as a notification.
  function failed(err, fallback, seq) {
    if (seq !== sequence) return { ok: false, error: '' }
    const message = refusal(err, fallback)
    notify.error(message)
    return { ok: false, error: message, field: err?.response?.data?.error?.field || '' }
  }
  async function create({ page, title, prompt, base_look = '', variables = {}, settings = {} }) {
    const seq = sequence
    if (!user.value?.id) return { ok: false, error: 'Sign in to save a template.' }
    const body = { page, title: String(title || '').trim(), prompt: String(prompt || '').trim(), variables, settings: templateSettings(settings) }
    if (base_look) body.base_look = base_look
    if (!body.title || body.title.length > TEMPLATE_TITLE_MAX) return { ok: false, field: 'title', error: `Give the template a name of 1 to ${TEMPLATE_TITLE_MAX} characters.` }
    if (!body.prompt || body.prompt.length > TEMPLATE_PROMPT_MAX) return { ok: false, field: 'prompt', error: `The prompt must be 1 to ${TEMPLATE_PROMPT_MAX} characters to save it.` }
    try {
      const { data } = await api.post('/video/templates/', body)
      if (seq !== sequence) return { ok: false, error: '' }
      const saved = row(data)
      if (saved) templates.value = [saved, ...templates.value.filter(item => item.id !== saved.id)]
      return { ok: true, template: saved }
    } catch (err) { return failed(err, 'Could not save your template.', seq) }
  }
  function drop(id) { templates.value = templates.value.filter(item => item.id !== id) }
  async function rename(id, title) {
    const seq = sequence, name = String(title || '').trim()
    if (!name || name.length > TEMPLATE_TITLE_MAX) return { ok: false, field: 'title', error: `Give the template a name of 1 to ${TEMPLATE_TITLE_MAX} characters.` }
    try {
      const { data } = await api.patch(`/video/templates/${encodeURIComponent(id)}/`, { title: name })
      if (seq !== sequence) return { ok: false, error: '' }
      const saved = row(data)
      if (saved) templates.value = templates.value.map(item => item.id === id ? saved : item)
      return { ok: true, template: saved }
    } catch (err) {
      if (seq === sequence && notFound(err)) { drop(id); notify.error(GONE); return { ok: false, error: GONE } }
      return failed(err, 'Could not rename your template.', seq)
    }
  }
  async function remove(id) {
    const seq = sequence
    try {
      await api.delete(`/video/templates/${encodeURIComponent(id)}/`)
      if (seq === sequence) drop(id)
      return { ok: seq === sequence }
    } catch (err) {
      // Already gone (or never this person's): the list no longer shows it either way.
      if (seq === sequence && notFound(err)) { drop(id); return { ok: true } }
      return failed(err, 'Could not delete your template.', seq)
    }
  }
  const find = id => templates.value.find(item => String(item.id) === String(id)) || null
  const studio = { templates, ready, loading, error, create, rename, remove, find, reload: () => load(user.value?.id ? String(user.value.id) : '') }
  provide(key, studio); return studio
}
const idle = { templates: ref([]), ready: ref(false), loading: ref(false), error: ref(''), async create() { return { ok: false, error: 'Templates are not available here.' } }, async rename() { return { ok: false } }, async remove() { return { ok: false } }, find: () => null, reload() {} }
export function useStudioTemplates() { return inject(key, idle) }

// The look a template fills its page with: its look's own variables with the template's texts. The look keeps
// its prompt pattern when that gives the template's prompt; otherwise the template's prompt is the pattern.
// With no look of its own (or one this build no longer has), the template's prompt and texts are the whole brief.
export function templateLook(template, base = null) {
  if (!template) return null
  if (!base) return { id: '', feature: template.page, title: template.title, purpose: '', category: '', slots: [], settings: {}, variants: [],
    promptTemplate: template.prompt.replace(/[{}]/g, ''), variables: Object.entries(template.variables || {}).map(([label, text]) => ({ id: label, label, default: text })) }
  const variables = (base.variables || []).map(field => ({ ...field, default: Object.hasOwn(template.variables || {}, field.label) ? template.variables[field.label] : field.default }))
  const look = { ...base, variants: [], variables }
  if (composePreset(look).trim() !== template.prompt.trim()) look.promptTemplate = template.prompt.replace(/[{}]/g, '')
  return look
}
