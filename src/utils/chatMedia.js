// Shared chat-media helper so EVERY chat UI renders generated/pasted media the same way.
//
// The backend embeds generated images as standard markdown `![](/media/...)` (→ <img>) and videos as a
// bare URL. `marked` already turns `![](url)` into <img>, but a BARE media URL becomes a plain <a>. This
// helper "unfurls" those auto-linked bare media URLs into inline <img>/<video> (Slack-style), and tags
// markdown <img>s with a sizing class. Apply it to the HTML produced by marked in each chat component.

const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?[^"'\s]*)?$/i
const VID_RE = /\.(mp4|webm|ogg|mov|m4v)(\?[^"'\s]*)?$/i

const isImageUrl = (u) =>
  IMG_RE.test(u) || /\/media\/[^"'\s]*\.(png|jpe?g|gif|webp|bmp|svg|avif)/i.test(u)
const isVideoUrl = (u) =>
  VID_RE.test(u) || /\/media\/[^"'\s]*\.(mp4|webm|ogg|mov|m4v)/i.test(u)

// Map a media URL to the forced-download endpoint (server sets Content-Disposition: attachment, so it
// downloads even cross-origin where the <a download> attribute is ignored). ONLY for our own backend's
// root-relative `/media/` — an absolute URL from another origin (e.g. a product image on the store's
// domain) has no `/media-dl/` route there, so we keep it as-is.
const downloadHref = (src) =>
  src.startsWith('/media/') ? src.replace('/media/', '/media-dl/') : src

const DL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>'

// Wrap an inline media <img>/<video> tag in a hover container with a download button.
const WRAP_OPEN = '<span class="chat-media-wrap">'
const wrapWithDownload = (mediaTag, src) =>
  `${WRAP_OPEN}${mediaTag}` +
  `<a class="chat-media-dl" href="${downloadHref(src)}" download title="Download">${DL_ICON}</a></span>`

/**
 * Post-process marked() HTML: unfurl bare media links and size inline images.
 * @param {string} html
 * @returns {string}
 */
export function enhanceChatMedia(html) {
  if (!html || typeof html !== 'string') return html || ''

  // 1) Bare media URLs that marked auto-linked into <a href="...">...</a> → inline media.
  html = html.replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>(.*?)<\/a>/gis, (m, href) => {
    const clean = href.split('#')[0]
    if (isImageUrl(clean)) {
      return wrapWithDownload(`<img src="${href}" class="chat-media-img" alt="image" loading="lazy" />`, href)
    }
    if (isVideoUrl(clean)) {
      return wrapWithDownload(`<video src="${href}" class="chat-media-vid" controls preload="metadata"></video>`, href)
    }
    return m
  })

  // 2) Give every markdown <img> (e.g. ![](/media/...)) the sizing class if it has none, and wrap it
  // with a hover download button.
  html = html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi, (m, pre, src, post, offset, whole) => {
    // An image pass 1 already wrapped must not be wrapped again. This used to test the <img> tag itself
    // for the wrapper's class, which a tag never contains, so every unfurled bare link got a second
    // wrapper and a second download button stacked on the first.
    if (whole.slice(0, offset).endsWith(WRAP_OPEN)) return m
    const tag = /\bclass=/.test(pre + post)
      ? `<img${pre}src="${src}"${post}>`
      : `<img class="chat-media-img" ${pre}src="${src}"${post}>`
    return (isImageUrl(src.split('#')[0]) || /\/media\//.test(src)) ? wrapWithDownload(tag, src) : tag
  })

  // 3) Two or more images in a row are one grid, not a column of full-width pictures.
  return groupImageRuns(html)
}

// One wrapped IMAGE exactly as `wrapWithDownload` writes it (a video is never grouped: it has controls).
const IMG_WRAP = String.raw`<span class="chat-media-wrap"><img\b[^>]*><a class="chat-media-dl"[^>]*>[\s\S]*?</a></span>`
const GAP = String.raw`(?:\s|<br\s*/?>)*`
const IMG_WRAP_RE = new RegExp(IMG_WRAP, 'g')
// Paragraphs that hold nothing but images, one after another (each image written on its own paragraph).
const IMAGE_PARAGRAPHS_RE = new RegExp(String.raw`(?:<p>${GAP}(?:${IMG_WRAP}${GAP})+</p>\s*){2,}`, 'g')
// Images side by side in one block, with or without a line break between them.
const IMAGE_RUN_RE = new RegExp(`${IMG_WRAP}(?:${GAP}${IMG_WRAP})+`, 'g')

/**
 * Group every run of 2+ consecutive images into a grid (ADM-486): 2 columns, 3 on a wide screen when
 * there are 3 or more. Each image keeps its own download button and stays clickable for the preview.
 * A <span>, not a <div>, because the run usually sits inside a <p>, where a <div> is not allowed.
 * @param {string} html  output of the two passes above
 * @returns {string}
 */
export function groupImageRuns(html) {
  if (!html || html.indexOf('chat-media-wrap') === -1) return html
  const merged = html.replace(IMAGE_PARAGRAPHS_RE, (block) => `<p>${block.match(IMG_WRAP_RE).join('')}</p>`)
  return merged.replace(IMAGE_RUN_RE, (run) => {
    const images = run.match(IMG_WRAP_RE)
    const many = images.length >= 3 ? ' chat-media-grid--many' : ''
    return `<span class="chat-media-grid${many}">${images.join('')}</span>`
  })
}

export default enhanceChatMedia
