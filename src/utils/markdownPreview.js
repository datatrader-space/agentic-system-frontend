// The Let's Code editor's markdown preview (ADM-1322). A project's .md file may have been written by the Coding Agent
// or come from anywhere the project came from, so it is UNTRUSTED: it is rendered by the sanitising renderer the chat
// uses (safeMarkdown: raw HTML becomes text, `javascript:` and `data:` links are dropped), and the HTML that comes out is
// sanitised again with DOMPurify before it reaches `v-html`. No script, frame, form or style element and no event
// handler survives; every link opens in a new tab with rel="noopener noreferrer".
import createDOMPurify from 'dompurify'
import { renderUntrustedMarkdown, isSafeUrl } from '@/utils/safeMarkdown'

const FORBID_TAGS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button',
  'textarea', 'select', 'style', 'link', 'meta', 'base']

let purifier = null
function purify() {
  if (purifier || typeof window === 'undefined') return purifier
  // Its own instance: the hook below never reaches another use of DOMPurify on the page.
  purifier = createDOMPurify(window)
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href')
      if (href != null && !isSafeUrl(href)) node.removeAttribute('href')
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer nofollow')
    }
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src')
      if (src != null && !isSafeUrl(src)) node.removeAttribute('src')
      node.setAttribute('loading', 'lazy')
      node.setAttribute('referrerpolicy', 'no-referrer')
    }
  })
  return purifier
}

/** A markdown file's text as HTML that is safe for `v-html`. */
export function renderMarkdownPreview(text) {
  const html = renderUntrustedMarkdown(String(text ?? ''))
  const p = purify()
  if (!p) return ''
  return p.sanitize(html, { FORBID_TAGS, FORBID_ATTR: ['style', 'srcset', 'formaction', 'action'], ALLOW_DATA_ATTR: false })
}

export const isMarkdownPath = (path) => /\.(md|markdown|mdown|mkd)$/i.test(path || '')

/**
 * A link in a file's preview that names another file of the project ("docs/setup.md", "../README.md#usage"): the
 * project path it names, so the editor opens it in a tab instead of the browser opening a page that is not there.
 * Null for a web address, a mail link, an anchor in the same file, or a path that leaves the project.
 */
export function projectLinkOf(href, fromPath) {
  const raw = String(href || '').trim()
  if (!raw || raw.startsWith('#') || raw.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return null
  let path = raw.split('#')[0].split('?')[0]
  try { path = decodeURIComponent(path) } catch { /* kept as written */ }
  if (!path) return null
  const parts = path.startsWith('/') ? [] : (fromPath || '').split('/').slice(0, -1)
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') { if (!parts.length) return null; parts.pop() } else parts.push(part)
  }
  return parts.length ? parts.join('/') : null
}
