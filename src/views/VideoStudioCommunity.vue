<template>
  <section class="vcm" aria-labelledby="vcm-title" data-test="video-studio-community">
    <header class="vcm-head">
      <div>
        <h1 id="vcm-title">Community</h1>
        <p class="vcm-sub">Templates other people chose to share. Remixing one makes a new project of your own with a copy of what they shared. Your own projects stay private unless you share one here.</p>
      </div>
      <button type="button" class="vcm-btn primary" data-test="vcm-share-open" @click="openShare">Share a project</button>
    </header>

    <div class="vcm-body">
      <div class="vcm-tools">
        <div class="vcm-tabs" role="tablist" aria-label="Which templates">
          <button type="button" role="tab" :aria-selected="tab === 'all'" :class="{ on: tab === 'all' }" data-test="vcm-tab-all" @click="setTab('all')">Shared by others</button>
          <button type="button" role="tab" :aria-selected="tab === 'mine'" :class="{ on: tab === 'mine' }" data-test="vcm-tab-mine" @click="setTab('mine')">Yours</button>
        </div>
        <label class="vcm-search"><span class="vcm-sr">Search templates</span>
          <input v-model="q" type="search" placeholder="Search by title or tag" @keyup.enter="load" /></label>
      </div>

      <p v-if="message" class="vcm-note" :class="{ err: messageError }" role="status" data-test="vcm-message">
        {{ message }}
        <router-link v-if="remixed" :to="{ name: 'video-studio-dashboard', query: { project: remixed } }" class="vcm-link">Open your remix</router-link>
      </p>
      <p v-if="loading" class="vcm-note" role="status">Loading templates…</p>
      <p v-else-if="loadError" class="vcm-note err" role="alert">{{ loadError }} <button type="button" class="vcm-btn" @click="load">Try again</button></p>
      <div v-else-if="!shown.length" class="vcm-empty">
        <p v-if="tab === 'mine'">You have not shared a project yet. Share one to let others remix it.</p>
        <p v-else>No shared templates match. Share one of your projects to start.</p>
      </div>
      <ul v-else class="vcm-grid">
        <li v-for="t in shown" :key="t.template_id" class="vcm-card" :data-test="'vcm-card'">
          <span class="vcm-cover" aria-hidden="true"><img v-if="t.cover_url && !noCover.has(t.template_id)" :src="t.cover_url" alt="" loading="lazy" @error="coverFailed(t)" /></span>
          <div class="vcm-card-body">
            <strong class="vcm-name">{{ t.title }}</strong>
            <span class="vcm-meta">By {{ t.publisher }}. {{ includes(t) }}</span>
            <span class="vcm-meta">{{ t.remix_count }} remix{{ t.remix_count === 1 ? '' : 'es' }}</span>
            <span v-if="t.mine" class="vcm-badge" :class="t.status">{{ statusText(t.status) }}</span>
            <details class="vcm-rights"><summary>Rights</summary><p>{{ t.rights_statement }}</p></details>
            <div class="vcm-actions">
              <button v-if="!t.mine && t.status === 'published'" type="button" class="vcm-btn primary" :disabled="busy === t.template_id" data-test="vcm-remix" @click="remix(t)">{{ busy === t.template_id ? 'Remixing…' : 'Remix' }}</button>
              <button v-if="!t.mine && t.status === 'published'" type="button" class="vcm-btn" data-test="vcm-report-open" @click="reporting = reporting === t.template_id ? '' : t.template_id">Report</button>
              <template v-if="t.mine && t.status !== 'withdrawn'">
                <button v-if="withdrawing !== t.template_id" type="button" class="vcm-btn" data-test="vcm-withdraw" @click="withdrawing = t.template_id">Withdraw</button>
                <template v-else>
                  <button type="button" class="vcm-btn danger" data-test="vcm-withdraw-yes" @click="withdraw(t)">Withdraw it</button>
                  <button type="button" class="vcm-btn" @click="withdrawing = ''">Keep sharing</button>
                </template>
              </template>
            </div>
            <form v-if="reporting === t.template_id" class="vcm-report" data-test="vcm-report-form" @submit.prevent="report(t)">
              <label>Why<select v-model="reportReason" required>
                <option value="rights">It uses someone else's work without permission</option>
                <option value="unsafe">It is harmful or unsafe</option>
                <option value="spam">It is spam</option>
                <option value="other">Something else</option>
              </select></label>
              <label>Details (optional)<textarea v-model="reportDetails" rows="2"></textarea></label>
              <button type="submit" class="vcm-btn">Send report</button>
            </form>
          </div>
        </li>
      </ul>
    </div>

    <dialog ref="shareDialog" class="vcm-dialog" aria-labelledby="vcm-share-title" data-test="vcm-share">
      <header><h2 id="vcm-share-title">Share a project as a template</h2><button type="button" aria-label="Close" :disabled="sharing" @click="shareDialog.close()">×</button></header>
      <form class="vcm-form" @submit.prevent="share">
        <label>Project<select v-model="draft.project_id" required data-test="vcm-share-project" @change="loadProjectFiles">
          <option value="">Choose one of your projects</option>
          <option v-for="p in projects" :key="p.project_id" :value="p.project_id">{{ p.title }}</option>
        </select></label>
        <label>Title<input v-model="draft.title" type="text" maxlength="120" required data-test="vcm-share-title" /></label>
        <label>Description<textarea v-model="draft.description" rows="3" maxlength="2000"></textarea></label>
        <label>Tags, separated by commas<input v-model="draft.tags" type="text" /></label>
        <fieldset><legend>What others may copy</legend>
          <label class="vcm-check"><input v-model="draft.allow.brief" type="checkbox" /> The brief (goal, audience, style, notes)</label>
          <label class="vcm-check"><input v-model="draft.allow.scenes" type="checkbox" data-test="vcm-allow-scenes" /> The scenes and their descriptions</label>
          <label class="vcm-check"><input v-model="draft.allow.timeline" type="checkbox" /> The timeline (needs every file it uses)</label>
        </fieldset>
        <fieldset v-if="projectFiles.length"><legend>Files to include (copied to each remixer)</legend>
          <label v-for="f in projectFiles" :key="f.attachment_id" class="vcm-check"><input v-model="draft.files" type="checkbox" :value="f.attachment_id" /> {{ f.title }} ({{ f.media_type }})</label>
        </fieldset>
        <label>Rights statement<textarea v-model="draft.rights_statement" rows="3" required placeholder="For example: I made everything in this template. Anyone may remix it, and I ask to be credited." data-test="vcm-share-rights"></textarea></label>
        <label class="vcm-check"><input v-model="draft.rights_confirmed" type="checkbox" data-test="vcm-share-confirm" /> I own, or have permission to share, everything I include.</label>
        <p class="vcm-hint">Every file and the words above are checked for safety before the template is shared.</p>
        <p v-if="shareError" class="vcm-note err" role="alert" data-test="vcm-share-error">{{ shareError }}</p>
        <button type="submit" class="vcm-btn primary" :disabled="sharing" data-test="vcm-share-submit">{{ sharing ? 'Checking and sharing…' : 'Share template' }}</button>
      </form>
    </dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../services/api'

const tab = ref('all'), q = ref(''), templates = ref([]), loading = ref(true), loadError = ref('')
const message = ref(''), messageError = ref(false), remixed = ref(''), busy = ref('')
const reporting = ref(''), reportReason = ref('rights'), reportDetails = ref(''), withdrawing = ref('')
const shareDialog = ref(null), projects = ref([]), projectFiles = ref([]), sharing = ref(false), shareError = ref('')
const noCover = ref(new Set())
const blank = () => ({ project_id: '', title: '', description: '', tags: '', allow: { brief: true, scenes: true, timeline: false }, files: [], rights_statement: '', rights_confirmed: false })
const draft = reactive(blank())

const shown = computed(() => templates.value)
const STATUS = { published: 'Shared', under_review: 'Hidden while it is reviewed', removed: 'Removed by moderation', withdrawn: 'Withdrawn' }
function statusText(s) { return STATUS[s] || s }
function includes(t) {
  const parts = []
  if (t.includes?.brief) parts.push('brief')
  if (t.includes?.scenes) parts.push(`${t.includes.scenes} scene${t.includes.scenes === 1 ? '' : 's'}`)
  if (t.includes?.timeline) parts.push('timeline')
  const n = t.includes?.files?.length || 0
  if (n) parts.push(`${n} file${n === 1 ? '' : 's'}`)
  return parts.length ? `Includes ${parts.join(', ')}.` : ''
}
function coverFailed(t) { noCover.value = new Set(noCover.value).add(t.template_id) }
function errorText(e, fallback) { return e?.response?.data?.error?.message || fallback }
function say(text, isError = false) { message.value = text; messageError.value = isError }

async function load() {
  loading.value = true; loadError.value = ''
  try {
    const params = {}
    if (tab.value === 'mine') params.mine = 1
    if (q.value.trim()) params.q = q.value.trim()
    templates.value = (await api.getCommunityTemplates(params)).data.templates || []
  } catch { loadError.value = 'Templates could not be loaded.' }
  finally { loading.value = false }
}
function setTab(t) { tab.value = t; remixed.value = ''; message.value = ''; load() }

async function remix(t) {
  busy.value = t.template_id; remixed.value = ''
  const key = globalThis.crypto?.randomUUID?.() || String(Date.now())
  try {
    const { data } = await api.communityTemplateAction(t.template_id, 'remix', {}, key)
    remixed.value = data.project_id
    say(`"${data.title}" is in your projects.`)
    await load()
  } catch (e) { say(errorText(e, 'This template could not be remixed.'), true) }
  finally { busy.value = '' }
}
async function report(t) {
  try {
    await api.communityTemplateAction(t.template_id, 'report', { reason: reportReason.value, details: reportDetails.value })
    reporting.value = ''; reportDetails.value = ''
    say('Thank you. The report was sent to the moderators.')
  } catch (e) { say(errorText(e, 'The report could not be sent.'), true) }
}
async function withdraw(t) {
  try { await api.communityTemplateAction(t.template_id, 'withdraw'); withdrawing.value = ''; say('Withdrawn. Nobody can remix it any more; remixes already made stay with their makers.'); await load() }
  catch (e) { say(errorText(e, 'It could not be withdrawn.'), true) }
}

async function openShare() {
  Object.assign(draft, blank()); projectFiles.value = []; shareError.value = ''
  shareDialog.value?.showModal?.()
  try { projects.value = (await api.get('/video/projects/')).data.projects || [] } catch { shareError.value = 'Your projects could not be loaded.' }
}
async function loadProjectFiles() {
  projectFiles.value = []; draft.files = []
  if (!draft.project_id) return
  try {
    const out = []
    for (let page = 1; ; page++) {
      const { data } = await api.get('/video/library/', { params: { project_id: draft.project_id, page, limit: 100 } })
      out.push(...(data.items || []).filter(i => ['image', 'video', 'audio'].includes(i.media_type)))
      if (!data.has_more) break
    }
    projectFiles.value = out
  } catch { shareError.value = 'The project’s files could not be loaded.' }
}
async function share() {
  shareError.value = ''
  if (!draft.rights_confirmed) { shareError.value = 'Confirm that you may share everything you include.'; return }
  sharing.value = true
  try {
    const tags = draft.tags.split(',').map(t => t.trim()).filter(Boolean)
    await api.shareCommunityTemplate({ ...draft, tags, allow: { ...draft.allow }, files: [...draft.files] })
    shareDialog.value?.close?.()
    tab.value = 'mine'
    say('Shared. Others can now find and remix it.')
    await load()
  } catch (e) { shareError.value = errorText(e, 'The template could not be shared.') }
  finally { sharing.value = false }
}
onMounted(load)
</script>

<style scoped>
.vcm { min-height: 100%; color: var(--vm-ink); }
.vcm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 30px 32px 20px; }
.vcm h1 { margin: 0; font-size: 30px; font-weight: 550; letter-spacing: -.03em; }
.vcm-sub { margin: 10px 0 0; max-width: 62ch; font-size: 13px; line-height: 1.7; color: var(--vm-ink-soft); }
.vcm-body { display: grid; gap: 18px; padding: 4px 32px 32px; }
.vcm-tools { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
.vcm-tabs { display: inline-flex; border: 1px solid var(--vm-line); border-radius: 8px; padding: 3px; background: var(--vm-surface); }
.vcm-tabs button { min-height: 38px; padding: 0 14px; border: 0; border-radius: 6px; background: transparent; color: var(--vm-ink-soft); font: inherit; font-size: 13px; cursor: pointer; }
.vcm-tabs button.on { background: var(--vm-surface-2); color: var(--vm-ink); font-weight: 600; }
.vcm-search input { width: min(320px, 100%); min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--vm-line); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13.5px; }
.vcm-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; }
.vcm-card { border: 1px solid var(--vm-line); border-radius: 10px; background: var(--vm-surface); overflow: hidden; display: grid; grid-template-rows: auto 1fr; }
.vcm-cover { display: block; aspect-ratio: 16 / 9; background: var(--vm-surface-2); }
.vcm-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vcm-card-body { display: grid; gap: 6px; padding: 14px 16px 16px; align-content: start; }
.vcm-name { font-size: 15px; font-weight: 500; overflow-wrap: anywhere; }
.vcm-meta { font-size: 12px; color: var(--vm-ink-soft); }
.vcm-badge { justify-self: start; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; background: var(--vm-surface-2); color: var(--vm-ink-soft); }
.vcm-badge.published { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.vcm-badge.under_review, .vcm-badge.removed { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.vcm-rights summary { cursor: pointer; font-size: 12px; color: var(--vm-ink-soft); min-height: 32px; display: flex; align-items: center; }
.vcm-rights p { margin: 4px 0 0; font-size: 12.5px; line-height: 1.6; white-space: pre-line; }
.vcm-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.vcm-report, .vcm-form { display: grid; gap: 12px; }
.vcm-report label, .vcm-form > label, .vcm-form legend { display: grid; gap: 6px; font-size: 12.5px; color: var(--vm-ink-soft); }
.vcm-report select, .vcm-report textarea, .vcm-form input[type=text], .vcm-form select, .vcm-form textarea { min-height: 40px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--vm-line); border-radius: 6px; background: var(--vm-surface-2); color: var(--vm-ink); font: inherit; font-size: 14px; }
.vcm-form fieldset { margin: 0; padding: 0; border: 0; display: grid; gap: 4px; }
.vcm-check { display: flex !important; align-items: center; gap: 8px; min-height: 40px; font-size: 13px !important; color: var(--vm-ink) !important; cursor: pointer; }
.vcm-hint { margin: 0; font-size: 12px; color: var(--vm-ink-soft); }
.vcm-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 14px; box-sizing: border-box; border: 1px solid var(--vm-line); border-radius: 6px; background: transparent; color: var(--vm-ink); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: background-color .15s; }
.vcm-btn:hover { background: var(--vm-surface-2); }
.vcm-btn.primary { background: var(--vm-violet-d); border-color: transparent; color: #fff; font-weight: 600; }
.vcm-btn.primary:hover { background: var(--vm-violet); }
.vcm-btn.danger { border-color: var(--vm-red-ink); color: var(--vm-red-ink); }
.vcm-btn:disabled { opacity: .6; cursor: default; }
.vcm-form > .vcm-btn.primary { justify-self: end; }
.vcm-note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--vm-ink-soft); }
.vcm-note.err { color: var(--vm-red-ink); }
.vcm-link { margin-left: 8px; color: var(--vm-link, var(--vm-violet)); }
.vcm-empty { padding: 36px; border: 1px dashed var(--vm-line); border-radius: 12px; background: var(--vm-surface); }
.vcm-empty p { margin: 0; font-size: 14px; color: var(--vm-ink-soft); }
.vcm-dialog { width: min(560px, calc(100vw - 24px)); max-height: calc(100vh - 32px); box-sizing: border-box; padding: 22px; background: var(--vm-surface); color: var(--vm-ink); border: 1px solid var(--vm-line); border-radius: 11px; }
.vcm-dialog::backdrop { background: rgb(0 0 0 / .55); }
.vcm-dialog header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.vcm-dialog h2 { margin: 0; font-size: 19px; font-weight: 500; }
.vcm-dialog header button { width: 44px; height: 44px; border: 0; background: none; color: inherit; font-size: 24px; cursor: pointer; }
.vcm-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.vcm a:focus-visible, .vcm button:focus-visible, .vcm input:focus-visible, .vcm select:focus-visible, .vcm textarea:focus-visible, .vcm summary:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
@media (max-width: 1023px) { .vcm-head { padding-left: calc(16px + var(--vs-bar-inset, 0px)); } }
@media (max-width: 640px) {
  .vcm-head { flex-direction: column; padding: 22px 16px 14px; }
  .vcm h1 { font-size: 25px; }
  .vcm-body { padding: 0 16px 24px; }
  .vcm-grid { grid-template-columns: 1fr; }
  .vcm-search, .vcm-search input { width: 100%; }
  .vcm-search input, .vcm-form input[type=text], .vcm-form select, .vcm-form textarea, .vcm-report select, .vcm-report textarea { font-size: 16px; }
  .vcm-btn, .vcm-tabs button { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .vcm-btn { transition: none; } }
</style>
