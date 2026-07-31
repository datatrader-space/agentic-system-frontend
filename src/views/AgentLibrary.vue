<template>
  <div class="lib vm-scroll">
    <div class="lib-wrap">
      <!-- ===================== Hero header ===================== -->
      <div class="hero">
        <div>
          <span class="eyebrow"><span class="pip"></span> Workspace · {{ agents.length }} agent{{ agents.length === 1 ? '' : 's' }}</span>
          <h1 class="title">Your <span class="vm-grad-text">Agent Library</span></h1>
          <p class="sub">Design, test, and deploy specialized AI agents — each with its own tools, knowledge, and autonomy.</p>
        </div>
        <button class="cta" data-tour="create-agent-hero" @click="createAgent">
          <Icon icon="lucide:plus" class="i" /> Create Agent
        </button>
      </div>

      <!-- ===================== Stat row ===================== -->
      <div class="stats">
        <div class="stat s1"><Icon icon="lucide:users" class="badge-ic" /><div class="k">{{ totalDisplay }}</div><div class="l">Total agents</div></div>
        <div class="stat s2"><Icon icon="lucide:zap" class="badge-ic" /><div class="k">{{ liveDisplay }}</div><div class="l">Live &amp; deployed</div></div>
        <div class="stat s3"><Icon icon="lucide:wrench" class="badge-ic" /><div class="k">{{ toolsDisplay }}</div><div class="l">Tools connected</div></div>
        <div class="stat s4"><Icon icon="lucide:moon" class="badge-ic" /><div class="k">{{ idleDisplay }}</div><div class="l">Idle / drafts</div></div>
      </div>

      <!-- ===================== Toolbar ===================== -->
      <div class="toolbar">
        <div class="search">
          <Icon icon="lucide:search" class="i" />
          <input v-model="searchQuery" type="text" placeholder="Search agents, models, descriptions…" />
        </div>
        <div class="seg">
          <button :class="{ on: statusFilter === 'all' }" @click="statusFilter = 'all'">All</button>
          <button :class="{ on: statusFilter === 'live' }" @click="statusFilter = 'live'">Live</button>
          <button :class="{ on: statusFilter === 'idle' }" @click="statusFilter = 'idle'">Idle</button>
        </div>
        <div class="select-wrap">
          <Icon icon="lucide:arrow-up-down" class="i" />
          <select v-model="sortBy">
            <option value="recent">Recently updated</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
        <OwnerFilter v-model="ownerFilter" @update:modelValue="fetchAgents" />
      </div>

      <!-- ===================== Loading (shimmer skeletons) ===================== -->
      <div v-if="loading" class="grid">
        <div v-for="n in 6" :key="'sk' + n" class="skel-card">
          <div class="skel-top"><div class="vm-skel" style="width:54px;height:54px;border-radius:16px"></div><div class="vm-skel" style="width:54px;height:22px;border-radius:999px"></div></div>
          <div class="vm-skel" style="width:62%;height:18px;margin-top:18px"></div>
          <div class="vm-skel" style="width:80%;height:13px;margin-top:12px"></div>
          <div class="vm-skel" style="width:100%;height:12px;margin-top:16px"></div>
          <div class="vm-skel" style="width:88%;height:12px;margin-top:8px"></div>
          <div class="skel-foot"><div class="vm-skel" style="flex:1;height:38px"></div><div class="vm-skel" style="flex:1;height:38px"></div></div>
        </div>
      </div>

      <!-- ===================== Empty (no agents) ===================== -->
      <div v-else-if="agents.length === 0" class="empty">
        <EmptyArt />
        <h3>No agents yet</h3>
        <p>Create your first specialized agent to get started.</p>
        <button class="cta" data-tour="create-agent-empty" @click="createAgent"><Icon icon="lucide:sparkles" class="i" /> Design an Agent</button>
      </div>

      <!-- ===================== No matches ===================== -->
      <div v-else-if="filteredAgents.length === 0" class="empty">
        <EmptyArt search />
        <h3>No agents match your search</h3>
        <p>Try a different term or clear the filter.</p>
        <button class="ghost-btn" @click="clearFilters"><Icon icon="lucide:x" class="i" /> Clear filters</button>
      </div>

      <!-- ===================== Agent grid ===================== -->
      <template v-else>
      <!-- Paused agents banner + bulk resume -->
      <div v-if="pausedAgents.length" class="paused-banner">
        <Icon icon="lucide:pause-circle" />
        <span><strong>{{ pausedAgents.length }} agent{{ pausedAgents.length === 1 ? '' : 's' }} paused</strong> — won't start new runs until resumed.</span>
        <button class="resume-all" :disabled="resuming" @click="resumeAll">
          <Icon :icon="resuming ? 'lucide:loader-2' : 'lucide:play'" :class="{ spin: resuming }" /> Resume all
        </button>
      </div>

      <div class="grid">
        <article
          v-for="(agent, i) in pagedAgents"
          :key="agent.id"
          class="card"
          :class="themeOf(i)"
          :style="{ animationDelay: (i * 70 + 80) + 'ms' }"
          @click="editAgent(agent.id)"
          @mousemove="tilt"
          @mouseleave="untilt"
        >
          <span class="halo"></span>
          <div class="accent"></div>

          <!-- top: icon tile + status -->
          <div class="card-top">
            <span class="tile" :class="themeOf(i)"><Icon :icon="iconOf(agent)" /></span>
            <span v-if="agent.is_paused" class="badge paused" title="Paused — won't start new runs">
              <Icon icon="lucide:pause" /> Paused
            </span>
            <span v-else class="badge" :class="agent.signal_enabled ? 'live' : 'idle'"
                  :title="agent.signal_enabled ? 'External access (webhook / WebSocket) enabled' : 'Signals off'">
              <span class="vm-orb" :class="agent.signal_enabled ? 'is-live' : 'is-idle'"></span>
              {{ agent.signal_enabled ? 'Live' : 'Idle' }}
            </span>
          </div>

          <h3 class="name">{{ agent.name }}</h3>

          <!-- chips -->
          <div class="chips">
            <span v-if="agent.default_model_name" class="chip v" :title="agent.default_model_name">
              <Icon icon="lucide:cpu" /> {{ agent.default_model_name }}
            </span>
            <span class="chip"><Icon icon="lucide:wrench" /> {{ (agent.tools && agent.tools.length) || 0 }} tools</span>
            <span v-if="agent.knowledge_scope === 'system'" class="chip t"><Icon icon="lucide:globe" /> Global</span>
            <span v-else-if="agent.knowledge_scope === 'repository'" class="chip"><Icon icon="lucide:folder-git-2" /> Repo</span>
            <span v-else class="chip"><Icon icon="lucide:lock" /> Isolated</span>
          </div>

          <p class="desc">{{ agent.description || 'No description yet — open Configure to add one.' }}</p>

          <!-- capability meter -->
          <div class="meter">
            <div class="meter-lbl"><span>Capability coverage</span><span>{{ capability(agent) }}%</span></div>
            <div class="bar"><i :style="{ width: (barsReady ? capability(agent) : 0) + '%' }"></i></div>
          </div>

          <!-- footer actions -->
          <div class="card-foot">
            <button class="b-chat" @click.stop="openChat(agent)"><Icon icon="lucide:message-circle" /> Chat</button>
            <button class="b-cfg" @click.stop="editAgent(agent.id)"><Icon icon="lucide:settings-2" /> Configure</button>
            <div class="more">
              <button class="b-more" :title="'More actions'" @click.stop="toggleMenu(agent.id)"><Icon icon="lucide:more-horizontal" /></button>
              <div v-if="openMenuId === agent.id" class="menu" @click.stop>
                <button @click.stop="openMonitor(agent)"><Icon icon="lucide:activity" /> Monitor</button>
                <button @click.stop="openWorkspace(agent)"><Icon icon="lucide:folder" /> Workspace</button>
                <button @click.stop="openIntegrationGuide(agent)"><Icon icon="lucide:book-open" /> Integration Guide <Icon icon="lucide:external-link" class="ext" /></button>
                <button @click.stop="duplicateAgent(agent)"><Icon icon="lucide:copy" /> Duplicate</button>
                <button v-if="agent.is_owner !== false" class="danger" @click.stop="confirmDelete(agent); closeMenus()"><Icon icon="lucide:trash-2" /> Delete</button>
              </div>
            </div>
          </div>
        </article>

        <!-- add-new card (only on the last page so it isn't repeated across pages) -->
        <button v-if="page >= totalPages" class="card add" @click="createAgent">
          <span class="plus"><Icon icon="lucide:plus" /></span>
          <b>Create a new agent</b>
          <span class="add-sub">Start from scratch or a template</span>
        </button>
      </div>

      <!-- Pagination (10 per page) -->
      <nav v-if="totalPages > 1" class="pager">
        <button class="pg" :disabled="page <= 1" @click="page--"><Icon icon="lucide:chevron-left" /> Prev</button>
        <button v-for="p in totalPages" :key="p" class="pg num" :class="{ on: p === page }" @click="page = p">{{ p }}</button>
        <button class="pg" :disabled="page >= totalPages" @click="page++">Next <Icon icon="lucide:chevron-right" /></button>
      </nav>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, h } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import api from '../services/api';
import OwnerFilter from '../components/common/OwnerFilter.vue';
import { notify } from '@/composables/useNotify';
import { confirm } from '@/composables/useConfirm';
import { useCountUp } from '@/composables/useCountUp';

const router = useRouter();
const loading = ref(true);
const agents = ref([]);
const ownerFilter = ref('');
const searchQuery = ref('');
const sortBy = ref('recent');        // 'recent' | 'name'
const statusFilter = ref('all');     // 'all' | 'live' | 'idle'
const openMenuId = ref(null);
const barsReady = ref(false);

const filteredAgents = computed(() => {
    let list = agents.value.slice();
    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(a =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.description || '').toLowerCase().includes(q) ||
            (a.default_model_name || '').toLowerCase().includes(q)
        );
    }
    if (statusFilter.value === 'live') list = list.filter(a => a.signal_enabled);
    else if (statusFilter.value === 'idle') list = list.filter(a => !a.signal_enabled);

    if (sortBy.value === 'name') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
        list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    }
    return list;
});

// Client-side pagination (backend returns all agents in one response).
const PER_PAGE = 8;
const page = ref(1);
const totalPages = computed(() => Math.max(1, Math.ceil(filteredAgents.value.length / PER_PAGE)));
const pagedAgents = computed(() => filteredAgents.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE));
// Reset to page 1 whenever the filtered set changes (search / filter / sort), and clamp if the
// current page falls out of range (e.g. after a delete).
watch(() => filteredAgents.value.length, () => { if (page.value > totalPages.value) page.value = totalPages.value; });
watch([searchQuery, statusFilter, sortBy, ownerFilter], () => { page.value = 1; });

// Paused agents + bulk resume.
const pausedAgents = computed(() => agents.value.filter(a => a.is_paused));
const resuming = ref(false);
async function resumeAll() {
    if (resuming.value || !pausedAgents.value.length) return;
    resuming.value = true;
    const ids = pausedAgents.value.map(a => a.id);
    const results = await Promise.allSettled(ids.map(id => api.unpauseAgent(id)));
    let ok = 0;
    results.forEach((r, i) => { if (r.status === 'fulfilled') { ok++; const a = agents.value.find(x => x.id === ids[i]); if (a) a.is_paused = false; } });
    notify.success(`Resumed ${ok} agent${ok === 1 ? '' : 's'}`);
    resuming.value = false;
}

/* ---- Stats (animated count-ups over real data) ---- */
const totalCount = computed(() => agents.value.length);
const liveCount = computed(() => agents.value.filter(a => a.signal_enabled).length);
const idleCount = computed(() => agents.value.filter(a => !a.signal_enabled).length);
const toolsCount = computed(() => agents.value.reduce((s, a) => s + ((a.tools && a.tools.length) || 0), 0));
const { display: totalDisplay } = useCountUp(totalCount);
const { display: liveDisplay } = useCountUp(liveCount);
const { display: toolsDisplay } = useCountUp(toolsCount);
const { display: idleDisplay } = useCountUp(idleCount);

/* ---- Card visuals ---- */
const THEMES = ['v', 'p', 't'];
const themeOf = (i) => THEMES[i % THEMES.length];
const iconOf = (agent) => {
    const n = (agent.name || '').toLowerCase();
    if (n.includes('aws') || n.includes('cloud') || n.includes('devops')) return 'lucide:cloud';
    if (n.includes('deploy') || n.includes('release') || n.includes('ship')) return 'lucide:rocket';
    if (n.includes('data') || n.includes('analy') || n.includes('report')) return 'lucide:bar-chart-3';
    if (n.includes('code') || n.includes('review') || n.includes('dev')) return 'lucide:code';
    if (n.includes('support') || n.includes('assist') || n.includes('help')) return 'lucide:life-buoy';
    if (n.includes('bot') || n.includes('chat')) return 'lucide:bot';
    if (n.includes('research') || n.includes('search')) return 'lucide:telescope';
    return 'lucide:sparkles';
};
// Cosmetic "coverage" derived from real tool count (8–100%).
const capability = (agent) => Math.max(8, Math.min(100, ((agent.tools && agent.tools.length) || 0) * 10));

/* ---- 3D tilt (respects reduced motion) ---- */
const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const tilt = (e) => {
    if (reduced) return;
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = `translateY(-6px) rotateX(${-y * 6}deg) rotateY(${x * 8}deg)`;
};
const untilt = (e) => { e.currentTarget.style.transform = ''; };

const clearFilters = () => { searchQuery.value = ''; statusFilter.value = 'all'; };

const fetchAgents = async () => {
    try {
        loading.value = true;
        const params = {};
        if (ownerFilter.value) params.owner = ownerFilter.value;
        const response = await api.get('/agents/', { params });
        agents.value = response.data.results || response.data;
    } catch (e) {
        console.error("Failed to fetch agents", e);
    } finally {
        loading.value = false;
        barsReady.value = false;
        requestAnimationFrame(() => requestAnimationFrame(() => { barsReady.value = true; }));
    }
};

const createAgent = () => {
    router.push('/dashboard/agents/new'); // Opens Playground in 'new' mode (inside dashboard shell)
};

const editAgent = (id) => {
    router.push(`/dashboard/agents/${id}/editor`); // Opens the new single-canvas builder (inside dashboard shell)
};

const openChat = (agent) => {
    // Land directly in the chat composer for THIS agent — pre-selected via ?agent=<id> so the user can
    // start chatting immediately, with no agent-picker step.
    router.push({ path: '/dashboard/chat/new', query: { agent: agent.id } });
};

const openMonitor = (agent) => {
    openMenuId.value = null;
    router.push(`/dashboard/agents/${agent.id}/monitor`);
};

const openWorkspace = (agent) => {
    openMenuId.value = null;
    router.push(`/dashboard/agents/${agent.id}/workspace`);
};

const openIntegrationGuide = (agent) => {
    openMenuId.value = null;
    window.open(`/integration-guide/${agent.id}`, '_blank', 'noopener');
};

const duplicateAgent = async (agent) => {
    openMenuId.value = null;
    try {
        // Fetch the full agent, strip identity, post a copy
        const res = await api.get(`/agents/${agent.id}/`);
        const full = res.data || {};
        const copy = {
            name: `${full.name || 'Agent'} (copy)`,
            description: full.description || '',
            system_prompt_template: full.system_prompt_template || '',
            prompt_mode: full.prompt_mode || 'append',
            default_model: full.default_model || null,
            temperature: full.temperature,
            max_history_messages: full.max_history_messages,
            knowledge_scope: full.knowledge_scope,
            code_mode_enabled: full.code_mode_enabled,
            code_mode_services: full.code_mode_services || [],
            builder_mode_enabled: full.builder_mode_enabled,
            agent_run_mode: full.agent_run_mode || 'manual',
            tool_ids: (full.tools || []).map(t => t.id),
        };
        const created = await api.post('/agents/', copy);
        await fetchAgents();
        if (created?.data?.id) router.push(`/dashboard/agents/${created.data.id}/editor`);
    } catch (e) {
        notify.error('Failed to duplicate agent: ' + (e.response?.data?.error || e.message));
    }
};

const toggleMenu = (id) => {
    openMenuId.value = openMenuId.value === id ? null : id;
};
const closeMenus = () => { openMenuId.value = null; };

const confirmDelete = async (agent) => {
    const confirmed = await confirm({
        title: `Delete "${agent.name}"?`,
        message: `⚠️ Delete "${agent.name}"?\n\n` +
        `This will permanently delete:\n` +
        `- The agent configuration\n` +
        `- All conversations (${agent.conversation_count || 'unknown'} total)\n` +
        `- All knowledge files\n` +
        `- All related data\n\n` +
        `This action cannot be undone.`,
        confirmText: 'Delete',
        danger: true
    });

    if (confirmed) {
        await deleteAgent(agent.id);
    }
};

const deleteAgent = async (agentId) => {
    try {
        await api.delete(`/agents/${agentId}/`);

        // Remove from local state
        agents.value = agents.value.filter(a => a.id !== agentId);

        // Show success message
        notify.success('✅ Agent deleted successfully');
    } catch (error) {
        console.error('Failed to delete agent:', error);
        notify.error(
            '❌ Failed to delete agent\n\n' +
            (error.response?.data?.error || error.message || 'Unknown error')
        );
    }
};

onMounted(() => {
    fetchAgents();
    document.addEventListener('click', closeMenus);
});
onBeforeUnmount(() => {
    document.removeEventListener('click', closeMenus);
});

/* ---- Inline illustrated empty-state art (no emoji) ---- */
const EmptyArt = (props) => h('div', { class: 'empty-art' }, [
    h('svg', { viewBox: '0 0 120 120', fill: 'none' }, [
        h('defs', [
            h('linearGradient', { id: 'ea', x1: '0', y1: '0', x2: '120', y2: '120', gradientUnits: 'userSpaceOnUse' }, [
                h('stop', { 'stop-color': '#2563EB' }), h('stop', { offset: '1', 'stop-color': '#1E40AF' }),
            ]),
        ]),
        h('rect', { x: '18', y: '24', width: '84', height: '72', rx: '16', fill: 'url(#ea)', opacity: '0.12' }),
        h('rect', { x: '30', y: '38', width: '60', height: '10', rx: '5', fill: 'url(#ea)', opacity: '0.5' }),
        h('rect', { x: '30', y: '56', width: '44', height: '8', rx: '4', fill: 'url(#ea)', opacity: '0.3' }),
        h('rect', { x: '30', y: '72', width: '52', height: '8', rx: '4', fill: 'url(#ea)', opacity: '0.3' }),
        props.search
            ? h('g', [h('circle', { cx: '86', cy: '84', r: '16', stroke: 'url(#ea)', 'stroke-width': '5' }), h('path', { d: 'M98 96l10 10', stroke: 'url(#ea)', 'stroke-width': '5', 'stroke-linecap': 'round' })])
            : h('path', { d: 'M60 14l4 8 8 4-8 4-4 8-4-8-8-4 8-4z', fill: 'url(#ea)' }),
    ]),
]);
EmptyArt.props = ['search'];
</script>

<style scoped>
.lib { height: 100%; overflow-y: auto; font-family: var(--vm-font-sans); color: var(--vm-ink); }
.lib-wrap { max-width: 1180px; margin: 0 auto; padding: 22px 34px 56px; }
.tabs-top { display: flex; justify-content: center; margin-bottom: 22px; }

/* hero */
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.eyebrow { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--vm-violet-d); background: var(--vm-violet-soft); padding: 5px 11px; border-radius: 999px; margin-bottom: 12px; }
.eyebrow .pip { width: 6px; height: 6px; border-radius: 50%; background: var(--vm-violet); box-shadow: 0 0 0 4px rgba(124, 58, 237, .18); animation: vmEbPip 1.8s ease-in-out infinite; }
@keyframes vmEbPip { 50% { box-shadow: 0 0 0 7px rgba(124, 58, 237, 0); } }
.title { font-family: var(--vm-font-display); font-size: 40px; font-weight: 700; line-height: 1.02; letter-spacing: -.025em; }
.sub { color: var(--vm-ink-soft); font-size: 15px; margin-top: 8px; max-width: 48ch; }

.cta { border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 9px; padding: 12px 20px; border-radius: var(--vm-r); background: var(--vm-g-brand); color: #fff; font-family: var(--vm-font-sans); font-size: 14px; font-weight: 700; box-shadow: var(--vm-glow-v); transition: transform .2s var(--vm-ease); }
.cta:hover { transform: translateY(-2px) scale(1.02); }
.cta:active { transform: scale(.97); }
.cta .i { width: 17px; height: 17px; }

.ghost-btn { border: 1.5px solid var(--vm-line-2); background: transparent; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: var(--vm-r); color: var(--vm-ink-soft); font-weight: 700; font-size: 13px; transition: .2s var(--vm-ease); }
.ghost-btn:hover { border-color: var(--vm-violet); color: var(--vm-violet-d); background: var(--vm-violet-soft); }
.ghost-btn .i { width: 15px; height: 15px; }

/* stats */
.stats { display: flex; gap: 12px; flex-wrap: wrap; margin: 22px 0 26px; }
.stat { flex: 1; min-width: 140px; position: relative; overflow: hidden; padding: 15px 17px; border-radius: var(--vm-r); border: 1px solid var(--vm-line); background: var(--vm-glass-strong); backdrop-filter: blur(12px); transition: transform .3s var(--vm-ease), box-shadow .3s; }
.stat:hover { transform: translateY(-3px); box-shadow: var(--vm-shadow-m); }
.stat .badge-ic { position: absolute; right: 13px; top: 13px; width: 18px; height: 18px; opacity: .45; }
.stat .k { font-family: var(--vm-font-display); font-size: 28px; font-weight: 800; line-height: 1; }
.stat .l { font-size: 12px; color: var(--vm-ink-faint); font-weight: 600; margin-top: 6px; }
.stat::after { content: ""; position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; }
.stat.s1 .k { color: var(--vm-violet-d); } .stat.s1::after { background: var(--vm-g-brand); } .stat.s1 .badge-ic { color: var(--vm-violet); }
.stat.s2 .k { color: var(--vm-pink); } .stat.s2::after { background: var(--vm-g-warm); } .stat.s2 .badge-ic { color: var(--vm-pink); }
.stat.s3 .k { color: var(--vm-teal); } .stat.s3::after { background: var(--vm-g-teal); } .stat.s3 .badge-ic { color: var(--vm-teal); }
.stat.s4 .k { color: var(--vm-amber); } .stat.s4::after { background: linear-gradient(120deg, #F59E0B, #84CC16); } .stat.s4 .badge-ic { color: var(--vm-amber); }

/* toolbar */
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 24px; }
.search { position: relative; flex: 1; min-width: 220px; max-width: 420px; }
.search .i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 17px; height: 17px; color: var(--vm-ink-faint); }
.search input { width: 100%; padding: 12px 14px 12px 40px; border-radius: var(--vm-r); border: 1.5px solid var(--vm-line); background: var(--vm-glass-strong); font: 500 14px var(--vm-font-sans); color: var(--vm-ink); transition: .25s var(--vm-ease2); }
.search input::placeholder { color: var(--vm-ink-faint); }
.search input:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(14, 165, 233, .16); background: #fff; }
.seg { display: flex; background: var(--vm-glass-strong); border: 1px solid var(--vm-line); border-radius: var(--vm-r); padding: 3px; gap: 2px; }
.seg button { border: none; background: transparent; font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); padding: 8px 14px; border-radius: 11px; cursor: pointer; transition: .2s; }
.seg button.on { background: #fff; color: var(--vm-violet-d); box-shadow: var(--vm-shadow-s); }
.select-wrap { position: relative; display: flex; align-items: center; }
.select-wrap .i { position: absolute; left: 12px; width: 15px; height: 15px; color: var(--vm-ink-faint); pointer-events: none; }
.select-wrap select { appearance: none; padding: 11px 14px 11px 34px; border-radius: var(--vm-r); border: 1px solid var(--vm-line); background: var(--vm-glass-strong); font: 600 13px var(--vm-font-sans); color: var(--vm-ink-soft); cursor: pointer; }
.select-wrap select:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(14, 165, 233, .16); }

/* grid */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; perspective: 1200px; }

/* card */
.card { position: relative; overflow: hidden; text-align: left; padding: 22px; border-radius: var(--vm-r-l); border: 1px solid var(--vm-line); background: var(--vm-glass-strong); backdrop-filter: blur(10px); box-shadow: var(--vm-shadow-m); cursor: pointer; transform-style: preserve-3d; transition: transform .35s var(--vm-ease), box-shadow .35s var(--vm-ease), border-color .3s; opacity: 0; animation: vmCardIn .6s var(--vm-ease2) forwards; }
.card:hover { box-shadow: var(--vm-shadow-l); border-color: transparent; }
.card .accent { position: absolute; left: 0; top: 0; right: 0; height: 4px; }
.card.v .accent { background: var(--vm-g-brand); } .card.p .accent { background: var(--vm-g-warm); } .card.t .accent { background: var(--vm-g-teal); }
.card .halo { position: absolute; width: 170px; height: 170px; border-radius: 50%; filter: blur(46px); opacity: 0; top: -44px; right: -34px; transition: opacity .4s; pointer-events: none; }
.card:hover .halo { opacity: .45; }
.card.v .halo { background: #C7B6FF; } .card.p .halo { background: #FFB6D9; } .card.t .halo { background: #B6F0E6; }

.card-top { display: flex; align-items: flex-start; justify-content: space-between; }
.tile { width: 54px; height: 54px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: var(--vm-shadow-m); transition: transform .4s var(--vm-ease); animation: vmFloat 5s ease-in-out infinite; }
.card:hover .tile { transform: scale(1.08) rotate(-4deg); }
.tile :deep(svg) { width: 26px; height: 26px; }
.tile.v { background: var(--vm-g-brand); } .tile.p { background: var(--vm-g-warm); } .tile.t { background: var(--vm-g-teal); }

.badge { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; padding: 5px 11px; border-radius: 999px; }
.badge.live { background: rgba(16, 185, 129, .12); color: #059669; }
.badge.paused { background: rgba(217, 119, 6, .13); color: #b45309; }
.badge.paused svg { width: 13px; height: 13px; }
.paused-banner { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 11px 15px; border: 1px solid #fde68a; border-radius: 12px; background: #fffbeb; color: #92400e; font-size: 13px; }
.paused-banner > svg { width: 18px; height: 18px; flex-shrink: 0; }
.resume-all { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; border: 0; border-radius: 9px; background: #b45309; color: #fff; padding: 7px 13px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.resume-all:disabled { opacity: .6; } .resume-all svg { width: 14px; height: 14px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.pager { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 26px; flex-wrap: wrap; }
.pg { display: inline-flex; align-items: center; gap: 4px; height: 34px; min-width: 34px; padding: 0 11px; border: 1px solid #e5ebf3; border-radius: 9px; background: #fff; color: #475569; font-size: 13px; font-weight: 700; cursor: pointer; }
.pg:hover:not(:disabled) { border-color: #c7d2fe; color: #4f46e5; }
.pg:disabled { opacity: .45; cursor: not-allowed; }
.pg.num { justify-content: center; padding: 0; }
.pg.on { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.pg svg { width: 15px; height: 15px; }
.badge.idle { background: rgba(154, 147, 174, .14); color: var(--vm-ink-faint); }

.name { font-family: var(--vm-font-display); font-size: 19px; font-weight: 700; margin-top: 18px; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color .2s; }
.card:hover .name { color: var(--vm-violet-d); }

.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--vm-ink-soft); background: var(--vm-bg); border: 1px solid var(--vm-line); padding: 4px 10px; border-radius: 9px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; }
.chip.v { color: var(--vm-violet-d); background: var(--vm-violet-soft); border-color: transparent; }
.chip.t { color: #0D9488; background: #E6FBF6; border-color: transparent; }

.desc { color: var(--vm-ink-soft); font-size: 13.5px; line-height: 1.55; margin-top: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.9em; }

.meter { margin-top: 16px; }
.meter-lbl { display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; color: var(--vm-ink-faint); margin-bottom: 5px; }
.bar { height: 6px; border-radius: 999px; background: var(--vm-bg); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: 999px; background: var(--vm-g-cool); transition: width 1.1s var(--vm-ease2) .25s; }

.card-foot { display: flex; gap: 9px; margin-top: 18px; }
.b-chat, .b-cfg { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: none; cursor: pointer; padding: 11px; border-radius: 13px; font: 700 13px var(--vm-font-sans); transition: .2s var(--vm-ease); }
.b-chat { background: var(--vm-violet); color: #fff; }
.b-chat:hover { background: var(--vm-violet-d); box-shadow: var(--vm-glow-v); }
.b-cfg { background: transparent; border: 1.5px solid var(--vm-line-2); color: var(--vm-ink-soft); }
.b-cfg:hover { border-color: var(--vm-violet); color: var(--vm-violet-d); background: var(--vm-violet-soft); }
.b-chat :deep(svg), .b-cfg :deep(svg) { width: 15px; height: 15px; }

.more { position: relative; }
.b-more { width: 42px; height: 100%; min-height: 42px; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--vm-line-2); background: transparent; border-radius: 13px; color: var(--vm-ink-soft); cursor: pointer; transition: .2s; }
.b-more:hover { border-color: var(--vm-violet); color: var(--vm-violet-d); background: var(--vm-violet-soft); }
.b-more :deep(svg) { width: 17px; height: 17px; }
.menu { position: absolute; right: 0; bottom: calc(100% + 8px); width: 200px; background: var(--vm-glass-strong); backdrop-filter: blur(18px); border: 1px solid var(--vm-line); border-radius: 14px; box-shadow: var(--vm-shadow-l); padding: 6px; z-index: 30; }
.menu button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 11px; border: none; background: transparent; border-radius: 10px; font: 600 13px var(--vm-font-sans); color: var(--vm-ink-soft); cursor: pointer; transition: background .15s; }
.menu button:hover { background: var(--vm-surface); color: var(--vm-ink); }
.menu button.danger { color: var(--vm-danger); }
.menu button.danger:hover { background: rgba(239, 68, 68, .1); }
.menu button :deep(svg) { width: 15px; height: 15px; }
.menu .ext { width: 12px; height: 12px; margin-left: auto; }

/* add-new card */
.card.add { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; min-height: 320px; border: 2px dashed var(--vm-line-2); background: transparent; backdrop-filter: none; box-shadow: none; color: var(--vm-ink-faint); }
.card.add:hover { border-color: var(--vm-violet); background: rgba(124, 58, 237, .04); transform: translateY(-4px); box-shadow: none; }
.card.add .plus { width: 56px; height: 56px; border-radius: 50%; background: var(--vm-g-brand); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: var(--vm-glow-v); }
.card.add .plus :deep(svg) { width: 26px; height: 26px; }
.card.add b { font-family: var(--vm-font-display); font-size: 16px; color: var(--vm-ink); }
.card.add .add-sub { font-size: 12.5px; }

/* skeletons */
.skel-card { padding: 22px; border-radius: var(--vm-r-l); border: 1px solid var(--vm-line); background: var(--vm-glass-strong); box-shadow: var(--vm-shadow-s); }
.skel-top { display: flex; justify-content: space-between; }
.skel-foot { display: flex; gap: 9px; margin-top: 20px; }

/* empty states */
.empty { text-align: center; padding: 70px 20px; }
.empty-art { display: flex; justify-content: center; margin-bottom: 18px; }
.empty-art :deep(svg) { width: 132px; height: 132px; }
.empty h3 { font-family: var(--vm-font-display); font-size: 20px; font-weight: 700; }
.empty p { color: var(--vm-ink-soft); font-size: 14px; margin: 6px 0 18px; }

/* Theme audit: align this older library page with the Getting Started / Docs / Tutorials system. */
.lib {
  background: #f8fbff;
  color: #0f172a;
}
.lib-wrap {
  max-width: 1360px;
  padding: 28px 32px 64px;
}
.hero {
  align-items: center;
  margin-bottom: 22px;
}
.eyebrow {
  margin-bottom: 9px;
  padding: 4px 9px;
  border-radius: 999px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: .04em;
}
.eyebrow .pip {
  background: #2563eb;
  box-shadow: none;
  animation: none;
}
.title {
  color: #0f172a;
  font-size: 25px;
  font-weight: 850;
  line-height: 1.12;
  letter-spacing: 0;
}
.vm-grad-text {
  background: none;
  color: inherit;
  animation: none;
}
.sub {
  margin-top: 8px;
  color: #64748b;
  font-size: 13.5px;
  line-height: 1.45;
}
.cta,
.ghost-btn,
.b-chat,
.b-cfg,
.b-more {
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 850;
  box-shadow: none;
  transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
}
.cta {
  min-height: 38px;
  padding: 0 15px;
  background: #2563eb;
  box-shadow: 0 8px 18px rgba(37, 99, 235, .18);
}
.cta:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}
.ghost-btn,
.b-cfg,
.b-more {
  border: 1px solid #d8e2f0;
  background: #fff;
  color: #334155;
}
.ghost-btn:hover,
.b-cfg:hover,
.b-more:hover {
  border-color: #c8d6ea;
  background: #f8fbff;
  color: #2563eb;
}
.stats {
  gap: 14px;
  margin: 0 0 18px;
}
.stat {
  min-height: 104px;
  padding: 18px 20px;
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .035);
  backdrop-filter: none;
}
.stat:hover {
  transform: none;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .035);
}
.stat::after {
  display: none;
}
.stat .badge-ic {
  top: 16px;
  right: 16px;
  width: 18px;
  height: 18px;
  opacity: 1;
  color: #2563eb;
}
.stat .k {
  font-size: 28px;
  font-weight: 850;
  color: #0f172a !important;
}
.stat .l {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 750;
}
.toolbar {
  margin-bottom: 18px;
  gap: 10px;
}
.search input,
.select-wrap select,
.seg {
  border: 1px solid #d8e2f0;
  border-radius: 9px;
  background: #fff;
  box-shadow: none;
}
.search input {
  height: 40px;
  padding-top: 0;
  padding-bottom: 0;
  font-size: 12.5px;
  font-weight: 650;
}
.select-wrap select {
  height: 40px;
  padding-top: 0;
  padding-bottom: 0;
  font-size: 12.5px;
  font-weight: 750;
}
.seg {
  height: 40px;
  padding: 3px;
}
.seg button {
  border-radius: 7px;
  font-size: 12px;
  font-weight: 800;
}
.seg button.on {
  background: #eef4ff;
  color: #2563eb;
  box-shadow: none;
}
.grid {
  gap: 16px;
}
.card,
.skel-card {
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .035);
  backdrop-filter: none;
}
.card {
  padding: 18px;
  transform-style: flat;
}
.card:hover {
  transform: translateY(-1px);
  border-color: #cfdbea;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .05);
}
.card .accent,
.card .halo {
  display: none;
}
.tile {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #eef4ff !important;
  color: #2563eb;
  box-shadow: none;
  animation: none;
}
.tile.p {
  background: #f0e9ff !important;
  color: #7c3aed;
}
.tile.t {
  background: #e3f8f4 !important;
  color: #0f9f8a;
}
.tile :deep(svg) {
  width: 21px;
  height: 21px;
}
.card:hover .tile {
  transform: none;
}
.badge {
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 800;
}
.name {
  margin-top: 15px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 850;
  letter-spacing: 0;
}
.chips {
  gap: 6px;
  margin-top: 9px;
}
.chip {
  border: 1px solid #dfe7f2;
  border-radius: 7px;
  background: #f8fbff;
  color: #53657d;
  font-size: 11px;
  font-weight: 750;
}
.chip.v,
.chip.t {
  border-color: transparent;
}
.desc {
  color: #64748b;
  font-size: 12.5px;
  line-height: 1.5;
}
.meter-lbl {
  font-size: 10.5px;
  color: #64748b;
}
.bar {
  background: #edf2f7;
}
.bar i {
  background: #2563eb;
}
.card-foot {
  margin-top: 16px;
}
.b-chat {
  border: 1px solid #2563eb;
  background: #2563eb;
}
.b-chat:hover {
  background: #1d4ed8;
  box-shadow: none;
}
.menu {
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 18px 45px rgba(15, 23, 42, .14);
  backdrop-filter: none;
}
.menu button {
  border-radius: 7px;
  font-size: 12.5px;
  font-weight: 750;
}
.card.add {
  border: 1px dashed #cfdbea;
  border-radius: 10px;
  background: #fff;
  min-height: 300px;
}
.card.add:hover {
  border-color: #2563eb;
  background: #f8fbff;
  transform: translateY(-1px);
}
.card.add .plus {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  background: #eef4ff;
  color: #2563eb;
  box-shadow: none;
}
.empty h3 {
  font-size: 17px;
  font-weight: 850;
}
.empty p {
  color: #64748b;
  font-size: 13px;
}
@media (max-width: 640px) {
  .lib-wrap { padding: 22px 16px 40px; }
  .title { font-size: 25px; }
}
</style>
