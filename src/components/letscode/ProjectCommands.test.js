// @vitest-environment jsdom
// Project commands (AGENT_ENGINE_CAPABILITIES_PLAN.md section 3, D3): the editor bar's Commands dialog shows how the
// project is installed, built, tested, linted, type-checked and run, and its port, as the agent remembered them; the
// person corrects them and saves. A wrong port is caught at once; the server's reasons are shown next to the field.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getProjectFacts: vi.fn(), saveProjectFacts: vi.fn() }))
vi.mock('@/services/api', () => ({ default: api }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ notify }))
const confirm = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/composables/useConfirm', () => ({ confirm }))

import ProjectCommands from './ProjectCommands.vue'

const FACTS = { install: 'npm ci', build: 'npm run build', test: 'npm test', lint: null, typecheck: null, serve: 'npm run dev', port: 3000 }
const response = (facts = FACTS) => ({ data: { facts, updated_at: '2026-11-11T10:00:00Z' } })

let w
async function openDialog() {
  w = mount(ProjectCommands, { props: { repoId: 14, ready: true }, attachTo: document.body, global: { stubs: { Icon: true } } })
  await w.get('[data-test="commands-open"]').trigger('click')
  await flushPromises()
}
const field = (k) => document.querySelector(`#pc-${k}`)
async function type(k, value) {
  const el = field(k)
  el.value = value
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}
const saveBtn = () => document.querySelector('[data-test="commands-save"]')
async function submit() {
  document.querySelector('.pc-dialog').dispatchEvent(new Event('submit'))
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getProjectFacts.mockResolvedValue(response())
})
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

describe('ProjectCommands', () => {
  it('opens from the editor bar and shows each command, the port, and a line about where they come from', async () => {
    await openDialog()
    expect(api.getProjectFacts).toHaveBeenCalledWith(14)
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.textContent).toContain('The coding agent fills these in from commands that worked')
    for (const label of ['How to install', 'How to build', 'How to test', 'How to lint', 'How to type-check', 'How to run', 'Port']) {
      expect(dialog.textContent).toContain(label)
    }
    expect(field('install').value).toBe('npm ci')
    expect(field('lint').value).toBe('')
    expect(field('port').value).toBe('3000')
    expect(document.querySelector('label[for="pc-typecheck"]').textContent).toBe('How to type-check')
    expect(saveBtn().disabled).toBe(true)      // nothing changed yet
  })

  it('saves the whole set, an emptied box as null and the port as a number', async () => {
    api.saveProjectFacts.mockResolvedValue(response({ ...FACTS, lint: 'npx eslint .', build: null, port: 5173 }))
    await openDialog()
    await type('lint', '  npx eslint .  ')
    await type('build', '')
    await type('port', '5173')
    expect(saveBtn().disabled).toBe(false)
    await submit()
    expect(api.saveProjectFacts).toHaveBeenCalledExactlyOnceWith(14, {
      install: 'npm ci', build: null, test: 'npm test', lint: 'npx eslint .', typecheck: null, serve: 'npm run dev', port: 5173,
    })
    expect(notify.success).toHaveBeenCalledWith('Commands saved')
    expect(field('port').value).toBe('5173')
    expect(saveBtn().disabled).toBe(true)
  })

  it('catches a wrong port before sending, and says so next to it', async () => {
    await openDialog()
    await type('port', '70000')
    await submit()
    expect(api.saveProjectFacts).not.toHaveBeenCalled()
    const err = document.querySelector('#pc-port-err')
    expect(err.textContent).toContain('1 to 65535')
    expect(field('port').getAttribute('aria-invalid')).toBe('true')
    expect(field('port').getAttribute('aria-describedby')).toBe('pc-port-err')
  })

  it('shows the server\'s reason next to the field it is about', async () => {
    api.saveProjectFacts.mockRejectedValue({ response: { data: { error: 'Some commands were not saved.', fields: { test: 'A command cannot be empty quotes.' } } } })
    await openDialog()
    await type('test', '""')
    await submit()
    expect(document.querySelector('#pc-test-err').textContent).toBe('A command cannot be empty quotes.')
    expect(document.querySelector('.pc-banner').textContent).toBe('Some commands were not saved.')
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('reads DRF-style field lists too', async () => {
    api.saveProjectFacts.mockRejectedValue({ response: { data: { facts: { port: ['Port 22 is not allowed.'] } } } })
    await openDialog()
    await type('port', '22')
    await submit()
    expect(document.querySelector('#pc-port-err').textContent).toBe('Port 22 is not allowed.')
  })

  it('asks before throwing away unsaved changes, and keeps them on Cancel', async () => {
    confirm.mockResolvedValueOnce(false)
    await openDialog()
    await type('install', 'pnpm install')
    document.querySelector('.pc-ibtn[aria-label="Close"]').click()
    await flushPromises()
    expect(confirm).toHaveBeenCalledOnce()
    expect(document.querySelector('[role="dialog"]')).not.toBe(null)
    expect(field('install').value).toBe('pnpm install')
  })

  it('says when the commands could not be loaded, with a way to try again', async () => {
    api.getProjectFacts.mockRejectedValueOnce({ response: { data: { error: 'The project is not ready.' } } })
    await openDialog()
    expect(document.querySelector('.pc-load-err').textContent).toContain('The project is not ready.')
    document.querySelector('.pc-load-err button').click()
    await flushPromises()
    expect(field('install').value).toBe('npm ci')
  })

  it('cannot be opened while the project is being prepared', () => {
    w = mount(ProjectCommands, { props: { repoId: 14, ready: false }, global: { stubs: { Icon: true } } })
    expect(w.get('[data-test="commands-open"]').attributes('disabled')).toBeDefined()
  })
})
