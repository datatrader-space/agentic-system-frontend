// @vitest-environment jsdom
// The project's environment variables (ADM-1205 phase D): names and when each changed, never a value (the server
// sends none back); add, change, remove and paste a .env file, then one Save sends the changes; a value is typed in a
// password field.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getProjectEnv: vi.fn(), saveProjectEnv: vi.fn() }))
vi.mock('@/services/api', () => ({ default: api }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ notify }))
const confirm = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/composables/useConfirm', () => ({ confirm }))

import ProjectEnv from './ProjectEnv.vue'
import { checkEnvKey, parseDotEnv } from '@/utils/projectEnv'

const VARS = [{ key: 'API_URL', updated_at: '2026-11-11T10:00:00Z' }, { key: 'DB_URL', updated_at: '2026-11-10T09:00:00Z' }]

let w
async function openDialog() {
  w = mount(ProjectEnv, { props: { repoId: 14 }, attachTo: document.body, global: { stubs: { Icon: true } } })
  await w.get('[data-test="env-open"]').trigger('click')
  await flushPromises()
}
const $ = (sel) => document.querySelector(sel)
async function type(sel, value) {
  const el = $(sel)
  el.value = value
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}
async function click(sel) { $(sel).click(); await flushPromises() }
async function submit() { $('.pe-dialog').dispatchEvent(new Event('submit')); await flushPromises() }

beforeEach(() => {
  vi.clearAllMocks()
  api.getProjectEnv.mockResolvedValue({ data: { variables: VARS } })
  api.saveProjectEnv.mockImplementation((_r, changes) => Promise.resolve({ data: { variables: [
    ...VARS.filter((v) => !(v.key in changes) || changes[v.key] !== null),
    ...Object.keys(changes).filter((k) => changes[k] !== null && !VARS.some((v) => v.key === k)).map((key) => ({ key, updated_at: null })),
  ] } }))
})
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

describe('ProjectEnv', () => {
  it('lists the names with when each changed, and never a value', async () => {
    await openDialog()
    expect(api.getProjectEnv).toHaveBeenCalledWith(14)
    const rows = [...document.querySelectorAll('.pe-row')]
    expect(rows.map((r) => r.querySelector('.pe-key').textContent)).toEqual(['API_URL', 'DB_URL'])
    expect(rows[0].textContent).toContain('Set · changed')
    expect($('[data-test="env-save"]').disabled).toBe(true)
  })

  it('adds one in a password field, then Save sends it', async () => {
    await openDialog()
    expect($('#pe-new-value').getAttribute('type')).toBe('password')
    await type('#pe-new-key', 'STRIPE_KEY')
    await type('#pe-new-value', 'sk_live_123')
    await click('[data-test="env-add"]')
    expect($('[data-test="env-STRIPE_KEY"]').textContent).toContain('New')
    expect($('#pe-new-value').value).toBe('')
    await submit()
    expect(api.saveProjectEnv).toHaveBeenCalledWith(14, { STRIPE_KEY: 'sk_live_123' })
    expect(notify.success).toHaveBeenCalled()
    expect($('[data-test="env-save"]').disabled).toBe(true)
  })

  it('a name the sandbox owns is refused before it is sent', async () => {
    await openDialog()
    await type('#pe-new-key', 'GIT_SSH_COMMAND')
    await click('[data-test="env-add"]')
    expect($('#pe-add-err').textContent).toContain('cannot be changed here')
    expect(api.saveProjectEnv).not.toHaveBeenCalled()
  })

  it('change types a new value, remove and undo, all in one Save', async () => {
    await openDialog()
    await click('[aria-label="Change API_URL"]')
    await type('#pe-v-API_URL', 'https://new.example.com')
    await click('[data-test="env-API_URL"] .pe-edit .pe-btn:not(.ghost)')
    await click('[aria-label="Remove DB_URL"]')
    expect($('[data-test="env-DB_URL"]').classList.contains('remove')).toBe(true)
    await click('[aria-label="Undo the change to DB_URL"]')
    await click('[aria-label="Remove DB_URL"]')
    await submit()
    expect(api.saveProjectEnv).toHaveBeenCalledWith(14, { API_URL: 'https://new.example.com', DB_URL: null })
  })

  it('a pasted .env file becomes changes; names it cannot take are named', async () => {
    await openDialog()
    $('.pe-paste').open = true
    await type('#pe-paste-text', 'export A_ONE="x y"\nGIT_DIR=/x\n# note\nnot a line\nB_TWO=plain # comment')
    await click('.pe-paste .pe-btn')
    expect($('.pe-paste .pe-hint').textContent).toContain('2 variables added')
    expect($('.pe-paste .pe-hint').textContent).toContain('not allowed: GIT_DIR')
    expect($('.pe-paste .pe-hint').textContent).toContain('1 line not read')
    await submit()
    expect(api.saveProjectEnv).toHaveBeenCalledWith(14, { A_ONE: 'x y', B_TWO: 'plain' })
  })

  it('the server\'s reason is shown; closing with changes asks first', async () => {
    api.saveProjectEnv.mockRejectedValueOnce({ response: { status: 400, data: { error: 'A project can have at most 200 variables.' } } })
    await openDialog()
    await type('#pe-new-key', 'NEW_ONE')
    await click('[data-test="env-add"]')
    await submit()
    expect($('.pe-banner').textContent).toContain('at most 200')
    confirm.mockResolvedValueOnce(false)
    await click('.pe-head .pe-ibtn')
    expect(confirm).toHaveBeenCalled()
    expect($('.pe-dialog')).not.toBe(null)
  })
})

describe('the helpers', () => {
  it('checkEnvKey mirrors the server', () => {
    expect(checkEnvKey('DATABASE_URL')).toBe('')
    expect(checkEnvKey('_private')).toBe('')
    for (const k of ['PATH', 'home', 'LD_PRELOAD', 'GIT_DIR', 'AADML_X', '1A', 'A-B', '']) expect(checkEnvKey(k)).not.toBe('')
  })
  it('parseDotEnv reads quotes, export and comments', () => {
    expect(parseDotEnv('A=1\nexport B="two\\nlines"\nC=\'$raw\'\nD=x # c\n\n# skip\nbad')).toEqual({
      values: { A: '1', B: 'two\nlines', C: '$raw', D: 'x' }, skipped: 1 })
  })
})
