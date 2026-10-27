// F0 catalog boundary: navigation, page status and routing read this module only.
// The status, readiness and reason of every page come from GET /api/video/features/ (loadStudioFeatures); the
// list below is the order, names and addresses, with the plan's status until the server has answered.
import { shallowRef } from 'vue'
import api from './api'
export const CREATIVE_STUDIO_PAGES = ['audio','music','characters','identity-training','edit','motion','swap','effects','storyboard','cinema','editor','ads','marketing','ad-remix','avatar','lipsync','shorts','explainer','canvas']
export const STUDIO_GROUPS = ['Home', 'Create', 'Edit & enhance', 'Characters', 'Video tools', 'Avatars & shorts', 'Story', 'Marketing', 'Workspace']
const entry = (id, group, label, path, status, phase, purpose, icon) => ({ id, group, label, route: `/video-studio${path ? '/' + path : ''}`, status, phase, purpose, icon })
export const studioFeatures = shallowRef([
  entry('home', 'Home', 'Home', '', 'live', 'F0', 'Start with an idea and continue your creative work.', 'home'),
  entry('image', 'Create', 'Image', 'image', 'live', 'F0', 'Make a picture from a preset, your references and a few details.', 'image'),
  entry('video', 'Create', 'Video', 'video', 'live', 'F0', 'Turn an idea or opening image into a moving shot.', 'video'),
  entry('audio', 'Create', 'Voice & audio', 'audio', 'live', 'P0', 'Give a script a voice, make a sound effect or change a recorded voice.', 'audio'),
  entry('music', 'Create', 'Music', 'music', 'live', 'P5', 'Build an original soundtrack around a mood and a length.', 'music'),
  entry('characters', 'Characters', 'Characters', 'characters', 'live', 'P1', 'Build a reusable character and a consistent reference sheet.', 'person'),
  entry('identity-training', 'Characters', 'Identity training', 'identity-training', 'live', 'P2', 'Train a character identity from approved photos with consent first.', 'person'),
  entry('elements', 'Characters', 'Elements', 'elements', 'live', 'F0', 'Keep named characters, products, locations and styles ready to reuse.', 'elements'),
  entry('edit', 'Edit & enhance', 'Image edit', 'edit', 'live', 'P1', 'Change a selected part of an image while keeping the rest.', 'edit'),
  entry('motion', 'Video tools', 'Motion transfer', 'motion', 'live', 'P2', 'Guide a character with movement from a reference clip.', 'motion'),
  entry('swap', 'Video tools', 'Swap & restyle', 'swap', 'live', 'P2', 'Replace a subject or give existing footage a new visual direction.', 'swap'),
  entry('effects', 'Video tools', 'Effects', 'effects', 'live', 'P2', 'Add a visual treatment using a preset and its required media.', 'effects'),
  entry('enhance', 'Edit & enhance', 'Enhance', 'enhance', 'beta', 'F0', 'Trim, reframe, retime or caption a Library video with free local tools.', 'enhance'),
  entry('storyboard', 'Story', 'Storyboard', 'storyboard', 'live', 'P3', 'Plan keyframes, choose takes and build scenes in order.', 'story'),
  entry('cinema', 'Story', 'Cinema', 'cinema', 'live', 'P3', 'Shape a sequence with camera, lighting and scene choices.', 'video'),
  entry('editor', 'Story', 'Editor', 'editor', 'live', 'P3', 'Arrange video, sound and captions on a multitrack timeline.', 'edit'),
  entry('ads', 'Marketing', 'Ads Studio', 'ads', 'live', 'P4', 'Turn a brand brief into concepts you can review and develop.', 'marketing'),
  entry('marketing', 'Marketing', 'Product videos', 'marketing', 'live', 'P4', 'Build a product story around a showcase, demonstration or unboxing.', 'marketing'),
  entry('ad-remix', 'Marketing', 'Ad remix', 'ad-remix', 'live', 'P4', 'Explore a different opening or call to action for a reference ad.', 'swap'),
  entry('avatar', 'Avatars & shorts', 'Talking avatar', 'avatar', 'live', 'P5', 'Bring a consenting presenter or fictional character to a script.', 'person'),
  entry('lipsync', 'Avatars & shorts', 'Lip-sync', 'lipsync', 'live', 'P5', 'Match a consenting subject in footage to a supplied voice track.', 'audio'),
  entry('shorts', 'Avatars & shorts', 'Shorts from footage', 'shorts', 'live', 'P5', 'Choose useful moments from longer footage and assemble short clips.', 'video'),
  entry('explainer', 'Avatars & shorts', 'Explainer', 'explainer', 'live', 'P5', 'Develop a topic into editable script blocks and a narrated video.', 'story'),
  entry('projects', 'Workspace', 'Projects', 'projects', 'live', 'F0', 'Open and organize your video projects.', 'folder'),
  entry('library', 'Workspace', 'Library', 'library', 'live', 'F0', 'Browse media you uploaded or made in Video Studio.', 'image'),
  entry('canvas', 'Workspace', 'Canvas', 'canvas', 'live', 'P6', 'Connect typed media steps into a reusable creative workflow.', 'elements'),
  entry('help', 'Workspace', 'Help', 'help', 'live', 'F0', 'Learn the Studio, its models and its approval flow.', 'help'),
])
export function featureLink(feature) { return feature.route }
export function getStudioFeature(id) { return studioFeatures.value.find(feature => feature.id === id) }
export const studioIcons = {
  chat: 'M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2Z',
  home: 'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',
  image: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M15 8h.01',
  video: 'M3 6h12v12H3zM15 10l6-3v10l-6-3',
  audio: 'M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-3-3h3M20 16a3 3 0 1 1-3-3h3',
  person: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21a8 8 0 0 1 16 0',
  elements: 'm12 3 9 5-9 5-9-5 9-5M3 12l9 5 9-5M3 16l9 5 9-5',
  edit: 'm15 4 5 5-11 11-6 1 1-6L15 4M12 7l5 5',
  motion: 'M4 8h12l-4-4M16 8l-4 4M20 16H8l4-4M8 16l4 4',
  swap: 'M4 7h16l-4-4M20 7l-4 4M20 17H4l4-4M4 17l4 4',
  effects: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3',
  enhance: 'M4 18v3h3M4 6V3h3M17 3h3v3M20 18v3h-3M8 12h8M12 8v8',
  story: 'M3 5h5v14H3zM10 5h5v14h-5zM17 5h4v14h-4z',
  marketing: 'm3 10 15-6v16L3 14v-4M7 15l2 6h4l-2-5M21 9v6',
  folder: 'M3 7h7l2 2h9v11H3V7M3 7V4h7l2 3',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01',
}

export function orderedFeatures(features = studioFeatures.value) {
  const rank = { live: 0, beta: 1, soon: 2 }
  return [...features].sort((a,b) => STUDIO_GROUPS.indexOf(a.group) - STUDIO_GROUPS.indexOf(b.group) || rank[a.status] - rank[b.status])
}

// The server's word on every page for this person: status, ready, and when not, code and reason. Merged into the
// catalog so the home cards, the navigation and each page agree. The address stays the frontend's.
let pending = null
export function loadStudioFeatures({ force = false } = {}) {
  if (pending && !force) return pending
  pending = Promise.resolve().then(() => api.getStudioFeatures()).then(({ data }) => {
    const rows = data.features || []
    studioFeatures.value = studioFeatures.value.map(row => {
      const server = rows.find(item => item.id === row.id)
      return server ? { ...row, status: server.status || row.status, phase: server.phase || row.phase, ready: !!server.ready, code: server.code || '', reason: server.reason || '', tasks: server.tasks || [] } : row
    })
    return rows
  }).catch(error => { pending = null; throw error })
  return pending
}
