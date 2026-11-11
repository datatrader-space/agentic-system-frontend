// @vitest-environment jsdom
// The task list drawn above the composer (TODO_WRITE, AGENT_ENGINE_CAPABILITIES_PLAN.md section 7): the step the
// agent is on (its active form), "N of M done", one rail segment per task, the whole list when open; hidden with no
// tasks; follows each update.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatTaskList from './ChatTaskList.vue'

const TODOS = [
  { content: 'Read the router', status: 'completed', activeForm: '' },
  { content: 'Add the route', status: 'in_progress', activeForm: 'Adding the route' },
  { content: 'Run the tests', status: 'pending', activeForm: '' },
  { content: 'Update the docs', status: 'pending', activeForm: '' },
  { content: 'Write a test', status: 'completed', activeForm: '' },
]
const mountList = (todos = TODOS, extra = {}) => mount(ChatTaskList, { props: { todos, ...extra }, global: { stubs: { Icon: true } } })

describe('ChatTaskList', () => {
  it('is not drawn when there are no tasks', () => {
    expect(mountList([]).find('[data-test="task-list"]').exists()).toBe(false)
  })

  it('shows the count, the step in progress by its active form, and every task with its state', () => {
    const w = mountList()
    expect(w.get('[data-test="task-count"]').text()).toBe('2 of 5 done')
    expect(w.get('.ctl-now').text()).toBe('Adding the route')
    const items = w.findAll('.ctl-item')
    expect(items.map((i) => i.attributes('data-status'))).toEqual(['completed', 'in_progress', 'pending', 'pending', 'completed'])
    expect(items[1].text()).toContain('Adding the route')
    expect(items[0].text()).toContain('Read the router')
    expect(items[0].text()).toContain('(done)')
    expect(w.findAll('.ctl-seg')).toHaveLength(5)
    expect(w.findAll('.ctl-seg.completed')).toHaveLength(2)
  })

  it('names the task itself when it has no active form', () => {
    const w = mountList([{ content: 'Fix the header', status: 'in_progress', activeForm: '' }])
    expect(w.get('.ctl-now').text()).toBe('Fix the header')
    expect(w.get('.ctl-item').text()).toContain('Fix the header')
  })

  it('collapses and opens from its header, saying so to assistive tech', async () => {
    const w = mountList()
    const head = w.get('.ctl-head')
    expect(head.attributes('aria-expanded')).toBe('true')
    expect(w.get('.ctl-list').isVisible()).toBe(true)
    await head.trigger('click')
    expect(head.attributes('aria-expanded')).toBe('false')
    expect(w.get('.ctl-list').attributes('style')).toContain('display: none')
    expect(head.attributes('aria-controls')).toBe(w.get('.ctl-list').attributes('id'))
  })

  it('follows each update live, and announces it in one short line', async () => {
    const w = mountList()
    await w.setProps({ todos: TODOS.map((t) => ({ ...t, status: 'completed' })) })
    expect(w.get('[data-test="task-count"]').text()).toBe('5 of 5 done')
    expect(w.get('.ctl-now').text()).toBe('All tasks done')
    expect(w.get('[data-test="task-live"]').attributes('aria-live')).toBe('polite')
    expect(w.get('[data-test="task-live"]').text()).toBe('5 of 5 tasks done.')
  })

  it('names the next task when none is in progress', () => {
    const w = mountList([{ content: 'One', status: 'completed', activeForm: '' }, { content: 'Two', status: 'pending', activeForm: '' }])
    expect(w.get('.ctl-now').text()).toBe('Next: Two')
  })
})
