// @vitest-environment jsdom
// Background tasks (ADM-1328): start one from a request or a GitHub issue link, see each task's state and its pull
// request, stop one (with an in-app confirmation, never a native dialog), open its chat, and connect GitHub's checks
// (the secret is shown once, when the person must add the webhook themselves, and is gone when the panel closes).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const tasksApi = vi.hoisted(() => ({ list: vi.fn(), start: vi.fn(), stop: vi.fn(), setUpWebhook: vi.fn() }))
vi.mock('@/services/projectTasksApi', () => ({ default: tasksApi }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ notify }))
const confirm = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/composables/useConfirm', () => ({ confirm }))

import ProjectTasks from './ProjectTasks.vue'

const TASK = {
  task_id: 't-1', title: 'Fix the footer', state: 'pr_open', state_label: 'Pull request open', branch: 'aadml/chat-9',
  pr_url: 'https://github.com/acme/widgets/pull/12', pr_number: 12, issue_url: null, issue_number: null,
  fixes_used: 1, fixes_max: 3, status_reason: null, conversation_id: 9,
}
const WAITING = { ...TASK, task_id: 't-2', title: 'Add dark mode', state: 'waiting', state_label: 'Waiting for you', pr_url: null, pr_number: null, conversation_id: 10 }

let w
async function openDialog() {
  w = mount(ProjectTasks, { props: { repoId: 14 }, attachTo: document.body, global: { stubs: { Icon: true } } })
  await flushPromises()
  await w.get('[data-test="tasks-open"]').trigger('click')
  await flushPromises()
}
const $ = (sel) => document.querySelector(sel)
async function type(sel, value) {
  const el = $(sel)
  el.value = value
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  tasksApi.list.mockResolvedValue({ data: { tasks: [TASK, WAITING], webhook: { set_up: false, events: [] }, max_auto_fixes: 3, consent: 'It commits, pushes its own branch and opens a pull request.' } })
  tasksApi.start.mockResolvedValue({ data: { task: { ...TASK, task_id: 't-3', title: 'New one', state: 'running', state_label: 'Working', pr_url: null } } })
  tasksApi.stop.mockResolvedValue({ data: { task: { ...TASK, state: 'stopped', state_label: 'Stopped' } } })
})
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

describe('ProjectTasks', () => {
  it('lists the tasks with their state in words and the pull request link', async () => {
    await openDialog()
    expect(tasksApi.list).toHaveBeenCalledWith(14, expect.anything())
    expect($('[data-test="task-state-t-1"]').textContent).toContain('Pull request open')
    const pr = $('[data-test="task-t-1"] [data-test="task-pr"]')
    expect(pr.getAttribute('href')).toBe(TASK.pr_url)
    expect(pr.getAttribute('rel')).toContain('noopener')
    expect($('[data-test="task-t-1"]').textContent).toContain('1 of 3 automatic fixes')
    expect($('[role="dialog"]').getAttribute('aria-modal')).toBe('true')
    expect(document.body.textContent).toContain('It commits, pushes its own branch')
    // The trigger says how many wait for the person.
    expect(w.get('[data-test="tasks-open"]').attributes('aria-label')).toContain('1 waiting for you')
  })

  it('starts a task from a request or an issue link', async () => {
    await openDialog()
    const started = (await tasksApi.start()).data.task
    tasksApi.start.mockClear()
    tasksApi.list.mockResolvedValue({ data: { tasks: [started, TASK, WAITING], webhook: { set_up: false, events: [] } } })
    expect($('[data-test="task-start"]').disabled).toBe(true)
    await type('#pt-text', 'Add a toggle')
    await type('#pt-issue', 'https://github.com/acme/widgets/issues/5')
    $('[data-test="task-form"]').dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(tasksApi.start).toHaveBeenCalledWith(14, { text: 'Add a toggle', issue_url: 'https://github.com/acme/widgets/issues/5' })
    expect($('[data-test="task-t-3"]')).not.toBeNull()
    expect($('#pt-text').value).toBe('')
  })

  it("says the server's refusal next to the form", async () => {
    tasksApi.start.mockRejectedValue({ response: { data: { error: "That issue is not in this project's GitHub repository.", code: 'OTHER_REPOSITORY' } } })
    await openDialog()
    await type('#pt-issue', 'https://github.com/evil/x/issues/1')
    $('[data-test="task-form"]').dispatchEvent(new Event('submit'))
    await flushPromises()
    expect($('#pt-start-err').textContent).toContain('not in this project')
    expect($('#pt-issue').getAttribute('aria-invalid')).toBe('true')
  })

  it('stops a task only after the in-app confirmation', async () => {
    await openDialog()
    confirm.mockResolvedValueOnce(false)
    $('[data-test="task-t-1"] .pt-btn.danger').click()
    await flushPromises()
    expect(tasksApi.stop).not.toHaveBeenCalled()
    $('[data-test="task-t-1"] .pt-btn.danger').click()
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(tasksApi.stop).toHaveBeenCalledWith(14, 't-1')
    expect($('[data-test="task-state-t-1"]').textContent).toContain('Stopped')
  })

  it("opens the task's chat", async () => {
    await openDialog()
    $('[data-test="task-t-2"] .pt-actions .pt-btn').click()
    await flushPromises()
    expect(w.emitted('open-chat')[0]).toEqual([10])
    expect($('[role="dialog"]')).toBeNull()
  })

  it('shows the secret once when GitHub refused to add the webhook, and forgets it on close', async () => {
    tasksApi.setUpWebhook.mockResolvedValue({ data: { set_up: true, url: 'https://aadml.example/api/lets-code/github/webhook/abc/', added_on_github: false, repository: 'acme/widgets', events: ['check_run'], secret: 'f'.repeat(64), github_refused: 'Add it yourself.' } })
    await openDialog()
    $('[data-test="hook-connect"]').click()
    await flushPromises()
    expect($('#pt-hook-secret').getAttribute('type')).toBe('password')
    expect($('#pt-hook-secret').value).toBe('f'.repeat(64))
    expect($('[data-test="hook-reveal"]').textContent).toContain('Add it yourself.')
    $('.pt-head .pt-ibtn').click()
    await flushPromises()
    await w.get('[data-test="tasks-open"]').trigger('click')
    await flushPromises()
    expect($('#pt-hook-secret')).toBeNull()
  })

  it('says GitHub is connected when AADML added the webhook, with no secret on the page', async () => {
    tasksApi.setUpWebhook.mockResolvedValue({ data: { set_up: true, url: 'u', added_on_github: true, repository: 'acme/widgets', events: [] } })
    await openDialog()
    $('[data-test="hook-connect"]').click()
    await flushPromises()
    expect($('[data-test="hook-reveal"]')).toBeNull()
    expect($('[data-test="hook-state"]').textContent).toContain('Connected for acme/widgets')
    expect(notify.success).toHaveBeenCalled()
  })
})
