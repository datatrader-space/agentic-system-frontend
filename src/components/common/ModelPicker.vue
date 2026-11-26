<template>
  <div ref="rootEl" class="mp">
    <!-- Trigger -->
    <button
      ref="triggerEl"
      type="button"
      @click="toggleOpen"
      aria-haspopup="listbox"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="open ? listId : undefined"
      :aria-label="ariaLabel ? `${ariaLabel}: ${selectedModel ? selectedModel.name : placeholder}` : undefined"
      data-test="model-picker-trigger"
      class="mp-trigger"
      :class="{ 'is-open': open }"
    >
      <span v-if="selectedModel" class="mp-trigger-sel">
        <span class="mp-vendor">{{ vendorLabel(selectedModel) }}</span>
        <span class="mp-trigger-name">{{ selectedModel.name }}</span>
      </span>
      <span v-else class="mp-placeholder">{{ placeholder }}</span>
      <ChevronDown class="mp-chevron" :class="{ 'is-open': open }" aria-hidden="true" />
    </button>

    <!-- Popover -->
    <div v-if="open" class="mp-pop">
      <!-- Search -->
      <div class="mp-search-wrap">
        <div class="mp-search">
          <Search class="mp-search-ic" aria-hidden="true" />
          <input
            ref="searchEl"
            v-model="search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            :aria-controls="listId"
            :aria-activedescendant="activeOptionId"
            :aria-label="`Search ${totalCount} models`"
            :placeholder="`Search ${totalCount} models…`"
            autocomplete="off"
            data-test="model-picker-search"
            class="mp-search-in"
            @keydown.esc.prevent.stop="close(true)"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="pickActive"
          />
        </div>

        <!-- Capability filter chips -->
        <div class="mp-chips" role="group" aria-label="Filter models by capability">
          <button
            v-for="f in filterChips"
            :key="f.key"
            type="button"
            class="mp-chip"
            :aria-pressed="activeFilters.has(f.key) ? 'true' : 'false'"
            :aria-label="`Only ${f.label.toLowerCase()} models`"
            :data-test="`model-filter-${f.key}`"
            @click="toggleFilter(f.key)"
          >
            <component :is="capIcon(f.key)" class="mp-chip-ic" aria-hidden="true" />{{ f.label }}
          </button>
        </div>
      </div>

      <!-- Results -->
      <div :id="listId" class="mp-list" role="listbox" :aria-label="ariaLabel || 'Models'">
        <template v-if="groups.length">
          <div v-for="group in groups" :key="group.vendor" role="group" :aria-label="group.label">
            <div class="mp-group" aria-hidden="true">
              {{ group.label }} <span class="mp-group-n">({{ group.models.length }})</span>
            </div>
            <button
              v-for="m in group.models"
              :id="optionId(m)"
              :key="m.id"
              type="button"
              role="option"
              tabindex="-1"
              :aria-selected="m.id === modelValue ? 'true' : 'false'"
              :aria-disabled="notRunning(m) ? 'true' : null"
              :disabled="notRunning(m) && m.id !== modelValue"
              :title="notRunning(m) ? m.metadata?.why_not : null"
              :data-test="`model-option-${m.id}`"
              class="mp-opt"
              :class="{ 'is-selected': m.id === modelValue, 'is-active': m.id !== modelValue && m.id === activeId, 'is-off': notRunning(m) }"
              @click="select(m)"
              @mouseenter="activeId = m.id"
            >
              <div class="mp-opt-row">
                <span class="mp-opt-name">{{ m.name }}</span>
                <span class="mp-opt-price">{{ formatPrice(m) }}</span>
              </div>
              <div class="mp-opt-meta">
                <span class="mp-opt-ctx">{{ formatContext(m) }}</span>
                <span v-for="cap in modelCaps(m)" :key="cap" class="mp-cap" :class="`mp-cap--${capTone(cap)}`">
                  <component :is="capIcon(cap)" class="mp-cap-ic" aria-hidden="true" />{{ capLabel(cap) }}
                </span>
              </div>
              <div v-if="notRunning(m)" class="mp-opt-off" :data-test="`model-off-${m.id}`">
                Not running now{{ m.metadata?.why_not ? ': ' + m.metadata.why_not : '' }}
              </div>
            </button>
          </div>
        </template>
        <div v-else class="mp-empty">
          No models match your search.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ChevronDown, Search, Image, Palette, Video, Brain, Code, FileText, Zap, CircleDollarSign, Wrench, Circle } from 'lucide-vue-next';

const props = defineProps({
  modelValue: { type: [Number, String], default: null },
  models: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select a model…' },
  // The field's name, read out with the chosen model ("Main model: GPT-5"), and the list's name.
  ariaLabel: { type: String, default: '' },
  // When true, embedding-only models are excluded (chat/default-model use-case).
  excludeEmbedding: { type: Boolean, default: true },
});
const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const search = ref('');
const activeFilters = ref(new Set());
const rootEl = ref(null);
const searchEl = ref(null);
const triggerEl = ref(null);
// The option the arrow keys are on (aria-activedescendant); Enter picks it.
const activeId = ref(null);
const listId = `model-picker-${Math.random().toString(36).slice(2, 9)}`;
const optionId = (m) => `${listId}-opt-${m.id}`;

const filterChips = [
  { key: 'image_input', label: 'Vision' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'coding', label: 'Coding' },
  { key: 'tools', label: 'Tools' },
  { key: 'long_context', label: 'Long context' },
  { key: 'free', label: 'Free' },
];

// ---- vendor parsing ----
const VENDOR_LABELS = {
  aadml: 'AADML',
  anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', 'meta-llama': 'Meta',
  meta: 'Meta', mistralai: 'Mistral', mistral: 'Mistral', deepseek: 'DeepSeek',
  'x-ai': 'xAI', qwen: 'Qwen', cohere: 'Cohere', perplexity: 'Perplexity',
  microsoft: 'Microsoft', nvidia: 'NVIDIA', amazon: 'Amazon', ai21: 'AI21',
  'nousresearch': 'Nous', 'cognitivecomputations': 'Cognitive', 'liquid': 'Liquid',
};
// A model id that starts with the ROUTE it runs through, not its maker ("fal-ai/flux-lora"), groups under
// "Other": people never see which provider AADML runs a model on (owner, 2026-10-29).
const ROUTE_PREFIXES = new Set(['fal-ai', 'fal', 'openrouter', 'elevenlabs']);
const vendorKey = (m) => {
  const id = m.model_id || '';
  if (m.metadata?.ready_model) return 'aadml';           // AADML's own hosted models (aadml_provider.py)
  const raw = (id.includes('/') ? id.split('/')[0] : (m.metadata?.vendor || 'other')).toLowerCase();
  return ROUTE_PREFIXES.has(raw) ? 'other' : raw;
};
const vendorLabel = (m) => {
  const k = vendorKey(m);
  return VENDOR_LABELS[k] || (k.charAt(0).toUpperCase() + k.slice(1));
};

// ---- capabilities ----
const modelCaps = (m) => {
  const caps = [...(m.metadata?.capabilities || [])];
  const params = m.metadata?.supported_parameters || [];
  if ((m.supports_tools || params.includes('tools')) && !caps.includes('tools')) caps.push('tools');
  if ((m.supports_vision || m.metadata?.vision) && !caps.includes('image_input')) caps.push('image_input');
  return caps;
};
// Each capability's colour (a pair of --vm-* tokens, light and dark) and Lucide icon; never an emoji.
const capTone = (c) => ({
  image_input: 'violet', image_output: 'violet', video_input: 'blue', reasoning: 'violet',
  coding: 'green', long_context: 'amber', fast: 'amber', free: 'green', tools: 'teal',
}[c] || 'neutral');
const CAP_ICONS = {
  image_input: Image, image_output: Palette, video_input: Video, reasoning: Brain,
  coding: Code, long_context: FileText, fast: Zap, free: CircleDollarSign, tools: Wrench,
};
const capIcon = (c) => CAP_ICONS[c] || Circle;
const capLabel = (c) => c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

// ---- formatting ----
const formatContext = (m) => {
  const c = m.context_window;
  if (!c) return '';
  if (c >= 1000) return `${Math.round(c / 1000)}K ctx`;
  return `${c} ctx`;
};
// An AADML hosted model says whether it runs (metadata.running); one that does not cannot be chosen.
const notRunning = (m) => m?.metadata?.running === false;
const formatPrice = (m) => {
  if (m.metadata?.price_per_1000_tokens != null) return `$${Number(m.metadata.price_per_1000_tokens)} per 1K tokens`;
  const inp = parseFloat(m.metadata?.pricing_input ?? '');
  const out = parseFloat(m.metadata?.pricing_output ?? '');
  if (Number.isNaN(inp) || Number.isNaN(out)) return '';
  if (inp === 0 && out === 0) return 'Free';
  const fmt = (v) => `$${(v * 1e6).toFixed(2)}`;
  return `${fmt(inp)}/${fmt(out)} per 1M`;
};

const selectedModel = computed(() => props.models.find((m) => m.id === props.modelValue) || null);

const available = computed(() =>
  props.models.filter((m) => !(props.excludeEmbedding && m.is_embedding))
);
const totalCount = computed(() => available.value.length);

// Search by name: every word typed must appear in the model's name, id or vendor, punctuation ignored, so
// "kling pro" finds "Kling v3.0 Pro" and "veo 3.1" finds "google/veo-3.1". A whole-string match missed any
// query whose words were not adjacent. A model whose description holds every word still matches.
const _norm = (s) => String(s || '').toLowerCase().replace(/[-_/:.,()]+/g, ' ');
const filtered = computed(() => {
  let list = available.value;
  const words = _norm(search.value).split(/\s+/).filter(Boolean);
  if (words.length) {
    const byName = [];
    const byDesc = [];
    for (const m of list) {
      const hay = ` ${_norm(m.name)} ${_norm(m.model_id)} ${_norm(vendorLabel(m))} `;
      if (words.every((w) => hay.includes(w))) byName.push(m);
      else if (words.every((w) => _norm(m.metadata?.description).includes(w))) byDesc.push(m);
    }
    list = byName.concat(byDesc);
  }
  if (activeFilters.value.size) {
    list = list.filter((m) => {
      const caps = new Set(modelCaps(m));
      return [...activeFilters.value].every((f) => caps.has(f));
    });
  }
  return list;
});

const groups = computed(() => {
  const map = new Map();
  for (const m of filtered.value) {
    const k = vendorKey(m);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  }
  return [...map.entries()]
    .map(([vendor, models]) => ({
      vendor,
      label: VENDOR_LABELS[vendor] || (vendor.charAt(0).toUpperCase() + vendor.slice(1)),
      models: models.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    }))
    .sort((a, b) => b.models.length - a.models.length || a.label.localeCompare(b.label));
});

const toggleFilter = (key) => {
  const next = new Set(activeFilters.value);
  next.has(key) ? next.delete(key) : next.add(key);
  activeFilters.value = next;
};

const select = (m) => {
  if (notRunning(m) && m.id !== props.modelValue) return;
  emit('update:modelValue', m.id);
  close(true);
};

// The options in the order they are shown (grouped), which is the order the arrow keys walk.
const ordered = computed(() => groups.value.flatMap((g) => g.models));
const activeOptionId = computed(() => {
  const m = ordered.value.find((x) => x.id === activeId.value);
  return m ? optionId(m) : undefined;
});
const move = (step) => {
  const list = ordered.value;
  if (!list.length) return;
  const i = list.findIndex((x) => x.id === activeId.value);
  const next = list[(i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length)];
  activeId.value = next.id;
  nextTick(() => document.getElementById(optionId(next))?.scrollIntoView?.({ block: 'nearest' }));
};
const pickActive = () => {
  const m = ordered.value.find((x) => x.id === activeId.value) || (search.value.trim() ? ordered.value[0] : null);
  if (m) select(m);
};

const toggleOpen = () => (open.value ? close(true) : openMenu());
const openMenu = () => {
  open.value = true;
  activeId.value = props.modelValue ?? null;
  nextTick(() => searchEl.value?.focus());
};
// `refocus`: give the focus back to the trigger (a keyboard close or a pick), so the person is not dropped to <body>.
const close = (refocus = false) => {
  const wasOpen = open.value;
  open.value = false;
  if (refocus === true && wasOpen) nextTick(() => triggerEl.value?.focus());
};

const onDocClick = (e) => {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) close();
};
onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));
watch(open, (v) => { if (!v) search.value = ''; });
watch(search, () => { activeId.value = null; });
</script>

<style scoped>
/* Every colour is an app token (src/style.css), so the picker follows the light and dark themes on every page. */
.mp { position: relative; font-family: var(--vm-font-sans, Inter, system-ui, sans-serif); }
.mp-trigger {
  width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px; border: 1px solid var(--vm-line-2); border-radius: 10px; background: var(--vm-surface);
  color: var(--vm-ink); text-align: left; cursor: pointer; transition: border-color .15s, box-shadow .15s;
}
.mp-trigger:hover { border-color: var(--vm-ink-faint); }
.mp-trigger.is-open { border-color: var(--vm-primary); box-shadow: 0 0 0 3px var(--vm-primary-soft); }
.mp-trigger:focus-visible { border-color: var(--vm-primary); outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.mp-trigger-sel { display: flex; align-items: center; gap: 8px; min-width: 0; }
.mp-vendor {
  flex-shrink: 0; padding: 2px 6px; border-radius: 4px; background: var(--vm-surface-soft); color: var(--vm-ink-soft);
  font-size: 10px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
}
.mp-trigger-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; color: var(--vm-ink); }
.mp-placeholder { font-size: 13.5px; color: var(--vm-ink-faint); }
.mp-chevron { width: 16px; height: 16px; flex-shrink: 0; color: var(--vm-ink-faint); transition: transform .15s; }
.mp-chevron.is-open { transform: rotate(180deg); }
.mp-pop {
  position: absolute; z-index: 50; margin-top: 4px; width: 100%; max-height: 340px; display: flex; flex-direction: column;
  overflow: hidden; border: 1px solid var(--vm-line); border-radius: 12px; background: var(--vm-surface);
  box-shadow: var(--vm-shadow-l);
}
.mp-search-wrap { padding: 8px; border-bottom: 1px solid var(--vm-line); }
.mp-search { position: relative; }
.mp-search-ic { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--vm-ink-faint); }
.mp-search-in {
  width: 100%; min-height: 40px; padding: 8px 12px 8px 32px; border: 1px solid var(--vm-line); border-radius: 8px;
  background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.mp-search-in::placeholder { color: var(--vm-ink-faint); }
.mp-search-in:focus { border-color: var(--vm-primary); box-shadow: 0 0 0 3px var(--vm-primary-soft); outline: none; }
.mp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.mp-chip {
  display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 2px 10px; border: 1px solid var(--vm-line);
  border-radius: 999px; background: var(--vm-surface); color: var(--vm-ink-soft); font: inherit; font-size: 11px; font-weight: 500;
  cursor: pointer; transition: border-color .15s, background-color .15s;
}
.mp-chip:hover { border-color: var(--vm-ink-faint); }
.mp-chip[aria-pressed='true'] { border-color: var(--vm-primary); background: var(--vm-primary); color: #fff; }
.mp-chip:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.mp-chip-ic, .mp-cap-ic { width: 12px; height: 12px; flex-shrink: 0; }
.mp-list { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 4px 0; }
.mp-group {
  position: sticky; top: 0; padding: 4px 12px; background: var(--vm-surface-soft); color: var(--vm-ink-faint);
  font-size: 10px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
}
.mp-group-n { font-weight: 400; }
.mp-opt {
  width: 100%; min-height: 44px; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 8px 12px;
  border: 0; background: none; color: var(--vm-ink); text-align: left; cursor: pointer; transition: background-color .15s;
}
.mp-opt:hover, .mp-opt.is-active { background: var(--vm-surface-soft); }
.mp-opt.is-selected { background: var(--vm-primary-soft); }
.mp-opt.is-off:disabled { cursor: not-allowed; }
.mp-opt.is-off .mp-opt-name { color: var(--vm-ink-faint); }
.mp-opt-off { font-size: 11px; line-height: 1.3; color: var(--vm-amber-ink); }
.mp-opt-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mp-opt-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--vm-ink); }
.mp-opt.is-selected .mp-opt-name { font-weight: 600; color: var(--vm-link); }
.mp-opt-price { flex-shrink: 0; font-size: 11px; color: var(--vm-ink-faint); font-variant-numeric: tabular-nums; }
.mp-opt-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.mp-opt-ctx { font-size: 10.5px; color: var(--vm-ink-faint); }
.mp-cap { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 500; }
.mp-cap--violet { background: var(--vm-violet-soft); color: var(--vm-violet-ink); }
.mp-cap--blue { background: var(--vm-primary-soft); color: var(--vm-link); }
.mp-cap--green { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.mp-cap--amber { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.mp-cap--teal { background: var(--vm-teal-soft); color: var(--vm-teal-ink); }
.mp-cap--neutral { background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.mp-empty { padding: 32px 12px; text-align: center; font-size: 13px; color: var(--vm-ink-faint); }
@media (pointer: coarse) { .mp-chip { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .mp-trigger, .mp-chevron, .mp-chip, .mp-opt { transition: none; } }
</style>
