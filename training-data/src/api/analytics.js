// The project's Analytics page (backend: training_models_data/app_api.py — analytics/, analytics/photos.csv,
// analytics/app/). Every figure is counted by the backend from the project's photos, labels and the app's events.
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}/analytics`;

export const analyticsApi = {
  load: ref => apiFetch(`${base(ref)}/`, { timeoutMs: 60000 }),
  app: (ref, days) => apiFetch(`${base(ref)}/app/?days=${enc(days)}`, { timeoutMs: 60000 }),
};

// The CSV is a plain download: the browser asks for it with the person's own session.
export const csvUrl = ref => `/api${base(ref)}/photos.csv`;

// A share of a whole as a percentage with one decimal; '—' when there is no whole.
export const share = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : '—');

// Bytes as a person reads them.
export function bytesText(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// The scatter of photo sizes: each point placed in a box of ``w`` x ``h`` with ``pad``, from the smallest to the largest
// width and height (photos are rarely near 0 px, so a 0-based axis would crowd them into one corner), its radius growing
// with how many photos have that size (at least 4 px, so a single photo can be seen and hovered).
export function scatter(points, w = 520, h = 260, pad = 36) {
  const range = values => { const lo = Math.min(...values), hi = Math.max(...values); return lo === hi ? [lo - 1, hi + 1] : [lo, hi]; };
  const [minW, maxW] = points.length ? range(points.map(p => p.width)) : [0, 1];
  const [minH, maxH] = points.length ? range(points.map(p => p.height)) : [0, 1];
  const most = Math.max(1, ...points.map(p => p.count));
  const inner = 14;   // dots are kept clear of the axes
  return {
    minW, maxW, minH, maxH,
    dots: points.map(p => ({ ...p, x: pad + inner + ((p.width - minW) / (maxW - minW)) * (w - 2 * pad - 2 * inner),
                             y: h - pad - inner - ((p.height - minH) / (maxH - minH)) * (h - 2 * pad - 2 * inner),
                             r: 4 + 6 * Math.sqrt(p.count / most) })),
  };
}
