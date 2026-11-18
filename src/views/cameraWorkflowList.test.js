// @vitest-environment jsdom
// ADM-1106 phase 6: "Build a workflow" on a camera's page opens the builder with that camera's event trigger already on
// a new workflow's canvas (utils/cameraWorkflow.js); an ordinary visit still just lists the workflows.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getWorkflowGraphs: vi.fn(), createWorkflowGraph: vi.fn() }))
const router = vi.hoisted(() => ({ push: vi.fn(() => Promise.resolve()) }))
const route = vi.hoisted(() => ({ params: {}, query: {} }))
vi.mock('../services/api', () => ({ default: api, isAbortError: () => false }))
vi.mock('vue-router', () => ({ useRouter: () => router, useRoute: () => route }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import WorkflowsList from './WorkflowsList.vue'

const stubs = { Icon: true, PageLoader: true, RouterLink: true, 'router-link': true }

beforeEach(() => {
  vi.clearAllMocks()
  api.getWorkflowGraphs.mockResolvedValue({ data: [] })
  api.createWorkflowGraph.mockResolvedValue({ data: { id: 41 } })
})

describe('WorkflowsList from a camera', () => {
  it('creates the workflow with the camera event trigger and opens it', async () => {
    route.query = { trigger: 'training.stream_event', source: '12', camera: 'Gate camera', rule: '3' }
    mount(WorkflowsList, { global: { stubs } })
    await flushPromises()
    expect(api.createWorkflowGraph).toHaveBeenCalledTimes(1)
    const body = api.createWorkflowGraph.mock.calls[0][0]
    expect(body.name).toBe('Gate camera events')
    expect(body.graph.nodes.map((n) => [n.type, n.data.source, n.data.rule])).toEqual([['trigger.training.stream_event', 12, 3]])
    expect(router.push).toHaveBeenCalledWith('/dashboard/workflow-builder/41')
  })

  it('an ordinary visit creates nothing', async () => {
    route.query = {}
    mount(WorkflowsList, { global: { stubs } })
    await flushPromises()
    expect(api.createWorkflowGraph).not.toHaveBeenCalled()
    expect(api.getWorkflowGraphs).toHaveBeenCalledTimes(1)
  })
})
