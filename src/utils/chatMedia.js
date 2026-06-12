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
      return `<img src="${href}" class="chat-media-img" alt="image" loading="lazy" />`
    }
    if (isVideoUrl(clean)) {
      return `<video src="${href}" class="chat-media-vid" controls preload="metadata"></video>`
    }
    return m
  })

  // 2) Give every markdown <img> (e.g. ![](/media/...)) the sizing class if it has none.
  html = html.replace(/<img\b(?![^>]*\bclass=)/gi, '<img class="chat-media-img" ')

  return html
}

export default enhanceChatMedia
