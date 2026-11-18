// @vitest-environment jsdom
// A card shows the thumbnail, never the whole file; the original only when there is no thumbnail
// (agentic-docs/MEDIA_THUMBNAILS_EVERYWHERE_PLAN.md).
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MediaThumb from './MediaThumb.vue'
import { jobOutputKind, kindFromUrl, mediaKind, thumbnailFor, thumbnailPath } from '../../utils/mediaThumb'

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

describe('a caption, a sound or a document never asks for a thumbnail (live 2026-11-17: a .vtt file got a 404)', () => {
  it('thumbnailFor has none for a declared non-picture, even when something forced a thumbnail address on it', () => {
    expect(thumbnailFor({ attachment_id: 'cap', media_type: 'other', mime_type: 'text/vtt' })).toBe(null)
    expect(thumbnailFor({ attachment_id: 'cap', mime_type: 'text/vtt', thumbnail_url: '/api/library/cap/thumbnail/' })).toBe(null)
    expect(thumbnailFor({ attachment_id: 's', media_type: 'audio', thumbnail_url: '/api/library/s/thumbnail/' })).toBe(null)
  })

  it('a job output takes its kind from the file, then its address, then the job; never from the operation', () => {
    const job = { operation: 'caption', modality: 'video', output: { url: '/m/v.mp4', media_type: 'video' } }
    expect(jobOutputKind(job)).toBe('video')
    expect(jobOutputKind(job, { attachment_id: 'cap', url: '/m/v.vtt' })).toBe('other')
    expect(jobOutputKind(job, { attachment_id: 'x', url: '/m/x' })).toBe('video')
    expect(jobOutputKind({ operation: 'frame', modality: 'video', output: { media_type: 'image' } })).toBe('image')
    expect(jobOutputKind({ operation: 'frame', modality: 'video', output: { url: '/m/f' } })).toBe('video')
    expect(kindFromUrl('/m/a.MP3?x=1')).toBe('audio')
    expect(kindFromUrl('/m/noext')).toBe('')
  })

  it('MediaThumb shows a type icon for a caption file or a sound and requests no picture', () => {
    const cap = mount(MediaThumb, { props: { item: { attachment_id: 'cap', media_type: 'other' }, src: '/m/v.vtt', alt: 'Captions' } })
    expect(cap.find('img').exists()).toBe(false)
    expect(cap.find('video').exists()).toBe(false)
    expect(cap.get('[data-test="media-thumb-file"]').attributes('aria-label')).toBe('Captions')
    const sound = mount(MediaThumb, { props: { item: { attachment_id: 's', media_type: 'audio' }, src: '/m/s.mp3' } })
    expect(sound.html()).not.toContain('/thumbnail/')
    expect(sound.get('[data-test="media-thumb-file"]').attributes('aria-label')).toBe('Sound file')
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

  it('is lazy by default and loads at once when asked (ADM-1247: lazy pictures in a dialog never loaded)', async () => {
    const item = { attachment_id: 'a1', media_type: 'image' }
    expect(mount(MediaThumb, { props: { item } }).get('img').attributes('loading')).toBe('lazy')
    const eager = mount(MediaThumb, { props: { item, src: '/media/full.png', eager: true } })
    expect(eager.get('img').attributes('loading')).toBe('eager')
    await eager.get('img').trigger('error')            // the original it falls back to loads at once too
    expect(eager.get('img').attributes('loading')).toBe('eager')
  })

  it('falls back to the video itself for a video, and to the original for a local preview with no id', async () => {
    const w = mount(MediaThumb, { props: { item: { attachment_id: 'v1', media_type: 'video' }, src: '/media/clip.mp4' } })
    await w.get('img').trigger('error')
    expect(w.get('video').attributes('src')).toBe('/media/clip.mp4')
    const local = mount(MediaThumb, { props: { item: { media_type: 'image' }, src: 'blob:local-preview' } })
    expect(local.get('img').attributes('src')).toBe('blob:local-preview')
  })
})
