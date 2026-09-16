// Which links in rendered agent output open in the in-app file viewer, and with what.
//
// Two kinds, both served from the API behind the app's own authentication — a plain navigation to them
// (a new tab) carries none, so they must be fetched by the viewer instead:
//   * workspace files, `/api/workspace/files/download/?t=<signed token>` (WORKSPACE_WRITE_FILE);
//   * agent documents, `/api/documents/<slug>/download/?format=markdown|html|pdf|docx` (CREATE_DOCUMENT).
//
// Shared by the chat bubble and the Work rail. The rail rendered the same answers without any of this, so a
// document link there opened a bare tab (prod conv 1608).

const DOC_EXT = { markdown: 'md', html: 'html', pdf: 'pdf', docx: 'docx', view: 'html' }

/** The viewer payload for a clicked anchor, or null when it is not a file link. */
export function fileLinkPayload(anchor) {
  if (!anchor || typeof anchor.getAttribute !== 'function') return null
  const href = anchor.getAttribute('href') || ''
  const label = (anchor.textContent || '').trim()

  if (href.includes('/api/workspace/files/')) {
    const base = href.replace(/[?&]inline=1$/, '')
    const sep = base.includes('?') ? '&' : '?'
    return { path: label || 'file', download_url: base, view_url: base + sep + 'inline=1' }
  }

  const doc = href.match(/\/api\/documents\/([^/?#]+)\/download\/?(?:\?(.*))?$/)
  if (doc) {
    const params = new URLSearchParams(doc[2] || '')
    const fmt = params.get('format') || 'markdown'
    const ext = DOC_EXT[fmt] || 'md'
    // The label is often prose ("Download the report"); the viewer picks its render mode from the extension.
    const path = /\.[a-z0-9]{2,5}$/i.test(label) ? label : `${doc[1]}.${ext}`
    return { path, download_url: href, view_url: href }
  }
  return null
}
