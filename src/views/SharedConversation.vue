<!-- Public read-only view of a shared conversation (/share/:token).
     Renders a FROZEN snapshot fetched from an anonymous endpoint — no auth, no WebSocket, no live
     agent. When the sharer allowed it, "Continue this chat" forks the snapshot into the VIEWER'S OWN
     account and hands off to the normal chat view; the original thread is never written to. -->
<template>
  <div class="sc-page">
    <div v-if="loading" class="sc-state">Loading conversation…</div>

    <div v-else-if="notFound" class="sc-state">
      <h1 class="sc-404">This conversation isn't available</h1>
      <p>The link may have been deleted by its owner, or it has expired.</p>
      <router-link class="sc-cta" to="/">Go to {{ brand }}</router-link>
    </div>

    <template v-else>
      <header class="sc-head">
        <div class="sc-head-inner">
          <div class="sc-head-text">
            <h1 class="sc-title">{{ data.title }}</h1>
            <p class="sc-sub">
              <span v-if="data.owner_display">Shared by {{ data.owner_display }}</span>
              <span v-else>Shared conversation</span>
              <span v-if="data.agent_name"> · {{ data.agent_name }}</span>
              <span v-if="snapshotDate"> · {{ snapshotDate }}</span>
            </p>
          </div>
          <div class="sc-head-actions">
            <button class="sc-btn ghost" @click="copyLink">{{ copied ? 'Copied' : 'Copy link' }}</button>
            <button v-if="data.can_continue" class="sc-btn primary" :disabled="forking" @click="continueChat">
              {{ forking ? 'Setting up…' : 'Continue this chat' }}
            </button>
          </div>
        </div>
      </header>

      <main class="sc-thread">
        <article v-for="m in data.messages" :key="m.ordinal" class="sc-msg" :class="m.role">
          <div class="sc-role">{{ m.role === 'user' ? 'You' : (data.agent_name || 'Assistant') }}</div>

          <div v-if="m.attachments.length" class="sc-attach">
            <template v-for="(a, i) in m.attachments" :key="i">
              <img v-if="a.isImage" :src="a.url" :alt="a.name" class="sc-attach-img" />
              <a v-else :href="a.url" target="_blank" rel="noopener noreferrer" class="sc-attach-file">{{ a.name }}</a>
            </template>
          </div>

          <div v-if="m.tool_activity.length" class="sc-tools">
            <span v-for="(t, i) in m.tool_activity" :key="i" class="sc-tool" :class="t.status">
              {{ t.tool }}<span v-if="t.summary"> · {{ t.summary }}</span>
            </span>
          </div>

          <div class="sc-body" v-html="renderMarkdown(m.content)"></div>

          <div v-if="m.media.length" class="sc-media">
            <img v-for="(x, i) in m.media" :key="i" :src="x.url" :alt="x.title || 'generated media'" />
          </div>

          <ul v-if="m.citations.length" class="sc-cites">
            <li v-for="(c, i) in m.citations" :key="i">
              <a v-if="c.url" :href="c.url" target="_blank" rel="noopener noreferrer">{{ c.title }}</a>
              <span v-else>{{ c.title }}</span>
            </li>
          </ul>
        </article>
      </main>

      <footer class="sc-foot">
        <p v-if="data.can_continue" class="sc-foot-lead">
          Continuing copies this conversation into your own account and runs on your agent — the
          original thread stays untouched.
        </p>
        <div class="sc-foot-actions">
          <button v-if="data.can_continue" class="sc-btn primary" :disabled="forking" @click="continueChat">
            {{ forking ? 'Setting up…' : 'Continue this chat' }}
          </button>
          <router-link class="sc-btn ghost" to="/">What is {{ brand }}?</router-link>
        </div>
        <p class="sc-disclaimer">
          This is a snapshot of a conversation, published by its owner. Content is theirs, not
          {{ brand }}'s, and may not reflect the latest state of the thread.
        </p>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import api from '../services/api'
import { notify } from '../composables/useNotify'

const brand = 'AADML'
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const notFound = ref(false)
const forking = ref(false)
const copied = ref(false)
const data = ref(null)

const snapshotDate = computed(() => {
  const iso = data.value?.snapshot_at
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return '' }
})

// The snapshot is other people's content rendered on our origin, so keep it inert: marked with no
// raw-HTML passthrough, and every link forced through the browser's default (no script URLs render
// as anchors because marked already escapes them).
const renderMarkdown = (text) => marked.parse(text || '', { breaks: true, gfm: true })

onMounted(async () => {
  try {
    const res = await api.getSharedConversation(route.params.token)
    data.value = res.data
    document.title = `${res.data.title} · ${brand}`
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
})

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    notify.info('Press Ctrl/⌘+C to copy the address from your browser bar.')
  }
}

const continueChat = async () => {
  if (forking.value) return
  forking.value = true
  try {
    const res = await api.forkSharedConversation(route.params.token)
    router.push(`/dashboard/chat/${res.data.conversation_id}`)
  } catch (e) {
    const status = e?.response?.status
    if (status === 401 || status === 403) {
      // Not signed in: continuing needs an account to own the forked copy. Come back here after login.
      router.push({ path: '/login', query: { next: route.fullPath } })
      return
    }
    if (e?.response?.data?.code === 'no_agent') {
      notify.error('Create an agent first — the continued chat runs on your own agent.')
      router.push('/dashboard/agents')
      return
    }
    notify.error(e?.response?.data?.detail || 'Could not continue this conversation.')
  } finally {
    forking.value = false
  }
}
</script>

<style scoped>
.sc-page { min-height: 100vh; background: #f8fafc; color: #0f172a; }
.sc-state { max-width: 640px; margin: 0 auto; padding: 96px 24px; text-align: center; color: #475569; }
.sc-404 { font-size: 1.35rem; margin: 0 0 8px; color: #0f172a; }
.sc-cta { display: inline-block; margin-top: 18px; padding: 10px 18px; border-radius: 10px;
  background: #4f46e5; color: #fff; text-decoration: none; font-weight: 600; font-size: .875rem; }

.sc-head { border-bottom: 1px solid #e2e8f0; background: #fff; position: sticky; top: 0; z-index: 5; }
.sc-head-inner { max-width: 860px; margin: 0 auto; padding: 18px 24px; display: flex;
  align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.sc-title { margin: 0; font-size: 1.1rem; font-weight: 650; }
.sc-sub { margin: 3px 0 0; font-size: .8rem; color: #64748b; }
.sc-head-actions { display: flex; gap: 8px; }

.sc-btn { padding: 9px 16px; border-radius: 10px; font-size: .83rem; font-weight: 600;
  cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.sc-btn.primary { background: #4f46e5; color: #fff; border: 0; }
.sc-btn.primary:disabled { opacity: .6; cursor: default; }
.sc-btn.ghost { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
.sc-btn.ghost:hover { background: #f1f5f9; }

.sc-thread { max-width: 860px; margin: 0 auto; padding: 28px 24px 8px; }
.sc-msg { margin-bottom: 26px; }
.sc-role { font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: #94a3b8; margin-bottom: 6px; }
.sc-msg.user .sc-body { background: #eef2ff; border-radius: 12px; padding: 12px 14px; }
.sc-body { font-size: .93rem; line-height: 1.65; overflow-wrap: anywhere; }
.sc-body :deep(pre) { background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 10px;
  overflow-x: auto; font-size: .82rem; }
.sc-body :deep(code) { font-size: .86em; }
.sc-body :deep(table) { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; }
.sc-body :deep(td), .sc-body :deep(th) { border: 1px solid #e2e8f0; padding: 6px 10px; font-size: .85rem; }
.sc-body :deep(img) { max-width: 100%; border-radius: 8px; }

.sc-attach { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.sc-attach-img { max-width: 200px; max-height: 200px; border-radius: 8px; border: 1px solid #e2e8f0; }
.sc-attach-file { font-size: .8rem; color: #4f46e5; }
.sc-media { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
.sc-media img { max-width: 320px; border-radius: 10px; border: 1px solid #e2e8f0; }

.sc-tools { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.sc-tool { font-size: .72rem; padding: 3px 8px; border-radius: 999px; background: #f1f5f9;
  color: #475569; border: 1px solid #e2e8f0; }
.sc-tool.failure { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }

.sc-cites { margin: 10px 0 0; padding-left: 18px; font-size: .78rem; color: #64748b; }
.sc-cites a { color: #4f46e5; }

.sc-foot { max-width: 860px; margin: 0 auto; padding: 24px 24px 64px; border-top: 1px solid #e2e8f0; }
.sc-foot-lead { font-size: .85rem; color: #475569; margin: 0 0 14px; }
.sc-foot-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.sc-disclaimer { margin: 20px 0 0; font-size: .73rem; color: #94a3b8; line-height: 1.6; }

@media (max-width: 600px) {
  .sc-head-inner { padding: 14px 16px; }
  .sc-thread, .sc-foot { padding-left: 16px; padding-right: 16px; }
}
</style>
