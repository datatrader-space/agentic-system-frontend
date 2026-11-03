// @vitest-environment jsdom
// An account signs in only once its email is verified (owner, 2026-11-02, ADM-1141): sign-up shows where the link
// went and switches to Sign in instead of entering the app; a sign-in refused for it offers a new link.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ name: 'signup', query: {}, fullPath: '/signup' }),
}))
vi.mock('../services/api', () => ({
  default: {
    register: vi.fn(),
    login: vi.fn(),
    resendVerification: vi.fn(),
    get: vi.fn(() => Promise.resolve({ data: { providers: [] } })),
  },
}))

import api from '../services/api'
import Login from './Login.vue'

// The address field is type=email on Sign up and type=text (email or username) on Sign in.
const addressField = (w) => w.find('input[type=email], input[type=text]:not([placeholder="First and last name"])')

async function fillAndSubmit(w, { name, email, password }) {
  if (name !== undefined) await w.find('input[placeholder="First and last name"]').setValue(name)
  await addressField(w).setValue(email)
  await w.find('input[type=password]').setValue(password)
  await w.find('form.login-form').trigger('submit.prevent')
  await flushPromises()
}

describe('Login — verify your email first', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('after sign-up shows the inbox message and switches to Sign in, without entering the app', async () => {
    api.register.mockResolvedValue({ data: { success: true, verification_required: true, email: 'p***t@gmail.com',
      message: 'Check your inbox: we sent a link to verify your email. Click it, then sign in.' } })
    const w = mount(Login, { global: { stubs: { BrandMark: true, RouterLink: { template: '<a><slot /></a>' } } } })
    await fillAndSubmit(w, { name: 'Pat Example', email: 'pat@gmail.com', password: 'Verify-Me-2026!x' })
    expect(w.text()).toContain('Check your inbox')
    expect(w.text()).toContain('Send the link again')
    expect(addressField(w).element.value).toBe('pat@gmail.com')
    expect(w.find('input[placeholder="First and last name"]').exists()).toBe(false)     // now the Sign in form
    expect(push).not.toHaveBeenCalled()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('a refused sign-in says why and sends a new link for that address', async () => {
    api.register.mockResolvedValue({ data: { success: true, email: 'p***t@gmail.com', message: 'Check your inbox' } })
    api.login.mockRejectedValue({ response: { status: 403, data: { code: 'email_not_verified',
      error: 'Verify your email first. We sent a link to p***t@gmail.com; click it, then sign in.' } } })
    api.resendVerification.mockResolvedValue({ data: { message: 'If that address has an account waiting to be verified, a new link is on its way.' } })
    const w = mount(Login, { global: { stubs: { BrandMark: true, RouterLink: { template: '<a><slot /></a>' } } } })
    await fillAndSubmit(w, { name: 'Pat Example', email: 'pat@gmail.com', password: 'Verify-Me-2026!x' })
    await w.find('input[type=password]').setValue('Verify-Me-2026!x')
    await w.find('form.login-form').trigger('submit.prevent')
    await flushPromises()
    expect(w.text()).toContain('Verify your email first')
    await w.find('button.verify-resend').trigger('click')
    await flushPromises()
    expect(api.resendVerification).toHaveBeenCalledWith('pat@gmail.com')
    expect(w.text()).toContain('a new link is on its way')
  })
})
