import { ref } from 'vue';

// A failed capability lookup is not an unsupported project type.
export function projectKinds(load) {
  const kinds = ref([]), status = ref('idle'), error = ref('');
  let pending;
  function refresh() {
    if (pending) return pending;
    status.value = 'loading'; error.value = '';
    pending = Promise.resolve().then(load).then(body => {
      if (!Array.isArray(body?.kinds) || !body.kinds.length || body.kinds.some(row => !row || typeof row.key !== 'string' || typeof row.available !== 'boolean')) throw new Error('Project types could not be loaded. Please retry.');
      kinds.value = body.kinds; status.value = 'ready';
      return kinds.value;
    }).catch(failure => {
      status.value = 'error'; error.value = failure.message || 'Project types could not be loaded. Please retry.';
      throw failure;
    }).finally(() => { pending = undefined; });
    return pending;
  }
  async function requireKind(key) {
    const rows = await refresh();
    const chosen = rows.find(row => row.key === key);
    if (chosen?.available !== true) throw new Error('This project type is currently unavailable. Choose another type.');
    if (typeof chosen.task !== 'string' || (!chosen.task && key !== 'data_only')) throw new Error('Project type configuration is incomplete. Please retry.');
    return chosen;
  }
  return { kinds, status, error, refresh, requireKind };
}
