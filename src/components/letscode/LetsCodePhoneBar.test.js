// @vitest-environment jsdom
// The Let's Code editor's ONE header row on a phone (ADM-1330, live at 375 px 2026-11-25): back, the project and its
// status, the chat's background-tasks pill, Files, Chats and More. More holds what the wide editor's bar holds, the
// bottom panel's tabs and the app's menu; Chats switches chats. Both are the app's menu component (Reka UI).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
vi.mock('@iconify/vue', () => ({ Icon: { props: ['icon'], template: '<i class="ic" :data-icon="icon" />' } }))
import LetsCodePhoneBar from './LetsCodePhoneBar.vue'
import { CODING_CHAT_TABS } from '@/stores/useCodingChatTabs'
import { returnFocus } from './returnFocus'

const project = { repo_id: 14, name: 'shop', phase: 'ready', clone_ready: true, branch: 'main', is_new: false }
function chatTabs() {
  const tabs = reactive({
    tabs: [{ key: 'a', id: '77', label: 'Fix the totals' }, { key: 'b', id: null, label: 'Draft chat' }],
    active: 'a',
  })
  return Object.assign(tabs, {
    isActive: (t) => t.key === tabs.active,
    title: (t) => t.label || 'New chat',
    state: (t) => (t.key === 'b' ? 'needs_input' : 'idle'),
    stateLabel: (t) => (t.key === 'b' ? 'Needs you' : ''),
  })
}
let w
function bar(props = {}) {
  w = mount(LetsCodePhoneBar, {
    attachTo: document.body,
    props: { project, ready: true, branches: ['main', 'feature/a'], githubUrl: 'https://github.com/o/shop',
      panelTabs: [{ id: 'problems', label: 'Problems (2)', icon: 'lucide:circle-alert' }, { id: 'log', label: 'Log', icon: 'lucide:scroll-text' }],
      history: [{ id: '77', title: 'Fix the totals' }, { id: '78', title: 'The login page' }], ...props },
    global: { provide: { [CODING_CHAT_TABS]: chatTabs() } },
  })
  return w
}
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

async function open(test) {
  await w.find(`[data-test="${test}"]`).trigger('keydown', { key: 'Enter' })
  await flushPromises(); await nextTick()
  return document.body.querySelector('[role="menu"]')
}
const texts = (menu, sel = '[role^="menuitem"]') => [...menu.querySelectorAll(sel)].map((i) => i.textContent.replace(/\s+/g, ' ').trim())
async function pick(menu, label) {
  const item = [...menu.querySelectorAll('[role^="menuitem"]')].find((i) => i.textContent.includes(label))
  item.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  item.click()
  await flushPromises()
}

describe('the header row', () => {
  it('has the back control, the project and its status (dot and word), the pill slot, Files, Chats and More', () => {
    bar()
    expect(w.find('[data-test="lpb-back"]').attributes('aria-label')).toBe('Back to the projects')
    expect(w.find('.lpb-name').text()).toBe('shop')
    expect(w.find('[data-test="lpb-status"]').text()).toBe('Ready')
    expect(w.find('.lpb-dot').exists()).toBe(true)
    expect(w.find('#lc-phone-pill').exists()).toBe(true)
    expect(w.find('[data-test="lpb-files"]').attributes('aria-label')).toBe('Files and editor')
    expect(w.find('[data-test="lpb-more"]').attributes('aria-haspopup')).toBe('menu')
    // Every control has a name; none is a bare icon to a screen reader.
    for (const b of w.findAll('button')) expect(b.attributes('aria-label')).toBeTruthy()
  })

  it('says what the project waits for while it opens, as a polite status, in place of the status word', () => {
    bar({ openLabel: 'Loading the files…', openSeconds: 3 })
    const s = w.find('[data-test="lpb-opening"]')
    expect(s.attributes('role')).toBe('status')
    expect(s.attributes('aria-live')).toBe('polite')
    expect(s.find('.lpb-status-t').text()).toBe('Loading the files…')
    expect(s.find('.lpb-secs').text()).toBe('3 s')
  })

  it('Back and Files ask the page; Files says when its pane is shown', async () => {
    bar({ view: 'files' })
    await w.find('[data-test="lpb-back"]').trigger('click')
    await w.find('[data-test="lpb-files"]').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
    expect(w.emitted('files')).toHaveLength(1)
    expect(w.find('[data-test="lpb-files"]').attributes('aria-pressed')).toBe('true')
  })
})

describe('the More menu', () => {
  it("holds the wide bar's controls, the views, the bottom panel's tabs and the display, nothing left out", async () => {
    bar()
    const menu = await open('lpb-more')
    expect(texts(menu)).toEqual(['Branch: main', 'Commands', 'Variables', 'Pull request tasks', 'Deploy', 'Open on GitHub',
      'Source control', 'Search in files', 'Problems (2)', 'Log', 'Dark editor', 'Simple phone view', 'AADML menu'])
    expect(menu.querySelectorAll('.lpb-item').length).toBe(13)        // each 44 px tall (.lpb-item, min-height 44px)
    expect(menu.querySelector('a[href="https://github.com/o/shop"]').getAttribute('target')).toBe('_blank')
  })

  it('each item asks the page for its action', async () => {
    bar()
    for (const [label, event, arg] of [['Commands', 'commands'], ['Variables', 'variables'], ['Pull request tasks', 'tasks'],
      ['Deploy', 'deploy'], ['Source control', 'side', 'scm'], ['Log', 'panel', 'log'], ['Dark editor', 'theme'],
      ['Simple phone view', 'phone-view'], ['AADML menu', 'app-menu']]) {
      const menu = await open('lpb-more')
      await pick(menu, label)
      expect(w.emitted(event), label).toBeTruthy()
      if (arg) expect(w.emitted(event).at(-1)).toEqual([arg])
    }
  })

  it('a new project (no GitHub) says branches come with GitHub; a project not ready cannot deploy', async () => {
    bar({ project: { ...project, is_new: true }, ready: false, githubUrl: '' })
    const menu = await open('lpb-more')
    const items = [...menu.querySelectorAll('[role="menuitem"]')]
    const byText = (s) => items.find((i) => i.textContent.includes(s))
    expect(byText('Branches come with GitHub').hasAttribute('data-disabled')).toBe(true)
    expect(byText('Deploy').hasAttribute('data-disabled')).toBe(true)
    expect(texts(menu).some((s) => s.includes('Open on GitHub'))).toBe(false)
  })

  it('its button is where the focus returns when a dialog opened from it closes (the bar it belongs to is hidden)', () => {
    bar()
    const hidden = document.createElement('button')
    hidden.checkVisibility = () => false
    document.body.appendChild(hidden)
    returnFocus(hidden)
    expect(document.activeElement).toBe(w.find('[data-test="lpb-more"]').element)
    const shown = document.createElement('button')
    document.body.appendChild(shown)
    returnFocus(shown)                                                // jsdom has no checkVisibility: shown
    expect(document.activeElement).toBe(shown)
  })
})

describe('the Chats menu', () => {
  it('lists the open chats (the one on screen checked), a new chat, and the other chats; it reads them when it opens', async () => {
    bar()
    const menu = await open('lpb-chats')
    expect(w.emitted('load-history')).toHaveLength(1)
    const radios = [...menu.querySelectorAll('[role="menuitemradio"]')]
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    expect(texts(menu, '[role^="menuitem"] .lpb-item-t')).toEqual(['Fix the totals', 'Draft chat', 'New chat', 'The login page'])
    expect(texts(menu, '.lpb-item-meta')).toEqual(['Needs you'])          // the second open chat's state
  })

  it('one tap switches chats, starts one, or opens another', async () => {
    bar()
    await pick(await open('lpb-chats'), 'Needs you')
    expect(w.emitted('chat')[0][0].key).toBe('b')
    await pick(await open('lpb-chats'), 'The login page')
    expect(w.emitted('open-conversation')[0][0]).toEqual({ id: '78', title: 'The login page' })
    await pick(await open('lpb-chats'), 'New chat')
    expect(w.emitted('new-chat')).toHaveLength(1)
  })

  it('says a chat needs the person on its button', () => {
    bar()
    expect(w.find('[data-test="lpb-chats"]').attributes('aria-label')).toBe('Chats: a chat needs you')
    expect(w.find('.lpb-badge').attributes('aria-hidden')).toBe('true')
  })
})

// What the wide bar's buttons say is not lost on a phone (ADM-1330): the pull request tasks waiting for the person and
// the latest deploy's state show on More's items, in words, and as a dot on More while anything there needs a look.
describe("the wide bar's signals on a phone", () => {
  const building = { state: 'BUILDING', active: true, label: 'Building', tone: 'run' }
  const failed = { state: 'ERROR', active: false, label: 'Build failed', tone: 'bad' }
  const live = { state: 'READY', active: false, label: 'Ready', tone: 'ok' }
  const more = () => w.find('[data-test="lpb-more"]')

  it('nothing waits and the last deploy is live: no dot, the plain name; the items say Ready', async () => {
    bar({ deploy: live })
    expect(w.find('[data-test="lpb-more-dot"]').exists()).toBe(false)
    expect(more().attributes('aria-label')).toBe('More: project, panels and display')
    const menu = await open('lpb-more')
    expect(menu.querySelector('[data-test="lpb-tasks-waiting"]')).toBeNull()
    const state = menu.querySelector('[data-test="lpb-deploy-state"]')
    expect(state.textContent.trim()).toBe('Ready')
    expect(state.className).toContain('t-ok')
  })

  it('pull request tasks waiting: the count in words on the item, a dot and its words on More', async () => {
    bar({ tasksWaiting: 2 })
    expect(w.find('[data-test="lpb-more-dot"]').classes()).toContain('t-wait')
    expect(w.find('[data-test="lpb-more-dot"]').attributes('aria-hidden')).toBe('true')
    expect(more().attributes('aria-label')).toBe('More: project, panels and display. 2 pull request tasks waiting for you')
    const menu = await open('lpb-more')
    const item = menu.querySelector('[data-test="lpb-tasks"]')
    expect(item.textContent.replace(/\s+/g, ' ').trim()).toBe('Pull request tasks2 waiting')
    expect(menu.querySelector('[data-test="lpb-tasks-waiting"]').textContent).toBe('2 waiting')
  })

  it('a deploy running: its state on the Deploy item and on More', async () => {
    bar({ deploy: building, tasksWaiting: 1 })
    expect(more().attributes('aria-label')).toBe('More: project, panels and display. 1 pull request task waiting for you. Deploy: Building')
    expect(w.find('[data-test="lpb-more-dot"]').classes()).toContain('t-wait')   // waiting for the person comes first
    const menu = await open('lpb-more')
    const state = menu.querySelector('[data-test="lpb-deploy-state"]')
    expect(state.textContent.trim()).toBe('Building')
    expect(state.className).toContain('t-run')
  })

  it('a deploy that failed: red dot first, and the words', async () => {
    bar({ deploy: failed, tasksWaiting: 3 })
    expect(w.find('[data-test="lpb-more-dot"]').classes()).toContain('t-bad')
    expect(more().attributes('aria-label')).toContain('Deploy: Build failed')
    const menu = await open('lpb-more')
    expect(menu.querySelector('[data-test="lpb-deploy-state"]').textContent.trim()).toBe('Build failed')
  })

  it('only a deploy running: a dot of its own', () => {
    bar({ deploy: building })
    expect(w.find('[data-test="lpb-more-dot"]').classes()).toContain('t-run')
    expect(more().attributes('aria-label')).toBe('More: project, panels and display. Deploy: Building')
  })
})
