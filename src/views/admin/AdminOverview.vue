<template>
  <div class="ov">
    <header class="ov-head">
      <h1>Admin Dashboard</h1>
      <p>Platform overview, analytics, knowledge data, and configuration — all admin tools in one place.</p>
    </header>

    <!-- Stat cards -->
    <div class="ov-stats">
      <div class="ov-stat" v-for="s in stats" :key="s.label">
        <div class="ov-stat-ico">{{ s.icon }}</div>
        <div>
          <div class="ov-stat-val">{{ s.value }}</div>
          <div class="ov-stat-label">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <!-- Section cards -->
    <h2 class="ov-h2">Sections</h2>
    <div class="ov-grid">
      <component :is="card.external ? 'a' : 'router-link'" v-for="card in sections" :key="card.title"
                 v-bind="card.external ? { href: card.to, target: '_blank', rel: 'noopener' } : { to: card.to }"
                 class="ov-card">
        <div class="ov-card-ico">{{ card.icon }}</div>
        <div class="ov-card-title">{{ card.title }} <span v-if="card.external" class="ov-ext">↗</span></div>
        <div class="ov-card-desc">{{ card.desc }}</div>
      </component>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../../services/api'

const stats = ref([
  { icon: '💰', value: '—', label: 'Total Cost (30d)' },
  { icon: '📊', value: '—', label: 'LLM Requests' },
  { icon: '⚡', value: '—', label: 'Avg Latency' },
  { icon: '👥', value: '—', label: 'Active Users' },
])

const djangoBase = (() => {
  const { protocol, hostname, port } = window.location
  return port === '5173' ? `${protocol}//${hostname}:8000` : ''
})()

const sections = [
  { title: 'Platform & Users', to: '/admin-dashboard/platform', icon: '📈',
    desc: 'Cost analytics, login/security stats, web traffic, and the user table.' },
  { title: 'Knowledge & Crawl', to: '/admin-dashboard/knowledge', icon: '🌐',
    desc: 'Crawled websites, pages, chunks, embeddings, and crawl-run history.' },
  { title: 'Model Pricing', to: '/admin-dashboard/model-pricing', icon: '💲',
    desc: 'Per-model token pricing used for cost metering.' },
  { title: 'LLM Context', to: '/admin-dashboard/llm-context', icon: '🧠',
    desc: 'Inspect how prompts/context are assembled per turn.' },
  { title: 'Django Admin', to: `${djangoBase}/admin/`, icon: '🗄', external: true,
    desc: 'Raw database tables (users, orgs, web sources, chunks, runs).' },
]

onMounted(async () => {
  try {
    const { data } = await api.get('/admin/costs/', { params: { days: 30 } })
    stats.value = [
      { icon: '💰', value: `$${(data.totals?.cost_usd ?? 0).toFixed(2)}`, label: 'Total Cost (30d)' },
      { icon: '📊', value: (data.totals?.request_count ?? 0).toLocaleString(), label: 'LLM Requests' },
      { icon: '⚡', value: `${data.totals?.avg_latency_ms ?? 0}ms`, label: 'Avg Latency' },
      { icon: '👥', value: data.top_users?.length ?? 0, label: 'Active Users' },
    ]
  } catch { /* stats stay as placeholders */ }
})
</script>

<style scoped>
.ov { padding: 32px 36px; max-width: 1100px; }
.ov-head h1 { font-size: 24px; font-weight: 800; color: #0f172a; }
.ov-head p { color: #64748b; margin-top: 6px; font-size: 14px; }
.ov-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin: 24px 0 8px; }
.ov-stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; display: flex; align-items: center; gap: 14px; }
.ov-stat-ico { font-size: 26px; }
.ov-stat-val { font-size: 22px; font-weight: 800; color: #0f172a; }
.ov-stat-label { font-size: 12px; color: #64748b; margin-top: 2px; }
.ov-h2 { font-size: 14px; font-weight: 700; color: #334155; margin: 28px 0 12px; text-transform: uppercase; letter-spacing: .03em; }
.ov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.ov-card { display: block; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; text-decoration: none; transition: all .15s; }
.ov-card:hover { border-color: #4f46e5; box-shadow: 0 4px 16px rgba(79,70,229,.1); transform: translateY(-1px); }
.ov-card-ico { font-size: 26px; }
.ov-card-title { font-weight: 700; color: #0f172a; margin-top: 10px; font-size: 15px; }
.ov-ext { color: #94a3b8; font-size: 12px; }
.ov-card-desc { color: #64748b; font-size: 13px; margin-top: 4px; line-height: 1.45; }
</style>
