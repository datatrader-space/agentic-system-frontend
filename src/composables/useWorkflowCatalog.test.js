// useWorkflowCatalog (ADM-1333, F11): the whole list, a clear error per source, and a retry after an error.
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/services/api', () => ({ default: {} }))
import { useWorkflowCatalog } from './useWorkflowCatalog'

const tools = (n) => Array.from({ length: n }, (_, i) => ({ name: `TOOL_${i}`, category: i % 2 ? 'web' : 'data' }))
const MCP = { enabled: true, servers: [{ id: 1, name: 'Docs', tools: [{ name: 'search' }] }] }

function makeApi({ toolsResult, mcpResult } = {}) {
  return {
    getTools: vi.fn(toolsResult || (() => Promise.resolve({ data: { tools: tools(180), total_count: 180 } }))),
    getWorkflowMcpCatalog: vi.fn(mcpResult || (() => Promise.resolve({ data: MCP }))),
  }
}

describe('useWorkflowCatalog', () => {
  it('keeps every tool (no cut at 50) and the MCP servers', async () => {
    const api = makeApi()
    const c = useWorkflowCatalog({ api })
    expect(await c.load()).toBe(true)
    expect(c.tools.value).toHaveLength(180)
    expect(c.toolNames.value[179]).toBe('TOOL_179')
    expect(c.mcp.value).toEqual(MCP)
    expect(c.loaded.value).toBe(true)
    expect(c.error.value).toBe('')
  })

  it('loads once: a second load() asks nothing', async () => {
    const api = makeApi()
    const c = useWorkflowCatalog({ api })
    await c.load()
    await c.load()
    expect(api.getTools).toHaveBeenCalledTimes(1)
    expect(api.getWorkflowMcpCatalog).toHaveBeenCalledTimes(1)
  })

  it('two loads at once share one request', async () => {
    const api = makeApi()
    const c = useWorkflowCatalog({ api })
    await Promise.all([c.load(), c.load()])
    expect(api.getTools).toHaveBeenCalledTimes(1)
  })

  it('a failed source is an error, not an empty "loaded" catalog, and the next load retries only it', async () => {
    const api = makeApi({ toolsResult: () => Promise.reject({ response: { status: 500, data: { error: 'Failed to list tools' } } }) })
    const c = useWorkflowCatalog({ api })
    expect(await c.load()).toBe(false)
    expect(c.loaded.value).toBe(false)
    expect(c.toolsError.value).toBe('Could not load the tools (Failed to list tools).')
    expect(c.mcp.value.servers).toHaveLength(1)        // the MCP list still loaded
    api.getTools.mockImplementation(() => Promise.resolve({ data: { tools: tools(3), total_count: 3 } }))
    expect(await c.load()).toBe(true)
    expect(c.toolsError.value).toBe('')
    expect(api.getWorkflowMcpCatalog).toHaveBeenCalledTimes(1)
    expect(api.getTools).toHaveBeenCalledTimes(2)
  })

  it('a list shorter than its total is reported as incomplete, not shown as whole', async () => {
    const api = makeApi({ toolsResult: () => Promise.resolve({ data: { tools: tools(50), total_count: 812 } }) })
    const c = useWorkflowCatalog({ api })
    await c.load()
    expect(c.toolsError.value).toBe('The tool list came back incomplete (50 of 812). Try again.')
    expect(c.tools.value).toEqual([])
  })

  it('an answer it cannot read is an error with a reason', async () => {
    const api = makeApi({ mcpResult: () => Promise.resolve({ data: { enabled: true } }), toolsResult: () => Promise.resolve({ data: {} }) })
    const c = useWorkflowCatalog({ api })
    await c.load()
    expect(c.toolsError.value).toMatch(/Could not read the tool list/)
    expect(c.mcpError.value).toMatch(/Could not read the MCP server list/)
  })

  it('reload() reads both again', async () => {
    const api = makeApi()
    const c = useWorkflowCatalog({ api })
    await c.load()
    await c.reload()
    expect(api.getTools).toHaveBeenCalledTimes(2)
    expect(api.getWorkflowMcpCatalog).toHaveBeenCalledTimes(2)
  })
})
