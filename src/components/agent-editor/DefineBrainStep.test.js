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


// ── capability pickers offer EVERY model ────────────────────────────────────────────────────────────
//
// They used to be filtered to models whose capability flag was set. The intent was to stop a chat model
// being chosen as the Video generation model; the mechanism was wrong, because the flags are sparse. Of
// 2,863 active models only 321 declare `supports_vision`, 67 `can_generate_images`, 32
// `can_transcribe_audio` — and `can_generate_audio` is set on ZERO, so that picker already fell through
// to the unfiltered list and the dropdowns disagreed with each other.
//
// It also broke search in a way that read as a search bug: the picker can only match what it is handed,
// so typing the name of a hidden model found nothing, and "not in this list" is indistinguishable from
// "search is broken".
//
// So nothing is hidden, and the risk is carried by a WARNING the user can overrule.

const MANY = [
  { id: 10, name: 'gpt-4.1', model_id: 'gpt-4.1', provider: 1, metadata: {} },
  { id: 11, name: 'gpt-4o', model_id: 'gpt-4o', provider: 1, supports_vision: true, metadata: {} },
  { id: 12, name: 'dall-e-3', model_id: 'dall-e-3', provider: 1, can_generate_images: true, metadata: {} },
  { id: 13, name: 'plain-chat', model_id: 'plain-chat', provider: 1, metadata: {} },
]

async function mountWithModels(agent = {}) {
  const api = (await import('../../services/api')).default
  api.get.mockImplementation((url) => {
    if (String(url).includes('providers')) {
      return Promise.resolve({ data: [{ id: 1, name: 'P', provider_type: 'openai' }] })
    }
    return Promise.resolve({ data: MANY })
  })
  return mountExpanded(agent)
}

describe('DefineBrainStep — capability pickers are not filtered', () => {
  it('offers every model to the vision picker, not just the ones flagged supports_vision', async () => {
    const w = await mountWithModels()
    expect(w.vm.modelsFor().length).toBe(MANY.length)
  })

  it('offers the SAME list the main model picker gets', async () => {
    const w = await mountWithModels()
    expect(w.vm.modelsFor().map(m => m.id).sort()).toEqual(w.vm.chatModels.map(m => m.id).sort())
  })

  it('a model with no capability flag at all is still selectable', async () => {
    const w = await mountWithModels()
    expect(w.vm.modelsFor().some(m => m.model_id === 'plain-chat')).toBe(true)
  })
})

describe('DefineBrainStep — the capability warning replaces the filter', () => {
  const visionCap = { field: 'vision_model', label: 'Image input (vision)', capability: 'supports_vision' }

  it('says nothing when nothing is chosen (Auto)', async () => {
    const w = await mountWithModels()
    expect(w.vm.capabilityWarning(visionCap)).toBe('')
  })

  it('says nothing when the chosen model declares the capability', async () => {
    const w = await mountWithModels({ vision_model: 11 })   // gpt-4o, supports_vision
    expect(w.vm.capabilityWarning(visionCap)).toBe('')
  })

  it('warns — and names the model — when it does not declare it', async () => {
    const w = await mountWithModels({ vision_model: 13 })   // plain-chat
    const msg = w.vm.capabilityWarning(visionCap)
    expect(msg).toContain('plain-chat')
    expect(msg).toContain('image input (vision)')
  })

  it('warns without blocking: the choice is still the agent value', async () => {
    const w = await mountWithModels({ vision_model: 13 })
    expect(w._agent.vision_model).toBe(13)
  })

  it('says nothing for a role that declares no capability flag', async () => {
    const w = await mountWithModels({ vision_model: 13 })
    expect(w.vm.capabilityWarning({ field: 'vision_model', label: 'X', capability: null })).toBe('')
  })
})
