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
vi.mock('../../composables/useSpeech', () => ({
  useSpeech: () => ({ supported: false, listening: { value: false }, toggle: vi.fn() }),
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
    expect(bar).toContain('v-if="chat.isEmpty"')
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

describe('TurnModeSwitch — two buttons, three states', () => {
  // THE DUPLICATE. An "Auto" button carrying a resolved-mode chip rendered as
  // "Auto [Chat] · Chat · Work" -- the word Chat twice, meaning two different things. Auto is the
  // absence of an override, so it is a STATE of this control, never one of its options.
  beforeEach(() => { setActivePinia(createPinia()); try { localStorage.clear() } catch (_e) { /* private */ } })

  it('offers exactly two modes', () => {
    const w = mount(TurnModeSwitch)
    expect(w.findAll('.tms__opt').length).toBe(2)
    expect(w.find('[data-test="turnmode-auto"]').exists()).toBe(false)
  })

  it('still rests on Auto internally, sending no override', () => {
    const chat = useChatStore()
    expect(chat.turnMode).toBe('auto')
    expect(chat.turnMode === 'auto' ? undefined : chat.turnMode).toBe(undefined)
  })

  it('on Auto the highlight REPORTS what the model chose, and is not drawn as a pin', () => {
    const chat = useChatStore()
    chat.messages = [{ id: 'a', role: 'assistant', content: 'x', turnModeResolved: 'work' }]
    const w = mount(TurnModeSwitch)
    const work = w.find('[data-test="turnmode-work"]')
    expect(work.classes()).toContain('is-on')
    expect(work.classes()).not.toContain('is-pinned')
    // …and it is not announced as the user's own choice.
    expect(work.attributes('aria-pressed')).toBe('false')
  })

  it('shows Chat before any turn has run — most turns never need to work', () => {
    const w = mount(TurnModeSwitch)
    expect(w.find('[data-test="turnmode-chat"]').classes()).toContain('is-on')
    expect(w.find('[data-test="turnmode-work"]').classes()).not.toContain('is-on')
  })

  it('clicking pins the mode, and the pin IS sent', async () => {
    const chat = useChatStore()
    const w = mount(TurnModeSwitch)
    await w.find('[data-test="turnmode-chat"]').trigger('click')
    expect(chat.turnMode).toBe('chat')
    expect(chat.turnMode === 'auto' ? undefined : chat.turnMode).toBe('chat')
    expect(w.find('[data-test="turnmode-chat"]').classes()).toContain('is-pinned')
    expect(w.find('[data-test="turnmode-chat"]').attributes('aria-pressed')).toBe('true')
  })

  it('clicking the pinned mode releases it back to Auto — otherwise there is no way back', async () => {
    const chat = useChatStore()
    const w = mount(TurnModeSwitch)
    await w.find('[data-test="turnmode-work"]').trigger('click')
    expect(chat.turnMode).toBe('work')
    await w.find('[data-test="turnmode-work"]').trigger('click')
    expect(chat.turnMode).toBe('auto')
  })

  it('a pin overrides the model — Chat stays lit even after a turn resolved as Work', async () => {
    const chat = useChatStore()
    chat.messages = [{ id: 'a', role: 'assistant', content: 'x', turnModeResolved: 'work' }]
    const w = mount(TurnModeSwitch)
    await w.find('[data-test="turnmode-chat"]').trigger('click')
    expect(w.find('[data-test="turnmode-chat"]').classes()).toContain('is-on')
    expect(w.find('[data-test="turnmode-work"]').classes()).not.toContain('is-on')
  })

  it('an unrecognised value falls back to Auto, never to a silent override', () => {
    const chat = useChatStore()
    chat.setTurnMode('banana')
    expect(chat.turnMode).toBe('auto')
  })
})

describe('TurnModeSwitch — a stored default is not a pin', () => {
  // THE REGRESSION, from production conv 1552. The old store defaulted turnMode to 'chat' and
  // persisted it, while the send site only ever transmitted 'work' -- so a stored 'chat' meant "send
  // nothing". When 'chat' became a real override that stale value became a pin nobody set, and the
  // backend logged "the user chose 'chat' for this turn" on EVERY turn: _freeze_work_goal returned
  // before the Brain's proposal was read, so a long multi-step wall-detection task could never open a
  // work goal. Auto looked fine on screen the entire time.
  beforeEach(() => { setActivePinia(createPinia()); try { localStorage.clear() } catch (_e) { /* private */ } })

  const fresh = () => { setActivePinia(createPinia()); return useChatStore() }

  it('ignores the pre-Auto key, so an old default cannot suppress Work', () => {
    localStorage.setItem('aadml.turnMode', 'chat')
    const chat = fresh()
    expect(chat.turnMode).toBe('auto')
    expect(chat.turnMode === 'auto' ? undefined : chat.turnMode).toBe(undefined)
  })

  it('drops the legacy key outright, so no later version can read it back', () => {
    localStorage.setItem('aadml.turnMode', 'chat')
    fresh()
    expect(localStorage.getItem('aadml.turnMode')).toBe(null)
  })

  it('a deliberate pin DOES survive a reload — it was a real click', () => {
    const chat = fresh()
    chat.setTurnMode('work')
    expect(localStorage.getItem('aadml.turnMode.v2')).toBe('work')
    expect(fresh().turnMode).toBe('work')
  })

  it('and releasing back to Auto survives a reload too', () => {
    const chat = fresh()
    chat.setTurnMode('chat')
    chat.setTurnMode('auto')
    expect(fresh().turnMode).toBe('auto')
  })

  it('an old WORK value is also not honoured — it predates the pin having meaning', () => {
    // 'work' was genuinely sent by the old code, but it was sticky with no way to clear it, so it is
    // no more trustworthy as a standing instruction than the 'chat' default was.
    localStorage.setItem('aadml.turnMode', 'work')
    expect(fresh().turnMode).toBe('auto')
  })
})
