<template>
  <!-- Video Studio help (owner, 2026-10-19/20): what people can make, how a video gets made, which model fits which
       video (computed from the models this person can use now, so it never goes stale), recipes that open Create
       ready to go, the Library, prompts, costs, and what to do when something goes wrong. Every claim here matches
       the product: change the page when the product changes. -->
  <section class="help" aria-labelledby="help-title" data-test="video-studio-help">
    <header class="help-head">
      <h1 id="help-title">Help</h1>
      <p class="help-lead">What you can make in Video Studio, and how to make it.</p>
    </header>

    <div class="help-body">
      <nav class="toc" aria-label="On this page">
        <p class="toc-title">On this page</p>
        <ul>
          <li v-for="s in sections" :key="s.id"><a :href="'#' + s.id" class="toc-link" @click.prevent="go(s.id)">{{ s.title }}</a></li>
        </ul>
      </nav>

      <article class="doc">
        <!-- What you can make -->
        <section id="kinds" class="doc-section" aria-labelledby="h-kinds">
          <h2 id="h-kinds">What you can make</h2>
          <ul class="kinds">
            <li v-for="k in kinds" :key="k.task" class="kind">
              <span class="kind-art" aria-hidden="true" v-html="k.art"></span>
              <div>
                <h3>{{ k.title }}</h3>
                <p>{{ k.text }}</p>
                <p class="kind-use">Good for {{ k.use }}.</p>
              </div>
            </li>
          </ul>
          <p>Two more things work on any video you make here:</p>
          <ul class="plain">
            <li><strong>Continue</strong> carries the action on from the last moment of a clip, so short clips become a
              longer shot.</li>
            <li><strong>Free edits</strong>: trimming, splitting, joining, changing speed, cropping, adding text or a logo,
              captions, sound or music, saving a frame, and exporting cost nothing. Ask the agent, or use the timeline on
              the Storyboard tab.</li>
          </ul>
          <p>Every take is kept on the Versions tab. Restore an earlier one at any time without rendering again.</p>
          <h3 class="doc-h3">Agent or Manual</h3>
          <p>Above the box you choose who picks the settings. In <strong>Agent</strong> mode, the default, you just talk:
            say what you want to make, add your photos or clips with "+", and the agent asks what it needs, picks the
            image and video models that suit the job, chooses the shape, length, resolution and sound, and carries the
            work through. In <strong>Manual</strong> mode you pick the model and every setting yourself and the agent
            writes the prompt. In both modes you can always send the agent a message, and every image and every video
            waits for you on a card with its price: nothing is made or charged until you approve it.</p>
          <h3 class="doc-h3">Images</h3>
          <p>In Manual mode, choose <strong>Image</strong> in the Make menu beside the settings to make pictures instead: a product shot, the opening shot of a video,
            or a character you want to keep the same in every scene. Pick the image model, the shape (only the shapes that
            model makes) and how many, from one to four. Add up to four photos for the model to keep or to follow the look of.
            Press Create, then approve the card that shows the price; each image is charged to your budget. They show on the Images tab,
            where <strong>Use in video</strong> adds one as the opening shot or a reference, and <strong>Save as
            ingredient</strong> keeps it for any later video.</p>
        </section>

        <!-- How a video gets made: a real sequence, so the frames are numbered -->
        <section id="process" class="doc-section" aria-labelledby="h-process">
          <h2 id="h-process">How a video gets made</h2>
          <ol class="strip">
            <li v-for="(st, i) in steps" :key="st.title" class="strip-step">
              <span class="strip-frame" aria-hidden="true">
                <span class="strip-n">{{ i + 1 }}</span>
                <span class="strip-ic" v-html="st.icon"></span>
              </span>
              <div class="strip-text">
                <h3>{{ st.title }}</h3>
                <p>{{ st.text }}</p>
              </div>
            </li>
          </ol>
        </section>

        <!-- Which model for which video -->
        <section id="models" class="doc-section" aria-labelledby="h-models">
          <h2 id="h-models">Which model for which video</h2>
          <p>Each model does some things and not others. These are the models that fit common goals, taken from the
            {{ usableCount ? usableCount + ' models' : 'models' }} you can use right now, the ones that do the most listed
            first. Pick one in Video model on the Create screen; the picker also says what every model does.</p>
          <p v-if="autoName" class="note"><strong>Auto</strong> uses {{ autoName }} unless a task needs another model. It is a
            good place to start.</p>
          <p v-if="loadingModels" class="note" role="status">Loading your models…</p>
          <p v-else-if="modelsError" class="note">{{ modelsError }}</p>
          <dl v-else class="goals">
            <div v-for="g in goals" :key="g.id" class="goal" :data-test="'help-goal-' + g.id">
              <dt>
                <span class="goal-title">{{ g.title }}</span>
                <span class="goal-needs">{{ g.needs }}</span>
              </dt>
              <dd>
                <ul v-if="g.models.length" class="chips">
                  <li v-for="m in (open[g.id] ? g.models : g.models.slice(0, 6))" :key="m.route_id" class="chip">
                    <span>{{ label(m) }}<span v-if="g.note" class="chip-note">, {{ g.note(m) }}</span></span>
                    <span v-if="ownKey(m)" class="chip-tag" title="Renders on your own key">Your key</span>
                  </li>
                  <li v-if="g.models.length > 6">
                    <button type="button" class="chip more" :aria-expanded="open[g.id] ? 'true' : 'false'" :data-test="'help-more-' + g.id"
                            @click="open[g.id] = !open[g.id]">{{ open[g.id] ? 'Show fewer' : `Show ${g.models.length - 6} more` }}</button>
                  </li>
                </ul>
                <p v-else class="goal-none">None of your models does this yet.</p>
                <p v-if="g.extra" class="goal-extra">{{ g.extra }}</p>
              </dd>
            </div>
          </dl>
          <p v-if="mixed" class="note">Models marked <strong>Your key</strong> render on your own account; the others render on
            AADML's.</p>
        </section>

        <!-- Recipes -->
        <section id="recipes" class="doc-section" aria-labelledby="h-recipes">
          <h2 id="h-recipes">Recipes</h2>
          <p>Step by step for the videos people make most. <strong>Try it</strong> opens Create with the kind of video
            chosen and the example prompt filled in; nothing is sent until you press a button.</p>
          <ul class="recipes">
            <li v-for="r in recipes" :key="r.id" class="recipe" :data-test="'help-recipe-' + r.id">
              <span v-if="r.art" class="recipe-art" aria-hidden="true" v-html="r.art"></span>
              <div class="recipe-body">
                <h3>{{ r.title }}</h3>
                <ol class="recipe-steps">
                  <li v-for="(s, i) in r.steps" :key="i">{{ s }}</li>
                </ol>
                <figure v-if="r.prompt" class="prompt-eg">
                  <figcaption>Example prompt</figcaption>
                  <blockquote>{{ r.prompt }}</blockquote>
                </figure>
                <button v-if="r.task" type="button" class="btn" :data-test="'help-try-' + r.id" @click="tryIt(r)">Try it</button>
              </div>
            </li>
          </ul>
        </section>

        <!-- Library and ingredients -->
        <section id="library" class="doc-section" aria-labelledby="h-library">
          <h2 id="h-library">Your Library and ingredients</h2>
          <p><strong>The Library</strong> holds every image, video, sound and document you uploaded or made in Video Studio.
            Filter it by type, by how the file got there, or by project. Press <strong>Use</strong> on an image, clip or
            sound to add it to the video you are making, or press + in the prompt box and choose <strong>Choose from the
            Library</strong>. Documents open from there; a video uses images, clips and sounds, so for a script, paste the
            part you need into the prompt.</p>
          <p><strong>An ingredient</strong> is a named character, product, place or style made of up to 8 of your files,
            for example "Nova" or "Red sneaker". Select the files in the Library and save them as an ingredient. Use it in
            any video, or tell the agent its name, so the same product or person appears in every scene.</p>
          <p class="links">
            <router-link to="/video-studio/library" class="text-link">Open the Library</router-link>
            <router-link to="/video-studio/ingredients" class="text-link">Open Ingredients</router-link>
          </p>
        </section>

        <!-- Writing a prompt -->
        <section id="prompts" class="doc-section" aria-labelledby="h-prompts">
          <h2 id="h-prompts">Writing a good prompt</h2>
          <p>Write it the way you would brief a camera crew. The agent turns it into the detailed prompt the model needs,
            and keeps every name, colour and product you mention exactly.</p>
          <ul class="plain">
            <li><strong>What is in the shot</strong>: the product, the person, the place.</li>
            <li><strong>What happens</strong>: the action, from start to end, in one continuous shot.</li>
            <li><strong>The camera</strong>: close-up or wide, still or moving, slow orbit, push-in, drift to the side.</li>
            <li><strong>The light and mood</strong>: soft morning light, neon at night, bright and cheerful.</li>
          </ul>
          <div class="compare">
            <p><span class="compare-label">Vague</span> A nice video of my shoes.</p>
            <p><span class="compare-label">Clear</span> A slow push-in on a white sneaker on a wet street at night, neon
              reflections in the puddles, the camera stops on the logo.</p>
          </div>
          <p>One prompt makes one shot. For several shots, choose Story video. Never ask the model to draw words on screen:
            add them as a caption instead (see the recipe above).</p>
        </section>

        <!-- Costs and limits -->
        <section id="costs" class="doc-section" aria-labelledby="h-costs">
          <h2 id="h-costs">What it costs</h2>
          <ul class="plain">
            <li><strong>An estimate is free.</strong> It shows the price on a card before anything renders.</li>
            <li><strong>Only Generate spends.</strong> It holds the estimated amount against your organization's budget; when
              the provider reports the real cost, that is what is charged.</li>
            <li><strong>A failed render costs nothing</strong>: its hold is released.</li>
            <li><strong>An estimate is valid for 15 minutes.</strong> After that, press Get a new estimate on its card to see
              the current price.</li>
            <li><strong>Over budget, nothing starts.</strong> If a render would pass your organization's spending limit, it
              does not start and nothing is spent.</li>
            <li><strong>A spending limit per render</strong> on the Storyboard tab lets renders under that amount start
              without asking. Leave it blank to be asked every time.</li>
            <li><strong>Free</strong>: free edits, exporting, comparing and restoring versions.</li>
          </ul>
        </section>

        <!-- When something goes wrong -->
        <section id="trouble" class="doc-section" aria-labelledby="h-trouble">
          <h2 id="h-trouble">When something goes wrong</h2>
          <dl class="faq">
            <div v-for="t in trouble" :key="t.q" class="faq-row">
              <dt>{{ t.q }}</dt>
              <dd>{{ t.a }}</dd>
            </div>
          </dl>
          <p>Still stuck? Ask the agent in the conversation what went wrong: it can see your estimates and renders.</p>
        </section>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { canFor, useVideoStore } from '../stores/useVideoStore'
import { TASK_ART, STEP_ICON } from '../components/video/videoArt'

const router = useRouter()
const video = useVideoStore()
const loadingModels = ref(false)
const modelsError = ref('')

const sections = [
  { id: 'kinds', title: 'What you can make' }, { id: 'process', title: 'How a video gets made' },
  { id: 'models', title: 'Which model for which video' }, { id: 'recipes', title: 'Recipes' },
  { id: 'library', title: 'Library and ingredients' }, { id: 'prompts', title: 'Writing a good prompt' },
  { id: 'costs', title: 'What it costs' }, { id: 'trouble', title: 'When something goes wrong' },
]
function go(id) {
  const el = document.getElementById(id)
  if (!el) return
  const still = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
}

const kinds = [
  { task: 'quick', art: TASK_ART.quick, title: 'Quick clip',
    text: 'One shot, usually 4 to 15 seconds (up to 30 on some models), made from your words or started from a photo.',
    use: 'a product turning on a table, a moving logo, a photo brought to life' },
  { task: 'story', art: TASK_ART.story, title: 'Story video',
    text: 'Several scenes planned from one idea or script, rendered scene by scene, then cut together on a timeline with captions and music, and exported in 16:9, 9:16 or 1:1.',
    use: 'ads, launches, explainers and anything longer than one shot' },
  { task: 'edit', art: TASK_ART.edit, title: 'Edit footage',
    text: 'Change a video you upload or one you made here: describe the change and a model that can edit video makes it. It is offered when one of your models can edit.',
    use: 'restyling a clip, changing the light, removing something' },
]

const steps = [
  { icon: STEP_ICON.describe, title: 'Describe it',
    text: 'Choose Quick clip, Story video or Edit footage, and say what you want in your own words. The agent writes the detailed prompt for the model.' },
  { icon: STEP_ICON.media, title: 'Add media, if you have it',
    text: 'Press + to upload a photo, video or sound, or choose from the Library. Each file gets a role: product, character or place, style, opening or closing shot, motion, sound, or video to edit.' },
  { icon: STEP_ICON.settings, title: 'Check the settings',
    text: 'Model, shape, length, resolution and sound. Only what the chosen model can do is offered. Leave the model on Auto if you are not sure.' },
  { icon: STEP_ICON.estimate, title: 'Get an estimate',
    text: 'Free. The agent prepares the render and shows the price on a card in the conversation.' },
  { icon: STEP_ICON.generate, title: 'Press Generate',
    text: 'Only now is anything spent. You can keep working or leave the page; the video appears on the monitor and in the conversation when it is ready.' },
  { icon: STEP_ICON.refine, title: 'Refine and export',
    text: 'Ask for changes in the conversation, continue a clip, compare versions. For a story, check the timeline on the Storyboard tab and press Export.' },
]

// ── Which model for which video: computed from the models this person can use now ─────────────────────
const RES = ['480p', '540p', '720p', '768p', '1080p', '2K', '4K']
function bestRes(r) { return ((r.outputs && r.outputs.resolutions) || []).slice().sort((a, b) => RES.indexOf(a) - RES.indexOf(b)).pop() || '' }
function maxSeconds(r) { return Math.max(0, ...(((r.outputs && r.outputs.durations) || []).map(Number).filter((n) => n > 0))) }
function usable(r) { return r.state === 'active' && (r.offered || []).length > 0 }
function shortName(name) { const s = String(name || ''); const i = s.indexOf(': '); return i > 0 ? s.slice(i + 2) : s }
// "MiniMax: H3" reads as "MiniMax H3": a short model name means little without its maker.
function label(r) {
  const s = String(r.name || ''); const i = s.indexOf(': ')
  if (i <= 0) return s
  const maker = s.slice(0, i); const model = s.slice(i + 2)
  return model.toLowerCase().startsWith(maker.toLowerCase()) ? model : `${maker} ${model}`
}
// The models that do the most come first: opening and closing shots, sound, references, resolution, length.
function score(r) {
  const c = canFor(r)
  return (c.endFrame ? 2 : 0) + (r.outputs && r.outputs.audio ? 1 : 0) + (c.references ? 1 : 0)
    + Math.max(0, RES.indexOf(bestRes(r))) / 3 + maxSeconds(r) / 15
}
const open = reactive({})
const mixed = computed(() => video.routes.some((r) => (r.connections || []).some((c) => c.connection === 'AADML')))
function ownKey(r) { return mixed.value && (r.connections || []).some((c) => c.connection && c.connection !== 'AADML') }
const GOALS = [
  { id: 'photo', title: 'From your photo of a product or a place', needs: 'Takes an image as the opening shot',
    test: (r) => canFor(r).startFrame, rank: (r) => (canFor(r).endFrame ? 1 : 0) },
  { id: 'frames', title: 'Starting and ending on exact pictures', needs: 'Takes an opening and a closing shot',
    test: (r) => canFor(r).endFrame },
  { id: 'sound', title: 'With sound', needs: 'Makes sound with the picture', test: (r) => !!(r.outputs && r.outputs.audio) },
  { id: 'vertical', title: 'Vertical, for social apps', needs: 'Renders 9:16',
    test: (r) => ((r.outputs && r.outputs.aspect_ratios) || []).includes('9:16'),
    extra: 'A story can also be exported in 9:16 at the end, whichever model made its scenes.' },
  { id: 'long', title: 'Long single shots', needs: 'Clips of 15 seconds or more', test: (r) => maxSeconds(r) >= 15,
    rank: (r) => maxSeconds(r), note: (r) => `up to ${maxSeconds(r)} s` },
  { id: 'sharp', title: 'The sharpest picture', needs: '1080p or higher',
    test: (r) => RES.indexOf(bestRes(r)) >= RES.indexOf('1080p'), rank: (r) => RES.indexOf(bestRes(r)), note: (r) => `up to ${bestRes(r)}` },
  { id: 'draft', title: 'Quick drafts at a lower cost', needs: 'The Fast, Lite or Mini version of a model, usually quicker and cheaper',
    test: (r) => /\b(fast|lite|mini)\b/i.test(String(r.name || '')) },
  { id: 'refs', title: 'The same product or character in every shot', needs: 'Takes reference images',
    test: (r) => canFor(r).references, extra: 'Save the photos as an ingredient in the Library first.' },
  { id: 'edit', title: 'Changing footage you already have', needs: 'Edits video', test: (r) => canFor(r).edit,
    extra: 'Trims, speed, crops, text and music need no model at all: they are free edits.' },
]
const usableRoutes = computed(() => video.routes.filter(usable))
const usableCount = computed(() => usableRoutes.value.length)
const goals = computed(() => GOALS.map((g) => ({
  ...g,
  models: usableRoutes.value.filter(g.test).slice()
    .sort((a, b) => ((g.rank ? g.rank(b) - g.rank(a) : 0) || (score(b) - score(a)) || label(a).localeCompare(label(b)))),
})))
const autoName = computed(() => {
  const id = video.defaultRouteId
  const r = id ? video.routes.find((x) => String(x.route_id) === String(id) || (x.connections || []).some((c) => String(c.route_id) === String(id))) : null
  return r ? label(r) : ''
})

const recipes = [
  { id: 'product', task: 'quick', art: TASK_ART.quick, title: 'A product shot from a photo',
    steps: ['Choose Quick clip.', 'Press + and upload a clear photo of the product. It becomes the opening shot.',
            'Say how the camera moves and what the light is like.', 'Get an estimate, then press Generate on its card.'],
    prompt: 'A slow orbit around my sneaker on a stone plinth, soft morning light, shallow depth of field' },
  { id: 'ad', task: 'story', art: TASK_ART.story, title: 'A 30-second ad in scenes',
    steps: ['Choose Story video and set Final length to 30 s.', 'Describe the product, who it is for, and the moments you imagine.',
            'Press Plan the story. The agent writes the scenes on the Storyboard tab; change any of them.',
            'Render each scene, add captions and music on the timeline, then press Export.'],
    prompt: 'A 30-second ad for my café: the espresso pour, a regular saying hello, the logo and the price at the end' },
  { id: 'photo', task: 'quick', art: TASK_ART.quick, title: 'Bring a photo to life',
    steps: ['Choose Quick clip and upload the photo with +.', 'Describe what moves and how the camera drifts. Keep it to one shot.',
            'Get an estimate and press Generate.'],
    prompt: 'Animate my photo: wind moves through the trees as the camera drifts slowly to the right' },
  { id: 'social', task: 'quick', art: TASK_ART.quick, title: 'A vertical clip for social apps',
    steps: ['Choose Quick clip and set Shape to 9:16. Pick a model that offers it (see "Vertical, for social apps" above).',
            'Keep it short: 5 to 8 seconds.', 'Get an estimate and press Generate.'],
    prompt: 'Iced coffee poured over ice in slow motion, bright summer light, vertical framing' },
  { id: 'character', task: 'story', art: TASK_ART.story, title: 'The same character in every scene',
    steps: ['In the Library, select up to 8 photos of the person or mascot and save them as an ingredient of kind Character, with a name.',
            'In Create, press + and choose the ingredient from the Library, or tell the agent its name.',
            'Pick a model that takes reference images, then plan the story.'],
    prompt: 'Nova, our mascot, opens the shop at dawn, serves the first customer, and waves goodbye at closing time' },
  { id: 'edit', task: 'edit', art: TASK_ART.edit, title: 'Change a video you already have',
    steps: ['Choose Edit footage and press + to upload the video.', 'Describe the change: what to keep, what to change.',
            'For trims, speed, crops, text or music, just ask the agent: those edits are free.'],
    prompt: 'Make it warmer and slower, and remove the sign on the left' },
  { id: 'text', task: null, art: null, title: 'Exact words on screen: a price, a name, a slogan',
    steps: ['Do not ask the video model to draw words: it often gets letters wrong.',
            'Ask the agent to add them as a caption on the timeline, or add one yourself on the Storyboard tab. A caption is placed exactly and costs nothing.'] },
]
// Try it: a fresh Create screen with the task chosen and the example prompt in the box. Nothing is sent.
function tryIt(r) {
  video.setTask(r.task)
  video.studioDraft = r.prompt
  router.push({ name: 'video-studio', query: { new: '1' } })
}

const trouble = [
  { q: 'A file I added is flagged', a: 'The chosen model cannot use it in that role. Press the model suggested under the file to switch, change the file\'s role, or remove it.' },
  { q: 'Get estimate is greyed out', a: 'Write a prompt first. If a model change is waiting, press Switch and apply or keep the current model. A flagged file also has to be fixed or removed.' },
  { q: 'The estimate expired', a: 'Estimates last 15 minutes. Press Get a new estimate on the card to see the current price.' },
  { q: 'The render failed', a: 'Nothing was charged: the hold is released. Try again, or pick another model for it.' },
  { q: 'The render did not start: over the limit', a: 'Your organization\'s spending limit would be passed. Nothing was spent. Ask your organization admin to raise it, or wait for the next period.' },
  { q: 'No model does what I need', a: 'Change the task or the settings, or pick another model: every model the platform offers for the task is in the list.' },
  { q: 'Words in the video are misspelled', a: 'Video models draw letters badly. Remove the words from the prompt and add them as a caption instead.' },
]

onMounted(async () => {
  if (video.routes.length) return
  loadingModels.value = true
  try {
    const { data } = await api.getVideoStudioAgent()
    await video.loadCapabilities(data.id)
  } catch {
    modelsError.value = 'Your models could not be loaded. The picker on the Create screen lists them too.'
  } finally { loadingModels.value = false }
})
</script>

<style scoped>
.help { min-height: 100%; color: var(--vm-ink); }
.help-head { min-height: 60px; padding: 12px 20px; box-sizing: border-box; border-bottom: 1px solid var(--vm-line-2); }
.help-head h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -.015em; }
.help-lead { margin: 2px 0 0; font-size: 12.5px; color: var(--vm-ink-soft); }

/* A reading column (about 68 characters) beside a short contents list. */
.help-body { display: grid; grid-template-columns: 200px minmax(0, 700px); gap: 56px; padding: 28px 24px 64px; max-width: 1040px; box-sizing: border-box; }
.toc { position: sticky; top: 24px; align-self: start; }
.toc-title { margin: 0 0 8px; font-size: 12.5px; font-weight: 600; color: var(--vm-ink-soft); }
.toc ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; border-left: 1px solid var(--vm-line-2); }
.toc-link { display: block; padding: 6px 12px; margin-left: -1px; border-left: 2px solid transparent; color: var(--vm-ink-soft); font-size: 13px;
  line-height: 1.4; text-decoration: none; }
.toc-link:hover { color: var(--vm-ink); border-left-color: var(--vm-line); }

.doc { min-width: 0; font-size: 15px; line-height: 1.65; }
.doc p { margin: 0 0 14px; }
.doc-section { scroll-margin-top: 24px; padding-bottom: 8px; }
.doc-section + .doc-section { margin-top: 40px; padding-top: 36px; border-top: 1px solid var(--vm-line-2); }
.doc h2 { margin: 0 0 16px; font-size: 22px; line-height: 1.25; font-weight: 600; letter-spacing: -.015em; }
.doc h3 { margin: 0 0 4px; font-size: 15.5px; font-weight: 600; }
.doc .doc-h3 { margin-top: 24px; }
.doc strong { font-weight: 600; color: var(--vm-ink); }
.plain { margin: 0 0 14px; padding-left: 20px; display: grid; gap: 6px; }
.note { font-size: 14px; color: var(--vm-ink-soft); }

/* Kinds of video: a drawing and a paragraph each, no cards. */
.kinds { list-style: none; margin: 0 0 20px; padding: 0; display: grid; gap: 18px; }
.kind { display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 18px; align-items: start; }
.kind-art { display: block; aspect-ratio: 16 / 9; color: var(--vm-ink-faint); }
.kind-art :deep(svg), .recipe-art :deep(svg) { display: block; width: 100%; height: 100%; }
.kind p { margin: 0; color: var(--vm-ink-soft); }
.kind-use { margin-top: 4px !important; font-size: 14px; }

/* The process: a strip of numbered frames joined like film, the one bold element of the page. */
.strip { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; position: relative; }
.strip-step { position: relative; display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 18px; padding-bottom: 22px; }
.strip-step:not(:last-child)::before { content: ''; position: absolute; left: 43px; top: 50px; bottom: 0; width: 2px;
  background: repeating-linear-gradient(to bottom, var(--vm-line) 0 6px, transparent 6px 11px); }
.strip-frame { position: relative; display: grid; place-items: center; width: 88px; aspect-ratio: 16 / 9; border-radius: 2px; background: #000;
  box-shadow: inset 0 0 0 1px var(--vm-line); color: var(--vs-accent-ink, var(--vm-violet)); }
.strip-n { position: absolute; top: 3px; left: 6px; font-size: 11px; font-weight: 600; color: #a7a8ae; font-variant-numeric: tabular-nums; }
.strip-ic { width: 20px; height: 20px; }
.strip-ic :deep(svg) { display: block; width: 100%; height: 100%; }
.strip-text p { margin: 0; color: var(--vm-ink-soft); }

/* Which model for which video. */
.goals { margin: 0 0 14px; display: grid; gap: 0; }
.goal { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 18px; padding: 14px 0; border-top: 1px solid var(--vm-line-2); }
.goal:last-child { border-bottom: 1px solid var(--vm-line-2); }
.goal dt { display: grid; gap: 2px; align-content: start; }
.goal-title { font-weight: 600; font-size: 14.5px; line-height: 1.4; }
.goal-needs { font-size: 13px; line-height: 1.45; color: var(--vm-ink-soft); }
.goal dd { margin: 0; min-width: 0; }
.chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 2px 10px; box-sizing: border-box; border: 1px solid var(--vm-line);
  border-radius: 999px; font-size: 13px; line-height: 1.35; }
.chip-note { color: var(--vm-ink-soft); }
.chip-tag { padding: 0 5px; border: 1px solid var(--vm-line); border-radius: 4px; font-size: 11px; color: var(--vm-ink-soft); }
.chip.more { border-style: dashed; background: transparent; color: var(--vm-ink-soft); font: inherit; font-size: 13px; cursor: pointer; }
.chip.more:hover { color: var(--vm-ink); }
.chip.more:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.goal-none { margin: 0 !important; font-size: 13.5px; color: var(--vm-ink-faint); }
.goal-extra { margin: 6px 0 0 !important; font-size: 13px; line-height: 1.5; color: var(--vm-ink-soft); }

/* Recipes. */
.recipes { list-style: none; margin: 0; padding: 0; display: grid; gap: 28px; }
.recipe { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 18px; align-items: start; }
.recipe-art { display: block; aspect-ratio: 16 / 9; color: var(--vm-ink-faint); }
.recipe:not(:has(.recipe-art)) .recipe-body { grid-column: 1 / -1; }
.recipe-steps { margin: 6px 0 12px; padding-left: 20px; display: grid; gap: 4px; color: var(--vm-ink-soft); }
.prompt-eg { margin: 0 0 12px; }
.prompt-eg figcaption { font-size: 12.5px; color: var(--vm-ink-soft); margin-bottom: 4px; }
.prompt-eg blockquote { margin: 0; padding: 8px 12px; border-left: 2px solid var(--vm-violet); background: var(--vm-surface); border-radius: 0 6px 6px 0;
  font-size: 14px; line-height: 1.55; }

.compare { display: grid; gap: 8px; margin: 0 0 16px; }
.compare p { margin: 0 !important; padding: 10px 12px; border: 1px solid var(--vm-line-2); border-radius: 6px; font-size: 14px; }
.compare-label { display: inline-block; min-width: 52px; margin-right: 8px; font-weight: 600; color: var(--vm-ink-soft); }

.faq { margin: 0 0 14px; }
.faq-row { padding: 12px 0; border-top: 1px solid var(--vm-line-2); }
.faq-row:last-child { border-bottom: 1px solid var(--vm-line-2); }
.faq dt { font-weight: 600; font-size: 14.5px; }
.faq dd { margin: 4px 0 0; color: var(--vm-ink-soft); font-size: 14.5px; }

.links { display: flex; flex-wrap: wrap; gap: 16px; }
.text-link { display: inline-flex; align-items: center; min-height: 44px; color: var(--vs-accent-ink, var(--vm-violet)); font-weight: 500;
  text-decoration: underline; text-underline-offset: 3px; }
.btn { display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border: 1px solid var(--vm-line); border-radius: 6px; background: transparent;
  color: var(--vm-ink); font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer; transition: background-color .15s; }
.btn:hover { background: var(--vm-surface-2); }
.toc-link:focus-visible, .text-link:focus-visible, .btn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }

@media (max-width: 1100px) {
  .help-body { grid-template-columns: minmax(0, 1fr); gap: 20px; max-width: 760px; }
  .toc { position: static; }
  .toc-title { display: none; }
  .toc ul { display: flex; gap: 6px; overflow-x: auto; border-left: 0; padding-bottom: 4px; }
  .toc-link { white-space: nowrap; border: 1px solid var(--vm-line); border-radius: 999px; margin-left: 0; padding: 0 12px; min-height: 36px;
    display: inline-flex; align-items: center; }
}
@media (max-width: 1023px) { .help-head { padding-left: calc(12px + var(--vs-bar-inset, 0px)); } }
@media (max-width: 640px) {
  .help-body { padding: 16px 16px 48px; }
  .doc { font-size: 16px; }
  .doc h2 { font-size: 20px; }
  .kind, .recipe { grid-template-columns: 88px minmax(0, 1fr); gap: 14px; }
  .goal { grid-template-columns: 1fr; gap: 8px; }
  .strip-step { grid-template-columns: 72px minmax(0, 1fr); gap: 14px; }
  .strip-frame { width: 72px; }
  .strip-step:not(:last-child)::before { left: 35px; top: 42px; }
}
@media (pointer: coarse) { .btn, .toc-link { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
</style>
