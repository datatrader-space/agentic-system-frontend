// Pinia store — Organization dashboard (/dashboard/organization + sub-modules).
// Resolves the current org, then loads the aggregate overview bundle from
// /api/v2/orgs/<slug>/overview/. All numbers are REAL (server-aggregated) — the
// modules with no backend (cloud/sandboxes/procurement) render placeholders, and
// the overview cards with no source yet are flagged `placeholder: true`.
import { defineStore } from 'pinia'
import tenancyApi from '../services/tenancyApi'
import api from '../services/api'

export const useOrganizationStore = defineStore('organization', {
  state: () => ({
    orgSlug: null,
    org: null,            // { id, name, slug, created_at, settings, role }
    metrics: {},          // { workspaces, members, agents, monthly_spend_usd }
    workspaces: [],       // [{ id, name, slug, owner, members, agents, budget_used_pct, status }]
    topBySpend: [],
    members: [],          // OrganizationMembership[]
    recentActivity: [],   // AuditEvent[]
    budget: null,         // budgets summary bundle (reused from /dashboard/budgets)
    loading: false,
    error: '',
    loaded: false,
  }),
  getters: {
    role: (s) => s.org?.role || null,
    isAdmin: (s) => ['owner', 'admin'].includes(s.org?.role),
    // Headline metric cards. Cards with no backend yet are flagged placeholder.
    metricCards: (s) => {
      const m = s.metrics || {}
      const spend = m.monthly_spend_usd
      return [
        { label: 'Workspaces', value: String(m.workspaces ?? 0), tone: 'blue', icon: 'lucide:layout-grid' },
        { label: 'Members', value: String(m.members ?? 0), tone: 'violet', icon: 'lucide:users' },
        { label: 'Agents', value: String(m.agents ?? 0), tone: 'indigo', icon: 'lucide:network' },
        { label: 'Organization Credentials', value: '—', tone: 'blue', icon: 'lucide:key-round', placeholder: true },
        { label: 'Pending Approvals', value: '—', tone: 'indigo', icon: 'lucide:clock-3', placeholder: true },
        {
          label: 'Monthly Spend',
          value: spend == null ? '$0.00' : `$${Number(spend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          tone: 'money', icon: 'lucide:circle-dollar-sign',
        },
      ]
    },
  },
  actions: {
    // Resolve the org slug: explicit arg → active workspace's org → first owned/member org.
    async resolveOrgSlug() {
      if (this.orgSlug) return this.orgSlug
      try {
        const { data } = await tenancyApi.getMyOrgs()
        const orgs = Array.isArray(data) ? data : (data?.results || [])
        if (!orgs.length) return null
        // Prefer a non-personal org the user owns/administers, else the first.
        const preferred = orgs.find((o) => !o.is_personal) || orgs[0]
        this.orgSlug = preferred.slug
        return this.orgSlug
      } catch {
        return null
      }
    },
    async load(slug) {
      if (slug) this.orgSlug = slug
      this.loading = true
      this.error = ''
      try {
        const orgSlug = await this.resolveOrgSlug()
        if (!orgSlug) {
          this.error = 'no_org'
          return
        }
        const { data } = await tenancyApi.getOrgOverview(orgSlug)
        this.org = data.organization || null
        this.metrics = data.metrics || {}
        this.workspaces = data.workspaces || []
        this.topBySpend = data.top_workspaces_by_spend || []
        this.recentActivity = data.recent_activity || []
        this.loaded = true
        // Budget bundle + members are non-fatal side-loads.
        this.loadBudget()
        this.loadMembers()
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || 'Failed to load organization'
      } finally {
        this.loading = false
      }
    },
    async loadBudget() {
      try {
        const { data } = await api.getBudgetsSummary()
        this.budget = data || null
      } catch { /* non-fatal */ }
    },
    async loadMembers() {
      if (!this.orgSlug) return
      try {
        const { data } = await tenancyApi.getOrgMembers(this.orgSlug)
        this.members = Array.isArray(data) ? data : (data?.results || [])
      } catch { /* non-fatal */ }
    },
    async refresh() {
      this.loaded = false
      await this.load()
    },
  },
})
