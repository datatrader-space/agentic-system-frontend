// The public pages written to HTML at build time (scripts/prerender.mjs, page-speed plan Phase 6, ADM-1079), so the
// first response already shows the page instead of an empty shell that paints only once the app's code has run.
// main.js routes them like any other page; src/entry-prerender.js renders them with these same records, so a
// page's route name and meta (which app.vue reads to lay the page out) cannot differ between the two.
const Login = () => import('./views/Login.vue')

export const prerenderedRoutes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('./views/LandingPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/features',
    name: 'features',
    component: () => import('./views/Features.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/pricing',
    name: 'pricing',
    component: () => import('./views/Pricing.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { requiresGuest: true, public: true }
  },
  {
    path: '/signup',
    name: 'signup',
    component: Login,
    meta: { requiresGuest: true, public: true }
  },
]

/** A signed-in person who opens this route is sent to /dashboard (main.js, router.beforeEach). */
export function redirectsSignedIn(route) {
  return route.name === 'landing' || !!route.meta?.requiresGuest
}

// Set while the last auth check said "signed in", removed when it said otherwise (and by every sign-out, which
// clears localStorage). Only a HINT, read before any code runs: a prerendered page that sends a signed-in person
// on to /dashboard stays hidden for them instead of flashing. Authorization never reads it.
export const SIGNED_IN_HINT_KEY = 'aadml_signed_in'

const fieldsOf = (root) => [...root.querySelectorAll('input, textarea, select')]
const fieldKey = (el) => [el.tagName, el.type, el.name, el.id, el.placeholder].join('|')
const isToggle = (el) => el.type === 'checkbox' || el.type === 'radio'

/**
 * Run `mount` over a prerendered page, keeping what the visitor did before the app took over: a person who
 * started typing their email on the prerendered sign-in form keeps it, and the focus stays where it was. Only
 * when the app rendered the same fields (the same page): a redirect to another page carries nothing over.
 */
export function takeOverPrerendered(root, mount) {
  const before = fieldsOf(root)
  const state = before.map((el) => ({ key: fieldKey(el), value: isToggle(el) ? el.checked : el.value }))
  const focused = before.indexOf(document.activeElement)
  mount()
  const after = fieldsOf(root)
  if (after.length !== state.length || after.some((el, i) => fieldKey(el) !== state[i].key)) return
  after.forEach((el, i) => {
    const { value } = state[i]
    if (isToggle(el)) {
      if (el.checked !== value) {
        el.checked = value
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
    } else if (value && el.value !== value) {
      el.value = value
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    }
  })
  if (focused >= 0) after[focused].focus()
}
