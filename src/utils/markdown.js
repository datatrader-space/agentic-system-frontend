// Shared markdown pipeline — single source of truth for every surface that
// renders model/user markdown. Two jobs, done once, consistently:
//   1) parse   markdown -> HTML  (marked + GFM + syntax-highlighted code)
//   2) sanitize HTML             (DOMPurify — strips scripts/handlers before v-html)
//
// Styling of the resulting tags lives in src/styles/markdown.css (`.md-content`)
// and in MarkdownRenderer.vue — parsers never style output.
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'
import DOMPurify from 'dompurify'

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      try {
        return hljs.highlight(code, { language }).value
      } catch {
        return code
      }
    },
  }),
)
marked.setOptions({ breaks: true, gfm: true })

// External links open safely (defense-in-depth alongside sanitization).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * Parse markdown to sanitized, highlight-ready HTML.
 * @param {string} text raw markdown
 * @returns {string} sanitized HTML safe for v-html
 */
export function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return ''
  const html = marked.parse(text)
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
}

export { marked }
