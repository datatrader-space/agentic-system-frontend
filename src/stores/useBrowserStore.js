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
    // LOOKING BACK. `timeline` is the session's actions in order, as the backend's ledger has them;
    // `viewing` is the action whose picture the pane is showing, or null for the live page.
    timeline: [],
    viewing: null,
    _timelineOut: null,     // the session a timeline request is out for
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
    // A turn is running in this chat. The browser outlives the turn by a few minutes, and for those
    // minutes nobody is driving it: seen live on 2026-10-07 (conversation 2643), the run had stopped and
    // the card still read "Working" with "The agent is driving" under the picture.
    running: (s) => !!s._following,
    label: (s) => {
      const words = stateLabel(s.session)
      return words === 'Working' && !s._following ? 'Idle' : words
    },
    // Same-origin and cookie-authenticated, like an artifact download: no blob, no token in the URL.
    // The tick only defeats the browser's own cache; the response is `no-store` already.
    thumbUrl: (s) => (s.session && s.session.session_id
      ? `/api/browser/sessions/${encodeURIComponent(s.session.session_id)}/frame/?t=${s.thumbTick}`
      : ''),
    // The actions that left a picture, which are the ones a person can step to.
    pictured: (s) => s.timeline.filter((a) => a.keyframe),
    viewed: (s) => (s.viewing ? s.timeline.find((a) => a.action_id === s.viewing) || null : null),
    // Same-origin and cookie-authenticated like the thumbnail. An action id is not a secret and is not
    // an authorization: the backend finds the action inside the caller's own session or answers 404.
    keyframeUrl: (s) => (s.viewing && s.session && s.session.session_id
      ? `/api/browser/sessions/${encodeURIComponent(s.session.session_id)}/keyframes/${encodeURIComponent(s.viewing)}/`
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
      this.timeline = []
      this.viewing = null
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
      if (!session) { this.open = false; this.timeline = []; this.viewing = null; return }
      const another = !before || before.session_id !== session.session_id
      const moved = another || before.action_count !== session.action_count
        || before.address !== session.address || before.state !== session.state
      if (another) { this.timeline = []; this.viewing = null }
      if (moved) this.thumbTick += 1
      // A new action is a new mark. Only asked for while the pane is open: the card needs none of it.
      if (this.open && (another || before.action_count !== session.action_count)) this.loadTimeline()
    },

    // The session's actions, in order, for the strip under the picture. Replaced whole each time: the
    // ledger is the truth and it is short. A failure keeps the marks already shown.
    async loadTimeline() {
      const id = this.sessionId
      if (!id || this._timelineOut === id) return
      this._timelineOut = id
      try {
        const { data } = await api.get(`/browser/sessions/${encodeURIComponent(id)}/timeline/`, { noCache: true })
        if (id !== this.sessionId) return                 // the chat changed meanwhile
        this.timeline = Array.isArray(data && data.actions) ? data.actions : []
        // The action being looked at is still there, or the pane goes back to the live page.
        if (this.viewing && !this.timeline.some((a) => a.action_id === this.viewing && a.keyframe)) this.viewing = null
      } catch (e) {
        // Looking back is extra; the live view does not depend on it.
      } finally {
        if (this._timelineOut === id) this._timelineOut = null
      }
    },

    // Step to the page as one action left it. Only an action that has a picture can be stepped to.
    view(actionId) {
      const found = this.timeline.find((a) => a.action_id === actionId)
      if (found && found.keyframe) this.viewing = actionId
    },
    backToLive() { this.viewing = null },
    // One mark earlier or later among the pictured actions; past the newest is the live page.
    step(by) {
      const marks = this.pictured
      if (!marks.length) return
      const at = this.viewing ? marks.findIndex((a) => a.action_id === this.viewing) : marks.length
      const next = at + by
      if (next >= marks.length) { this.viewing = null; return }
      this.viewing = marks[Math.max(0, next)].action_id
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

    show() {
      if (!this.hasSession) return
      this.open = true
      this.loadTimeline()
    },
    close() { this.open = false; this.viewing = null },
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
