// Reference limits per model (VIDEO_STUDIO_L1_FRONTEND_CODEX_BRIEF.md section 3): counted from each route's
// `references` data, a frame is always an image, frames and references never together where the model says so,
// no cap where the maker publishes none, and in Agent mode a file is refused only when no offered model takes it.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), uploadConversationFile: vi.fn() } }))
vi.mock('../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
import { notify } from '../composables/useNotify'
import { referenceProblems, useVideoStore } from './useVideoStore'

const route = (id, references, offered = ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video']) =>
  ({ route_id: id, name: `Model ${id}`, state: 'active', offered, outputs: {}, references })
const TWO_IMAGES = route(1, { frames: ['first_frame', 'last_frame'], images: 2, videos: 0, audio: 0, together: true, summary: 'Opening and closing frames; up to 2 reference images' })
const FRAMES_OR_REFS = route(2, { frames: ['first_frame', 'last_frame'], images: 3, videos: 1, audio: 0, together: false })
const NO_LIMIT = route(3, { frames: ['first_frame'], images: null, videos: null, audio: null, together: null })
const img = (key, role = 'subject') => ({ key, name: `${key}.png`, role, isVideo: false, mime: 'image/png' })
const vid = (key, role = 'subject') => ({ key, name: `${key}.mp4`, role, isVideo: true, mime: 'video/mp4' })

describe('referenceProblems', () => {
  it('blocks a third image and any video on a model that takes 2 images and no videos', () => {
    const p = referenceProblems([img('a'), img('b'), img('c'), vid('d')], TWO_IMAGES, 'quick')
    expect(p).toEqual({ c: 'takes up to 2 reference images', d: 'does not take reference videos' })
  })
  it('never puts a video in the opening or closing frame role', () => {
    expect(referenceProblems([vid('v', 'first_frame')], TWO_IMAGES, 'quick')).toEqual({ v: 'takes only an image as an opening or closing shot' })
  })
  it('blocks frames and references together where the model takes one or the other', () => {
    const p = referenceProblems([img('f', 'first_frame'), img('r')], FRAMES_OR_REFS, 'quick')
    expect(p.f).toBe('takes start and end frames or references, not both')
    expect(p.r).toBe('takes start and end frames or references, not both')
    expect(referenceProblems([img('f', 'first_frame'), img('l', 'last_frame')], FRAMES_OR_REFS, 'quick')).toEqual({})
  })
  it('puts no cap where the maker publishes no limit', () => {
    expect(referenceProblems(Array.from({ length: 12 }, (_, i) => img(`i${i}`)).concat([vid('v')]), NO_LIMIT, 'quick')).toEqual({})
  })
})

describe('the store', () => {
  let video
  beforeEach(() => { setActivePinia(createPinia()); video = useVideoStore(); video.kind = 'video'; video.routes = [TWO_IMAGES, NO_LIMIT]; video.defaultRouteId = 1; vi.clearAllMocks() })
  it('Manual mode: the chosen model decides, and its summary is offered for display', () => {
    video.studioMode = 'manual'
    video.refs = [img('a'), img('b'), img('c')]
    expect(video.unusableRefs.map(r => [r.key, r.problem])).toEqual([['c', 'takes up to 2 reference images']])
    expect(video.referenceLimits).toMatchObject({ images: 2, videos: 0, frames: ['first_frame', 'last_frame'], summary: 'Opening and closing frames; up to 2 reference images' })
  })
  it('Agent mode: a file is refused only when no offered model takes it, and limits are the most any model takes', async () => {
    video.studioMode = 'agent'
    video.refs = [img('a'), img('b'), img('c')]
    expect(video.unusableRefs).toEqual([])                                   // the no-limit model takes three
    expect(video.referenceLimits).toMatchObject({ images: null, videos: null })
    video.routes = [TWO_IMAGES]
    expect(video.unusableRefs.map(r => r.key)).toEqual(['c'])
    const chat = { studioContext: { page: 'video' }, pendingAttachments: [], addExistingMedia: vi.fn(), addAttachments: vi.fn(), sendMessage: vi.fn(async () => true) }
    expect(await video.sendAgentMessage({ prompt: 'Make it', chat })).toBe(false)
    expect(chat.sendMessage).not.toHaveBeenCalled(); expect(notify.warning).toHaveBeenCalled()
    chat.studioContext = { page: 'audio' }                                   // another page's files are its own
    video.refs = [img('a'), img('b'), img('c')]
    expect(await video.sendAgentMessage({ prompt: 'Make it', chat })).toBe(true)
  })
})
