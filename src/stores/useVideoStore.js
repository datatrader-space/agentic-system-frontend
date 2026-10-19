/**
 * Video mode (agentic-docs/VIDEO_WORKSPACE_PLAN.md in the backend repo).
 *
 * One store for the composer's Video pill, the reference slots, the settings row, the estimate/job cards
 * and the Video panel (Preview / Storyboard / Assets / Versions). It talks to /api/video/*; the job state
 * itself is the server's — this store mirrors it from responses and from `video_job` socket frames, and
 * never invents progress.
 */
import { defineStore } from 'pinia'
import api from '../services/api'
import { notify } from '../composables/useNotify'

const TERMINAL = new Set(['ready', 'failed', 'cancelled'])

function errText(e, fallback) {
  const d = e && e.response && e.response.data
  const err = d && d.error
  if (err && err.message) {
    const alts = (err.alternatives || []).map((a) => a.name || a.model_id).filter(Boolean)
    return alts.length ? `${err.message} Models that can do it: ${alts.join(', ')}.` : err.message
  }
  return fallback
}

export const useVideoStore = defineStore('video', {
  state: () => ({
    // Composer: the Video pill and the chosen task (quick | story | edit).
    mode: false,
    studioDraft: '',
    task: 'quick',
    // Settings row. '' = let the route decide; values come from the chosen route's declared outputs.
    routeId: '',
    settings: { aspect_ratio: '16:9', duration: 5, resolution: '', sound: false },
    targetSeconds: 12,
    // Reference slots: [{ key, role, name, url, file?, attachment_id? }]
    refs: [],
    // Capabilities for the current agent (from /video/capabilities/).
    routes: [],
    defaultRouteId: null,
    capsLoadedFor: null,
    // Jobs by id (mirrors the server) and the conversation they belong to.
    jobs: {},
    busy: false,
    // The open project and the panel. conversationId is the chat they were loaded for.
    conversationId: null,
    project: null,
    versions: [],
    panelOpen: false,
    panelTab: 'preview',
    previewAttachmentId: null,
    compareAttachmentId: null,
  }),

  getters: {
    route(state) {
      const id = state.routeId || state.defaultRouteId
      return state.routes.find((r) => r.connections.some((c) => String(c.route_id) === String(id)))
        || state.routes.find((r) => String(r.route_id) === String(id)) || null
    },
    // What the settings row may offer: only values the chosen route declares (plan 4.1).
    options() {
      const out = (this.route && this.route.outputs) || {}
      return {
        // The catalog lists durations in its own order (Veo: 8, 4, 6); a person reads them shortest first.
        durations: [...(out.durations || [])].sort((a, b) => a - b),
        resolutions: out.resolutions || [],
        aspectRatios: out.aspect_ratios || [],
        audio: !!out.audio,
      }
    },
    // Which features the chosen model really offers (its `offered` tasks: declared by the provider's catalog
    // or proven by a conformance render; merely advertised does not count). The panel shows ONLY these, so
    // a person is never offered a reference slot, an edit or a continuation the model cannot do.
    can() {
      const off = new Set((this.route && this.route.offered) || [])
      return {
        references: off.has('reference_to_video'),
        startFrame: off.has('image_to_video') || off.has('first_last_frame'),
        endFrame: off.has('first_last_frame'),
        edit: off.has('edit_uploaded') || off.has('edit_generated'),
        // Native continuation, or a new shot started from the clip's last frame (labelled as such).
        extend: off.has('native_extend') || off.has('image_to_video'),
      }
    },
    jobsFor: (state) => (conversationId) => Object.values(state.jobs)
      .filter((j) => String(j.conversation_id || '') === String(conversationId || ''))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    activeVideo(state) {
      if (state.previewAttachmentId) {
        const v = state.versions.find((x) => x.attachment_id === state.previewAttachmentId)
        if (v) return v
      }
      if (state.project && state.project.active_video) return state.project.active_video
      const chosen = state.versions.find((x) => x.is_active)
      if (chosen) return chosen
      const ready = Object.values(state.jobs).filter((j) => j.state === 'ready' && j.output && j.output.url
        && (j.operation !== 'frame'))
      ready.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
      return ready[0] ? ready[0].output : null
    },
  },

  actions: {
    toggleMode(on) {
      this.mode = on === undefined ? !this.mode : !!on
      if (this.mode) this.panelOpen = this.panelOpen || !!this.project
    },
    setTask(t) { this.task = t },

    // ── capabilities ──────────────────────────────────────────────────────────────────────────────
    async loadCapabilities(agentId, { force = false } = {}) {
      if (!force && this.capsLoadedFor === String(agentId || '')) return
      try {
        const res = await api.get('/video/capabilities/', { params: agentId ? { agent_id: agentId } : {} })
        this.routes = res.data.routes || []
        this.defaultRouteId = res.data.default_route_id
        this.capsLoadedFor = String(agentId || '')
        this._fitSettings()
      } catch {
        this.routes = []
      }
    },
    pickRoute(routeId) {
      this.routeId = routeId || ''
      this._fitSettings()
    },
    // Keep compatible settings; replace the rest with a value the route supports (shown, not silent:
    // the estimate still lists any change it proposes).
    _fitSettings() {
      const o = this.options
      if (o.durations.length && !o.durations.includes(Number(this.settings.duration))) {
        this.settings.duration = o.durations.includes(5) ? 5 : o.durations[0]
      }
      if (o.aspectRatios.length && !o.aspectRatios.includes(this.settings.aspect_ratio)) {
        this.settings.aspect_ratio = o.aspectRatios[0]
      }
      if (o.resolutions.length && this.settings.resolution && !o.resolutions.includes(this.settings.resolution)) {
        this.settings.resolution = ''
      }
      if (!o.audio) this.settings.sound = false
    },

    // ── reference slots ───────────────────────────────────────────────────────────────────────────
    addRef(file, role = 'subject') {
      if (!file) return
      const url = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : ''
      // Start / end frame are single slots: a new one replaces the old.
      if (role === 'first_frame' || role === 'last_frame' || role === 'edit_source') {
        this.refs = this.refs.filter((r) => r.role !== role)
      }
      this.refs.push({ key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, name: file.name,
                       url, file, isVideo: /^video\//.test(file.type || '') })
    },
    addExistingRef(item, role = 'subject') {
      if (!item || !item.attachment_id) return
      if (this.refs.some((r) => r.attachment_id === item.attachment_id && r.role === role)) return
      this.refs.push({ key: item.attachment_id + role, role, name: item.title || item.filename || 'file',
                       url: item.url, attachment_id: item.attachment_id, isVideo: item.media_type === 'video' })
    },
    setRefRole(key, role) {
      const r = this.refs.find((x) => x.key === key)
      if (r) r.role = role
    },
    removeRef(key) { this.refs = this.refs.filter((r) => r.key !== key) },

    // Uploads go to the conversation like any chat attachment, so the server owns, scans and resolves
    // them; the job then names them by id.
    async _uploadRefs(conversationId) {
      const out = []
      for (const r of this.refs) {
        if (!r.attachment_id && r.file) {
          const res = await api.uploadConversationFile(conversationId, r.file)
          r.attachment_id = res && res.data && res.data.attachment_id
          if (!r.attachment_id) throw new Error(`"${r.name}" could not be uploaded.`)
        }
        if (r.attachment_id) out.push({ attachment_id: r.attachment_id, role: r.role })
      }
      return out
    },

    // ── jobs ──────────────────────────────────────────────────────────────────────────────────────
    _put(job) {
      if (!job || !job.job_id) return job
      const previousState = this.jobs[job.job_id]?.state
      this.jobs = { ...this.jobs, [job.job_id]: { ...(this.jobs[job.job_id] || {}), ...job } }
      if (previousState !== 'ready' && job.state === 'ready' && job.output && job.operation !== 'frame' && job.operation !== 'export') {
        this.previewAttachmentId = null
      }
      return this.jobs[job.job_id]
    },
    onFrame(data) {
      const prev = this.jobs[data.job_id]
      const job = this._put(data)
      // A free local edit (trim, speed) can finish before its first frame arrives: no earlier state counts.
      if ((!prev || !TERMINAL.has(prev.state)) && job.state === 'ready') {
        if (job.project_id && this.project && String(this.project.project_id) === String(job.project_id)) {
          this.loadProject(job.conversation_id)
        } else if (String(job.conversation_id || '') === String(this.conversationId || '')) {
          this.loadVersions()
        }
      }
    },
    async loadJobs(conversationId) {
      if (!conversationId) return
      try {
        const res = await api.get('/video/jobs/', { params: { conversation_id: conversationId } })
        for (const j of res.data.jobs || []) this._put(j)
      } catch { /* the chat still works without the cards */ }
    },

    /**
     * "Get estimate": send the person's words to the AGENT as their chat message, with the panel's choices
     * beside it. The agent writes a production-quality video prompt and calls GENERATE_VIDEO / EDIT_VIDEO;
     * the backend applies these choices (the model, settings, references) over the agent's arguments. The
     * estimate card arrives as a `video_job` frame and nothing is spent until Generate. Works like
     * Create-Image: the request, the agent's reply and the result all stay in the conversation.
     * task: 'quick' (new clip) | 'edit' (change footage) | 'extend' (continue a clip).
     */
    async request({ prompt, chat, task = null, baseAttachmentId = null, sceneId = null }) {
      if (this.busy) return false
      const kind = task || (this.task === 'edit' ? 'edit' : 'quick')
      const text = (prompt || '').trim()
      if (!text) return false
      this.busy = true
      try {
        const cid = await chat.ensureConversation()
        if (!cid) return false
        const references = await this._uploadRefs(cid)
        const edit = references.find((r) => r.role === 'edit_source')
        const base = baseAttachmentId || (edit && edit.attachment_id) || undefined
        if (kind === 'edit' && !base) {
          notify.warning('Add the video to edit first (Edit footage needs a source video).')
          return false
        }
        const videoRequest = {
          task: kind,
          route_id: this.routeId || undefined,
          duration: Number(this.settings.duration) || undefined,
          aspect_ratio: this.settings.aspect_ratio || undefined,
          resolution: this.settings.resolution || undefined,
          sound: this.options.audio ? !!this.settings.sound : undefined,
          references: references.filter((r) => r.role !== 'edit_source'),
          base_attachment_id: base,
          scene_id: sceneId || undefined,
        }
        const sent = await chat.sendMessage(text, { videoRequest })
        if (sent) this.refs = []
        return !!sent
      } catch (e) {
        notify.error((e && e.message) || 'Could not send the video request.')
        return false
      } finally {
        this.busy = false
      }
    },
    async local(operation, params, { chat, baseAttachmentId = null, sceneId = null } = {}) {
      try {
        const cid = chat ? await chat.ensureConversation() : null
        const res = await api.post('/video/jobs/', {
          operation, params, conversation_id: cid || undefined, base_attachment_id: baseAttachmentId || undefined,
          project_id: this.project ? this.project.project_id : undefined, scene_id: sceneId || undefined,
        })
        return this._put(res.data)
      } catch (e) {
        notify.error(errText(e, 'That edit could not start.'))
        return null
      }
    },
    async start(job, accept = true) {
      try {
        const res = await api.post(`/video/jobs/${job.job_id}/start/`, { accept })
        return this._put(res.data)
      } catch (e) {
        notify.error(errText(e, 'The render could not start.'))
        if (e && e.response && e.response.status === 409) this.refreshJob(job.job_id)
        return null
      }
    },
    async decline(job) {
      try { this._put((await api.post(`/video/jobs/${job.job_id}/decline/`)).data) } catch { /* shown as is */ }
    },
    async stopWaiting(job) {
      try {
        this._put((await api.post(`/video/jobs/${job.job_id}/stop/`)).data)
        notify.info('Stopped waiting. If the provider still finishes, the video is kept in Versions.')
      } catch (e) {
        notify.error(errText(e, 'Could not stop waiting.'))
      }
    },
    async refreshJob(jobId) {
      try { this._put((await api.get(`/video/jobs/${jobId}/`)).data) } catch { /* keep the last state */ }
    },
    dismiss(jobId) {
      const next = { ...this.jobs }
      delete next[jobId]
      this.jobs = next
    },

    // ── project & panel ───────────────────────────────────────────────────────────────────────────
    async loadProject(conversationId) {
      this.conversationId = conversationId || null
      if (!conversationId) { this.project = null; this.versions = []; return null }
      try {
        const res = await api.get('/video/projects/', { params: { conversation_id: conversationId } })
        this.project = res.data.project || null
      } catch {
        this.project = null
      }
      this.loadVersions()
      return this.project
    },
    async createProject({ chat, title, prompt, targetSeconds }) {
      const cid = await chat.ensureConversation()
      if (!cid) return null
      try {
        const res = await api.post('/video/projects/', {
          conversation_id: cid, title: (title || prompt || 'Untitled video').slice(0, 120),
          aspect_ratio: this.settings.aspect_ratio, target_duration_ms: Math.round((targetSeconds ?? this.targetSeconds) * 1000),
          brief: { goal: prompt || '' },
        })
        this.project = res.data
        this.panelOpen = true
        this.panelTab = 'storyboard'
        return this.project
      } catch (e) {
        notify.error(errText(e, 'Could not create the project.'))
        return null
      }
    },
    // Story video: the project holds the plan; the agent writes the scenes (planning is free) and the
    // user renders scene by scene from the Storyboard.
    async planStory({ prompt, chat }) {
      const text = (prompt || '').trim()
      if (!text) { notify.warning('Describe the story first.'); return false }
      const p = this.project || await this.createProject({ chat, title: text, prompt: text })
      if (!p) return false
      const msg = `Plan a ${this.targetSeconds}-second story video in the open video project: ${text}\n` +
        `Use UPDATE_VIDEO_PROJECT to write the brief and the scenes (aspect ${this.settings.aspect_ratio}). ` +
        `Do not render anything yet.`
      return chat.sendMessage(msg)
    },
    async patchProject(changes) {
      if (!this.project) return null
      try {
        const res = await api.patch(`/video/projects/${this.project.project_id}/`, {
          ...changes, revision: this.project.revision,
        })
        this.project = res.data
        return this.project
      } catch (e) {
        if (e && e.response && e.response.status === 409 && e.response.data.project) {
          this.project = e.response.data.project
          notify.warning('The project changed meanwhile (the assistant may have edited it). Showing the latest.')
        } else {
          notify.error(errText(e, 'Could not save the project.'))
        }
        return null
      }
    },
    async moveScene(index, delta) {
      const scenes = (this.project && this.project.scenes) || []
      const j = index + delta
      if (j < 0 || j >= scenes.length) return
      const next = scenes.slice()
      const [s] = next.splice(index, 1)
      next.splice(j, 0, s)
      await this.patchProject({ scenes: next.map((x) => ({ scene_id: x.scene_id, title: x.title, intent: x.intent,
                                                          planned_ms: x.planned_ms, references: x.references })) })
    },
    // A project's versions, or, in a chat with no project, the chat's own generated and edited videos (the
    // chat keeps its own active video, so Restore works there too).
    async loadVersions() {
      try {
        const res = this.project
          ? await api.get(`/video/projects/${this.project.project_id}/versions/`)
          : this.conversationId
            ? await api.get('/video/versions/', { params: { conversation_id: this.conversationId } })
            : null
        this.versions = (res && res.data.versions) || []
      } catch { this.versions = [] }
    },
    async pin(item, role, conversationId) {
      if (!this.project) return
      try {
        const res = await api.post(`/video/projects/${this.project.project_id}/assets/`, {
          attachment_id: item.attachment_id, role, conversation_id: conversationId,
        })
        this.project = res.data
      } catch (e) { notify.error(errText(e, 'Could not add that file to the project.')) }
    },
    async unpin(asset) {
      if (!this.project) return
      try {
        const res = await api.delete(`/video/projects/${this.project.project_id}/assets/`, { data: { asset_id: asset.asset_id } })
        this.project = res.data
      } catch { /* unchanged */ }
    },
    // Restore: moves the selection only — no render, no cost (plan F16).
    async restore(version, { conversationId, sceneId } = {}) {
      try {
        await api.post('/video/selection/', {
          attachment_id: version.attachment_id, conversation_id: conversationId || undefined,
          project_id: this.project ? this.project.project_id : undefined, scene_id: sceneId || undefined,
        })
        this.previewAttachmentId = null
        if (this.project) await this.loadProject(conversationId)
        else await this.loadVersions()
        notify.success(`Version v${version.version} is now the active video.`)
      } catch (e) {
        notify.error(errText(e, 'Could not restore that version.'))
      }
    },
    openPanel(tab) {
      this.panelOpen = true
      if (tab) this.panelTab = tab
    },
    closePanel() { this.panelOpen = false },
    reset() {
      this.jobs = {}
      this.conversationId = null
      this.project = null
      this.versions = []
      this.refs = []
      this.previewAttachmentId = null
      this.compareAttachmentId = null
      this.panelOpen = false
    },
  },
})
