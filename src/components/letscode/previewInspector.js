// The Preview tab's side of AADML's preview inspector (ADM-1318). The app's page carries a small script that AADML's
// inspector proxy puts in (backend agent/services/preview_inspector/inspector.js); it posts console messages, network
// requests and the element picked in select mode to this page. This page never reads the app's page.
//
// A message is taken ONLY when it comes from the preview frame's own window AND that frame's exact origin, and only
// in a known shape: each field is checked and copied into a new object (nothing is spread, nothing is evaluated, and
// the text is shown as text). Anything else is dropped without a word: the app on that origin can post too.

export const FROM_PAGE = 'aadml-preview'
export const TO_PAGE = 'aadml-editor'

// Common sizes (CSS pixels), portrait; a rotation swaps them. "Responsive" fills the panel.
export const DEVICES = [
  { id: 'responsive', label: 'Responsive', width: 0, height: 0 },
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
  { id: 'iphone-15', label: 'iPhone 15', width: 393, height: 852 },
  { id: 'pixel-8', label: 'Pixel 8', width: 412, height: 915 },
  { id: 'galaxy-s24', label: 'Galaxy S24', width: 360, height: 780 },
  { id: 'ipad-mini', label: 'iPad mini', width: 768, height: 1024 },
  { id: 'ipad-air', label: 'iPad Air', width: 820, height: 1180 },
  { id: 'laptop', label: 'Laptop', width: 1280, height: 800 },
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
  { id: 'full-hd', label: 'Full HD', width: 1920, height: 1080 },
]

// The device's size as shown, after a rotation; null for Responsive.
export function deviceSize(device, rotated) {
  if (!device || !device.width) return null
  return rotated ? { width: device.height, height: device.width } : { width: device.width, height: device.height }
}

// How much a device frame is scaled down to fit the panel (never up).
export function fitScale(size, room) {
  if (!size || !room || !(room.width > 0) || !(room.height > 0)) return 1
  return Math.min(1, room.width / size.width, room.height / size.height)
}

const LEVELS = new Set(['log', 'info', 'warn', 'error', 'debug'])
const isText = (v) => typeof v === 'string'
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

function cleanSource(s) {
  if (!isObj(s) || !isText(s.file) || !s.file) return null
  return { file: s.file, line: num(s.line), column: num(s.column), framework: isText(s.framework) ? s.framework : '' }
}

function cleanElement(e) {
  if (!isObj(e) || !isText(e.tag) || !/^[a-z][a-z0-9-]*$/i.test(e.tag) || !isText(e.selector)) return null
  const b = isObj(e.box) ? e.box : {}
  return {
    tag: e.tag.toLowerCase(),
    id: isText(e.id) ? e.id : '',
    classes: Array.isArray(e.classes) ? e.classes.filter(isText) : [],
    text: isText(e.text) ? e.text : '',
    html: isText(e.html) ? e.html : '',
    selector: e.selector,
    box: { x: num(b.x) ?? 0, y: num(b.y) ?? 0, width: num(b.width) ?? 0, height: num(b.height) ?? 0 },
    source: cleanSource(e.source),
    editable: e.editable === true,
    page: isText(e.page) ? e.page : '',
  }
}

// The message `event` carries, checked and copied, or null when it is not one from the preview frame.
// `frame`: the preview iframe's contentWindow; `origin`: the preview link's exact origin.
export function readInspectorMessage(event, { frame, origin }) {
  if (!event || !frame || !origin || event.source !== frame || event.origin !== origin) return null
  const d = event.data
  if (!isObj(d) || d.source !== FROM_PAGE || d.v !== 1 || !isText(d.kind)) return null
  switch (d.kind) {
    case 'ready':
    case 'navigate':
      return isText(d.href) ? { kind: d.kind, href: d.href, title: isText(d.title) ? d.title : '' } : null
    case 'console':
      if (!LEVELS.has(d.level) || !isText(d.text)) return null
      return { kind: 'console', level: d.level, text: d.text, at: num(d.at) ?? Date.now() }
    case 'network': {
      if (!isText(d.method) || !/^[A-Z]{1,16}$/.test(d.method) || !isText(d.url)) return null
      return {
        kind: 'network', method: d.method, url: d.url, type: isText(d.type) ? d.type : 'other',
        status: num(d.status), ms: num(d.ms), size: num(d.size), at: num(d.at) ?? Date.now(),
        error: isText(d.error) ? d.error : '',
      }
    }
    case 'select': {
      const element = cleanElement(d.element)
      return element ? { kind: 'select', element } : null
    }
    case 'select-mode':
      return typeof d.on === 'boolean' ? { kind: 'select-mode', on: d.on } : null
    case 'text-edit':
      return typeof d.ok === 'boolean' ? { kind: 'text-edit', ok: d.ok } : null
    case 'text-edited':
      return isText(d.before) && isText(d.after) ? { kind: 'text-edited', before: d.before, after: d.after } : null
    case 'screenshot':
      if (!isText(d.requestId)) return null
      if (isText(d.dataUrl) && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(d.dataUrl)) {
        return { kind: 'screenshot', requestId: d.requestId, dataUrl: d.dataUrl }
      }
      return { kind: 'screenshot', requestId: d.requestId, error: isText(d.error) ? d.error : 'No picture came back.' }
    default:
      return null
  }
}

// A command for the page, posted to the frame's exact origin only.
export function postToPage(frame, origin, kind, data = {}) {
  if (!frame || !origin) return false
  try {
    frame.postMessage({ source: TO_PAGE, v: 1, kind, ...data }, origin)
    return true
  } catch {
    return false
  }
}

// A PNG data: URL (checked by readInspectorMessage) as a File for the chat message.
export function pngFile(dataUrl, name = 'preview.png') {
  const b64 = String(dataUrl).split(',', 2)[1] || ''
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type: 'image/png' })
}

export function elementLabel(el) {
  if (!el) return ''
  return el.tag + (el.id ? `#${el.id}` : '') + (el.classes.length ? `.${el.classes.join('.')}` : '')
}

export function sourceLabel(source) {
  if (!source) return ''
  return source.file + (source.line != null ? `:${source.line}` : '') + (source.line != null && source.column != null ? `:${source.column}` : '')
}

// A place AADML found in the project's files (POST …/preview/locate/), as `path:line`.
export function locationLabel(loc) {
  if (!loc) return ''
  return loc.path + (loc.line != null ? `:${loc.line}` : '')
}

// The places the locate endpoint answered, checked and copied: { path, line, column, why } each, best first.
export function cleanLocations(list) {
  if (!Array.isArray(list)) return []
  return list.filter((l) => isObj(l) && isText(l.path) && l.path && num(l.line) != null).map((l) => ({
    path: l.path, line: l.line, column: num(l.column), why: isText(l.why) ? l.why : '',
  }))
}

// The one chat message "Ask the agent" sends. `locations`: where AADML found the element in the project's files, best
// first, for a page that does not say where it comes from; `locateNote`: why none was found.
export function elementMessage({ element, request = '', port = 0, edit = null, screenshot = '', locations = [], locateNote = '' }) {
  const lines = [`About this element in the preview (port ${port}${element.page ? `, page ${element.page}` : ''}):`]
  lines.push(`- Element: ${element.html || `<${element.tag}>`}`)
  if (element.text) lines.push(`- Text: "${element.text}"`)
  lines.push(`- CSS selector: ${element.selector}`)
  lines.push(`- Size and place: ${element.box.width}×${element.box.height} at (${element.box.x}, ${element.box.y})`)
  if (element.source) {
    lines.push(`- Source: ${sourceLabel(element.source)}${element.source.framework ? ` (from ${element.source.framework})` : ''}. Edit that file.`)
  } else if (locations.length) {
    const [best, ...rest] = locations
    lines.push(`- Source: ${locationLabel(best)}, found in the project's files (${best.why || 'the best match'}). Make the change in that file, at that line.`)
    if (rest.length) {
      lines.push(`- Other places that match (check them if the first one is not it):`)
      for (const loc of rest) lines.push(`  - ${locationLabel(loc)}${loc.why ? `: ${loc.why}` : ''}`)
    }
  } else {
    lines.push('- Source: the app does not expose where this element comes from; find it from the selector and text.')
    if (locateNote) lines.push(`- Looked for in the project's files: ${locateNote}`)
  }
  if (edit && edit.after !== edit.before) {
    lines.push(`- I changed its text in the preview only, from "${edit.before}" to "${edit.after}". Make this change in the source.`)
  }
  if (screenshot) lines.push(`- Screenshot: ${screenshot}`)
  const ask = String(request || '').trim()
  lines.push('', ask || (edit && edit.after !== edit.before ? 'Please make that text change in the code.' : 'What is this element, and where is it in the code?'))
  return lines.join('\n')
}

const SIZE_UNITS = [['byte', 1], ['kilobyte', 1024], ['megabyte', 1024 * 1024]]
const sizeFormats = SIZE_UNITS.map(([unit]) => new Intl.NumberFormat(undefined, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 }))
export function formatSize(n) {
  if (n == null) return '—'
  const i = n < 1024 ? 0 : n < 1024 * 1024 ? 1 : 2
  return sizeFormats[i].format(n / SIZE_UNITS[i][1])
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hour12: false,
})
export function formatTime(at) { return timeFormat.format(new Date(at)) }

const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })
export function formatPercent(x) { return percentFormat.format(x) }
