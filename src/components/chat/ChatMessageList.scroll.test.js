// @vitest-environment jsdom
// The thread must follow the answer, and must stop following the moment the user reads back.
//
// REPORTED: "chat window scroll bar not auto gone down, we need to scroll down manually to go to the
// end of chat while chat is continuing".
//
// The list already had an auto-scroll watcher, and it watched the wrong thing: the message TEXT
// length. Text is not what moves the bottom of this thread. An agent answer ends with rendered images
// — a wall-detection reply carries six — and they load AFTER the markdown, growing the page by
// hundreds of pixels without altering a single character. The scroll landed correctly and the content
// then grew past it.
//
// jsdom has no layout engine: scrollHeight/clientHeight are 0 and assigning scrollTop is inert. So the
// element is given real metrics here and scrollTop is made to behave like a browser's (clamped to the
// maximum), which is what lets these assert on position rather than on a call count.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../../stores/useChatStore'
import ChatMessageList from './ChatMessageList.vue'

// Captured so a test can fire the observer the way a loading image would.
let resizeCb = null
class FakeResizeObserver {
  constructor(cb) { resizeCb = cb }
  observe() {}
  disconnect() { resizeCb = null }
}

const VIEWPORT = 500

function layout(el, { contentHeight }) {
  let top = 0
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => VIEWPORT })
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => contentHeight.value })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    // Browsers clamp to the scrollable maximum; jsdom stores whatever you assign, which would let
    // `scrollTop = scrollHeight` report a position no real browser ever shows.
    set: (v) => { top = Math.max(0, Math.min(v, contentHeight.value - VIEWPORT)) },
  })
  return {
    get top() { return top },
    scrollTo(v) { top = v; el.dispatchEvent(new Event('scroll')) },
    atBottom: () => top >= contentHeight.value - VIEWPORT,
  }
}

async function setup({ contentHeight = 2000 } = {}) {
  setActivePinia(createPinia())
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  const chat = useChatStore()
  chat.messages = [{ id: 'u1', role: 'user', content: 'go', status: 'done' }]
  const w = mount(ChatMessageList, { global: { stubs: { ChatMessage: true, InlinePlanArtifact: true } } })
  const height = { value: contentHeight }
  const el = w.get('.msg-list').element
  const view = layout(el, { contentHeight: height })
  await w.vm.$nextTick()
  w.vm.scrollToBottom()
  return { w, chat, view, height, el }
}

describe('following the conversation', () => {
  beforeEach(() => { resizeCb = null })

  it('lands at the end when the thread opens', async () => {
    const { view } = await setup()
    expect(view.atBottom()).toBe(true)
  })

  it('follows an answer as it streams', async () => {
    const { w, chat, view } = await setup()
    chat.messages.push({ id: 'a1', role: 'assistant', content: '', status: 'streaming' })
    await w.vm.$nextTick(); await w.vm.$nextTick()
    chat.messages[1].content = 'the back wall runs from'
    await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(view.atBottom()).toBe(true)
  })

  it('keeps following when the new turn grows the thread before our own scroll event lands', async () => {
    // Live test 2026-09-25: the "Working" card rendered between our scrollToBottom and the scroll event it
    // triggered, so the event saw a >64px gap, read it as the user leaving, and turned the follow off —
    // the live card sat behind the composer under a jump button for the rest of the turn.
    const { el, height, view } = await setup()
    height.value += 300                        // the new turn's card renders
    el.dispatchEvent(new Event('scroll'))      // the late event from our own scroll (no upward move)
    resizeCb && resizeCb()                     // the observer sees the growth
    expect(view.atBottom()).toBe(true)
  })

  it('stays at the end when images load after the text', async () => {
    // THE ACTUAL BUG. No character changes here — only the height does, exactly as six rendered
    // FitMyWall images do when they finish loading. The old length watcher could not see this.
    const { view, height } = await setup()
    expect(view.atBottom()).toBe(true)
    height.value = 9000                      // images finished decoding
    expect(view.atBottom()).toBe(false)      // the page grew out from under the viewport
    resizeCb()                               // ...which is what the observer reports
    expect(view.atBottom()).toBe(true)
  })
})

describe('leaving the user alone while they read', () => {
  beforeEach(() => { resizeCb = null })

  it('stops following once they scroll up', async () => {
    const { w, chat, view } = await setup()
    view.scrollTo(200)
    await w.vm.$nextTick()
    chat.messages.push({ id: 'a1', role: 'assistant', content: 'a new answer', status: 'done' })
    await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(view.top).toBe(200)
  })

  it('does not yank them down when content grows underneath', async () => {
    const { w, view, height } = await setup()
    view.scrollTo(200)
    await w.vm.$nextTick()
    height.value = 9000
    resizeCb()
    expect(view.top).toBe(200)
  })

  it('offers the jump control, and only while they are away', async () => {
    const { w, view } = await setup()
    expect(w.find('[data-test="jump-latest"]').exists()).toBe(false)
    view.scrollTo(200)
    await w.vm.$nextTick()
    expect(w.find('[data-test="jump-latest"]').exists()).toBe(true)
  })

  it('jumps to the end instantly when clicked', async () => {
    const { w, view } = await setup()
    view.scrollTo(200)
    await w.vm.$nextTick()
    await w.get('[data-test="jump-latest"]').trigger('click')
    expect(view.atBottom()).toBe(true)
    await w.vm.$nextTick()
    expect(w.find('[data-test="jump-latest"]').exists()).toBe(false)
  })

  it('marks the control when something arrived while they were away', async () => {
    const { w, chat, view } = await setup()
    view.scrollTo(200)
    await w.vm.$nextTick()
    expect(w.get('[data-test="jump-latest"]').classes()).not.toContain('unread')
    chat.messages.push({ id: 'a1', role: 'assistant', content: 'done', status: 'done' })
    await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.get('[data-test="jump-latest"]').classes()).toContain('unread')
  })

  it('clears the unread mark when they scroll back themselves', async () => {
    const { w, chat, view, height } = await setup()
    view.scrollTo(200)
    await w.vm.$nextTick()
    chat.messages.push({ id: 'a1', role: 'assistant', content: 'done', status: 'done' })
    await w.vm.$nextTick(); await w.vm.$nextTick()
    view.scrollTo(height.value - VIEWPORT)
    await w.vm.$nextTick()
    expect(w.find('[data-test="jump-latest"]').exists()).toBe(false)
  })

  it('re-arms the follow when the user sends a message', async () => {
    // Sending is an unambiguous request to be at the end of the conversation, even if they had
    // scrolled up to re-read something first.
    const { w, chat, view } = await setup()
    view.scrollTo(200)
    await w.vm.$nextTick()
    chat.messages.push({ id: 'u2', role: 'user', content: 'and the ceiling?', status: 'done' })
    await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(view.atBottom()).toBe(true)
  })

  it('treats a few pixels of slack as the end', async () => {
    // Fractional scrollHeight on zoomed or hi-dpi displays means scrollTop never exactly equals the
    // maximum. A strict comparison would report the user as scrolled-away while they sit at the
    // bottom — killing the follow permanently and showing the button over a complete view.
    const { w, view, height } = await setup()
    view.scrollTo(height.value - VIEWPORT - 8)
    await w.vm.$nextTick()
    expect(w.find('[data-test="jump-latest"]').exists()).toBe(false)
  })
})

describe('loading older messages', () => {
  beforeEach(() => { resizeCb = null })

  it('does not drag the user to the bottom of the thread', async () => {
    // The page they asked for is added ABOVE them, and the height jump would otherwise look exactly
    // like new content arriving.
    const { w, chat, view, height } = await setup()
    view.scrollTo(200)
    await w.vm.$nextTick()
    chat.messagesHasMore = true
    chat.loadOlderMessages = async () => {
      chat.messages.unshift({ id: 'old1', role: 'assistant', content: 'earlier', status: 'done' })
      height.value = 5000
    }
    await w.vm.$nextTick()
    await w.get('.load-earlier-btn').trigger('click')
    await w.vm.$nextTick()
    if (resizeCb) resizeCb()               // the prepend's own height change
    expect(view.atBottom()).toBe(false)
  })
})
