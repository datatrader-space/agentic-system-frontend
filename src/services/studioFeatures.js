// F0 catalog boundary: navigation, page status and routing read this module only.
// Creative pages hydrate server availability into this ref; consumers stay reactive.
import { shallowRef } from 'vue'
export const CREATIVE_STUDIO_PAGES = ['music','storyboard','cinema','editor','ads','marketing','ad-remix','shorts','explainer','canvas']
export const STUDIO_GROUPS = ['Home', 'Create', 'Edit & enhance', 'Characters', 'Video tools', 'Avatars & shorts', 'Story', 'Marketing', 'Workspace']
const plannedCards = {
  "audio": [
    {
      "title": "Speech",
      "purpose": "Turn a written script into a spoken take."
    },
    {
      "title": "Voice change",
      "purpose": "Give an existing recording a different approved voice."
    },
    {
      "title": "Translate",
      "purpose": "Recreate spoken content in another language."
    }
  ],
  "music": [
    {
      "title": "Background",
      "purpose": "Create a supporting track that leaves room for narration."
    },
    {
      "title": "Intro",
      "purpose": "Write a short musical opening with a clear finish."
    },
    {
      "title": "Rhythm",
      "purpose": "Build a repeating beat around the pace of your edit."
    }
  ],
  "characters": [
    {
      "title": "Build",
      "purpose": "Describe a new character and choose its defining traits."
    },
    {
      "title": "Cast",
      "purpose": "Explore different looks for a role before choosing one."
    },
    {
      "title": "Sheet",
      "purpose": "Arrange consistent views of the same character for reuse."
    }
  ],
  "identity-training": [
    {
      "title": "Prepare photos",
      "purpose": "Gather clear approved views of the character."
    },
    {
      "title": "Confirm consent",
      "purpose": "Record permission to use the supplied identity photos."
    },
    {
      "title": "Train identity",
      "purpose": "Prepare a reusable identity from the reviewed collection."
    }
  ],
  "edit": [
    {
      "title": "Inpaint",
      "purpose": "Replace the area you mark while preserving its surroundings."
    },
    {
      "title": "Relight",
      "purpose": "Change the light direction and mood of a source image."
    },
    {
      "title": "Expand",
      "purpose": "Extend the composition beyond the original frame."
    },
    {
      "title": "Edit text",
      "purpose": "Revise lettering inside an image while retaining its setting."
    }
  ],
  "motion": [
    {
      "title": "Choose movement",
      "purpose": "Select the performance or camera movement to follow."
    },
    {
      "title": "Match character",
      "purpose": "Pair the movement with your chosen character references."
    },
    {
      "title": "Review motion",
      "purpose": "Check the transferred movement before keeping a take."
    }
  ],
  "swap": [
    {
      "title": "Swap object",
      "purpose": "Replace a selected subject with a supplied reference."
    },
    {
      "title": "Restyle",
      "purpose": "Apply a new visual treatment while keeping the movement."
    }
  ],
  "effects": [
    {
      "title": "Choose effect",
      "purpose": "Find a visual treatment that suits the shot."
    },
    {
      "title": "Add inputs",
      "purpose": "Supply the images or footage required by that effect."
    },
    {
      "title": "Review treatment",
      "purpose": "Compare effect takes before saving the clip."
    }
  ],
  "storyboard": [
    {
      "title": "Keyframes",
      "purpose": "Sketch the important visual moments of the story."
    },
    {
      "title": "Scenes",
      "purpose": "Turn selected keyframes into ordered moving shots."
    },
    {
      "title": "Takes",
      "purpose": "Compare alternatives for a scene and keep the strongest."
    }
  ],
  "cinema": [
    {
      "title": "Stage scene",
      "purpose": "Set the location, subjects and framing for a sequence."
    },
    {
      "title": "Direct camera",
      "purpose": "Choose movement and lens direction for each shot."
    },
    {
      "title": "Shape lighting",
      "purpose": "Keep lighting choices consistent across the sequence."
    }
  ],
  "editor": [
    {
      "title": "Arrange clips",
      "purpose": "Place source shots in the order your story needs."
    },
    {
      "title": "Mix sound",
      "purpose": "Align narration and music with the picture."
    },
    {
      "title": "Finish timeline",
      "purpose": "Review timing and captions before exporting the edit."
    }
  ],
  "ads": [
    {
      "title": "Brand profile",
      "purpose": "Collect the product context and the audience you want to reach."
    },
    {
      "title": "Concepts",
      "purpose": "Develop several advertising directions from the brief."
    },
    {
      "title": "Review concepts",
      "purpose": "Compare messages and visuals before making a campaign asset."
    }
  ],
  "marketing": [
    {
      "title": "Showcase",
      "purpose": "Present the product through a clear sequence of views."
    },
    {
      "title": "Demonstration",
      "purpose": "Show how the product works through a simple use case."
    },
    {
      "title": "Unboxing",
      "purpose": "Reveal the product through a paced opening sequence."
    }
  ],
  "ad-remix": [
    {
      "title": "New hook",
      "purpose": "Try a different opening while keeping the core offer."
    },
    {
      "title": "New call to action",
      "purpose": "Change the closing message to fit your next step."
    },
    {
      "title": "Recreate",
      "purpose": "Develop a fresh version guided by the reference structure."
    }
  ],
  "avatar": [
    {
      "title": "Choose presenter",
      "purpose": "Select a consenting person or a fictional character."
    },
    {
      "title": "Prepare delivery",
      "purpose": "Set the words or voice track the presenter will deliver."
    },
    {
      "title": "Review performance",
      "purpose": "Compare presenter takes for expression and pacing."
    }
  ],
  "lipsync": [
    {
      "title": "Source performance",
      "purpose": "Choose footage with a clear view of the speaking subject."
    },
    {
      "title": "Voice track",
      "purpose": "Add the speech that should guide the mouth movement."
    },
    {
      "title": "Check alignment",
      "purpose": "Review speech timing and facial movement together."
    }
  ],
  "shorts": [
    {
      "title": "Find moments",
      "purpose": "Identify useful passages in the longer source footage."
    },
    {
      "title": "Frame for shorts",
      "purpose": "Adapt selected moments to a compact viewing format."
    },
    {
      "title": "Add captions",
      "purpose": "Prepare readable timed text for each selected clip."
    }
  ],
  "explainer": [
    {
      "title": "Outline topic",
      "purpose": "Break the idea into a short sequence of clear points."
    },
    {
      "title": "Write narration",
      "purpose": "Turn the outline into editable spoken sections."
    },
    {
      "title": "Build visuals",
      "purpose": "Pair each section with supporting images and motion."
    }
  ],
  "canvas": [
    {
      "title": "Connect inputs",
      "purpose": "Place source media and creative directions into typed steps."
    },
    {
      "title": "Link operations",
      "purpose": "Connect compatible steps into a reusable sequence."
    },
    {
      "title": "Review workflow",
      "purpose": "Inspect each result before continuing to the next step."
    }
  ]
}
const entry = (id, group, label, path, status, phase, purpose, icon, inputs, output, liveAlternative = '/video-studio', modes = []) => ({
  id, group, label, plannedCards: plannedCards[id] || [], layout: ['home','storyboard','cinema','editor','ads','shorts','explainer','canvas'].includes(id) ? 'workspace' : 'generator', route: `/video-studio${path ? '/' + path : ''}`, status: CREATIVE_STUDIO_PAGES.includes(id) ? 'live' : status, phase, purpose, icon, inputs, output, liveAlternative, modes,
})
export const studioFeatures = shallowRef([
  entry('home', 'Home', 'Home', '', 'live', 'F0', 'Start with an idea and continue your creative work.', 'home', [], 'A conversation and creative work'),
  entry('image', 'Create', 'Image', 'image', 'live', 'F0', 'Make a picture from a preset, your references and a few details.', 'image', ['Reference images'], 'Images'),
  entry('video', 'Create', 'Video', 'video', 'live', 'F0', 'Turn an idea or opening image into a moving shot.', 'video', ['Opening frame', 'Closing frame', 'References'], 'A video'),
  entry('audio', 'Create', 'Voice & audio', 'audio', 'soon', 'P0', 'Give a script a voice, change a voice or translate speech.', 'audio', ['Script', 'Voice samples'], 'Speech or translated audio', '/video-studio', ['Speech', 'Voice change', 'Translate']),
  entry('music', 'Create', 'Music', 'music', 'soon', 'P5', 'Build an original soundtrack around a mood and a length.', 'music', ['Music brief'], 'A soundtrack', '/video-studio', ['Background', 'Intro', 'Rhythm']),
  entry('characters', 'Characters', 'Characters', 'characters', 'soon', 'P1', 'Build a reusable character and a consistent reference sheet.', 'person', ['Optional photo', 'Character description'], 'A character Element', '/video-studio/image', ['Build', 'Cast', 'Sheet']),
  entry('identity-training', 'Characters', 'Identity training', 'characters/:id/train', 'soon', 'P2', 'Train a character identity from approved photos with consent first.', 'person', ['Character', '5 to 50 approved photos', 'Consent'], 'A reusable identity', '/video-studio/elements'),
  entry('elements', 'Characters', 'Elements', 'elements', 'live', 'F0', 'Keep named characters, products, locations and styles ready to reuse.', 'elements', ['Library images or videos'], 'Named reusable Elements'),
  entry('edit', 'Edit & enhance', 'Image edit', 'edit', 'soon', 'P1', 'Change a selected part of an image while keeping the rest.', 'edit', ['Source image', 'Mask or instructions'], 'An edited image', '/video-studio/image', ['Inpaint', 'Relight', 'Expand', 'Edit text']),
  entry('motion', 'Video tools', 'Motion transfer', 'motion', 'soon', 'P2', 'Guide a character with movement from a reference clip.', 'motion', ['Source video', 'Character images'], 'A motion-guided video', '/video-studio/video'),
  entry('swap', 'Video tools', 'Swap & restyle', 'swap', 'soon', 'P2', 'Replace a subject or give existing footage a new visual direction.', 'swap', ['Source video', 'Reference images'], 'Restyled footage', '/video-studio/video', ['Swap object', 'Restyle']),
  entry('effects', 'Video tools', 'Effects', 'effects', 'soon', 'P2', 'Add a visual treatment using a preset and its required media.', 'effects', ['Preset-specific image or video'], 'A treated clip', '/video-studio/video'),
  entry('enhance', 'Edit & enhance', 'Enhance', 'enhance', 'beta', 'F0', 'Trim, reframe, retime or caption a Library video with free local tools.', 'enhance', ['Source video'], 'An edited video'),
  entry('storyboard', 'Story', 'Storyboard', 'storyboard', 'soon', 'P3', 'Plan keyframes, choose takes and build scenes in order.', 'story', ['Story brief', 'Character references'], 'A storyboard and scene videos', '/video-studio', ['Keyframes', 'Scenes', 'Takes']),
  entry('cinema', 'Story', 'Cinema', 'cinema', 'soon', 'P3', 'Shape a sequence with camera, lighting and scene choices.', 'video', ['Scene brief', 'Opening and closing images'], 'A cinematic sequence', '/video-studio/video'),
  entry('editor', 'Story', 'Editor', 'editor', 'soon', 'P3', 'Arrange video, sound and captions on a multitrack timeline.', 'edit', ['Video clips', 'Audio', 'Timed captions'], 'An assembled video', '/video-studio/enhance'),
  entry('ads', 'Marketing', 'Ads Studio', 'ads', 'soon', 'P4', 'Turn a brand brief into concepts you can review and develop.', 'marketing', ['Brand URL or name', 'Product images'], 'A brand profile and ad concepts', '/video-studio/image'),
  entry('marketing', 'Marketing', 'Product videos', 'marketing', 'soon', 'P4', 'Build a product story around a showcase, demonstration or unboxing.', 'marketing', ['Product images', 'Optional presenter'], 'A product video', '/video-studio/video', ['Showcase', 'Demonstration', 'Unboxing']),
  entry('ad-remix', 'Marketing', 'Ad remix', 'ad-remix', 'soon', 'P4', 'Explore a different opening or call to action for a reference ad.', 'swap', ['Reference video', 'Product references'], 'Ad variations', '/video-studio/video', ['New hook', 'New call to action', 'Recreate']),
  entry('avatar', 'Avatars & shorts', 'Talking avatar', 'avatar', 'soon', 'P5', 'Bring a consenting presenter or fictional character to a script.', 'person', ['Photo or Element', 'Script or audio', 'Consent'], 'A presenter video', '/video-studio/image'),
  entry('lipsync', 'Avatars & shorts', 'Lip-sync', 'lipsync', 'soon', 'P5', 'Match a consenting subject in footage to a supplied voice track.', 'audio', ['Video', 'Audio or script', 'Consent'], 'A lip-synced video', '/video-studio/video'),
  entry('shorts', 'Avatars & shorts', 'Shorts from footage', 'shorts', 'soon', 'P5', 'Choose useful moments from longer footage and assemble short clips.', 'video', ['Up to 120 seconds of footage'], 'Captioned short videos', '/video-studio/enhance'),
  entry('explainer', 'Avatars & shorts', 'Explainer', 'explainer', 'soon', 'P5', 'Develop a topic into editable script blocks and a narrated video.', 'story', ['Topic', 'Narration style'], 'An explainer video', '/video-studio'),
  entry('projects', 'Workspace', 'Projects', 'projects', 'live', 'F0', 'Open and organize your video projects.', 'folder', [], 'Creative projects'),
  entry('library', 'Workspace', 'Library', 'library', 'live', 'F0', 'Browse media you uploaded or made in Video Studio.', 'image', [], 'Your media'),
  entry('canvas', 'Workspace', 'Canvas', 'canvas', 'soon', 'P6', 'Connect typed media steps into a reusable creative workflow.', 'elements', ['Media and prompt nodes'], 'A connected workflow', '/video-studio/projects'),
  entry('help', 'Workspace', 'Help', 'help', 'live', 'F0', 'Learn the Studio, its models and its approval flow.', 'help', [], 'Guides and model information'),
])
export function featureLink(feature) { return feature.route.replace(':id', 'preview') }
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
