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

/** What a file IS, as the API declares it: 'image', 'video', 'audio', 'other' (a caption, a document, ...) or ''
 *  when the item says nothing. Unlike `mediaKind`, a declared non-media type is kept, never read as "unknown". */
export function declaredKind(item) {
  if (!item) return ''
  const declared = String(item.media_type || '').toLowerCase()
  if (declared) return declared
  const kind = mediaKind(item)
  if (kind) return kind
  return item.mime_type || item.mime ? 'other' : ''
}

/** The kind of one output of a Video Studio job (`item`, default the job's main output): the file's own media type
 *  from the jobs API (a frame job's output is a PNG although the job works on a video, a caption job's is a WebVTT
 *  file), else the job's first output's, else what the job makes (`modality`). Never decided by the operation name. */
export function jobOutputKind(job, item = job && job.output) {
  return declaredKind(item) || kindFromUrl(item && item.url) || declaredKind(job && job.output)
    || String((job && job.modality) || '').toLowerCase() || 'video'
}

const EXT_KIND = { png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', avif: 'image',
                   mp4: 'video', webm: 'video', mov: 'video', m4v: 'video',
                   mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio', aac: 'audio', flac: 'audio',
                   vtt: 'other', srt: 'other', txt: 'other', json: 'other', pdf: 'other' }
/** The kind a file's address names by its extension, or '' when it names none. Only for a row the API sends with no
 *  media type (a job's extra results): a caption job's second result is its .vtt file, not a second video. */
export function kindFromUrl(url) {
  const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(String(url || ''))
  return (m && EXT_KIND[m[1].toLowerCase()]) || ''
}

/** The thumbnail URL for a card, or null when it has none (then the card shows the original). Only an image or a
 *  video has one: a caption, a sound or a document never asks the server for a picture (the server answers 404). */
export function thumbnailFor(item) {
  if (!item) return null
  const declared = declaredKind(item)
  if (declared && declared !== 'image' && declared !== 'video') return null
  if (item.thumbnail_url) return item.thumbnail_url
  const kind = mediaKind(item)
  const id = item.attachment_id
  return id != null && id !== '' && (kind === 'image' || kind === 'video') ? thumbnailPath(id) : null
}
