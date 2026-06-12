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
// downloads even cross-origin where the <a download> attribute is ignored). Keeps the URL's origin.
const downloadHref = (src) =>
  /\/media\//.test(src) ? src.replace('/media/', '/media-dl/') : src

const DL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>'

// Wrap an inline media <img>/<video> tag in a hover container with a download button.
const wrapWithDownload = (mediaTag, src) =>
  `<span class="chat-media-wrap">${mediaTag}` +
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
  html = html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi, (m, pre, src, post) => {
    if (/chat-media-wrap/.test(m)) return m
    const tag = /\bclass=/.test(pre + post)
      ? `<img${pre}src="${src}"${post}>`
      : `<img class="chat-media-img" ${pre}src="${src}"${post}>`
    return (isImageUrl(src.split('#')[0]) || /\/media\//.test(src)) ? wrapWithDownload(tag, src) : tag
  })

  return html
}

export default enhanceChatMedia
