<template>
  <div class="mp-page">
    <div class="mp-header">
      <h1 class="gradient-text">Model Pricing</h1>
      <p class="subtitle">Set cost per 1M tokens for every provider model. Used to cost LLM requests.</p>
    </div>

    <!-- Access guard (backend also enforces IsAdminUser; route guard blocks direct URL) -->
    <div v-if="!isStaff" class="access-denied">
      <div class="denied-card">
        <span class="denied-icon">🔒</span>
        <h2>Not authorized</h2>
        <p>The Model Pricing page is only available to administrators.</p>
      </div>
    </div>

    <div v-else class="mp-body">
      <!-- Summary cards -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ summary.total }}</div>
          <div class="stat-label">Total models</div>
        </div>
        <div class="stat-card" :class="{ warn: summary.missing > 0 }">
          <div class="stat-value">{{ summary.missing }}</div>
          <div class="stat-label">Missing pricing</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ summary.priced }}</div>
          <div class="stat-label">Priced models</div>
        </div>
        <div class="stat-card" :class="{ danger: summary.usedRecentlyMissing > 0 }">
          <div class="stat-value">{{ summary.usedRecentlyMissing }}</div>
          <div class="stat-label">Used recently · unpriced</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="mp-filters">
        <label class="f-group f-search">
          <span>Search model</span>
          <input type="search" v-model="search" list="mp-model-options"
                 placeholder="Type a model id or name…" autocomplete="off" />
          <datalist id="mp-model-options">
            <option v-for="opt in modelOptions" :key="opt" :value="opt" />
          </datalist>
        </label>
        <label class="f-group">
          <span>Provider</span>
          <select v-model="providerFilter">
            <option value="all">All providers</option>
            <option v-for="p in providers" :key="p.provider_type" :value="p.provider_type">
              {{ p.display_name }}
            </option>
          </select>
        </label>
        <label class="f-group">
          <span>Status</span>
          <select v-model="statusFilter">
            <option value="all">All statuses</option>
            <option value="exact">Priced</option>
            <option value="missing">Missing</option>
            <option value="local_free">Local / free</option>
          </select>
        </label>
        <label class="f-check">
          <input type="checkbox" v-model="onlyUsedMissing" />
          <span>Used recently &amp; unpriced only</span>
        </label>
        <div class="f-spacer"></div>
        <button class="btn-ghost btn-sync" @click="syncOpenRouter" :disabled="syncing || loading"
                title="Pull exact pricing for every OpenRouter model from the OpenRouter API. Won't overwrite prices you set manually.">
          {{ syncing ? 'Syncing…' : '↻ Sync OpenRouter' }}
        </button>
        <button class="btn-ghost" @click="load" :disabled="loading">
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>

      <!-- Legend -->
      <div class="mp-legend">
        <span class="lg"><i class="dot ok"></i> Priced (exact DB pricing)</span>
        <span class="lg"><i class="dot miss"></i> Missing — needs a price</span>
        <span class="lg"><i class="dot local"></i> Local / free (Ollama)</span>
        <span class="lg"><i class="dot used"></i> Used recently but unpriced</span>
      </div>

      <!-- Table -->
      <div class="panel">
        <div v-if="loading" class="panel-loading">Loading models…</div>
        <div v-else-if="!filtered.length" class="panel-loading">
          No models match these filters. Models are added to the catalog when a provider is synced.
        </div>
        <div v-else class="table-wrap">
          <table class="mp-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Model ID</th>
                <th>Display name</th>
                <th>Status</th>
                <th>Used</th>
                <th>Input / 1M</th>
                <th>Output / 1M</th>
                <th>Cached in / 1M</th>
                <th>Reasoning / 1M</th>
                <th title="USD per image for image-generation models">Per image</th>
                <th>Cur</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in paged" :key="m.id" :class="rowClass(m)">
                <td class="nowrap">{{ m.provider_name }}</td>
                <td class="mono">{{ m.model_id }}</td>
                <td>{{ m.display_name }}</td>
                <td>
                  <span class="badge" :class="'st-' + m.pricing_status">{{ statusLabel(m.pricing_status) }}</span>
                </td>
                <td class="center">
                  <span v-if="m.used_recently" class="badge st-used" title="Seen in recent request logs">recent</span>
                  <span v-else class="muted">—</span>
                </td>
                <td><input class="num" type="number" step="any" min="0" placeholder="—"
                           v-model="edits[m.id].input" :disabled="m.is_local && !edits[m.id].input" /></td>
                <td><input class="num" type="number" step="any" min="0" placeholder="—"
                           v-model="edits[m.id].output" /></td>
                <td><input class="num" type="number" step="any" min="0" placeholder="—"
                           v-model="edits[m.id].cached" /></td>
                <td><input class="num" type="number" step="any" min="0" placeholder="—"
                           v-model="edits[m.id].reasoning" /></td>
                <td><input class="num" type="number" step="any" min="0" placeholder="—"
                           title="USD per generated image (image models)"
                           v-model="edits[m.id].image" /></td>
                <td><input class="cur" type="text" maxlength="8" v-model="edits[m.id].currency" /></td>
                <td><input class="notes" type="text" placeholder="optional" v-model="edits[m.id].notes" /></td>
                <td>
                  <button class="btn-save" :disabled="savingId === m.id || !dirty(m)" @click="saveRow(m)">
                    {{ savingId === m.id ? 'Saving…' : 'Save' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination — 50 models per page -->
        <div v-if="!loading && filtered.length" class="mp-pager">
          <span class="pager-info">
            Showing {{ pageStart }}–{{ pageEnd }} of {{ filtered.length }} models
          </span>
          <div class="pager-controls">
            <button class="btn-page" :disabled="page <= 1" @click="prevPage">‹ Prev</button>
            <span class="pager-pos">Page {{ page }} / {{ totalPages }}</span>
            <button class="btn-page" :disabled="page >= totalPages" @click="nextPage">Next ›</button>
          </div>
        </div>
      </div>
      <p class="mp-foot">
        Prices are in cost per 1,000,000 tokens. Saving creates a new active pricing version —
        historical request logs keep their original frozen cost. Local models stay free unless you price them.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'
import { notify } from '@/composables/useNotify'

useMeta({ title: 'Model Pricing — Admin' })

const isStaff = ref(true)        // optimistic; corrected on mount + guarded by router
const loading = ref(false)
const syncing = ref(false)
const savingId = ref(null)
const models = ref([])
const providers = ref([])

const providerFilter = ref('all')
const statusFilter = ref('all')
const onlyUsedMissing = ref(false)
const search = ref('')

// Per-row editable values, keyed by model id. Seeded from current pricing; only sent on Save.
const edits = reactive({})

function seedEdits(list) {
  for (const m of list) {
    const p = m.pricing || {}
    edits[m.id] = {
      input: p.input_cost_per_1m_tokens ?? '',
      output: p.output_cost_per_1m_tokens ?? '',
      cached: p.cached_input_cost_per_1m_tokens ?? '',
      reasoning: p.reasoning_cost_per_1m_tokens ?? '',
      image: p.cost_per_image ?? '',
      currency: p.currency || 'USD',
      notes: p.pricing_notes || '',
    }
  }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/auth/check')
    isStaff.value = !!data.user?.is_staff
  } catch { isStaff.value = false }
  if (!isStaff.value) return
  await load()
})

async function syncOpenRouter() {
  syncing.value = true
  try {
    const { data } = await api.syncOpenRouterPricing()
    const s = data.stats || {}
    notify.success(
      `OpenRouter sync: ${s.priced ?? 0} priced, ${s.manual_kept ?? 0} manual kept, ` +
      `${s.no_price ?? 0} unpriced (of ${s.fetched ?? 0} models).`
    )
    await load()
  } catch (e) {
    notify.error('OpenRouter sync failed: ' + (e?.response?.data?.error || e.message))
  }
  syncing.value = false
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.getModelPricing()
    models.value = data.models || []
    providers.value = data.providers || []
    seedEdits(models.value)
  } catch (e) {
    notify.error('Failed to load model pricing: ' + (e?.response?.data?.error || e.message))
  }
  loading.value = false
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return models.value.filter((m) => {
    if (providerFilter.value !== 'all' && m.provider_type !== providerFilter.value) return false
    if (statusFilter.value !== 'all' && m.pricing_status !== statusFilter.value) return false
    if (onlyUsedMissing.value && !(m.used_recently && m.pricing_status === 'missing')) return false
    if (q && !(`${m.model_id} ${m.display_name} ${m.provider_name}`.toLowerCase().includes(q))) return false
    return true
  })
})

// Autocomplete suggestions (model ids, narrowed to the active provider filter).
const modelOptions = computed(() => {
  const list = providerFilter.value === 'all'
    ? models.value
    : models.value.filter((m) => m.provider_type === providerFilter.value)
  return Array.from(new Set(list.map((m) => m.model_id))).sort().slice(0, 500)
})

// Summary reflects the FULL catalog, not the filtered view.
const summary = computed(() => {
  const all = models.value
  return {
    total: all.length,
    missing: all.filter((m) => m.pricing_status === 'missing').length,
    priced: all.filter((m) => m.pricing_status === 'exact').length,
    usedRecentlyMissing: all.filter((m) => m.used_recently && m.pricing_status === 'missing').length,
  }
})

// Pagination: 50 models per page over the filtered set.
const PAGE_SIZE = 50
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})
const pageStart = computed(() => (filtered.value.length ? (page.value - 1) * PAGE_SIZE + 1 : 0))
const pageEnd = computed(() => Math.min(page.value * PAGE_SIZE, filtered.value.length))

// Reset to page 1 whenever the filters change; clamp if the filtered set shrinks.
watch([providerFilter, statusFilter, onlyUsedMissing, search], () => { page.value = 1 })
watch(totalPages, (tp) => { if (page.value > tp) page.value = tp })

function prevPage() { if (page.value > 1) page.value-- }
function nextPage() { if (page.value < totalPages.value) page.value++ }

function statusLabel(s) {
  return { exact: 'Priced', missing: 'Missing', local_free: 'Local · free' }[s] || s
}

function rowClass(m) {
  if (m.used_recently && m.pricing_status === 'missing') return 'row-used-missing'
  if (m.pricing_status === 'missing') return 'row-missing'
  return ''
}

// A row is dirty when its editable values differ from the loaded pricing snapshot.
function dirty(m) {
  const e = edits[m.id]
  if (!e) return false
  const p = m.pricing || {}
  const norm = (v) => (v === '' || v === null || v === undefined ? '' : String(v))
  return (
    norm(e.input) !== norm(p.input_cost_per_1m_tokens) ||
    norm(e.output) !== norm(p.output_cost_per_1m_tokens) ||
    norm(e.cached) !== norm(p.cached_input_cost_per_1m_tokens) ||
    norm(e.reasoning) !== norm(p.reasoning_cost_per_1m_tokens) ||
    norm(e.image) !== norm(p.cost_per_image) ||
    norm(e.currency) !== norm(p.currency || 'USD') ||
    norm(e.notes) !== norm(p.pricing_notes || '')
  )
}

async function saveRow(m) {
  const e = edits[m.id]
  const hasImage = !(e.image === '' || e.image === null || e.image === undefined)
  const hasTokens = !(e.input === '' || e.output === '' || e.input === null || e.output === null)
  // Token models need input+output per-1M; image models may set ONLY per-image price.
  if (!hasTokens && !hasImage) {
    notify.error('Set input + output cost per 1M, or a per-image price for an image model.')
    return
  }
  if ([e.input, e.output, e.image].some(v => v !== '' && v !== null && Number(v) < 0)) {
    notify.error('Costs cannot be negative.')
    return
  }
  savingId.value = m.id
  try {
    const payload = {
      input_cost_per_1m_tokens: e.input,
      output_cost_per_1m_tokens: e.output,
      // Empty optional fields are sent as null (backend coerces '' -> null).
      cached_input_cost_per_1m_tokens: e.cached === '' ? null : e.cached,
      reasoning_cost_per_1m_tokens: e.reasoning === '' ? null : e.reasoning,
      cost_per_image: e.image === '' ? null : e.image,
      currency: e.currency || 'USD',
      pricing_notes: e.notes || '',
    }
    const { data } = await api.setModelPricing(m.id, payload)
    // Replace the row in place with the fresh server state so status flips to "Priced".
    const fresh = data.model
    if (fresh) {
      const idx = models.value.findIndex((x) => x.id === m.id)
      if (idx !== -1) models.value[idx] = fresh
      seedEdits([fresh])
    }
    notify.success(`Saved pricing for ${m.model_id}`)
  } catch (err) {
    notify.error('Save failed: ' + (err?.response?.data?.error || err.message))
  }
  savingId.value = null
}
</script>

<style scoped>
.mp-page {
  min-height: 100vh;
  background: var(--bg-body);
  color: var(--text-primary);
  padding: 2rem;
}
.mp-header { text-align: center; padding: 2.5rem 1rem 1.5rem; }
.gradient-text {
  font-family: var(--vm-font-display, 'Bricolage Grotesque', sans-serif);
  background: var(--vm-g-brand, linear-gradient(120deg, #2563EB, #1E40AF));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: -.02em;
}
.subtitle { color: var(--text-muted); margin-top: 0.5rem; }

.access-denied { display: flex; justify-content: center; padding: 4rem; }
.denied-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 3rem;
  text-align: center;
  max-width: 420px;
}
.denied-icon { font-size: 3rem; display: block; margin-bottom: 1rem; }
.denied-card h2 { margin-bottom: 0.5rem; }
.denied-card p { color: var(--text-muted); }

.mp-body { max-width: 1280px; margin: 0 auto; }

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
}
.stat-card.warn { border-color: rgba(245, 158, 11, .45); background: rgba(245, 158, 11, .06); }
.stat-card.danger { border-color: rgba(239, 68, 68, .5); background: rgba(239, 68, 68, .07); }
.stat-value { font-size: 1.9rem; font-weight: 800; }
.stat-label { color: var(--text-muted); font-size: 0.82rem; margin-top: 0.25rem; }

.mp-filters {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.f-group { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; color: var(--text-muted); }
.f-group select,
.f-group input[type="search"] {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  color: var(--text-primary);
  font-size: 0.85rem;
  min-width: 170px;
}
.f-search input[type="search"] { min-width: 240px; }
.f-search input[type="search"]:focus { outline: none; border-color: var(--vm-violet, #2563EB); }
.f-check { display: flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; color: var(--text-primary); padding-bottom: 0.4rem; }
.f-spacer { flex: 1; }
.btn-ghost {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 600;
}
.btn-ghost:disabled { opacity: .6; cursor: default; }
.btn-sync { border-color: rgba(124, 58, 237, .5); color: var(--vm-violet, #2563EB); }

.mp-legend { display: flex; flex-wrap: wrap; gap: 1.1rem; margin-bottom: 1rem; font-size: 0.78rem; color: var(--text-muted); }
.lg { display: inline-flex; align-items: center; gap: 0.4rem; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot.ok { background: #10b981; }
.dot.miss { background: #f59e0b; }
.dot.local { background: #0ea5e9; }
.dot.used { background: #ef4444; }

.panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0.5rem;
}
.panel-loading { color: var(--text-muted); padding: 2rem; text-align: center; }

.table-wrap { overflow: auto; max-height: 62vh; }
.mp-table { width: 100%; border-collapse: collapse; }
.mp-table th, .mp-table td {
  padding: 0.55rem 0.7rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 0.82rem;
  white-space: nowrap;
}
.mp-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  position: sticky;
  top: 0;
  background: var(--bg-card);
  z-index: 1;
}
.mp-table tbody tr:hover { background: rgba(124, 58, 237, .035); }
.row-missing { background: rgba(245, 158, 11, .05); }
.row-used-missing { background: rgba(239, 68, 68, .08); box-shadow: inset 3px 0 0 #ef4444; }

.mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.78rem; }
.nowrap { white-space: nowrap; }
.center { text-align: center; }
.muted { color: var(--text-muted); }

.badge { padding: 0.15rem 0.5rem; border-radius: 6px; font-size: 0.7rem; font-weight: 700; }
.st-exact { background: rgba(16, 185, 129, .14); color: #059669; }
.st-missing { background: rgba(245, 158, 11, .16); color: #b45309; }
.st-local_free { background: rgba(14, 165, 233, .14); color: #0369a1; }
.st-used { background: rgba(239, 68, 68, .14); color: #dc2626; }

input.num, input.cur, input.notes {
  background: var(--bg-body);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.32rem 0.45rem;
  color: var(--text-primary);
  font-size: 0.82rem;
}
input.num { width: 92px; }
input.cur { width: 54px; text-transform: uppercase; }
input.notes { width: 150px; }
input:focus { outline: none; border-color: var(--vm-violet, #2563EB); }

.btn-save {
  background: var(--vm-g-brand, linear-gradient(120deg, #2563EB, #1E40AF));
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 0.38rem 0.85rem;
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
}
.btn-save:disabled { opacity: .4; cursor: default; background: var(--border); color: var(--text-muted); }

.mp-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.85rem 0.7rem 0.4rem;
  border-top: 1px solid var(--border);
}
.pager-info { color: var(--text-muted); font-size: 0.8rem; }
.pager-controls { display: flex; align-items: center; gap: 0.6rem; }
.pager-pos { font-size: 0.8rem; color: var(--text-muted); min-width: 90px; text-align: center; }
.btn-page {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
}
.btn-page:disabled { opacity: .45; cursor: default; }

.mp-foot { color: var(--text-muted); font-size: 0.78rem; margin: 1rem 0.25rem; line-height: 1.5; }

@media (max-width: 900px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
