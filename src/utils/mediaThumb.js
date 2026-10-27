// The small picture a card shows for an image or a video (agentic-docs/MEDIA_THUMBNAILS_EVERYWHERE_PLAN.md).
//
// A card never loads the whole file to draw a tile: it shows the server's thumbnail (a 480 px WebP, or a video's
// frame one second in), and the original only opens on click, in that place's viewer. The server serves
// /api/library/<attachment_id>/thumbnail/ for the person's own files in any of their Libraries (AADML, Video Studio,
// Training) and answers 404 otherwise; the card then shows the original, as it did before (MediaThumb.vue).

export function thumbnailPath(attachmentId) {
  return `/api/library/${encodeURIComponent(String(attachmentId))}/thumbnail/`
}

/** 'image', 'video', 'audio' or '' for a media item of any of the shapes the app uses. */
export function mediaKind(item) {
  if (!item) return ''
  const kind = String(item.media_type || item.type || '').toLowerCase()
  if (kind === 'image' || kind === 'video' || kind === 'audio') return kind
  if (item.isImage) return 'image'
  const mime = String(item.mime_type || item.mime || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return ''
}

/** The thumbnail URL for a card, or null when it has none (then the card shows the original). */
export function thumbnailFor(item) {
  if (!item) return null
  if (item.thumbnail_url) return item.thumbnail_url
  const kind = mediaKind(item)
  const id = item.attachment_id
  return id != null && id !== '' && (kind === 'image' || kind === 'video') ? thumbnailPath(id) : null
}
