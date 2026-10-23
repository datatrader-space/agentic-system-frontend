// A model's answer as Markdown, made safe to show (found 2026-10-21: the Test page showed "**…**" as typed).
// The answer is untrusted: it is parsed by marked, then DOMPurify keeps only the tags of plain formatted text, and a
// link only when it is http(s), opened in a new tab without access to this page.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del'];

DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer nofollow'); }
});

export function safeMarkdown(text) {
  const html = marked.parse(String(text ?? ''), { gfm: true, breaks: true, async: false });
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ['href', 'target', 'rel'], ALLOWED_URI_REGEXP: /^https?:\/\//i });
}
