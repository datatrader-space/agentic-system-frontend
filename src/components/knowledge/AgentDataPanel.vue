<template>
  <div class="adp h-full flex flex-col" :class="{ 'adp--detail': !!activeCollection }">

    <!-- ═══ COLLECTION LIST VIEW ═══ -->
    <template v-if="!activeCollection">
      <!-- Hero Header -->
      <div class="adp-hero">
        <div class="adp-hero__inner">
          <div class="adp-hero__left">
            <div class="adp-hero__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" />
                <path d="M20 7c0 2.21-3.582 4-8 4S4 9.21 4 7s3.582-4 8-4 8 1.79 8 4z" />
                <path d="M4 12c0 2.21 3.582 4 8 4s8-1.79 8-4" />
              </svg>
            </div>
            <div>
              <h2 class="adp-hero__title">Data Explorer</h2>
              <p class="adp-hero__sub">{{ stats.total_collections || 0 }} collections · {{ stats.total_entries || 0 }} records · {{ formatBytes(stats.total_size_bytes) }}</p>
            </div>
          </div>
          <button @click="fetchData" :disabled="loading" class="adp-btn adp-btn--ghost" title="Refresh">
            <svg :class="{ 'adp-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Collections Grid -->
      <div class="adp-body">
        <div v-if="loading && !collections.length" class="adp-empty">
          <div class="adp-empty__spinner"></div>
          <p>Loading collections...</p>
        </div>

        <div v-else-if="!collections.length" class="adp-empty">
          <div class="adp-empty__icon">
            <svg viewBox="0 0 64 64" fill="none">
              <rect x="8" y="20" width="48" height="8" rx="2" fill="#e0e7ff" stroke="#818cf8" stroke-width="1.5"/>
              <rect x="8" y="32" width="48" height="8" rx="2" fill="#ede9fe" stroke="#a78bfa" stroke-width="1.5"/>
              <rect x="8" y="44" width="48" height="8" rx="2" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="1.5"/>
              <circle cx="48" cy="16" r="10" fill="#dbeafe" stroke="#60a5fa" stroke-width="1.5"/>
              <path d="M45 16h6M48 13v6" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <h3>No Collections Yet</h3>
          <p>When this agent stores data via <code>STORE_AGENT_DATA</code>, collections appear here as browsable tables.</p>
        </div>

        <div v-else class="adp-grid">
          <div v-for="c in collections" :key="c.id" @click="openCollection(c)" class="adp-card" :data-type="c.data_type">
            <div class="adp-card__header">
              <div class="adp-card__type" :data-type="c.data_type">{{ typeIcon(c.data_type) }}</div>
              <div class="adp-card__badges">
                <span v-if="c.is_stale" class="adp-badge adp-badge--warn">stale</span>
                <span v-if="c.scope === 'workspace'" class="adp-badge adp-badge--purple">shared</span>
                <span v-if="c.has_cursor" class="adp-badge adp-badge--blue adp-pulse">cursor</span>
              </div>
            </div>
            <h3 class="adp-card__name">{{ c.collection_name }}</h3>
            <p v-if="c.description" class="adp-card__desc">{{ c.description }}</p>
            <p v-else-if="c.summary" class="adp-card__desc">{{ c.summary }}</p>
            <div class="adp-card__meta">
              <span>{{ c.entry_count }} records</span>
              <span class="adp-card__dot">·</span>
              <span>{{ formatBytes(c.size_bytes) }}</span>
              <span class="adp-card__dot">·</span>
              <span>{{ timeAgo(c.updated_at) }}</span>
            </div>
            <div v-if="c.source_tool" class="adp-card__source">
              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.433 2.304A4.49 4.49 0 008 3.5c1.06 0 2.04-.37 2.81-1 .66-.53 1.72-.53 2.38 0 .66.54.72 1.51.15 2.12A4.49 4.49 0 0012.5 8c0 1.06.37 2.04 1 2.81.53.66.53 1.72 0 2.38-.54.66-1.51.72-2.12.15A4.49 4.49 0 008 12.5a4.49 4.49 0 00-3.38.84c-.61.57-1.58.51-2.12-.15-.54-.66-.53-1.72 0-2.38A4.49 4.49 0 003.5 8c0-1.06-.37-2.04-1-2.81-.53-.66-.53-1.72 0-2.38.54-.66 1.51-.72 2.12-.15l.82.67z"/></svg>
              {{ c.source_tool }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══ COLLECTION DETAIL VIEW ═══ -->
    <template v-else>
      <!-- Detail Header -->
      <div class="adp-detail-header">
        <div class="adp-detail-header__left">
          <button @click="goBack" class="adp-btn adp-btn--back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div class="adp-detail-header__type" :data-type="activeCollection.data_type">{{ typeIcon(activeCollection.data_type) }}</div>
          <div>
            <div class="adp-detail-header__name">
              {{ activeCollection.collection_name }}
              <span v-if="activeCollection.is_stale" class="adp-badge adp-badge--warn">stale</span>
              <span v-if="activeCollection.scope === 'workspace'" class="adp-badge adp-badge--purple">shared</span>
            </div>
            <div class="adp-detail-header__meta">
              {{ activeCollection.entry_count }} records · {{ formatBytes(activeCollection.size_bytes) }} ·
              Updated {{ timeAgo(activeCollection.updated_at) }}
              <template v-if="activeCollection.source_tool"> · via <strong>{{ activeCollection.source_tool }}</strong></template>
            </div>
          </div>
        </div>
        <div class="adp-detail-header__right">
          <div class="adp-viewswitcher">
            <button v-for="v in views" :key="v.id" @click="viewMode = v.id"
              :class="['adp-viewswitcher__btn', { active: viewMode === v.id }]" :title="v.label">
              <span v-html="v.icon"></span>
            </button>
          </div>
          <button @click="deleteCollection(activeCollection)" class="adp-btn adp-btn--danger" title="Delete collection">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>

      <!-- Summary Banner -->
      <div v-if="activeCollection.summary" class="adp-summary">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
        {{ activeCollection.summary }}
      </div>

      <!-- Toolbar -->
      <div class="adp-toolbar">
        <div class="adp-search">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
          <input v-model="searchQuery" type="text" placeholder="Filter records..." />
        </div>
        <div class="adp-toolbar__right">
          <span class="adp-toolbar__count">{{ filteredEntries.length }} of {{ detail?.pagination?.total || 0 }}</span>
          <button @click="copyJson(filteredEntries)" class="adp-btn adp-btn--ghost adp-btn--sm">
            {{ copied ? '✓ Copied' : '⎘ Copy' }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="detailLoading" class="adp-body adp-empty">
        <div class="adp-empty__spinner"></div>
        <p>Loading records...</p>
      </div>

      <!-- ──── TABLE VIEW ──── -->
      <div v-else-if="viewMode === 'table' && filteredEntries.length" class="adp-table-wrap">
        <table class="adp-table">
          <thead>
            <tr>
              <th class="adp-table__idx">#</th>
              <th v-for="col in entryColumns" :key="col">
                <div class="adp-table__colhead">
                  {{ col }}
                  <span class="adp-table__coltype">{{ colType(col) }}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, idx) in filteredEntries" :key="idx"
              @click="selectedRecord = entry; showRecordPanel = true"
              :class="{ 'adp-table__row--selected': selectedRecord === entry }">
              <td class="adp-table__idx">{{ pageOffset + idx + 1 }}</td>
              <td v-for="col in entryColumns" :key="col">
                <CellRenderer :value="entry[col]" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ──── CARDS VIEW ──── -->
      <div v-else-if="viewMode === 'cards' && filteredEntries.length" class="adp-cards-wrap">
        <div v-for="(entry, idx) in filteredEntries" :key="idx" class="adp-record"
          @click="selectedRecord = entry; showRecordPanel = true">
          <div class="adp-record__head">
            <span class="adp-record__num">#{{ pageOffset + idx + 1 }}</span>
            <span v-if="entryTitle(entry)" class="adp-record__title">{{ entryTitle(entry) }}</span>
          </div>
          <div class="adp-record__fields">
            <template v-if="typeof entry === 'object' && entry !== null">
              <div v-for="(val, key) in limitFields(entry, 6)" :key="key" class="adp-field">
                <span class="adp-field__key">{{ key }}</span>
                <CellRenderer :value="val" :expanded="false" />
              </div>
              <div v-if="Object.keys(entry).length > 6" class="adp-field adp-field--more">
                +{{ Object.keys(entry).length - 6 }} more fields
              </div>
            </template>
            <pre v-else class="adp-field__raw">{{ JSON.stringify(entry, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <!-- ──── JSON VIEW ──── -->
      <div v-else-if="viewMode === 'json' && filteredEntries.length" class="adp-json-wrap">
        <div class="adp-json">
          <div class="adp-json__header">
            <span>{{ filteredEntries.length }} records</span>
            <button @click="copyJson(filteredEntries)" class="adp-json__copy">
              {{ copied ? '✓ Copied' : '⎘ Copy' }}
            </button>
          </div>
          <pre class="adp-json__content"><template v-for="(line, i) in jsonLines" :key="i"><span class="adp-json__ln">{{ i + 1 }}</span><span v-html="line"></span>
</template></pre>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="!filteredEntries.length" class="adp-body adp-empty">
        <p v-if="searchQuery">No records match "{{ searchQuery }}"</p>
        <p v-else>This collection is empty.</p>
      </div>

      <!-- Pagination -->
      <div v-if="detail?.pagination?.total > 0" class="adp-pagination">
        <span class="adp-pagination__info">
          {{ pageOffset + 1 }}–{{ Math.min(pageOffset + pageLimit, detail.pagination.total) }}
          of {{ detail.pagination.total }}
        </span>
        <div class="adp-pagination__nav">
          <button :disabled="pageOffset <= 0" @click="loadPage(activeCollection, pageOffset - pageLimit)" class="adp-btn adp-btn--page">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          </button>
          <button :disabled="!detail.pagination.has_more" @click="loadPage(activeCollection, pageOffset + pageLimit)" class="adp-btn adp-btn--page">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </div>
    </template>

    <!-- ═══ RECORD SLIDE-OVER PANEL ═══ -->
    <transition name="adp-slideover">
      <div v-if="showRecordPanel && selectedRecord" class="adp-slideover" @click.self="showRecordPanel = false">
        <div class="adp-slideover__panel">
          <div class="adp-slideover__header">
            <h3>Record Details</h3>
            <div class="adp-slideover__actions">
              <button @click="copyJson(selectedRecord)" class="adp-btn adp-btn--ghost adp-btn--sm">
                {{ copied ? '✓' : '⎘ Copy' }}
              </button>
              <button @click="showRecordPanel = false" class="adp-slideover__close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <div class="adp-slideover__body">
            <template v-if="typeof selectedRecord === 'object' && selectedRecord !== null">
              <div v-for="(val, key) in selectedRecord" :key="key" class="adp-detail-field">
                <div class="adp-detail-field__key">
                  <span class="adp-detail-field__type">{{ inferType(val) }}</span>
                  {{ key }}
                </div>
                <div class="adp-detail-field__val">
                  <template v-if="typeof val === 'object' && val !== null">
                    <pre class="adp-detail-field__json">{{ JSON.stringify(val, null, 2) }}</pre>
                  </template>
                  <template v-else-if="isUrl(val)">
                    <a :href="val" target="_blank" rel="noopener" class="adp-link">{{ val }}</a>
                  </template>
                  <template v-else-if="typeof val === 'boolean'">
                    <span :class="['adp-bool', val ? 'adp-bool--true' : 'adp-bool--false']">{{ val }}</span>
                  </template>
                  <template v-else-if="val === null || val === undefined">
                    <span class="adp-null">null</span>
                  </template>
                  <template v-else-if="typeof val === 'number'">
                    <span class="adp-number">{{ val }}</span>
                  </template>
                  <template v-else>
                    <span class="adp-text">{{ val }}</span>
                  </template>
                </div>
              </div>
            </template>
            <pre v-else class="adp-detail-field__json">{{ JSON.stringify(selectedRecord, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, defineComponent, h } from 'vue'
import api from '../../services/api'

// ── Inline CellRenderer Component ──
const CellRenderer = defineComponent({
  props: { value: { default: null }, expanded: { type: Boolean, default: false } },
  setup(props) {
    return () => {
      const v = props.value
      if (v === null || v === undefined) return h('span', { class: 'adp-cell adp-cell--null' }, 'null')
      if (typeof v === 'boolean') return h('span', { class: `adp-cell adp-cell--bool ${v ? 'adp-cell--true' : 'adp-cell--false'}` }, v ? 'true' : 'false')
      if (typeof v === 'number') return h('span', { class: 'adp-cell adp-cell--num' }, String(v))
      if (Array.isArray(v)) {
        if (v.length === 0) return h('span', { class: 'adp-cell adp-cell--null' }, '[]')
        const items = v.slice(0, 3).map(item => h('span', { class: 'adp-tag' }, typeof item === 'object' ? '{…}' : String(item).slice(0, 20)))
        if (v.length > 3) items.push(h('span', { class: 'adp-tag adp-tag--more' }, `+${v.length - 3}`))
        return h('span', { class: 'adp-cell adp-cell--array' }, items)
      }
      if (typeof v === 'object') return h('span', { class: 'adp-cell adp-cell--obj' }, '{' + Object.keys(v).slice(0, 3).join(', ') + (Object.keys(v).length > 3 ? ', …' : '') + '}')
      const s = String(v)
      if (s.match(/^https?:\/\//)) return h('a', { class: 'adp-cell adp-cell--url', href: s, target: '_blank', onClick: e => e.stopPropagation() }, s.length > 50 ? s.slice(0, 50) + '…' : s)
      return h('span', { class: 'adp-cell', title: s.length > 60 ? s : undefined }, s.length > 60 ? s.slice(0, 60) + '…' : s)
    }
  }
})

const props = defineProps({ agentProfile: { type: Object, required: true } })

const loading = ref(false)
const detailLoading = ref(false)
const collections = ref([])
const activeCollection = ref(null)
const detail = ref(null)
const stats = ref({ total_collections: 0, total_entries: 0, total_size_bytes: 0 })
const searchQuery = ref('')
const viewMode = ref('table')
const selectedRecord = ref(null)
const showRecordPanel = ref(false)
const copied = ref(false)

const views = [
  { id: 'table', label: 'Table', icon: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm15 2H1v10a1 1 0 001 1h12a1 1 0 001-1V4zm-4 0v3h4V4h-4zM4 4v3h7V4H4zM1 4h3V1H2a1 1 0 00-1 1v2z"/></svg>' },
  { id: 'cards', label: 'Cards', icon: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>' },
  { id: 'json', label: 'JSON', icon: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 1a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V2a1 1 0 00-1-1H2zm5.854 4.146a.5.5 0 010 .708L5.207 8.5l2.647 2.646a.5.5 0 01-.708.708l-3-3a.5.5 0 010-.708l3-3a.5.5 0 01.708 0zm2.292 0a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-3 3a.5.5 0 01-.708-.708L12.793 8.5l-2.647-2.646a.5.5 0 010-.708z"/></svg>' },
]

// ── Data Fetching ──
const fetchData = async () => {
  if (!props.agentProfile?.id) return
  loading.value = true
  try {
    const { data } = await api.get(`/agents/${props.agentProfile.id}/data/`)
    collections.value = data.collections || []
    stats.value = { total_collections: data.total_collections || 0, total_entries: data.total_entries || 0, total_size_bytes: data.total_size_bytes || 0 }
  } catch (e) { console.error('Failed to load agent data:', e) }
  finally { loading.value = false }
}

const openCollection = async (c) => {
  activeCollection.value = c
  searchQuery.value = ''
  selectedRecord.value = null
  showRecordPanel.value = false
  await loadPage(c, 0)
}

const goBack = () => { activeCollection.value = null; detail.value = null }

const loadPage = async (c, offset = 0) => {
  detailLoading.value = true
  try {
    const { data } = await api.get(`/agents/${props.agentProfile.id}/data/${c.collection_name}/`, { params: { limit: 50, offset } })
    detail.value = data
    selectedRecord.value = null
    showRecordPanel.value = false
  } catch (e) { console.error('Failed to load collection:', e) }
  finally { detailLoading.value = false }
}

const deleteCollection = async (c) => {
  if (!confirm(`Permanently delete "${c.collection_name}" and all its data?`)) return
  try {
    await api.delete(`/agents/${props.agentProfile.id}/data/${c.collection_name}/`)
    collections.value = collections.value.filter(x => x.id !== c.id)
    stats.value.total_collections = Math.max(0, stats.value.total_collections - 1)
    goBack()
  } catch (e) { console.error('Delete failed:', e) }
}

// ── Computed ──
const pageOffset = computed(() => detail.value?.pagination?.offset || 0)
const pageLimit = computed(() => detail.value?.pagination?.limit || 50)

const filteredEntries = computed(() => {
  const entries = detail.value?.entries || []
  if (!searchQuery.value) return entries
  const q = searchQuery.value.toLowerCase()
  return entries.filter(e => JSON.stringify(e).toLowerCase().includes(q))
})

const entryColumns = computed(() => {
  const entries = detail.value?.entries || []
  if (!entries.length) return []
  const freq = {}
  entries.slice(0, 50).forEach(e => { if (typeof e === 'object' && e) Object.keys(e).forEach(k => { freq[k] = (freq[k] || 0) + 1 }) })
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0])
})

const jsonLines = computed(() => {
  const raw = JSON.stringify(filteredEntries.value, null, 2)
  return raw.split('\n').map(line => syntaxHighlight(line))
})

// ── Helpers ──
const typeIcon = t => ({ snapshot: '📸', collection: '📦', timeseries: '📈', memo: '📝', cursor: '⏳' }[t] || '📁')
const formatBytes = b => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB' }
const timeAgo = iso => { if (!iso) return ''; const d = (new Date() - new Date(iso)) / 1000; if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + 'm ago'; if (d < 86400) return Math.floor(d / 3600) + 'h ago'; return Math.floor(d / 86400) + 'd ago' }
const isUrl = v => typeof v === 'string' && /^https?:\/\//.test(v)
const inferType = v => { if (v === null) return 'null'; if (Array.isArray(v)) return '[]'; const t = typeof v; return { string: 'abc', number: '123', boolean: 'T/F', object: '{ }' }[t] || t }

const colType = col => {
  const entries = detail.value?.entries || []
  for (const e of entries.slice(0, 10)) { if (e && e[col] !== undefined && e[col] !== null) return inferType(e[col]) }
  return '—'
}

const entryTitle = entry => {
  if (typeof entry !== 'object' || !entry) return null
  return entry.name || entry.title || entry.id || entry.key || entry.label || null
}

const limitFields = (obj, n) => {
  const keys = Object.keys(obj).slice(0, n)
  const result = {}
  keys.forEach(k => { result[k] = obj[k] })
  return result
}

const syntaxHighlight = line => {
  return line
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span class="adp-json--key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="adp-json--str">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="adp-json--num">$1</span>')
    .replace(/: (true|false)/g, ': <span class="adp-json--bool">$1</span>')
    .replace(/: (null)/g, ': <span class="adp-json--null">$1</span>')
}

const copyJson = async data => {
  try { await navigator.clipboard.writeText(JSON.stringify(data, null, 2)); copied.value = true; setTimeout(() => { copied.value = false }, 1500) } catch {}
}

onMounted(fetchData)
watch(() => props.agentProfile?.id, fetchData)
</script>

<style scoped>
/* ═══ Design Tokens ═══ */
.adp {
  --adp-bg: #f8fafc;
  --adp-surface: #ffffff;
  --adp-border: #e2e8f0;
  --adp-border-hover: #cbd5e1;
  --adp-text: #0f172a;
  --adp-text-secondary: #64748b;
  --adp-text-muted: #94a3b8;
  --adp-accent: #6366f1;
  --adp-accent-light: #eef2ff;
  --adp-accent-hover: #4f46e5;
  --adp-radius: 12px;
  --adp-radius-sm: 8px;
  --adp-radius-xs: 6px;
  background: var(--adp-bg); font-family: 'Inter', -apple-system, sans-serif;
}

/* ═══ Hero Header ═══ */
.adp-hero { background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 50%, #dbeafe 100%); border-bottom: 1px solid var(--adp-border); }
.adp-hero__inner { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; }
.adp-hero__left { display: flex; align-items: center; gap: 14px; }
.adp-hero__icon { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, var(--adp-accent), #818cf8); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
.adp-hero__icon svg { width: 24px; height: 24px; color: white; }
.adp-hero__title { font-size: 18px; font-weight: 800; color: var(--adp-text); letter-spacing: -0.02em; }
.adp-hero__sub { font-size: 12px; color: var(--adp-text-secondary); margin-top: 2px; }

/* ═══ Buttons ═══ */
.adp-btn { display: inline-flex; align-items: center; gap: 6px; border: none; cursor: pointer; border-radius: var(--adp-radius-xs); font-size: 12px; font-weight: 600; transition: all 0.15s ease; }
.adp-btn svg { width: 16px; height: 16px; }
.adp-btn--ghost { padding: 8px; background: transparent; color: var(--adp-text-secondary); }
.adp-btn--ghost:hover { background: rgba(0,0,0,0.05); color: var(--adp-text); }
.adp-btn--sm { padding: 4px 10px; font-size: 11px; }
.adp-btn--back { padding: 6px; background: var(--adp-surface); border: 1px solid var(--adp-border); color: var(--adp-text-secondary); }
.adp-btn--back:hover { border-color: var(--adp-accent); color: var(--adp-accent); }
.adp-btn--back svg { width: 14px; height: 14px; }
.adp-btn--danger { padding: 6px; background: transparent; color: #ef4444; border: 1px solid transparent; }
.adp-btn--danger:hover { background: #fef2f2; border-color: #fecaca; }
.adp-btn--page { padding: 6px; background: var(--adp-surface); border: 1px solid var(--adp-border); color: var(--adp-text-secondary); }
.adp-btn--page:hover:not(:disabled) { border-color: var(--adp-accent); color: var(--adp-accent); }
.adp-btn--page:disabled { opacity: 0.3; cursor: default; }
.adp-btn--page svg { width: 14px; height: 14px; }

/* ═══ Badges ═══ */
.adp-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
.adp-badge--warn { background: #fef3c7; color: #92400e; }
.adp-badge--purple { background: #f3e8ff; color: #7c3aed; }
.adp-badge--blue { background: #dbeafe; color: #1d4ed8; }
.adp-pulse { animation: adpPulse 2s ease-in-out infinite; }
@keyframes adpPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* ═══ Body / Empty ═══ */
.adp-body { flex: 1; overflow-y: auto; padding: 24px; }
.adp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 48px 24px; color: var(--adp-text-muted); text-align: center; flex: 1; }
.adp-empty h3 { font-size: 16px; font-weight: 700; color: var(--adp-text-secondary); margin: 0; }
.adp-empty p { font-size: 13px; max-width: 360px; line-height: 1.6; margin: 0; }
.adp-empty code { font-size: 11px; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-family: 'JetBrains Mono', 'Fira Code', monospace; }
.adp-empty__icon { width: 80px; height: 80px; }
.adp-empty__icon svg { width: 100%; height: 100%; }
.adp-empty__spinner { width: 32px; height: 32px; border: 3px solid var(--adp-border); border-top-color: var(--adp-accent); border-radius: 50%; animation: adpSpin 0.7s linear infinite; }
@keyframes adpSpin { to { transform: rotate(360deg); } }
.adp-spin { animation: adpSpin 0.7s linear infinite; }

/* ═══ Collection Grid ═══ */
.adp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.adp-card { background: var(--adp-surface); border: 1px solid var(--adp-border); border-radius: var(--adp-radius); padding: 20px; cursor: pointer; transition: all 0.2s ease; position: relative; overflow: hidden; }
.adp-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--adp-accent), #818cf8); opacity: 0; transition: opacity 0.2s; }
.adp-card:hover { border-color: var(--adp-accent); box-shadow: 0 4px 16px rgba(99, 102, 241, 0.1); transform: translateY(-1px); }
.adp-card:hover::before { opacity: 1; }
.adp-card__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.adp-card__type { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.adp-card__type[data-type="snapshot"] { background: #dbeafe; }
.adp-card__type[data-type="collection"] { background: #d1fae5; }
.adp-card__type[data-type="timeseries"] { background: #fef3c7; }
.adp-card__type[data-type="memo"] { background: #f3e8ff; }
.adp-card__type[data-type="cursor"] { background: #f1f5f9; }
.adp-card__badges { display: flex; gap: 4px; }
.adp-card__name { font-size: 15px; font-weight: 700; color: var(--adp-text); margin: 0 0 6px; letter-spacing: -0.01em; }
.adp-card__desc { font-size: 12px; color: var(--adp-text-muted); margin: 0 0 12px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.adp-card__meta { font-size: 11px; color: var(--adp-text-muted); display: flex; align-items: center; gap: 4px; }
.adp-card__dot { opacity: 0.4; }
.adp-card__source { margin-top: 10px; font-size: 11px; color: var(--adp-accent); display: flex; align-items: center; gap: 4px; }
.adp-card__source svg { width: 12px; height: 12px; }

/* ═══ Detail Header ═══ */
.adp-detail-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: var(--adp-surface); border-bottom: 1px solid var(--adp-border); gap: 12px; }
.adp-detail-header__left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.adp-detail-header__type { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.adp-detail-header__type[data-type="snapshot"] { background: #dbeafe; }
.adp-detail-header__type[data-type="collection"] { background: #d1fae5; }
.adp-detail-header__type[data-type="timeseries"] { background: #fef3c7; }
.adp-detail-header__type[data-type="memo"] { background: #f3e8ff; }
.adp-detail-header__name { font-size: 15px; font-weight: 700; color: var(--adp-text); display: flex; align-items: center; gap: 6px; letter-spacing: -0.01em; }
.adp-detail-header__meta { font-size: 11px; color: var(--adp-text-muted); margin-top: 2px; }
.adp-detail-header__meta strong { color: var(--adp-accent); font-weight: 600; }
.adp-detail-header__right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* ═══ View Switcher ═══ */
.adp-viewswitcher { display: flex; border: 1px solid var(--adp-border); border-radius: var(--adp-radius-xs); overflow: hidden; }
.adp-viewswitcher__btn { padding: 6px 10px; background: var(--adp-surface); border: none; cursor: pointer; color: var(--adp-text-muted); transition: all 0.15s; display: flex; align-items: center; }
.adp-viewswitcher__btn + .adp-viewswitcher__btn { border-left: 1px solid var(--adp-border); }
.adp-viewswitcher__btn:hover { color: var(--adp-text-secondary); background: #f8fafc; }
.adp-viewswitcher__btn.active { background: var(--adp-accent); color: white; }
.adp-viewswitcher__btn svg, .adp-viewswitcher__btn :deep(svg) { width: 14px; height: 14px; }

/* ═══ Summary Banner ═══ */
.adp-summary { display: flex; align-items: flex-start; gap: 8px; padding: 10px 20px; background: #eff6ff; border-bottom: 1px solid #bfdbfe; font-size: 12px; color: #1e40af; line-height: 1.5; }
.adp-summary svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; color: #3b82f6; }

/* ═══ Toolbar ═══ */
.adp-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background: var(--adp-surface); border-bottom: 1px solid var(--adp-border); gap: 12px; }
.adp-search { position: relative; flex: 1; max-width: 320px; }
.adp-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: var(--adp-text-muted); }
.adp-search input { width: 100%; padding: 7px 12px 7px 32px; border: 1px solid var(--adp-border); border-radius: var(--adp-radius-xs); font-size: 12px; background: var(--adp-bg); color: var(--adp-text); outline: none; transition: border-color 0.15s; }
.adp-search input:focus { border-color: var(--adp-accent); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
.adp-search input::placeholder { color: var(--adp-text-muted); }
.adp-toolbar__right { display: flex; align-items: center; gap: 8px; }
.adp-toolbar__count { font-size: 11px; color: var(--adp-text-muted); }

/* ═══ Table ═══ */
.adp-table-wrap { flex: 1; overflow: auto; }
.adp-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.adp-table thead { position: sticky; top: 0; z-index: 5; }
.adp-table th { padding: 10px 16px; background: #f8fafc; border-bottom: 2px solid var(--adp-border); text-align: left; white-space: nowrap; font-weight: 600; color: var(--adp-text-secondary); font-size: 11px; }
.adp-table__colhead { display: flex; align-items: center; gap: 6px; }
.adp-table__coltype { font-size: 9px; font-weight: 500; color: var(--adp-text-muted); background: #f1f5f9; padding: 1px 5px; border-radius: 3px; }
.adp-table__idx { color: var(--adp-text-muted) !important; font-variant-numeric: tabular-nums; width: 48px; min-width: 48px; font-size: 11px; }
.adp-table td { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; max-width: 280px; vertical-align: top; }
.adp-table tbody tr { cursor: pointer; transition: background 0.1s; }
.adp-table tbody tr:hover { background: var(--adp-accent-light); }
.adp-table__row--selected { background: #eef2ff !important; }

/* ═══ Cell Renderers ═══ */
.adp-cell { font-size: 12px; line-height: 1.5; }
.adp-cell--null { color: var(--adp-text-muted); font-style: italic; font-size: 11px; }
.adp-cell--bool { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 3px; }
.adp-cell--true { background: #d1fae5; color: #065f46; }
.adp-cell--false { background: #fee2e2; color: #991b1b; }
.adp-cell--num { font-family: 'JetBrains Mono', monospace; color: #6366f1; font-weight: 500; }
.adp-cell--obj { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--adp-text-muted); }
.adp-cell--url { color: #2563eb; text-decoration: none; font-size: 11px; }
.adp-cell--url:hover { text-decoration: underline; }
.adp-cell--array { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.adp-tag { font-size: 10px; padding: 1px 7px; border-radius: 20px; background: #f1f5f9; color: var(--adp-text-secondary); font-weight: 500; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
.adp-tag--more { background: var(--adp-accent-light); color: var(--adp-accent); }

/* ═══ Cards View ═══ */
.adp-cards-wrap { flex: 1; overflow-y: auto; padding: 16px 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 10px; align-content: start; }
.adp-record { background: var(--adp-surface); border: 1px solid var(--adp-border); border-radius: var(--adp-radius-sm); overflow: hidden; cursor: pointer; transition: all 0.15s; }
.adp-record:hover { border-color: var(--adp-accent); box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08); }
.adp-record__head { padding: 8px 14px; background: #fafbfc; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 8px; }
.adp-record__num { font-size: 10px; font-weight: 700; color: var(--adp-text-muted); font-variant-numeric: tabular-nums; }
.adp-record__title { font-size: 12px; font-weight: 600; color: var(--adp-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.adp-record__fields { padding: 10px 14px; }
.adp-field { display: flex; align-items: flex-start; gap: 10px; padding: 4px 0; border-bottom: 1px solid #f8fafc; }
.adp-field:last-child { border-bottom: none; }
.adp-field__key { font-size: 11px; font-weight: 600; color: var(--adp-text-muted); min-width: 90px; max-width: 120px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-top: 1px; }
.adp-field--more { font-size: 11px; color: var(--adp-accent); font-weight: 500; padding: 6px 0 2px; border: none; display: block; }
.adp-field__raw { font-size: 11px; font-family: 'JetBrains Mono', monospace; margin: 0; white-space: pre-wrap; word-break: break-word; color: var(--adp-text-secondary); }

/* ═══ JSON View ═══ */
.adp-json-wrap { flex: 1; overflow: auto; }
.adp-json { background: #0f172a; color: #e2e8f0; min-height: 100%; }
.adp-json__header { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; border-bottom: 1px solid #1e293b; position: sticky; top: 0; background: #0f172a; z-index: 5; }
.adp-json__header span { font-size: 11px; color: #64748b; }
.adp-json__copy { font-size: 11px; color: #64748b; background: transparent; border: 1px solid #334155; padding: 3px 10px; border-radius: 4px; cursor: pointer; transition: all 0.15s; }
.adp-json__copy:hover { color: #e2e8f0; border-color: #475569; }
.adp-json__content { padding: 16px 20px; margin: 0; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.7; tab-size: 2; }
.adp-json__ln { display: inline-block; width: 40px; text-align: right; margin-right: 16px; color: #334155; user-select: none; font-size: 10px; }
:deep(.adp-json--key) { color: #7dd3fc; }
:deep(.adp-json--str) { color: #86efac; }
:deep(.adp-json--num) { color: #c4b5fd; }
:deep(.adp-json--bool) { color: #fdba74; }
:deep(.adp-json--null) { color: #f87171; font-style: italic; }

/* ═══ Pagination ═══ */
.adp-pagination { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background: var(--adp-surface); border-top: 1px solid var(--adp-border); flex-shrink: 0; }
.adp-pagination__info { font-size: 11px; color: var(--adp-text-muted); font-variant-numeric: tabular-nums; }
.adp-pagination__nav { display: flex; gap: 4px; }

/* ═══ Slide-over Record Panel ═══ */
.adp-slideover { position: absolute; inset: 0; z-index: 50; display: flex; justify-content: flex-end; background: rgba(15, 23, 42, 0.3); backdrop-filter: blur(2px); }
.adp-slideover__panel { width: min(480px, 90%); background: var(--adp-surface); border-left: 1px solid var(--adp-border); display: flex; flex-direction: column; box-shadow: -8px 0 24px rgba(0, 0, 0, 0.08); }
.adp-slideover__header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--adp-border); }
.adp-slideover__header h3 { font-size: 14px; font-weight: 700; color: var(--adp-text); margin: 0; }
.adp-slideover__actions { display: flex; align-items: center; gap: 6px; }
.adp-slideover__close { padding: 4px; background: transparent; border: none; color: var(--adp-text-muted); cursor: pointer; border-radius: 4px; }
.adp-slideover__close:hover { background: #f1f5f9; color: var(--adp-text); }
.adp-slideover__close svg { width: 18px; height: 18px; }
.adp-slideover__body { flex: 1; overflow-y: auto; padding: 16px 20px; }

/* ═══ Detail Fields (Slide-over) ═══ */
.adp-detail-field { padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
.adp-detail-field:last-child { border-bottom: none; }
.adp-detail-field__key { font-size: 11px; font-weight: 600; color: var(--adp-text-muted); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.03em; }
.adp-detail-field__type { font-size: 9px; font-weight: 500; color: var(--adp-accent); background: var(--adp-accent-light); padding: 1px 5px; border-radius: 3px; text-transform: none; letter-spacing: 0; }
.adp-detail-field__val { font-size: 13px; color: var(--adp-text); line-height: 1.6; word-break: break-word; }
.adp-detail-field__json { font-size: 11px; font-family: 'JetBrains Mono', monospace; background: #f8fafc; border: 1px solid var(--adp-border); border-radius: var(--adp-radius-xs); padding: 10px 14px; margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; line-height: 1.6; color: var(--adp-text-secondary); }
.adp-link { color: #2563eb; text-decoration: none; }
.adp-link:hover { text-decoration: underline; }
.adp-bool { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
.adp-bool--true { background: #d1fae5; color: #065f46; }
.adp-bool--false { background: #fee2e2; color: #991b1b; }
.adp-null { color: var(--adp-text-muted); font-style: italic; }
.adp-number { font-family: 'JetBrains Mono', monospace; color: var(--adp-accent); font-weight: 500; }
.adp-text { white-space: pre-wrap; }

/* ═══ Transitions ═══ */
.adp-slideover-enter-active { transition: all 0.25s ease; }
.adp-slideover-leave-active { transition: all 0.2s ease; }
.adp-slideover-enter-from, .adp-slideover-leave-to { opacity: 0; }
.adp-slideover-enter-from .adp-slideover__panel { transform: translateX(100%); }
.adp-slideover-leave-to .adp-slideover__panel { transform: translateX(100%); }
.adp-slideover-enter-to .adp-slideover__panel { transform: translateX(0); }
</style>
