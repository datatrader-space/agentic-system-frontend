// The Workflow Builder's colour tokens (ADM-1333 F2): no literal colour outside the token blocks, the Vue Flow
// mapping in one place, and text contrast of 4.5:1 or more for the category and status colours in light and dark.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const css = read('./workflow-builder.css')
const appCss = read('../../style.css')

// The custom properties of every top-level rule whose selector (or one of its selectors) is `selector`, later rules winning.
function block(source, selector) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const vars = {}
  let found = false
  for (const m of text.matchAll(/(?<=^|\})\s*([^{}]+?)\s*\{([^{}]*)\}/g)) {
    if (!m[1].split(',').map((x) => x.trim()).includes(selector)) continue
    found = true
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[d[1]] = d[2].trim()
  }
  if (!found) throw new Error(`no ${selector} block`)
  return vars
}

function rgba(value) {
  const v = value.trim()
  let m = v.match(/^#([0-9a-f]{6})$/i)
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1)
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : Number(m[4])]
  throw new Error(`not a colour: ${value}`)
}
function over(fg, bg) {
  const [r, g, b, a] = rgba(fg)
  const [R, G, B] = rgba(bg)
  return `rgb(${Math.round(r * a + R * (1 - a))}, ${Math.round(g * a + G * (1 - a))}, ${Math.round(b * a + B * (1 - a))})`
}
function luminance(c) {
  return rgba(c).slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const light = block(css, '.wfb-root')
const dark = { ...light, ...block(css, '[data-theme="dark"] .wfb-root') }
const vmLight = block(appCss, ':root')
const vmDark = { ...vmLight, ...block(appCss, '[data-theme="dark"]') }
const CATEGORIES = ['trigger', 'agent', 'action', 'logic', 'media']

describe('workflow tokens', () => {
  it('has no literal colour outside the token blocks', () => {
    const rules = css.slice(css.indexOf('.wfb-root{display:flex'))
    expect(rules.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull()
  })

  it('gives the node window (portalled, class wf-tokens) the same tokens in both themes', () => {
    const wf = (vars) => Object.fromEntries(Object.entries(vars).filter(([k]) => k.startsWith('--wf-')))
    const tokens = block(css, '.wf-tokens')
    expect(tokens).toEqual(wf(light))
    expect(wf({ ...tokens, ...block(css, '[data-theme="dark"] .wf-tokens') })).toEqual(wf(dark))
  })

  it('maps Vue Flow onto our tokens in one block', () => {
    const blocks = css.match(/--vf-[\w-]+\s*:/g)
    expect(blocks.length).toBeGreaterThan(0)
    const first = css.indexOf('--vf-')
    const last = css.lastIndexOf('--vf-')
    expect(css.slice(first, last).includes('}')).toBe(false)
  })

  it.each(CATEGORIES)('category %s text is 4.5:1 or more on its tile and the surface, light and dark', (id) => {
    const surfaceLight = vmLight['--vm-surface']
    const surfaceDark = vmDark['--vm-surface']
    expect(contrast(light[`--wf-cat-${id}`], light[`--wf-cat-${id}-soft`])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(light[`--wf-cat-${id}`], surfaceLight)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(dark[`--wf-cat-${id}`], dark[`--wf-cat-${id}-soft`])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(dark[`--wf-cat-${id}`], surfaceDark)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['success', '--vm-green-ink', '--vm-green-soft'],
    ['danger', '--vm-red-ink', '--vm-red-soft'],
    ['warn', '--vm-amber-ink', '--vm-amber-soft'],
  ])('%s text is 4.5:1 or more on its tint, light and dark', (name, ink, soft) => {
    expect(light[`--wf-${name}-ink`]).toBe(`var(${ink})`)
    expect(light[`--wf-${name}-soft`]).toBe(`var(${soft})`)
    expect(contrast(vmLight[ink], over(vmLight[soft], vmLight['--vm-surface']))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(vmDark[ink], over(vmDark[soft], vmDark['--vm-surface']))).toBeGreaterThanOrEqual(4.5)
  })

  it('muted text and accent text are 4.5:1 or more on the surfaces, light and dark', () => {
    for (const vm of [vmLight, vmDark]) {
      expect(contrast(vm['--vm-ink-faint'], vm['--vm-surface'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(vm['--vm-link'], vm['--vm-surface'])).toBeGreaterThanOrEqual(4.5)
    }
  })
})
