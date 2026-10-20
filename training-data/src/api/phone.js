// Phone upload links and photos from a video or a PDF (backend: training_models_data/app_api.py phone-links/ and
// photos/extract/, phone_links.py, media_import.py), and the phone's own side of a link (the machine API's phone/ and
// phone/photos/, where the link's secret is the Bearer credential and nobody needs to be signed in).
import { apiFetch, ApiError } from './client.js';
import { encode } from 'uqr';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;

export const phoneLinksApi = {
  list: ref => apiFetch(`${base(ref)}/phone-links/`),
  make: (ref, body) => apiFetch(`${base(ref)}/phone-links/`, { method: 'POST', body }),
  stop: (ref, id) => apiFetch(`${base(ref)}/phone-links/${enc(id)}/stop/`, { method: 'POST', body: {} }),
};

// A video or a PDF can take minutes to read on the server.
export const extractPhotos = (ref, form) => apiFetch(`${base(ref)}/photos/extract/`, { method: 'POST', body: form, timeoutMs: 300000 });
export const FRAME_EVERY = [1, 2, 5, 10, 30];

// The QR code of an address, as one SVG path (drawn here: the address never goes to an outside QR service).
export function qrOf(text) {
  if (!text) return null;
  try {
    const { size, data } = encode(text, { border: 2, ecc: 'M' });
    let path = '';
    data.forEach((row, y) => row.forEach((on, x) => { if (on) path += `M${x} ${y}h1v1h-1z`; }));
    return { size, path };
  } catch { return null; }
}

// The secret of a phone link in this page's address (``?phone=``), when it looks like one.
export function phoneSecret(search = globalThis.location?.search || '') {
  const raw = new URLSearchParams(search).get('phone') || '';
  return /^[A-Za-z0-9_-]{30,64}$/.test(raw) ? raw : '';
}

// The phone's calls: the secret is sent as the Bearer credential, never in the address.
async function phoneFetch(path, secret, { method = 'GET', body, fetchImpl = fetch, timeoutMs = 120000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(`/api/training-data/v1/${path}`, {
      method, body, headers: { Accept: 'application/json', Authorization: `Bearer ${secret}` },
      credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
    });
  } catch {
    throw controller.signal.aborted ? new ApiError(0, 'timeout', 'Sending took too long. Try fewer photos at a time.')
      : new ApiError(0, 'network', 'Could not reach AADML. Check the connection and try again.');
  } finally { clearTimeout(timer); }
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) throw new ApiError(response.status, data?.code || 'refused', typeof data?.error === 'string' ? data.error.slice(0, 300) : 'The link was refused.');
  return data;
}

export const phoneApi = {
  info: (secret, opts) => phoneFetch('phone/', secret, opts),
  send: (secret, files, opts) => {
    const form = new FormData();
    files.forEach(file => form.append('photos', file, file.name));
    return phoneFetch('phone/photos/', secret, { ...opts, method: 'POST', body: form });
  },
};

// The photos in parts the server takes at once (at most 20 a request).
export function inBatches(files, size = 10) {
  const parts = [];
  for (let i = 0; i < files.length; i += size) parts.push(files.slice(i, i + size));
  return parts;
}
