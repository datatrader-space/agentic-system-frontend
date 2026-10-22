// Which chat attachments the backend turns into a searchable document (page-speed plan Phase 5 item 6).
//
// A mirror of the backend's should_ingest(..., intent=chat_attachment) in
// agent/services/ingestion_policy.py. The chat waits for "Reading <file>…" only for a file the backend
// will actually ingest; it used to wait up to ~60 s for EVERY non-image file, video and audio included,
// which the backend never ingests (they are served to the media tools on demand), so Send sat disabled
// for a minute for nothing. Keep the two lists in step with the backend.
const VIEW_ONLY_MIME_PREFIXES = ['image/', 'video/', 'audio/']

const DOC_MIME_EXACT = new Set([
  'application/pdf', 'application/json', 'application/xml', 'application/rtf', 'application/epub+zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
])

const DOC_EXTS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'text', 'md', 'markdown', 'csv', 'tsv',
  'json', 'xml', 'html', 'htm', 'rtf', 'epub', 'odt', 'ods', 'log',
])

export function willIngestChatAttachment(mimeType, filename = '') {
  const mime = String(mimeType || '').split(';')[0].trim().toLowerCase()
  const dot = String(filename || '').lastIndexOf('.')
  const ext = dot >= 0 ? String(filename).slice(dot + 1).toLowerCase() : ''
  if (VIEW_ONLY_MIME_PREFIXES.some((p) => mime.startsWith(p))) return false
  if (mime.startsWith('text/') || DOC_MIME_EXACT.has(mime)) return true
  return DOC_EXTS.has(ext)
}

export default willIngestChatAttachment
