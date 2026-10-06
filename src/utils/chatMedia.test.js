// IMAGES IN AN ANSWER: ONE DOWNLOAD LINK EACH, AND A GRID WHEN THERE ARE SEVERAL (ADM-486).
//
// User report, 2026-09-17: in Work mode an image in the answer could not be previewed or downloaded,
// and a reply with several images drew them as a column of full-width pictures. Checked live on
// 2026-10-06: `/media/<file>.png` answered 200 and its download twin `/media-dl/<file>.png` answered
// 404, because the web server did not route that path. The markup below is what both a chat bubble and
// the Work rail render, so the grid and the download link are pinned here once.
import { describe, it, expect } from 'vitest'
import { enhanceChatMedia, groupImageRuns } from './chatMedia'

const count = (html, needle) => html.split(needle).length - 1

describe('a single image', () => {
  it('gets a download link to the forced-download path and no grid', () => {
    const html = enhanceChatMedia('<p><img src="/media/a.png" alt="a"></p>')
    expect(html).toContain('class="chat-media-img"')
    expect(html).toContain('<a class="chat-media-dl" href="/media-dl/a.png" download')
    expect(html).not.toContain('chat-media-grid')
  })

  it('a bare image link is unfurled with exactly one download button', () => {
    const html = enhanceChatMedia('<p><a href="/media/a.png">/media/a.png</a></p>')
    expect(count(html, 'class="chat-media-wrap"')).toBe(1)
    expect(count(html, 'class="chat-media-dl"')).toBe(1)
  })

  it('keeps an image from another site on its own address', () => {
    const html = enhanceChatMedia('<p><img src="https://store.example/p/x.jpg" alt=""></p>')
    expect(html).toContain('href="https://store.example/p/x.jpg" download')
  })
})

describe('two or more images in a row', () => {
  it('written as separate paragraphs become one grid', () => {
    const html = enhanceChatMedia('<p><img src="/media/a.png" alt=""></p>\n<p><img src="/media/b.png" alt=""></p>')
    expect(count(html, '<span class="chat-media-grid">')).toBe(1)
    expect(count(html, 'class="chat-media-wrap"')).toBe(2)
    expect(count(html, '<p>')).toBe(1)
  })

  it('written on consecutive lines of one paragraph become one grid', () => {
    const html = enhanceChatMedia('<p><img src="/media/a.png" alt=""><br>\n<img src="/media/b.png" alt=""></p>')
    expect(count(html, 'chat-media-grid')).toBe(1)
    expect(html).not.toContain('<br>')
  })

  it('every image keeps its own download link', () => {
    const html = enhanceChatMedia('<p><img src="/media/a.png" alt=""> <img src="/media/b.png" alt=""></p>')
    expect(html).toContain('href="/media-dl/a.png"')
    expect(html).toContain('href="/media-dl/b.png"')
  })

  it('three or more ask for the wider layout', () => {
    const three = ['a', 'b', 'c'].map((n) => `<p><img src="/media/${n}.png" alt=""></p>`).join('\n')
    expect(enhanceChatMedia(three)).toContain('<span class="chat-media-grid chat-media-grid--many">')
    const two = ['a', 'b'].map((n) => `<p><img src="/media/${n}.png" alt=""></p>`).join('\n')
    expect(enhanceChatMedia(two)).not.toContain('chat-media-grid--many')
  })

  it('bare image links that were unfurled are grouped too', () => {
    const html = enhanceChatMedia(
      '<p><a href="/media/a.png">/media/a.png</a></p><p><a href="/media/b.png">/media/b.png</a></p>')
    expect(count(html, 'chat-media-grid')).toBe(1)
    expect(count(html, '<img')).toBe(2)
  })
})

describe('what is not a run of images', () => {
  it('text between two images keeps them apart', () => {
    const html = enhanceChatMedia(
      '<p><img src="/media/a.png" alt=""></p><p>Second option:</p><p><img src="/media/b.png" alt=""></p>')
    expect(html).not.toContain('chat-media-grid')
    expect(html).toContain('<p>Second option:</p>')
  })

  it('a paragraph with words in it is never merged into its neighbour', () => {
    const html = enhanceChatMedia(
      '<p>Logo: <img src="/media/a.png" alt=""></p><p><img src="/media/b.png" alt=""></p>')
    expect(html).not.toContain('chat-media-grid')
    expect(count(html, '<p>')).toBe(2)
  })

  it('a video is left alone', () => {
    const html = enhanceChatMedia('<p><a href="/media/a.mp4">a</a></p><p><a href="/media/b.mp4">b</a></p>')
    expect(html).not.toContain('chat-media-grid')
    expect(count(html, '<video')).toBe(2)
  })

  it('markup with no media comes back unchanged', () => {
    expect(groupImageRuns('<p>hello</p>')).toBe('<p>hello</p>')
    expect(enhanceChatMedia('')).toBe('')
  })
})
