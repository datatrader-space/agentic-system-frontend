// @vitest-environment jsdom
// A card shows the thumbnail, never the whole file; the original only when there is no thumbnail
// (agentic-docs/MEDIA_THUMBNAILS_EVERYWHERE_PLAN.md).
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MediaThumb from './MediaThumb.vue'
import { mediaKind, thumbnailFor, thumbnailPath } from '../../utils/mediaThumb'

describe('thumbnailFor', () => {
  it('uses the thumbnail the server gave, else builds it from the file id of an image or a video', () => {
    expect(thumbnailFor({ thumbnail_url: '/given.webp', attachment_id: 'a' })).toBe('/given.webp')
    expect(thumbnailFor({ attachment_id: 'a-1', media_type: 'image' })).toBe('/api/library/a-1/thumbnail/')
    expect(thumbnailFor({ attachment_id: 'v', type: 'video' })).toBe(thumbnailPath('v'))
    expect(thumbnailFor({ attachment_id: 'p', isImage: true })).toBe(thumbnailPath('p'))
    expect(thumbnailFor({ attachment_id: 'm', mime_type: 'video/mp4' })).toBe(thumbnailPath('m'))
  })

  it('has none for audio, a document, a file with no id, or nothing', () => {
    expect(thumbnailFor({ attachment_id: 's', media_type: 'audio' })).toBe(null)
    expect(thumbnailFor({ attachment_id: 'd', mime: 'application/pdf' })).toBe(null)
    expect(thumbnailFor({ media_type: 'image', url: 'blob:local' })).toBe(null)
    expect(thumbnailFor(null)).toBe(null)
    expect(mediaKind({ type: 'IMAGE' })).toBe('image')
  })
})

describe('MediaThumb', () => {
  it('shows the thumbnail, not the original, and keeps the card class and click', async () => {
    const onClick = vi.fn()
    const w = mount(MediaThumb, { props: { item: { attachment_id: 'a1', media_type: 'image' }, src: '/media/full.png', alt: 'A mug' },
                                  attrs: { class: 'card-img', onClick } })
    const img = w.get('img')
    expect(img.attributes('src')).toBe('/api/library/a1/thumbnail/')
    expect(img.attributes('alt')).toBe('A mug')
    expect(img.classes()).toContain('card-img')
    await img.trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('falls back to the original image when the thumbnail does not load', async () => {
    const w = mount(MediaThumb, { props: { item: { attachment_id: 'a1', media_type: 'image' }, src: '/media/full.png' } })
    await w.get('img').trigger('error')
    expect(w.get('img').attributes('src')).toBe('/media/full.png')
  })

  it('falls back to the video itself for a video, and to the original for a local preview with no id', async () => {
    const w = mount(MediaThumb, { props: { item: { attachment_id: 'v1', media_type: 'video' }, src: '/media/clip.mp4' } })
    await w.get('img').trigger('error')
    expect(w.get('video').attributes('src')).toBe('/media/clip.mp4')
    const local = mount(MediaThumb, { props: { item: { media_type: 'image' }, src: 'blob:local-preview' } })
    expect(local.get('img').attributes('src')).toBe('blob:local-preview')
  })
})
