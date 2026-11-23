// @vitest-environment jsdom
// The Preview tab's side of AADML's preview inspector (ADM-1318): a message counts only when it comes from the preview
// frame's own window at that frame's exact origin, in a known shape, copied field by field.
import { describe, it, expect, vi } from 'vitest'
import {
  readInspectorMessage, postToPage, deviceSize, fitScale, DEVICES, elementMessage, pngFile, FROM_PAGE, TO_PAGE,
  cleanLocations, locationLabel,
} from './previewInspector'

const ORIGIN = 'https://47100-k3j9x2signedtoken.proxy.sandbox.aadml.com'
const frame = { postMessage: vi.fn() }
const at = (data, over = {}) => ({ source: frame, origin: ORIGIN, data: { source: FROM_PAGE, v: 1, ...data }, ...over })
const read = (event) => readInspectorMessage(event, { frame, origin: ORIGIN })

const ELEMENT = {
  tag: 'button', id: 'buy', classes: ['btn', 'primary'], text: 'Buy now', html: '<button id="buy" class="btn primary">',
  selector: 'main > button#buy', box: { x: 300, y: 512, width: 120, height: 40 },
  source: { file: '/home/northrays/workspace/repo/src/Buy.vue', line: 12, column: 5, framework: 'Vue' }, editable: true, page: '/shop',
}

describe('which messages count', () => {
  it('only from the frame\'s own window at its exact origin', () => {
    const msg = { kind: 'console', level: 'log', text: 'hi', at: 1 }
    expect(read(at(msg))).toEqual({ kind: 'console', level: 'log', text: 'hi', at: 1 })
    expect(read(at(msg, { origin: 'https://evil.test' }))).toBe(null)
    expect(read(at(msg, { origin: `${ORIGIN}:443` }))).toBe(null)
    expect(read(at(msg, { source: {} }))).toBe(null)
    expect(read(at(msg, { source: null }))).toBe(null)
    expect(readInspectorMessage(at(msg), { frame: null, origin: ORIGIN })).toBe(null)
    expect(readInspectorMessage(at(msg), { frame, origin: '' })).toBe(null)
  })

  it('only in a known shape, and only its own fields are copied', () => {
    expect(read({ source: frame, origin: ORIGIN, data: 'console' })).toBe(null)
    expect(read(at({ kind: 'console', level: 'log', text: 'x' }, { data: { source: 'other', v: 1, kind: 'console' } }))).toBe(null)
    expect(read(at({ v: 2, kind: 'console', level: 'log', text: 'x' }))).toBe(null)
    expect(read(at({ kind: 'console', level: 'evil', text: 'x' }))).toBe(null)
    expect(read(at({ kind: 'console', level: 'log', text: { toString: () => 'x' } }))).toBe(null)
    expect(read(at({ kind: 'run', code: 'alert(1)' }))).toBe(null)
    const got = read(at({ kind: 'network', method: 'GET', url: '/api', status: 200, ms: 12, size: 34, type: 'fetch', at: 5, extra: 'x', html: '<b>' }))
    expect(got).toEqual({ kind: 'network', method: 'GET', url: '/api', type: 'fetch', status: 200, ms: 12, size: 34, at: 5, error: '' })
    expect(read(at({ kind: 'network', method: 'get; drop', url: '/api' }))).toBe(null)
  })

  it('an element is checked field by field; a picture only as a PNG data address', () => {
    const got = read(at({ kind: 'select', element: { ...ELEMENT, onclick: 'x', classes: ['ok', 7] } }))
    expect(got.element.classes).toEqual(['ok'])
    expect(got.element).not.toHaveProperty('onclick')
    expect(read(at({ kind: 'select', element: { ...ELEMENT, tag: 'img onerror=x' } }))).toBe(null)
    expect(read(at({ kind: 'select', element: { ...ELEMENT, source: { file: 3 } } })).element.source).toBe(null)
    expect(read(at({ kind: 'screenshot', requestId: 'a', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' })).dataUrl)
      .toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(read(at({ kind: 'screenshot', requestId: 'a', dataUrl: 'javascript:alert(1)' })))
      .toEqual({ kind: 'screenshot', requestId: 'a', error: 'No picture came back.' })
    expect(read(at({ kind: 'screenshot', requestId: 'a', dataUrl: 'data:text/html;base64,PGI+' })).dataUrl).toBeUndefined()
  })
})

describe('commands and helpers', () => {
  it('commands go to the frame at its exact origin only', () => {
    expect(postToPage(frame, ORIGIN, 'select-mode', { on: true })).toBe(true)
    expect(frame.postMessage).toHaveBeenCalledWith({ source: TO_PAGE, v: 1, kind: 'select-mode', on: true }, ORIGIN)
    expect(postToPage(frame, '', 'clear')).toBe(false)
    expect(postToPage(null, ORIGIN, 'clear')).toBe(false)
  })

  it('device sizes rotate and fit, never grow', () => {
    const se = DEVICES.find((d) => d.id === 'iphone-se')
    expect(deviceSize(se, false)).toEqual({ width: 375, height: 667 })
    expect(deviceSize(se, true)).toEqual({ width: 667, height: 375 })
    expect(deviceSize(DEVICES[0], false)).toBe(null)
    expect(fitScale({ width: 375, height: 667 }, { width: 1000, height: 1000 })).toBe(1)
    expect(fitScale({ width: 1440, height: 900 }, { width: 720, height: 900 })).toBe(0.5)
  })

  it('the one message to the agent names the element, its source and the text edit', () => {
    const text = elementMessage({ element: ELEMENT, request: 'Make it green', port: 5173,
      edit: { before: 'Buy now', after: 'Buy today' }, screenshot: 'attached (what the preview showed)' })
    expect(text).toContain('port 5173, page /shop')
    expect(text).toContain('<button id="buy" class="btn primary">')
    expect(text).toContain('CSS selector: main > button#buy')
    expect(text).toContain('Source: /home/northrays/workspace/repo/src/Buy.vue:12:5 (from Vue)')
    expect(text).toContain('from "Buy now" to "Buy today"')
    expect(text).toContain('Screenshot: attached')
    expect(text.endsWith('Make it green')).toBe(true)
    const bare = elementMessage({ element: { ...ELEMENT, source: null }, port: 3000, screenshot: 'not attached, because x' })
    expect(bare).toContain('does not expose where this element comes from')
    expect(bare.endsWith('where is it in the code?')).toBe(true)
  })

  it('places found in the files go in the message, best first, phrased so the agent edits that file', () => {
    const locations = cleanLocations([
      { path: 'src/components/Hero.tsx', line: 4, column: 7, why: 'This line has the classes "btn primary".' },
      { path: 'src/components/Hero.test.tsx', line: 1, column: 1, why: 'This line has the text "Buy now".' },
      { path: '', line: 2 }, { path: 'x.html', line: 'one' }, 'nope', null,
    ])
    expect(locations.map(locationLabel)).toEqual(['src/components/Hero.tsx:4', 'src/components/Hero.test.tsx:1'])
    const text = elementMessage({ element: { ...ELEMENT, source: null }, port: 3000, locations })
    expect(text).toContain('- Source: src/components/Hero.tsx:4, found in the project\'s files (This line has the classes "btn primary".). Make the change in that file, at that line.')
    expect(text).toContain('  - src/components/Hero.test.tsx:1: This line has the text "Buy now".')
    expect(text).not.toContain('does not expose')
    const none = elementMessage({ element: { ...ELEMENT, source: null }, port: 3000, locateNote: 'No file in the project has it.' })
    expect(none).toContain("- Looked for in the project's files: No file in the project has it.")
  })

  it("the framework's own location is preferred over places found in the files", () => {
    const text = elementMessage({ element: ELEMENT, port: 5173, locations: [{ path: 'src/Other.vue', line: 3, why: '' }] })
    expect(text).toContain('Source: /home/northrays/workspace/repo/src/Buy.vue:12:5 (from Vue). Edit that file.')
    expect(text).not.toContain('src/Other.vue')
  })

  it('a PNG data address becomes a picture file', async () => {
    const f = pngFile('data:image/png;base64,aGk=', 'p.png')
    expect([f.name, f.type, f.size]).toEqual(['p.png', 'image/png', 2])
  })
})
