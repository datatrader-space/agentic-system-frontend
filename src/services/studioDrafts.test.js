// @vitest-environment jsdom
// Unsent Studio drafts live on this device only: text and plain settings, 7 days at most, removed on sign-out.
import { beforeEach, expect, it } from 'vitest'
import { reactive } from 'vue'
import { studioDraftKey, readLocalDraft, keepLocalDraft, dropLocalDraft, clearStudioDrafts, plainDraft, STUDIO_DRAFT_MAX_AGE_MS } from './studioDrafts'
beforeEach(() => localStorage.clear())
const DAY = 24 * 60 * 60 * 1000

it('keys a draft by person, page and conversation, and keeps none without a signed-in person', () => {
  expect(studioDraftKey('7', 'music', '')).toBe('aadml.studio.draft.v1.7.music.new')
  expect(studioDraftKey('7', 'music', 'c1')).not.toBe(studioDraftKey('8', 'music', 'c1'))
  expect(studioDraftKey('a.b', 'music', 'c')).toBe('aadml.studio.draft.v1.a%2Eb.music.c')
  expect(studioDraftKey('', 'music', 'c1')).toBe('')
  keepLocalDraft('', { agentDraft: 'x' }); expect(localStorage.length).toBe(0)
})

it('writes text and plain settings only: never a file, a list of references or a nested object', () => {
  const file = new File(['secret'], 'me.png', { type: 'image/png' })
  const settings = reactive({ duration: 5, aspect_ratio: '16:9', sound: true, file })
  const clean = plainDraft({ agentDraft: 'Hello', file, refs: [{ attachment_id: 4, url: 'https://signed.example/x?token=abc' }], settings, deep: { inner: { token: 'abc' } }, n: NaN })
  expect(clean).toEqual({ agentDraft: 'Hello', settings: { duration: 5, aspect_ratio: '16:9', sound: true }, deep: {} })
  const key = studioDraftKey('7', 'video', '')
  keepLocalDraft(key, { agentDraft: 'Hello', refs: [{ url: 'https://signed.example/x?token=abc' }], file })
  const stored = localStorage.getItem(key)
  expect(stored).toContain('Hello'); expect(stored).not.toContain('token'); expect(stored).not.toContain('me.png')
  expect(readLocalDraft(key)).toEqual({ agentDraft: 'Hello' })
})

it('removes an entry instead of keeping a draft without text', () => {
  const key = studioDraftKey('7', 'music', '')
  keepLocalDraft(key, { agentDraft: 'Draft' }); expect(localStorage.getItem(key)).not.toBeNull()
  keepLocalDraft(key, { agentDraft: '   ', variant: 2 }); expect(localStorage.getItem(key)).toBeNull()
})

it('drops a draft older than 7 days when read, and this person\'s other expired drafts with it', () => {
  const now = Date.now(), old = studioDraftKey('7', 'music', 'a'), fresh = studioDraftKey('7', 'music', 'b'), stale = studioDraftKey('7', 'audio', '')
  keepLocalDraft(old, { agentDraft: 'Old' }, now - STUDIO_DRAFT_MAX_AGE_MS - 1)
  keepLocalDraft(stale, { agentDraft: 'Stale' }, now - 8 * DAY)
  keepLocalDraft(fresh, { agentDraft: 'Fresh' }, now - 6 * DAY)
  expect(readLocalDraft(old, now)).toBeNull()
  expect(localStorage.getItem(old)).toBeNull(); expect(localStorage.getItem(stale)).toBeNull()
  expect(readLocalDraft(fresh, now)).toEqual({ agentDraft: 'Fresh' })
})

it('drops a malformed or undated entry', () => {
  const key = studioDraftKey('7', 'music', '')
  localStorage.setItem(key, '{not json'); expect(readLocalDraft(key)).toBeNull(); expect(localStorage.getItem(key)).toBeNull()
  localStorage.setItem(key, JSON.stringify({ draft: { agentDraft: 'No time' } })); expect(readLocalDraft(key)).toBeNull()
})

it('sign-out removes every Studio draft of the person and nothing else', () => {
  keepLocalDraft(studioDraftKey('7', 'music', ''), { agentDraft: 'Mine' })
  keepLocalDraft(studioDraftKey('7', 'image', 'c2'), { details: 'Mine too' })
  keepLocalDraft(studioDraftKey('70', 'music', ''), { agentDraft: 'Another person' })
  localStorage.setItem('aadml.studio.mode.7', 'manual')
  clearStudioDrafts('7')
  expect(Object.keys(localStorage).sort()).toEqual(['aadml.studio.draft.v1.70.music.new', 'aadml.studio.mode.7'])
  clearStudioDrafts()
  expect(Object.keys(localStorage)).toEqual(['aadml.studio.mode.7'])
  dropLocalDraft('', 'missing')
})
