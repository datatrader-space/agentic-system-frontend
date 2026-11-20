// The tools and MCP servers the node picker offers (ADM-1333, F11).
//
//   const catalog = useWorkflowCatalog()
//   await catalog.load()          // once per page; again after an error
//   catalog.tools.value           // every tool the person can see, as /api/tools/ returns it
//   catalog.mcp.value             // { enabled, servers: [{ id, name, slug, enabled, total_tools, stale, tools }] }
//
// F11: the old builder swallowed a failed load into an empty, "loaded" catalog and never asked again, and its picker
// stopped each category at 50 tools. Here a failure is an error (per source, so a broken MCP list does not hide the
// tools), `load()` after an error asks again, and the full list is kept: `/api/tools/` answers every tool with its
// `total_count`, and a list shorter than that count is reported as incomplete rather than shown as if whole.
import { ref, shallowRef, computed } from 'vue'
import defaultApi from '@/services/api'

const reason = (e, what) => {
  const s = e?.response?.status
  const d = e?.response?.data
  const detail = (d && (d.detail || d.error)) || (s ? `error ${s}` : 'no answer from the server')
  return `Could not load ${what} (${detail}).`
}

export function useWorkflowCatalog({ api = defaultApi } = {}) {
  const tools = shallowRef([])
  const mcp = shallowRef({ enabled: false, servers: [] })
  const toolsError = ref('')
  const mcpError = ref('')
  const loading = ref(false)
  const toolsLoaded = ref(false)
  const mcpLoaded = ref(false)

  const loaded = computed(() => toolsLoaded.value && mcpLoaded.value)
  const error = computed(() => [toolsError.value, mcpError.value].filter(Boolean).join(' '))
  const toolNames = computed(() => tools.value.map((t) => t.name).filter(Boolean))

  async function loadTools() {
    try {
      const { data } = await api.getTools()
      const list = Array.isArray(data?.tools) ? data.tools : null
      if (!list) throw new Error('unexpected answer')
      if (Number.isInteger(data.total_count) && data.total_count !== list.length) {
        toolsError.value = `The tool list came back incomplete (${list.length} of ${data.total_count}). Try again.`
        return
      }
      tools.value = list
      toolsError.value = ''
      toolsLoaded.value = true
    } catch (e) {
      toolsError.value = e?.message === 'unexpected answer' ? 'Could not read the tool list. Try again.' : reason(e, 'the tools')
    }
  }

  async function loadMcp() {
    try {
      const { data } = await api.getWorkflowMcpCatalog()
      if (!data || !Array.isArray(data.servers)) throw new Error('unexpected answer')
      mcp.value = { enabled: !!data.enabled, servers: data.servers }
      mcpError.value = ''
      mcpLoaded.value = true
    } catch (e) {
      mcpError.value = e?.message === 'unexpected answer' ? 'Could not read the MCP server list. Try again.' : reason(e, 'the MCP servers')
    }
  }

  let inFlight = null
  /** Load what is not loaded yet (both on the first call; only the failed part after an error). */
  function load() {
    if (inFlight) return inFlight
    const jobs = []
    if (!toolsLoaded.value) jobs.push(loadTools())
    if (!mcpLoaded.value) jobs.push(loadMcp())
    if (!jobs.length) return Promise.resolve(true)
    loading.value = true
    inFlight = Promise.all(jobs).then(() => loaded.value).finally(() => { loading.value = false; inFlight = null })
    return inFlight
  }

  /** Read both lists again (after the person connected a tool or an MCP server). */
  function reload() {
    toolsLoaded.value = false
    mcpLoaded.value = false
    return load()
  }

  return { tools, mcp, toolNames, loading, loaded, error, toolsError, mcpError, load, reload }
}
