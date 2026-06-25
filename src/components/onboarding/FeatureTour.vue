<template>
  <!-- First-run welcome (bridge into the tour). Shown once for new users. -->
  <WelcomeModal
    :show="welcomeOpen"
    :name="firstName"
    @create="onCreateAgent"
    @tour="onStartFromWelcome"
    @later="onLater"
  />

  <!-- The spotlight tour itself. -->
  <TourSpotlight
    v-if="ob.state.active && currentStep"
    :step="currentStep"
    :index="ob.state.step"
    :total="steps.length"
    @next="onNext"
    @back="ob.prevStep"
    @skip="onSkip"
    @finish="onFinish"
  />
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WelcomeModal from './WelcomeModal.vue'
import TourSpotlight from './TourSpotlight.vue'
import { useOnboarding } from '../../composables/useOnboarding'

const route = useRoute()
const router = useRouter()
const ob = useOnboarding()
const currentUser = inject('currentUser', ref(null))

const welcomeOpen = ref(false)

const firstName = computed(() => {
  const n = currentUser.value?.username || ''
  return n ? n.split(/[\s@]/)[0] : ''
})

// Tour steps. `target` is a CSS selector (resolved to the visible element); steps with a
// `route` navigate there first so the highlighted chrome is on screen.
//
// ORDER MATTERS — it mirrors the real setup dependency chain:
//   1. Connect an AI provider + activate models   (an agent can't run without a model)
//   2. Create an agent                             (needs an active model)
//   3. Chat with the agent                         (needs an agent)
// …then the power features (Connectors / Workflows / Let's Code / Activity).
const steps = [
  {
    title: 'Welcome aboard 👋',
    description: "Let's set you up in 3 steps — connect an AI provider, create an agent, then start chatting. I'll show you exactly where to click. Skip anytime; replay later from the sidebar.",
  },
  {
    target: '[data-tour="add-provider"]', route: '/dashboard/settings/providers',
    title: 'Step 1 — Connect an AI provider',
    description: 'Agents run on AI models, and models come from a provider. So this is the very first thing to do.',
    howto: [
      'Click <strong>Add Provider</strong> here',
      'Pick a provider — OpenAI, Anthropic, OpenRouter, Gemini or Ollama',
      'Paste your <strong>API key</strong> and save',
      'Click <strong>Sync Models</strong> to pull that provider\'s models',
      'Open the <strong>Models</strong> tab and toggle a model to <strong>Active</strong>',
    ],
  },
  {
    target: '[data-tour="tab-internal"]', route: '/dashboard/settings/providers',
    title: 'Optional — internal & embedding models',
    description: "Besides an agent's chat model, the app runs small internal tasks (summarizing, routing) and builds knowledge embeddings. These default to each agent's own model, so you can safely skip this — open it later only if you want to fine-tune.",
    howto: [
      'Click the <strong>Internal &amp; Embedding</strong> tab',
      'For each task (ASK_LLM, summarization, turn router…) leave <strong>Agent default</strong>, or choose a specific provider + model and <strong>Save</strong>',
      'Set the <strong>Embedding model</strong> for knowledge / RAG — the built-in local model is free &amp; private; switching to a provider model improves retrieval but needs re-indexing',
    ],
  },
  {
    target: '[data-tour="create-agent-hero"], [data-tour="create-agent-empty"]', route: '/dashboard/agents',
    title: 'Step 2 — Create an agent',
    description: 'An agent is your AI worker. It needs the model you just activated.',
    howto: [
      'Click <strong>Create Agent</strong>',
      'Give it a name and a short description of its job',
      'Choose the <strong>model</strong> you activated in Step 1',
      'Optionally add tools, a knowledge base and instructions',
      'Save — your agent is ready to chat',
    ],
  },
  {
    target: '[data-tour="agent-rail"]', route: '/dashboard/agents/new',
    title: 'Inside the agent builder',
    description: 'Creating an agent is a short guided wizard. Each step on this rail sets up one part:',
    howto: [
      '<strong>Basics</strong> — name, description, and the model the agent runs on',
      '<strong>Instructions</strong> — the system prompt that steers every reply',
      '<strong>Knowledge &amp; Workflows</strong> — documents it can reference + reusable flows',
      '<strong>Tools &amp; Autonomy</strong> — which tools it may use and how independently it can act',
      '<strong>Review</strong> — a final check (plus advanced options), then <strong>Create Agent</strong>',
    ],
  },
  {
    target: '[data-tour="chat-controls"]', route: '/dashboard/chat/new',
    title: 'Step 3 — Pick an agent & mode',
    description: 'The bar under the message box is where you choose who answers and how.',
    howto: [
      'Use the <strong>agent selector</strong> to choose which agent answers (type to search)',
      'Next to it, the <strong>mode</strong> picker sets how it works — e.g. <strong>Chat</strong> for quick replies or <strong>Agent</strong> to run tools &amp; multi-step tasks',
      'The <strong>+</strong> button attaches an image or file to your message',
    ],
  },
  {
    target: '[data-tour="composer-input"]',
    title: 'Step 3 — Send your message',
    description: 'With an agent and mode chosen, just ask.',
    howto: [
      'Type your question or task in the <strong>message box</strong>',
      'Press <strong>Enter</strong> (or the send button) — replies stream live',
      'Use <strong>Shift+Enter</strong> for a new line in a longer message',
    ],
  },
  {
    target: '[data-tour="connectors"]', route: '/dashboard/connectors',
    title: 'Connectors',
    description: 'Give your agents real-world abilities by connecting external services.',
    howto: [
      'Connect <strong>services</strong> (GitHub, Slack…) and <strong>MCP servers</strong>',
      'Authorize with OAuth or an API key',
      'Assign the connector to an agent so it can use those tools',
    ],
  },
  {
    target: '[data-tour="workflow"]', route: '/dashboard/workflow-builder',
    title: 'Workflow Builder',
    description: 'Automate multi-step jobs by chaining agents and tools on a visual canvas.',
    howto: [
      'Drag nodes onto the canvas and connect them',
      'Add agents, tools, conditions, approvals and retries',
      'Run it on demand or on a schedule',
    ],
  },
  {
    target: '[data-tour="lets-code"]', route: '/dashboard/lets-code',
    title: "Let's Code",
    description: 'A built-in, Cursor-style coding agent for your repositories.',
    howto: [
      'Add or clone a repository',
      'Ask the agent to read, explain or edit code',
      'Review the diff, then keep or revert changes',
    ],
  },
  {
    target: '[data-tour="activity"]', route: '/dashboard/activity',
    title: 'Activity',
    description: 'Keep an eye on usage and cost so nothing is a black box.',
    howto: [
      'See token usage and cost per request and per agent',
      'Review the history of every run',
    ],
  },
  {
    title: "You're all set! 🎉",
    description: "Time for Step 1 — connect an AI provider. Then create an agent and start chatting. You can replay this tour anytime from the sidebar or Settings.",
    finishLabel: 'Connect a provider',
  },
]

const currentStep = computed(() => steps[ob.state.step] || null)

// Navigate to the step's route (if any) before it's highlighted.
watch(() => ob.state.step, (i) => {
  if (!ob.state.active) return
  const s = steps[i]
  if (s?.route && route.path !== s.route) router.push(s.route)
}, { immediate: false })

// Reconcile with the authoritative backend flag the moment currentUser resolves.
watch(currentUser, (u) => { if (u) ob.hydrateFromUser(u) }, { immediate: true })

// First-run gate: once the backend flag is known, if onboarding isn't complete and the
// user is authenticated, show the welcome modal (the single entry point into the tour).
watch(
  () => [ob.state.hydrated, currentUser.value],
  () => {
    if (ob.state.hydrated && !ob.isTourCompleted() && currentUser.value && !ob.state.active) {
      welcomeOpen.value = true
    }
  },
  { immediate: true },
)

const onNext = () => {
  if (ob.state.step >= steps.length - 1) onFinish()
  else ob.nextStep()
}

const onStartFromWelcome = () => {
  welcomeOpen.value = false
  ob.startTour()
  // Kick off any route navigation for step 0 (no-op for the centered welcome step).
  const s = steps[0]
  if (s?.route && route.path !== s.route) router.push(s.route)
}

// "Set up AI provider" — the genuine first step (an agent needs a model, a model needs a provider).
const onCreateAgent = () => {
  welcomeOpen.value = false
  ob.endTour(true)
  router.push('/dashboard/settings/providers')
}

const onLater = () => {
  // Dismissing counts as "seen" so it never auto-nags again; replay stays available.
  welcomeOpen.value = false
  ob.endTour(true)
}

const onSkip = () => ob.endTour(true)

const onFinish = () => {
  ob.endTour(true)
  router.push('/dashboard/settings/providers')
}
</script>
