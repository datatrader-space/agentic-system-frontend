// @vitest-environment jsdom
// AN IMAGE IN A WORK ANSWER CAN BE OPENED, DOWNLOADED AND, WITH OTHERS, READ AS A GRID (ADM-486).
//
// User report, 2026-09-17: "in Work mode images can't be previewed or downloaded; in Chat both work."
// A Work answer is drawn on this rail and the chat bubble is not drawn at all, and the rail's click
// handler only knew about file links, so clicking an image did nothing. The preview is now one shared
// component (chat/ImageLightbox.vue) that the bubble and the rail both open.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import RunTimeline from './RunTimeline.vue'
import { useRunTimeline } from '../../stores/useRunTimeline'
import { useChatStore } from '../../stores/useChatStore'

const RUN = 'run_486'
const SNAPSHOT = {
  run_status: 'completed',
  plan_status_label: 'Completed',
  steps: [{ step_id: 'op_1', title: 'Generate the images', status: 'completed', status_user: 'completed' }],
}
const lightbox = () => document.body.querySelector('[data-test="img-lightbox"]')

describe('RunTimeline — images in a Work answer', () => {
  let store
  let wrapper
  beforeEach(() => { setActivePinia(createPinia()); store = useRunTimeline() })
  afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

  const railWith = (content) => {
    const chat = useChatStore()
    chat.messages = [{ id: 'm1', role: 'assistant', content, runId: RUN }]
    store.ingestSnapshot(RUN, SNAPSHOT)
    wrapper = mount(RunTimeline, { props: { runId: RUN }, attachTo: document.body })
    return wrapper
  }
  const md = (w) => w.find('[data-test="rt-answer-md-m1"]')

  it('clicking an image opens the preview with that image', async () => {
    const w = railWith('Here is the logo:\n\n![logo](/media/media_artifacts/logo.png)')
    expect(lightbox()).toBeNull()
    await md(w).find('img.chat-media-img').trigger('click')
    expect(lightbox()).not.toBeNull()
    expect(lightbox().querySelector('img').getAttribute('src')).toBe('/media/media_artifacts/logo.png')
  })

  it('the preview closes on a click outside the image and on Escape', async () => {
    const w = railWith('![logo](/media/a.png)')
    await md(w).find('img.chat-media-img').trigger('click')
    lightbox().click()
    await w.vm.$nextTick()
    expect(lightbox()).toBeNull()
    await md(w).find('img.chat-media-img').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(lightbox()).toBeNull()
  })

  it('the download button is a link to the forced-download path and does not open the preview', async () => {
    const w = railWith('![logo](/media/a.png)')
    const dl = md(w).find('a.chat-media-dl')
    expect(dl.attributes('href')).toBe('/media-dl/a.png')
    expect(dl.attributes('download')).toBeDefined()
    await dl.trigger('click')
    expect(lightbox()).toBeNull()
  })

  it('two images in the answer are drawn as one grid', () => {
    const w = railWith('![one](/media/a.png)\n\n![two](/media/b.png)')
    expect(md(w).findAll('.chat-media-grid')).toHaveLength(1)
    expect(md(w).findAll('.chat-media-grid img.chat-media-img')).toHaveLength(2)
  })

  it('an image a step produced opens the same preview', async () => {
    const chat = useChatStore()
    chat.messages = [
      { id: 'u1', role: 'user', content: 'make an image' },
      { id: 'a1', role: 'assistant', content: '', runId: RUN, status: 'streaming' },
    ]
    chat.liveSteps.splice(0, chat.liveSteps.length, {
      stepId: 'step_c0', toolCallId: 'c0', planStepId: 'op_1', label: 'Generating an image', status: 'ok',
      media: [{ url: '/media/turmeric.png', type: 'image' }],
    })
    const s = { run_id: RUN, run_status: 'executing',
      steps: [{ step_id: 'op_1', title: 'Generate Turmeric', status: 'in_progress', status_user: 'in_progress' }],
      work_goal: { state: 'ACTIVE', verdicts: [], available_actions: [] } }
    store.ingestSnapshot(RUN, s)
    wrapper = mount(RunTimeline, { props: { runId: RUN, goal: s.work_goal }, attachTo: document.body,
      global: { stubs: { SourcesList: true } } })
    await wrapper.find('img.act-thumb').trigger('click')
    expect(lightbox().querySelector('img').getAttribute('src')).toBe('/media/turmeric.png')
  })
})
