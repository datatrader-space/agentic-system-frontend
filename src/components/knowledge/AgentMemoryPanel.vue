<template>
  <div class="agent-memory-panel h-full flex flex-col">
    <!-- Status Toast -->
    <transition name="slide-down">
      <div v-if="statusMsg" class="px-5 py-2 text-xs font-medium shrink-0"
        :class="statusType === 'error' ? 'bg-red-50 text-red-700' : statusType === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'">
        {{ statusMsg }}
      </div>
    </transition>

    <!-- Header -->
    <div class="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-purple-50 shrink-0">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-gray-800 flex items-center gap-2">
            🧠 Agent Memory
            <span v-if="stats.active_cards" class="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
              {{ stats.active_cards }} active
            </span>
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">Knowledge from dreaming cycles • injected into prompts</p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="fetchKnowledge" :disabled="loading"
            class="p-2 hover:bg-white/60 rounded-lg transition text-gray-500" title="Refresh">
            <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button @click="triggerDream" :disabled="dreaming"
            class="h-8 px-3 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
            :class="dreaming ? 'bg-purple-200 text-purple-500 cursor-wait' : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm'">
            <span v-if="dreaming" class="animate-pulse">🌙</span>
            <span v-else>🌙</span>
            {{ dreaming ? 'Dreaming...' : 'Dream Now' }}
          </button>
        </div>
      </div>

      <!-- Config Row -->
      <div class="flex items-center gap-4 mt-3 pt-3 border-t border-violet-100 flex-wrap">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" :checked="config.dreaming_enabled" @change="toggleConfig('dreaming_enabled', $event.target.checked)"
            class="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
          <span class="text-xs font-medium text-gray-700">Dreaming</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" :checked="config.auto_dream" @change="toggleConfig('auto_dream', $event.target.checked)"
            class="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
          <span class="text-xs font-medium text-gray-700">Auto-dream</span>
        </label>
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-gray-500">Every</span>
          <select :value="config.dream_frequency" @change="toggleConfig('dream_frequency', parseInt($event.target.value))"
            class="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
            <option :value="3">3</option><option :value="5">5</option>
            <option :value="10">10</option><option :value="20">20</option><option :value="50">50</option>
          </select>
          <span class="text-xs text-gray-500">sessions</span>
        </div>

        <!-- Dream Model Selector -->
        <div class="flex items-center gap-1.5 ml-auto">
          <span class="text-xs text-gray-500">Model:</span>
          <select v-model="selectedDreamProvider" @change="onProviderChange"
            class="text-xs border border-gray-200 rounded px-2 py-1 bg-white min-w-[80px]">
            <option :value="null">All</option>
            <option v-for="p in llmProviders" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <select :value="config.dream_model" @change="updateDreamModel($event.target.value)"
            class="text-xs border border-gray-200 rounded px-2 py-1 bg-white min-w-[140px] max-w-[220px]">
            <option :value="null">Use agent default</option>
            <option v-for="m in filteredModels" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </div>

      <!-- Dream Model Badge -->
      <div v-if="config.dream_model_info" class="mt-2 flex items-center gap-2 text-xs">
        <span class="px-2 py-0.5 rounded-full font-medium"
          :class="config.dream_model_info.is_explicit ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'">
          {{ config.dream_model_info.is_explicit ? '🎯' : '🔄' }}
          {{ config.dream_model_info.name }}
        </span>
        <span v-if="config.dream_model_info.provider_type" class="text-gray-400">
          via {{ config.dream_model_info.provider_name || config.dream_model_info.provider_type }}
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
      <!-- Loading -->
      <div v-if="loading && !cards.length" class="text-center py-12 text-gray-400">
        <div class="animate-spin inline-block w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full mb-3"></div>
        <p class="text-sm">Loading knowledge...</p>
      </div>

      <!-- Stats Row -->
      <div v-if="!loading || cards.length" class="flex gap-3 flex-wrap">
        <div v-for="(count, layer) in stats.by_layer" :key="layer"
          class="px-3 py-1.5 rounded-lg text-xs font-medium" :class="layerStyle(layer)">
          {{ layerLabel(layer) }}: {{ count }}
        </div>
        <div v-if="stats.total_injections" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700">
          💉 {{ stats.total_injections }} injected
        </div>
      </div>

      <!-- Toolbar: Add Card + Sort + Select + Search -->
      <div class="flex items-center gap-2 flex-wrap">
        <button @click="showCreateForm = !showCreateForm"
          class="text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1"
          :class="showCreateForm ? 'bg-gray-200 text-gray-700' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'">
          {{ showCreateForm ? '✕ Cancel' : '+ Add Card' }}
        </button>
        <!-- Sort -->
        <button @click="sortBy = sortBy === 'importance' ? 'time' : 'importance'"
          class="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition flex items-center gap-1">
          {{ sortBy === 'time' ? '🕐 Newest' : '⭐ Importance' }}
        </button>
        <!-- Select All -->
        <label v-if="filteredCards.length" class="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500 ml-1">
          <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" class="w-3.5 h-3.5 rounded border-gray-300 text-violet-600" />
          All
        </label>
        <!-- Bulk Delete -->
        <button v-if="selectedCards.size > 0" @click="bulkDelete" :disabled="bulkDeleting"
          class="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition flex items-center gap-1">
          🗑 Delete {{ selectedCards.size }} selected
        </button>
        <div class="flex-1"></div>
        <input v-model="cardSearch" type="text" placeholder="Search cards..."
          class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-44 focus:ring-1 focus:ring-violet-400 focus:outline-none" />
      </div>

      <!-- Create Card Form -->
      <div v-if="showCreateForm" class="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select v-model="newCard.card_type" class="w-full text-xs border rounded-lg px-2 py-1.5 bg-white">
              <option value="environment">Environment</option>
              <option value="workflow">Workflow</option>
              <option value="command">Command</option>
              <option value="anti_pattern">Anti-Pattern</option>
              <option value="tool_mastery">Tool Mastery</option>
              <option value="user_pattern">User Pattern</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Layer</label>
            <select v-model="newCard.layer" class="w-full text-xs border rounded-lg px-2 py-1.5 bg-white">
              <option value="prompt">L1 — System Prompt</option>
              <option value="card">L2 — Context Card</option>
              <option value="tool">L3 — Tool Augmentation</option>
            </select>
          </div>
        </div>
        <input v-model="newCard.title" type="text" placeholder="Card title..."
          class="w-full text-sm border rounded-lg px-3 py-2 focus:ring-1 focus:ring-violet-400 focus:outline-none" />
        <textarea v-model="newCard.content" placeholder="Card content..." rows="3"
          class="w-full text-sm border rounded-lg px-3 py-2 focus:ring-1 focus:ring-violet-400 focus:outline-none resize-none"></textarea>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <label class="text-xs text-gray-500">Importance:</label>
            <input v-model.number="newCard.importance" type="range" min="1" max="10" class="w-20 h-1.5 accent-violet-600" />
            <span class="text-xs font-mono text-gray-600 w-4">{{ newCard.importance }}</span>
          </div>
          <input v-model="newCard.triggersStr" type="text" placeholder="Triggers (comma-separated)"
            class="flex-1 text-xs border rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-violet-400 focus:outline-none" />
          <button @click="createCard" :disabled="!newCard.title || !newCard.content || creating"
            class="px-4 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition">
            {{ creating ? 'Creating...' : 'Create' }}
          </button>
        </div>
      </div>

      <!-- Cards List -->
      <div v-if="filteredCards.length" class="space-y-1.5">
        <div v-for="card in filteredCards" :key="card.id"
          class="border rounded-lg transition hover:shadow-sm"
          :class="[
            card.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60',
            expandedCard === card.id ? 'ring-1 ring-violet-300' : ''
          ]">

          <!-- Compact Card Row -->
          <div class="flex items-center gap-2 px-3 py-2 cursor-pointer" @click="expandedCard = expandedCard === card.id ? null : card.id">
            <!-- Select checkbox -->
            <input type="checkbox" :checked="selectedCards.has(card.id)" @click.stop @change="toggleSelect(card.id)"
              class="w-3.5 h-3.5 rounded border-gray-300 text-violet-600 shrink-0" />
            <!-- Type icon -->
            <span class="shrink-0 w-5 h-5 flex items-center justify-center text-xs rounded"
              :class="typeStyle(card.card_type)" :title="card.card_type">
              {{ typeIcon(card.card_type) }}
            </span>
            <!-- Title + preview -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-medium text-gray-800 truncate">{{ card.title }}</span>
                <span class="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium" :class="layerBadge(card.layer)">{{ card.layer }}</span>
                <span v-if="card.source === 'manual'" class="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">manual</span>
              </div>
              <p v-if="expandedCard !== card.id" class="text-xs text-gray-500 truncate mt-0.5">{{ card.content }}</p>
            </div>
            <!-- Importance + Stats -->
            <div class="shrink-0 flex items-center gap-2 text-[10px] text-gray-400">
              <span v-if="card.times_injected" title="Times injected">💉{{ card.times_injected }}</span>
              <span class="font-mono font-semibold" :class="card.importance >= 8 ? 'text-red-500' : card.importance >= 5 ? 'text-gray-600' : 'text-gray-400'"
                :title="'Importance: ' + card.importance">{{ card.importance }}</span>
            </div>
            <!-- Always-visible actions -->
            <div class="shrink-0 flex items-center gap-0.5" @click.stop>
              <button @click="toggleActive(card)"
                class="p-1.5 rounded hover:bg-gray-100 transition text-xs"
                :class="card.is_active ? 'text-green-600' : 'text-gray-300'"
                :title="card.is_active ? 'Active (click to deactivate)' : 'Inactive (click to activate)'">
                {{ card.is_active ? '●' : '○' }}
              </button>
              <button @click="confirmDelete(card)"
                class="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition" title="Delete">
                ✕
              </button>
            </div>
          </div>

          <!-- Expanded Edit View -->
          <div v-if="expandedCard === card.id" class="border-t border-gray-100 px-3 py-3 space-y-2" @click.stop>
            <textarea v-model="card.content" rows="4"
              class="w-full text-xs border rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-violet-400 focus:outline-none resize-none bg-gray-50"></textarea>
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1">
                <label class="text-[10px] text-gray-500">Importance:</label>
                <input v-model.number="card.importance" type="number" min="1" max="10"
                  class="w-10 text-xs text-center border rounded px-1 py-0.5" />
              </div>
              <div class="flex items-center gap-1 flex-1">
                <label class="text-[10px] text-gray-500">Triggers:</label>
                <input :value="(card.triggers || []).join(', ')" @change="card.triggers = $event.target.value.split(',').map(t => t.trim()).filter(Boolean)"
                  class="flex-1 text-xs border rounded px-2 py-0.5" placeholder="comma-separated keywords" />
              </div>
              <button @click="saveCard(card)" :disabled="savingCard === card.id"
                class="px-3 py-1 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition">
                {{ savingCard === card.id ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!loading" class="text-center py-8 text-gray-400">
        <p class="text-3xl mb-2">🌙</p>
        <p class="text-sm">No knowledge cards yet</p>
        <p class="text-xs mt-1">Run a dream cycle or add cards manually</p>
      </div>

      <!-- Dream Run History -->
      <div v-if="dreamRuns.length" class="mt-4">
        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Dreams</h3>
        <div class="space-y-1">
          <div v-for="run in dreamRuns" :key="run.id"
            class="flex items-center gap-3 text-xs px-3 py-2 bg-gray-50 rounded-lg">
            <span class="text-gray-400">{{ formatDate(run.created_at) }}</span>
            <span class="text-gray-600 font-medium truncate max-w-[160px]">{{ run.model_used }}</span>
            <span class="text-green-600">+{{ run.cards_created }}</span>
            <span v-if="run.cards_updated" class="text-blue-600">~{{ run.cards_updated }}</span>
            <span v-if="run.cards_deactivated" class="text-red-500">-{{ run.cards_deactivated }}</span>
            <span class="ml-auto text-gray-400">{{ run.elapsed_seconds?.toFixed(1) }}s</span>
            <span v-if="run.cost && run.cost !== '0.000000'" class="text-gray-500">${{ parseFloat(run.cost).toFixed(3) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import api from '../../services/api';

const props = defineProps({
  agentProfile: { type: Object, required: true }
});

// State
const loading = ref(false);
const dreaming = ref(false);
const creating = ref(false);
const savingCard = ref(null);
const cards = ref([]);
const dreamRuns = ref([]);
const config = ref({
  dreaming_enabled: true,
  auto_dream: true,
  dream_frequency: 20,
  dream_model: null,
  dream_model_info: null,
});
const stats = ref({ active_cards: 0, by_layer: {}, total_injections: 0, total_helpful: 0 });
const expandedCard = ref(null);
const showCreateForm = ref(false);
const cardSearch = ref('');
const sortBy = ref('importance'); // 'importance' | 'time'
const selectedCards = ref(new Set());
const bulkDeleting = ref(false);

// Status toast
const statusMsg = ref('');
const statusType = ref('info'); // info | success | error
let statusTimer = null;
const showStatus = (msg, type = 'info', durationMs = 4000) => {
  statusMsg.value = msg;
  statusType.value = type;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusMsg.value = ''; }, durationMs);
};

// LLM model selection
const llmProviders = ref([]);
const llmModels = ref([]);
const selectedDreamProvider = ref(null);

// New card form
const newCard = ref({
  card_type: 'environment',
  layer: 'card',
  title: '',
  content: '',
  importance: 5,
  triggersStr: '',
});

// Computed
const filteredModels = computed(() => {
  if (!selectedDreamProvider.value) return llmModels.value;
  return llmModels.value.filter(m => m.provider === selectedDreamProvider.value);
});

const sortedCards = computed(() => {
  const list = [...cards.value];
  if (sortBy.value === 'time') {
    list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } else {
    list.sort((a, b) => b.importance - a.importance);
  }
  return list;
});

const filteredCards = computed(() => {
  const source = sortedCards.value;
  if (!cardSearch.value) return source;
  const q = cardSearch.value.toLowerCase();
  return source.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.content.toLowerCase().includes(q) ||
    c.card_type.includes(q) ||
    (c.triggers || []).some(t => t.toLowerCase().includes(q))
  );
});

const allSelected = computed(() => {
  return filteredCards.value.length > 0 && filteredCards.value.every(c => selectedCards.value.has(c.id));
});

const toggleSelect = (id) => {
  const s = new Set(selectedCards.value);
  s.has(id) ? s.delete(id) : s.add(id);
  selectedCards.value = s;
};

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedCards.value = new Set();
  } else {
    selectedCards.value = new Set(filteredCards.value.map(c => c.id));
  }
};

const bulkDelete = async () => {
  const count = selectedCards.value.size;
  if (!confirm(`Delete ${count} selected cards?`)) return;
  bulkDeleting.value = true;
  try {
    await api.bulkDeleteKnowledgeCards(props.agentProfile.id, [...selectedCards.value]);
    cards.value = cards.value.filter(c => !selectedCards.value.has(c.id));
    stats.value.active_cards = cards.value.filter(c => c.is_active).length;
    showStatus(`Deleted ${count} cards`, 'success', 3000);
    selectedCards.value = new Set();
  } catch (e) {
    console.error('Bulk delete failed:', e);
    showStatus('Bulk delete failed', 'error');
  } finally {
    bulkDeleting.value = false;
  }
};

// Methods
const fetchKnowledge = async () => {
  if (!props.agentProfile?.id) return;
  loading.value = true;
  try {
    const res = await api.getAgentKnowledge(props.agentProfile.id);
    cards.value = res.data.cards || [];
    dreamRuns.value = res.data.dream_runs || [];
    config.value = { ...config.value, ...res.data.config };
    stats.value = res.data.stats || stats.value;

    // Set provider filter based on current dream model
    if (config.value.dream_model_info) {
      const dm = llmModels.value.find(m => m.id === config.value.dream_model);
      if (dm) selectedDreamProvider.value = dm.provider;
    }
  } catch (e) {
    console.error('Failed to fetch knowledge:', e);
    showStatus('Failed to load knowledge', 'error');
  } finally {
    loading.value = false;
  }
};

const fetchProviders = async () => {
  try {
    const res = await api.getLlmProviders();
    llmProviders.value = res.data.results || res.data;
  } catch (e) { console.error('Failed to fetch providers:', e); }
};

const fetchModels = async () => {
  try {
    const res = await api.getLlmModels();
    llmModels.value = res.data.results || res.data;
  } catch (e) { console.error('Failed to fetch models:', e); }
};

const toggleConfig = async (field, value) => {
  try {
    const res = await api.updateKnowledgeConfig(props.agentProfile.id, { [field]: value });
    Object.assign(config.value, res.data);
    showStatus(`Config updated: ${field}`, 'success', 2000);
  } catch (e) {
    console.error('Failed to update config:', e);
    showStatus('Failed to save config', 'error');
  }
};

const updateDreamModel = async (val) => {
  const modelId = val && val !== 'null' ? parseInt(val) : null;
  try {
    const res = await api.updateKnowledgeConfig(props.agentProfile.id, { dream_model: modelId });
    Object.assign(config.value, res.data);
    const modelName = modelId ? (llmModels.value.find(m => m.id === modelId)?.name || 'Selected') : 'agent default';
    showStatus(`Dream model → ${modelName}`, 'success', 3000);
  } catch (e) {
    console.error('Failed to update dream model:', e);
    showStatus('Failed to set dream model', 'error');
  }
};

const onProviderChange = () => {};

const triggerDream = async () => {
  dreaming.value = true;
  showStatus('🌙 Dream cycle started... this takes 30-60 seconds', 'info', 30000);
  try {
    const res = await api.triggerDream(props.agentProfile.id);
    const model = res.data?.model || 'default';
    showStatus(`🌙 Dreaming with ${model}... will refresh when done`, 'info', 20000);
    // Poll for completion
    setTimeout(async () => {
      await fetchKnowledge();
      dreaming.value = false;
      showStatus('✅ Dream cycle complete — cards refreshed', 'success', 5000);
    }, 20000);
  } catch (e) {
    console.error('Dream failed:', e);
    dreaming.value = false;
    showStatus('❌ Dream failed: ' + (e.response?.data?.error || e.message), 'error', 8000);
  }
};

const createCard = async () => {
  creating.value = true;
  try {
    const triggers = newCard.value.triggersStr
      ? newCard.value.triggersStr.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    const res = await api.createKnowledgeCard(props.agentProfile.id, {
      ...newCard.value,
      triggers,
    });
    cards.value.unshift(res.data);
    stats.value.active_cards = (stats.value.active_cards || 0) + 1;
    newCard.value = { card_type: 'environment', layer: 'card', title: '', content: '', importance: 5, triggersStr: '' };
    showCreateForm.value = false;
    showStatus('Card created', 'success', 2000);
  } catch (e) {
    console.error('Failed to create card:', e);
    showStatus('Failed: ' + (e.response?.data?.error || e.message), 'error');
  } finally {
    creating.value = false;
  }
};

const saveCard = async (card) => {
  savingCard.value = card.id;
  try {
    await api.updateKnowledgeCard(props.agentProfile.id, card.id, {
      content: card.content,
      importance: card.importance,
      triggers: card.triggers,
      title: card.title,
    });
    showStatus('Card saved', 'success', 2000);
  } catch (e) {
    console.error('Failed to save card:', e);
    showStatus('Failed to save', 'error');
  } finally {
    savingCard.value = null;
  }
};

const toggleActive = async (card) => {
  try {
    const res = await api.updateKnowledgeCard(props.agentProfile.id, card.id, {
      is_active: !card.is_active,
    });
    card.is_active = res.data.is_active;
    showStatus(card.is_active ? 'Card activated' : 'Card deactivated', 'success', 2000);
  } catch (e) {
    console.error('Failed to toggle card:', e);
    showStatus('Toggle failed', 'error');
  }
};

const confirmDelete = async (card) => {
  if (!confirm(`Delete "${card.title}"?`)) return;
  try {
    await api.deleteKnowledgeCard(props.agentProfile.id, card.id);
    cards.value = cards.value.filter(c => c.id !== card.id);
    stats.value.active_cards = cards.value.filter(c => c.is_active).length;
    showStatus('Card deleted', 'success', 2000);
  } catch (e) {
    console.error('Failed to delete card:', e);
    showStatus('Delete failed: ' + (e.response?.data?.error || e.message), 'error');
  }
};

// Helpers
const typeIcon = (type) => {
  const icons = { environment: '🌍', workflow: '⚡', command: '⌘', anti_pattern: '⚠', tool_mastery: '🔧', user_pattern: '👤', failure_pattern: '❌' };
  return icons[type] || '📌';
};
const typeStyle = (type) => {
  const styles = { environment: 'bg-emerald-50 text-emerald-700', workflow: 'bg-blue-50 text-blue-700', command: 'bg-orange-50 text-orange-700', anti_pattern: 'bg-red-50 text-red-700', tool_mastery: 'bg-purple-50 text-purple-700', user_pattern: 'bg-cyan-50 text-cyan-700' };
  return styles[type] || 'bg-gray-50 text-gray-700';
};
const layerStyle = (layer) => {
  const styles = { prompt: 'bg-indigo-50 text-indigo-700', card: 'bg-violet-50 text-violet-700', tool: 'bg-fuchsia-50 text-fuchsia-700', profile: 'bg-gray-100 text-gray-600' };
  return styles[layer] || 'bg-gray-100 text-gray-700';
};
const layerBadge = (layer) => {
  const styles = { prompt: 'bg-indigo-100 text-indigo-600', card: 'bg-violet-100 text-violet-600', tool: 'bg-fuchsia-100 text-fuchsia-600', profile: 'bg-gray-100 text-gray-500' };
  return styles[layer] || 'bg-gray-100 text-gray-500';
};
const layerLabel = (layer) => {
  const labels = { prompt: 'L1 Prompt', card: 'L2 Card', tool: 'L3 Tool', profile: 'Profile' };
  return labels[layer] || layer;
};
const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Init
watch(() => props.agentProfile?.id, (id) => {
  if (id) fetchKnowledge();
}, { immediate: true });

onMounted(async () => {
  await Promise.all([fetchProviders(), fetchModels()]);
  if (props.agentProfile?.id) fetchKnowledge();
});
</script>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
