<template>
  <div ref="rootEl" class="relative">
    <!-- Trigger -->
    <button
      type="button"
      @click="toggleOpen"
      class="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-left hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
      :class="{ 'border-indigo-500 ring-2 ring-indigo-500': open }"
    >
      <span v-if="selectedModel" class="flex items-center gap-2 min-w-0">
        <span class="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
          {{ vendorLabel(selectedModel) }}
        </span>
        <span class="truncate text-sm text-gray-800">{{ selectedModel.name }}</span>
      </span>
      <span v-else class="text-sm text-gray-400">{{ placeholder }}</span>
      <ChevronDown class="w-4 h-4 text-gray-400 shrink-0" :class="{ 'rotate-180': open }" />
    </button>

    <!-- Popover -->
    <div
      v-if="open"
      class="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden flex flex-col"
      style="max-height: 70vh;"
    >
      <!-- Search -->
      <div class="p-2 border-b border-gray-100">
        <div class="relative">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref="searchEl"
            v-model="search"
            type="text"
            :placeholder="`Search ${totalCount} models…`"
            class="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            @keydown.esc="close"
          />
        </div>

        <!-- Capability filter chips -->
        <div class="flex flex-wrap gap-1.5 mt-2">
          <button
            v-for="f in filterChips"
            :key="f.key"
            type="button"
            @click="toggleFilter(f.key)"
            :class="[
              'text-[11px] px-2 py-0.5 rounded-full font-medium border transition flex items-center gap-1',
              activeFilters.has(f.key)
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
            ]"
          >
            <span>{{ f.icon }}</span>{{ f.label }}
          </button>
        </div>
      </div>

      <!-- Results -->
      <div class="overflow-y-auto flex-1 py-1">
        <template v-if="groups.length">
          <div v-for="group in groups" :key="group.vendor">
            <div class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 sticky top-0">
              {{ group.label }} <span class="text-gray-300">({{ group.models.length }})</span>
            </div>
            <button
              v-for="m in group.models"
              :key="m.id"
              type="button"
              @click="select(m)"
              :class="[
                'w-full text-left px-3 py-2 hover:bg-indigo-50 transition flex flex-col gap-0.5',
                m.id === modelValue ? 'bg-indigo-50' : ''
              ]"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-gray-800 truncate" :class="{ 'font-semibold text-indigo-700': m.id === modelValue }">
                  {{ m.name }}
                </span>
                <span class="shrink-0 text-[11px] text-gray-400">{{ formatPrice(m) }}</span>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[10px] text-gray-400">{{ formatContext(m) }}</span>
                <span
                  v-for="cap in modelCaps(m)"
                  :key="cap"
                  :class="['text-[10px] px-1.5 py-px rounded-full font-medium flex items-center gap-0.5', capStyle(cap)]"
                >
                  <span>{{ capIcon(cap) }}</span>{{ capLabel(cap) }}
                </span>
              </div>
            </button>
          </div>
        </template>
        <div v-else class="px-3 py-8 text-center text-sm text-gray-400">
          No models match your search.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ChevronDown, Search } from 'lucide-vue-next';

const props = defineProps({
  modelValue: { type: [Number, String], default: null },
  models: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select a model…' },
  // When true, embedding-only models are excluded (chat/default-model use-case).
  excludeEmbedding: { type: Boolean, default: true },
});
const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const search = ref('');
const activeFilters = ref(new Set());
const rootEl = ref(null);
const searchEl = ref(null);

const filterChips = [
  { key: 'image_input', label: 'Vision', icon: '🖼️' },
  { key: 'reasoning', label: 'Reasoning', icon: '🧠' },
  { key: 'coding', label: 'Coding', icon: '💻' },
  { key: 'tools', label: 'Tools', icon: '🛠️' },
  { key: 'long_context', label: 'Long context', icon: '📝' },
  { key: 'free', label: 'Free', icon: '💰' },
];

// ---- vendor parsing ----
const VENDOR_LABELS = {
  anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', 'meta-llama': 'Meta',
  meta: 'Meta', mistralai: 'Mistral', mistral: 'Mistral', deepseek: 'DeepSeek',
  'x-ai': 'xAI', qwen: 'Qwen', cohere: 'Cohere', perplexity: 'Perplexity',
  microsoft: 'Microsoft', nvidia: 'NVIDIA', amazon: 'Amazon', ai21: 'AI21',
  'nousresearch': 'Nous', 'cognitivecomputations': 'Cognitive', 'liquid': 'Liquid',
};
const vendorKey = (m) => {
  const id = m.model_id || '';
  const raw = id.includes('/') ? id.split('/')[0] : (m.metadata?.vendor || 'other');
  return raw.toLowerCase();
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
  return caps;
};
const capStyle = (c) => ({
  image_input: 'bg-purple-100 text-purple-700', image_output: 'bg-pink-100 text-pink-700',
  video_input: 'bg-blue-100 text-blue-700', reasoning: 'bg-indigo-100 text-indigo-700',
  coding: 'bg-green-100 text-green-700', long_context: 'bg-orange-100 text-orange-700',
  fast: 'bg-yellow-100 text-yellow-700', free: 'bg-emerald-100 text-emerald-700',
  tools: 'bg-sky-100 text-sky-700',
}[c] || 'bg-gray-100 text-gray-600');
const capIcon = (c) => ({
  image_input: '🖼️', image_output: '🎨', video_input: '🎥', reasoning: '🧠',
  coding: '💻', long_context: '📝', fast: '⚡', free: '💰', tools: '🛠️',
}[c] || '•');
const capLabel = (c) => c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

// ---- formatting ----
const formatContext = (m) => {
  const c = m.context_window;
  if (!c) return '';
  if (c >= 1000) return `${Math.round(c / 1000)}K ctx`;
  return `${c} ctx`;
};
const formatPrice = (m) => {
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

const filtered = computed(() => {
  let list = available.value;
  const q = search.value.toLowerCase().trim();
  if (q) {
    list = list.filter((m) =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.model_id || '').toLowerCase().includes(q) ||
      vendorLabel(m).toLowerCase().includes(q) ||
      (m.metadata?.description || '').toLowerCase().includes(q)
    );
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
  emit('update:modelValue', m.id);
  close();
};

const toggleOpen = () => (open.value ? close() : openMenu());
const openMenu = () => {
  open.value = true;
  nextTick(() => searchEl.value?.focus());
};
const close = () => { open.value = false; };

const onDocClick = (e) => {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) close();
};
onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));
watch(open, (v) => { if (!v) search.value = ''; });
</script>
