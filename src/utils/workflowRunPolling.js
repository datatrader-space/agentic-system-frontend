// Workflow run status helpers, used by useWorkflowRun (the builder's run state).
//
// These are RUN statuses, from agent/workflow_graph_models.py WorkflowGraphRun: queued, running, waiting, paused,
// success, failed, cancelled, blocked, dead. A NODE's status is a different vocabulary (contract C2: queued, running,
// waiting, succeeded, failed, skipped, cancelled); see composables/useWorkflowRun.js NODE_RUN_STATUSES.

// Nothing more will happen to the run: stop polling and report the result.
export const RUN_FINAL_STATUSES = ['success', 'failed', 'cancelled', 'dead']
// The run is alive but nothing will change without a person (approval, operator resume) or a long
// durable delay: stop polling. A decision in the builder restarts it.
export const RUN_HELD_STATUSES = ['waiting', 'paused', 'blocked']

// 'final' | 'held' | null (still moving: queued / running / unknown)
export function runStopKind(status) {
  if (RUN_FINAL_STATUSES.includes(status)) return 'final'
  if (RUN_HELD_STATUSES.includes(status)) return 'held'
  return null
}

// Every agent the caller can see, for pickers: one /agents/picker/ response (id, name, ...).
export async function fetchAllAgents(api) {
  const { data } = await api.getAgentPicker()
  return Array.isArray(data) ? data : (data?.results || [])
}
