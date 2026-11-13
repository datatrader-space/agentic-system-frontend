import { apiFetch } from './client.js';

const base = ref => `/training-data/app/projects/${encodeURIComponent(ref)}/uploads/`;
export const LARGE_FILE_BYTES = 32_000_000;
export async function stageFile(ref, file, progress = () => {}) {
  let session = await apiFetch(base(ref), { method: 'POST', body: { name: file.name, size: file.size } });
  try {
    while (session.received < file.size) {
      const form = new FormData();
      form.append('offset', String(session.received));
      form.append('chunk', file.slice(session.received, session.received + session.chunk_bytes), 'chunk');
      session = await apiFetch(`${base(ref)}${session.id}/`, { method: 'POST', body: form, timeoutMs: 120000 });
      progress(session.received / file.size);
    }
    return session.id;
  } catch (error) {
    await cancelUpload(ref, session.id).catch(() => {});
    throw error;
  }
}
export const cancelUpload = (ref, id) => apiFetch(`${base(ref)}${encodeURIComponent(id)}/`, { method: 'DELETE' });

// Keep loose image requests below the existing reverse-proxy body limit.
export function uploadParts(files, maxBytes = 48_000_000) {
  const parts = []; let part = []; let bytes = 0;
  for (const file of files) {
    if (part.length && (bytes + file.size > maxBytes || file.zip || part[0].zip)) {
      parts.push(part); part = []; bytes = 0;
    }
    part.push(file); bytes += file.size;
  }
  if (part.length) parts.push(part);
  return parts;
}
