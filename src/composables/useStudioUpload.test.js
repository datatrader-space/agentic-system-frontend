// @vitest-environment jsdom
// A Studio upload names the file and the reason it failed, in one sentence.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

const { ensureConversation } = vi.hoisted(() => ({ ensureConversation: vi.fn() }))
vi.mock('../stores/useChatStore', () => ({ useChatStore: () => ({ ensureConversation }) }))
vi.mock('../services/api', () => ({ default: { uploadConversationFile: vi.fn() } }))

import api from '../services/api'
import { useStudioUpload } from './useStudioUpload'

function withUpload() {
  let state
  mount(defineComponent({ setup() { state = useStudioUpload(); return () => null } }))
  return state
}

describe('useStudioUpload', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('ends a reason that has its own full stop with one, not two', async () => {
    // Live 2026-10-28: "teapot-3s.mp4: Could not start this Studio session.."
    ensureConversation.mockResolvedValue(null)
    const u = withUpload()
    expect(await u.upload(new File(['x'], 'teapot-3s.mp4', { type: 'video/mp4' }))).toBeNull()
    expect(u.error.value).toBe('teapot-3s.mp4: Could not start this Studio session.')
  })

  it("adds the full stop to the server's reason when it has none", async () => {
    ensureConversation.mockResolvedValue('c1')
    api.uploadConversationFile.mockRejectedValue({ response: { data: { error: { message: 'File too large' } } } })
    const u = withUpload()
    await u.upload(new File(['x'], 'big.mp4', { type: 'video/mp4' }))
    expect(u.error.value).toBe('big.mp4: File too large.')
  })
})
