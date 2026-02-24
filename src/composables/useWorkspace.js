// src/composables/useWorkspace.js
import { ref, computed, readonly } from 'vue'
import tenancyApi from '../services/tenancyApi'

// Module-level singletons so all components share the same state
const activeWorkspace = ref(
    JSON.parse(localStorage.getItem('activeWorkspace') || 'null')
)
const activeOrg = ref(
    JSON.parse(localStorage.getItem('activeOrg') || 'null')
)
const myOrgs = ref([])
const loading = ref(false)
const error = ref(null)
const tenancyDisabled = ref(false)  // true when server returns 409 (TENANCY_MODE=disabled)

export function useWorkspace() {
    // ── Actions ────────────────────────────────────────────────────────────────

    function switchWorkspace(workspace, org) {
        activeWorkspace.value = workspace
        activeOrg.value = org
        localStorage.setItem('activeWorkspace', JSON.stringify(workspace))
        localStorage.setItem('activeOrg', JSON.stringify(org))
        localStorage.setItem('activeWorkspaceId', String(workspace.id))
    }

    function clearWorkspace() {
        activeWorkspace.value = null
        activeOrg.value = null
        localStorage.removeItem('activeWorkspace')
        localStorage.removeItem('activeOrg')
        localStorage.removeItem('activeWorkspaceId')
    }

    async function loadMyOrgs() {
        loading.value = true
        error.value = null
        try {
            const res = await tenancyApi.getMyOrgs()
            myOrgs.value = res.data?.results ?? res.data ?? []

            // NOTE: No auto-select — users start in Personal Mode (no workspace)
            // and must explicitly pick a workspace from the switcher.
        } catch (e) {
            if (e?.response?.status === 409) {
                // Backend has TENANCY_MODE=disabled — hide the switcher silently
                tenancyDisabled.value = true
            } else {
                error.value = e?.response?.data?.detail || 'Could not load organisations'
            }
        } finally {
            loading.value = false
        }
    }

    // ── Computed ───────────────────────────────────────────────────────────────

    const isWorkspaceActive = computed(() => !!activeWorkspace.value)
    const activeWorkspaceName = computed(() => activeWorkspace.value?.name ?? '')
    const activeOrgName = computed(() => activeOrg.value?.name ?? '')

    /** Flat list of { workspace, org } for the switcher dropdown */
    const allWorkspaces = computed(() => {
        const out = []
        for (const org of myOrgs.value) {
            for (const ws of org.workspaces ?? []) {
                out.push({ workspace: ws, org })
            }
        }
        return out
    })

    return {
        // State (readonly to prevent accidental mutation outside)
        activeWorkspace: readonly(activeWorkspace),
        activeOrg: readonly(activeOrg),
        myOrgs: readonly(myOrgs),
        loading: readonly(loading),
        error: readonly(error),
        tenancyDisabled: readonly(tenancyDisabled),

        // Computed
        isWorkspaceActive,
        activeWorkspaceName,
        activeOrgName,
        allWorkspaces,

        // Actions
        switchWorkspace,
        clearWorkspace,
        loadMyOrgs,
    }
}
