<template>
  <main class="apiref-page">
    <section class="apiref-main">
      <RouterLink to="/dashboard/help-center/documentation" class="back-link">
        <Icon icon="lucide:arrow-left" /> Documentation
      </RouterLink>

      <header class="apiref-head">
        <div>
          <h1>API Reference</h1>
          <p>Stable, developer-facing endpoints. Curated — internal and admin routes are not listed.</p>
        </div>
        <div class="search">
          <Icon icon="lucide:search" />
          <input v-model="query" type="search" placeholder="Filter endpoints…" />
        </div>
      </header>

      <div v-if="loading" class="empty">Loading reference…</div>
      <div v-else-if="!filteredGroups.length" class="empty">
        <Icon icon="lucide:plug" />
        <p>No documented endpoints match.</p>
      </div>

      <section v-for="group in filteredGroups" :key="group.name" class="api-group">
        <h2>{{ group.name }}</h2>
        <article v-for="ep in group.endpoints" :key="ep.method + ep.path" class="endpoint">
          <button class="ep-head" @click="toggle(ep)">
            <span :class="['method', ep.method.toLowerCase()]">{{ ep.method }}</span>
            <code class="path">{{ ep.path }}</code>
            <span :class="['badge', 'stab-' + ep.stability]">{{ ep.stability }}</span>
            <span class="badge auth" v-if="ep.auth_required"><Icon icon="lucide:lock" /> auth</span>
            <span class="badge auth open" v-else><Icon icon="lucide:globe" /> public</span>
            <Icon class="chev" :icon="isOpen(ep) ? 'lucide:chevron-down' : 'lucide:chevron-right'" />
          </button>

          <p class="ep-summary">{{ ep.summary }}</p>

          <div v-if="isOpen(ep)" class="ep-detail">
            <p v-if="ep.description" class="ep-desc">{{ ep.description }}</p>

            <div v-if="ep.parameters && ep.parameters.length" class="block">
              <h3>Parameters</h3>
              <ul class="params">
                <li v-for="p in ep.parameters" :key="p.name">
                  <code>{{ p.name }}</code>
                  <span class="pin">{{ p.in }}</span>
                  <span v-if="p.required" class="req">required</span>
                  <span class="pdesc">{{ p.description }}</span>
                </li>
              </ul>
            </div>

            <div v-if="ep.request_example" class="block">
              <h3>Request body</h3>
              <pre><code>{{ pretty(ep.request_example) }}</code></pre>
            </div>

            <div v-if="ep.response_example" class="block">
              <h3>Response</h3>
              <pre><code>{{ pretty(ep.response_example) }}</code></pre>
            </div>

            <div v-if="ep.responses && ep.responses.length" class="block">
              <h3>Status codes</h3>
              <span v-for="code in ep.responses" :key="code" class="status-code">{{ code }}</span>
            </div>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'

const groups = ref([])
const loading = ref(true)
const query = ref('')
const open = ref(new Set())

function key(ep) { return ep.method + ' ' + ep.path }
function isOpen(ep) { return open.value.has(key(ep)) }
function toggle(ep) {
  const k = key(ep)
  const s = new Set(open.value)
  s.has(k) ? s.delete(k) : s.add(k)
  open.value = s
}
function pretty(v) {
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

const filteredGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value
    .map(g => ({ ...g, endpoints: g.endpoints.filter(e => `${e.method} ${e.path} ${e.summary}`.toLowerCase().includes(q)) }))
    .filter(g => g.endpoints.length)
})

onMounted(async () => {
  try {
    const { data } = await api.getApiReference()
    groups.value = data?.groups || []
  } catch (e) { /* empty state */ }
  loading.value = false
})
</script>

<style scoped>
.apiref-page { min-height: 100%; padding: 30px 34px 56px; background: #f8fbff; color: #0f172a; }
.apiref-main { max-width: 960px; margin: 0 auto; }
.back-link { display: inline-flex; align-items: center; gap: 6px; color: #2563eb; font-size: 12.5px; font-weight: 800; text-decoration: none; margin-bottom: 16px; }
.back-link svg { width: 15px; height: 15px; }
.apiref-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 24px; }
.apiref-head h1 { margin: 0; font-size: 24px; font-weight: 850; }
.apiref-head p { margin: 7px 0 0; color: #64748b; font-size: 13px; max-width: 520px; }
.search { display: flex; align-items: center; gap: 10px; height: 40px; border: 1px solid #d8e2f0; border-radius: 10px; background: #fff; padding: 0 14px; min-width: 260px; }
.search svg { width: 16px; height: 16px; color: #94a3b8; }
.search input { border: 0; outline: 0; flex: 1; font-size: 13px; background: transparent; }
.api-group { margin-bottom: 28px; }
.api-group > h2 { margin: 0 0 12px; font-size: 14px; font-weight: 850; color: #334155; text-transform: uppercase; letter-spacing: .04em; }
.endpoint { border: 1px solid #dfe7f2; border-radius: 11px; background: #fff; padding: 14px 16px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(15, 23, 42, .03); }
.ep-head { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; cursor: pointer; padding: 0; text-align: left; }
.method { display: inline-grid; place-items: center; min-width: 52px; height: 24px; border-radius: 6px; font-size: 11px; font-weight: 850; padding: 0 8px; }
.method.get { background: #dcfce7; color: #16a34a; }
.method.post { background: #eaf1ff; color: #2563eb; }
.method.put, .method.patch { background: #fff5d9; color: #b7791f; }
.method.delete { background: #fee2e2; color: #dc2626; }
.path { flex: 1; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: #0f172a; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; padding: 3px 8px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; }
.badge svg { width: 11px; height: 11px; }
.stab-stable { background: #dff8ef; color: #059669; }
.stab-beta { background: #eef4ff; color: #2563eb; }
.stab-deprecated { background: #fff1f3; color: #e11d48; }
.auth { background: #f1f5f9; color: #475569; }
.auth.open { background: #ecfeff; color: #0891b2; }
.chev { width: 16px; height: 16px; color: #94a3b8; }
.ep-summary { margin: 10px 0 0; color: #64748b; font-size: 12.5px; }
.ep-detail { margin-top: 14px; border-top: 1px solid #eef2f7; padding-top: 14px; }
.ep-desc { margin: 0 0 12px; color: #334155; font-size: 13px; line-height: 1.55; }
.block { margin-top: 14px; }
.block h3 { margin: 0 0 8px; font-size: 11.5px; font-weight: 850; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
.params { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
.params li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12.5px; }
.params code { background: #f1f5f9; padding: 2px 7px; border-radius: 5px; font-size: 12px; font-weight: 700; }
.pin { color: #94a3b8; font-size: 11px; }
.req { color: #dc2626; font-size: 10.5px; font-weight: 800; }
.pdesc { color: #64748b; }
pre { margin: 0; background: #0f172a; color: #e2e8f0; border-radius: 9px; padding: 14px 16px; overflow: auto; font-size: 12px; line-height: 1.6; }
.status-code { display: inline-block; margin-right: 6px; border-radius: 6px; background: #f1f5f9; padding: 3px 9px; font-size: 11.5px; font-weight: 800; color: #334155; }
.empty { display: grid; place-items: center; gap: 10px; padding: 50px 0; color: #64748b; font-size: 13px; }
.empty svg { width: 32px; height: 32px; color: #cbd5e1; }
@media (max-width: 680px) {
  .apiref-page { padding: 22px 16px 56px; }
  .apiref-head { flex-direction: column; }
  .search { width: 100%; }
}
</style>
