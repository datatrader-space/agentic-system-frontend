// @vitest-environment jsdom
//
// "SAVED TO MEMORY" IS THE GROUND TRUTH OF A SAVE (backend ADM-1264 M3, owner 2026-11-18).
//
// Chat 1289: the model said "I have noted your preference in my internal memory" and never saved anything. No
// keyword guard catches that; instead every memory that was REALLY saved shows as a "Saved to memory" row under the
// answer, from the server's ledger: live (`memory_saved` frames from `store.announce_saved`) and after a reload
// (`model_info.memories_saved`). The chat store is shared by the dashboard chat and Let's Code, and both draw the
// answer with ChatMessage, so these pin every surface. Nothing saved, no row.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

import ChatMessage from './ChatMessage.vue'
import MemoryChips from './MemoryChips.vue'
import { mergeSavedMemories, useChatStore } from '../../stores/useChatStore'

enableAutoUnmount(afterEach)

const SAVED = { ref: 'm:351', kind: 'fact', id: 351, scope: 'user', via: 'saved',
  text: 'The clothing store ships only within Pakistan.' }
const PROJECT = { ref: 'm:352', kind: 'fact', id: 352, scope: 'project', via: 'saved',
  text: 'The shop deploys with Docker Compose.' }

const mountMessage = (message) => mount(ChatMessage, {
  props: { message },
  global: { stubs: { TokenUsage: true, SourcesList: true, ProvenanceFooter: true, MediaThumb: true } },
})

const answer = (over = {}) => ({ id: 'a1', serverId: 11, role: 'assistant', status: 'complete',
  content: 'I have noted your preference.', toolCalls: [], planArtifacts: [], memories: [], memoriesSaved: [],
  ...over })

describe('the Saved to memory row', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows each memory the turn saved, and where it was kept', () => {
    const w = mount(MemoryChips, {
      props: { message: { memoriesSaved: [SAVED, PROJECT] }, field: 'memoriesSaved', label: 'Saved to memory' },
    })
    const row = w.get('[data-test="memory-saved"]')
    expect(row.text()).toContain('Saved to memory')
    const chips = w.findAll('.mc-chip')
    expect(chips.map((c) => c.attributes('data-ref'))).toEqual(['m:351', 'm:352'])
    expect(chips[0].text()).toContain('You')
    expect(chips[1].text()).toContain('Project')
    expect(chips[0].attributes('title')).toBe(`Saved to memory: ${SAVED.text}`)
  })

  it('is under the answer when something was saved, also while the answer is still being written', () => {
    expect(mountMessage(answer({ memoriesSaved: [SAVED] })).find('[data-test="memory-saved"]').exists()).toBe(true)
    expect(mountMessage(answer({ status: 'streaming', memoriesSaved: [SAVED] }))
      .find('[data-test="memory-saved"]').exists()).toBe(true)
  })

  it('is not there when nothing was saved, whatever the answer says (chat 1289)', () => {
    const w = mountMessage(answer())
    expect(w.text()).toContain('I have noted your preference.')
    expect(w.find('[data-test="memory-saved"]').exists()).toBe(false)
  })

  it('is apart from the memories the answer drew on', () => {
    const used = { ref: 'm:9', kind: 'fact', id: 9, via: 'prompt', status: 'current', text: 'Alice likes tea.' }
    const w = mountMessage(answer({ memories: [used], memoriesSaved: [SAVED] }))
    expect(w.get('[data-test="memory-chips"]').text()).toContain('Memory used')
    expect(w.get('[data-test="memory-chips"]').text()).not.toContain(SAVED.text)
    expect(w.get('[data-test="memory-saved"]').text()).not.toContain('Alice likes tea.')
  })
})

describe('the memory_saved frame', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('puts a save on the answer being written', () => {
    const chat = useChatStore()
    chat.conversationId = '7'
    chat.messages = [answer({ id: 'a0', serverId: 10, status: 'complete' })]
    chat._beginAssistant()
    chat._onEvent({ type: 'memory_saved', conversation_id: '7', memories: [SAVED] })
    expect(chat.messages[chat.messages.length - 1].memoriesSaved).toEqual([SAVED])
    expect(chat.messages[0].memoriesSaved).toEqual([])
  })

  it("puts a learner's save after the turn on the last answer, once", () => {
    const chat = useChatStore()
    chat.conversationId = '7'
    chat.messages = [answer({ id: 'a0', serverId: 10 }), { id: 'u1', role: 'user', content: 'x' }, answer()]
    chat._onEvent({ type: 'memory_saved', conversation_id: '7', memories: [SAVED] })
    chat._onEvent({ type: 'memory_saved', conversation_id: '7', memories: [SAVED, PROJECT] })
    expect(chat.messages[2].memoriesSaved).toEqual([SAVED, PROJECT])
    expect(chat.messages[0].memoriesSaved).toEqual([])
  })

  it("ignores another chat's save", () => {
    const chat = useChatStore()
    chat.conversationId = '7'
    chat.messages = [answer()]
    chat._onEvent({ type: 'memory_saved', conversation_id: '8', memories: [SAVED] })
    expect(chat.messages[0].memoriesSaved).toEqual([])
  })

  it('a reloaded answer keeps the row the server holds', () => {
    const chat = useChatStore()
    const m = chat._mapServerMessage({ id: 11, role: 'assistant', content: 'ok',
      model_info: { memories_saved: [SAVED] } }, 7)
    expect(m.memoriesSaved).toEqual([SAVED])
    const none = chat._mapServerMessage({ id: 12, role: 'assistant', content: 'ok', model_info: {} }, 7)
    expect(none.memoriesSaved).toEqual([])
  })

  it('merges by memory id, keeping the order they were saved in', () => {
    expect(mergeSavedMemories([SAVED], [SAVED, PROJECT])).toEqual([SAVED, PROJECT])
    expect(mergeSavedMemories(undefined, [PROJECT])).toEqual([PROJECT])
    expect(mergeSavedMemories([SAVED], null)).toEqual([SAVED])
  })
})
