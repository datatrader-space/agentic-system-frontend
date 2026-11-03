// Approved v8 visual presets. Client-only presentation data; never a trusted backend capability registry.
// A look carries no media of its own: what a card shows is the person's own newest result made with that
// look, read from the backend with loadLookResult() below.
import api from './api'
export const studioLooks = [
  {
    "id": "image-look-1",
    "feature": "image",
    "title": "Softbox product portrait",
    "purpose": "A clean campaign image with precise materials.",
    "category": "Images",
    "slots": [
      {
        "id": "reference-0",
        "label": "Reference image",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Create a refined image of {Subject}. Use {Background} and {Lighting}. Preserve reference identity, accurate materials and natural proportions.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "Your product"
      },
      {
        "id": "background",
        "label": "Background",
        "default": "Warm ivory"
      },
      {
        "id": "lighting",
        "label": "Lighting",
        "default": "Large softbox"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "image-look-2",
    "feature": "image",
    "title": "Editorial colour story",
    "purpose": "A bold, colour-led image for your feed.",
    "category": "Images",
    "slots": [
      {
        "id": "reference-0",
        "label": "Reference image",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this image treatment. Subject: {Subject}; Palette: {Palette}; Style: {Style}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "An adult fashion creator"
      },
      {
        "id": "palette",
        "label": "Palette",
        "default": "Cobalt and butter yellow"
      },
      {
        "id": "style",
        "label": "Style",
        "default": "Modern editorial"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "image-look-3",
    "feature": "image",
    "title": "Quiet architecture",
    "purpose": "Turn a place into a considered visual story.",
    "category": "Images",
    "slots": [
      {
        "id": "reference-0",
        "label": "Reference image",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this image treatment. Subject: {Subject}; Time: {Time}; Style: {Style}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "A modern city building"
      },
      {
        "id": "time",
        "label": "Time",
        "default": "Blue hour"
      },
      {
        "id": "style",
        "label": "Style",
        "default": "Architectural editorial"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "video-look-1",
    "feature": "video",
    "title": "The slow reveal",
    "purpose": "A measured reveal that makes a product feel special.",
    "category": "Cinematic",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your starting image",
        "role": "first_frame",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this video treatment. Subject: {Subject}; Movement: {Movement}; Lighting: {Lighting}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "Your product"
      },
      {
        "id": "movement",
        "label": "Movement",
        "default": "Slow push-in"
      },
      {
        "id": "lighting",
        "label": "Lighting",
        "default": "Soft studio"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your starting image"
  },
  {
    "id": "video-look-2",
    "feature": "video",
    "title": "Golden-hour walk",
    "purpose": "A relaxed lifestyle shot with gentle camera movement.",
    "category": "Cinematic",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your starting image",
        "role": "first_frame",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Create a continuous video shot of {Subject} in {Setting}. Use {Movement}, subtle natural movement, consistent identity and believable lighting.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "An adult creator"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "A sunlit city street"
      },
      {
        "id": "movement",
        "label": "Movement",
        "default": "Gentle tracking"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your starting image"
  },
  {
    "id": "video-look-3",
    "feature": "video",
    "title": "After hours",
    "purpose": "A moody city sequence with controlled movement.",
    "category": "Cinematic",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your starting image",
        "role": "first_frame",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this video treatment. Setting: {Setting}; Movement: {Movement}; Lighting: {Lighting}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "setting",
        "label": "Setting",
        "default": "A neon city after rain"
      },
      {
        "id": "movement",
        "label": "Movement",
        "default": "Slow tracking shot"
      },
      {
        "id": "lighting",
        "label": "Lighting",
        "default": "Blue and amber"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your starting image"
  },
  {
    "id": "audio-look-1",
    "feature": "audio",
    "title": "Warm brand narration",
    "purpose": "A clear, welcoming voice for your brand story.",
    "category": "Audio",
    "slots": [],
    "settings": {},
    "promptTemplate": "Create a voice or sound treatment from these directions: {Script}. Tone: {Tone}. Pace: {Pace}. Preserve clarity and natural delivery.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "script",
        "label": "Script",
        "default": "A little care makes all the difference."
      },
      {
        "id": "tone",
        "label": "Tone",
        "default": "Warm and thoughtful"
      },
      {
        "id": "pace",
        "label": "Pace",
        "default": "Measured"
      }
    ],
    "durationLabel": "30 s",
    "referenceLabel": "No upload needed"
  },
  {
    "id": "audio-look-2",
    "feature": "audio",
    "title": "Atmospheric sound design",
    "purpose": "Build a textured soundscape around a scene.",
    "category": "Audio",
    "slots": [],
    "settings": {},
    "promptTemplate": "Use the supplied references for this audio treatment. Sound: {Sound}; Layers: {Layers}; Intensity: {Intensity}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "sound",
        "label": "Sound",
        "default": "A forest awakening at dawn"
      },
      {
        "id": "layers",
        "label": "Layers",
        "default": "Birds, breeze, distant water"
      },
      {
        "id": "intensity",
        "label": "Intensity",
        "default": "Subtle"
      }
    ],
    "durationLabel": "30 s",
    "referenceLabel": "No upload needed"
  },
  {
    "id": "audio-look-3",
    "feature": "audio",
    "title": "A new voice, same words",
    "purpose": "Transform a supplied voice recording.",
    "category": "Audio",
    "slots": [
      {
        "id": "reference-0",
        "label": "Source voice recording",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "audio"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this audio treatment. Voice: {Voice}; Delivery: {Delivery}; Language: {Language}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "voice",
        "label": "Voice",
        "default": "Warm narrator"
      },
      {
        "id": "delivery",
        "label": "Delivery",
        "default": "Natural"
      },
      {
        "id": "language",
        "label": "Language",
        "default": "English"
      }
    ],
    "durationLabel": "30 s",
    "referenceLabel": "Source voice recording"
  },
  {
    "id": "music-look-1",
    "feature": "music",
    "title": "The cinematic lift",
    "purpose": "A soundtrack that builds towards a hopeful ending.",
    "category": "Audio",
    "slots": [],
    "settings": {},
    "promptTemplate": "Compose an original instrumental soundtrack. Mood: {Mood}. Instruments: {Instruments}. Tempo: {Tempo}. Build a coherent beginning and ending; no vocals.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "mood",
        "label": "Mood",
        "default": "Hopeful"
      },
      {
        "id": "instruments",
        "label": "Instruments",
        "default": "Piano and strings"
      },
      {
        "id": "tempo",
        "label": "Tempo",
        "default": "Slow build"
      }
    ],
    "durationLabel": "30 s",
    "referenceLabel": "No upload needed"
  },
  {
    "id": "music-look-2",
    "feature": "music",
    "title": "Late-night atmosphere",
    "purpose": "A restrained electronic mood for urban footage.",
    "category": "Audio",
    "slots": [],
    "settings": {},
    "promptTemplate": "Compose an original instrumental soundtrack. Mood: {Mood}. Instruments: {Instruments}. Tempo: {Tempo}. Build a coherent beginning and ending; no vocals.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "mood",
        "label": "Mood",
        "default": "Atmospheric"
      },
      {
        "id": "instruments",
        "label": "Instruments",
        "default": "Analog synths and soft drums"
      },
      {
        "id": "tempo",
        "label": "Tempo",
        "default": "Medium"
      }
    ],
    "durationLabel": "30 s",
    "referenceLabel": "No upload needed"
  },
  {
    "id": "music-look-3",
    "feature": "music",
    "title": "A playful little rhythm",
    "purpose": "Light, upbeat music for product stories.",
    "category": "Audio",
    "slots": [],
    "settings": {},
    "promptTemplate": "Compose an original instrumental soundtrack. Mood: {Mood}. Instruments: {Instruments}. Tempo: {Tempo}. Build a coherent beginning and ending; no vocals.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "mood",
        "label": "Mood",
        "default": "Playful"
      },
      {
        "id": "instruments",
        "label": "Instruments",
        "default": "Plucked strings and hand percussion"
      },
      {
        "id": "tempo",
        "label": "Tempo",
        "default": "Upbeat"
      }
    ],
    "durationLabel": "30 s",
    "referenceLabel": "No upload needed"
  },
  {
    "id": "edit-look-1",
    "feature": "edit",
    "title": "A new backdrop",
    "purpose": "Keep your product; change its surroundings.",
    "category": "Images",
    "slots": [
      {
        "id": "reference-0",
        "label": "Image to edit",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Edit the supplied image. {Background}. {Lighting}. Preserve {Keep}. Make changes coherent with the original scene and natural light.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "background",
        "label": "Background",
        "default": "Warm sandstone studio"
      },
      {
        "id": "lighting",
        "label": "Lighting",
        "default": "Soft studio"
      },
      {
        "id": "keep",
        "label": "Keep",
        "default": "Packaging, logo and proportions"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Image to edit"
  },
  {
    "id": "edit-look-2",
    "feature": "edit",
    "title": "Remove the distraction",
    "purpose": "Clean up a scene without changing the subject.",
    "category": "Images",
    "slots": [
      {
        "id": "reference-0",
        "label": "Image to edit",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this edit treatment. Remove: {Remove}; Keep: {Keep}; Finish: {Finish}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "remove",
        "label": "Remove",
        "default": "Background distractions"
      },
      {
        "id": "keep",
        "label": "Keep",
        "default": "The subject and original framing"
      },
      {
        "id": "finish",
        "label": "Finish",
        "default": "Natural"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Image to edit"
  },
  {
    "id": "edit-look-3",
    "feature": "edit",
    "title": "Campaign wardrobe",
    "purpose": "Explore a new outfit on a consistent character.",
    "category": "Images",
    "slots": [
      {
        "id": "reference-0",
        "label": "Image to edit",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this edit treatment. Wardrobe: {Wardrobe}; Setting: {Setting}; Keep: {Keep}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "wardrobe",
        "label": "Wardrobe",
        "default": "An elegant neutral blazer"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "Minimal editorial studio"
      },
      {
        "id": "keep",
        "label": "Keep",
        "default": "Identity and expression"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Image to edit"
  },
  {
    "id": "enhance-look-1",
    "feature": "enhance",
    "title": "Sharper, still natural",
    "purpose": "Upscale an image without an overprocessed finish.",
    "category": "Effects",
    "slots": [
      {
        "id": "reference-0",
        "label": "Source image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Enhance the supplied media with {Scale}, {Detail}, and {Finish}. Preserve identity and source composition. Avoid invented detail.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "scale",
        "label": "Scale",
        "default": "2×"
      },
      {
        "id": "detail",
        "label": "Detail",
        "default": "Natural textures"
      },
      {
        "id": "finish",
        "label": "Finish",
        "default": "Clean"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Source image"
  },
  {
    "id": "enhance-look-2",
    "feature": "enhance",
    "title": "Made for vertical",
    "purpose": "Reframe existing footage for a vertical feed.",
    "category": "Effects",
    "slots": [
      {
        "id": "reference-0",
        "label": "Source video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this enhance treatment. Format: {Format}; Focus: {Focus}; Captions: {Captions}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "format",
        "label": "Format",
        "default": "9:16"
      },
      {
        "id": "focus",
        "label": "Focus",
        "default": "Keep the main subject centred"
      },
      {
        "id": "captions",
        "label": "Captions",
        "default": "Off"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Source video"
  },
  {
    "id": "enhance-look-3",
    "feature": "enhance",
    "title": "A little more time",
    "purpose": "Extend a video with a coherent continuation.",
    "category": "Effects",
    "slots": [
      {
        "id": "reference-0",
        "label": "Source video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this enhance treatment. Extension: {Extension}; Motion: {Motion}; Finish: {Finish}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "extension",
        "label": "Extension",
        "default": "A gentle continuation"
      },
      {
        "id": "motion",
        "label": "Motion",
        "default": "Match the source"
      },
      {
        "id": "finish",
        "label": "Finish",
        "default": "Seamless"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Source video"
  },
  {
    "id": "characters-look-1",
    "feature": "characters",
    "title": "The everyday creator",
    "purpose": "An approachable, consistent face for your stories.",
    "category": "Characters",
    "slots": [
      {
        "id": "reference-0",
        "label": "Character reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Build a consistent fictional adult identity: {Subject}. Wardrobe: {Wardrobe}. Expression: {Expression}. Create coherent portrait variations and a reusable identity reference.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "An adult lifestyle creator"
      },
      {
        "id": "wardrobe",
        "label": "Wardrobe",
        "default": "Relaxed neutral clothing"
      },
      {
        "id": "expression",
        "label": "Expression",
        "default": "Warm smile"
      }
    ],
    "durationLabel": "4 portraits",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "characters-look-2",
    "feature": "characters",
    "title": "The editorial muse",
    "purpose": "A distinctive identity with a fashion-led look.",
    "category": "Characters",
    "slots": [
      {
        "id": "reference-0",
        "label": "Character reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Build a consistent fictional adult identity: {Subject}. Wardrobe: {Wardrobe}. Expression: {Expression}. Create coherent portrait variations and a reusable identity reference.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "An adult fashion storyteller"
      },
      {
        "id": "wardrobe",
        "label": "Wardrobe",
        "default": "Sculptural contemporary pieces"
      },
      {
        "id": "expression",
        "label": "Expression",
        "default": "Confident"
      }
    ],
    "durationLabel": "4 portraits",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "characters-look-3",
    "feature": "characters",
    "title": "The thoughtful host",
    "purpose": "A calm presenter for explainers and brand films.",
    "category": "Characters",
    "slots": [
      {
        "id": "reference-0",
        "label": "Character reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Build a consistent fictional adult identity: {Subject}. Wardrobe: {Wardrobe}. Expression: {Expression}. Create coherent portrait variations and a reusable identity reference.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "An adult expert presenter"
      },
      {
        "id": "wardrobe",
        "label": "Wardrobe",
        "default": "Casual business clothing"
      },
      {
        "id": "expression",
        "label": "Expression",
        "default": "Thoughtful"
      }
    ],
    "durationLabel": "4 portraits",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "identity-training-look-1",
    "feature": "identity-training",
    "title": "Your consistent creator",
    "purpose": "Prepare an identity from approved reference photos.",
    "category": "Characters",
    "slots": [
      {
        "id": "reference-0",
        "label": "Approved training photos",
        "role": "subject",
        "required": true,
        "limit": 20,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Prepare identity training for {Name}. Style: {Style}. Intended use: {Use}. Use only the approved reference photos and preserve a consistent identity.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "name",
        "label": "Name",
        "default": "My creator identity"
      },
      {
        "id": "style",
        "label": "Style",
        "default": "Photorealistic"
      },
      {
        "id": "use",
        "label": "Use",
        "default": "Lifestyle storytelling"
      }
    ],
    "durationLabel": "Identity",
    "referenceLabel": "Approved training photos"
  },
  {
    "id": "identity-training-look-2",
    "feature": "identity-training",
    "title": "The campaign identity",
    "purpose": "A reusable identity for a coherent campaign.",
    "category": "Characters",
    "slots": [
      {
        "id": "reference-0",
        "label": "Approved training photos",
        "role": "subject",
        "required": true,
        "limit": 20,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Prepare identity training for {Name}. Style: {Style}. Intended use: {Use}. Use only the approved reference photos and preserve a consistent identity.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "name",
        "label": "Name",
        "default": "Campaign lead"
      },
      {
        "id": "style",
        "label": "Style",
        "default": "Editorial"
      },
      {
        "id": "use",
        "label": "Use",
        "default": "Brand imagery"
      }
    ],
    "durationLabel": "Identity",
    "referenceLabel": "Approved training photos"
  },
  {
    "id": "identity-training-look-3",
    "feature": "identity-training",
    "title": "Your on-screen host",
    "purpose": "Keep a presenter recognisable across scenes.",
    "category": "Characters",
    "slots": [
      {
        "id": "reference-0",
        "label": "Approved training photos",
        "role": "subject",
        "required": true,
        "limit": 20,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Prepare identity training for {Name}. Style: {Style}. Intended use: {Use}. Use only the approved reference photos and preserve a consistent identity.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "name",
        "label": "Name",
        "default": "Studio host"
      },
      {
        "id": "style",
        "label": "Style",
        "default": "Natural studio"
      },
      {
        "id": "use",
        "label": "Use",
        "default": "Presentations and explainers"
      }
    ],
    "durationLabel": "Identity",
    "referenceLabel": "Approved training photos"
  },
  {
    "id": "elements-look-1",
    "feature": "elements",
    "title": "The signature product",
    "purpose": "Save a named product reference for future scenes.",
    "category": "Characters",
    "slots": [
      {
        "id": "reference-0",
        "label": "Element reference",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Create a reusable reference element named {Name}. Preserve {Preserve}. Save to {Collection}. Keep the reference consistent for future generation.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "name",
        "label": "Name",
        "default": "Signature product"
      },
      {
        "id": "preserve",
        "label": "Preserve",
        "default": "Packaging and material details"
      },
      {
        "id": "collection",
        "label": "Collection",
        "default": "Brand essentials"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Element reference"
  },
  {
    "id": "elements-look-2",
    "feature": "elements",
    "title": "A place to return to",
    "purpose": "A reusable location reference for consistent stories.",
    "category": "Characters",
    "slots": [
      {
        "id": "reference-0",
        "label": "Element reference",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Create a reusable reference element named {Name}. Preserve {Preserve}. Save to {Collection}. Keep the reference consistent for future generation.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "name",
        "label": "Name",
        "default": "Our city location"
      },
      {
        "id": "preserve",
        "label": "Preserve",
        "default": "Architecture and atmosphere"
      },
      {
        "id": "collection",
        "label": "Collection",
        "default": "Story locations"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Element reference"
  },
  {
    "id": "elements-look-3",
    "feature": "elements",
    "title": "The visual identity",
    "purpose": "Keep a palette and visual treatment ready to reuse.",
    "category": "Characters",
    "slots": [
      {
        "id": "reference-0",
        "label": "Element reference",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Create a reusable reference element named {Name}. Preserve {Preserve}. Save to {Collection}. Keep the reference consistent for future generation.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "name",
        "label": "Name",
        "default": "Natural editorial"
      },
      {
        "id": "preserve",
        "label": "Preserve",
        "default": "Palette, light and texture"
      },
      {
        "id": "collection",
        "label": "Collection",
        "default": "Brand styles"
      }
    ],
    "durationLabel": "1 image",
    "referenceLabel": "Element reference"
  },
  {
    "id": "motion-look-1",
    "feature": "motion",
    "title": "Recast the walk",
    "purpose": "Bring the movement of a reference into your character.",
    "category": "Motion",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your character image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      },
      {
        "id": "reference-1",
        "label": "Motion reference clip",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Transfer motion from the supplied reference onto {Character}. Setting: {Setting}. Timing: {Timing}. Preserve anatomy, identity and coherent movement.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "character",
        "label": "Character",
        "default": "My selected character"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "Match the motion reference"
      },
      {
        "id": "timing",
        "label": "Timing",
        "default": "Preserve source timing"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your character image + Motion reference clip"
  },
  {
    "id": "motion-look-2",
    "feature": "motion",
    "title": "One gesture, your character",
    "purpose": "Transfer a natural gesture into a new identity.",
    "category": "Motion",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your character image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      },
      {
        "id": "reference-1",
        "label": "Motion reference clip",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this motion treatment. Character: {Character}; Movement: {Movement}; Framing: {Framing}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "character",
        "label": "Character",
        "default": "My presenter"
      },
      {
        "id": "movement",
        "label": "Movement",
        "default": "Use the supplied gesture"
      },
      {
        "id": "framing",
        "label": "Framing",
        "default": "Waist-up"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your character image + Motion reference clip"
  },
  {
    "id": "motion-look-3",
    "feature": "motion",
    "title": "The performance reference",
    "purpose": "Build a consistent shot from a movement reference.",
    "category": "Motion",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your character image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      },
      {
        "id": "reference-1",
        "label": "Motion reference clip",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Transfer motion from the supplied reference onto {Character}. Setting: {Setting}. Timing: {Timing}. Preserve anatomy, identity and coherent movement.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "character",
        "label": "Character",
        "default": "My campaign identity"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "Minimal studio"
      },
      {
        "id": "timing",
        "label": "Timing",
        "default": "Match reference"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your character image + Motion reference clip"
  },
  {
    "id": "swap-look-1",
    "feature": "swap",
    "title": "A different leading role",
    "purpose": "Replace a subject while keeping the original scene.",
    "category": "Motion",
    "slots": [
      {
        "id": "reference-0",
        "label": "Source video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      },
      {
        "id": "reference-1",
        "label": "Replacement reference",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Restyle the source footage with {Replace}. Keep {Keep}. Use {Identity}. Maintain camera continuity, timing and believable lighting.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "replace",
        "label": "Replace",
        "default": "The main subject"
      },
      {
        "id": "keep",
        "label": "Keep",
        "default": "Camera, scene and timing"
      },
      {
        "id": "identity",
        "label": "Identity",
        "default": "My uploaded character"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Source video + Replacement reference"
  },
  {
    "id": "swap-look-2",
    "feature": "swap",
    "title": "A fresh wardrobe",
    "purpose": "Restyle an outfit in existing footage.",
    "category": "Motion",
    "slots": [
      {
        "id": "reference-0",
        "label": "Source video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      },
      {
        "id": "reference-1",
        "label": "Replacement reference",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this swap treatment. Wardrobe: {Wardrobe}; Keep: {Keep}; Finish: {Finish}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "wardrobe",
        "label": "Wardrobe",
        "default": "Contemporary neutral tailoring"
      },
      {
        "id": "keep",
        "label": "Keep",
        "default": "Motion and identity"
      },
      {
        "id": "finish",
        "label": "Finish",
        "default": "Natural fabric detail"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Source video + Replacement reference"
  },
  {
    "id": "swap-look-3",
    "feature": "swap",
    "title": "A new visual world",
    "purpose": "Reimagine the look of your footage.",
    "category": "Motion",
    "slots": [
      {
        "id": "reference-0",
        "label": "Source video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      },
      {
        "id": "reference-1",
        "label": "Replacement reference",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this swap treatment. Style: {Style}; Keep: {Keep}; Palette: {Palette}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "style",
        "label": "Style",
        "default": "Cinematic neon"
      },
      {
        "id": "keep",
        "label": "Keep",
        "default": "Composition and movement"
      },
      {
        "id": "palette",
        "label": "Palette",
        "default": "Blue and amber"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Source video + Replacement reference"
  },
  {
    "id": "effects-look-1",
    "feature": "effects",
    "title": "Golden-hour glow",
    "purpose": "A warm relighting treatment for an existing scene.",
    "category": "Effects",
    "slots": [
      {
        "id": "reference-0",
        "label": "Source image or video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image",
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Apply a controlled visual treatment. Lighting: {Lighting}. Atmosphere: {Atmosphere}. Strength: {Strength}. Preserve the source subject and composition.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "lighting",
        "label": "Lighting",
        "default": "Golden hour"
      },
      {
        "id": "atmosphere",
        "label": "Atmosphere",
        "default": "Soft haze"
      },
      {
        "id": "strength",
        "label": "Strength",
        "default": "Subtle"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Source image or video"
  },
  {
    "id": "effects-look-2",
    "feature": "effects",
    "title": "The film finish",
    "purpose": "Add texture and restraint to a polished shot.",
    "category": "Effects",
    "slots": [
      {
        "id": "reference-0",
        "label": "Source image or video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image",
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this effects treatment. Grain: {Grain}; Contrast: {Contrast}; Palette: {Palette}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "grain",
        "label": "Grain",
        "default": "Fine 35mm"
      },
      {
        "id": "contrast",
        "label": "Contrast",
        "default": "Soft cinematic"
      },
      {
        "id": "palette",
        "label": "Palette",
        "default": "Natural"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Source image or video"
  },
  {
    "id": "effects-look-3",
    "feature": "effects",
    "title": "Dreamlike atmosphere",
    "purpose": "Give a scene a soft, otherworldly mood.",
    "category": "Effects",
    "slots": [
      {
        "id": "reference-0",
        "label": "Source image or video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image",
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this effects treatment. Atmosphere: {Atmosphere}; Motion: {Motion}; Strength: {Strength}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "atmosphere",
        "label": "Atmosphere",
        "default": "Soft bloom"
      },
      {
        "id": "motion",
        "label": "Motion",
        "default": "Slow and gentle"
      },
      {
        "id": "strength",
        "label": "Strength",
        "default": "Balanced"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Source image or video"
  },
  {
    "id": "avatar-look-1",
    "feature": "avatar",
    "title": "A warm introduction",
    "purpose": "Turn a portrait and a few words into an introduction.",
    "category": "Avatars",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your portrait",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Animate a consenting adult or fictional presenter from the reference. Say: \"{Script}\". Delivery: {Delivery}. Setting: {Setting}. Natural expression and clear speech.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "script",
        "label": "Script",
        "default": "Hi, I’m Luna. Welcome to a new way of creating."
      },
      {
        "id": "delivery",
        "label": "Delivery",
        "default": "Warm and confident"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "A softly lit studio"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your portrait"
  },
  {
    "id": "avatar-look-2",
    "feature": "avatar",
    "title": "Your product, explained",
    "purpose": "A friendly presenter makes the benefit clear.",
    "category": "Avatars",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your portrait",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Animate a consenting adult or fictional presenter from the reference. Say: \"{Script}\". Delivery: {Delivery}. Setting: {Setting}. Natural expression and clear speech.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "script",
        "label": "Script",
        "default": "Here is one small change that can make your day easier."
      },
      {
        "id": "delivery",
        "label": "Delivery",
        "default": "Clear and reassuring"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "Clean brand studio"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your portrait"
  },
  {
    "id": "avatar-look-3",
    "feature": "avatar",
    "title": "The expert take",
    "purpose": "Give an idea a calm, credible delivery.",
    "category": "Avatars",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your portrait",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Animate a consenting adult or fictional presenter from the reference. Say: \"{Script}\". Delivery: {Delivery}. Setting: {Setting}. Natural expression and clear speech.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "script",
        "label": "Script",
        "default": "Let’s break this idea into three simple steps."
      },
      {
        "id": "delivery",
        "label": "Delivery",
        "default": "Calm and thoughtful"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "Minimal office"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your portrait"
  },
  {
    "id": "lipsync-look-1",
    "feature": "lipsync",
    "title": "Every word in sync",
    "purpose": "Match a supplied voice track to your footage.",
    "category": "Avatars",
    "slots": [
      {
        "id": "reference-0",
        "label": "Presenter video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      },
      {
        "id": "reference-1",
        "label": "Speech audio",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "audio"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Match the supplied speech to the presenter footage. Delivery: {Delivery}. Focus: {Focus}. Keep {Keep}. Align mouth movement with the audio and preserve identity.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "delivery",
        "label": "Delivery",
        "default": "Natural"
      },
      {
        "id": "focus",
        "label": "Focus",
        "default": "Clear speech and believable expression"
      },
      {
        "id": "keep",
        "label": "Keep",
        "default": "Original identity"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Presenter video + Speech audio"
  },
  {
    "id": "lipsync-look-2",
    "feature": "lipsync",
    "title": "A new language, same face",
    "purpose": "Prepare a spoken-language version of a clip.",
    "category": "Avatars",
    "slots": [
      {
        "id": "reference-0",
        "label": "Presenter video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      },
      {
        "id": "reference-1",
        "label": "Speech audio",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "audio"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this lipsync treatment. Language: {Language}; Delivery: {Delivery}; Keep: {Keep}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "language",
        "label": "Language",
        "default": "Arabic"
      },
      {
        "id": "delivery",
        "label": "Delivery",
        "default": "Calm and clear"
      },
      {
        "id": "keep",
        "label": "Keep",
        "default": "Identity and framing"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Presenter video + Speech audio"
  },
  {
    "id": "lipsync-look-3",
    "feature": "lipsync",
    "title": "Your voiceover, on screen",
    "purpose": "Connect a presenter clip with your chosen speech.",
    "category": "Avatars",
    "slots": [
      {
        "id": "reference-0",
        "label": "Presenter video",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      },
      {
        "id": "reference-1",
        "label": "Speech audio",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "audio"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this lipsync treatment. Delivery: {Delivery}; Timing: {Timing}; Keep: {Keep}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "delivery",
        "label": "Delivery",
        "default": "Expressive"
      },
      {
        "id": "timing",
        "label": "Timing",
        "default": "Match supplied audio"
      },
      {
        "id": "keep",
        "label": "Keep",
        "default": "The original look"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Presenter video + Speech audio"
  },
  {
    "id": "shorts-look-1",
    "feature": "shorts",
    "title": "The strongest hook",
    "purpose": "Find two moments that stand on their own.",
    "category": "Shorts",
    "slots": [
      {
        "id": "reference-0",
        "label": "Long-form footage",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Find self-contained short clips from the supplied long-form footage. Topic: {Topic}. Focus: {Focus}. Length: {Length}. Preserve context and add readable captions.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "topic",
        "label": "Topic",
        "default": "The key insights in my footage"
      },
      {
        "id": "focus",
        "label": "Focus",
        "default": "Strong opening hooks"
      },
      {
        "id": "length",
        "label": "Length",
        "default": "15–30 seconds"
      }
    ],
    "durationLabel": "2 shorts",
    "referenceLabel": "Long-form footage"
  },
  {
    "id": "shorts-look-2",
    "feature": "shorts",
    "title": "Expertise in a minute",
    "purpose": "Pull clear, useful explanations from a longer recording.",
    "category": "Shorts",
    "slots": [
      {
        "id": "reference-0",
        "label": "Long-form footage",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Find self-contained short clips from the supplied long-form footage. Topic: {Topic}. Focus: {Focus}. Length: {Length}. Preserve context and add readable captions.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "topic",
        "label": "Topic",
        "default": "Practical expert advice"
      },
      {
        "id": "focus",
        "label": "Focus",
        "default": "One useful takeaway per clip"
      },
      {
        "id": "length",
        "label": "Length",
        "default": "30–60 seconds"
      }
    ],
    "durationLabel": "2 shorts",
    "referenceLabel": "Long-form footage"
  },
  {
    "id": "shorts-look-3",
    "feature": "shorts",
    "title": "Product moments",
    "purpose": "Turn a longer demo into concise product clips.",
    "category": "Shorts",
    "slots": [
      {
        "id": "reference-0",
        "label": "Long-form footage",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Find self-contained short clips from the supplied long-form footage. Topic: {Topic}. Focus: {Focus}. Length: {Length}. Preserve context and add readable captions.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "topic",
        "label": "Topic",
        "default": "The best product benefits"
      },
      {
        "id": "focus",
        "label": "Focus",
        "default": "Demonstrations and useful details"
      },
      {
        "id": "length",
        "label": "Length",
        "default": "15–30 seconds"
      }
    ],
    "durationLabel": "2 shorts",
    "referenceLabel": "Long-form footage"
  },
  {
    "id": "explainer-look-1",
    "feature": "explainer",
    "title": "One idea, three scenes",
    "purpose": "A ready-made structure for a faceless explainer.",
    "category": "Shorts",
    "slots": [
      {
        "id": "reference-0",
        "label": "Visual reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Develop a short faceless explainer about {Topic}. Style: {Style}. Tone: {Tone}. Use a strong opening, three clear scenes, narration and a memorable final takeaway.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "topic",
        "label": "Topic",
        "default": "Why the ocean changes colour"
      },
      {
        "id": "style",
        "label": "Style",
        "default": "Cinematic nature"
      },
      {
        "id": "tone",
        "label": "Tone",
        "default": "Curious and warm"
      }
    ],
    "durationLabel": "30 s",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "explainer-look-2",
    "feature": "explainer",
    "title": "Make it make sense",
    "purpose": "A clear educational story, built from a topic.",
    "category": "Shorts",
    "slots": [
      {
        "id": "reference-0",
        "label": "Visual reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Develop a short faceless explainer about {Topic}. Style: {Style}. Tone: {Tone}. Use a strong opening, three clear scenes, narration and a memorable final takeaway.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "topic",
        "label": "Topic",
        "default": "How a simple daily habit works"
      },
      {
        "id": "style",
        "label": "Style",
        "default": "Clean editorial"
      },
      {
        "id": "tone",
        "label": "Tone",
        "default": "Friendly and clear"
      }
    ],
    "durationLabel": "30 s",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "explainer-look-3",
    "feature": "explainer",
    "title": "The product story",
    "purpose": "Explain a product benefit in plain language.",
    "category": "Shorts",
    "slots": [
      {
        "id": "reference-0",
        "label": "Visual reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Develop a short faceless explainer about {Topic}. Style: {Style}. Tone: {Tone}. Use a strong opening, three clear scenes, narration and a memorable final takeaway.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "topic",
        "label": "Topic",
        "default": "Why cold-pressed oils preserve flavour"
      },
      {
        "id": "style",
        "label": "Style",
        "default": "Premium product editorial"
      },
      {
        "id": "tone",
        "label": "Tone",
        "default": "Warm and informative"
      }
    ],
    "durationLabel": "30 s",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "storyboard-look-1",
    "feature": "storyboard",
    "title": "The brand journey",
    "purpose": "A three-scene story with a clear emotional arc.",
    "category": "Story",
    "slots": [
      {
        "id": "reference-0",
        "label": "Story reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Plan a coherent three-scene storyboard about {Subject}. Setting: {Setting}. Closing message: {Message}. Include scene direction, keyframe intent and timing.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "Our outdoor brand"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "The mountains at first light"
      },
      {
        "id": "message",
        "label": "Message",
        "default": "Go a little further"
      }
    ],
    "durationLabel": "3 scenes",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "storyboard-look-2",
    "feature": "storyboard",
    "title": "A product, in three acts",
    "purpose": "Hook, benefit, hero: a simple campaign sequence.",
    "category": "Story",
    "slots": [
      {
        "id": "reference-0",
        "label": "Story reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Plan a coherent three-scene storyboard about {Subject}. Setting: {Setting}. Closing message: {Message}. Include scene direction, keyframe intent and timing.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "Our signature product"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "Warm minimal studio"
      },
      {
        "id": "message",
        "label": "Message",
        "default": "Discover the difference"
      }
    ],
    "durationLabel": "3 scenes",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "storyboard-look-3",
    "feature": "storyboard",
    "title": "A day worth remembering",
    "purpose": "A human story with a beginning, middle and ending.",
    "category": "Story",
    "slots": [
      {
        "id": "reference-0",
        "label": "Story reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Plan a coherent three-scene storyboard about {Subject}. Setting: {Setting}. Closing message: {Message}. Include scene direction, keyframe intent and timing.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "An adult travel creator"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "A beautiful new city"
      },
      {
        "id": "message",
        "label": "Message",
        "default": "Find your own way"
      }
    ],
    "durationLabel": "3 scenes",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "cinema-look-1",
    "feature": "cinema",
    "title": "The endless horizon",
    "purpose": "A sweeping establishing shot, already directed.",
    "category": "Cinematic",
    "slots": [
      {
        "id": "reference-0",
        "label": "Opening frame",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Direct a cinematic shot of {Subject}. Setting: {Setting}. Camera: {Movement}. Use controlled light, strong composition and deliberate pacing.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "A solitary traveller"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "A desert at dawn"
      },
      {
        "id": "movement",
        "label": "Movement",
        "default": "Slow push-in"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "cinema-look-2",
    "feature": "cinema",
    "title": "A world from above",
    "purpose": "An expansive landscape with deliberate camera direction.",
    "category": "Cinematic",
    "slots": [
      {
        "id": "reference-0",
        "label": "Opening frame",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Direct a cinematic shot of {Subject}. Setting: {Setting}. Camera: {Movement}. Use controlled light, strong composition and deliberate pacing.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "A mountain landscape"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "First light"
      },
      {
        "id": "movement",
        "label": "Movement",
        "default": "Gentle aerial glide"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "cinema-look-3",
    "feature": "cinema",
    "title": "The intimate close-up",
    "purpose": "A cinematic portrait with soft light and depth.",
    "category": "Cinematic",
    "slots": [
      {
        "id": "reference-0",
        "label": "Opening frame",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this cinema treatment. Subject: {Subject}; Lighting: {Lighting}; Movement: {Movement}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "My selected adult character"
      },
      {
        "id": "lighting",
        "label": "Lighting",
        "default": "Soft window light"
      },
      {
        "id": "movement",
        "label": "Movement",
        "default": "Slow push-in"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "editor-look-1",
    "feature": "editor",
    "title": "The clean social cut",
    "purpose": "A clear edit with considered pacing and captions.",
    "category": "Story",
    "slots": [
      {
        "id": "reference-0",
        "label": "Footage to edit",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Edit the supplied footage with {Pacing}. Output format: {Format}. Captions: {Captions}. Keep clean cuts, coherent audio and a clear final beat.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "pacing",
        "label": "Pacing",
        "default": "Fast opening, measured finish"
      },
      {
        "id": "format",
        "label": "Format",
        "default": "9:16"
      },
      {
        "id": "captions",
        "label": "Captions",
        "default": "Clean editorial"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Footage to edit"
  },
  {
    "id": "editor-look-2",
    "feature": "editor",
    "title": "The product sequence",
    "purpose": "Arrange product footage into a short, polished story.",
    "category": "Story",
    "slots": [
      {
        "id": "reference-0",
        "label": "Footage to edit",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Edit the supplied footage with {Pacing}. Output format: {Format}. Captions: {Captions}. Keep clean cuts, coherent audio and a clear final beat.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "pacing",
        "label": "Pacing",
        "default": "Three deliberate moments"
      },
      {
        "id": "format",
        "label": "Format",
        "default": "16:9"
      },
      {
        "id": "captions",
        "label": "Captions",
        "default": "Minimal"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Footage to edit"
  },
  {
    "id": "editor-look-3",
    "feature": "editor",
    "title": "A quieter pace",
    "purpose": "Trim and arrange footage with room to breathe.",
    "category": "Story",
    "slots": [
      {
        "id": "reference-0",
        "label": "Footage to edit",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Edit the supplied footage with {Pacing}. Output format: {Format}. Captions: {Captions}. Keep clean cuts, coherent audio and a clear final beat.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "pacing",
        "label": "Pacing",
        "default": "Slow and atmospheric"
      },
      {
        "id": "format",
        "label": "Format",
        "default": "16:9"
      },
      {
        "id": "captions",
        "label": "Captions",
        "default": "Off"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Footage to edit"
  },
  {
    "id": "ads-look-1",
    "feature": "ads",
    "title": "The benefit-first ad",
    "purpose": "Lead with what the product does for your customer.",
    "category": "Product ads",
    "slots": [
      {
        "id": "reference-0",
        "label": "Brand or product image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Create an ad concept for {Product}. Main benefit: {Benefit}. Call to action: {CTA}. Lead with a clear hook, show the value, and finish with a readable CTA.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "product",
        "label": "Product",
        "default": "Our signature product"
      },
      {
        "id": "benefit",
        "label": "Benefit",
        "default": "A simple everyday improvement"
      },
      {
        "id": "cta",
        "label": "CTA",
        "default": "Discover more"
      }
    ],
    "durationLabel": "3 scenes",
    "referenceLabel": "Brand or product image"
  },
  {
    "id": "ads-look-2",
    "feature": "ads",
    "title": "The problem, solved",
    "purpose": "A ready-made problem-to-solution ad structure.",
    "category": "Product ads",
    "slots": [
      {
        "id": "reference-0",
        "label": "Brand or product image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this ads treatment. Product: {Product}; Problem: {Problem}; CTA: {CTA}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "product",
        "label": "Product",
        "default": "Our cold-pressed oil"
      },
      {
        "id": "problem",
        "label": "Problem",
        "default": "Ordinary meals need more flavour"
      },
      {
        "id": "cta",
        "label": "CTA",
        "default": "Try it today"
      }
    ],
    "durationLabel": "3 scenes",
    "referenceLabel": "Brand or product image"
  },
  {
    "id": "ads-look-3",
    "feature": "ads",
    "title": "The launch moment",
    "purpose": "Give a new release a clear, confident introduction.",
    "category": "Product ads",
    "slots": [
      {
        "id": "reference-0",
        "label": "Brand or product image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this ads treatment. Product: {Product}; Message: {Message}; CTA: {CTA}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "product",
        "label": "Product",
        "default": "Our new collection"
      },
      {
        "id": "message",
        "label": "Message",
        "default": "Designed for your everyday"
      },
      {
        "id": "cta",
        "label": "CTA",
        "default": "Explore the collection"
      }
    ],
    "durationLabel": "3 scenes",
    "referenceLabel": "Brand or product image"
  },
  {
    "id": "marketing-look-1",
    "feature": "marketing",
    "title": "The hero orbit",
    "purpose": "Make your product the main character.",
    "category": "Product ads",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your product image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Create a premium product video featuring {Subject}. Setting: {Setting}. Lighting: {Lighting}. Preserve exact packaging, materials and proportions; use deliberate camera movement.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "Your product"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "Warm sandstone"
      },
      {
        "id": "lighting",
        "label": "Lighting",
        "default": "Soft studio"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your product image"
  },
  {
    "id": "marketing-look-2",
    "feature": "marketing",
    "title": "The morning ritual",
    "purpose": "A little everyday magic for your feed.",
    "category": "Product ads",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your product image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Create a premium product video featuring {Subject}. Setting: {Setting}. Lighting: {Lighting}. Preserve exact packaging, materials and proportions; use deliberate camera movement.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "Freshly brewed coffee"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "A minimal café"
      },
      {
        "id": "lighting",
        "label": "Lighting",
        "default": "Soft morning"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your product image"
  },
  {
    "id": "marketing-look-3",
    "feature": "marketing",
    "title": "The unboxing moment",
    "purpose": "A considered reveal from packaging to product.",
    "category": "Product ads",
    "slots": [
      {
        "id": "reference-0",
        "label": "Your product image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Create a premium product video featuring {Subject}. Setting: {Setting}. Lighting: {Lighting}. Preserve exact packaging, materials and proportions; use deliberate camera movement.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "subject",
        "label": "Subject",
        "default": "Our signature product"
      },
      {
        "id": "setting",
        "label": "Setting",
        "default": "A clean tabletop"
      },
      {
        "id": "lighting",
        "label": "Lighting",
        "default": "Soft studio"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Your product image"
  },
  {
    "id": "ad-remix-look-1",
    "feature": "ad-remix",
    "title": "A better opening",
    "purpose": "Keep the structure. Give the hook a fresh angle.",
    "category": "Product ads",
    "slots": [
      {
        "id": "reference-0",
        "label": "Reference ad",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      },
      {
        "id": "reference-1",
        "label": "Your product image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Remix the reference ad around {Product}. Opening hook: \"{Hook}\". Call to action: \"{CTA}\". Preserve effective structure while developing a distinct treatment.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "product",
        "label": "Product",
        "default": "Our artisan pizza"
      },
      {
        "id": "hook",
        "label": "Hook",
        "default": "Your new favourite Friday ritual"
      },
      {
        "id": "cta",
        "label": "CTA",
        "default": "Discover the menu"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Reference ad + Your product image"
  },
  {
    "id": "ad-remix-look-2",
    "feature": "ad-remix",
    "title": "A new call to action",
    "purpose": "Rework the ending for a different campaign goal.",
    "category": "Product ads",
    "slots": [
      {
        "id": "reference-0",
        "label": "Reference ad",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      },
      {
        "id": "reference-1",
        "label": "Your product image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Remix the reference ad around {Product}. Opening hook: \"{Hook}\". Call to action: \"{CTA}\". Preserve effective structure while developing a distinct treatment.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "product",
        "label": "Product",
        "default": "Our signature fragrance"
      },
      {
        "id": "hook",
        "label": "Hook",
        "default": "A moment that stays with you"
      },
      {
        "id": "cta",
        "label": "CTA",
        "default": "Explore the collection"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Reference ad + Your product image"
  },
  {
    "id": "ad-remix-look-3",
    "feature": "ad-remix",
    "title": "A new product, same rhythm",
    "purpose": "Recast a reference ad around your product.",
    "category": "Product ads",
    "slots": [
      {
        "id": "reference-0",
        "label": "Reference ad",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "video"
        ]
      },
      {
        "id": "reference-1",
        "label": "Your product image",
        "role": "subject",
        "required": true,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Remix the reference ad around {Product}. Opening hook: \"{Hook}\". Call to action: \"{CTA}\". Preserve effective structure while developing a distinct treatment.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "product",
        "label": "Product",
        "default": "Our cold-pressed oil"
      },
      {
        "id": "hook",
        "label": "Hook",
        "default": "More flavour, less effort"
      },
      {
        "id": "cta",
        "label": "CTA",
        "default": "Taste the difference"
      }
    ],
    "durationLabel": "8 s",
    "referenceLabel": "Reference ad + Your product image"
  },
  {
    "id": "canvas-look-1",
    "feature": "canvas",
    "title": "Product to campaign",
    "purpose": "A reusable reference-to-image-to-video workflow.",
    "category": "Workflows",
    "slots": [
      {
        "id": "reference-0",
        "label": "Starting reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Prepare a connected workflow for {Product}. Look: {Look}. Output: {Output}. Validate typed inputs and retain references through each creative step.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "product",
        "label": "Product",
        "default": "Our signature product"
      },
      {
        "id": "look",
        "label": "Look",
        "default": "Premium studio"
      },
      {
        "id": "output",
        "label": "Output",
        "default": "Vertical product video"
      }
    ],
    "durationLabel": "Workflow",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "canvas-look-2",
    "feature": "canvas",
    "title": "Topic to short",
    "purpose": "Connect planning, images, narration and editing.",
    "category": "Workflows",
    "slots": [
      {
        "id": "reference-0",
        "label": "Starting reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this canvas treatment. Topic: {Topic}; Style: {Style}; Output: {Output}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "topic",
        "label": "Topic",
        "default": "An unexpected nature fact"
      },
      {
        "id": "style",
        "label": "Style",
        "default": "Cinematic nature"
      },
      {
        "id": "output",
        "label": "Output",
        "default": "30-second explainer"
      }
    ],
    "durationLabel": "Workflow",
    "referenceLabel": "Reference optional"
  },
  {
    "id": "canvas-look-3",
    "feature": "canvas",
    "title": "A consistent character story",
    "purpose": "Carry one identity through a repeatable story workflow.",
    "category": "Workflows",
    "slots": [
      {
        "id": "reference-0",
        "label": "Starting reference",
        "role": "subject",
        "required": false,
        "limit": 1,
        "kinds": [
          "image"
        ]
      }
    ],
    "settings": {},
    "promptTemplate": "Use the supplied references for this canvas treatment. Character: {Character}; Story: {Story}; Output: {Output}. Preserve identity, visual consistency and the original creative intent. Produce a polished, coherent result.",
    "variants": [
      "Keep the prepared direction.",
      "Use a subtle variation while keeping the subject consistent."
    ],
    "clientOnly": true,
    "variables": [
      {
        "id": "character",
        "label": "Character",
        "default": "My saved identity"
      },
      {
        "id": "story",
        "label": "Story",
        "default": "A new discovery"
      },
      {
        "id": "output",
        "label": "Output",
        "default": "Three connected scenes"
      }
    ],
    "durationLabel": "Workflow",
    "referenceLabel": "Reference optional"
  }
]

// The id shape the backend keeps as studio_context.preset (it grants nothing for it).
export const LOOK_ID = /^[a-z0-9][a-z0-9-]{0,59}$/
const BATCH = 200
let pending = null
// One request for every look shown together: each card asks for its own id, and the ids asked for in the same
// render go out as one GET /video/library/presets/?ids=... (at most 200 per request). Nothing is kept between
// visits, so a card always shows the newest result and never a previous sign-in's file.
export function loadLookResult(id) {
  if (typeof id !== 'string' || !LOOK_ID.test(id)) return Promise.resolve({ count: 0, latest: null })
  if (!pending) { pending = new Map(); queueMicrotask(flushLookResults) }
  if (!pending.has(id)) { const entry = {}; entry.promise = new Promise((resolve, reject) => Object.assign(entry, { resolve, reject })); pending.set(id, entry) }
  return pending.get(id).promise
}
async function flushLookResults() {
  const batch = pending, ids = [...batch.keys()]
  pending = null
  const chunks = []
  for (let i = 0; i < ids.length; i += BATCH) chunks.push(ids.slice(i, i + BATCH))
  await Promise.all(chunks.map(async chunk => {
    try {
      const found = (await api.get('/video/library/presets/', { params: { ids: chunk.join(',') } })).data?.presets || {}
      for (const id of chunk) batch.get(id).resolve(lookResult(found[id]))
    } catch (error) { for (const id of chunk) batch.get(id).reject(error) }
  }))
}
// Only http(s) or same-origin paths are shown; anything else counts as no media.
export function safeMediaUrl(value) {
  if (typeof value !== 'string' || !value) return ''
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try { return ['http:', 'https:'].includes(new URL(value).protocol) ? value : '' } catch { return '' }
}
function lookResult(entry) {
  const latest = entry?.latest && typeof entry.latest === 'object' ? entry.latest : null
  return { count: Math.max(0, Number(entry?.count) || 0), latest: latest && ['image', 'video', 'audio'].includes(latest.media_type)
    ? { ...latest, url: safeMediaUrl(latest.url), thumbnail_url: safeMediaUrl(latest.thumbnail_url) } : null }
}
