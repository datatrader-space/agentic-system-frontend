<template>
  <!-- PROJECTS (agentic-docs/CHAT_PROJECTS_PLAN.md), laid out as the owner asked on 2026-10-16: a "Projects"
       header with its icon and nothing else on the row; clicking it shows "Create project" and then the
       projects, each a folder that opens to its chats (five at a time, "Show more"); a chat opens its
       conversation. Folders of chats, private to their owner; every change goes to the server, which checks
       ownership. No native dialogs. -->
  <section class="sp" :class="{ collapsed }" aria-label="Projects">
    <div class="sp-head" :class="{ collapsed }">
      <button type="button" class="sp-section" :class="{ collapsed }" data-test="projects-toggle"
              :aria-expanded="expanded" :title="collapsed ? 'Projects' : ''"
              :aria-label="collapsed ? 'Projects' : undefined" @click="toggleSection">
        <svg class="sp-icon-main" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 8a2 2 0 0 1 2-2h3.5l2 2H17a2 2 0 0 1 2 2v1" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M3 8v9a2 2 0 0 0 2 2h12.4a2 2 0 0 0 1.9-1.4l1.6-5A1.5 1.5 0 0 0 19.5 11H8.3a2 2 0 0 0-1.9 1.4L4 19" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span v-if="!collapsed" class="sp-section-label">Projects</span>
        <svg v-if="!collapsed" class="sp-chev" :class="{ open: expanded }" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.4" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    </div>

    <div v-if="expanded && !collapsed" class="sp-body">
      <button v-if="!creating" type="button" class="sp-create" data-test="new-project" @click="startCreate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 5v14m-7-7h14" stroke-linecap="round" /></svg>
        <span>Create project</span>
      </button>
      <form v-else class="sp-inline" @submit.prevent="submitCreate">
        <input ref="createInput" v-model="newName" class="sp-input" data-test="new-project-name"
               placeholder="Project name" maxlength="120" aria-label="New project name"
               @keydown.esc.prevent="creating = false" @blur="onCreateBlur" />
      </form>

      <ul class="sp-list" aria-label="Your projects">
        <li v-for="p in shownProjects" :key="p.id" class="sp-item" :data-test="`project-${p.id}`">
          <div class="sp-row" :class="{ open: openId === p.id }">
            <form v-if="renaming === `p${p.id}`" class="sp-inline grow" @submit.prevent="submitRenameProject(p)">
              <input v-model="renameText" class="sp-input" maxlength="120" aria-label="Project name"
                     @keydown.esc.prevent="renaming = null" @blur="submitRenameProject(p)" />
            </form>
            <button v-else type="button" class="sp-main" :aria-expanded="openId === p.id" @click="toggle(p)">
              <svg class="sp-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <template v-if="openId === p.id">
                  <path d="M3 8a2 2 0 0 1 2-2h3.5l2 2H17a2 2 0 0 1 2 2v1" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M3 8v9a2 2 0 0 0 2 2h12.4a2 2 0 0 0 1.9-1.4l1.6-5A1.5 1.5 0 0 0 19.5 11H8.3a2 2 0 0 0-1.9 1.4L4 19" stroke-linecap="round" stroke-linejoin="round" />
                </template>
                <path v-else d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-linejoin="round" />
              </svg>
              <span class="sp-name">{{ p.name }}</span>
            </button>
            <button type="button" class="sp-more" :aria-label="`Actions for ${p.name}`" data-test="project-menu"
                    @click.stop="toggleMenu(`p${p.id}`)">&#8943;</button>
          </div>

          <div v-if="menu === `p${p.id}`" class="sp-menu" role="menu" @click.stop>
            <button type="button" role="menuitem" data-test="open-project" @click="openProject(p)">Open project</button>
            <button type="button" role="menuitem" @click="newChatIn(p)">New chat in this project</button>
            <button type="button" role="menuitem" @click="startRenameProject(p)">Rename</button>
            <button type="button" role="menuitem" class="danger" @click="askDelete(p)">Delete</button>
          </div>

          <div v-if="deleting && deleting.id === p.id" class="sp-confirm" role="alertdialog"
               :aria-label="`Delete ${p.name}`" @click.stop>
            <p>Delete <strong>{{ p.name }}</strong>? Its chats stay in your chat history.</p>
            <label v-if="p.chat_count" class="sp-check">
              <input v-model="deleting.withChats" type="checkbox" />
              Also delete its {{ p.chat_count }} chat{{ p.chat_count === 1 ? '' : 's' }}
            </label>
            <div class="sp-actions">
              <button type="button" class="danger" data-test="confirm-delete-project" @click="confirmDelete">Delete</button>
              <button type="button" @click="deleting = null">Cancel</button>
            </div>
          </div>

          <ul v-if="openId === p.id" class="sp-chats">
            <li v-for="c in chatsOf(p.id)" :key="c.id">
              <ChatRow :c="c" :project-id="p.id" />
            </li>
            <li v-if="hasMoreChats(p.id)">
              <button type="button" class="sp-more-link inner" data-test="more-chats" @click="moreChats(p.id)">Show more</button>
            </li>
          </ul>
        </li>
      </ul>
      <button v-if="projects.projects.length > PROJECTS_SHOWN" type="button" class="sp-more-link"
              @click="showAll = !showAll">{{ showAll ? 'Show less' : 'Show more' }}</button>
    </div>
  </section>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectsStore } from '../../stores/useProjectsStore'
import { useChatStore } from '../../stores/useChatStore'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { previewOf } from '../../composables/useChatHistory'

const props = defineProps({ collapsed: { type: Boolean, default: false } })

const PROJECTS_SHOWN = 5
const PROJECT_CHATS_STEP = 5
const projects = useProjectsStore()
const chat = useChatStore()
const layout = useLayoutStore()
const router = useRouter()
const route = useRoute()

// The section is opened and closed by its header, and remembered per browser (a convenience only).
const OPEN_KEY = 'sidebar.projectsOpen'
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) === '1' } catch (_e) { return false } }
const expanded = ref(readOpen())
const toggleSection = () => {
  // Collapsed sidebar: the icon opens the sidebar on the projects rather than toggling a hidden list.
  if (props.collapsed) {
    layout.toggleSidebar?.()
    if (!expanded.value) expanded.value = true
    try { localStorage.setItem(OPEN_KEY, '1') } catch (_e) { /* private mode */ }
    if (!projects.loaded) projects.load()
    return
  }
  expanded.value = !expanded.value
  try { localStorage.setItem(OPEN_KEY, expanded.value ? '1' : '0') } catch (_e) { /* private mode */ }
  if (expanded.value && !projects.loaded) projects.load()
}

const showAll = ref(false)
const openId = ref(null)
const menu = ref(null)           // "p<id>" or "c<id>"
const renaming = ref(null)       // "p<id>" or "c<id>"
const renameText = ref('')
const deleting = ref(null)       // { id, withChats } for a project; { chatId, projectId } for a chat
const creating = ref(false)
const newName = ref('')
const createInput = ref(null)

const shownProjects = computed(() =>
  showAll.value ? projects.projects : projects.projects.slice(0, PROJECTS_SHOWN))

const closeMenus = () => { menu.value = null }
const toggleMenu = (key) => { menu.value = menu.value === key ? null : key; deleting.value = null }

const toggle = async (p) => {
  openId.value = openId.value === p.id ? null : p.id
  if (openId.value) await projects.loadChats(p.id)
}
const chatsOf = (id) => (projects.chatsByProject[id] || {}).items || []
const hasMoreChats = (id) => {
  const e = projects.chatsByProject[id]
  return !!e && e.count > e.items.length
}
const moreChats = (id) => projects.loadChats(id, chatsOf(id).length + PROJECT_CHATS_STEP)

const startCreate = async () => {
  creating.value = true
  newName.value = ''
  await nextTick()
  createInput.value?.focus()
}
const submitCreate = async () => {
  const name = newName.value.trim()
  if (!name) { creating.value = false; return }
  const created = await projects.create(name)
  if (created) { creating.value = false; newName.value = '' }
}
const onCreateBlur = () => { if (!newName.value.trim()) creating.value = false }

const startRenameProject = (p) => { closeMenus(); renaming.value = `p${p.id}`; renameText.value = p.name }
const submitRenameProject = async (p) => {
  if (renaming.value !== `p${p.id}`) return
  const name = renameText.value.trim()
  renaming.value = null
  if (name && name !== p.name) await projects.rename(p.id, name)
}

const askDelete = (p) => { closeMenus(); deleting.value = { id: p.id, withChats: false } }
const confirmDelete = async () => {
  const d = deleting.value
  deleting.value = null
  if (!d) return
  if (openId.value === d.id) openId.value = null
  await projects.remove(d.id, !!d.withChats)
}

// The project's own page: its instructions and all its chats.
const openProject = (p) => {
  closeMenus()
  layout.closeMobileNav?.()
  router.push(`/dashboard/projects/${p.id}`)
}

const openChat = (id) => {
  layout.closeMobileNav?.()
  closeMenus()
  router.push(`/dashboard/chat/${id}`)
}

// A new chat inside a project: the project travels in the URL, as ?agent= already does, so a reload
// or a route change cannot lose it. The chat keeps whichever agent is selected (any agent can be used).
const newChatIn = (p) => {
  closeMenus()
  layout.closeMobileNav?.()
  const agent = chat.selectedAgentId
  chat.reset()
  router.push({ path: '/dashboard/chat/new', query: { project: p.id, ...(agent ? { agent } : {}) } })
}

// One chat row: open it, or its menu (move to a project / out of one, rename, delete).
const ChatRow = defineComponent({
  props: { c: { type: Object, required: true }, projectId: { type: [Number, String], default: null } },
  setup(props) {
    return () => {
      const c = props.c
      const key = `c${c.id}`
      // A name the person gave the chat wins; a default "Chat with <agent>" falls back to its last message.
      const named = (c.title || '').trim()
      const label = (named && !/^(chat with |new conversation$)/i.test(named)) ? named : (previewOf(c) || 'Chat')
      const active = String(route.params.sessionId || '') === String(c.id)
      if (renaming.value === key) {
        return h('form', { class: 'sp-inline', onSubmit: (e) => { e.preventDefault(); submitRenameChat(c, props.projectId) } }, [
          h('input', { class: 'sp-input', value: renameText.value, maxlength: 200, 'aria-label': 'Chat name',
                       onInput: (e) => { renameText.value = e.target.value },
                       onKeydown: (e) => { if (e.key === 'Escape') { e.preventDefault(); renaming.value = null } },
                       onBlur: () => submitRenameChat(c, props.projectId) }),
        ])
      }
      const others = projects.projects.filter((p) => String(p.id) !== String(props.projectId))
      return h('div', { class: 'sp-chat-wrap' }, [
        h('div', { class: ['sp-row', 'sp-chat', { active }] }, [
          h('button', { type: 'button', class: 'sp-main', title: label, onClick: () => openChat(c.id) },
            [h('span', { class: 'sp-name' }, label)]),
          h('button', { type: 'button', class: 'sp-more', 'aria-label': `Actions for ${label}`,
                        'data-test': 'chat-menu', onClick: (e) => { e.stopPropagation(); toggleMenu(key) } }, '⋯'),
        ]),
        menu.value === key ? h('div', { class: 'sp-menu', role: 'menu', onClick: (e) => e.stopPropagation() }, [
          others.length ? h('div', { class: 'sp-menu-label' }, 'Move to project') : null,
          ...others.map((p) => h('button', { type: 'button', role: 'menuitem', 'data-test': `move-to-${p.id}`,
                                            onClick: () => { closeMenus(); projects.moveChat(c.id, p.id, props.projectId) } }, p.name)),
          props.projectId ? h('button', { type: 'button', role: 'menuitem',
                                          onClick: () => { closeMenus(); projects.moveChat(c.id, null, props.projectId) } },
                              'Remove from project') : null,
          h('button', { type: 'button', role: 'menuitem',
                        onClick: () => { closeMenus(); renaming.value = key; renameText.value = c.title || label } }, 'Rename'),
          h('button', { type: 'button', role: 'menuitem', class: 'danger',
                        onClick: () => { closeMenus(); deleting.value = { chatId: c.id, projectId: props.projectId } } }, 'Delete'),
        ]) : null,
        deleting.value && deleting.value.chatId === c.id
          ? h('div', { class: 'sp-confirm', role: 'alertdialog', 'aria-label': 'Delete chat', onClick: (e) => e.stopPropagation() }, [
              h('p', null, 'Delete this chat? This cannot be undone.'),
              h('div', { class: 'sp-actions' }, [
                h('button', { type: 'button', class: 'danger',
                              onClick: () => { const d = deleting.value; deleting.value = null; projects.deleteChat(d.chatId, d.projectId) } }, 'Delete'),
                h('button', { type: 'button', onClick: () => { deleting.value = null } }, 'Cancel'),
              ]),
            ])
          : null,
      ])
    }
  },
})

const submitRenameChat = async (c, projectId) => {
  if (renaming.value !== `c${c.id}`) return
  const title = renameText.value.trim()
  renaming.value = null
  if (title && title !== c.title) await projects.renameChat(c.id, title, projectId)
}

const onDocClick = () => { menu.value = null }

onMounted(() => {
  if (expanded.value) projects.load()
  document.addEventListener('click', onDocClick)
})
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

// A chat that was just created (its first message) appears in its list straight away.
watch(() => chat.conversationId, (id, prev) => {
  if (!id || id === prev || !expanded.value) return
  if (openId.value) projects.loadChats(openId.value, Math.max(PROJECT_CHATS_STEP, chatsOf(openId.value).length))
  projects.load()
})
</script>

<style scoped>
.sp { display: flex; flex-direction: column; gap: 2px; padding: 4px 0 8px; }
.sp { padding: 0; }
.sp-head { display: flex; align-items: center; gap: 2px; }
.sp-head.collapsed { justify-content: center; }
.sp-section { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; padding: 10px 12px; border: 0; border-radius: 13px; background: transparent; color: var(--vm-ink-soft); font: 600 13.5px var(--vm-font-sans); cursor: pointer; text-align: left; transition: background .2s var(--vm-ease2), color .2s var(--vm-ease2), transform .2s var(--vm-ease2); }
.sp-section:hover { background: var(--vm-glass-strong); color: var(--vm-ink); transform: translateX(2px); }
.sp-section.collapsed { justify-content: center; padding: 9px 0; }
.sp-section.collapsed:hover { transform: none; }
.sp-icon-main { width: 19px; height: 19px; flex-shrink: 0; opacity: .7; }
.sp-section:hover .sp-icon-main, .sp-section[aria-expanded="true"] .sp-icon-main { opacity: 1; }
.sp-section-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-chev { width: 14px; height: 14px; flex-shrink: 0; opacity: .6; transition: transform .2s var(--vm-ease2); }
.sp-chev:not(.open) { transform: rotate(-90deg); }
.sp-body { display: flex; flex-direction: column; gap: 1px; padding-left: 6px; }
.sp-create { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 0; border-radius: 10px; background: transparent; color: var(--vm-violet-d, #6d28d9); font: 600 13px var(--vm-font-sans); cursor: pointer; text-align: left; }
.sp-create svg { width: 15px; height: 15px; }
.sp-create:hover { background: var(--vm-glass-strong); }
.sp-section:focus-visible, .sp-create:focus-visible { outline: 2px solid var(--vm-violet, #7c3aed); outline-offset: 1px; }
.sp-more:hover { background: var(--vm-glass-strong); color: var(--vm-ink); }
.sp-list, .sp-chats { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
.sp-chats { padding-left: 26px; margin: 1px 0 4px; }
.sp-row { display: flex; align-items: center; border-radius: 10px; }
.sp-row:hover, .sp-row.open { background: var(--vm-glass-strong); }
.sp-row.active { background: var(--vm-surface); box-shadow: var(--vm-shadow-s); }
.sp-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 0; background: transparent; color: var(--vm-ink-soft); font: 600 13px var(--vm-font-sans); text-align: left; cursor: pointer; }
.sp-chat .sp-main { font-weight: 500; font-size: 12.5px; }
.sp-row:hover .sp-main, .sp-row.active .sp-main { color: var(--vm-ink); }
.sp-folder { width: 16px; height: 16px; flex-shrink: 0; }
.sp-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-more { width: 26px; height: 26px; margin-right: 4px; border: 0; border-radius: 8px; background: transparent; color: var(--vm-ink-faint, #8a8fa3); cursor: pointer; opacity: 0; font-size: 15px; line-height: 1; }
.sp-row:hover .sp-more, .sp-row.open .sp-more, .sp-more:focus-visible { opacity: 1; }
.sp-menu, .sp-confirm { margin: 2px 6px 6px; padding: 4px; border: 1px solid var(--vm-line); border-radius: 12px; background: var(--vm-surface); box-shadow: var(--vm-shadow-m); display: flex; flex-direction: column; }
.sp-menu button, .sp-actions button { border: 0; background: transparent; text-align: left; padding: 7px 10px; border-radius: 8px; font: 500 12.5px var(--vm-font-sans); color: var(--vm-ink); cursor: pointer; }
.sp-menu button:hover, .sp-actions button:hover { background: var(--vm-glass-strong); }
.sp-menu .danger, .sp-actions .danger { color: #c2410c; }
.sp-menu-label { padding: 6px 10px 2px; font-size: 11px; font-weight: 700; color: var(--vm-ink-faint, #8a8fa3); }
.sp-confirm { padding: 10px; gap: 8px; }
.sp-confirm p { margin: 0; font-size: 12.5px; color: var(--vm-ink); }
.sp-check { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--vm-ink-soft); }
.sp-actions { display: flex; gap: 6px; }
.sp-inline { padding: 2px 6px; }
.sp-inline.grow { flex: 1; }
.sp-input { width: 100%; padding: 6px 9px; border: 1px solid var(--vm-line); border-radius: 9px; background: var(--vm-surface); color: var(--vm-ink); font: 500 13px var(--vm-font-sans); }
.sp-input:focus { outline: 2px solid var(--vm-violet, #7c3aed); outline-offset: 0; }
.sp-more-link { border: 0; background: transparent; padding: 6px 10px; font: 600 12px var(--vm-font-sans); color: var(--vm-violet-d, #6d28d9); cursor: pointer; text-align: left; border-radius: 8px; }
.sp-more-link:hover { background: var(--vm-glass-strong); }
.sp-more-link.inner { color: var(--vm-ink-faint, #8a8fa3); font-weight: 500; padding: 5px 10px; }
.sp-main:focus-visible, .sp-more-link:focus-visible { outline: 2px solid var(--vm-violet, #7c3aed); outline-offset: 1px; }
</style>
