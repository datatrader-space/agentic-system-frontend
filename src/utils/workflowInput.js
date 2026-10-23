export class WorkflowInputError extends Error {}
export function workflowJson(text, previous, empty, label) {
  if (text === undefined) return previous
  if (typeof text !== 'string') throw new WorkflowInputError(`Enter valid JSON for ${label}.`)
  if (!text.trim()) return empty
  try { return JSON.parse(text) }
  catch { throw new WorkflowInputError(`Enter valid JSON for ${label}.`) }
}
