// Markdown rendering for UNTRUSTED content — anything authored by someone other than the
// person looking at it.
//
// The shared-conversation page publishes one user's transcript to anybody holding the link, and
// renders it with `v-html`. Plain `marked` passes raw HTML straight through, so without this a
// sharer could put `<img src=x onerror=…>` in a message and get stored XSS on our origin against
// every viewer of that link — and since Django's `csrftoken` cookie is readable by design, that
// escalates to authenticated same-origin requests as the victim. `<script>` inserted via innerHTML
// does not execute, but event-handler attributes (`onerror`, `onload`, `onmouseover`) do.
//
// Two independent holes have to be closed, and escaping alone only closes the first:
//   1. raw HTML tokens        → escaped to visible text
//   2. `javascript:` / `data:` URLs in links and images → neutralised
//
// This is a SCOPED marked instance, deliberately not `marked.use()`. The main chat renders the
// viewer's own content and relies on raw-HTML passthrough (generated-media <img> embeds via
// enhanceChatMedia), so tightening the global instance would break it.
import { Marked } from 'marked'

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// Allow only protocols that cannot execute script, plus relative/anchor/query-only links.
const SAFE_URL = /^(?:https?:|mailto:|tel:|[#/?]|[^:]*$)/i

export const isSafeUrl = (raw) => {
  // Control characters are the classic smuggling trick — `java\tscript:` and `java\nscript:` are
  // both parsed as `javascript:` by browsers, so strip them BEFORE testing the protocol.
  const url = String(raw ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim()
  if (!url) return false
  return SAFE_URL.test(url)
}

const safe = new Marked({ breaks: true, gfm: true })

safe.use({
  // Neutralise dangerous URLs on the TOKEN, before any renderer sees them. Done as a walkTokens
  // hook rather than inside the renderer because the hook signature is stable across marked
  // majors, while renderer argument shapes have changed more than once.
  walkTokens(token) {
    if ((token.type === 'link' || token.type === 'image') && !isSafeUrl(token.href)) {
      token.href = ''
    }
  },
  renderer: {
    // Raw HTML — block and inline both land here — becomes visible text instead of live markup.
    // Fenced code is NOT affected: marked escapes code-fence content itself, so examples
    // containing markup still render correctly as code.
    html(token) {
      return escapeHtml(token?.raw ?? token?.text ?? token)
    },
  },
})

/**
 * Render untrusted markdown to HTML that is safe to pass to `v-html`.
 * Links are forced to open in a new tab with `rel="noopener noreferrer"` so a shared page can
 * never be used to tab-nab the viewer.
 */
export function renderUntrustedMarkdown(text) {
  const html = safe.parse(String(text || ''))
  return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer nofollow" ')
}

export default renderUntrustedMarkdown
