// @vitest-environment jsdom
// The Publish page (backend CREATIVE_SUITE_P7_P8_PLAN.md): the person's own accounts, a post now or later, and their
// posts with status. Connecting uses the platform's one sign-in popup; nothing is published without the button.
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const conn = (platform, label, over = {}) => ({ platform, label, service_id: { youtube: 11, tiktok: 12, instagram: 13, facebook: 14, linkedin: 15, x: 16 }[platform],
  configured: true, connected: false, needs_reconnect: false, account: '', fields: { title: true, description: true, tags: true, thumbnail: true, captions: true },
  max_title: 0, max_text: 0, max_tags: 0, combined_text: false, privacy_options: [], needs_destination: false, review_note: '', ...over })

const state = vi.hoisted(() => ({ connections: [], publications: [] }))
vi.mock('../services/api', () => ({ default: {
  getPublishConnections: vi.fn(() => Promise.resolve({ data: { connections: state.connections } })),
  getPublications: vi.fn(() => Promise.resolve({ data: { publications: state.publications } })),
  getPublishDestinations: vi.fn(() => Promise.resolve({ data: { destinations: [{ id: '111', name: 'Bakery' }] } })),
  createPublication: vi.fn(() => Promise.resolve({ data: { publication_id: 'p1', status: 'scheduled', scheduled_at: null } })),
  publicationAction: vi.fn(() => Promise.resolve({ data: {} })),
  startOAuth: vi.fn(() => Promise.resolve({ data: { redirect_url: 'https://accounts.example/authorize' } })),
  disconnectOAuth: vi.fn(() => Promise.resolve({ data: { disconnected: true } })),
  get: vi.fn((url, cfg) => Promise.resolve({ data: url.startsWith('/video/library/')
    ? { items: cfg.params.type === 'video' ? [{ attachment_id: 'vid-1', title: 'Launch cut', media_type: 'video' }] : [{ attachment_id: 'pic-1', title: 'Cover', media_type: 'image' }], has_more: false }
    : { projects: [{ project_id: 'proj-1', title: 'Launch' }] } })),
} }))
vi.mock('@/composables/useOAuthPopup', () => ({ runOAuthPopup: vi.fn(() => Promise.resolve({ ok: true })) }))

import VideoStudioPublish from './VideoStudioPublish.vue'
import api from '../services/api'
import { runOAuthPopup } from '@/composables/useOAuthPopup'

beforeEach(() => {
  vi.clearAllMocks()
  state.connections = [conn('youtube', 'YouTube', { connected: true, account: 'Ana Channel', privacy_options: ['private', 'unlisted', 'public'], max_title: 100 }),
    conn('tiktok', 'TikTok', { configured: false }), conn('x', 'X', { combined_text: true, max_text: 280, fields: { thumbnail: false, captions: false } }),
    conn('facebook', 'Facebook', { connected: true, needs_destination: true })]
  state.publications = []
})

describe('VideoStudioPublish', () => {
  it('shows each account as the person has it, and never a token', async () => {
    const w = mount(VideoStudioPublish)
    await flushPromises()
    expect(w.get('[data-test="vpb-account-youtube"]').text()).toContain('Connected as Ana Channel')
    expect(w.get('[data-test="vpb-account-tiktok"]').text()).toContain('Not set up on this platform yet')
    expect(w.find('[data-test="vpb-connect-tiktok"]').exists()).toBe(false)
    expect(w.get('[data-test="vpb-account-x"]').text()).toContain('Not connected')
    expect(w.find('[data-test="vpb-connect-x"]').exists()).toBe(true)
  })

  it('connects through the shared sign-in popup with the service id', async () => {
    const w = mount(VideoStudioPublish)
    await flushPromises()
    await w.get('[data-test="vpb-connect-x"]').trigger('click')
    expect(runOAuthPopup).toHaveBeenCalledOnce()
    await runOAuthPopup.mock.calls[0][0]()
    expect(api.startOAuth).toHaveBeenCalledWith(16)
  })

  it('asks before disconnecting, inline (no browser dialog)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const w = mount(VideoStudioPublish)
    await flushPromises()
    await w.get('[data-test="vpb-disconnect-youtube"]').trigger('click')
    expect(api.disconnectOAuth).not.toHaveBeenCalled()
    await w.get('[data-test="vpb-disconnect-yes-youtube"]').trigger('click')
    await flushPromises()
    expect(api.disconnectOAuth).toHaveBeenCalledWith(11)
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('publishes the chosen video with an idempotency key, and the same key on a retried send', async () => {
    api.createPublication.mockRejectedValueOnce({ response: { status: 503 } })
    const w = mount(VideoStudioPublish)
    await flushPromises()
    await w.get('[data-test="vpb-video"]').setValue('vid-1')
    await w.get('[data-test="vpb-title"]').setValue('Launch day')
    await w.get('[data-test="vpb-tags"]').setValue('launch, #studio')
    await w.get('[data-test="vpb-privacy"]').setValue('unlisted')
    await w.get('[data-test="vpb-form"]').trigger('submit')
    await flushPromises()
    await w.get('[data-test="vpb-form"]').trigger('submit')
    await flushPromises()
    const [[body, key1], [, key2]] = api.createPublication.mock.calls
    expect(body).toMatchObject({ platform: 'youtube', video_id: 'vid-1', title: 'Launch day', tags: ['launch', 'studio'], privacy: 'unlisted' })
    expect(key1).toBeTruthy()
    expect(key2).toBe(key1)
  })

  it('shows the server refusal next to the form', async () => {
    api.createPublication.mockRejectedValueOnce({ response: { status: 409, data: { error: { message: 'Connect YouTube first.' } } } })
    const w = mount(VideoStudioPublish)
    await flushPromises()
    await w.get('[data-test="vpb-video"]').setValue('vid-1')
    await w.get('[data-test="vpb-form"]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-test="vpb-error"]').text()).toBe('Connect YouTube first.')
  })

  it('schedules for a chosen time, sent as UTC', async () => {
    const w = mount(VideoStudioPublish)
    await flushPromises()
    await w.get('[data-test="vpb-video"]').setValue('vid-1')
    await w.get('[data-test="vpb-later"]').setValue(true)
    await w.get('[data-test="vpb-at"]').setValue('2030-05-01T09:30')
    await w.get('[data-test="vpb-submit"]').trigger('submit')
    await flushPromises()
    expect(api.createPublication.mock.calls[0][0].scheduled_at).toBe(new Date('2030-05-01T09:30').toISOString())
  })

  it('a Facebook post lists the person\'s own Pages to choose from', async () => {
    const w = mount(VideoStudioPublish)
    await flushPromises()
    await w.get('[data-test="vpb-platform"]').setValue('facebook')
    await flushPromises()
    expect(api.getPublishDestinations).toHaveBeenCalledWith('facebook')
    expect(w.get('[data-test="vpb-destination"]').text()).toContain('Bakery')
  })

  it('says what a platform cannot take before publishing', async () => {
    state.connections[2].connected = true
    const w = mount(VideoStudioPublish)
    await flushPromises()
    await w.get('[data-test="vpb-platform"]').setValue('x')
    await w.get('[data-test="vpb-thumbnail"]').setValue('pic-1')
    await w.get('[data-test="vpb-project"]').setValue('proj-1')
    expect(w.get('[data-test="vpb-not-sent"]').text()).toContain('Not sent to X: the thumbnail')
    expect(w.get('[data-test="vpb-not-sent"]').text()).toContain('captions')
    await w.get('[data-test="vpb-title"]').setValue('t'.repeat(300))
    expect(w.get('[data-test="vpb-text-count"]').classes()).toContain('over')
  })

  it('lists posts with their status and offers cancel or try again', async () => {
    state.publications = [
      { publication_id: 'a', platform: 'youtube', label: 'YouTube', status: 'published', title: 'One', remote_url: 'https://www.youtube.com/watch?v=1', not_sent: [], published_at: '2026-11-17T10:00:00Z', created_at: '2026-11-17T09:00:00Z' },
      { publication_id: 'b', platform: 'youtube', label: 'YouTube', status: 'failed', title: 'Two', error: { code: 'reconnect', message: 'Your YouTube sign-in is no longer accepted.' }, not_sent: [], created_at: '2026-11-17T09:00:00Z' },
      { publication_id: 'c', platform: 'youtube', label: 'YouTube', status: 'scheduled', title: 'Three', scheduled_at: '2030-01-01T00:00:00Z', attempts: 0, max_attempts: 4, not_sent: [], created_at: '2026-11-17T09:00:00Z' }]
    const w = mount(VideoStudioPublish)
    await flushPromises()
    expect(w.get('[data-test="vpb-post-published"]').find('a').attributes('href')).toBe('https://www.youtube.com/watch?v=1')
    expect(w.get('[data-test="vpb-post-failed"]').text()).toContain('no longer accepted')
    await w.get('[data-test="vpb-retry"]').trigger('click')
    await w.get('[data-test="vpb-cancel"]').trigger('click')
    expect(api.publicationAction.mock.calls).toEqual([['b', 'retry'], ['c', 'cancel']])
  })
})
