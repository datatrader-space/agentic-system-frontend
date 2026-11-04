// @vitest-environment jsdom
// ADM-1170: a likeness consent could be recorded but never revoked from a screen.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../../services/api', () => ({ default: { listLikenessConsents: vi.fn(), revokeLikenessConsent: vi.fn() } }))
import api from '../../services/api'
import StudioConsents from './StudioConsents.vue'

const row = { attachment_id: 'a1', file_name: 'presenter.png', subject_name: 'Test presenter', basis: 'self', statement_version: 'v', agreed_at: '2026-11-04T10:00:00Z' }

describe('StudioConsents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads the consents only when opened, and revokes one after a confirm', async () => {
    api.listLikenessConsents.mockResolvedValue({ data: { consents: [row] } })
    api.revokeLikenessConsent.mockResolvedValue({ data: { revoked: true } })
    const w = mount(StudioConsents)
    expect(api.listLikenessConsents).not.toHaveBeenCalled()
    w.element.open = true; await w.trigger('toggle'); await flushPromises()
    expect(w.text()).toContain('Test presenter')
    await w.get('[data-test="consent-revoke"]').trigger('click')
    expect(api.revokeLikenessConsent).not.toHaveBeenCalled()                // a confirm first
    await w.get('[data-test="consent-revoke-confirm"]').trigger('click'); await flushPromises()
    expect(api.revokeLikenessConsent).toHaveBeenCalledWith('a1')
    expect(w.text()).toContain('No consents in force.')
  })

  it('says when the list cannot be read', async () => {
    api.listLikenessConsents.mockRejectedValue(new Error('down'))
    const w = mount(StudioConsents)
    w.element.open = true; await w.trigger('toggle'); await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('could not be loaded')
  })
})
