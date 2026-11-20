// Safe-area guides for the monitor (plan item 13, ADM-1199): where each platform's own buttons and captions cover the
// picture, as shares of the canvas. Drawn on the monitor's overlay only, never in the export. The figures are the
// platforms' published guidance for full-screen video as of 2026 (approximate: apps change their layouts).
export const SAFE_AREAS = {
  tiktok: { label: 'TikTok', aspect: '9:16', top: 0.075, bottom: 0.2, left: 0.055, right: 0.12 },
  reels: { label: 'Reels', aspect: '9:16', top: 0.14, bottom: 0.2, left: 0.055, right: 0.11 },
  shorts: { label: 'Shorts', aspect: '9:16', top: 0.1, bottom: 0.18, left: 0.055, right: 0.14 },
  youtube: { label: 'YouTube', aspect: '16:9', top: 0.05, bottom: 0.1, left: 0.05, right: 0.05 },
}
// The box (shares of the canvas) inside a platform's covered edges, or null for an unknown id.
export function safeBox(id) {
  const a = SAFE_AREAS[id]
  if (!a) return null
  return { x: a.left, y: a.top, w: 1 - a.left - a.right, h: 1 - a.top - a.bottom, label: a.label, aspect: a.aspect }
}
