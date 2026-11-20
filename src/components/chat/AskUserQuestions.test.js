// @vitest-environment jsdom
// The agent's questions (ASK_USER, Claude Code's AskUserQuestion shape): one to four questions, each with a header,
// options with what each means, single or multiple choice, and "Other" in the person's own words; one Send, enabled
// once every question has an answer. HITLModal draws it for `payload.kind === 'ask_user'`.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AskUserQuestions from './AskUserQuestions.vue'
import HITLModal from '../HITLModal.vue'

const QS = [
  { question: 'Which database should it use?', header: 'Database', multiSelect: false,
    options: [{ label: 'Postgres', description: 'The one the project runs on' }, { label: 'SQLite', description: 'A file' }] },
  { question: 'Which pages need it?', header: 'Pages', multiSelect: true,
    options: [{ label: 'Login', description: '' }, { label: 'Signup', description: '' }, { label: 'Profile', description: '' }] },
]

describe('AskUserQuestions', () => {
  it('shows each question with its header, options and descriptions, and "Other"', () => {
    const w = mount(AskUserQuestions, { props: { questions: QS } })
    const q0 = w.get('[data-test="auq-q-0"]')
    expect(q0.text()).toContain('Database')
    expect(q0.text()).toContain('Which database should it use?')
    expect(q0.text()).toContain('The one the project runs on')
    expect(q0.find('input[type="radio"]').exists()).toBe(true)
    expect(w.get('[data-test="auq-q-1"]').findAll('input[type="checkbox"]').length).toBe(4)   // 3 options + Other
    expect(w.get('[data-test="auq-q-1"]').text()).toContain('Choose any that apply')
    expect(w.find('[data-test="auq-other-0"]').exists()).toBe(true)
  })

  it('sends only when every question has an answer, with what was picked and the own words', async () => {
    const w = mount(AskUserQuestions, { props: { questions: QS } })
    const send = w.get('[data-test="auq-send"]')
    expect(send.attributes('disabled')).toBeDefined()
    expect(send.text()).toBe('Send answers')
    await w.get('[data-test="auq-opt-0-0"] input').setValue(true)
    expect(send.attributes('disabled')).toBeDefined()
    await w.get('[data-test="auq-opt-1-0"] input').trigger('change')
    await w.get('[data-test="auq-opt-1-2"] input').trigger('change')
    await w.get('[data-test="auq-other-text-1"]').trigger('focus')
    expect(send.attributes('disabled')).toBeDefined()                        // "Other" picked, no words yet
    await w.get('[data-test="auq-other-text-1"]').setValue('  Settings  ')
    expect(send.attributes('disabled')).toBeUndefined()
    await w.get('form').trigger('submit')
    expect(w.emitted('answer')[0][0]).toEqual({ answers: [
      { question: 'Which database should it use?', header: 'Database', selected: ['Postgres'], other: '' },
      { question: 'Which pages need it?', header: 'Pages', selected: ['Login', 'Profile'], other: 'Settings' },
    ] })
  })

  it('a single choice: picking another option replaces it, and "Other" replaces the option', async () => {
    const w = mount(AskUserQuestions, { props: { questions: [QS[0]] } })
    expect(w.get('[data-test="auq-send"]').text()).toBe('Send answer')
    await w.get('[data-test="auq-opt-0-0"] input').trigger('change')
    await w.get('[data-test="auq-opt-0-1"] input').trigger('change')
    await w.get('[data-test="auq-other-text-0"]').trigger('focus')
    await w.get('[data-test="auq-other-text-0"]').setValue('MySQL')
    await w.get('form').trigger('submit')
    expect(w.emitted('answer')[0][0].answers[0]).toMatchObject({ selected: [], other: 'MySQL' })
  })

  it('HITLModal draws it for an ask_user card and sends the answers as the response value', async () => {
    const req = { request_id: 'q1', interaction_type: 'question', response_type: 'text', summary: 'The agent has 2 questions',
                  urgency: 'medium', payload: { kind: 'ask_user', questions: QS, allow_text: true } }
    const w = mount(HITLModal, { props: { requests: [req], inline: true }, global: { stubs: { Teleport: true } } })
    expect(w.find('[data-test="ask-user-questions"]').exists()).toBe(true)
    await w.get('[data-test="auq-opt-0-1"] input').trigger('change')
    await w.get('[data-test="auq-opt-1-1"] input').trigger('change')
    await w.get('form').trigger('submit')
    const sent = w.emitted('respond')[0][0]
    expect(sent.request_id).toBe('q1')
    expect(sent.response_value.answers.map((a) => a.selected)).toEqual([['SQLite'], ['Signup']])
  })
})
