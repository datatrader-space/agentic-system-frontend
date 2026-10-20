// Drawings shared by the Video Studio composer and its Help page, so a kind of video looks the same everywhere:
// one shot; scenes in sequence; footage with a cut. Frames are black (a screen); lines take currentColor.
const FRAME = 'fill="#000" stroke="currentColor" stroke-width="1.2"'

export const TASK_ART = {
  quick: `<svg viewBox="0 0 160 90"><rect x="22" y="12" width="116" height="66" rx="2" ${FRAME}/><path d="M74 33l16 12-16 12z" fill="currentColor"/></svg>`,
  story: `<svg viewBox="0 0 160 90"><rect x="8" y="22" width="44" height="46" rx="2" ${FRAME}/><rect x="58" y="22" width="44" height="46" rx="2" ${FRAME}/><rect x="108" y="22" width="44" height="46" rx="2" ${FRAME}/><text x="30" y="50" text-anchor="middle" font-size="12" fill="currentColor">1</text><text x="80" y="50" text-anchor="middle" font-size="12" fill="currentColor">2</text><text x="130" y="50" text-anchor="middle" font-size="12" fill="currentColor">3</text></svg>`,
  edit: `<svg viewBox="0 0 160 90"><rect x="6" y="20" width="148" height="50" rx="2" ${FRAME}/><path d="M6 28h148M6 62h148" stroke="currentColor" stroke-width="1" stroke-dasharray="4 5"/><path d="M96 10v70" stroke="currentColor" stroke-width="2"/><circle cx="96" cy="10" r="4" fill="currentColor"/></svg>`,
}

const S = (d, w = '1.8') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

// Small line icons for the Help page's process and recipes.
export const STEP_ICON = {
  describe: S('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  media: S('<path d="M12 5v14M5 12h14"/>', '2'),
  settings: S('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  estimate: S('<path d="M7 4h10v16l-2.5-1.5L12 20l-2.5-1.5L7 20z"/><path d="M10 9h4M10 13h4"/>'),
  generate: S('<path d="M8 5l11 7-11 7z"/>'),
  refine: S('<path d="M4 12a8 8 0 0 1 13.7-5.6L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15"/><path d="M4 20v-5h5"/>'),
}
