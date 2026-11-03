// Approved v8 workflow illustrations, shared by Dashboard and Help.
export const TASK_ART = {
  "quick": "<svg viewBox=\"0 0 300 116\" aria-hidden=\"true\"><rect x=\"77\" y=\"15\" width=\"146\" height=\"86\" rx=\"5\" fill=\"#151c29\" stroke=\"#92b5ff\" stroke-width=\"1.4\"/><path d=\"m137 39 35 19-35 19Z\" fill=\"#9fbdff\"/><path d=\"M93 86h23M120 86h13M138 86h48\" stroke=\"#344a6e\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>",
  "story": "<svg viewBox=\"0 0 300 116\" aria-hidden=\"true\"><rect x=\"57\" y=\"24\" width=\"56\" height=\"69\" rx=\"5\" fill=\"#1c2535\" stroke=\"#627492\"/><rect x=\"122\" y=\"16\" width=\"56\" height=\"85\" rx=\"5\" fill=\"#26354e\" stroke=\"#93acd6\"/><rect x=\"187\" y=\"24\" width=\"56\" height=\"69\" rx=\"5\" fill=\"#1c2535\" stroke=\"#627492\"/><path d=\"m65 81 14-19 14 9 12-18M131 88l12-35 10 15 16-33M195 80l14-20 14 12 12-17\" fill=\"none\" stroke=\"#6f8eba\" stroke-width=\"1.5\"/><text x=\"85\" y=\"49\" text-anchor=\"middle\" fill=\"#9aaecb\" font-size=\"12\" font-family=\"Inter\">1</text><text x=\"150\" y=\"43\" text-anchor=\"middle\" fill=\"#bdd4f7\" font-size=\"12\" font-family=\"Inter\">2</text><text x=\"215\" y=\"49\" text-anchor=\"middle\" fill=\"#9aaecb\" font-size=\"12\" font-family=\"Inter\">3</text></svg>",
  "edit": "<svg viewBox=\"0 0 300 116\" aria-hidden=\"true\"><rect x=\"51\" y=\"27\" width=\"198\" height=\"63\" rx=\"5\" fill=\"#171e2c\" stroke=\"#7285a4\"/><path d=\"M53 47h194M53 69h194\" stroke=\"#4a5b78\" stroke-dasharray=\"5 5\"/><rect x=\"64\" y=\"34\" width=\"58\" height=\"7\" rx=\"2\" fill=\"#415b85\"/><rect x=\"130\" y=\"34\" width=\"72\" height=\"7\" rx=\"2\" fill=\"#3b5276\"/><rect x=\"85\" y=\"55\" width=\"139\" height=\"7\" rx=\"2\" fill=\"#4c507b\"/><path d=\"M161 18v84\" stroke=\"#b5c9ee\" stroke-width=\"1.5\"/><circle cx=\"161\" cy=\"17\" r=\"4\" fill=\"#b5c9ee\"/></svg>"
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
