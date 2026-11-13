import { activeWorkspace } from './client.js';
// Retain an acknowledged create while retrying a failed data-policy save.
export function projectSubmission({ requireKind, create, savePolicy, saveLlmPolicy, dataUse, llmDataUse, typeKind, workspace = () => activeWorkspace()?.id || null }) {
  const drafts = new Map();
  return async form => {
    const scope = workspace();
    const checkScope = () => { if (workspace() !== scope) throw new Error('Your workspace changed. Return to the original workspace before retrying this project.'); };
    const kind = typeKind[form.task];
    const chosen = await requireKind(kind);
    checkScope();
    const body = { name: form.name, description: form.purpose, task: chosen.task,
      ...(chosen.family === 'llm' ? { kind } : {}) };
    const key = JSON.stringify([scope, body]);
    let row = drafts.get(key);
    if (!row) { row = await create(body); drafts.set(key, row); }
    checkScope();
    await savePolicy(row.ref, dataUse(form));
    checkScope();
    if (row.family === 'llm') { await saveLlmPolicy(row.ref, llmDataUse(form)); checkScope(); }
    drafts.delete(key);
    return row;
  };
}
