// @vitest-environment jsdom
//
// ADM-1302 — the turn's mode picks how it is drawn: a Work turn on the rail (narration, tool rows, the answer last),
// Chat and Plan turns on today's card. A reload draws the Work rail from the saved snapshot with the same rows the
// live run showed, and the store reads the saved mode back from the answer.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))

import ChatMessage from './ChatMessage.vue'
import { useChatStore } from '../../stores/useChatStore'
import { useAgentTimeline } from '../../composables/useAgentTimeline'

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const mountIt = (message) => mount(ChatMessage, {
  props: { message },
  global: { stubs: { TokenUsage: true, SourcesList: true, ProvenanceFooter: true, MediaThumb: true,
                     'router-link': RouterLink, RouterLink } },
})

// One Work turn's timeline, built by the same reducer the live run uses.
function liveWorkTimeline() {
  const tl = useAgentTimeline()
  tl.reset('work')
  tl.addText('First I read **the file**.', true)
  tl.ingest({ type: 'tool_call', tool: 'CODE_READ_FILE', title: 'Read', tool_call_id: 'c1', tool_input: { path: 'src/app.py' } })
  tl.ingest({ type: 'agent_step_started', step_id: 'step_c1', tool_call_id: 'c1', phase: 'reading', label: 'Reading a file' })
  tl.ingest({ type: 'tool_result', tool: 'CODE_READ_FILE', tool_call_id: 'c1', success: true, output: 'print(1)' })
  tl.ingest({ type: 'agent_step_completed', step_id: 'step_c1', tool_call_id: 'c1', status: 'ok' })
  tl.addText('It prints 1.', true)
  tl.finalize()
  return tl
}

const answer = (over = {}) => ({
  id: 'a1', role: 'assistant', status: 'done', toolCalls: [], planArtifacts: [], content: 'It prints 1.',
  conversationId: '5', ...over,
})

describe('ChatMessage — the turn\'s mode picks the rail or the card', () => {
  let chat
  beforeEach(() => { setActivePinia(createPinia()); chat = useChatStore() })

  it('a Work turn is drawn on the rail: narration, the tool row, the answer last (once)', () => {
    const tl = liveWorkTimeline()
    const m = answer({ turnMode: 'work', timeline: JSON.parse(JSON.stringify(tl.snapshot())) })
    chat.messages = [m]
    const w = mountIt(m)
    expect(w.find('[data-test="work-timeline"]').exists()).toBe(true)
    expect(w.findComponent({ name: 'AgentActivityTimeline' }).exists()).toBe(false)
    expect(w.findAll('[data-test="wt-row"]').map((r) => r.attributes('data-kind'))).toEqual(['text', 'tool', 'answer'])
    expect(w.get('[data-test="work-narration"]').html()).toContain('<strong>the file</strong>')   // the same markdown
    expect(w.findAll('[data-test="work-answer"]').length).toBe(1)
    expect(w.text().match(/It prints 1\./g).length).toBe(1)          // the answer is not drawn twice
    expect(w.find('.msg-actions').exists()).toBe(true)                // copy, feedback, share, regenerate stay
  })

  it('Chat and Plan turns keep today\'s card and answer bubble', () => {
    for (const mode of ['chat', 'plan', '']) {
      const m = answer({ turnMode: mode, timeline: { steps: [{ stepId: 's', label: 'Searching', status: 'ok' }],
                                                     isComplete: true, summary: { finalStatus: 'completed' } } })
      chat.messages = [m]
      const w = mountIt(m)
      expect(w.find('[data-test="work-timeline"]').exists()).toBe(false)
      expect(w.find('.agent-timeline').exists()).toBe(true)
      expect(w.find('.bubble.assistant').exists()).toBe(true)
    }
  })

  it("a reload draws the same rows the live run did (the store's live path, then its reload mapping)", async () => {
    chat.conversationId = 5
    chat.turnMode = 'work'
    chat._beginAssistant()
    const frames = [
      { type: 'assistant_message_chunk', chunk: 'First I read **the file**.', replace: true },
      { type: 'agent_status', phase: 'generating', label: 'Generating response' },
      { type: 'tool_call', tool: 'CODE_READ_FILE', title: 'Read', tool_call_id: 'c1', tool_input: { path: 'src/app.py' } },
      { type: 'agent_step_started', step_id: 'step_c1', tool_call_id: 'c1', phase: 'reading', label: 'Reading a file' },
      { type: 'tool_result', tool: 'CODE_READ_FILE', tool_call_id: 'c1', success: true, output: 'print(1)', result_ref: 'step:3' },
      { type: 'agent_step_completed', step_id: 'step_c1', tool_call_id: 'c1', status: 'ok' },
      { type: 'assistant_message_chunk', chunk: 'It prints ', replace: true },
      { type: 'assistant_message_chunk', chunk: '1.' },
    ]
    for (const f of frames) chat._onEvent(f)
    const live = chat.messages[chat.messages.length - 1]
    expect(live.turnMode).toBe('work')
    const wLive = mountIt(live)
    const liveRows = wLive.findAll('[data-test="wt-row"]').map((r) => [r.attributes('data-kind'), r.text()])
    expect(liveRows.map(([k]) => k)).toEqual(['text', 'tool', 'text'])
    expect(wLive.find('[data-test="wt-status"]').exists()).toBe(true)  // the live status line
    wLive.unmount()

    chat._onEvent({ type: 'assistant_message_complete', full_message: 'It prints 1.' })
    expect(live.timeline.mode).toBe('work')
    // Reload: the saved answer, as the server returns it, mapped by the store.
    const row = { id: 9, role: 'assistant', content: 'It prints 1.',
                  model_info: { turn_mode: 'work', timeline: JSON.parse(JSON.stringify(live.timeline)) } }
    const reloaded = chat._mapServerMessage(row, 5)
    expect(reloaded.turnMode).toBe('work')
    chat.messages = [reloaded]
    const wSaved = mountIt(reloaded)
    const savedRows = wSaved.findAll('[data-test="wt-row"]').map((r) => [r.attributes('data-kind'), r.text()])
    // Live, the last round's text is narration until the turn ends; after, it is the answer. The same rows otherwise.
    expect(savedRows.map(([k]) => k)).toEqual(['text', 'tool', 'answer'])
    expect(savedRows.map(([, t]) => t)).toEqual(liveRows.map(([, t]) => t))
    await wSaved.findAll('[data-test="wt-toggle"]')[0].trigger('click')
    expect(wSaved.findAll('[data-test="wt-toggle"]')[0].text()).toContain('Read')
    expect(wSaved.text()).not.toContain('CODE_READ_FILE')                // never the raw tool name
    expect(wSaved.get('[data-test="wt-in"]').text()).toContain('src/app.py')
    expect(wSaved.get('[data-test="wt-out"]').text()).toBe('print(1)')
  })

  it("the person's message a Work turn answers is a box with its file chips; edit and copy stay", () => {
    const u = { id: 'u1', role: 'user', content: 'fix the build', status: 'done',
                attachments: [{ name: 'log.txt', url: '/media/log.txt' }] }
    const w = mount(ChatMessage, { props: { message: u, workBox: true } })
    expect(w.get('[data-test="work-user-box"]').text()).toContain('fix the build')
    expect(w.get('.user-attach-file').text()).toContain('log.txt')
    expect(w.findAll('.user-actions .msg-action').length).toBe(2)
    expect(mount(ChatMessage, { props: { message: u } }).find('[data-test="work-user-box"]').exists()).toBe(false)
  })

  it('an answer saved before the mode was stamped keeps the card', () => {
    const mapped = useChatStore()._mapServerMessage({ id: 3, role: 'assistant', content: 'x', model_info: {} }, 5)
    expect(mapped.turnMode).toBe('')
  })
})
