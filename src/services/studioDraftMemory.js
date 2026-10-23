// Local File objects stay in this tab's memory only. Never serialize them or their blob URLs.
const drafts = new Map()
export function readStudioDraft(key) { return key ? drafts.get(key) : null }
export function keepStudioDraft(key, draft) {
  if (!key) return
  drafts.delete(key); drafts.set(key, draft)
  if (drafts.size > 32) drafts.delete(drafts.keys().next().value)
}

export function clearStudioDraftMemory() { drafts.clear() }
