// No shaking or zooming animation anywhere in the frontend (owner rule): no @keyframes that moves, zooms or tilts,
// and no hover, press or focus that lifts, slides or scales. Spinners (a full turn) and loading shimmers stay; a real
// drawer's slide is a Vue transition, not checked here. Plain fades and opacity pulses are fine.
import { describe, expect, it } from 'vitest'

const sources = import.meta.glob(['./**/*.vue', './**/*.css'], { query: '?raw', import: 'default', eager: true })
const SPINNER = /transform\s*:\s*(none|rotate\(\s*(0|360)(deg)?\s*\))\s*;?/g
const LOADING_SHIMMER = new Set(['vmShimmer', 'lc-shimmer'])
// Where a hover keeps the element's own centring (the same translate as its resting state): no movement.
const RESTING = new Set(['translateX(-50%)'])

function movingKeyframes(text) {
  const found = []
  const start = /@keyframes\s+([\w-]+)\s*\{/g
  let m
  while ((m = start.exec(text))) {
    let depth = 1, i = start.lastIndex
    while (depth && i < text.length) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; i++ }
    const body = text.slice(start.lastIndex, i).replace(SPINNER, '')
    if (!LOADING_SHIMMER.has(m[1]) && /transform\s*:|translate|scale\(|rotate\(/.test(body)) found.push(m[1])
  }
  return found
}
function movingHovers(text) {
  const found = []
  for (const [, selector, body] of text.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
    if (!/:hover|:active|:focus/.test(selector)) continue
    for (const [, value] of body.matchAll(/transform\s*:\s*([^;}]+)/g)) {
      const v = value.trim()
      if (v !== 'none' && !RESTING.has(v)) found.push(`${selector.trim()} { transform: ${v} }`)
    }
  }
  return found
}
const movingClasses = text => [...text.matchAll(/\b(?:group-)?hover:(?:-?translate-[xy]-[\w./-]+|-?scale-\w+|-?rotate-\w+)|\banimate-(?:bounce|ping)\b/g)].map(m => m[0])

describe('no shaking or zooming animation', () => {
  it('reads the app sources', () => { expect(Object.keys(sources).length).toBeGreaterThan(100) })
  it('no @keyframes moves, zooms or tilts (spinners and loading shimmers excepted)', () => {
    const bad = Object.entries(sources).flatMap(([file, text]) => movingKeyframes(text).map(name => `${file}: @keyframes ${name}`))
    expect(bad).toEqual([])
  })
  it('no hover, press or focus lifts, slides or scales anything', () => {
    const bad = Object.entries(sources).flatMap(([file, text]) => movingHovers(text).map(rule => `${file}: ${rule}`))
    expect(bad).toEqual([])
  })
  it('no Tailwind hover movement or bouncing', () => {
    const bad = Object.entries(sources).flatMap(([file, text]) => movingClasses(text).map(name => `${file}: ${name}`))
    expect(bad).toEqual([])
  })
})
