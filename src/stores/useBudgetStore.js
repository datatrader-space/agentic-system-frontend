// Pinia store — Budgets page (/dashboard/budgets).
// Loads the one-round-trip summary bundle from /api/budgets/summary/ and exposes
// CRUD actions for budgets + rules. All numbers are REAL (server-aggregated spend
// vs. editable limits) — no mock data.
import { defineStore } from 'pinia'
import api from '../services/api'

// Map the UI period select labels to the backend period keys.
export const PERIOD_OPTIONS = [
  { label: 'This month', value: 'this_month' },
  { label: 'Last month', value: 'last_month' },
  { label: 'This quarter', value: 'this_quarter' },
]

export const useBudgetStore = defineStore('budgets', {
  state: () => ({
    period: 'this_month',
    metrics: {},
    byProvider: {},
    byAgent: {},
    byDay: [],
    scopes: [],
    rules: [],
    alerts: [],
    budgets: [],          // full Budget objects (for edit modals)
    hasBudget: false,
    organization: null,   // the active org for the current view {id, name}
    organizations: [],    // orgs the user can access (for the selector) [{id, name, is_personal}]
    selectedOrgId: null,  // explicitly chosen org (multi-org); null = active context
    canManage: false,     // may the user create/edit budgets for the active org?
    loading: false,
    saving: false,
    error: '',
    loaded: false,
  }),
  getters: {
    metricsList: (s) => {
      const m = s.metrics || {}
      const usd = (v) => (v === null || v === undefined ? '—' : `$${Number(v).toFixed(2)}`)
      return [
        { key: 'current', label: 'Current Spend', value: usd(m.current_spend),
          copy: s.periodLabel, tone: 'green', icon: 'lucide:activity', spark: true },
        { key: 'monthly', label: 'Monthly Budget', value: usd(m.monthly_limit),
          copy: m.monthly_limit == null ? 'No cap set' : 'Monthly cap', tone: 'violet', icon: 'lucide:calendar-days' },
        { key: 'daily', label: 'Daily Budget', value: usd(m.daily_limit),
          copy: m.daily_limit == null ? 'No cap set' : 'Daily cap', tone: 'blue', icon: 'lucide:clock-3' },
        { key: 'remaining', label: 'Remaining Budget', value: usd(m.remaining),
          copy: m.percent == null ? '—' : `${(100 - m.percent).toFixed(1)}% remaining`,
          tone: 'blue', icon: 'lucide:circle-dollar-sign', ring: m.percent != null, percent: m.percent },
        { key: 'alerts', label: 'Alerts Triggered', value: String(m.alerts_triggered ?? 0),
          copy: (m.alerts_triggered ?? 0) > 0 ? 'Needs attention' : 'All clear',
          tone: (m.alerts_triggered ?? 0) > 0 ? 'red' : 'green', icon: 'lucide:triangle-alert' },
        { key: 'approval', label: 'Approval Threshold', value: usd(m.approval_threshold),
          copy: m.approval_threshold == null ? 'Not set' : 'Requires approval', tone: 'orange', icon: 'lucide:shield-check' },
      ]
    },
    periodLabel: (s) => (PERIOD_OPTIONS.find((p) => p.value === s.period)?.label || 'This month'),
    // Donut data shaped exactly like the template expects (items with name/value/percent/tone).
    donuts: (s) => {
      const DOT = ['blue-dot', 'green-dot', 'yellow-dot', 'violet-dot', 'slate-dot']
      const agentNameById = Object.fromEntries(s.budgets.map((b) => [String(b.scope_id), b.name]))
      const toItems = (obj, nameFn) => {
        const entries = Object.entries(obj || {})
          .map(([k, v]) => ({ key: k, cost: Number(v.cost || 0) }))
          .sort((a, b) => b.cost - a.cost)
        const total = entries.reduce((sum, e) => sum + e.cost, 0) || 1
        return entries.slice(0, 5).map((e, i) => ({
          name: nameFn(e.key), value: `$${e.cost.toFixed(2)}`,
          percent: `${((e.cost / total) * 100).toFixed(1)}%`, tone: DOT[i] || 'slate-dot',
        }))
      }
      return [
        { title: 'Spend by agent', copy: 'Top agents by spend', tone: 'agent',
          items: toItems(s.byAgent, (id) => agentNameById[id] || `Agent ${id}`) },
        { title: 'Spend by provider', copy: 'Cost by model provider', tone: 'provider',
          items: toItems(s.byProvider, (name) => name.charAt(0).toUpperCase() + name.slice(1)) },
      ]
    },
  },
  actions: {
    async load(period) {
      if (period) this.period = period
      this.loading = true
      this.error = ''
      try {
        const { data } = await api.getBudgetsSummary(this.period, this.selectedOrgId)
        this.metrics = data.metrics || {}
        this.byProvider = data.by_provider || {}
        this.byAgent = data.by_agent || {}
        this.byDay = data.by_day || []
        this.scopes = data.scopes || []
        this.rules = data.rules || []
        this.alerts = data.alerts || []
        this.hasBudget = !!data.has_budget
        this.organization = data.organization || null
        this.organizations = data.organizations || []
        this.canManage = !!data.can_manage
        // Lock the selected org to whatever the server resolved, so subsequent writes target the same org.
        if (this.organization?.id) this.selectedOrgId = this.organization.id
        await this.loadBudgets()
        this.loaded = true
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || 'Failed to load budgets'
      } finally {
        this.loading = false
      }
    },
    async loadBudgets() {
      try {
        const { data } = await api.getBudgets(this.selectedOrgId)
        this.budgets = Array.isArray(data) ? data : (data?.results || [])
      } catch { /* non-fatal: summary already drives the view */ }
    },
    async setPeriod(period) {
      await this.load(period)
    },
    async setOrg(orgId) {
      this.selectedOrgId = orgId
      this.loaded = false
      await this.load()
    },
    async saveBudget(payload) {
      this.saving = true
      try {
        const body = { ...payload, organization_id: this.selectedOrgId }
        if (payload.id) await api.updateBudget(payload.id, body)
        else await api.createBudget(body)
        await this.load()
      } finally { this.saving = false }
    },
    async removeBudget(id) {
      await api.deleteBudget(id, this.selectedOrgId)
      await this.load()
    },
    async saveRule(payload) {
      this.saving = true
      try {
        const body = { ...payload, organization_id: this.selectedOrgId }
        if (payload.id) await api.updateBudgetRule(payload.id, body)
        else await api.createBudgetRule(body)
        await this.load()
      } finally { this.saving = false }
    },
    async removeRule(id) {
      await api.deleteBudgetRule(id, this.selectedOrgId)
      await this.load()
    },
  },
})
