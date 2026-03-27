<template>
  <div class="admin-panel">
    <div class="admin-header">
      <h1 class="gradient-text">Admin Dashboard</h1>
      <p class="subtitle">Platform overview, user analytics, and security monitoring</p>
    </div>

    <div v-if="!isStaff" class="access-denied">
      <div class="denied-card">
        <span class="denied-icon">🔒</span>
        <h2>Access Restricted</h2>
        <p>This page is only available to administrators.</p>
      </div>
    </div>

    <div v-else class="admin-grid">
      <!-- Quick Stats -->
      <div class="stats-row">
        <div class="stat-card" v-for="stat in stats" :key="stat.label">
          <div class="stat-icon">{{ stat.icon }}</div>
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>

      <!-- Cost Analytics -->
      <div class="panel">
        <h2>Cost Analytics <span class="badge-period">Last {{ costDays }} days</span></h2>
        <div v-if="costLoading" class="panel-loading">Loading...</div>
        <div v-else-if="costs" class="cost-grid">
          <div class="cost-item">
            <span class="cost-label">Total Cost</span>
            <span class="cost-value">${{ costs.totals?.cost_usd?.toFixed(2) || '0.00' }}</span>
          </div>
          <div class="cost-item">
            <span class="cost-label">Requests</span>
            <span class="cost-value">{{ costs.totals?.request_count?.toLocaleString() || 0 }}</span>
          </div>
          <div class="cost-item">
            <span class="cost-label">Avg Latency</span>
            <span class="cost-value">{{ costs.totals?.avg_latency_ms || 0 }}ms</span>
          </div>
          <div class="cost-breakdown" v-if="costs.by_source?.length">
            <h3>By Source</h3>
            <div class="breakdown-row" v-for="s in costs.by_source" :key="s.source">
              <span class="breakdown-label">{{ s.source || 'unknown' }}</span>
              <span class="breakdown-value">${{ s.cost_usd?.toFixed(2) }} ({{ s.count }})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Security Overview -->
      <div class="panel">
        <h2>Security <span class="badge-period">Last 7 days</span></h2>
        <div v-if="securityLoading" class="panel-loading">Loading...</div>
        <div v-else-if="security" class="security-grid">
          <div class="stat-mini">
            <span class="stat-mini-value success">{{ security.login_stats?.successful || 0 }}</span>
            <span class="stat-mini-label">Successful Logins</span>
          </div>
          <div class="stat-mini">
            <span class="stat-mini-value danger">{{ security.login_stats?.failed || 0 }}</span>
            <span class="stat-mini-label">Failed Logins</span>
          </div>
          <div v-if="security.suspicious_ips?.length" class="alert-box">
            <strong>⚠️ Suspicious IPs</strong>
            <div v-for="ip in security.suspicious_ips" :key="ip.ip_address" class="alert-item">
              {{ ip.ip_address }} — {{ ip.count }} failures
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Users -->
      <div class="panel full-width">
        <h2>Users <span class="badge-count">{{ userTotal }}</span></h2>
        <div v-if="userLoading" class="panel-loading">Loading...</div>
        <div v-else class="users-table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Agents</th>
                <th>Cost (USD)</th>
                <th>Joined</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td><strong>{{ u.username }}</strong></td>
                <td>{{ u.email }}</td>
                <td>{{ u.agent_count }}</td>
                <td>${{ u.total_cost_usd?.toFixed(2) }}</td>
                <td>{{ formatDate(u.date_joined) }}</td>
                <td>{{ u.last_login ? formatDate(u.last_login) : 'Never' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'

useMeta({ title: 'Admin — AADML' })

const isStaff = ref(false)
const stats = ref([])
const costs = ref(null)
const costDays = ref(30)
const costLoading = ref(false)
const security = ref(null)
const securityLoading = ref(false)
const users = ref([])
const userTotal = ref(0)
const userLoading = ref(false)

onMounted(async () => {
  // Check if user is staff
  try {
    const { data } = await api.get('/auth/check')
    isStaff.value = data.user?.is_staff || false
    if (!isStaff.value) return
  } catch { return }

  // Load all panels in parallel
  Promise.all([loadCosts(), loadSecurity(), loadUsers()])
})

async function loadCosts() {
  costLoading.value = true
  try {
    const { data } = await api.get('/admin/costs/', { params: { days: costDays.value } })
    costs.value = data
    stats.value = [
      { icon: '💰', value: `$${data.totals?.cost_usd?.toFixed(2) || '0'}`, label: 'Total Cost' },
      { icon: '📊', value: data.totals?.request_count?.toLocaleString() || '0', label: 'LLM Requests' },
      { icon: '⚡', value: `${data.totals?.avg_latency_ms || 0}ms`, label: 'Avg Latency' },
      { icon: '👥', value: data.top_users?.length || 0, label: 'Active Users' },
    ]
  } catch (e) { console.warn('Admin costs:', e.message) }
  costLoading.value = false
}

async function loadSecurity() {
  securityLoading.value = true
  try {
    const { data } = await api.get('/admin/security/', { params: { days: 7 } })
    security.value = data
  } catch (e) { console.warn('Admin security:', e.message) }
  securityLoading.value = false
}

async function loadUsers() {
  userLoading.value = true
  try {
    const { data } = await api.get('/admin/users/', { params: { sort: '-date', limit: 20 } })
    users.value = data.users || []
    userTotal.value = data.total || 0
  } catch (e) { console.warn('Admin users:', e.message) }
  userLoading.value = false
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.admin-panel {
  min-height: 100vh;
  background: var(--bg-body);
  color: var(--text-primary);
  padding: 2rem;
}

.admin-header {
  text-align: center;
  padding: 4rem 1rem 3rem;
}

.gradient-text {
  background: linear-gradient(135deg, #8b5cf6, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 2.5rem;
  font-weight: 800;
}

.subtitle { color: var(--text-muted); margin-top: 0.5rem; }

.access-denied {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

.denied-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 3rem;
  text-align: center;
  max-width: 400px;
}

.denied-icon { font-size: 3rem; display: block; margin-bottom: 1rem; }
.denied-card h2 { margin-bottom: 0.5rem; }
.denied-card p { color: var(--text-muted); }

.admin-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.full-width { grid-column: 1 / -1; }

.stats-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
}

.stat-icon { font-size: 1.8rem; margin-bottom: 0.5rem; }
.stat-value { font-size: 1.8rem; font-weight: 800; }
.stat-label { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem; }

.panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.5rem;
}

.panel h2 {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.badge-period, .badge-count {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.panel-loading { color: var(--text-muted); padding: 1rem; }

.cost-grid { display: flex; flex-wrap: wrap; gap: 1rem; }
.cost-item {
  flex: 1;
  min-width: 120px;
  background: rgba(139, 92, 246, 0.05);
  border-radius: 10px;
  padding: 1rem;
}
.cost-label { color: var(--text-muted); font-size: 0.8rem; display: block; }
.cost-value { font-size: 1.4rem; font-weight: 700; }

.cost-breakdown { width: 100%; margin-top: 0.5rem; }
.cost-breakdown h3 { font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-muted); }
.breakdown-row { display: flex; justify-content: space-between; padding: 0.3rem 0; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
.breakdown-label { color: var(--text-muted); }

.security-grid { display: flex; flex-wrap: wrap; gap: 1rem; }
.stat-mini { flex: 1; min-width: 120px; text-align: center; }
.stat-mini-value { font-size: 2rem; font-weight: 800; display: block; }
.stat-mini-value.success { color: #10b981; }
.stat-mini-value.danger { color: #ef4444; }
.stat-mini-label { color: var(--text-muted); font-size: 0.8rem; }

.alert-box {
  width: 100%;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  padding: 1rem;
}
.alert-item { font-size: 0.85rem; padding: 0.25rem 0; color: var(--text-muted); }

.users-table-wrap { overflow-x: auto; }
.users-table {
  width: 100%;
  border-collapse: collapse;
}
.users-table th, .users-table td {
  padding: 0.6rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
}
.users-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
}

@media (max-width: 768px) {
  .admin-grid { grid-template-columns: 1fr; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
