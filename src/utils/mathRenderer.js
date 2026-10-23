// KaTeX, loaded the first time a message contains math (`safeMarkdown.hasMath`). It is ~270 kB, and most
// answers have no formula, so it is never part of the page's first load. `mathVersion` changes once it has
// loaded, so a component whose rendered HTML reads it renders again with the formulas typeset.
import { ref } from 'vue'
import { setMathRenderer } from './safeMarkdown'

export const mathVersion = ref(0)

let loading = null

export function ensureMath() {
  if (loading) return loading
  loading = Promise.all([import('katex'), import('katex/dist/katex.min.css')])
    .then(([mod]) => {
      const katex = mod.default || mod
      setMathRenderer((tex, displayMode) => katex.renderToString(tex, {
        displayMode,
        throwOnError: false,   // a malformed formula shows in red with its source, never breaks the message
        trust: false,          // no \href, \url or HTML from a formula
        strict: 'ignore',
        output: 'htmlAndMathml',
        maxSize: 50,
        maxExpand: 1000,
      }))
      mathVersion.value += 1
    })
    .catch(() => { loading = null })   // offline / blocked: formulas stay as their source; try again later
  return loading
}
