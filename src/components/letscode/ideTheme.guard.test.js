// The Let's Code editor has its own light or dark (useIdeTheme), set on its container. The app's theme layer
// (src/styles/theme-layer.css) paints classes by the PAGE's theme (`:root[data-theme=dark] .sidebar { ... }`), and
// such a rule reaches into the editor whatever the editor's own theme is: the file panel's `.sidebar` turned dark in
// a light editor (ADM-1205). So no editor component may use a class that layer names; the editor uses its tokens.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, '..', '..')
const read = (p) => readFileSync(p, 'utf8')

// Split at the commas and spaces that are not inside parentheses (`:is(.a, .b)` stays one piece).
function splitTop(text, sep) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth === 0 && sep.test(ch)) { if (cur.trim()) parts.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

// The classes a layer rule STARTS from, after `:root[data-theme=...]`: `.sidebar .nav-item` starts from `sidebar`,
// `:is(.muted, .scope-hint)` from both, `.lib .chip.t` from `lib` (so `.chip` inside another page is not ours).
function layerClasses() {
  const css = read(join(src, 'styles', 'theme-layer.css')).replace(/\/\*[\s\S]*?\*\//g, '')
  const out = new Set()
  for (const rule of css.split('}')) {
    for (const selector of splitTop(rule.split('{')[0], /,/)) {
      const compounds = splitTop(selector.replace(/:root\[data-theme=[^\]]*\]/g, ''), /\s/)
      const first = compounds[0] || ''
      for (const m of first.matchAll(/\.([a-zA-Z_][\w-]*)/g)) out.add(m[1])
    }
  }
  return out
}

function editorFiles() {
  const dir = here
  const files = [join(src, 'components', 'CodeBrowser.vue')]
  for (const f of readdirSync(dir)) if (f.endsWith('.vue')) files.push(join(dir, f))
  for (const f of readdirSync(join(dir, 'deploy'))) if (f.endsWith('.vue')) files.push(join(dir, 'deploy', f))
  return files
}

// Every class an editor component puts on an element: static `class="..."` and the `class:` of render functions.
function classesIn(text) {
  const out = new Set()
  for (const m of text.matchAll(/\sclass="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (c) out.add(c)
  for (const m of text.matchAll(/class:\s*'([^']+)'/g)) for (const c of m[1].split(/\s+/)) if (c) out.add(c)
  return out
}

describe("the editor's own theme is not overridden by the page's theme layer", () => {
  it('no editor component uses a class the theme layer paints', () => {
    const layer = layerClasses()
    expect(layer.has('sidebar')).toBe(true)                    // the layer was read
    const clashes = []
    for (const f of editorFiles()) {
      for (const c of classesIn(read(f))) if (layer.has(c)) clashes.push(`${f.split(/[\\/]/).slice(-2).join('/')}: .${c}`)
    }
    expect(clashes).toEqual([])
  })
})
