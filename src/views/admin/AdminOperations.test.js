// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))
import api from '../../services/api'
import AdminOperations from './AdminOperations.vue'

const METRICS = {
  generated_at: '2026-08-06T18:00:00Z', tenant_id: null,
  outbox: { pending: 3, pending_due: 1, dispatched: 42, dead: 2 },
  capability_ledger: { allowed: 100, denied: 5 },
  artifacts: { count: 12, active_grants: 4 },
  ingestion_pipeline: {
    current: { extractor: 'md-1', chunker: 'v3_parent_child', embedding_model_default: 'text-embedding-3-small' },
    stale_sources: 0, stale_chunks: 7,
  },
  scripts: { scripts: 8, versions: 20 },
  storage: { artifact_backend: 's3' },
}

describe('AdminOperations', () => {
  it('calls the admin ops endpoint and renders every subsystem section', async () => {
    api.get.mockResolvedValueOnce({ data: METRICS })
    const w = mount(AdminOperations)
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/ops/metrics/')
    const t = w.text()
    for (const s of ['Task Outbox', 'Capability Broker', 'Artifacts & Storage', 'Ingestion Pipeline', 'Registered Scripts'])
      expect(t).toContain(s)
    expect(t).toContain('s3')                 // storage backend badge
    expect(t).toContain('v3_parent_child')    // pipeline version chip
  })

  it('flags the dead-letter queue as critical (banner + tile)', async () => {
    api.get.mockResolvedValueOnce({ data: METRICS })
    const w = mount(AdminOperations)
    await flushPromises()
    expect(w.find('.ops-banner.critical').exists()).toBe(true)
    expect(w.find('.ops-tile.critical').exists()).toBe(true)
  })

  it('shows a healthy banner when nothing needs attention', async () => {
    api.get.mockResolvedValueOnce({ data: {
      ...METRICS,
      outbox: { pending: 0, pending_due: 0, dispatched: 5, dead: 0 },
      ingestion_pipeline: { current: {}, stale_sources: 0, stale_chunks: 0 },
    } })
    const w = mount(AdminOperations)
    await flushPromises()
    expect(w.find('.ops-banner.healthy').exists()).toBe(true)
  })

  it('renders an admin-gated error state on 403', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 403 } })
    const w = mount(AdminOperations)
    await flushPromises()
    expect(w.find('.ops-error').exists()).toBe(true)
    expect(w.text()).toContain('Admin access')
  })

  it('isolates a guarded/unavailable collector without breaking the page', async () => {
    api.get.mockResolvedValueOnce({ data: { ...METRICS, outbox: { error: 'unavailable' } } })
    const w = mount(AdminOperations)
    await flushPromises()
    expect(w.text()).toContain('unavailable')
    expect(w.text()).toContain('Registered Scripts')   // other sections still render
  })
})
