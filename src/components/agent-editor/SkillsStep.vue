<template>
  <!-- Editor Step — Skills (Phase 9). Assign installable playbooks (know-how) to this agent by writing
       skill_ids, and create a new skill inline. Mirrors the attach-card pattern: id-list + immediate PATCH. -->
  <div class="mx-auto w-full max-w-[1840px] px-6 pb-8 font-[Inter,system-ui,sans-serif]">
    <div class="mb-4 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 class="text-[20px] font-bold tracking-tight text-[#0F172A]">Skills</h2>
        <p class="mt-0.5 text-[13.5px] text-[#64748B]">
          Give this agent reusable playbooks — expert instructions it loads on demand for a specific kind of
          task. It sees each skill's name here and pulls the full instructions when relevant.
        </p>
      </div>
      <button type="button" @click="showCreate = !showCreate"
              class="shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo-600 hover:bg-indigo-50">
        <Plus :size="14" :stroke-width="2.2" class="inline -mt-0.5" /> New skill
      </button>
    </div>

    <!-- Inline create -->
    <section v-if="showCreate" class="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div class="mb-3 inline-flex rounded-lg border border-[#E5E7EB] bg-white p-0.5 text-[12px] font-semibold">
        <button type="button" @click="pasteMode = false"
                :class="pasteMode ? 'text-[#667085] px-3 py-1' : 'rounded-md bg-indigo-600 text-white px-3 py-1'">Fields</button>
        <button type="button" @click="pasteMode = true"
                :class="pasteMode ? 'rounded-md bg-indigo-600 text-white px-3 py-1' : 'text-[#667085] px-3 py-1'">Paste SKILL.md</button>
      </div>
      <div v-if="pasteMode" class="grid gap-3">
        <textarea v-model="skillMd" rows="8" placeholder="Paste a full SKILL.md (--- YAML frontmatter --- then the playbook body)"
                  class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"></textarea>
        <div class="flex items-center gap-2">
          <button type="button" @click="createSkill" :disabled="creating || !skillMd.trim()"
                  class="rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {{ creating ? 'Installing…' : 'Install & assign' }}
          </button>
          <button type="button" @click="showCreate = false"
                  class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#475467] hover:bg-[#F8FAFC]">Cancel</button>
        </div>
      </div>
      <div v-else class="grid gap-3">
        <input v-model="draft.name" placeholder="Skill name (e.g. SEO Blog Post)"
               class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
        <input v-model="draft.description" placeholder="One-line summary (the agent sees this to decide relevance)"
               class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
        <textarea v-model="draft.body" rows="5" placeholder="Full instructions (the playbook body, Markdown)"
                  class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"></textarea>
        <div class="flex items-center gap-2">
          <button type="button" @click="createSkill" :disabled="creating || !draft.name.trim()"
                  class="rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {{ creating ? 'Creating…' : 'Create & assign' }}
          </button>
          <button type="button" @click="showCreate = false"
                  class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#475467] hover:bg-[#F8FAFC]">Cancel</button>
        </div>
      </div>
    </section>

    <section class="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div class="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div class="relative flex-1 min-w-[200px] max-w-md">
          <Search :size="15" :stroke-width="2" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
          <input v-model="filter" placeholder="Search your skills…"
                 class="w-full rounded-lg border border-[#E5E7EB] bg-white py-2 pl-8 pr-3 text-[13px] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
        </div>
        <span class="text-[12px] font-semibold text-[#667085]">{{ selectedIds.length }} assigned</span>
      </div>

      <div v-if="loading" class="py-10 text-center text-[12.5px] text-[#98A2B3]">Loading your skills…</div>
      <div v-else-if="!filtered.length" class="py-10 text-center">
        <BookOpen :size="26" :stroke-width="1.5" class="mx-auto text-[#CBD5E1]" />
        <p class="mt-2 text-[13px] font-semibold text-[#475467]">{{ skills.length ? 'No matches' : 'No skills yet' }}</p>
        <p class="text-[12px] text-[#98A2B3]">{{ skills.length ? '' : 'Create your first playbook above.' }}</p>
      </div>

      <ul v-else class="divide-y divide-[#F2F4F7]">
        <li v-for="s in paged" :key="s.id" class="flex items-center gap-3 py-2.5">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
            <BookOpen :size="15" :stroke-width="2" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-[13px] font-medium text-[#0F172A]" :title="s.name">{{ s.name }}</span>
              <span v-if="s.visibility === 'system'"
                    class="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">system</span>
            </div>
            <div v-if="s.description" class="truncate text-[11px] text-[#98A2B3]" :title="s.description">{{ s.description }}</div>
          </div>
          <button type="button" @click="toggle(s)" :disabled="saving"
                  :aria-pressed="isSelected(s.id)"
                  :class="['group rounded-lg px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50',
                           isSelected(s.id)
                             ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700'
                             : 'border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50']">
            <template v-if="isSelected(s.id)">
              <span class="group-hover:hidden">✓ Assigned</span>
              <span class="hidden group-hover:inline">Remove</span>
            </template>
            <template v-else>Assign</template>
          </button>
        </li>
      </ul>

      <div v-if="!loading && filtered.length && totalPages > 1"
           class="mt-2 flex items-center justify-end gap-2 text-[12px] text-[#667085]">
        <button @click="page > 1 && page--" :disabled="page <= 1"
                class="h-7 w-7 grid place-items-center rounded-lg border border-[#E5E7EB] text-[#475467] hover:bg-[#F8FAFC] disabled:opacity-40">←</button>
        <span>Page {{ page }} of {{ totalPages }}</span>
        <button @click="page < totalPages && page++" :disabled="page >= totalPages"
                class="h-7 w-7 grid place-items-center rounded-lg border border-[#E5E7EB] text-[#475467] hover:bg-[#F8FAFC] disabled:opacity-40">→</button>
      </div>

      <p class="mt-3 border-t border-[#F2F4F7] pt-3 text-[11.5px] text-[#98A2B3]">
        A skill injects know-how, not a new tool. The agent loads a playbook only when it's relevant — so many
        skills stay cheap.
      </p>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { BookOpen, Search, Plus } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'

const props = defineProps({ agent: { type: Object, required: true } })
const agentId = computed(() => props.agent.id)

const skills = ref([])
const loading = ref(false)
const filter = ref('')
const saving = ref(false)
const page = ref(1)
const PAGE = 6

const showCreate = ref(false)
const creating = ref(false)
const draft = ref({ name: '', description: '', body: '' })
const pasteMode = ref(false)
const skillMd = ref('')

function pickArray(d) { return Array.isArray(d) ? d : (d?.results ?? []) }

function ensureIds() {
  if (!Array.isArray(props.agent.skill_ids)) {
    props.agent.skill_ids = Array.isArray(props.agent.skills) ? props.agent.skills.map(s => s.id) : []
  }
}
const selectedIds = computed(() => (Array.isArray(props.agent.skill_ids) ? props.agent.skill_ids : []))
function isSelected(id) { return selectedIds.value.includes(id) }

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return skills.value
  return skills.value.filter(s =>
    (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q))
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE, page.value * PAGE))
watch(filtered, () => { if (page.value > totalPages.value) page.value = totalPages.value })

async function loadSkills() {
  loading.value = true
  try {
    const { data } = await api.get('/skills/')
    skills.value = pickArray(data)
  } catch (e) {
    notify.error('Could not load your skills.')
  } finally {
    loading.value = false
  }
}

async function saveIds(next) {
  if (!agentId.value) { notify.info('Save your agent first, then assign skills.'); return false }
  await api.patch(`/agents/${agentId.value}/`, { skill_ids: next })
  props.agent.skill_ids = next
  const byId = new Map(skills.value.map(s => [s.id, s]))
  props.agent.skills = next.map(id => {
    const s = byId.get(id)
    return { id, name: s ? s.name : '', slug: s ? s.slug : '', description: s ? s.description : '' }
  })
  return true
}

async function toggle(s) {
  ensureIds()
  const wasSelected = isSelected(s.id)
  const next = wasSelected ? selectedIds.value.filter(x => x !== s.id) : [...selectedIds.value, s.id]
  saving.value = true
  try {
    if (await saveIds(next)) notify.success(wasSelected ? `Removed ${s.name}` : `Assigned ${s.name}`)
  } catch (e) {
    notify.error('Could not update skills.')
  } finally {
    saving.value = false
  }
}

async function createSkill() {
  const payload = pasteMode.value
    ? (skillMd.value.trim() ? { skill_md: skillMd.value } : null)
    : (draft.value.name.trim()
        ? { name: draft.value.name.trim(), description: draft.value.description.trim(), body: draft.value.body }
        : null)
  if (!payload) return
  creating.value = true
  try {
    const { data } = await api.post('/skills/', payload)
    skills.value = [data, ...skills.value]
    ensureIds()
    await saveIds([...selectedIds.value, data.id])          // create → auto-assign
    notify.success(`Added & assigned ${data.name}`)
    draft.value = { name: '', description: '', body: '' }
    skillMd.value = ''
    showCreate.value = false
  } catch (e) {
    notify.error('Could not add the skill.')
  } finally {
    creating.value = false
  }
}

onMounted(() => { ensureIds(); loadSkills() })
watch(agentId, () => ensureIds())
</script>
