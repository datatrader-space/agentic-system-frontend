// @vitest-environment jsdom
// The Let's Code chat is the SAME chat as the main agent chat (owner, 2026-11-06): the shared store streams it and
// ChatMessageList draws it. This panel only points the store at the project (its socket and the shared Coding
// Agent), sends through it, and adds a project turn's own lines under the answer: the files it changed (which open
// Source control) and the running app. There is no diff card: the person commits and pushes in Source control.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const chat = reactive({
  messages: [], hitlRequests: [], isBusy: false, connectionLost: false, conversationId: null,
  repoId: 0, newChatRepoId: null, selectedAgentId: '7', surfaceHandler: null,
  reset: vi.fn(function () { chat.messages = [] }), setAgent: vi.fn((id) => { chat.selectedAgentId = id }),
  sendMessage: vi.fn(() => Promise.resolve(true)), sendRaw: vi.fn(), stop: vi.fn(), openConversation: vi.fn(),
  respondHitl: vi.fn(), dismissHitl: vi.fn(), skipHitl: vi.fn(),
})
vi.mock('@/stores/useChatStore', () => ({ useChatStore: () => chat }))
vi.mock('@/services/api', () => ({
  default: {
    unifiedConfig: vi.fn(() => Promise.resolve({ data: { agent_id: 3527 } })),
    getProjectPreview: vi.fn(() => Promise.resolve({ data: { url: 'https://3000-abcdefgh12345678.proxy.x' } })),
    getConversations: vi.fn(() => Promise.resolve({ data: [] })),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/composables/useVoiceInput', () => ({
  useVoiceInput: () => new Proxy({}, { get: (_t, k) => (k === 'toggle' ? () => {} : { value: false }) }),
}))

// The shared list, reduced to what this panel relies on: one row per message and the `after-message` slot.
const ChatMessageList = {
  setup: () => ({ chat }),
  template: `<div><div v-for="m in chat.messages" :key="m.id" class="row">{{ m.content }}<slot name="after-message" :message="m" /></div></div>`,
}
const stubs = { Icon: true, HITLModal: true, PermissionCard: true, AgentModelPicker: true, ChatMessageList }

async function mountChat() {
  const Chat = (await import('./UnifiedAgentChat.vue')).default
  const w = mount(Chat, { props: { systemId: 5, repoId: 14, crsReady: true }, global: { stubs } })
  await flushPromises()
  return w
}

beforeEach(() => {
  chat.messages = []; chat.repoId = 0; chat.selectedAgentId = '7'; chat.surfaceHandler = null
  vi.clearAllMocks()
})

describe('UnifiedAgentChat on the shared chat', () => {
  it('points the shared chat at the project and the shared Coding Agent, and gives it back on close', async () => {
    const w = await mountChat()
    expect(chat.repoId).toBe(14)
    expect(chat.newChatRepoId).toBe(14)
    expect(chat.setAgent).toHaveBeenCalledWith('3527')
    expect(typeof chat.surfaceHandler).toBe('function')
    w.unmount()
    expect(chat.surfaceHandler).toBe(null)
    expect(chat.repoId).toBe(0)
    expect(chat.newChatRepoId).toBe(null)
    expect(chat.selectedAgentId).toBe('7')
  })

  it('sends through the shared chat, with no mode of its own', async () => {
    const w = await mountChat()
    await w.find('textarea').setValue('fix the header')
    await w.find('button.send').trigger('click')
    await flushPromises()
    expect(chat.sendMessage).toHaveBeenCalledWith('fix the header')
    expect(w.text()).not.toContain('Ask')
    w.unmount()
  })

  it('puts the changed files and the running app under the answer they belong to, and leaves other frames to the chat', async () => {
    const w = await mountChat()
    chat.messages = [{ id: 'u1', role: 'user', content: 'run it' }, { id: 'a1', role: 'assistant', content: 'done' }]
    await flushPromises()
    const files = [{ path: 'app/page.tsx', status: 'modified' }, { path: 'app/new.tsx', status: 'added' }]
    expect(chat.surfaceHandler({ type: 'lets_code_changes', files, total: 2 })).toBe(true)
    expect(chat.surfaceHandler({ type: 'lets_code_preview', port: 3000 })).toBe(true)
    expect(chat.surfaceHandler({ type: 'assistant_message_chunk', chunk: 'x' })).toBe(false)
    expect(chat.surfaceHandler({ type: 'proposed_diff', proposed_diff_id: 9 })).toBe(false)
    await flushPromises()
    expect(w.find('.ai-changes-text').text()).toBe('Changed 2 files: page.tsx, new.tsx')
    expect(w.text()).toContain('The app is running on port 3000')
    expect(w.emitted('changes')).toHaveLength(1)
    w.unmount()
  })

  it('says when earlier changes are still waiting to be committed, and opens Source control on View changes', async () => {
    const w = await mountChat()
    chat.messages = [{ id: 'a1', role: 'assistant', content: 'done' }]
    chat.surfaceHandler({ type: 'lets_code_changes', files: [{ path: 'README.md', status: 'modified' }], total: 4 })
    await flushPromises()
    expect(w.find('.ai-changes-text').text()).toBe('Changed 1 file: README.md · 3 more changes not committed')
    await w.find('.ai-changes-open').trigger('click')
    expect(w.emitted('view-changes')).toHaveLength(1)
    w.unmount()
  })

  it('says a turn changed no files when it wrote nothing', async () => {
    const w = await mountChat()
    chat.messages = [{ id: 'a1', role: 'assistant', content: 'done' }]
    chat.surfaceHandler({ type: 'lets_code_changes', files: [], total: 0 })
    await flushPromises()
    expect(w.find('.ai-changes-text').text()).toBe('No files changed in this turn')
    w.unmount()
  })

  it('opens the preview with a link signed for the person on the click, with no opener', async () => {
    const api = (await import('@/services/api')).default
    const w = await mountChat()
    chat.messages = [{ id: 'a1', role: 'assistant', content: 'done' }]
    chat.surfaceHandler({ type: 'lets_code_preview', port: 3000 })
    await flushPromises()
    expect(api.getProjectPreview).not.toHaveBeenCalled()
    const win = { opener: {}, location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(win)
    await w.find('.ai-preview-open').trigger('click')
    await flushPromises()
    expect(api.getProjectPreview).toHaveBeenCalledWith(14, 3000)
    expect(win.opener).toBe(null)
    expect(win.location.href).toBe('https://3000-abcdefgh12345678.proxy.x')
    open.mockRestore()
    w.unmount()
  })
})
