// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (String(url).includes('providers')) {
        return Promise.resolve({ data: [{ id: 1, name: 'P', provider_type: 'openai' }] })
      }
      return Promise.resolve({ data: [{ id: 10, name: 'gpt', model_id: 'gpt', provider: 1, metadata: {} }] })
    }),
    getAgentEffectivePolicy: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))
vi.mock('vue-router', () => ({ RouterLink: { template: '<a><slot/></a>' } }))

import DefineBrainStep from './DefineBrainStep.vue'

const stubs = {
  ModelPicker: { template: '<div class="model-picker-stub" />' },
  ContextProfilePicker: { template: '<div />' },
  RouterLink: { template: '<a><slot/></a>' },
}

// Expand the AI Model card (Edit) and select a provider so the capability rows render.
async function mountExpanded(agent = {}) {
  const a = { id: 1, ...agent }
  const w = mount(DefineBrainStep, { props: { agent: a }, global: { stubs } })
  await flushPromises()
  await w.find('.model-card .edit-btn').trigger('click')
  await nextTick()
  await w.find('.model-card select').setValue('1')  // selectedProvider
  await nextTick()
  w._agent = a
  return w
}

describe('DefineBrainStep — advanced document-ingestion capability rows', () => {
  it('shows an Audio transcription row (speech-to-text) with ingestion helper text', async () => {
    const w = await mountExpanded()
    const row = w.find('[data-test="cap-audio_transcription_model"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('Audio transcription')
    expect(row.text().toLowerCase()).toContain('document indexing')
  })

  it('keeps a separate Audio generation row (text-to-speech), not renamed', async () => {
    const w = await mountExpanded()
    expect(w.find('[data-test="cap-audio_model"]').text()).toContain('Audio generation')
  })

  it('shows the existing Image input (vision) row', async () => {
    const w = await mountExpanded()
    expect(w.find('[data-test="cap-vision_model"]').text()).toContain('Image input (vision)')
  })

  it('shows a YouTube transcript provider select with the three options', async () => {
    const w = await mountExpanded()
    const row = w.find('[data-test="cap-youtube_transcript_provider"]')
    expect(row.exists()).toBe(true)
    const opts = row.findAll('option').map((o) => o.element.value)
    expect(opts).toEqual(['auto', 'disabled', 'audio_fallback'])
  })

  it('binds the YouTube select to agent.youtube_transcript_provider', async () => {
    const w = await mountExpanded({ youtube_transcript_provider: 'auto' })
    await w.find('[data-test="cap-youtube_transcript_provider"] select').setValue('disabled')
    expect(w._agent.youtube_transcript_provider).toBe('disabled')
  })

  it('renders all capability rows in the expected order', async () => {
    const w = await mountExpanded()
    for (const f of ['image_model', 'vision_model', 'audio_transcription_model', 'audio_model', 'video_model']) {
      expect(w.find(`[data-test="cap-${f}"]`).exists()).toBe(true)
    }
    expect(w.find('[data-test="cap-youtube_transcript_provider"]').exists()).toBe(true)
  })
})
