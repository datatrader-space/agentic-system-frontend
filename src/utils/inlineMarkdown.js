import { Marked } from 'marked'
import { isSafeUrl } from './safeMarkdown'

// A scoped instance, so the URL filter below does not change the global `marked` other views rely on.
// `javascript:` and `data:` links are emptied on the token: escaping the HTML did not stop marked from
// building `<a href="javascript:...">` out of the model's own `[text](javascript:...)` (audit finding A5).
const inline = new Marked({ breaks: false, gfm: true })
inline.use({
  walkTokens(token) {
    if ((token.type === 'link' || token.type === 'image') && !isSafeUrl(token.href)) token.href = ''
  },
})

// Render a SHORT phrase (a reasoning label / thought) as INLINE markdown — bold, italic, code, strike,
// links-as-text — so the model's `**Completing current plan step**` shows as bold instead of literal
// asterisks. Two safety properties:
//   1. HTML is ESCAPED first, so any tag the model emits (`<img onerror>`, `<script>`) can never inject
//      markup — only marked's own inline tags (<strong>/<em>/<code>…) survive. Safe for v-html.
//   2. `parseInline` produces NO block wrappers (<p>), so it drops straight into the compact reason row.
// Falls back to escaped plain text on any error — never throws, never leaves raw markup.
const _escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

export function renderInlineMarkdown(text) {
  const safe = _escapeHtml(text)
  try {
    // breaks:false — the reason rows already use `white-space: pre-wrap`, so newlines are rendered by CSS.
    // Injecting <br> too (breaks:true) would DOUBLE every line break. We only want inline formatting here.
    return inline.parseInline(safe)
  } catch {
    return safe
  }
}
