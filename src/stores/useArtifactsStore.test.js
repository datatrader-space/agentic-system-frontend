// Artifacts panel store — conversation scoping, live append, and the one-row-per-lineage rule.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../services/api', () => ({
  default: {
    getConversationArtifacts: vi.fn(),
    getArtifact: vi.fn(),
    getArtifactPreview: vi.fn(),
    getArtifactVersions: vi.fn(),
    renameArtifact: vi.fn(),
    pinArtifact: vi.fn(),
    deleteArtifact: vi.fn(),
  },
}))
vi.mock('../composables/useNotify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

import api from '../services/api'
import { useArtifactsStore } from './useArtifactsStore'

const row = (over = {}) => ({
  artifact_id: 'a1', name: 'script.py', filename: 'script.py', media_type: 'text/x-python',
  origin: 'AGENT_GENERATED', size: 120, version: 1, created_at: '2026-08-31T10:00:00Z', ...over,
})

const listing = (results, over = {}) => ({
  data: { results, has_more: false, offset: 0, limit: 50, counts_by_origin: {}, ...over },
})

describe('useArtifactsStore', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    api.getConversationArtifacts.mockResolvedValue(listing([]))
    store = useArtifactsStore()
  })

  it('loads a conversation and asks the server for that conversation only', async () => {
    api.getConversationArtifacts.mockResolvedValue(listing([row()]))
    store.bind(42)
    await vi.waitFor(() => expect(store.items).toHaveLength(1))
    expect(api.getConversationArtifacts).toHaveBeenCalledWith(42, expect.objectContaining({ offset: 0 }))
  })

  it('clears the previous chat list when the conversation changes', async () => {
    api.getConversationArtifacts.mockResolvedValue(listing([row()]))
    store.bind(42)
    await vi.waitFor(() => expect(store.items).toHaveLength(1))
    store.selectedId = 'a1'

    api.getConversationArtifacts.mockResolvedValue(listing([]))
    store.bind(43)
    // the switch must not leave one chat's artifacts (or selection) visible under another chat
    expect(store.items).toEqual([])
    expect(store.selectedId).toBeNull()
  })

  it('binding to the same conversation does not wipe what is loaded', async () => {
    api.getConversationArtifacts.mockResolvedValue(listing([row()]))
    store.bind(42)
    await vi.waitFor(() => expect(store.items).toHaveLength(1))
    store.bind(42)
    expect(store.items).toHaveLength(1)
  })

  it('appends a live artifact_created descriptor', () => {
    store.conversationId = 42
    store.onArtifactCreated(row({ artifact_id: 'new1', name: 'out.csv' }))
    expect(store.items[0].artifact_id).toBe('new1')
    expect(store.countsByOrigin.AGENT_GENERATED).toBe(1)
  })

  it('counts unseen artifacts only while the panel is closed', () => {
    store.conversationId = 42
    store.onArtifactCreated(row({ artifact_id: 'x1' }))
    expect(store.unseen).toBe(1)
    store.openPanel(42)
    expect(store.unseen).toBe(0)
    store.onArtifactCreated(row({ artifact_id: 'x2' }))
    expect(store.unseen).toBe(0)          // open panel: the row is already on screen
  })

  it('a new version replaces the row it supersedes instead of duplicating the name', () => {
    store.conversationId = 42
    store.onArtifactCreated(row({ artifact_id: 'v1', version: 1 }))
    store.onArtifactCreated(row({ artifact_id: 'v2', version: 2 }))
    expect(store.items).toHaveLength(1)
    expect(store.items[0]).toMatchObject({ artifact_id: 'v2', version: 2 })
  })

  it('keeps every version as its own row when history is on', () => {
    store.conversationId = 42
    store.showAllVersions = true
    store.onArtifactCreated(row({ artifact_id: 'v1', version: 1 }))
    store.onArtifactCreated(row({ artifact_id: 'v2', version: 2 }))
    expect(store.items).toHaveLength(2)
  })

  it('re-announcing the same artifact updates in place', () => {
    store.conversationId = 42
    store.onArtifactCreated(row({ artifact_id: 'a1', size: 10 }))
    store.onArtifactCreated(row({ artifact_id: 'a1', size: 99 }))
    expect(store.items).toHaveLength(1)
    expect(store.items[0].size).toBe(99)
  })

  it('ignores a malformed descriptor', () => {
    store.onArtifactCreated(null)
    store.onArtifactCreated({})
    expect(store.items).toEqual([])
  })

  it('filters by name and by kind', () => {
    store.items = [row({ artifact_id: '1', name: 'script.py' }),
                   row({ artifact_id: '2', name: 'photo.png', origin: 'USER_UPLOAD' })]
    store.query = 'photo'
    expect(store.filtered.map((a) => a.artifact_id)).toEqual(['2'])
    store.query = ''
    store.originFilter = 'USER_UPLOAD'
    expect(store.filtered.map((a) => a.artifact_id)).toEqual(['2'])
  })

  it('surfaces a load failure instead of showing an empty chat', async () => {
    api.getConversationArtifacts.mockRejectedValue(new Error('boom'))
    store.conversationId = 42
    await store.load()
    expect(store.error).toBeTruthy()
    expect(store.loading).toBe(false)
  })

  it('paginates by appending, tracking the real offset', async () => {
    api.getConversationArtifacts.mockResolvedValue(listing([row({ artifact_id: '1' })], { has_more: true }))
    store.conversationId = 42
    await store.load()
    expect(store.hasMore).toBe(true)
    api.getConversationArtifacts.mockResolvedValue(listing([row({ artifact_id: '2' })]))
    await store.load({ append: true })
    expect(store.items.map((a) => a.artifact_id)).toEqual(['1', '2'])
    expect(api.getConversationArtifacts).toHaveBeenLastCalledWith(42, expect.objectContaining({ offset: 1 }))
  })

  it('scopes the download url to the conversation so a bound artifact resolves', () => {
    store.conversationId = 42
    expect(store.downloadUrl('abc')).toBe('/api/artifacts/abc/download/?conversation_id=42')
    store.conversationId = null
    expect(store.downloadUrl('abc')).toBe('/api/artifacts/abc/download/')
  })

  it('drops a stale selection response when the user clicked on', async () => {
    let resolveFirst
    api.getArtifact.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
    api.getArtifactPreview.mockResolvedValue({ data: { text: 'second' } })
    const first = store.select('slow')
    store.selectedId = 'fast'
    resolveFirst({ data: { artifact_id: 'slow', name: 'slow.txt' } })
    await first
    expect(store.detail).toBeNull()        // the late answer must not overwrite the new selection
  })

  it('removes a deleted artifact and clears the selection', async () => {
    api.deleteArtifact.mockResolvedValue({})
    store.items = [row({ artifact_id: 'gone' })]
    store.selectedId = 'gone'
    await store.remove('gone')
    expect(store.items).toEqual([])
    expect(store.selectedId).toBeNull()
  })
})
