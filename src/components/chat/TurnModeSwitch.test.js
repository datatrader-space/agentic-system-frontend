// @vitest-environment jsdom
//
// The Chat / Work switch, and the control it was moved past.
//
// WHY A TEST ABOUT THE "+" BUTTON LIVES IN THE SWITCH'S FILE. Moving this switch out of the welcome
// composer deleted a span of CSS that ran past the switch's own rules and took `.composer-attach` with
// it. The "+" button kept rendering — correct markup, correct handler, zero width — so every mount test
// still passed and the button was simply not on the screen. The same shape of mistake had already
// shipped this control invisible once. Both are pinned here because they are one lesson: a control that
// EXISTS is not a control a user can SEE.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../composables/useNotify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('../../composables/useVoiceInput', () => ({
  useVoiceInput: () => ({
    supported: false, enabled: { value: false }, disabledMessage: { value: '' },
    state: { value: 'idle' }, elapsed: { value: 0 }, maxSeconds: { value: 120 }, info: { value: null },
    recording: { value: false }, transcribing: { value: false },
    toggle: vi.fn(), start: vi.fn(), stop: vi.fn(), cancel: vi.fn(),
    explainDisabled: vi.fn(), refresh: vi.fn(),
  }),
}))

import TurnModeSwitch from './TurnModeSwitch.vue'
import ChatComposer from './ChatComposer.vue'
import { useChatStore } from '../../stores/useChatStore'

const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf-8')
const styleBlock = (text) => text.slice(text.lastIndexOf('<style'))

beforeEach(() => setActivePinia(createPinia()))

describe('TurnModeSwitch', () => {
  it('offers both modes and writes the chosen mode to the store', async () => {
    const chat = useChatStore()
    const w = mount(TurnModeSwitch)

    expect(w.find('[data-test="turnmode-chat"]').exists()).toBe(true)
    expect(w.find('[data-test="turnmode-work"]').exists()).toBe(true)

    await w.find('[data-test="turnmode-work"]').trigger('click')
    expect(chat.turnMode).toBe('work')
    await w.find('[data-test="turnmode-chat"]').trigger('click')
    expect(chat.turnMode).toBe('chat')
  })

  it('marks the active mode, so the choice is readable without clicking it', async () => {
    const chat = useChatStore()
    const w = mount(TurnModeSwitch)
    expect(w.find('[data-test="turnmode-chat"]').classes()).toContain('is-on')
    expect(w.find('[data-test="turnmode-work"]').classes()).not.toContain('is-on')

    chat.setTurnMode('work')
    await w.vm.$nextTick()
    expect(w.find('[data-test="turnmode-work"]').classes()).toContain('is-on')
    expect(w.find('[data-test="turnmode-chat"]').classes()).not.toContain('is-on')
  })

  it('is styled at both sizes — a compact variant with no rules is an unstyled control', () => {
    const style = styleBlock(src('./TurnModeSwitch.vue'))
    expect(style).toMatch(/\.tms--sm\s*\{/)
    expect(style).toMatch(/\.tms--sm \.tms__opt\s*\{/)
  })
})

describe('where the switch appears', () => {
  it('sits in the thread composer exactly once', () => {
    const w = mount(ChatComposer, {
      props: { agentId: 7, conversationId: 'c1' },
      global: { stubs: { AgentModePicker: { template: '<div />' }, AddDocumentUrl: { template: '<div />' } } },
    })
    expect(w.findAllComponents(TurnModeSwitch)).toHaveLength(1)
    expect(w.findAll('[data-test="turnmode-work"]')).toHaveLength(1)
  })

  it('is shown above the thread only while the conversation is empty', () => {
    // Source-pinned rather than mounted: ChatWorkspace pulls in the whole chat surface, and the fact
    // under test is one directive. Sliced past the comment so prose cannot satisfy the assertion.
    const text = src('./ChatWorkspace.vue')
    const bar = text.slice(text.indexOf('class="turnmode-bar"') - 200, text.indexOf('class="turnmode-bar"') + 60)
    // `showWelcome` is "no messages and no video jobs": a chat whose only content is a video estimate is
    // not empty (its card lives in the thread), so the switch goes with the welcome screen, not with
    // `chat.isEmpty` alone.
    expect(bar).toContain('v-if="showWelcome"')
    expect(text).toContain('const showWelcome = computed(() => chat.isEmpty && ')
    expect(text.match(/<TurnModeSwitch /g) || []).toHaveLength(1)
  })
})

describe('the welcome composer keeps its own controls', () => {
  const welcome = src('./ChatWelcome.vue')

  it('renders the "+" attach button', () => {
    expect(welcome).toContain('data-test="welcome-plus"')
    expect(welcome).toContain('class="composer-attach"')
  })

  it('gives that button a size — this is the rule a style edit deleted', () => {
    const style = styleBlock(welcome)
    const rule = style.slice(style.indexOf('.composer-attach {'))
    expect(style).toContain('.composer-attach {')
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/width:\s*32px/)
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/height:\s*32px/)
  })

  it('does not also carry the switch — one control, one place per state', () => {
    expect(welcome).not.toContain('turnmode')
  })
})

describe('TurnModeSwitch — three modes, no Auto (LONG_RUN phase 5)', () => {
  it('offers exactly Chat, Work and Plan, and no Auto', () => {
    const w = mount(TurnModeSwitch)
    expect(w.findAll('[role="radio"]').map((b) => b.text())).toEqual(['Chat', 'Work', 'Plan'])
    expect(w.find('[data-test="turnmode-auto"]').exists()).toBe(false)
  })

  it('is a radio group: one mode is always selected, and clicking it again keeps it', async () => {
    const chat = useChatStore()
    const w = mount(TurnModeSwitch)
    expect(w.find('[role="radiogroup"]').exists()).toBe(true)
    expect(w.find('[data-test="turnmode-chat"]').attributes('aria-checked')).toBe('true')
    await w.find('[data-test="turnmode-plan"]').trigger('click')
    await w.find('[data-test="turnmode-plan"]').trigger('click')
    expect(chat.turnMode).toBe('plan')
    expect(w.find('[data-test="turnmode-plan"]').attributes('aria-checked')).toBe('true')
    expect(w.findAll('[aria-checked="true"]')).toHaveLength(1)
  })

  it('arrow keys move the selection', async () => {
    const chat = useChatStore()
    const w = mount(TurnModeSwitch, { attachTo: document.body })
    await w.find('[data-test="turnmode-chat"]').trigger('keydown', { key: 'ArrowRight' })
    expect(chat.turnMode).toBe('work')
    await w.find('[data-test="turnmode-work"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(chat.turnMode).toBe('chat')
    await w.find('[data-test="turnmode-chat"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(chat.turnMode).toBe('plan')
    w.unmount()
  })

  it('only the selected mode is in the tab order', () => {
    const w = mount(TurnModeSwitch)
    expect(w.find('[data-test="turnmode-chat"]').attributes('tabindex')).toBe('0')
    expect(w.find('[data-test="turnmode-work"]').attributes('tabindex')).toBe('-1')
  })

  it('says what Work means in words a person reads', () => {
    const w = mount(TurnModeSwitch)
    const hint = w.find('[data-test="turnmode-work"]').attributes('title')
    expect(hint).toContain('three or more steps')
    expect(hint).toContain('notified')
    expect(hint).not.toMatch(/credit|helper|notice/i)
  })

  it('a name that is not a mode changes nothing; there is no Auto to fall back to', () => {
    const chat = useChatStore()
    chat.setTurnMode('work')
    chat.setTurnMode('auto')
    chat.setTurnMode('sudo')
    expect(chat.turnMode).toBe('work')
  })
})

describe("TurnModeSwitch — the mode is the conversation's", () => {
  it("a new chat starts on Chat, a new Let's Code project chat on Work", () => {
    const chat = useChatStore()
    chat.setTurnMode('plan')
    chat.reset()
    expect(chat.turnMode).toBe('chat')
    chat.newChatRepoId = 12
    chat.reset()
    expect(chat.turnMode).toBe('work')
  })

  it('nothing is read from the browser any more: the server keeps the choice', () => {
    localStorage.setItem('aadml.turnMode.v2', 'work')
    setActivePinia(createPinia())
    expect(useChatStore().turnMode).toBe('chat')
    const store = src('../../stores/useChatStore.js')
    expect(store).not.toContain('aadml.turnMode')
    expect(store).toContain("this.turnMode = TURN_MODES.includes(data.turn_mode) ? data.turn_mode : 'chat'")
  })

  it('the mode is always sent with the message', () => {
    const store = src('../../stores/useChatStore.js')
    expect(store).not.toContain("this.turnMode === 'auto'")
    expect(store).toContain('turnMode: this.turnMode,')
  })

  it("the Coding Agent's project chat opens on Work", () => {
    expect(src('../letscode/UnifiedAgentChat.vue')).toContain("chat.setTurnMode('work')")
  })
})
