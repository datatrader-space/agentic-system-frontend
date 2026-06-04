// Pinia store — system context for the right panel (Phase 3).
// Loads the user's agent systems + the selected system's repositories and
// recent activity from the real API. Selection persists to localStorage.
import { defineStore } from 'pinia'
import api from '../services/api'

const LS_KEY = 'v2_current_system'

// DRF endpoints return either a bare array or { results: [...] }.
function pickArray(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.results)) return data.results
  return []
}

function loadSavedId() {
  try {
    return localStorage.getItem(LS_KEY) || null
  } catch {
    return null
  }
}

export const useSystemStore = defineStore('system', {
  state: () => ({
    systems: [],
    currentId: loadSavedId(),
    repositories: [],
    activity: [],
    loading: false,
    detailLoading: false,
    error: '',
    loaded: false,
  }),
  getters: {
    current: (s) =>
      s.systems.find((x) => String(x.id) === String(s.currentId)) || null,
    hasSystems: (s) => s.systems.length > 0,
  },
  actions: {
    async loadSystems() {
      if (this.loading) return // guard against double-mount (inline + overlay panels)
      this.loading = true
      this.error = ''
      try {
        const res = await api.getSystems()
        this.systems = pickArray(res.data)
        // Default the current system to the first one if none is selected/valid.
        if (!this.current && this.systems.length) {
          this.currentId = String(this.systems[0].id)
          this._persist()
        }
        this.loaded = true
        if (this.current) this.loadDetail()
      } catch (e) {
        this.error = 'Failed to load systems'
      } finally {
        this.loading = false
      }
    },

    async selectSystem(id) {
      this.currentId = String(id)
      this._persist()
      this.repositories = []
      this.activity = []
      await this.loadDetail()
    },

    async loadDetail() {
      const id = this.currentId
      if (!id) return
      this.detailLoading = true
      try {
        const [reposRes, tasksRes] = await Promise.allSettled([
          api.getRepositories(id),
          api.getTasks(id),
        ])
        this.repositories =
          reposRes.status === 'fulfilled' ? pickArray(reposRes.value.data) : []
        this.activity =
          tasksRes.status === 'fulfilled'
            ? pickArray(tasksRes.value.data).slice(0, 8)
            : []
      } finally {
        this.detailLoading = false
      }
    },

    _persist() {
      try {
        localStorage.setItem(LS_KEY, this.currentId || '')
      } catch {
        /* ignore */
      }
    },
  },
})
