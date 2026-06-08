<template>
  <Transition name="csm">
    <div v-if="modelValue" class="csm-overlay" @click.self="close">
      <div class="csm" role="dialog" aria-modal="true" aria-label="Search chats">
        <!-- search -->
        <div class="csm-search">
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" stroke-linecap="round" /></svg>
          <input ref="inputEl" v-model="q" type="text" placeholder="Search chats…"
                 @keydown.esc.prevent="close" @keydown.enter.prevent="openFirst" />
          <button class="csm-x" aria-label="Close" @click="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" /></svg>
          </button>
        </div>

        <!-- results -->
        <div class="csm-list vm-scroll">
          <div v-if="loading" class="csm-empty">Loading chats…</div>
          <template v-else-if="groups.length">
            <button class="csm-new" @click="newChat">
              <span class="csm-new-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14" stroke-linecap="round" /></svg></span>
              New chat
            </button>
            <div v-for="grp in groups" :key="grp.label" class="csm-group">
              <div class="csm-label">{{ grp.label }}</div>
              <button
                v-for="s in grp.items"
                :key="s.id"
                class="csm-item"
                @click="open(s)"
              >
                <svg class="csm-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <span class="csm-text">
                  <span class="csm-title">{{ previewOf(s) }}</span>
                  <span class="csm-meta">{{ agentOf(s) }} · {{ relTime(s) }}</span>
                </span>
              </button>
            </div>
          </template>
          <div v-else class="csm-empty">No chats match “{{ q }}”.</div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../../stores/useChatStore'
import { previewOf, agentOf, relTime, groupSessions } from '../../composables/useChatHistory'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const chat = useChatStore()
const inputEl = ref(null)
const q = ref('')
const loading = computed(() => chat.allSessionsLoading && !chat.allSessions.length)

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return chat.allSessions
  return chat.allSessions.filter((s) =>
    (previewOf(s) + ' ' + agentOf(s) + ' ' + (s.title || '')).toLowerCase().includes(term)
  )
})
const groups = computed(() => groupSessions(filtered.value))

watch(() => props.modelValue, (open) => {
  if (open) {
    q.value = ''
    chat.loadAllSessions()
    nextTick(() => inputEl.value && inputEl.value.focus())
  }
})

function close() { emit('update:modelValue', false) }
function open(s) {
  if (s && s.id != null) router.push(`/dashboard/chat/${s.id}`)
  close()
}
function openFirst() {
  const first = groups.value[0] && groups.value[0].items[0]
  if (first) open(first)
}
function newChat() {
  chat.reset()
  router.push('/dashboard/chat/new')
  close()
}
</script>

<style scoped>
.csm-overlay {
  position: fixed; inset: 0; z-index: 1200;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12vh;
  background: rgba(25, 20, 39, .28);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}
.csm {
  width: min(640px, 92vw);
  font-family: var(--vm-font-sans);
  background: var(--vm-glass-strong);
  backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
  border: 1px solid rgba(255, 255, 255, .9);
  border-radius: var(--vm-r-l);
  box-shadow: var(--vm-shadow-l);
  overflow: hidden;
}
.csm-search { display: flex; align-items: center; gap: 11px; padding: 15px 16px; border-bottom: 1px solid var(--vm-line); }
.csm-search .ic { width: 19px; height: 19px; color: var(--vm-ink-faint); flex: 0 0 auto; }
.csm-search input { flex: 1; border: none; outline: none; background: transparent; font: 500 16px var(--vm-font-sans); color: var(--vm-ink); }
.csm-search input::placeholder { color: var(--vm-ink-faint); }
.csm-x { border: none; background: transparent; color: var(--vm-ink-faint); cursor: pointer; width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; }
.csm-x:hover { background: var(--vm-surface); color: var(--vm-ink); }
.csm-x svg { width: 16px; height: 16px; }

.csm-list { max-height: 56vh; overflow-y: auto; padding: 8px; }
.csm-new { width: 100%; display: flex; align-items: center; gap: 11px; padding: 10px 12px; border: none; background: transparent; border-radius: 12px; cursor: pointer; font: 700 13.5px var(--vm-font-sans); color: var(--vm-violet-d); margin-bottom: 4px; }
.csm-new:hover { background: var(--vm-violet-soft); }
.csm-new-ic { width: 30px; height: 30px; border-radius: 9px; background: var(--vm-g-cool); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: var(--vm-glow-v); }
.csm-new-ic svg { width: 16px; height: 16px; }

.csm-group { margin-top: 6px; }
.csm-label { padding: 8px 12px 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--vm-ink-faint); }
.csm-item { width: 100%; display: flex; align-items: center; gap: 11px; padding: 9px 12px; border: none; background: transparent; border-radius: 12px; cursor: pointer; text-align: left; transition: background .12s var(--vm-ease2); }
.csm-item:hover { background: var(--vm-surface); box-shadow: var(--vm-shadow-s); }
.csm-ic { width: 16px; height: 16px; flex: 0 0 auto; color: var(--vm-ink-faint); }
.csm-text { min-width: 0; display: flex; flex-direction: column; }
.csm-title { font-size: 14px; font-weight: 600; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.csm-meta { font-size: 11.5px; color: var(--vm-ink-faint); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.csm-empty { padding: 32px; text-align: center; color: var(--vm-ink-faint); font-size: 14px; }

.csm-enter-active, .csm-leave-active { transition: opacity .2s var(--vm-ease2); }
.csm-enter-active .csm, .csm-leave-active .csm { transition: transform .25s var(--vm-ease), opacity .2s; }
.csm-enter-from, .csm-leave-to { opacity: 0; }
.csm-enter-from .csm, .csm-leave-to .csm { transform: translateY(-12px) scale(.97); opacity: 0; }
</style>
