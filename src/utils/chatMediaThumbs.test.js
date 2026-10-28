// @vitest-environment jsdom
// An image or video written into an answer shows the server's small picture of it; a click and the download keep the
// file itself (agentic-docs/MEDIA_THUMBNAILS_EVERYWHERE_PLAN.md step 5).
import { describe, it, expect } from 'vitest'
import { answerThumb, enhanceChatMedia } from './chatMedia'

const thumb = (path) => `/api/library/thumbnail/?src=${encodeURIComponent(path)}`

describe('answerThumb', () => {
  it('is the small picture of this site\'s own /media/ file, by its path', () => {
    expect(answerThumb('/media/media_artifacts/2026/10/27/a.png')).toBe(thumb('/media/media_artifacts/2026/10/27/a.png'))
    expect(answerThumb(`${location.origin}/media/context_files/b.jpg?x=1`)).toBe(thumb('/media/context_files/b.jpg'))
    expect(answerThumb('/media/clips/c.mp4')).toBe(thumb('/media/clips/c.mp4'))
  })

  it('is none for another site, a GIF, an SVG, or anything outside /media/', () => {
    expect(answerThumb('https://store.example/media/p/x.jpg')).toBe('')
    expect(answerThumb('/media/a/moving.gif')).toBe('')
    expect(answerThumb('/media/a/logo.svg')).toBe('')
    expect(answerThumb('/static/a.png')).toBe('')
    expect(answerThumb('')).toBe('')
  })
})

describe('an answer\'s media', () => {
  it('a markdown image shows the small picture and keeps the file for the click and the download', () => {
    const html = enhanceChatMedia('<p><img src="/media/a/one.png" alt="one"></p>')
    expect(html).toContain(`src="${thumb('/media/a/one.png')}" data-full="/media/a/one.png"`)
    expect(html).toContain('href="/media-dl/a/one.png" download')
  })

  it('a bare link to an image does too, and is not given a second small picture', () => {
    const html = enhanceChatMedia('<p><a href="/media/a/two.png">/media/a/two.png</a></p>')
    expect(html.split('data-full=').length - 1).toBe(1)
    expect(html).toContain(`src="${thumb('/media/a/two.png')}"`)
  })

  it('a video keeps playing the file, with the small picture as its poster', () => {
    const html = enhanceChatMedia('<p><a href="/media/clips/c.mp4">clip</a></p>')
    expect(html).toContain(`<video src="/media/clips/c.mp4" poster="${thumb('/media/clips/c.mp4')}"`)
  })

  it('another site\'s picture is shown as it is', () => {
    const html = enhanceChatMedia('<p><img src="https://store.example/p/x.jpg" alt="x"></p>')
    expect(html).toContain('src="https://store.example/p/x.jpg"')
    expect(html).not.toContain('data-full')
  })

  it('a small picture that does not load becomes the file itself', () => {
    document.body.innerHTML = enhanceChatMedia('<p><img src="/media/a/three.png" alt="three"></p>')
    const img = document.querySelector('img')
    expect(img.getAttribute('src')).toBe(thumb('/media/a/three.png'))
    img.dispatchEvent(new Event('error'))                 // not bubbling, as the browser sends it
    expect(img.getAttribute('src')).toBe('/media/a/three.png')
    img.dispatchEvent(new Event('error'))                 // the file failing too changes nothing more
    expect(img.getAttribute('src')).toBe('/media/a/three.png')
  })
})
