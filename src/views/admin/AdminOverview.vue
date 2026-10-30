<template>
  <div class="ov admin-page">
    <header class="admin-page-header"><div><div class="ov-eyebrow">PLATFORM WORKSPACE</div><h1 class="admin-page-title">Admin overview</h1><p>Platform activity and every administration tool, organized around your work.</p></div><button class="btn" type="button" :disabled="loading" @click="load"><RefreshCw :size="14" aria-hidden="true" />{{ loading ? 'Refreshing…' : 'Refresh summary' }}</button></header>
    <div v-if="error" class="ov-alert" role="alert"><AlertCircle :size="17" aria-hidden="true" /><span>{{ data ? 'Summary refresh failed. Previously loaded figures are still shown.' : 'The platform summary could not be loaded.' }}</span><button type="button" @click="load" :disabled="loading">Try again</button></div>
    <div class="admin-metrics ov-metrics" :aria-busy="loading"><article v-for="metric in metrics" :key="metric.label" class="admin-metric"><div class="ov-metric-label"><component :is="metric.icon" :size="16" aria-hidden="true" />{{ metric.label }}</div><strong class="admin-value">{{ metric.value }}</strong><small>{{ metric.note }}</small></article></div>
    <div class="ov-summary-foot"><span>Cost report · Last 30 days</span><span v-if="updatedAt">Updated {{ updatedAt }}</span></div>
    <div class="ov-directory-head"><div><h2 class="admin-section-title">Administration tools</h2><p>One workspace for platform administration.</p></div><label class="ov-search"><Search :size="15" aria-hidden="true" /><span class="admin-sr-only">Search administration tools</span><input v-model="query" type="search" placeholder="Find a tool or page…" /></label></div>
    <div v-if="!groups.length" class="admin-surface ov-empty">No tools match “{{ query }}”. <button class="btn" type="button" @click="query = ''">Clear search</button></div>
    <div class="ov-directory"><section v-for="group in groups" :key="group.key" class="ov-tool-group admin-surface"><header><span class="ov-group-mark"><component :is="groupIcons[group.key]" :size="17" aria-hidden="true" /></span><h3 class="admin-section-title">{{ group.label }}</h3><span class="ov-count">{{ group.items.length }}</span></header><RouterLink v-for="item in group.items" :key="item.key" :to="item.to" class="ov-tool"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="(d,i) in item.icon" :key="i" :d="d" /></svg><span><strong>{{ item.label }}</strong><small>{{ adminDescriptions[item.key] }}</small></span><ChevronRight :size="14" aria-hidden="true" /></RouterLink></section></div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { RefreshCw, AlertCircle, Search, ChevronRight, CircleDollarSign, Activity, Timer, Users, LayoutDashboard, Sparkles, Database, Wallet, HeartPulse } from 'lucide-vue-next'
import api from '../../services/api'
import { adminItems, adminGroups, adminDescriptions } from '../../components/admin-shell/adminNavigation'
const data = ref(null), loading = ref(false), error = ref(false), updatedAt = ref(''), query = ref('')
const groupIcons = { workspace: LayoutDashboard, intelligence: Sparkles, data: Database, finance: Wallet, operations: HeartPulse }
const groups = computed(() => adminGroups.map(group => ({ ...group, items: group.paths.map(key => adminItems.find(i => i.key === key)).filter(item => item && (!query.value.trim() || `${item.label} ${adminDescriptions[item.key]} ${group.label}`.toLowerCase().includes(query.value.trim().toLowerCase()))) })).filter(g => g.items.length))
const display = (value, format) => value == null || !Number.isFinite(Number(value)) ? '—' : format(Number(value))
const metrics = computed(() => [
  { label: 'Provider cost', icon: CircleDollarSign, value: display(data.value?.totals?.cost_usd, n => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`), note: 'Recorded in the platform cost report' },
  { label: 'LLM requests', icon: Activity, value: display(data.value?.totals?.request_count, n => n.toLocaleString()), note: 'Requests in this reporting period' },
  { label: 'Average latency', icon: Timer, value: display(data.value?.totals?.avg_latency_ms, n => `${n.toLocaleString()} ms`), note: 'Reported request latency' },
  { label: 'Users in report', icon: Users, value: data.value?.top_users ? data.value.top_users.length.toLocaleString() : '—', note: 'Users returned by the cost report' },
])
async function load() { if (loading.value) return; loading.value = true; error.value = false; try { data.value = (await api.get('/admin/costs/', { params: { days: 30 }, noCache: true })).data; updatedAt.value = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) } catch { error.value = true } finally { loading.value = false } }
onMounted(load)
</script>
<style scoped>
.ov-eyebrow { font-size:10px; font-weight:700; letter-spacing:.1em; color:var(--admin-muted,#667085); margin-bottom:5px; }
.ov-metrics { margin-bottom:0; }
.ov-metrics article { display:flex; flex-direction:column; gap:10px; }
.ov-metric-label { display:flex; align-items:center; gap:9px; font-size:11px; color:var(--admin-muted,#667085); }
.ov-metric-label svg { color:var(--admin-accent,#4f46e5); }
.ov-metrics small { font-size:10px; color:var(--admin-muted,#667085); }
.ov-summary-foot { display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; color:var(--admin-muted,#667085); font-size:10px; margin:10px 0 28px; }
.ov-directory-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; margin-bottom:16px; }
.ov-directory-head h2 { margin:0; }
.ov-directory-head p { font-size:11px; color:var(--admin-muted,#667085); margin-top:4px; }
.ov-search { width:280px; display:flex; align-items:center; gap:9px; padding:0 10px; color:var(--admin-muted,#667085); border:1px solid var(--admin-line,#e3e7ee); background:var(--admin-surface,#fff); border-radius:7px; }
.ov-search input { width:100%; border:0 !important; background:transparent; height:35px; outline:0; }
.ov-search:focus-within { outline:2px solid var(--admin-accent,#4f46e5); outline-offset:2px; }
.ov-directory { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); align-items:start; gap:16px; }
.ov-tool-group { overflow:hidden; }
.ov-tool-group>header { display:flex; align-items:center; gap:10px; padding:16px; border-bottom:1px solid var(--admin-line,#e3e7ee); }
.ov-tool-group h3 { margin:0; }
.ov-group-mark { width:30px; height:30px; display:grid; place-items:center; border-radius:8px; color:var(--admin-accent,#4f46e5); background:var(--admin-accent-soft,#eeedff); }
.ov-count { margin-left:auto; padding:2px 6px; background:var(--admin-soft,#f4f6fa); color:var(--admin-muted,#667085); border-radius:4px; font-size:10px; }
.ov-tool { display:flex; align-items:center; gap:11px; padding:13px 16px; color:var(--admin-muted,#667085); text-decoration:none; border-bottom:1px solid var(--admin-line,#e3e7ee); }
.ov-tool:last-child { border-bottom:0; }
.ov-tool:hover { background:var(--admin-soft,#f4f6fa); }
.ov-tool>svg { width:16px; height:16px; flex:none; }
.ov-tool>span { min-width:0; flex:1; }
.ov-tool strong { display:block; font-size:12px; font-weight:600; color:var(--admin-ink,#172033); }
.ov-tool small { display:block; margin-top:3px; font-size:10px; line-height:1.6; color:var(--admin-muted,#667085); }
.ov-alert { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 14px; color:var(--admin-danger,#b42318); border:1px solid #fecdca; background:#fff4f2; border-radius:8px; margin-bottom:18px; font-size:12px; }
.ov-alert button { margin-left:auto; text-decoration:underline; color:inherit; }
.ov-empty { padding:28px; text-align:center; }
@media(max-width:1200px) { .ov-directory { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:599px) { .ov-directory { grid-template-columns:1fr; } .ov-search { width:100%; } .ov-summary-foot { margin-bottom:22px; } }
</style>
