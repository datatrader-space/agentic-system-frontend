// Pinia store — the browser an agent is driving in this conversation.
//
// A conversation has at most one governed browser at a time. This store knows which one, what it is doing
// and who is driving, and it is what the chat's browser card and the dock's Browser pane read.
//
// ASKED, NOT PUSHED. The chat socket does not announce browser sessions, so this asks the backend
// (`/api/browser/sessions/current/`) when a conversation opens and every few seconds WHILE A TURN IS
// RUNNING — the only time a session can appear or move. An idle conversation asks nothing. Once the live
// pane is open, its own socket reports state and this polling is redundant but harmless.
//
// The picture is not here. A frame is a picture of a signed-in page; it is drawn straight into the pane
// from the socket and kept nowhere. What this store holds is the card: site, state, driver.
import { defineStore } from 'pinia'
import api from '../services/api'
import { notify } from '../composables/useNotify'
import { isEnded, stateLabel } from '../utils/browserLive'

export const POLL_MS = 3000

export const useBrowserStore = defineStore('browser', {
  state: () => ({
    open: false,
    conversationId: null,
    session: null,          // the card, as `live.describe` returns it
    thumbTick: 0,           // bumped to make the card ask for a fresh thumbnail
    busy: false,            // a take / hand-back request is in flight
    _timer: null,
    _asking: null,          // the conversation a request is out for, so another chat's ask is not skipped
    _following: false,      // a turn is running, whether or not there is a conversation to ask about yet
    _owner: 0,              // the chat view this store currently serves (see `attach`); 0 is nobody
    _views: 0,              // how many views have attached, so each gets a number of its own
  }),

  getters: {
    hasSession: (s) => !!(s.session && s.session.session_id),
    sessionId: (s) => (s.session ? s.session.session_id : null),
    ended: (s) => isEnded(s.session),
    watchable: (s) => !!(s.session && s.session.watchable),
    mine: (s) => !!(s.session && s.session.control && s.session.control.mine),
    needsPerson: (s) => !!(s.session && s.session.state === 'WAITING_HUMAN'),
    label: (s) => stateLabel(s.session),
    // Same-origin and cookie-authenticated, like an artifact download: no blob, no token in the URL.
    // The tick only defeats the browser's own cache; the response is `no-store` already.
    thumbUrl: (s) => (s.session && s.session.session_id
      ? `/api/browser/sessions/${encodeURIComponent(s.session.session_id)}/frame/?t=${s.thumbTick}`
      : ''),
  },

  actions: {
    // ONE CHAT VIEW OWNS THIS STORE AT A TIME. The app shell keys the chat view on the address, so when a
    // new chat gets its id (/chat/new -> /chat/<id>) the whole view is created again — and the new view is
    // set up BEFORE the old one's cleanup runs. The old view's cleanup used to stop the asking the new view
    // had just started: seen live on 2026-10-07 in conversation 2638, one request and then silence while
    // the agent browsed eight pages. A view that has been replaced stops nothing.
    //
    // `attach` hands the view a number, not an object: state is reactive, and an object kept in it comes
    // back wrapped, so it would never compare equal to the one the view holds.
    attach() {
      this._views += 1
      this._owner = this._views
      return this._owner
    },
    detach(token) {
      if (!token || this._owner !== token) return
      this._owner = 0
      this.stopWatching()
      this.close()
    },

    // Point the store at a conversation. A browser belongs to one conversation; carrying a card from one
    // chat into the next would read as a leak, so a real change clears everything first.
    bind(conversationId) {
      const next = conversationId || null
      if (String(next || '') === String(this.conversationId || '')) return
      this._stopTimer()
      this.conversationId = next
      this.session = null
      this.open = false
      this.thumbTick = 0
      if (!next) return
      this.refresh()
      // A NEW chat starts its turn before it has an id: `follow(true)` came first and had nothing to ask
      // about. The id arriving is what starts the asking, or the card never appears until a reload.
      if (this._following) this._startTimer()
    },

    async refresh() {
      const asked = this.conversationId
      if (!asked || String(this._asking || '') === String(asked)) return
      this._asking = asked
      try {
        const { data } = await api.get('/browser/sessions/current/', {
          params: { conversation_id: asked }, noCache: true,
        })
        if (String(asked) !== String(this.conversationId || '')) return   // the chat changed meanwhile
        this.applySession(data ? data.session : null)
      } catch (e) {
        // A card that cannot refresh keeps what it last knew. Nothing to tell the user: the chat works.
      } finally {
        if (String(this._asking || '') === String(asked)) this._asking = null
      }
    },

    // Take a card from anywhere (the poll, or the live socket) and notice what changed.
    applySession(session) {
      const before = this.session
      this.session = session || null
      if (!session) { this.open = false; return }
      const moved = !before || before.session_id !== session.session_id
        || before.action_count !== session.action_count || before.address !== session.address
        || before.state !== session.state
      if (moved) this.thumbTick += 1
    },

    // Poll only while something can change: `active` is "a turn is running in this chat".
    follow(active) {
      if (!active) {
        // One last look when the turn ends, so the card settles on the final state.
        if (this._timer) this.refresh()
        this.stopWatching()
        return
      }
      this._following = true
      if (this._timer || !this.conversationId) return
      this.refresh()
      this._startTimer()
    },
    stopWatching() {
      this._following = false
      this._stopTimer()
    },
    _startTimer() {
      if (this._timer) return
      this._timer = setInterval(() => this.refresh(), POLL_MS)
    },
    _stopTimer() {
      if (this._timer) { clearInterval(this._timer); this._timer = null }
    },

    show() { if (this.hasSession) this.open = true },
    close() { this.open = false },
    toggle() { this.open ? this.close() : this.show() },

    // Driving is a lease the backend grants; these only ask. The live pane hears the answer on its own
    // socket, so the returned card is applied here just to make the button respond at once.
    async takeControl() {
      if (!this.sessionId || this.busy) return false
      this.busy = true
      try {
        await api.post(`/browser/sessions/${encodeURIComponent(this.sessionId)}/take-control/`, {})
        await this._reloadCard()
        return true
      } catch (e) {
        const code = e && e.response && e.response.status
        notify.error(code === 409
          ? 'Somebody already has control of this browser.'
          : 'Could not take control of this browser.')
        return false
      } finally {
        this.busy = false
      }
    },

    async releaseControl() {
      if (!this.sessionId || this.busy) return false
      this.busy = true
      try {
        await api.post(`/browser/sessions/${encodeURIComponent(this.sessionId)}/release-control/`, {})
        await this._reloadCard()
        return true
      } catch (e) {
        notify.error('Could not hand the browser back. Try again.')
        return false
      } finally {
        this.busy = false
      }
    },

    async _reloadCard() {
      try {
        const { data } = await api.get(
          `/browser/sessions/${encodeURIComponent(this.sessionId)}/view/`, { noCache: true })
        if (data && data.session) this.applySession(data.session)
      } catch (e) { /* the socket or the next poll will say */ }
    },
  },
})
