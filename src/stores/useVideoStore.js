/**
 * Video Studio (agentic-docs/VIDEO_WORKSPACE_PLAN.md and VIDEO_STUDIO_AGENT_FLOW_PLAN.md in the backend repo).
 *
 * One store for the Studio's composer, the reference slots, the settings row, the estimate/job cards, the
 * Video panel (Preview / Storyboard / Assets / Versions) and the Library. It talks to /api/video/*; the job state
 * itself is the server's — this store mirrors it from responses and from `video_job` socket frames, and
 * never invents progress.
 */
import { defineStore } from 'pinia'
import api from '../services/api'
import { notify } from '../composables/useNotify'

const TERMINAL = new Set(['ready', 'failed', 'cancelled'])
// Agent or Manual (VIDEO_STUDIO_AGENT_FLOW_PLAN.md D15), remembered per person in this browser. Agent is the default.
const MODE_KEY = 'aadml.studio.mode'
function savedMode() {
  try { return localStorage.getItem(MODE_KEY) === 'manual' ? 'manual' : 'agent' } catch { return 'agent' }
}

function findRoute(routes, id) {
  return routes.find((r) => (r.connections || []).some((c) => String(c.route_id) === String(id)))
    || routes.find((r) => String(r.route_id) === String(id)) || null
}
// What a route's settings row may offer: only values it declares (plan 4.1).
export function optionsFor(route) {
  const out = (route && route.outputs) || {}
  return {
    // The catalog lists durations in its own order (Veo: 8, 4, 6); a person reads them shortest first.
    durations: [...(out.durations || [])].sort((a, b) => a - b),
    resolutions: out.resolutions || [],
    aspectRatios: out.aspect_ratios || [],
    audio: !!out.audio,
  }
}
// Which features a route really offers (its `offered` tasks: declared by the provider's catalog or proven
// by a conformance render; merely advertised does not count).
const RESOLUTION_ORDER = ['480p', '540p', '720p', '768p', '1080p', '2K', '4K']
// The resolution a model starts on: 720p when it offers it (the common default and a modest price), else its lowest.
export function defaultResolution(list) {
  if (!list || !list.length) return ''
  if (list.includes('720p')) return '720p'
  return list.slice().sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b))[0]
}
export function canFor(route) {
  const off = new Set((route && route.offered) || [])
  return {
    references: off.has('reference_to_video'),
    startFrame: off.has('image_to_video') || off.has('first_last_frame'),
    endFrame: off.has('first_last_frame'),
    edit: off.has('edit_uploaded') || off.has('edit_generated'),
    // Native continuation, or a new shot started from the clip's last frame (labelled as such).
    extend: off.has('native_extend') || off.has('image_to_video'),
  }
}
const ROLE_NEEDS = { subject: 'references', style: 'references', motion: 'references', audio: 'references',
                     first_frame: 'startFrame', last_frame: 'endFrame' }
const ROLE_WORDS = { subject: 'reference images', style: 'style references', motion: 'motion references',
                     audio: 'audio references', first_frame: 'an opening shot', last_frame: 'a closing shot' }
/** Why a reference cannot be used by a route ('' when it can). */
function refProblem(ref, can, task) {
  if (ref.role === 'edit_source') return task === 'edit' && !can.edit ? 'cannot edit footage' : ''
  const need = ROLE_NEEDS[ref.role]
  return need && !can[need] ? `does not take ${ROLE_WORDS[ref.role]}` : ''
}

// Image mode (VIDEO_STUDIO_AGENT_FLOW_PLAN.md D14): references are images only, up to what the model takes.
/** Why a reference cannot be used by an image model ('' when it can). index: its place among the references. */
function imageRefProblem(ref, model, index) {
  if (ref.isVideo || /^audio\//.test(String(ref.mime || ''))) return 'uses images only'
  const max = model ? Number(model.max_references || 0) : 4
  if (!max) return 'makes images from words only'
  return index >= max ? `takes up to ${max} reference image${max === 1 ? '' : 's'}` : ''
}
export const IMAGE_ROLES = ['subject', 'style']

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
    // The Studio composer: its draft, what it makes (image | video) and the chosen video task (quick | story | edit).
    studioDraft: '',
    // 'agent': the agent runs the work from the conversation; 'manual': the person picks every setting (D15).
    studioMode: savedMode(),
    kind: 'video',
    task: 'quick',
    // Image mode (D14): the image models this person may pick (/video/image-capabilities/), the pick ('' = Auto,
    // the agent's image model), the shape and how many. Shapes come from the chosen model only.
    image: { models: [], defaultModelId: null, loadedFor: null, modelId: '', aspect_ratio: '1:1', n: 1 },
    // Images made in this session, newest first (the canvas's Images tab).
    sessionImages: [],
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
    // A model switch that would change settings or leave references unused, waiting for the user to apply
    // it or keep the previous model (owner review 2026-10-19: never change or drop inputs silently).
    pendingSwitch: null,
    // The Library: every file the user uploaded or generated, in any chat, and their named Ingredients
    // (VIDEO_STUDIO_AGENT_FLOW_PLAN.md D4).
    libraryOpen: false,
    library: { items: [], page: 1, hasMore: false, loading: false, error: '', type: 'all', source: 'all', q: '', project: '' },
    // The person's video projects, for the Library's project filter: [{ project_id, title }].
    libraryProjects: [],
    ingredients: [],
    // Files chosen on the Library / Ingredients pages, applied by the Create page once it has an agent and a
    // project: [{ kind: 'file', item, role } | { kind: 'ingredient', ingredient }].
    queuedUse: [],
  }),

  getters: {
    route(state) { return findRoute(state.routes, state.routeId || state.defaultRouteId) },
    options() { return optionsFor(this.route) },
    // The panel shows ONLY what the chosen model offers, so a person is never offered a reference slot, an
    // edit or a continuation the model cannot do.
    can() { return canFor(this.route) },
    // References the current model cannot use (e.g. after the agent's default model changed). They are
    // never removed behind the user's back: the chip is flagged and the request waits until it is resolved.
    unusableRefs() {
      // In Agent mode the agent decides how each file is used and picks a model that takes it.
      if (this.studioMode === 'agent') return []
      if (this.kind === 'image') {
        const m = this.imageModel
        return this.refs.map((r, i) => ({ ...r, problem: imageRefProblem(r, m, i) })).filter((r) => r.problem)
      }
      const c = this.can
      return this.refs.map((r) => ({ ...r, problem: refProblem(r, c, this.task) })).filter((r) => r.problem)
    },
    // The image model a request uses: the person's pick, else the agent's (Auto).
    imageModel(state) {
      const id = state.image.modelId || state.image.defaultModelId
      return state.image.models.find((m) => String(m.model_id) === String(id)) || null
    },
    imageShapes() { return (this.imageModel && this.imageModel.shapes) || ['1:1'] },
    // An offered model that can edit footage (Edit footage proposes it when the chosen model cannot).
    editRoute() { return this.routes.find((r) => r.state === 'active' && canFor(r).edit) || null },
    // A model the person could switch to so this file can be used (the switch still goes through the
    // model-switch notice), or null when no offered model takes it.
    alternativeFor() {
      return (ref) => {
        if (this.kind === 'image') {
          const i = this.refs.findIndex((r) => r.key === ref.key)
          const m = this.image.models.find((x) => x !== this.imageModel && !imageRefProblem(ref, x, i))
          return m ? { id: String(m.model_id), name: m.name, kind: 'image' } : null
        }
        const r = this.routes.find((x) => x.state === 'active' && x !== this.route && !refProblem(ref, canFor(x), this.task))
        return r ? { id: String(r.route_id), name: r.name, kind: 'video' } : null
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
    async loadImageCapabilities(agentId, { force = false } = {}) {
      if (!force && this.image.loadedFor === String(agentId || '')) return
      try {
        const res = await api.get('/video/image-capabilities/', { params: agentId ? { agent_id: agentId } : {} })
        this.image.models = res.data.models || []
        this.image.defaultModelId = res.data.default_model_id
        this.image.loadedFor = String(agentId || '')
        if (this.image.modelId && !this.image.models.some((m) => String(m.model_id) === String(this.image.modelId))) this.image.modelId = ''
        if (!this.imageShapes.includes(this.image.aspect_ratio)) this.image.aspect_ratio = this.imageShapes[0]
      } catch {
        this.image.models = []
      }
    },
    setStudioMode(mode) {
      this.studioMode = mode === 'manual' ? 'manual' : 'agent'
      this.pendingSwitch = null
      try { localStorage.setItem(MODE_KEY, this.studioMode) } catch { /* the choice still holds for this visit */ }
    },
    /**
     * Agent mode: a plain message to the agent, with the files added by "+" bound to it like any chat attachment
     * (D15). The agent asks what it needs, picks the models and settings, and every paid step waits on a card.
     */
    async sendAgentMessage({ prompt, chat }) {
      const text = (prompt || '').trim()
      if (!text && !this.refs.length) return false
      const before = chat.pendingAttachments.length
      for (const r of this.refs) {
        if (r.attachment_id) {
          chat.addExistingMedia([{ attachment_id: r.attachment_id, filename: r.name, url: r.url,
                                   type: r.isVideo ? 'video' : 'image' }])
        } else if (r.file) {
          chat.addAttachments([r.file])
        }
      }
      const sent = await chat.sendMessage(text)
      if (sent) this.refs = []
      else chat.pendingAttachments.splice(before)
      return !!sent
    },
    setKind(kind) {
      this.kind = kind === 'image' ? 'image' : 'video'
      this.pendingSwitch = null
      // A video role an image request has no word for keeps the file as the thing to show.
      if (this.kind === 'image') for (const r of this.refs) if (!IMAGE_ROLES.includes(r.role)) r.role = 'subject'
    },
    /**
     * Choose an image model. A model that keeps the shape and every reference is switched to at once; one that
     * cannot goes through the same switch notice as a video model (never applied silently).
     */
    pickImageModel(modelId) {
      const id = modelId || ''
      const m = this.image.models.find((x) => String(x.model_id) === String(id || this.image.defaultModelId)) || null
      const name = m ? m.name : 'Auto'
      const shapes = (m && m.shapes) || ['1:1']
      const changes = shapes.includes(this.image.aspect_ratio) ? [] : [{
        field: 'aspect_ratio', label: 'Shape', from: this.image.aspect_ratio, to: shapes[0], toLabel: shapes[0],
        reason: `${name} makes ${shapes.join(', ')}` }]
      const unusable = this.refs.map((r, i) => ({ key: r.key, name: r.name, problem: imageRefProblem(r, m, i) }))
        .filter((r) => r.problem).map((r) => ({ ...r, reason: `${name} ${r.problem}` }))
      if (!changes.length && !unusable.length) {
        this.image.modelId = id
        this.pendingSwitch = null
        return
      }
      this.pendingSwitch = { kind: 'image', modelId: id, name, changes, unusable, task: null }
    },
    /**
     * Choose a video model. A model that keeps every setting and reference is switched to at once; one
     * that cannot (another clip length, no references, no editing…) is NOT applied: `pendingSwitch` lists
     * each change and why, and nothing changes until applySwitch() or keepCurrentModel().
     */
    pickRoute(routeId) {
      const plan = this._switchPlan(routeId || '')
      if (!plan.changes.length && !plan.unusable.length && !plan.task) {
        this.routeId = routeId || ''
        this.pendingSwitch = null
        this._fillResolution()
        return
      }
      this.pendingSwitch = plan
    },
    applySwitch() {
      const p = this.pendingSwitch
      if (!p) return
      if (p.kind === 'image') {
        this.image.modelId = p.modelId
        for (const c of p.changes) this.image[c.field] = c.to
        const drop = new Set(p.unusable.map((r) => r.key))
        this.refs = this.refs.filter((r) => !drop.has(r.key))
        this.pendingSwitch = null
        return
      }
      this.routeId = p.routeId
      for (const c of p.changes) this.settings[c.field] = c.to
      if (p.task) this.task = p.task.to
      const drop = new Set(p.unusable.map((r) => r.key))
      this.refs = this.refs.filter((r) => !drop.has(r.key))
      this.pendingSwitch = null
      this._fillResolution()
    },
    keepCurrentModel() { this.pendingSwitch = null },
    /** What switching to `routeId` would change: settings it cannot honor, references it cannot use. */
    _switchPlan(routeId) {
      const route = findRoute(this.routes, routeId || this.defaultRouteId)
      const o = optionsFor(route)
      const c = canFor(route)
      const name = route ? route.name : 'Auto'
      const changes = this._settingChanges(o, name)
      const task = this.task === 'edit' && !c.edit
        ? { from: 'Edit footage', to: 'quick', reason: `${name} cannot edit footage` } : null
      const unusable = this.refs.map((r) => ({ key: r.key, name: r.name, role: r.role,
                                               problem: refProblem(r, c, task ? 'quick' : this.task) }))
        .filter((r) => r.problem).map((r) => ({ ...r, reason: `${name} ${r.problem}` }))
      return { routeId, name, changes, unusable, task }
    },
    _settingChanges(o, name) {
      const out = []
      const s = this.settings
      if (o.durations.length && !o.durations.includes(Number(s.duration))) {
        out.push({ field: 'duration', label: 'Clip length', from: `${s.duration} s`,
                   to: o.durations.includes(5) ? 5 : o.durations[0], reason: `${name} makes ${o.durations.join(', ')} s clips` })
      }
      if (o.aspectRatios.length && !o.aspectRatios.includes(s.aspect_ratio)) {
        out.push({ field: 'aspect_ratio', label: 'Shape', from: s.aspect_ratio, to: o.aspectRatios[0],
                   reason: `${name} renders ${o.aspectRatios.join(', ')}` })
      }
      if (o.resolutions.length && s.resolution && !o.resolutions.includes(s.resolution)) {
        out.push({ field: 'resolution', label: 'Resolution', from: s.resolution, to: defaultResolution(o.resolutions),
                   reason: `${name} renders ${o.resolutions.join(', ')}` })
      }
      if (!o.audio && s.sound) {
        out.push({ field: 'sound', label: 'Sound', from: 'on', to: false, reason: `${name} renders silent video` })
      }
      return out.map((x) => ({ ...x, toLabel: x.field === 'duration' ? `${x.to} s` : x.field === 'sound' ? 'off' : String(x.to) }))
    },
    // On first load the settings are still the defaults, so they are simply fitted to the model; a change
    // the user would notice goes through pickRoute's switch plan instead.
    _fitSettings() {
      for (const c of this._settingChanges(this.options, this.route ? this.route.name : 'Auto')) {
        this.settings[c.field] = c.to
      }
      this._fillResolution()
    },
    // Resolution is always one the chosen model offers (720p when it has it, else its lowest), never an unnamed
    // "model default", so what the settings show is what the render asks for. A model that declares none: none.
    _fillResolution() {
      const list = this.options.resolutions
      if (!list.length) this.settings.resolution = ''
      else if (!list.includes(this.settings.resolution)) this.settings.resolution = defaultResolution(list)
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
                       url, file, mime: file.type || '', isVideo: /^video\//.test(file.type || '') })
    },
    addExistingRef(item, role = 'subject') {
      if (!item || !item.attachment_id) return
      if (this.refs.some((r) => r.attachment_id === item.attachment_id && r.role === role)) return
      this.refs.push({ key: item.attachment_id + role, role, name: item.title || item.filename || 'file',
                       url: item.url, attachment_id: item.attachment_id, isVideo: item.media_type === 'video',
                       mime: item.media_type === 'audio' ? 'audio/' : '' })
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
      if (this.pendingSwitch) {
        notify.warning('Apply the model change or keep the current model first.')
        return false
      }
      if (this.unusableRefs.length) {
        notify.warning(`${this.unusableRefs[0].name}: this model ${this.unusableRefs[0].problem}. Remove it or choose another model.`)
        return false
      }
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
    /**
     * "Create image": send the person's words to the AGENT with the Image panel's choices beside it (D14). The agent
     * writes the image prompt and calls GENERATE_IMAGE once; the backend applies the model, shape, count and
     * references over the agent's arguments. The images arrive in the chat and on the canvas's Images tab.
     */
    async requestImage({ prompt, chat }) {
      if (this.busy) return false
      const text = (prompt || '').trim()
      if (!text) return false
      if (this.pendingSwitch) {
        notify.warning('Apply the model change or keep the current model first.')
        return false
      }
      if (this.unusableRefs.length) {
        notify.warning(`${this.unusableRefs[0].name}: this model ${this.unusableRefs[0].problem}. Remove it or choose another model.`)
        return false
      }
      this.busy = true
      try {
        const cid = await chat.ensureConversation()
        if (!cid) return false
        const references = (await this._uploadRefs(cid)).map((r) => ({ attachment_id: r.attachment_id,
          role: IMAGE_ROLES.includes(r.role) ? r.role : 'subject' }))
        const imageRequest = {
          model_id: this.image.modelId ? Number(this.image.modelId) : undefined,
          aspect_ratio: this.image.aspect_ratio || undefined,
          n: Number(this.image.n) || 1,
          references,
        }
        const sent = await chat.sendMessage(text, { imageRequest, imageMode: true })
        if (sent) this.refs = []
        return !!sent
      } catch (e) {
        notify.error((e && e.message) || 'Could not send the image request.')
        return false
      } finally {
        this.busy = false
      }
    },
    // The images made in this chat, newest first (generated only: an upload is not a result).
    async loadSessionImages(conversationId) {
      if (!conversationId) { this.sessionImages = []; return }
      try {
        const res = await api.getConversationMedia(conversationId, { source: 'generated', type: 'image' })
        this.sessionImages = (res.data.media || []).filter((m) => m.attachment_id && m.url)
          .map((m) => ({ attachment_id: m.attachment_id, url: m.url, title: m.title || m.filename || 'Image',
                         media_type: 'image', created_at: m.created_at }))
      } catch { /* keep what is shown */ }
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
    /**
     * Save the finishing timeline (trims, captions, music) as a new revision. The server freezes each scene
     * to its current take, so the export renders exactly this cut even if a take changes later.
     */
    async saveTimeline(edl) {
      if (!this.project) return null
      try {
        const res = await api.post(`/video/projects/${this.project.project_id}/timeline/`, { edl })
        const timeline = { revision: res.data.revision, revision_id: res.data.revision_id, edl: res.data.edl }
        this.project = { ...this.project, timeline }
        return timeline
      } catch (e) {
        notify.error(errText(e, 'Could not save the timeline.'))
        return null
      }
    },
    // Export the saved timeline revision in each shape. Without a revision the server freezes the scenes'
    // current takes at request time.
    async exportTimeline(aspects, { chat, revisionId = null } = {}) {
      return this.local('export', { aspects: aspects && aspects.length ? aspects : ['16:9'],
                                    timeline_revision_id: revisionId || undefined }, { chat })
    },
    // ── Library and Ingredients ───────────────────────────────────────────────────────────────────
    async loadLibraryProjects() {
      try {
        const res = await api.get('/video/projects/')
        this.libraryProjects = (res.data.projects || []).map((p) => ({ project_id: p.project_id, title: p.title || 'Untitled video' }))
      } catch {
        this.libraryProjects = []
      }
    },
    async loadLibrary({ more = false } = {}) {
      const lib = this.library
      const page = more ? lib.page + 1 : 1
      lib.loading = true
      lib.error = ''
      try {
        const res = await api.get('/video/library/', { params: {
          type: lib.type, source: lib.source, q: lib.q || undefined, project_id: lib.project || undefined, page, limit: 40 } })
        lib.items = more ? [...lib.items, ...(res.data.items || [])] : (res.data.items || [])
        lib.page = page
        lib.hasMore = !!res.data.has_more
      } catch (e) {
        lib.error = errText(e, 'Could not load your Library.')
      } finally {
        lib.loading = false
      }
    },
    async loadIngredients(q = '') {
      try {
        this.ingredients = (await api.get('/video/ingredients/', { params: q ? { q } : {} })).data.ingredients || []
      } catch { this.ingredients = [] }
    },
    async createIngredient({ kind, name, description, attachmentIds }) {
      try {
        const res = await api.post('/video/ingredients/', { kind, name, description, attachment_ids: attachmentIds })
        this.ingredients = [res.data, ...this.ingredients]
        notify.success(`Saved "${res.data.name}" as an ingredient.`)
        return res.data
      } catch (e) {
        notify.error(errText(e, 'Could not save the ingredient.'))
        return null
      }
    },
    async updateIngredient(id, changes) {
      try {
        const res = await api.patch(`/video/ingredients/${id}/`, changes)
        this.ingredients = this.ingredients.map((i) => (i.ingredient_id === id ? res.data : i))
        return res.data
      } catch (e) {
        notify.error(errText(e, 'Could not save the ingredient.'))
        return null
      }
    },
    async deleteIngredient(id) {
      try {
        await api.delete(`/video/ingredients/${id}/`)
        this.ingredients = this.ingredients.filter((i) => i.ingredient_id !== id)
        return true
      } catch (e) {
        notify.error(errText(e, 'Could not delete the ingredient.'))
        return false
      }
    },
    // A Library file is used in the open project (one is created when none is open); it is linked to the
    // project on the server, which is what lets the project's renders use it, and added to the composer.
    async _projectForLibrary(chat, title) {
      if (this.project) return this.project
      const tab = this.panelTab
      const p = await this.createProject({ chat, title: title || 'Untitled video', prompt: '' })
      this.panelTab = tab
      return p
    },
    async useLibraryItem(item, role, { chat } = {}) {
      const p = await this._projectForLibrary(chat, item.title)
      if (!p) return false
      try {
        const res = await api.post(`/video/projects/${p.project_id}/assets/`, {
          attachment_id: item.attachment_id, role, source: 'library' })
        this.project = res.data
        this.addExistingRef(item, role)
        notify.success(`${item.title || 'File'} added to this video.`)
        return true
      } catch (e) {
        notify.error(errText(e, 'Could not use that file.'))
        return false
      }
    },
    async useIngredient(ing, { chat } = {}) {
      const p = await this._projectForLibrary(chat, ing.name)
      if (!p) return false
      try {
        const res = await api.post(`/video/ingredients/${ing.ingredient_id}/use/`, { project_id: p.project_id })
        this.project = res.data.project
        for (const f of ing.files || []) this.addExistingRef(f, ing.role)
        notify.success(`${ing.name} added to this video.`)
        return true
      } catch (e) {
        notify.error(errText(e, 'Could not use that ingredient.'))
        return false
      }
    },
    queueUse(entry) { if (entry) this.queuedUse = [...this.queuedUse, entry] },
    // Apply what the Library pages queued. Each entry is removed only once it is applied, so a failure keeps
    // it for the next try instead of losing the user's choice.
    async applyQueuedUse({ chat } = {}) {
      while (this.queuedUse.length) {
        const [entry] = this.queuedUse
        const ok = entry.kind === 'ingredient'
          ? await this.useIngredient(entry.ingredient, { chat })
          : await this.useLibraryItem(entry.item, entry.role, { chat })
        if (!ok) return false
        this.queuedUse = this.queuedUse.slice(1)
      }
      return true
    },
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
      this.sessionImages = []
      this.conversationId = null
      this.pendingSwitch = null
      this.project = null
      this.versions = []
      this.refs = []
      this.previewAttachmentId = null
      this.compareAttachmentId = null
      this.panelOpen = false
    },
  },
})
