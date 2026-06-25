// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PermissionCard from './PermissionCard.vue'

const SECRET_CARD = {
  capability: 'create', action: 'create_file', path: '.env',
  risk: 'protected_gitignored_secret_file',
  reason: '`.env` is gitignored and may contain secrets.',
  options: ['Allow once', 'Allow for this task', 'Deny'],
  safe_alternative: 'Create a commit-safe template instead (e.g. .env.example)',
}

describe('PermissionCard', () => {
  it('renders the reason, target, risk and options', () => {
    const w = mount(PermissionCard, { props: { requests: [{ card: SECRET_CARD }] } })
    expect(w.text()).toContain('Permission needed')
    expect(w.text()).toContain('may contain secrets')
    expect(w.text()).toContain('.env')
    expect(w.text()).toContain('secret file')                 // risk label
    expect(w.text()).toContain('.env.example')                // safe alternative
    const btns = w.findAll('button').map((b) => b.text())
    expect(btns).toEqual(['Allow once', 'Allow for this task', 'Deny'])
  })

  it('emits respond with the chosen option label', async () => {
    const w = mount(PermissionCard, { props: { requests: [{ card: SECRET_CARD }] } })
    await w.findAll('button')[0].trigger('click')
    expect(w.emitted('respond')[0][0]).toEqual({ card: SECRET_CARD, choice: 'Allow once' })
  })

  it('falls back to default options when none provided', () => {
    const w = mount(PermissionCard, { props: { requests: [{ card: { reason: 'x' } }] } })
    const btns = w.findAll('button').map((b) => b.text())
    expect(btns).toContain('Always allow for this project')
    expect(btns).toContain('Deny')
  })

  it('renders nothing when there are no requests', () => {
    const w = mount(PermissionCard, { props: { requests: [] } })
    expect(w.findAll('button')).toHaveLength(0)
  })
})
