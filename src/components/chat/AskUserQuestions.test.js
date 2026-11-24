// @vitest-environment jsdom
// The agent's questions (ASK_USER), drawn as Claude Code draws AskUserQuestion (owner, 2026-11-24: "we dont want
// scroll down"): a tab per question, one question on screen at a time, a Submit tab; a pick in a single-choice question
// moves on; number keys pick; Esc and the X cancel. HITLModal draws it for `payload.kind === 'ask_user'`.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AskUserQuestions from './AskUserQuestions.vue'
import HITLModal from '../HITLModal.vue'

const QS = [
  { question: 'Which database should it use?', header: 'Database', multiSelect: false,
    options: [{ label: 'Postgres', description: 'The one the project runs on' }, { label: 'SQLite', description: 'A file' }] },
  { question: 'Which pages need it?', header: 'Pages', multiSelect: true,
    options: [{ label: 'Login', description: '' }, { label: 'Signup', description: '' }, { label: 'Profile', description: '' }] },
]
const shown = (w, sel) => w.get(sel).element.style.display !== 'none'

describe('AskUserQuestions', () => {
  it('a tab per question plus Submit, and only the active question on screen', () => {
    const w = mount(AskUserQuestions, { props: { questions: QS } })
    const tabs = w.findAll('[role="tab"]')
    expect(tabs.map((t) => t.text())).toEqual(['Database', 'Pages', 'Submit'])
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(tabs[1].attributes('tabindex')).toBe('-1')
    expect(shown(w, '[data-test="auq-q-0"]')).toBe(true)
    expect(shown(w, '[data-test="auq-q-1"]')).toBe(false)
    const q0 = w.get('[data-test="auq-q-0"]')
    expect(q0.text()).toContain('Which database should it use?')
    expect(q0.text()).toContain('The one the project runs on')
    expect(w.get('[data-test="auq-q-1"]').findAll('input[type="checkbox"]').length).toBe(4)   // 3 options + Other
    expect(w.get('[data-test="auq-q-1"]').text()).toContain('Choose any that apply')
    expect(w.find('[data-test="auq-send"]').exists()).toBe(false)                          // Submit lives on its tab
  })

  it('a pick in a single-choice question moves to the next question; the tab shows it answered', async () => {
    vi.useFakeTimers()
    const w = mount(AskUserQuestions, { props: { questions: QS } })
    await w.get('[data-test="auq-opt-0-1"] input').trigger('change')
    await w.get('[data-test="auq-opt-0-1"] input').trigger('click')
    vi.advanceTimersByTime(200)
    await w.vm.$nextTick()
    expect(shown(w, '[data-test="auq-q-1"]')).toBe(true)
    expect(w.get('[data-test="auq-tab-0"]').text()).toContain('(answered)')
    vi.useRealTimers()
  })

  it('submits from the Submit tab only when every question has an answer, with what was picked and the own words', async () => {
    const w = mount(AskUserQuestions, { props: { questions: QS } })
    await w.get('[data-test="auq-opt-0-0"] input').trigger('change')
    await w.get('[data-test="auq-tab-1"]').trigger('click')
    await w.get('[data-test="auq-opt-1-0"] input').trigger('change')
    await w.get('[data-test="auq-opt-1-2"] input').trigger('change')
    await w.get('[data-test="auq-other-1"] input[type="checkbox"]').trigger('change')
    await w.get('[data-test="auq-tab-2"]').trigger('click')
    const send = w.get('[data-test="auq-send"]')
    expect(send.text()).toBe('Submit answers')
    expect(send.attributes('disabled')).toBeDefined()                        // "Other" picked, no words yet
    expect(w.get('[data-test="auq-review"]').text()).toContain('Not answered yet')
    await w.get('[data-test="auq-tab-1"]').trigger('click')
    await w.get('[data-test="auq-other-text-1"]').setValue('  Settings  ')
    await w.get('[data-test="auq-tab-2"]').trigger('click')
    expect(w.get('[data-test="auq-review"]').text()).toContain('Login, Profile, Settings')
    expect(w.get('[data-test="auq-send"]').attributes('disabled')).toBeUndefined()
    await w.get('form').trigger('submit')
    expect(w.emitted('answer')[0][0]).toEqual({ answers: [
      { question: 'Which database should it use?', header: 'Database', selected: ['Postgres'], other: '' },
      { question: 'Which pages need it?', header: 'Pages', selected: ['Login', 'Profile'], other: 'Settings' },
    ] })
  })

  it('one question: no Submit tab, Submit under it; "Other" replaces the option', async () => {
    const w = mount(AskUserQuestions, { props: { questions: [QS[0]] } })
    expect(w.findAll('[role="tab"]').map((t) => t.text())).toEqual(['Database'])
    expect(w.get('[data-test="auq-send"]').text()).toBe('Submit answer')
    await w.get('[data-test="auq-opt-0-0"] input').trigger('change')
    await w.get('[data-test="auq-other-0"] input[type="radio"]').trigger('change')
    await w.get('[data-test="auq-other-text-0"]').setValue('MySQL')
    await w.get('form').trigger('submit')
    expect(w.emitted('answer')[0][0].answers[0]).toMatchObject({ selected: [], other: 'MySQL' })
  })

  it('number keys pick, arrow keys change tabs', async () => {
    const w = mount(AskUserQuestions, { props: { questions: QS } })
    await w.get('form').trigger('keydown', { key: '2' })
    expect(w.get('[data-test="auq-opt-0-1"]').classes()).toContain('on')
    await w.get('[data-test="auq-tabs"]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.get('[data-test="auq-tab-1"]').attributes('aria-selected')).toBe('true')
    await w.get('[data-test="auq-tabs"]').trigger('keydown', { key: 'End' })
    expect(w.get('[data-test="auq-tab-2"]').attributes('aria-selected')).toBe('true')
  })

  it('Esc and the X cancel only when the card can be cancelled; the chevron hides the questions', async () => {
    const off = mount(AskUserQuestions, { props: { questions: QS } })
    expect(off.find('[data-test="auq-cancel"]').exists()).toBe(false)
    await off.get('form').trigger('keydown', { key: 'Escape' })
    expect(off.emitted('cancel')).toBeUndefined()
    const w = mount(AskUserQuestions, { props: { questions: QS, cancellable: true } })
    expect(w.text()).toContain('Esc to cancel')
    await w.get('form').trigger('keydown', { key: 'Escape' })
    await w.get('[data-test="auq-cancel"]').trigger('click')
    expect(w.emitted('cancel').length).toBe(2)
    await w.get('[data-test="auq-collapse"]').trigger('click')
    expect(w.get('[data-test="auq-collapsed-text"]').text()).toBe('The agent has 2 questions for you')
    expect(w.get('[data-test="auq-collapse"]').attributes('aria-expanded')).toBe('false')
  })

  it('HITLModal draws it without its own header, summary or comment box; the answers and the cancel reach the server', async () => {
    const req = { request_id: 'q1', interaction_type: 'question', response_type: 'text', summary: 'The agent has 2 questions',
                  urgency: 'medium', payload: { kind: 'ask_user', questions: QS, allow_text: true } }
    const w = mount(HITLModal, { props: { requests: [req], inline: true }, global: { stubs: { Teleport: true } } })
    expect(w.find('[data-test="ask-user-questions"]').exists()).toBe(true)
    expect(w.find('.modal-header').exists()).toBe(false)
    expect(w.find('.summary').exists()).toBe(false)
    expect(w.find('.feedback-section').exists()).toBe(false)
    expect(w.find('[data-test="hitl-cancel-step"]').exists()).toBe(false)
    await w.get('[data-test="auq-opt-0-1"] input').trigger('change')
    await w.get('[data-test="auq-opt-1-1"] input').trigger('change')
    await w.get('form').trigger('submit')
    const sent = w.emitted('respond')[0][0]
    expect(sent.request_id).toBe('q1')
    expect(sent.response_value.answers.map((a) => a.selected)).toEqual([['SQLite'], ['Signup']])
    const w2 = mount(HITLModal, { props: { requests: [{ ...req, request_id: 'q2' }], inline: true },
                                  global: { stubs: { Teleport: true } } })
    await w2.get('[data-test="auq-cancel"]').trigger('click')
    expect(w2.emitted('respond')[0][0]).toMatchObject({ request_id: 'q2', response_value: false })
  })
})
