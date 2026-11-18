<template>
  <section class="vpb" aria-labelledby="vpb-title" data-test="video-studio-publish">
    <header class="vpb-head">
      <h1 id="vpb-title">Publish</h1>
      <p class="vpb-sub">Post a finished video to your own accounts, now or at a time you choose. Each platform is signed in to with your account and only used when you publish.</p>
    </header>

    <div class="vpb-body">
      <section class="vpb-accounts" aria-labelledby="vpb-accounts-title">
        <h2 id="vpb-accounts-title">Your accounts</h2>
        <p v-if="loading" class="vpb-note" role="status">Loading your accounts…</p>
        <p v-else-if="loadError" class="vpb-note err" role="alert">{{ loadError }} <button type="button" class="vpb-btn" @click="load">Try again</button></p>
        <ul v-else class="vpb-list">
          <li v-for="c in connections" :key="c.platform" class="vpb-account" :data-test="'vpb-account-' + c.platform">
            <span class="vpb-account-name">{{ c.label }}</span>
            <span class="vpb-account-state" :class="stateOf(c).tone">{{ stateOf(c).text }}</span>
            <span class="vpb-account-act">
              <template v-if="!c.configured"></template>
              <template v-else-if="confirming === c.platform">
                <button type="button" class="vpb-btn danger" :disabled="busy === c.platform" :data-test="'vpb-disconnect-yes-' + c.platform" @click="disconnect(c)">Disconnect</button>
                <button type="button" class="vpb-btn" @click="confirming = ''">Keep</button>
              </template>
              <button v-else-if="c.connected" type="button" class="vpb-btn" :data-test="'vpb-disconnect-' + c.platform" @click="confirming = c.platform">Disconnect</button>
              <button v-else type="button" class="vpb-btn primary" :disabled="busy === c.platform" :data-test="'vpb-connect-' + c.platform" @click="connect(c)">{{ busy === c.platform ? 'Connecting…' : c.needs_reconnect ? 'Reconnect' : 'Connect' }}</button>
            </span>
          </li>
        </ul>
        <p v-if="accountMessage" class="vpb-note" :class="{ err: accountError }" role="status">{{ accountMessage }}</p>
      </section>

      <section class="vpb-form-wrap" aria-labelledby="vpb-new-title">
        <h2 id="vpb-new-title">New post</h2>
        <p v-if="!loading && !connected.length" class="vpb-note">Connect an account above to publish a video.</p>
        <form v-else-if="!loading" class="vpb-form" novalidate data-test="vpb-form" @submit.prevent="submit">
          <label class="vpb-field">Platform
            <select v-model="form.platform" data-test="vpb-platform" @change="platformChanged">
              <option v-for="c in connected" :key="c.platform" :value="c.platform">{{ c.label }}</option>
            </select>
          </label>
          <label class="vpb-field">Video
            <select v-model="form.video_id" data-test="vpb-video" required>
              <option value="">Choose a video from your Library</option>
              <option v-for="v in videos" :key="v.attachment_id" :value="v.attachment_id">{{ v.title }}</option>
            </select>
          </label>
          <img v-if="chosenVideo?.thumbnail_url" :src="chosenVideo.thumbnail_url" alt="" class="vpb-preview" loading="lazy" />
          <label v-if="platform?.needs_destination" class="vpb-field">{{ platform.platform === 'instagram' ? 'Instagram account' : 'Facebook Page' }}
            <select v-model="form.destination_id" data-test="vpb-destination">
              <option value="">{{ destLoading ? 'Loading…' : 'Choose where to publish' }}</option>
              <option v-for="d in destinations" :key="d.id" :value="d.id">{{ d.name }}{{ d.page_name ? ` (${d.page_name})` : '' }}</option>
            </select>
          </label>
          <label class="vpb-field">{{ platform?.combined_text ? 'Title (first line of the post)' : 'Title' }}
            <input v-model="form.title" type="text" data-test="vpb-title" />
            <small v-if="platform?.max_title" class="vpb-count" :class="{ over: form.title.length > platform.max_title }">{{ form.title.length }} of {{ platform.max_title }}</small>
          </label>
          <label class="vpb-field">Description
            <textarea v-model="form.description" rows="4" data-test="vpb-description"></textarea>
          </label>
          <label class="vpb-field">Tags, separated by commas
            <input v-model="form.tags" type="text" placeholder="launch, behind the scenes" data-test="vpb-tags" />
          </label>
          <small v-if="platform?.max_text" class="vpb-count" :class="{ over: textLength > platform.max_text }" data-test="vpb-text-count">{{ platform.combined_text ? 'Post text' : 'Description' }}: {{ textLength }} of {{ platform.max_text }} characters</small>
          <label v-if="privacyOptions.length" class="vpb-field">Who can see it
            <select v-model="form.privacy" data-test="vpb-privacy">
              <option value="">Choose</option>
              <option v-for="o in privacyOptions" :key="o" :value="o">{{ privacyLabel(o) }}</option>
            </select>
          </label>
          <label class="vpb-field">Thumbnail (optional)
            <select v-model="form.thumbnail_id" data-test="vpb-thumbnail">
              <option value="">None</option>
              <option v-for="p in pictures" :key="p.attachment_id" :value="p.attachment_id">{{ p.title }}</option>
            </select>
          </label>
          <label class="vpb-field">Captions from a project's timeline (optional)
            <select v-model="form.project_id" data-test="vpb-project">
              <option value="">No captions</option>
              <option v-for="p in projects" :key="p.project_id" :value="p.project_id">{{ p.title }}</option>
            </select>
          </label>
          <ul v-if="notSent.length" class="vpb-notsent" data-test="vpb-not-sent">
            <li v-for="n in notSent" :key="n">Not sent to {{ platform.label }}: {{ n }}</li>
          </ul>
          <fieldset class="vpb-when">
            <legend>When</legend>
            <label><input v-model="form.when" type="radio" value="now" /> Now</label>
            <label><input v-model="form.when" type="radio" value="later" data-test="vpb-later" /> Later</label>
            <input v-if="form.when === 'later'" v-model="form.at" type="datetime-local" aria-label="Date and time" data-test="vpb-at" />
          </fieldset>
          <p v-if="formError" class="vpb-note err" role="alert" data-test="vpb-error">{{ formError }}</p>
          <p v-if="formDone" class="vpb-note ok" role="status">{{ formDone }}</p>
          <button type="submit" class="vpb-btn primary" :disabled="sending" data-test="vpb-submit">{{ sending ? 'Sending…' : form.when === 'later' ? 'Schedule' : 'Publish now' }}</button>
        </form>
      </section>

      <section class="vpb-posts" aria-labelledby="vpb-posts-title">
        <h2 id="vpb-posts-title">Your posts</h2>
        <p v-if="!publications.length" class="vpb-note">Nothing published yet. Posts you publish or schedule appear here with their status.</p>
        <ul v-else class="vpb-list">
          <li v-for="p in publications" :key="p.publication_id" class="vpb-post" :data-test="'vpb-post-' + p.status">
            <div class="vpb-post-main">
              <strong>{{ p.title || 'Untitled' }}</strong>
              <span class="vpb-post-meta">{{ p.label }}<template v-if="p.destination?.name">, {{ p.destination.name }}</template>. {{ whenText(p) }}</span>
              <span v-if="p.error" class="vpb-post-err">{{ p.error.message }}</span>
              <span v-for="n in p.not_sent" :key="n" class="vpb-post-meta">Not sent: {{ n }}</span>
            </div>
            <span class="vpb-badge" :class="p.status">{{ statusText(p) }}</span>
            <a v-if="p.remote_url" :href="p.remote_url" target="_blank" rel="noopener" class="vpb-btn">Open on {{ p.label }}</a>
            <button v-if="p.status === 'scheduled'" type="button" class="vpb-btn" :data-test="'vpb-cancel'" @click="act(p, 'cancel')">Cancel</button>
            <button v-if="p.status === 'failed'" type="button" class="vpb-btn" :data-test="'vpb-retry'" @click="act(p, 'retry')">Try again</button>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import api from '../services/api'
import { runOAuthPopup } from '@/composables/useOAuthPopup'

const connections = ref([]), publications = ref([]), videos = ref([]), pictures = ref([]), projects = ref([])
const loading = ref(true), loadError = ref(''), busy = ref(''), confirming = ref('')
const accountMessage = ref(''), accountError = ref(false)
const destinations = ref([]), destLoading = ref(false), tiktokPrivacy = ref([])
const sending = ref(false), formError = ref(''), formDone = ref('')
const form = reactive({ platform: '', video_id: '', title: '', description: '', tags: '', privacy: '', thumbnail_id: '', project_id: '', destination_id: '', when: 'now', at: '' })
let submitKey = ''
let timer = null

const connected = computed(() => connections.value.filter(c => c.connected))
const platform = computed(() => connections.value.find(c => c.platform === form.platform))
const chosenVideo = computed(() => videos.value.find(v => v.attachment_id === form.video_id))
const privacyOptions = computed(() => form.platform === 'tiktok' ? tiktokPrivacy.value : (platform.value?.privacy_options || []))
const tagList = computed(() => form.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean))
const textLength = computed(() => {
  if (!platform.value?.combined_text) return form.description.trim().length
  const tags = tagList.value.map(t => '#' + t.replace(/\s+/g, '')).join(' ')
  return [form.title.trim(), form.description.trim(), tags].filter(Boolean).join('\n\n').length
})
const notSent = computed(() => {
  const f = platform.value?.fields || {}
  const out = []
  if (form.thumbnail_id && f.thumbnail !== true) out.push(typeof f.thumbnail === 'string' ? `the thumbnail (${f.thumbnail})` : 'the thumbnail')
  if (form.project_id && f.captions !== true) out.push('captions')
  return out
})

function stateOf(c) {
  if (!c.configured) return { text: 'Not set up on this platform yet', tone: 'muted' }
  if (c.needs_reconnect) return { text: 'Sign-in ended. Reconnect to publish.', tone: 'warn' }
  if (c.connected) return { text: c.account ? `Connected as ${c.account}` : 'Connected', tone: 'ok' }
  return { text: 'Not connected', tone: 'muted' }
}
const PRIVACY = { public: 'Everyone', unlisted: 'People with the link', private: 'Only you', PUBLIC: 'Everyone', CONNECTIONS: 'Your connections',
  PUBLIC_TO_EVERYONE: 'Everyone', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers', SELF_ONLY: 'Only you' }
function privacyLabel(o) { return PRIVACY[o] || o }
const STATUS = { scheduled: 'Scheduled', publishing: 'Publishing', processing: 'Processing', published: 'Published', failed: 'Failed', cancelled: 'Cancelled' }
function statusText(p) { return STATUS[p.status] || p.status }
function when(iso) { return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '' }
function whenText(p) {
  if (p.status === 'published') return `Published ${when(p.published_at)}`
  if (p.status === 'scheduled' && p.attempts) return `Trying again ${when(p.next_attempt_at)} (attempt ${p.attempts + 1} of ${p.max_attempts})`
  if (p.status === 'scheduled') return p.scheduled_at ? `Goes out ${when(p.scheduled_at)}` : 'Starting now'
  return `Asked ${when(p.created_at)}`
}
function errorText(e, fallback) { return e?.response?.data?.error?.message || fallback }

async function loadConnections() {
  connections.value = (await api.getPublishConnections()).data.connections || []
  if (!connected.value.some(c => c.platform === form.platform)) { form.platform = connected.value[0]?.platform || ''; platformChanged() }
}
// Every page of the person's Library of one kind: the pickers list all of it.
async function wholeLibrary(type) {
  const out = []
  for (let page = 1; ; page++) {
    const { data } = await api.get('/video/library/', { params: { type, page, limit: 100 } })
    out.push(...(data.items || []))
    if (!data.has_more) return out
  }
}
async function loadPublications() { publications.value = (await api.getPublications()).data.publications || [] }
async function load() {
  loading.value = true; loadError.value = ''
  try {
    const [, , v, p, pr] = await Promise.all([loadConnections(), loadPublications(), wholeLibrary('video'), wholeLibrary('image'), api.get('/video/projects/')])
    videos.value = v; pictures.value = p; projects.value = pr.data.projects || []
  } catch { loadError.value = 'Your accounts could not be loaded.' }
  finally { loading.value = false }
}

async function platformChanged() {
  destinations.value = []; form.destination_id = ''; form.privacy = ''; tiktokPrivacy.value = []
  const p = platform.value
  if (!p || !(p.needs_destination || p.platform === 'tiktok')) return
  destLoading.value = true
  try {
    const { data } = await api.getPublishDestinations(p.platform)
    destinations.value = data.destinations || []
    tiktokPrivacy.value = data.privacy_options || []
  } catch (e) { formError.value = errorText(e, `Your ${p.label} account could not be read.`) }
  finally { destLoading.value = false }
}

function connect(c) {
  accountMessage.value = ''; busy.value = c.platform
  // The popup opens inside the click (useOAuthPopup); the server is the only judge of whether it worked.
  runOAuthPopup(() => api.startOAuth(c.service_id).then(r => r.data?.redirect_url).catch(e => { throw new Error(e?.response?.data?.error || e?.response?.data?.detail || `${c.label} sign-in could not start.`) }), {
    name: 'oauth_popup', messageTypes: ['oauth_result'],
    verify: async () => { await loadConnections(); return !!connections.value.find(x => x.platform === c.platform)?.connected },
  }).then(async result => {
    await loadConnections()
    if (result.ok) { accountError.value = false; accountMessage.value = `${c.label} connected.` }
    else if (result.status !== 'cancelled') { accountError.value = true; accountMessage.value = result.error || `${c.label} could not be connected.` }
  }).finally(() => { busy.value = '' })
}

async function disconnect(c) {
  busy.value = c.platform
  try {
    await api.disconnectOAuth(c.service_id)
    accountError.value = false; accountMessage.value = `${c.label} disconnected.`
  } catch (e) { accountError.value = true; accountMessage.value = errorText(e, `${c.label} could not be disconnected.`) }
  finally { busy.value = ''; confirming.value = ''; await loadConnections() }
}

async function submit() {
  formError.value = ''; formDone.value = ''
  if (!form.video_id) { formError.value = 'Choose a video.'; return }
  if (form.when === 'later' && !form.at) { formError.value = 'Choose the date and time.'; return }
  submitKey = submitKey || (globalThis.crypto?.randomUUID?.() || String(Date.now()))
  const body = { platform: form.platform, video_id: form.video_id, title: form.title, description: form.description, tags: tagList.value,
    privacy: form.privacy, thumbnail_id: form.thumbnail_id, destination_id: form.destination_id }
  if (form.project_id) Object.assign(body, { project_id: form.project_id, include_captions: true })
  if (form.when === 'later') body.scheduled_at = new Date(form.at).toISOString()
  sending.value = true
  try {
    const { data } = await api.createPublication(body, submitKey)
    submitKey = ''
    formDone.value = data.status === 'scheduled' && data.scheduled_at ? `Scheduled for ${when(data.scheduled_at)}.` : `Sent to ${platform.value?.label}. Its status is below.`
    await loadPublications(); watchOpen()
  } catch (e) {
    formError.value = errorText(e, 'The post could not be sent.')
    if (e?.response?.status && e.response.status < 500) submitKey = ''
  } finally { sending.value = false }
}

async function act(p, action) {
  try { await api.publicationAction(p.publication_id, action); await loadPublications(); watchOpen() }
  catch (e) { formError.value = errorText(e, 'That could not be done.') }
}

// While a post is still on its way, its status is read again every 10 seconds.
function watchOpen() {
  clearTimeout(timer)
  if (publications.value.some(p => ['scheduled', 'publishing', 'processing'].includes(p.status) && !p.scheduled_at)) {
    timer = setTimeout(async () => { try { await loadPublications() } catch { /* next tick tries again */ } watchOpen() }, 10000)
  }
}
onMounted(async () => { await load(); watchOpen() })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.vpb { min-height: 100%; color: var(--vm-ink); }
.vpb-head { padding: 30px 32px 20px; }
.vpb h1 { margin: 0; font-size: 30px; font-weight: 550; letter-spacing: -.03em; }
.vpb-sub { margin: 10px 0 0; max-width: 62ch; font-size: 13px; line-height: 1.7; color: var(--vm-ink-soft); }
.vpb-body { display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: 24px 28px; padding: 4px 32px 32px; align-items: start; }
.vpb-posts { grid-column: 1 / -1; }
.vpb h2 { margin: 0 0 12px; font-size: 15px; font-weight: 600; }
.vpb-accounts, .vpb-form-wrap, .vpb-posts { border: 1px solid var(--vm-line); border-radius: 10px; background: var(--vm-surface); padding: 18px; }
.vpb-list { list-style: none; margin: 0; padding: 0; display: grid; }
.vpb-account { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; align-items: center; padding: 10px 0; border-top: 1px solid var(--vm-line-2); }
.vpb-account:first-child { border-top: 0; }
.vpb-account-name { font-size: 14px; font-weight: 500; }
.vpb-account-state { grid-column: 1; font-size: 12px; color: var(--vm-ink-soft); }
.vpb-account-state.ok { color: var(--vm-green-ink); }
.vpb-account-state.warn { color: var(--vm-amber-ink); }
.vpb-account-act { grid-column: 2; grid-row: 1 / span 2; display: flex; gap: 6px; }
.vpb-form { display: grid; gap: 14px; }
.vpb-field { display: grid; gap: 6px; font-size: 12.5px; color: var(--vm-ink-soft); }
.vpb-field input, .vpb-field select, .vpb-field textarea, .vpb-when input[type=datetime-local] { min-height: 40px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--vm-line); border-radius: 6px; background: var(--vm-surface-2); color: var(--vm-ink); font: inherit; font-size: 14px; }
.vpb-field textarea { resize: vertical; }
.vpb-preview { width: 160px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 6px; background: var(--vm-surface-2); }
.vpb-count { font-size: 11.5px; color: var(--vm-ink-soft); font-variant-numeric: tabular-nums; }
.vpb-count.over { color: var(--vm-red-ink); font-weight: 600; }
.vpb-notsent { margin: 0; padding: 10px 12px; list-style: none; border-radius: 6px; background: var(--vm-amber-soft); color: var(--vm-amber-ink); font-size: 12.5px; display: grid; gap: 4px; }
.vpb-when { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin: 0; padding: 0; border: 0; font-size: 13px; }
.vpb-when legend { font-size: 12.5px; color: var(--vm-ink-soft); margin-bottom: 6px; padding: 0; }
.vpb-when label { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; cursor: pointer; }
.vpb-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 14px; box-sizing: border-box; border: 1px solid var(--vm-line); border-radius: 6px; background: transparent; color: var(--vm-ink); font: inherit; font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; white-space: nowrap; transition: background-color .15s; }
.vpb-btn:hover { background: var(--vm-surface-2); }
.vpb-btn.primary { background: var(--vm-violet-d); border-color: transparent; color: #fff; font-weight: 600; }
.vpb-btn.primary:hover { background: var(--vm-violet); }
.vpb-btn.danger { border-color: var(--vm-red-ink); color: var(--vm-red-ink); }
.vpb-btn:disabled { opacity: .6; cursor: default; }
.vpb-form > .vpb-btn.primary { justify-self: start; }
.vpb-note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--vm-ink-soft); }
.vpb-note.err { color: var(--vm-red-ink); }
.vpb-note.ok { color: var(--vm-green-ink); }
.vpb-post { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 12px 0; border-top: 1px solid var(--vm-line-2); }
.vpb-post:first-child { border-top: 0; }
.vpb-post-main { flex: 1 1 260px; display: grid; gap: 3px; min-width: 0; }
.vpb-post-main strong { font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }
.vpb-post-meta { font-size: 12px; color: var(--vm-ink-soft); }
.vpb-post-err { font-size: 12.5px; color: var(--vm-red-ink); }
.vpb-badge { padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; background: var(--vm-surface-2); color: var(--vm-ink-soft); }
.vpb-badge.published { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.vpb-badge.failed { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.vpb-badge.processing, .vpb-badge.publishing { background: var(--vm-violet-soft); color: var(--vm-violet-ink); }
.vpb a:focus-visible, .vpb button:focus-visible, .vpb input:focus-visible, .vpb select:focus-visible, .vpb textarea:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
@media (max-width: 1023px) { .vpb-head { padding-left: calc(16px + var(--vs-bar-inset, 0px)); } }
@media (max-width: 860px) { .vpb-body { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .vpb-head { padding: 22px 16px 14px; }
  .vpb h1 { font-size: 25px; }
  .vpb-body { padding: 0 16px 24px; gap: 16px; }
  .vpb-accounts, .vpb-form-wrap, .vpb-posts { padding: 14px; }
  .vpb-field input, .vpb-field select, .vpb-field textarea, .vpb-when input[type=datetime-local] { font-size: 16px; }
  .vpb-btn { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .vpb-btn { transition: none; } }
</style>
