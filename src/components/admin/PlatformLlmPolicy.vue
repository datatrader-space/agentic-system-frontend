<script setup>
/**
 * P7 — Platform LLM Policy (admin-dashboard only).
 * Edits GlobalAgentPolicy.llm_policy: platform ceilings the resolver enforces. Agent/org/profile can TIGHTEN
 * below these; the code ABSOLUTE_* emergency guards are NOT editable here (shown as read-only max hints).
 */
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },   // llm_policy dict
  absolute: { type: Object, default: () => ({}) },      // { key: ABSOLUTE_max } read-only hints
  errors: { type: Object, default: () => ({}) },        // { key: 'message' } from the API
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'change'])

const NUM_FIELDS = [
  { key: 'max_input_tokens', label: 'Max input tokens', unit: 'tokens',
    desc: 'The largest prompt (all context combined) sent to the model in one turn. The model’s own context window still applies on top of this.' },
  { key: 'max_images_per_turn', label: 'Max images per turn', unit: 'images',
    desc: 'How many images an agent accepts in one message. Images beyond this count are dropped.' },
  { key: 'max_image_bytes', label: 'Max image size', unit: 'bytes',
    desc: 'Max size of a SINGLE image sent to the model. Larger images are downscaled to fit. This is NOT the file-upload limit (that is a separate server setting).' },
  { key: 'max_image_width', label: 'Max image width', unit: 'px',
    desc: 'Max width, in pixels, of an image sent to the model. Wider images are downscaled to fit.' },
  { key: 'max_image_height', label: 'Max image height', unit: 'px',
    desc: 'Max height, in pixels, of an image sent to the model. Taller images are downscaled to fit.' },
]

function setNum(key, e) {
  const raw = e.target.value
  const next = { ...props.modelValue }
  // Model B: blank = unset -> the ABSOLUTE default applies. A set value is the ADMIN override and is NOT
  // clamped to the absolute (the platform admin is unbounded; only org/workspace/agent tighten below it).
  if (raw === '' || raw === null) delete next[key]
  else next[key] = Math.trunc(Number(raw))
  emit('update:modelValue', next)
  emit('change')
}
function setBool(key, e) {
  emit('update:modelValue', { ...props.modelValue, [key]: !!e.target.checked })
  emit('change')
}
const downscale = computed(() => props.modelValue.image_downscale_enabled !== false)
// Tool-output handling (DB-backed, default ON). Blank threshold = default 8000.
const artifactize = computed(() => props.modelValue.artifactize_long_outputs !== false)
const budgetSystem = computed(() => props.modelValue.tool_context_budget_enabled !== false)
// H3 durable tool-step transcript (DB-backed, default ON). Blank int = default.
const durableSteps = computed(() => props.modelValue.durable_steps_enabled !== false)
function setThreshold(e) {
  const raw = e.target.value
  const next = { ...props.modelValue }
  if (raw === '' || raw === null) delete next.artifact_threshold_tokens
  else next.artifact_threshold_tokens = Math.trunc(Number(raw))
  emit('update:modelValue', next)
  emit('change')
}
// ── Prompt caching (DB-backed; segmented prefix cache) ──
const CACHE_BOOLS = [
  { key: 'prompt_cache_enabled', label: 'Prompt caching', dflt: true,
    desc: 'Master switch for provider prompt caching (Anthropic/Claude explicit cache; OpenAI/Gemini cache automatically). Off = never send cache markers.' },
  { key: 'cache_segmentation_enabled', label: 'Segmented caching', dflt: true,
    desc: 'Cache the stable tool-docs/system prefix INDEPENDENTLY of the volatile blocks, so a per-turn memory/vector/RAG change doesn’t bust the expensive tool-docs cache. Strongly recommended ON.' },
  { key: 'cache_kb_volatile', label: 'Keep RAG out of the stable block', dflt: true,
    desc: 'Emit per-query RAG/knowledge as its own volatile block instead of baking it into the stable prompt — required for the stable cache to actually stay stable.' },
  { key: 'openrouter_session_stickiness_enabled', label: 'OpenRouter sticky routing', dflt: true,
    desc: 'Send a stable session id per conversation so OpenRouter keeps later turns on the same provider endpoint (keeps the cache warm).' },
  { key: 'prompt_cache_diagnostics_enabled', label: 'Cache diagnostics logging', dflt: true,
    desc: 'Log per-turn cache read/write/hit-rate + prompt/tool-manifest hashes for debugging cache misses.' },
  { key: 'cache_history_enabled', label: 'Cache conversation history (Phase 2)', dflt: false,
    desc: 'Add cache breakpoints inside history so long chats don’t re-read history every turn. Requires moving volatile context to the tail first — leave OFF until Phase 2.' },
]
function cacheBool(f) { const v = props.modelValue[f.key]; return v === undefined || v === null ? f.dflt : !!v }
function setStr(key, e) { emit('update:modelValue', { ...props.modelValue, [key]: e.target.value }); emit('change') }
const ragPlacement = computed(() => props.modelValue.cache_rag_placement || 'tail')
const stableTtl = computed(() => props.modelValue.cache_stable_prefix_ttl || '5m')
const contextStrategy = computed(() => props.modelValue.conversation_context_strategy || 'compact_within_profile')
const platformDefaultProfile = computed(() => props.modelValue.default_context_profile || '')
function setCheckpointTokens(e) {
  const raw = e.target.value
  const next = { ...props.modelValue }
  if (raw === '' || raw === null) delete next.checkpoint_trigger_tokens
  else next.checkpoint_trigger_tokens = Math.max(0, Math.trunc(Number(raw)))
  emit('update:modelValue', next); emit('change')
}
// Generic positive-int setter (blank = use the platform default). Optional min/max clamp.
function setPlpInt(key, e, min, max) {
  const raw = e.target.value
  const next = { ...props.modelValue }
  if (raw === '' || raw === null) { delete next[key] }
  else {
    let n = Math.trunc(Number(raw))
    if (Number.isNaN(n)) return
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    next[key] = n
  }
  emit('update:modelValue', next); emit('change')
}
const fmt = (n) => (n === null || n === undefined ? '' : Number(n).toLocaleString())
</script>

<template>
  <div class="plp">
    <p class="plp-note">
      These are the <strong>platform defaults</strong>. Leave a field <strong>blank</strong> to use the absolute
      default shown below it. A value you set here <strong>overrides</strong> that default and is not capped — org,
      workspace, and agent settings can only tighten <em>below</em> it.
    </p>

    <div class="plp-grid">
      <label v-for="f in NUM_FIELDS" :key="f.key" class="plp-field" :data-test="`plp-${f.key}`">
        <span class="plp-lbl">{{ f.label }} <span v-if="f.unit" class="plp-unit">({{ f.unit }})</span></span>
        <small class="plp-desc">{{ f.desc }}</small>
        <input type="number" min="1" :step="1" :disabled="disabled"
               :value="modelValue[f.key] ?? ''" @input="setNum(f.key, $event)"
               :placeholder="`absolute default`" />
        <small class="plp-hint">
          <span v-if="absolute[f.key]">Blank = default {{ fmt(absolute[f.key]) }}{{ f.unit ? ' ' + f.unit : '' }}</span>
        </small>
        <small v-if="errors[f.key]" class="plp-err" :data-test="`err-${f.key}`">{{ errors[f.key] }}</small>
      </label>

      <label class="plp-field plp-toggle" data-test="plp-image_downscale_enabled">
        <span class="plp-toggle-row">
          <span class="plp-lbl">Downscale oversized images</span>
          <input type="checkbox" :checked="downscale" :disabled="disabled"
                 @change="setBool('image_downscale_enabled', $event)" />
        </span>
        <small class="plp-desc">When ON, an image larger than the limits above is shrunk to fit before it is sent to the model. When OFF, an oversized image is rejected instead.</small>
      </label>
    </div>

    <h4 class="plp-subhead">Tool output handling</h4>
    <p class="plp-note">
      When an agent calls a tool, it always sees the <strong>full output on that turn</strong>. On <em>later</em>
      turns a large result is offloaded off-prompt (a short summary + a reload reference stays in context, and the
      agent can reload the full output on demand). These control that offloading.
    </p>
    <div class="plp-grid">
      <label class="plp-field plp-toggle" data-test="plp-artifactize_long_outputs">
        <span class="plp-toggle-row">
          <span class="plp-lbl">Offload long tool outputs</span>
          <input type="checkbox" :checked="artifactize" :disabled="disabled"
                 @change="setBool('artifactize_long_outputs', $event)" />
        </span>
        <small class="plp-desc">When ON, a tool output over the threshold below is stored off-prompt and replaced by a summary + reload reference on later turns. When OFF, nothing is offloaded (long outputs stay inline every turn — heavier context).</small>
      </label>

      <label class="plp-field" data-test="plp-artifact_threshold_tokens">
        <span class="plp-lbl">Offload threshold <span class="plp-unit">(tokens)</span></span>
        <small class="plp-desc">A single tool output larger than this (in tokens) is offloaded on later turns. Below it, the output rides inline. Default 8000.</small>
        <input type="number" min="1" :step="1" :disabled="disabled || !artifactize"
               :value="modelValue.artifact_threshold_tokens ?? ''" @input="setThreshold"
               placeholder="8000" />
        <small class="plp-hint"><span v-if="!(modelValue.artifact_threshold_tokens)">Blank = default 8,000 tokens</span></small>
        <small v-if="errors.artifact_threshold_tokens" class="plp-err">{{ errors.artifact_threshold_tokens }}</small>
      </label>

      <label class="plp-field plp-toggle" data-test="plp-tool_context_budget_enabled">
        <span class="plp-toggle-row">
          <span class="plp-lbl">Context-budget system</span>
          <input type="checkbox" :checked="budgetSystem" :disabled="disabled"
                 @change="setBool('tool_context_budget_enabled', $event)" />
        </span>
        <small class="plp-desc">Master switch for the model-aware context management (tool ledger, history trimming, conversation checkpoints, image de-duplication). Leave ON unless you have a specific reason — turning it off disables all of the above.</small>
      </label>
    </div>

    <h4 class="plp-subhead">Prompt caching</h4>
    <p class="plp-note">
      Segmented prefix caching: the stable tool-docs/system prompt is cached separately from the volatile
      per-turn context (memory, vector recall, RAG, checkpoint), so stable content keeps hitting the cache even
      as the conversation changes. Applies to providers with explicit caching (Anthropic/Claude); others cache
      automatically.
    </p>
    <div class="plp-grid">
      <label v-for="f in CACHE_BOOLS" :key="f.key" class="plp-field plp-toggle" :data-test="`plp-${f.key}`">
        <span class="plp-toggle-row">
          <span class="plp-lbl">{{ f.label }}</span>
          <input type="checkbox" :checked="cacheBool(f)" :disabled="disabled" @change="setBool(f.key, $event)" />
        </span>
        <small class="plp-desc">{{ f.desc }}</small>
      </label>

      <label class="plp-field" data-test="plp-cache_stable_prefix_ttl">
        <span class="plp-lbl">Stable-prefix cache TTL</span>
        <small class="plp-desc">How long the stable cache lives. 5 minutes suits most chats; 1 hour helps long coding/agent sessions with pauses over 5 minutes (Anthropic 1-hour cache).</small>
        <select class="plp-select" :value="stableTtl" :disabled="disabled" @change="setStr('cache_stable_prefix_ttl', $event)">
          <option value="5m">5 minutes</option>
          <option value="1h">1 hour</option>
        </select>
      </label>

      <label class="plp-field" data-test="plp-cache_rag_placement">
        <span class="plp-lbl">RAG / retrieved-context placement</span>
        <small class="plp-desc">Where per-turn RAG/vector/memory goes. "Tail" (after history) is required to cache history in Phase 2; "System inline" keeps it in the volatile system block (current behavior).</small>
        <select class="plp-select" :value="ragPlacement" :disabled="disabled" @change="setStr('cache_rag_placement', $event)">
          <option value="tail">Tail (after history)</option>
          <option value="system_inline">System (volatile block)</option>
        </select>
      </label>

      <label class="plp-field" data-test="plp-checkpoint_trigger_tokens">
        <span class="plp-lbl">Compress-late threshold <span class="plp-unit">(tokens)</span></span>
        <small class="plp-desc">Keep raw conversation history (byte-stable → cacheable) until it reaches this many tokens, then summarize old turns and freeze that summary. 0 = legacy behaviour (summarize by message count). Try 60,000–80,000 for long sessions; pairs with "Cache conversation history".</small>
        <input type="number" min="0" :step="1000" :disabled="disabled"
               :value="modelValue.checkpoint_trigger_tokens ?? ''" @input="setCheckpointTokens" placeholder="0 (legacy)" />
      </label>

      <label class="plp-field" data-test="plp-default_context_profile">
        <span class="plp-lbl">Default context profile</span>
        <small class="plp-desc">The platform-wide default context <strong>size</strong> an agent uses when it's on <strong>Automatic</strong>. Set here, it <strong>overrides each org's default</strong> — only an agent's own pinned size beats it. Precedence: agent's own profile → <strong>this</strong> → org default → per-request-type. Choose <strong>Automatic</strong> to keep per-request adaptivity (trivial turn → Short, normal → Medium, deep/multi-step task → Long).</small>
        <select class="plp-select" :value="platformDefaultProfile" :disabled="disabled" @change="setStr('default_context_profile', $event)">
          <option value="">Automatic (adapt per request type)</option>
          <option value="short">Short context</option>
          <option value="medium">Medium context</option>
          <option value="long">Long context</option>
        </select>
      </label>

      <div class="plp-field" data-test="plp-history-strategy-note">
        <span class="plp-lbl">History strategy</span>
        <small class="plp-desc">Conversation history uses a single strategy: it keeps FULL raw history until ~80% of the agent PROFILE's input target, then compacts the older turns into ONE structured, cache-stable summary — preserving them (never dropping) and scaling to whichever profile the agent uses. The tuning below (compaction trigger %, summary %, chunk size, min window for caching) controls it. Legacy drop/count strategies were removed; a final token-fit at the model's hard ceiling is the only safety trim.</small>
      </div>

      <label class="plp-field" data-test="plp-long_context_min_window">
        <span class="plp-lbl">Long-Context: min model window <span class="plp-unit">(tokens)</span></span>
        <small class="plp-desc">Long-Context Mode engages on cache-capable models whose context window is at least this large; smaller (or non-caching) models always use legacy behaviour regardless of the strategy. Default 128,000.</small>
        <input type="number" min="128000" :step="50000" :disabled="disabled"
               :value="modelValue.long_context_min_window ?? ''" @input="setPlpInt('long_context_min_window', $event, 100000, 100000000)" placeholder="128,000" />
      </label>

      <label class="plp-field" data-test="plp-long_context_chunk_tokens">
        <span class="plp-lbl">Long-Context: frozen-chunk / tail size cap <span class="plp-unit">(tokens)</span></span>
        <small class="plp-desc">Upper bound on a frozen history chunk / the recent raw tail (and the cache-breakpoint boundary). Auto-shrinks to ≤25% of the usable window on smaller models, so a large value is safe. Default 60,000.</small>
        <input type="number" min="1000" :step="5000" :disabled="disabled"
               :value="modelValue.long_context_chunk_tokens ?? ''" @input="setPlpInt('long_context_chunk_tokens', $event, 1000, 10000000)" placeholder="60,000" />
      </label>

      <label class="plp-field" data-test="plp-long_context_trigger_pct">
        <span class="plp-lbl">Long-Context: compaction trigger <span class="plp-unit">(% of usable window)</span></span>
        <small class="plp-desc">Keep full raw history until it reaches this percentage of the model’s usable window, then run one large compaction. Default 80. Range 10–95.</small>
        <input type="number" min="10" max="95" :step="5" :disabled="disabled"
               :value="modelValue.long_context_trigger_pct ?? ''" @input="setPlpInt('long_context_trigger_pct', $event, 10, 95)" placeholder="80" />
      </label>

      <label class="plp-field" data-test="plp-long_context_summary_pct">
        <span class="plp-lbl">Long-Context: summary budget <span class="plp-unit">(%)</span></span>
        <small class="plp-desc">Controls the compaction summary size: the summarizer aims to keep about this percentage of the history it compacts, and the summary can never exceed this percentage of the model window (the hard cap). Higher = richer, more faithful summaries; lower = more aggressive compression. Default 15. Range 1–40.</small>
        <input type="number" min="1" max="40" :step="1" :disabled="disabled"
               :value="modelValue.long_context_summary_pct ?? ''" @input="setPlpInt('long_context_summary_pct', $event, 1, 40)" placeholder="15" />
      </label>

      <label class="plp-field plp-toggle" data-test="plp-durable_steps_enabled">
        <span class="plp-toggle-row">
          <span class="plp-lbl">Durable tool-step transcript</span>
          <input type="checkbox" :checked="durableSteps" :disabled="disabled"
                 @change="setBool('durable_steps_enabled', $event)" />
        </span>
        <small class="plp-desc">When ON, every tool call / result / error is saved as a durable step (separate from the visible chat) so the full trace is replayable and even small tool results can be reloaded after the turn ends. When OFF, only large results are kept (legacy behaviour).</small>
      </label>

      <label class="plp-field" data-test="plp-durable_step_max_bytes">
        <span class="plp-lbl">Inline step size limit <span class="plp-unit">(bytes)</span></span>
        <small class="plp-desc">A tool output up to this size is stored inline in the step (durable, exact). Larger outputs are offloaded to the artifact store. Default 32,768 (32 KB).</small>
        <input type="number" min="1" :step="1024" :disabled="disabled || !durableSteps"
               :value="modelValue.durable_step_max_bytes ?? ''" @input="setNum('durable_step_max_bytes', $event)"
               placeholder="32768" />
        <small class="plp-hint"><span v-if="!(modelValue.durable_step_max_bytes)">Blank = default 32,768 bytes</span></small>
        <small v-if="errors.durable_step_max_bytes" class="plp-err">{{ errors.durable_step_max_bytes }}</small>
      </label>

      <label class="plp-field" data-test="plp-durable_steps_max_per_conversation">
        <span class="plp-lbl">Max steps per conversation</span>
        <small class="plp-desc">Keep at most this many step rows per conversation (oldest pruned) so storing every result can’t grow without limit. Default 1,000; set a large value for effectively unlimited.</small>
        <input type="number" min="1" :step="100" :disabled="disabled || !durableSteps"
               :value="modelValue.durable_steps_max_per_conversation ?? ''"
               @input="setNum('durable_steps_max_per_conversation', $event)" placeholder="1000" />
        <small class="plp-hint"><span v-if="!(modelValue.durable_steps_max_per_conversation)">Blank = default 1,000</span></small>
        <small v-if="errors.durable_steps_max_per_conversation" class="plp-err">{{ errors.durable_steps_max_per_conversation }}</small>
      </label>
    </div>
  </div>
</template>

<style scoped>
.plp { display: flex; flex-direction: column; gap: 14px; }
.plp-note { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-muted, #64748b); }
.plp-subhead { margin: 6px 0 0; font-size: 14px; font-weight: 700; color: var(--text, #0f172a); }
.plp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.plp-field { display: flex; flex-direction: column; gap: 5px; padding: 12px; border: 1px solid var(--border, #eef2f7); border-radius: 10px; background: var(--surface, #fbfcfe); }
.plp-lbl { font-size: 13px; font-weight: 600; }
.plp-unit { font-weight: 400; color: var(--text-muted, #94a3b8); font-size: 11px; }
.plp-desc { font-size: 11.5px; line-height: 1.5; color: var(--text-muted, #64748b); }
.plp-field input[type="number"] { margin-top: 2px; padding: 8px 10px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; font-size: 14px; }
.plp-select { margin-top: 2px; padding: 8px 10px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; font-size: 14px; background: #fff; }
.plp-field input:disabled { opacity: .6; }
.plp-hint { font-size: 11px; color: var(--text-muted, #94a3b8); }
.plp-err { font-size: 11px; color: #dc2626; font-weight: 600; }
.plp-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
@media (max-width: 640px) { .plp-grid { grid-template-columns: 1fr; } }
</style>
