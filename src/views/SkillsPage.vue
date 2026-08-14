<template>
  <!-- Skills library (Phase 9.3) — manage installable playbooks independent of any agent. Own skills are
       editable/deletable + trust-toggle; curated system skills are read-only (assign them in an agent). -->
  <div class="mx-auto w-full max-w-[980px] px-6 py-8 font-[Inter,system-ui,sans-serif]">
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-[24px] font-bold tracking-tight text-[#0F172A]">Skills</h1>
        <p class="mt-1 text-[13.5px] text-[#64748B]">
          Reusable playbooks — expert instructions you assign to agents. They inject know-how, not tools, and
          load on demand.
        </p>
      </div>
      <button type="button" @click="newSkill"
              class="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700">
        + New skill
      </button>
    </div>

    <!-- Create / edit -->
    <section v-if="showCreate" class="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <p v-if="editingId" class="mb-3 text-[13px] font-semibold text-[#0F172A]">Edit skill</p>
      <div v-if="!editingId" class="mb-3 inline-flex rounded-lg border border-[#E5E7EB] bg-white p-0.5 text-[12px] font-semibold">
        <button type="button" @click="createMode = 'fields'"
                :class="createMode === 'fields' ? 'rounded-md bg-indigo-600 text-white px-3 py-1' : 'text-[#667085] px-3 py-1'">Fields</button>
        <button type="button" @click="createMode = 'paste'"
                :class="createMode === 'paste' ? 'rounded-md bg-indigo-600 text-white px-3 py-1' : 'text-[#667085] px-3 py-1'">Paste SKILL.md</button>
        <button type="button" @click="createMode = 'import'"
                :class="createMode === 'import' ? 'rounded-md bg-indigo-600 text-white px-3 py-1' : 'text-[#667085] px-3 py-1'">Import bundle</button>
      </div>
      <div v-if="createMode === 'paste' && !editingId" class="grid gap-3">
        <textarea v-model="skillMd" rows="8" placeholder="Paste a full SKILL.md (--- YAML frontmatter --- then the body)"
                  class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"></textarea>
      </div>
      <!-- Import a full skill BUNDLE (SKILL.md + reference files + scripts) from a public repo or a zip.
           Bundles arrive UNTRUSTED — scripts stay locked until the skill is marked trusted. -->
      <div v-else-if="createMode === 'import' && !editingId" class="grid gap-3">
        <input v-model="importUrl" placeholder="https://github.com/owner/repo  (or gitlab.com — public repo with SKILL.md at root)"
               class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
        <div class="flex items-center gap-2 text-[12px] text-[#98A2B3]">
          <span class="h-px flex-1 bg-[#E5E7EB]"></span> or upload a zip <span class="h-px flex-1 bg-[#E5E7EB]"></span>
        </div>
        <input ref="zipEl" type="file" accept=".zip"
               class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-indigo-600" />
        <p class="text-[12px] text-[#98A2B3]">Imported bundles are <strong>untrusted</strong> — bundled scripts can’t run
          until you mark the skill trusted.</p>
      </div>
      <div v-else class="grid gap-3">
        <input v-model="draft.name" placeholder="Skill name"
               class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
        <input v-model="draft.description" placeholder="One-line summary"
               class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
        <textarea v-model="draft.body" rows="5" placeholder="Full instructions (Markdown)"
                  class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"></textarea>
      </div>
      <!-- Staff only: curate this as a BUILT-IN skill (system-owned, visible/assignable to every user) —
           mirrors built-in agents; normal users never see this control. -->
      <label v-if="isStaff" class="mt-3 flex items-center gap-2 text-[12.5px] font-semibold text-[#475467]">
        <input type="checkbox" v-model="draft.makeSystem" :disabled="editingIsSystem"
               class="h-4 w-4 rounded border-[#E5E7EB] text-indigo-600 focus:ring-indigo-500/30" />
        Built-in skill — available to every user
        <span v-if="editingIsSystem" class="font-normal text-[#98A2B3]">(already a built-in)</span>
      </label>
      <div class="mt-3 flex items-center gap-2">
        <button type="button" @click="save" :disabled="creating || !canCreate"
                class="rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {{ creating ? 'Saving…' : (editingId ? 'Save changes' : (createMode === 'import' ? 'Install' : 'Create')) }}
        </button>
        <button type="button" @click="resetForm"
                class="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#475467] hover:bg-[#F8FAFC]">Cancel</button>
      </div>
    </section>

    <div v-if="loading" class="py-16 text-center text-[13px] text-[#98A2B3]">Loading skills…</div>

    <template v-else>
      <!-- Marketplace toolbar (9.6): ONE search across both sections + category chips computed from
           the search-visible set (pure helpers in ./skillsMarketplace.js). -->
      <div class="mb-4 grid gap-2.5">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Search :size="14" :stroke-width="2"
                    class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
            <input v-model="query"
                   :placeholder="semantic ? 'Describe what you need — semantic search…'
                                          : 'Search skills by name, description or tag…'"
                   class="w-full rounded-lg border border-[#E5E7EB] bg-white py-2 pl-9 pr-3 text-[13px] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <button type="button" @click="semantic = !semantic"
                  :class="semantic ? 'border-indigo-600 bg-indigo-600 text-white'
                                   : 'border-[#E5E7EB] bg-white text-[#667085] hover:bg-[#F8FAFC]'"
                  class="shrink-0 rounded-lg border px-3 py-2 text-[12px] font-semibold"
                  title="Rank by meaning (embeddings) instead of exact text match">
            Semantic
          </button>
        </div>
        <div v-if="categories.length > 1" class="flex flex-wrap items-center gap-1.5">
          <button v-for="c in categories" :key="c" type="button"
                  @click="category = category === c ? '' : c"
                  :class="category === c
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-[#E5E7EB] bg-white text-[#667085] hover:bg-[#F8FAFC]'"
                  class="rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize">
            {{ c }}
          </button>
        </div>
      </div>

      <!-- Built-in library: curated SYSTEM skills as marketplace cards. Everyone assigns them to
           agents; staff also curate (edit/trust/delete) straight from the card. -->
      <section class="mb-6">
        <div class="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-[15px] font-bold tracking-tight text-[#0F172A]">
            Built-in library <span class="font-semibold text-[#98A2B3]">{{ visibleBuiltin.length }}</span>
          </h2>
          <span class="text-[11.5px] text-[#98A2B3]">Curated by the platform — assign them to any agent</span>
        </div>

        <div v-if="!visibleBuiltin.length"
             class="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-10 text-center">
          <p class="text-[13px] font-semibold text-[#475467]">
            {{ builtinSkills.length ? 'No built-in skills match your search.' : 'No built-in skills yet' }}
          </p>
          <p v-if="!builtinSkills.length" class="mt-1 text-[12px] text-[#98A2B3]">
            <template v-if="isStaff">Create or Import a skill and check “Built-in skill — available to every
              user” to publish it here.</template>
            <template v-else>The platform hasn’t published curated skills yet — your own skills below work
              the same way.</template>
          </p>
        </div>

        <div v-else class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="s in pagedBuiltin" :key="s.id"
               class="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-4">
            <div class="flex items-start justify-between gap-2">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
                <BookOpen :size="16" :stroke-width="2" />
              </span>
              <div class="flex flex-wrap items-center justify-end gap-1">
                <span class="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold capitalize text-[#475467]">{{ skillCategory(s) }}</span>
                <span v-if="s.trust_status === 'trusted'" class="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">trusted</span>
              </div>
            </div>
            <p class="mt-2.5 text-[13.5px] font-semibold text-[#0F172A]">{{ s.name }}</p>
            <p class="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-[#64748B]">{{ s.description || 'No description yet.' }}</p>
            <p class="mt-2 text-[11px] text-[#98A2B3]">
              {{ (s.files || []).length }} {{ (s.files || []).length === 1 ? 'file' : 'files' }}<template v-if="scriptCount(s)"> · {{ scriptCount(s) }} {{ scriptCount(s) === 1 ? 'script' : 'scripts' }}</template>
              <span v-if="scriptCount(s) && s.trust_status !== 'trusted'"
                    class="font-semibold text-amber-600"> · scripts locked until trusted</span>
            </p>
            <div class="mt-auto flex items-center justify-between gap-2 pt-3">
              <router-link to="/dashboard/agents" class="text-[11.5px] font-semibold text-indigo-600 hover:underline">
                Assign to agent →
              </router-link>
              <div v-if="isStaff" class="flex items-center gap-1">
                <button type="button" @click="startEdit(s)"
                        class="rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 text-[10.5px] font-semibold text-[#475467] hover:bg-[#F8FAFC]">Edit</button>
                <button type="button" @click="toggleTrust(s)"
                        class="rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 text-[10.5px] font-semibold text-[#475467] hover:bg-[#F8FAFC]">{{ s.trust_status === 'trusted' ? 'Untrust' : 'Trust' }}</button>
                <button type="button" @click="remove(s)"
                        class="rounded-md border border-red-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Pager — pages the FILTERED set; search/category/semantic changes reset to page 1. -->
        <div v-if="builtinPageCount > 1" class="mt-3 flex items-center justify-center gap-1.5">
          <button type="button" :disabled="builtinPage === 1" @click="builtinPage--"
                  class="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#475467] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40">
            ‹ Prev
          </button>
          <button v-for="p in builtinPageNumbers" :key="p" type="button"
                  @click="typeof p === 'number' && (builtinPage = p)"
                  :disabled="p === '…'"
                  :class="p === builtinPage
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-[#E5E7EB] bg-white text-[#475467] hover:bg-[#F8FAFC]'"
                  class="min-w-[30px] rounded-md border px-2 py-1 text-[12px] font-semibold disabled:cursor-default">
            {{ p }}
          </button>
          <button type="button" :disabled="builtinPage === builtinPageCount" @click="builtinPage++"
                  class="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#475467] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40">
            Next ›
          </button>
          <span class="ml-2 text-[11.5px] text-[#98A2B3]">
            {{ (builtinPage - 1) * BUILTIN_PAGE_SIZE + 1 }}–{{ Math.min(builtinPage * BUILTIN_PAGE_SIZE, visibleBuiltin.length) }}
            of {{ visibleBuiltin.length }}
          </span>
        </div>
      </section>

      <!-- My skills: the user's own playbooks — existing list treatment, full control. -->
      <section>
        <div class="mb-2.5 flex items-baseline gap-2">
          <h2 class="text-[15px] font-bold tracking-tight text-[#0F172A]">
            My skills <span class="font-semibold text-[#98A2B3]">{{ visibleMine.length }}</span>
          </h2>
        </div>

        <div v-if="!visibleMine.length"
             class="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-14 text-center">
          <p class="text-[14px] font-semibold text-[#475467]">{{ mySkills.length ? 'No skills match your search.' : 'No skills yet' }}</p>
          <p class="text-[12.5px] text-[#98A2B3]">{{ mySkills.length ? 'Try a different search or category.' : 'Create your first playbook above.' }}</p>
        </div>

        <ul v-else class="grid gap-2.5">
          <li v-for="s in visibleMine" :key="s.id"
              class="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen :size="16" :stroke-width="2" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-[14px] font-semibold text-[#0F172A]">{{ s.name }}</span>
                <span v-if="s.trust_status === 'trusted'" class="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">trusted</span>
              </div>
              <p v-if="s.description" class="mt-0.5 text-[12px] text-[#64748B]">{{ s.description }}</p>
              <!-- Bundled files (imported bundles): scripts flagged; locked until the skill is trusted. -->
              <div v-if="s.files && s.files.length" class="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span v-for="f in s.files" :key="f.path"
                      class="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-1.5 py-0.5 text-[10.5px] font-medium text-[#64748B]">
                  {{ f.path }}
                  <span v-if="f.is_script" class="rounded bg-violet-100 px-1 text-[9.5px] font-bold text-violet-700">script</span>
                </span>
                <span v-if="s.files.some(f => f.is_script) && s.trust_status !== 'trusted'"
                      class="text-[10.5px] font-semibold text-amber-600">scripts locked until trusted</span>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <button type="button" @click="startEdit(s)"
                      class="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#475467] hover:bg-[#F8FAFC]">
                Edit
              </button>
              <button type="button" @click="toggleTrust(s)"
                      class="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#475467] hover:bg-[#F8FAFC]">
                {{ s.trust_status === 'trusted' ? 'Untrust' : 'Trust' }}
              </button>
              <button type="button" @click="remove(s)"
                      class="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-red-600 hover:bg-red-50">
                Delete
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { BookOpen, Search } from 'lucide-vue-next'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { skillCategory, filterSkills, categoriesOf } from './skillsMarketplace'

const skills = ref([])
const loading = ref(true)
const showCreate = ref(false)
const creating = ref(false)
const createMode = ref('fields')   // fields | paste | import (bundle: git URL or zip)
const skillMd = ref('')
const importUrl = ref('')
const zipEl = ref(null)
const draft = ref({ name: '', description: '', body: '', makeSystem: false })
const editingId = ref(null)   // null = creating; an id = editing that skill
const isStaff = ref(false)    // staff curate BUILT-IN (system) skills — same pattern as built-in agents

// Marketplace state (9.6): one search + one category filter across BOTH sections. Filtering is
// presentation-only (pure helpers) — visibility/trust stay whatever the backend returned.
const query = ref('')
const category = ref('')      // '' = all categories
const builtinSkills = computed(() => skills.value.filter(s => s.visibility === 'system'))
const mySkills = computed(() => skills.value.filter(s => s.visibility !== 'system'))
// Semantic mode replaces the lexical filter with the server's cosine-ranked rows (order preserved);
// category chips still apply on top.
const _bySemantic = (rows) => {
  if (semanticResults.value === null) return null
  const ids = new Set(rows.map(s => s.id))
  return semanticResults.value.filter(s => ids.has(s.id))
}
const visibleBuiltin = computed(() => {
  const sem = _bySemantic(builtinSkills.value)
  return sem !== null ? filterSkills(sem, '', category.value)
                      : filterSkills(builtinSkills.value, query.value, category.value)
})

// Library pager over the FILTERED set. Any filter change (search/category/semantic) resets to page 1 —
// staying on page 7 of a list that just shrank to 4 pages would show emptiness that looks like a bug.
const BUILTIN_PAGE_SIZE = 24
const builtinPage = ref(1)
const builtinPageCount = computed(() => Math.max(1, Math.ceil(visibleBuiltin.value.length / BUILTIN_PAGE_SIZE)))
const pagedBuiltin = computed(() =>
  visibleBuiltin.value.slice((builtinPage.value - 1) * BUILTIN_PAGE_SIZE, builtinPage.value * BUILTIN_PAGE_SIZE))
const builtinPageNumbers = computed(() => {
  const n = builtinPageCount.value, cur = builtinPage.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const pages = [1]
  if (cur > 3) pages.push('…')
  for (let p = Math.max(2, cur - 1); p <= Math.min(n - 1, cur + 1); p++) pages.push(p)
  if (cur < n - 2) pages.push('…')
  pages.push(n)
  return pages
})
// (pager reset watches live below the semantic block — `semantic` must exist first)
const visibleMine = computed(() => {
  const sem = _bySemantic(mySkills.value)
  return sem !== null ? filterSkills(sem, '', category.value)
                      : filterSkills(mySkills.value, query.value, category.value)
})
// Chips come from the SEARCH-visible set (not category-filtered — picking one must not hide the rest).
const categories = computed(() => categoriesOf(filterSkills(skills.value, query.value)))
const scriptCount = (s) => (s.files || []).filter(f => f.is_script).length

const editingIsSystem = computed(() => {
  const s = editingId.value && skills.value.find(x => x.id === editingId.value)
  return !!(s && s.visibility === 'system')
})

const canCreate = computed(() => {
  if (editingId.value) return !!draft.value.name.trim()
  if (createMode.value === 'paste') return !!skillMd.value.trim()
  if (createMode.value === 'import') return !!(importUrl.value.trim() || zipEl.value?.files?.length)
  return !!draft.value.name.trim()
})

function pickArray(d) { return Array.isArray(d) ? d : (d?.results ?? []) }

async function load() {
  loading.value = true
  try {
    // The library is server-paginated (285+ built-ins). Walk every page so the marketplace filters
    // (search + category chips) keep operating over the FULL set client-side.
    const all = []
    let page = 1
    for (;;) {
      const { data } = await api.get('/skills/', { params: { page, page_size: 100 } })
      all.push(...pickArray(data))
      if (!data?.next) break
      page += 1
    }
    skills.value = all
  } catch (e) {
    notify.error('Could not load skills.')
  } finally {
    loading.value = false
  }
}

// Semantic search (server-side, embedding cosine over the same rows). Debounced; falls back to the
// normal lexical/client filtering when off or when the deployment has no embedding provider.
const semantic = ref(false)
const semanticResults = ref(null)   // null = inactive; [] = active with no matches
let semanticTimer = null
watch([semantic, query], () => {
  clearTimeout(semanticTimer)
  if (!semantic.value || !query.value.trim()) { semanticResults.value = null; return }
  semanticTimer = setTimeout(async () => {
    try {
      const { data } = await api.get('/skills/', {
        params: { q: query.value.trim(), mode: 'semantic', page_size: 100 } })
      semanticResults.value = pickArray(data)
    } catch { semanticResults.value = null }
  }, 350)
})

// Filter changes (search/category/semantic) reset the library pager to page 1; a shrinking result set
// clamps the current page rather than stranding the user on an empty one.
watch([query, category, semantic], () => { builtinPage.value = 1 })
watch(builtinPageCount, (n) => { if (builtinPage.value > n) builtinPage.value = n })

function newSkill() {
  editingId.value = null
  createMode.value = 'fields'
  draft.value = { name: '', description: '', body: '', makeSystem: false }
  skillMd.value = ''
  importUrl.value = ''
  showCreate.value = true
}

function startEdit(s) {
  editingId.value = s.id
  createMode.value = 'fields'
  draft.value = { name: s.name || '', description: s.description || '', body: s.body || '',
                  makeSystem: s.visibility === 'system' }
  showCreate.value = true
}

function resetForm() {
  editingId.value = null
  draft.value = { name: '', description: '', body: '', makeSystem: false }
  skillMd.value = ''
  importUrl.value = ''
  showCreate.value = false
}

async function installBundle(makeSystem) {
  // Bundle install (git URL or zip) → POST /skills/install/ — lands imported+untrusted; scripts stay
  // locked until the skill is trusted (the backend enforces both).
  const file = zipEl.value?.files?.[0]
  let res
  if (file) {
    const fd = new FormData()
    fd.append('zip_file', file)
    if (makeSystem) fd.append('make_system', 'true')
    res = await api.post('/skills/install/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  } else {
    const body = { git_url: importUrl.value.trim() }
    if (makeSystem) body.make_system = true
    res = await api.post('/skills/install/', body)
  }
  return res.data
}

async function save() {
  creating.value = true
  // make_system is staff-only intent (the backend strips it for everyone else) — sent only when the
  // box is CHECKED and the skill isn't already a built-in (promote-on-edit works too).
  const makeSystem = isStaff.value && draft.value.makeSystem && !editingIsSystem.value
  try {
    if (editingId.value) {
      const body = { name: draft.value.name.trim(), description: draft.value.description.trim(),
                     body: draft.value.body }
      if (makeSystem) body.make_system = true
      const { data } = await api.patch(`/skills/${editingId.value}/`, body)
      skills.value = skills.value.map(s => s.id === data.id ? data : s)
      notify.success(`Updated ${data.name}`)
    } else if (createMode.value === 'import') {
      const data = await installBundle(makeSystem)
      skills.value = [data, ...skills.value]
      notify.success(`Installed ${data.name} — mark it trusted to unlock its scripts`)
    } else {
      const payload = createMode.value === 'paste'
        ? { skill_md: skillMd.value }
        : { name: draft.value.name.trim(), description: draft.value.description.trim(), body: draft.value.body }
      if (makeSystem) payload.make_system = true
      const { data } = await api.post('/skills/', payload)
      skills.value = [data, ...skills.value]
      notify.success(makeSystem ? `Created built-in skill ${data.name}` : `Created ${data.name}`)
    }
    resetForm()
  } catch (e) {
    const detail = e?.response?.data?.detail
    notify.error(detail || (editingId.value ? 'Could not update the skill.' : 'Could not create the skill.'))
  } finally {
    creating.value = false
  }
}

async function toggleTrust(s) {
  try {
    const { data } = await api.post(`/skills/${s.id}/trust/`, { trusted: s.trust_status !== 'trusted' })
    s.trust_status = data.trust_status
  } catch (e) {
    notify.error('Could not update trust.')
  }
}

async function remove(s) {
  const ok = await confirm({ title: 'Delete skill', message: `Delete "${s.name}"? This cannot be undone.`,
                             confirmText: 'Delete', danger: true })
  if (!ok) return
  try {
    await api.delete(`/skills/${s.id}/`)
    skills.value = skills.value.filter(x => x.id !== s.id)
    notify.success('Skill deleted')
  } catch (e) {
    notify.error('Could not delete the skill.')
  }
}

onMounted(async () => {
  load()
  // Staff status gates the Built-in curation controls (same check the admin router guard uses).
  try { const { data } = await api.checkAuth(); isStaff.value = !!data?.user?.is_staff } catch { /* non-staff */ }
})
</script>
