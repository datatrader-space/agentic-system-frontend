// @vitest-environment jsdom
// Math, tables and the delimiters models write — rendered the way ChatGPT and Claude render them, with the
// safety of renderUntrustedMarkdown intact (live chat 1202, 2026-10-22: a pricing formula arrived as
// "[ \text{Price}= \frac{...} ]" in plain text).
import { describe, it, expect, afterEach } from 'vitest'
import katex from 'katex'
import { renderUntrustedMarkdown, setMathRenderer, hasMath } from './safeMarkdown'

const root = (html) => {
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
  return doc.getElementById('r')
}
const useKatex = () => setMathRenderer((tex, displayMode) =>
  katex.renderToString(tex, { displayMode, throwOnError: false, trust: false, strict: 'ignore' }))

afterEach(() => setMathRenderer(null))

describe('math', () => {
  it('typesets \\[ \\] as a display formula and \\( \\) inline', () => {
    useKatex()
    const r = root(renderUntrustedMarkdown(
      'Use:\n\n\\[\n\\text{Price}=\\frac{\\text{Cost}}{1-m}\n\\]\n\nso \\(m=0.5\\) doubles it.'))
    expect(r.querySelector('.math-display .katex-display')).not.toBeNull()
    expect(r.querySelectorAll('.katex').length).toBe(2)
    expect(r.querySelector('.math-src')).toBeNull()                 // nothing left as raw source
    // (KaTeX keeps the TeX in a hidden MathML annotation for screen readers; the visible part is typeset.)
    expect(r.querySelector('.katex-html').textContent).not.toContain('\\frac')
  })

  it('typesets $$ $$ as display math', () => {
    useKatex()
    const r = root(renderUntrustedMarkdown('$$a^2+b^2=c^2$$'))
    expect(r.querySelector('.katex-display')).not.toBeNull()
  })

  it('never reads prices as math: a single $ stays text', () => {
    useKatex()
    const text = 'Round $4.29 to $4.49 or $4.99, and offer free shipping above $30.'
    const r = root(renderUntrustedMarkdown(text))
    expect(r.querySelector('.katex')).toBeNull()
    expect(r.textContent).toContain('$4.29 to $4.49 or $4.99')
    expect(hasMath(text)).toBe(false)
  })

  it('leaves math delimiters inside code alone', () => {
    useKatex()
    const r = root(renderUntrustedMarkdown('```\nprint("\\\\(x\\\\)", "$$")\n```\n\nand `\\(y\\)` inline code'))
    expect(r.querySelector('.katex')).toBeNull()
    expect(r.querySelector('pre code').textContent).toContain('$$')
  })

  it('shows the source, escaped, before KaTeX has loaded and for a formula still streaming in', () => {
    let r = root(renderUntrustedMarkdown('so \\(x<y\\) holds'))
    expect(r.querySelector('.math-src').textContent).toBe('\\(x<y\\)')
    useKatex()
    r = root(renderUntrustedMarkdown('Price:\n\n\\[\n\\frac{1.80}{1-0.58'))      // no closing \] yet
    expect(r.querySelector('.katex')).toBeNull()
  })

  it('a formula cannot carry a link or markup', () => {
    useKatex()
    const r = root(renderUntrustedMarkdown('\\(\\href{javascript:alert(1)}{x}\\) and \\(<img src=x onerror=alert(1)>\\)'))
    expect([...r.querySelectorAll('a[href^="javascript"]')]).toHaveLength(0)
    expect(r.querySelector('img')).toBeNull()
  })
})

describe('tables', () => {
  it('wraps every table in a box that scrolls sideways', () => {
    const r = root(renderUntrustedMarkdown('| a | b |\n|---|---|\n| 1 | 2 |'))
    expect(r.querySelector('.md-table > table')).not.toBeNull()
  })
})
