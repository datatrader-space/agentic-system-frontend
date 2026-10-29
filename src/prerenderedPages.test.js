// @vitest-environment jsdom
// Phase 6 (ADM-1079): the app takes over a prerendered page without losing what the visitor typed.
import { describe, it, expect, afterEach } from 'vitest'
import { createApp, h, ref } from 'vue'
import { redirectsSignedIn, takeOverPrerendered } from './prerenderedPages'

const FORM = '<form><input id="email" type="email" placeholder="Email"><input id="pw" type="password">'
  + '<input id="remember" type="checkbox"></form>'

// What the app renders over it: the same fields, bound with v-model.
const SignIn = {
  setup() {
    const email = ref('')
    const pw = ref('')
    const remember = ref(false)
    return { email, pw, remember }
  },
  render() {
    return h('form', [
      h('input', { id: 'email', type: 'email', placeholder: 'Email', value: this.email, onInput: (e) => { this.email = e.target.value } }),
      h('input', { id: 'pw', type: 'password', value: this.pw, onInput: (e) => { this.pw = e.target.value } }),
      h('input', { id: 'remember', type: 'checkbox', checked: this.remember, onChange: (e) => { this.remember = e.target.checked } }),
    ])
  },
}

let root
afterEach(() => { root?.remove() })

const prerendered = () => {
  root = document.createElement('div')
  root.innerHTML = FORM
  document.body.appendChild(root)
  return root
}

describe('takeOverPrerendered', () => {
  it('keeps typed values, ticks and the focus in the app’s own fields, and the app state follows', () => {
    const el = prerendered()
    el.querySelector('#email').value = 'ana@example.com'
    el.querySelector('#remember').checked = true
    el.querySelector('#pw').focus()

    const app = createApp(SignIn)
    let vm
    takeOverPrerendered(el, () => { vm = app.mount(el) })

    expect(el.querySelector('#email').value).toBe('ana@example.com')
    expect(vm.email).toBe('ana@example.com')
    expect(vm.remember).toBe(true)
    expect(vm.pw).toBe('')
    expect(document.activeElement).toBe(el.querySelector('#pw'))
    app.unmount()
  })

  it('carries nothing over when the app rendered other fields (a redirect to another page)', () => {
    const el = prerendered()
    el.querySelector('#email').value = 'ana@example.com'
    const app = createApp({ render: () => h('input', { id: 'search', type: 'search' }) })
    takeOverPrerendered(el, () => app.mount(el))
    expect(el.querySelector('#search').value).toBe('')
    app.unmount()
  })

  it('knows which public pages send a signed-in person on', () => {
    expect(redirectsSignedIn({ name: 'landing', meta: {} })).toBe(true)
    expect(redirectsSignedIn({ name: 'login', meta: { requiresGuest: true } })).toBe(true)
    expect(redirectsSignedIn({ name: 'pricing', meta: { public: true } })).toBe(false)
  })
})
