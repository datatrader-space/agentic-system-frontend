// @vitest-environment jsdom
// Plan mode's card (backend phase 4): the plan file's words (markdown), its path and steps; exactly the answers the
// server offered; "keep planning" needs the person's notes. HITLModal draws it for `kind: 'plan_approval'`.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanModeCard from './PlanModeCard.vue'
import HITLModal from '../HITLModal.vue'

const request = (over = {}) => ({
  request_id: 'pr1', interaction_type: 'approval', response_type: 'choice', urgency: 'medium',
  payload: {
    kind: 'plan_approval', request_id: 'pr1', run_id: 'run-9', plan_version_id: 'pv-3', conversation_id: 'c1',
    plan_file: { path: '.aadml/plans/login.md', surface: 'lets_code', content: '# Login page\n\nAdd **a form**.\n\n<img src=x onerror=alert(1)>' },
    steps: [{ id: 's1', description: 'Read the routes' }, { id: 's2', description: 'Add the form' }],
    answers: [{ id: 'run_on_its_own', title: 'Run it on its own' }, { id: 'ask_before_each_change', title: 'Ask before each change' },
              { id: 'keep_planning', title: 'Keep planning' }],
    notes_answer: 'keep_planning', person_only: true,
    ...over,
  },
})
const mountCard = (r = request()) => mount(PlanModeCard, { props: { request: r }, global: { stubs: { Icon: true } } })

describe('PlanModeCard', () => {
  it('shows the plan file as markdown, its path and its steps, never raw HTML', () => {
    const w = mountCard()
    expect(w.find('[data-test="pmc-path"]').text()).toContain('.aadml/plans/login.md')
    const doc = w.find('[data-test="pmc-content"]')
    expect(doc.find('h1').text()).toBe('Login page')
    expect(doc.find('strong').text()).toBe('a form')
    expect(doc.find('img').exists()).toBe(false)
    expect(w.findAll('[data-test="pmc-steps"] li').map((l) => l.text())).toEqual(['Read the routes', 'Add the form'])
  })

  it('offers exactly the answers given, in their order', () => {
    const w = mountCard()
    expect(w.findAll('[data-test="pmc-answers"] button').map((b) => b.text()))
      .toEqual(['Run it on its own', 'Ask before each change', 'Keep planning'])
    const w2 = mountCard(request({ answers: [{ id: 'ask_before_each_change', title: 'Ask before each change' },
                                             { id: 'keep_planning', title: 'Keep planning' }] }))
    expect(w2.find('[data-test="pmc-answer-run_on_its_own"]').exists()).toBe(false)
  })

  it('an answer is sent once with its id and no notes', async () => {
    const w = mountCard()
    await w.find('[data-test="pmc-answer-ask_before_each_change"]').trigger('click')
    await w.find('[data-test="pmc-answer-run_on_its_own"]').trigger('click')
    expect(w.emitted('respond')).toEqual([[{ request_id: 'pr1', response_value: 'ask_before_each_change', feedback: '' }]])
  })

  it('"keep planning" needs notes: empty is refused with a message, written notes are sent as feedback', async () => {
    const w = mountCard()
    await w.find('[data-test="pmc-answer-keep_planning"]').trigger('click')
    expect(w.find('[data-test="pmc-notes"]').exists()).toBe(true)
    await w.find('form').trigger('submit')
    expect(w.emitted('respond')).toBeUndefined()
    expect(w.find('[role="alert"]').text()).toContain('Write what should change')
    await w.find('[data-test="pmc-notes"]').setValue('  Keep the old API working  ')
    await w.find('form').trigger('submit')
    expect(w.emitted('respond')).toEqual([[{ request_id: 'pr1', response_value: 'keep_planning', feedback: 'Keep the old API working' }]])
  })

  it('HITLModal draws a plan_approval request as this card and passes its answer on', async () => {
    const w = mount(HITLModal, { props: { requests: [request()] }, global: { stubs: { Icon: true, Teleport: true } } })
    expect(w.find('[data-test="plan-mode-card"]').exists()).toBe(true)
    expect(w.find('.hitl-modal').exists()).toBe(false)
    expect(w.find('.hitl-overlay--compact').exists()).toBe(true)        // docked above the composer, no backdrop
    await w.find('[data-test="pmc-answer-run_on_its_own"]').trigger('click')
    expect(w.emitted('respond')[0][0]).toEqual({ request_id: 'pr1', response_value: 'run_on_its_own', feedback: '' })
  })
})
