<!-- Share this conversation — the ChatGPT-style share sheet.
     Creating a link FREEZES a snapshot of the thread as it is right now: anything said afterwards
     stays private until the owner explicitly hits "Update link". The mode picker decides whether a
     recipient can only read, or can also continue the chat — a continuation always forks into the
     recipient's OWN account on THEIR agent, so it never spends this user's budget or touches their
     credentials. Social buttons open the platform's own share intent with the link. -->
<template>
  <Teleport to="body">
    <div v-if="open" class="sh-overlay" @click.self="close">
      <div class="sh-card" role="dialog" aria-modal="true" aria-labelledby="sh-title">
        <header class="sh-head">
          <h3 id="sh-title" class="sh-title">Share this conversation</h3>
          <button class="sh-x" aria-label="Close" @click="close">×</button>
        </header>

        <!-- ── Step 1: choose what recipients may do ─────────────────────────────────── -->
        <div v-if="!share" class="sh-body">
          <p class="sh-lead">
            A snapshot of the messages so far is published at a private link. Anything you send after
            sharing stays out of it.
          </p>

          <div class="sh-modes" role="radiogroup" aria-label="Share mode">
            <button
              v-for="opt in MODES" :key="opt.value"
              class="sh-mode" :class="{ active: mode === opt.value }"
              role="radio" :aria-checked="mode === opt.value"
              @click="mode = opt.value"
            >
              <span class="sh-mode-icon" aria-hidden="true" v-html="opt.icon"></span>
              <span class="sh-mode-text">
                <strong>{{ opt.label }}</strong>
                <small>{{ opt.hint }}</small>
              </span>
            </button>
          </div>

          <button class="sh-advanced-toggle" @click="advanced = !advanced">
            {{ advanced ? 'Hide' : 'More' }} options
          </button>
          <div v-if="advanced" class="sh-advanced">
            <label class="sh-check">
              <input v-model="attributeOwner" type="checkbox" />
              <span>Show my name on the shared page</span>
            </label>
            <label class="sh-check">
              <input v-model="includeToolActivity" type="checkbox" />
              <span>
                Include tool activity
                <small>Tool names and outcomes only — never arguments or raw output.</small>
              </span>
            </label>
            <label class="sh-check">
              <input v-model="allowIndexing" type="checkbox" />
              <span>
                Allow search engines to index this page
                <small>Off by default — the link stays unlisted.</small>
              </span>
            </label>
            <label class="sh-field">
              <span>Link expires</span>
              <select v-model="expiresInDays">
                <option value="">Never</option>
                <option value="1">In 1 day</option>
                <option value="7">In 7 days</option>
                <option value="30">In 30 days</option>
              </select>
            </label>
          </div>

          <button class="sh-primary" :disabled="creating" @click="createLink">
            {{ creating ? 'Creating link…' : 'Create link' }}
          </button>
        </div>

        <!-- ── Step 2: the link + how to send it ─────────────────────────────────────── -->
        <div v-else class="sh-body">
          <div class="sh-linkrow">
            <input ref="linkInput" class="sh-link" :value="share.url" readonly @focus="selectAll" />
            <button class="sh-copy" :class="{ done: copied }" @click="copyLink">
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>

          <p class="sh-meta">
            {{ share.message_count }} message{{ share.message_count === 1 ? '' : 's' }} ·
            {{ share.mode === 'continue' ? 'anyone with the link can continue this chat in their own account'
                                         : 'read-only' }}
            <span v-if="share.view_count"> · {{ share.view_count }} view{{ share.view_count === 1 ? '' : 's' }}</span>
          </p>

          <div class="sh-socials">
            <button v-if="canNativeShare" class="sh-social native" @click="nativeShare">
              <span aria-hidden="true">⇪</span> Share…
            </button>
            <a v-for="s in socials" :key="s.name" class="sh-social" :href="s.href"
               target="_blank" rel="noopener noreferrer" :title="`Share on ${s.name}`"
               :aria-label="`Share on ${s.name}`">
              <span class="sh-social-ico" aria-hidden="true" v-html="s.icon"></span>
              <span class="sh-social-name">{{ s.name }}</span>
            </a>
          </div>

          <div class="sh-manage">
            <button class="sh-ghost" :disabled="busy" @click="refreshSnapshot">
              Update link with new messages
            </button>
            <button class="sh-ghost danger" :disabled="busy" @click="revoke">
              Delete link
            </button>
          </div>
          <p class="sh-note">
            Deleting the link makes it stop working for everyone immediately. Updating keeps the same
            URL and adds the messages sent since you shared.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'

const props = defineProps({
  open: { type: Boolean, default: false },
  conversationId: { type: [String, Number], default: null },
  title: { type: String, default: '' },
  // Anchor: share the thread UP TO this message (the DB pk). Set when the sheet is opened from a
  // specific message's share button; null shares the whole thread.
  upToMessageId: { type: [String, Number], default: null },
})
const emit = defineEmits(['close'])

const MODES = [
  {
    value: 'read_only',
    label: 'Anyone with the link can read',
    hint: 'They see the conversation exactly as it is now. They cannot reply.',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  },
  {
    value: 'continue',
    label: 'Anyone with the link can continue',
    hint: 'Continuing copies the chat into their own account and runs on their agent — never yours.',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
  },
]

const mode = ref('read_only')
const advanced = ref(false)
const attributeOwner = ref(false)
const includeToolActivity = ref(false)
const allowIndexing = ref(false)
const expiresInDays = ref('')

const share = ref(null)
const creating = ref(false)
const busy = ref(false)
const copied = ref(false)
const linkInput = ref(null)

// Reopening the sheet must not show a stale link from a previous conversation.
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  share.value = null
  copied.value = false
  advanced.value = false
  loadExisting()
})

const loadExisting = async () => {
  // Opened from a specific message ("share up to here")? Always cut a fresh snapshot — reusing a
  // whole-thread link would silently share more than the user pointed at.
  if (!props.conversationId || props.upToMessageId) return
  try {
    const res = await api.getConversationShares(props.conversationId)
    const live = (res.data?.results || []).find((s) => !s.is_revoked && !s.is_expired)
    if (live) { share.value = live; mode.value = live.mode }
  } catch { /* no existing link is the normal case — fall through to the create step */ }
}

const createLink = async () => {
  if (!props.conversationId || creating.value) return
  creating.value = true
  try {
    const res = await api.createConversationShare(props.conversationId, {
      mode: mode.value,
      up_to_message_id: props.upToMessageId || null,
      attribute_owner: attributeOwner.value,
      include_tool_activity: includeToolActivity.value,
      allow_indexing: allowIndexing.value,
      expires_in_days: expiresInDays.value || null,
    })
    share.value = res.data
    await nextTick()
    copyLink()
  } catch (e) {
    notify.error(e?.response?.data?.detail || 'Could not create the share link.')
  } finally {
    creating.value = false
  }
}

const refreshSnapshot = async () => {
  if (!share.value || busy.value) return
  busy.value = true
  try {
    const res = await api.updateShare(share.value.token, { refresh: true })
    share.value = res.data
    notify.success('Link updated with the latest messages.')
  } catch (e) {
    notify.error(e?.response?.data?.detail || 'Could not update the link.')
  } finally {
    busy.value = false
  }
}

const revoke = async () => {
  if (!share.value || busy.value) return
  busy.value = true
  try {
    await api.revokeShare(share.value.token)
    share.value = null
    notify.success('Link deleted — it no longer opens for anyone.')
  } catch {
    notify.error('Could not delete the link.')
  } finally {
    busy.value = false
  }
}

const copyLink = async () => {
  if (!share.value) return
  try {
    await navigator.clipboard.writeText(share.value.url)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    // Clipboard is blocked (insecure origin / permission) — select the field so ⌘C still works.
    linkInput.value?.select()
    notify.info('Press Ctrl/⌘+C to copy the link.')
  }
}

const selectAll = (e) => e.target.select()

const canNativeShare = computed(() => typeof navigator !== 'undefined' && !!navigator.share)
const nativeShare = async () => {
  try {
    await navigator.share({ title: props.title || 'Shared conversation', url: share.value.url })
  } catch { /* the user dismissed the sheet */ }
}

// Platform share intents. Each takes the LINK (never the transcript) so recipients land on the
// snapshot page and the Open Graph card renders the title/preview.
const socials = computed(() => {
  if (!share.value) return []
  const url = encodeURIComponent(share.value.url)
  const text = encodeURIComponent(props.title || 'Take a look at this conversation')
  return [
    { name: 'X', href: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.1 8.1L23.3 22h-6.6l-5.2-6.8L5.6 22H2.4l7.6-8.7L1 2h6.8l4.7 6.2zm-1.1 18h1.8L7.3 3.9H5.4z"/></svg>' },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95C20.4 8.75 21 11 21 14v7h-4v-6.2c0-1.5-.03-3.4-2.1-3.4s-2.4 1.6-2.4 3.3V21H9z"/></svg>' },
    { name: 'WhatsApp', href: `https://wa.me/?text=${text}%20${url}`,
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.6.1.3.6 1.1 1.3 1.7.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.8.8c.2.1.4.2.5.3 0 .1 0 .7-.2 1.3z"/></svg>' },
    { name: 'Reddit', href: `https://www.reddit.com/submit?url=${url}&title=${text}`,
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a2.1 2.1 0 0 0-3.6-1.5 10.3 10.3 0 0 0-5.2-1.6l.9-4.1 2.9.6a1.6 1.6 0 1 0 .2-1L13.8 3.6a.5.5 0 0 0-.6.4l-1 4.5a10.3 10.3 0 0 0-5.3 1.6A2.1 2.1 0 1 0 4.3 14a4 4 0 0 0 0 .6c0 3.1 3.5 5.6 7.8 5.6s7.8-2.5 7.8-5.6a4 4 0 0 0 0-.6A2.1 2.1 0 0 0 22 12zM8 13.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm7.9 4a5.6 5.6 0 0 1-3.8 1.2 5.6 5.6 0 0 1-3.8-1.2.4.4 0 1 1 .5-.6 4.9 4.9 0 0 0 3.3 1 4.9 4.9 0 0 0 3.3-1 .4.4 0 1 1 .5.6zm-.4-2.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>' },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>' },
    { name: 'Telegram', href: `https://t.me/share/url?url=${url}&text=${text}`,
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.8 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.7-7.9c.4-.3-.1-.5-.6-.2L6.7 12.8l-4.6-1.4c-1-.3-1-1 .2-1.5l18-6.9c.8-.3 1.5.2 1.6 1.3z"/></svg>' },
    { name: 'Email', href: `mailto:?subject=${text}&body=${url}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>' },
  ]
})

const close = () => emit('close')
</script>

<style scoped>
.sh-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(15, 23, 42, .55);
  display: flex; align-items: center; justify-content: center; padding: 24px; }
.sh-card { width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto; background: var(--surface, #fff);
  color: var(--text, #0f172a); border-radius: 16px; box-shadow: 0 24px 64px rgba(2, 6, 23, .35); }
.sh-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 8px; }
.sh-title { margin: 0; font-size: 1.05rem; font-weight: 650; }
.sh-x { background: none; border: 0; font-size: 1.5rem; line-height: 1; cursor: pointer; color: inherit;
  opacity: .5; padding: 0 4px; }
.sh-x:hover { opacity: 1; }
.sh-body { padding: 4px 20px 20px; }
.sh-lead { margin: 0 0 14px; font-size: .875rem; opacity: .72; line-height: 1.5; }

.sh-modes { display: grid; gap: 8px; }
.sh-mode { display: flex; gap: 12px; align-items: flex-start; text-align: left; width: 100%;
  padding: 12px 14px; border-radius: 12px; border: 1.5px solid rgba(100, 116, 139, .28);
  background: transparent; color: inherit; cursor: pointer; transition: border-color .12s, background .12s; }
.sh-mode:hover { border-color: rgba(99, 102, 241, .5); }
.sh-mode.active { border-color: #6366f1; background: rgba(99, 102, 241, .08); }
.sh-mode-icon { flex: 0 0 20px; margin-top: 2px; }
.sh-mode-icon :deep(svg) { width: 20px; height: 20px; }
.sh-mode-text { display: flex; flex-direction: column; gap: 3px; }
.sh-mode-text strong { font-size: .875rem; font-weight: 600; }
.sh-mode-text small { font-size: .78rem; opacity: .66; line-height: 1.45; }

.sh-advanced-toggle { margin: 12px 0 0; background: none; border: 0; padding: 0; cursor: pointer;
  font-size: .8rem; color: #6366f1; font-weight: 550; }
.sh-advanced { display: grid; gap: 10px; margin-top: 12px; padding: 12px 14px; border-radius: 12px;
  background: rgba(100, 116, 139, .08); }
.sh-check { display: flex; gap: 9px; align-items: flex-start; font-size: .83rem; cursor: pointer; }
.sh-check input { margin-top: 2px; flex: 0 0 auto; }
.sh-check small { display: block; opacity: .6; font-size: .76rem; margin-top: 2px; line-height: 1.4; }
.sh-field { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: .83rem; }
.sh-field select { padding: 5px 8px; border-radius: 8px; border: 1px solid rgba(100, 116, 139, .35);
  background: var(--surface, #fff); color: inherit; font: inherit; font-size: .82rem; }

.sh-primary { margin-top: 16px; width: 100%; padding: 11px; border: 0; border-radius: 11px;
  background: #6366f1; color: #fff; font-weight: 600; font-size: .9rem; cursor: pointer; }
.sh-primary:disabled { opacity: .6; cursor: default; }

.sh-linkrow { display: flex; gap: 8px; margin-top: 6px; }
.sh-link { flex: 1; min-width: 0; padding: 10px 12px; border-radius: 10px; font-size: .82rem;
  border: 1px solid rgba(100, 116, 139, .32); background: rgba(100, 116, 139, .08); color: inherit; }
.sh-copy { padding: 0 16px; border: 0; border-radius: 10px; background: #6366f1; color: #fff;
  font-weight: 600; font-size: .83rem; cursor: pointer; white-space: nowrap; }
.sh-copy.done { background: #16a34a; }
.sh-meta { margin: 10px 0 16px; font-size: .78rem; opacity: .62; }

.sh-socials { display: flex; flex-wrap: wrap; gap: 8px; }
.sh-social { display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 10px;
  border: 1px solid rgba(100, 116, 139, .28); background: transparent; color: inherit;
  text-decoration: none; font-size: .8rem; font-weight: 550; cursor: pointer; transition: background .12s; }
.sh-social:hover { background: rgba(100, 116, 139, .12); }
.sh-social-ico :deep(svg) { width: 15px; height: 15px; display: block; }
.sh-social.native { border-style: dashed; }

.sh-manage { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
.sh-ghost { padding: 8px 12px; border-radius: 9px; border: 1px solid rgba(100, 116, 139, .28);
  background: transparent; color: inherit; font-size: .8rem; cursor: pointer; }
.sh-ghost:hover { background: rgba(100, 116, 139, .1); }
.sh-ghost.danger { color: #dc2626; border-color: rgba(220, 38, 38, .35); }
.sh-ghost:disabled { opacity: .5; cursor: default; }
.sh-note { margin: 10px 0 0; font-size: .74rem; opacity: .55; line-height: 1.5; }
</style>
