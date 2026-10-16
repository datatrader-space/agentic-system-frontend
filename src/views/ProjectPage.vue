<template>
  <!-- A project's own page (agentic-docs/CHAT_PROJECTS_PLAN.md, phase 3): its name, the instructions every
       chat in it is given, and all its chats. Reached from a project's "…" menu in the sidebar. -->
  <div class="pp">
    <div v-if="loading" class="pp-state">Loading…</div>
    <div v-else-if="!project" class="pp-state">
      This project does not exist, or it is not yours.
      <router-link to="/dashboard/chat/new">Back to chat</router-link>
    </div>
    <template v-else>
      <header class="pp-head">
        <svg class="pp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-linejoin="round" /></svg>
        <form v-if="editingName" class="pp-name-form" @submit.prevent="saveName">
          <input ref="nameInput" v-model="nameDraft" class="pp-name-input" maxlength="120" aria-label="Project name"
                 data-test="project-name-input" @keydown.esc.prevent="editingName = false" @blur="saveName" />
        </form>
        <h1 v-else class="pp-name" data-test="project-name" title="Rename" @click="startName">{{ project.name }}</h1>
        <button type="button" class="pp-primary" data-test="project-new-chat" @click="newChat">New chat</button>
      </header>

      <section class="pp-card" aria-labelledby="pp-instr">
        <div class="pp-card-head">
          <h2 id="pp-instr">Instructions</h2>
          <span v-if="saved" class="pp-saved" role="status">Saved</span>
        </div>
        <p class="pp-help">Every chat in this project is given these instructions, whichever agent you use.</p>
        <textarea v-model="instructions" class="pp-textarea" rows="6" maxlength="20000"
                  data-test="project-instructions" aria-labelledby="pp-instr"
                  placeholder="For example: Answer in British English. Our customer is Amsal Foods; keep quotes in PKR."></textarea>
        <div class="pp-actions">
          <button type="button" class="pp-primary" data-test="save-instructions"
                  :disabled="saving || instructions === (project.instructions || '')" @click="saveInstructions">
            {{ saving ? 'Saving…' : 'Save instructions' }}
          </button>
        </div>
      </section>

      <section class="pp-card" aria-labelledby="pp-chats">
        <div class="pp-card-head">
          <h2 id="pp-chats">Chats</h2>
          <span class="pp-count">{{ total }}</span>
        </div>
        <ul v-if="chats.length" class="pp-chats">
          <li v-for="c in chats" :key="c.id">
            <router-link :to="`/dashboard/chat/${c.id}`" class="pp-chat" data-test="project-chat">
              <span class="pp-chat-title">{{ labelOf(c) }}</span>
              <span class="pp-chat-meta">{{ agentOf(c) }}</span>
            </router-link>
          </li>
        </ul>
        <p v-else class="pp-help">Start a chat here with New chat, or move one in from its "…" menu.</p>
        <button v-if="chats.length < total" type="button" class="pp-more" data-test="project-more-chats"
                @click="loadChats(chats.length + PAGE)">Show more</button>
      </section>
    </template>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import { notify } from '../composables/useNotify'
import { previewOf, agentOf } from '../composables/useChatHistory'
import { useProjectsStore } from '../stores/useProjectsStore'
import { useChatStore } from '../stores/useChatStore'

const PAGE = 20
const route = useRoute()
const router = useRouter()
const projects = useProjectsStore()
const chat = useChatStore()

const loading = ref(true)
const project = ref(null)
const instructions = ref('')
const saving = ref(false)
const saved = ref(false)
const editingName = ref(false)
const nameDraft = ref('')
const nameInput = ref(null)
const chats = ref([])
const total = ref(0)

const rows = (data) => (Array.isArray(data) ? data : (data && data.results) || [])

const labelOf = (c) => {
  const named = (c.title || '').trim()
  return (named && !/^(chat with |new conversation$)/i.test(named)) ? named : (previewOf(c) || 'Chat')
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.getChatProject(route.params.id)
    project.value = data
    instructions.value = data.instructions || ''
    await loadChats(PAGE)
  } catch (_e) {
    project.value = null
  } finally {
    loading.value = false
  }
}

async function loadChats(limit) {
  try {
    const { data } = await api.getConversations({ project: route.params.id, page_size: limit })
    chats.value = rows(data)
    total.value = (data && typeof data.count === 'number') ? data.count : chats.value.length
  } catch (_e) { /* keep the list */ }
}

async function saveInstructions() {
  saving.value = true
  try {
    const { data } = await api.updateChatProject(project.value.id, { instructions: instructions.value })
    project.value = { ...project.value, ...data }
    saved.value = true
    setTimeout(() => { saved.value = false }, 2500)
  } catch (_e) {
    notify.error('Could not save the instructions.')
  } finally {
    saving.value = false
  }
}

async function startName() {
  nameDraft.value = project.value.name
  editingName.value = true
  await nextTick()
  nameInput.value?.focus()
}

async function saveName() {
  if (!editingName.value) return
  editingName.value = false
  const name = nameDraft.value.trim()
  if (!name || name === project.value.name) return
  if (await projects.rename(project.value.id, name)) project.value = { ...project.value, name }
}

function newChat() {
  const agent = chat.selectedAgentId
  chat.reset()
  router.push({ path: '/dashboard/chat/new', query: { project: project.value.id, ...(agent ? { agent } : {}) } })
}

onMounted(load)
watch(() => route.params.id, (id) => { if (id) load() })
</script>

<style scoped>
.pp { max-width: 820px; margin: 0 auto; padding: 32px 20px 64px; display: flex; flex-direction: column; gap: 20px; font-family: var(--vm-font-sans); }
.pp-state { padding: 40px 0; color: var(--vm-ink-soft); display: flex; gap: 10px; }
.pp-head { display: flex; align-items: center; gap: 12px; }
.pp-icon { width: 26px; height: 26px; color: var(--vm-ink-soft); flex-shrink: 0; }
.pp-name { flex: 1; margin: 0; font: 700 1.5rem var(--vm-font-display, var(--vm-font-sans)); color: var(--vm-ink); cursor: text; text-wrap: balance; }
.pp-name-form { flex: 1; }
.pp-name-input { width: 100%; font: 700 1.4rem var(--vm-font-sans); padding: 4px 8px; border: 1px solid var(--vm-line); border-radius: 10px; background: var(--vm-surface); color: var(--vm-ink); }
.pp-card { border: 1px solid var(--vm-line); border-radius: 16px; background: var(--vm-surface); padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; }
.pp-card-head { display: flex; align-items: center; gap: 10px; }
.pp-card h2 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--vm-ink); }
.pp-saved { font-size: 12px; color: #15803d; }
.pp-count { font-size: 12px; color: var(--vm-ink-faint, #8a8fa3); font-variant-numeric: tabular-nums; }
.pp-help { margin: 0; font-size: 13px; color: var(--vm-ink-soft); max-width: 65ch; }
.pp-textarea { width: 100%; min-height: 120px; resize: vertical; padding: 10px 12px; border: 1px solid var(--vm-line); border-radius: 12px; background: var(--vm-glass, transparent); color: var(--vm-ink); font: 400 14px/1.5 var(--vm-font-sans); }
.pp-textarea:focus, .pp-name-input:focus { outline: 2px solid var(--vm-violet, #7c3aed); outline-offset: 0; }
.pp-actions { display: flex; justify-content: flex-end; }
.pp-primary { border: 0; border-radius: 10px; padding: 8px 14px; background: var(--vm-violet-d, #6d28d9); color: #fff; font: 600 13px var(--vm-font-sans); cursor: pointer; }
.pp-primary:disabled { opacity: .5; cursor: default; }
.pp-chats { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.pp-chat { display: flex; justify-content: space-between; gap: 12px; padding: 10px 8px; border-radius: 10px; text-decoration: none; color: var(--vm-ink); }
.pp-chat:hover { background: var(--vm-glass-strong); }
.pp-chat-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.pp-chat-meta { flex-shrink: 0; font-size: 12px; color: var(--vm-ink-faint, #8a8fa3); }
.pp-more { align-self: flex-start; border: 0; background: transparent; padding: 6px 8px; border-radius: 8px; font: 600 12.5px var(--vm-font-sans); color: var(--vm-violet-d, #6d28d9); cursor: pointer; }
.pp-more:hover { background: var(--vm-glass-strong); }
@media (max-width: 480px) { .pp { padding: 20px 16px 48px; } .pp-head { flex-wrap: wrap; } }
</style>
