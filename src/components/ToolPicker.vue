<template>
  <div>
    <!-- Selected tools as cards -->
    <div class="flex flex-wrap gap-2">
      <div v-for="t in selectedTools" :key="t.id"
        class="group flex items-center gap-2 bg-white border border-slate-200 rounded-xl pl-2 pr-1 py-1.5 shadow-sm">
        <ToolIcon :name="t.name" :group="groupKey(t)" :size="28" :inner="16" />
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-800 truncate max-w-[170px]">{{ toolLabel(t) }}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[170px]">{{ catLabel(groupKey(t)) }}</div>
        </div>
        <button @click="toggle(t.id)" class="text-slate-300 hover:text-red-500 text-lg leading-none px-1.5" title="Remove">×</button>
      </div>

      <button @click="openModal" type="button"
        class="flex items-center gap-1.5 border border-dashed border-slate-300 rounded-xl px-4 py-2 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition text-sm font-medium">
        <Plus class="w-4 h-4" /> Add tool
      </button>
    </div>
    <p v-if="selectedTools.length === 0" class="text-xs text-slate-400 mt-2">
      No tools yet — click “Add tool” to give your agent capabilities.
    </p>

    <!-- Picker modal -->
    <teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" @click.self="closeModal">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[560px] flex flex-col overflow-hidden">
          <!-- search header -->
          <div class="p-4 border-b border-slate-100 flex items-center gap-2">
            <Search class="w-4 h-4 text-slate-400" />
            <input ref="searchInput" v-model="search" placeholder="Search for tools…"
              class="flex-1 px-2 py-2 text-sm focus:outline-none" />
            <button @click="closeModal" class="px-2 text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
          </div>

          <div class="flex-1 flex min-h-0">
            <!-- categories -->
            <div class="w-56 border-r border-slate-100 overflow-y-auto py-2 bg-slate-50/60 shrink-0">
              <div class="px-4 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Categories</div>
              <button v-for="c in categories" :key="c.key" type="button"
                @click="search=''; activeCategory=c.key"
                :class="['w-full text-left px-4 py-2 text-sm flex items-center justify-between gap-2',
                  (!search && activeCategory===c.key) ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-100']">
                <span class="truncate flex items-center gap-2">
                  <ToolIcon :name="c.key" :group="c.key" :size="24" :inner="15" />
                  {{ c.label }}
                </span>
                <span class="text-[10px] text-slate-400">{{ c.count }}</span>
              </button>
            </div>

            <!-- tools list -->
            <div class="flex-1 overflow-y-auto">
              <div v-if="search" class="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-50/60 sticky top-0">
                Search results ({{ rightTools.length }})
              </div>
              <div v-if="rightTools.length === 0" class="p-10 text-center text-sm text-slate-400">No tools found.</div>
              <button v-for="t in rightTools" :key="t.id" type="button" @click="toggle(t.id)"
                class="w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 flex items-start gap-3">
                <ToolIcon :name="t.name" :group="groupKey(t)" :size="34" :inner="18" />
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-slate-800 flex items-center gap-2">
                    {{ toolLabel(t) }}
                    <span v-if="t.category" class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{{ t.category_label || prettyCat(t.category) }}</span>
                  </div>
                  <div class="text-xs text-slate-500 line-clamp-2 mt-0.5">{{ t.description }}</div>
                </div>
                <span v-if="ids.has(t.id)" class="text-xs font-semibold text-indigo-600 shrink-0 mt-1.5">✓ Added</span>
                <Plus v-else class="w-5 h-5 text-slate-300 shrink-0 mt-1" />
              </button>
            </div>
          </div>

          <div class="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <span class="text-xs text-slate-500">{{ (modelValue || []).length }} selected</span>
            <button @click="closeModal" type="button"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Done</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, h } from 'vue'
import { Icon } from '@iconify/vue'
import {
  Wrench, Globe, Webhook, MessageCircle, RadioTower, Brain, Lightbulb, Bot, Database, Table2,
  Terminal, Bell, Clock, FileCode, FileText, Search, Send, Camera, Network, Braces, Settings,
  BookOpen, CreditCard, Rocket, GitBranch, Smartphone, Video, Volume2, Languages, MapPin,
  ShoppingCart, Users, Calendar, Mail, Image, Phone, Plus,
} from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  tools: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

const showModal = ref(false)
const search = ref('')
const activeCategory = ref(null)
const searchInput = ref(null)

const ids = computed(() => new Set(props.modelValue || []))
const selectedTools = computed(() => props.tools.filter(t => ids.value.has(t.id)))

function groupKey(t) {
  // Primary taxonomy is the tool's real `category` (infrastructure, network,
  // orchestration, mcp, llm, …) so every category shows up. Fall back to
  // service / MCP only when a tool has no category.
  if (t.category) return t.category
  if (t.name && t.name.startsWith('MCP_')) return 'mcp'
  if (t.service) return typeof t.service === 'string' ? t.service : 'services'
  return 'general'
}

const categories = computed(() => {
  const map = new Map()
  for (const t of props.tools) {
    const k = groupKey(t)
    map.set(k, (map.get(k) || 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: catLabel(key), count }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const rightTools = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (q) {
    return props.tools.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.display_name || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    )
  }
  if (!activeCategory.value) return []
  return props.tools.filter(t => groupKey(t) === activeCategory.value)
})

function toggle(id) {
  const set = new Set(props.modelValue || [])
  if (set.has(id)) set.delete(id)
  else set.add(id)
  emit('update:modelValue', [...set])
}

function pretty(name) {
  if (!name) return ''
  const n = name.startsWith('MCP_') ? name.slice(4) : name
  return n.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Prefer backend-provided friendly labels (display_name / category_label),
// fall back to local prettify when absent.
function toolLabel(t) {
  return (t && t.display_name) ? t.display_name : pretty(t && t.name)
}
const categoryLabels = computed(() => {
  const m = {}
  for (const t of props.tools) {
    const k = groupKey(t)
    if (!m[k] && t && t.category_label) m[k] = t.category_label
  }
  return m
})
function catLabel(key) {
  return categoryLabels.value[key] || prettyCat(key)
}
// Real icons (lucide) resolved from a tool/category name by keyword.
const ICON_RULES = [
  [/webhook/, Webhook], [/schedul|cron/, Clock], [/script|execute|python/, FileCode],
  [/notif|alert/, Bell], [/android|phone|mobile|device/, Smartphone],
  [/signal|redis|stream|bridge|\brss\b|event/, RadioTower], [/search|find|discover/, Search],
  [/browser|web|url|website|logo|\bpage\b/, Globe], [/screenshot|capture|image|media|photo|picture/, Image],
  [/email|mail|gmail|inbox/, Mail], [/slack|messenger|\bchat\b|message/, MessageCircle],
  [/whatsapp/, Phone], [/telegram|\bsend\b/, Send], [/instagram/, Camera], [/social/, Users],
  [/llm|model|gpt|claude|anthropic|openai|groq|llama|cerebras|fireworks|generate content|\bask\b|completion/, Brain],
  [/video/, Video], [/audio|speech|voice|transcribe|sound/, Volume2],
  [/storage|file|upload|save|s3|bucket|drive/, Database],
  [/database|\bsql\b|query|\btable\b|record|spreadsheet|sheet/, Table2],
  [/shell|terminal|ssh|command|bash|\bexec\b/, Terminal], [/network|http|request|fetch|\bapi\b/, Network],
  [/\bcode\b|braces|json/, Braces],
  [/text|write|content|document|\bnote\b|\bdoc\b/, FileText], [/system|config|setting|manage|admin/, Settings],
  [/knowledge|memory|embed|vector|\brag\b/, BookOpen], [/calendar|date|\btime\b|meeting/, Calendar],
  [/payment|stripe|invoice|billing|charge/, CreditCard], [/improve|feedback|iteration|optimi/, Lightbulb],
  [/deploy|docker|container|build|release/, Rocket], [/\bgit\b|repo|github|commit/, GitBranch],
  [/workflow|automat|task|action|\bbot\b/, Bot],
  [/translate|language|locale/, Languages], [/\bmap\b|location|\bgeo\b|place/, MapPin],
  [/shop|store|product|order|cart|commerce/, ShoppingCart],
]
function matchIcon(name) {
  const s = (name || '').toLowerCase()
  for (const [re, comp] of ICON_RULES) if (re.test(s)) return comp
  return null
}

// Brand / provider / service logos via Iconify (full-color, bundled 'logos' set).
const BRAND = [
  ['openai', 'logos:openai-icon'], ['gpt', 'logos:openai-icon'],
  ['anthropic', 'logos:anthropic-icon'], ['claude', 'logos:anthropic-icon'],
  ['gemini', 'logos:google-gemini'], ['google', 'logos:google-icon'],
  ['mistral', 'logos:mistral-ai-icon'], ['huggingface', 'logos:hugging-face-icon'],
  ['shopify', 'logos:shopify'], ['stripe', 'logos:stripe'], ['github', 'logos:github-icon'],
  ['gitlab', 'logos:gitlab'], ['slack', 'logos:slack-icon'], ['discord', 'logos:discord-icon'],
  ['notion', 'logos:notion-icon'], ['figma', 'logos:figma'], ['docker', 'logos:docker-icon'],
  ['telegram', 'logos:telegram'], ['whatsapp', 'logos:whatsapp-icon'], ['instagram', 'logos:instagram-icon'],
  ['messenger', 'logos:messenger'], ['gmail', 'logos:google-gmail'], ['redis', 'logos:redis'],
  ['jira', 'logos:jira'], ['trello', 'logos:trello'], ['hubspot', 'logos:hubspot'],
  ['salesforce', 'logos:salesforce'], ['twilio', 'logos:twilio-icon'], ['sendgrid', 'logos:sendgrid-icon'],
  ['airtable', 'logos:airtable'], ['supabase', 'logos:supabase-icon'], ['firebase', 'logos:firebase'],
  ['mongodb', 'logos:mongodb-icon'], ['postgres', 'logos:postgresql'], ['mysql', 'logos:mysql-icon'],
  ['apollo', 'logos:apollostack'], ['linkedin', 'logos:linkedin-icon'], ['youtube', 'logos:youtube-icon'],
  ['facebook', 'logos:facebook'], ['canva', 'logos:canva-icon'], ['zapier', 'logos:zapier-icon'],
  ['woocommerce', 'logos:woocommerce-icon'],
]
function brandIcon(name) {
  const s = (name || '').toLowerCase()
  for (const [kw, icon] of BRAND) if (s.includes(kw)) return icon
  return null
}

// Prettify a category key: service_management -> "Service Management", mcp -> "MCP".
const ACRONYMS = new Set(['mcp', 'api', 'llm', 'ai', 'sdk', 'url', 'http', 'https', 'db', 'sql',
  'crm', 'ui', 'id', 'ip', 'os', 'aws', 'gcp', 'cli', 'ssh', 'dns', 'ml', 'nlp', 'io'])
function prettyCat(key) {
  if (!key) return 'General'
  return String(key).split(/[_\s-]+/).filter(Boolean)
    .map(w => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : (w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

// Colorful icon tile: full-color brand logo, OR a Lucide icon tinted by category color.
const ToolIcon = (props) => {
  const size = Number(props.size) || 28
  const inner = Number(props.inner) || 16
  const tile = { width: size + 'px', height: size + 'px' }
  const brand = brandIcon(props.name) || brandIcon(props.group)
  if (brand) {
    return h('span', { class: 'rounded-lg flex items-center justify-center bg-slate-50 shrink-0', style: tile },
      [h(Icon, { icon: brand, style: { fontSize: inner + 'px' } })])
  }
  const comp = matchIcon(props.name) || matchIcon(props.group) || Wrench
  const color = colorForKey(props.group || props.name)
  return h('span', { class: 'rounded-lg flex items-center justify-center shrink-0', style: { ...tile, background: color + '22' } },
    [h(comp, { style: { width: inner + 'px', height: inner + 'px', color } })])
}
ToolIcon.props = ['name', 'group', 'size', 'inner']
const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
function colorForKey(key) {
  let h = 0
  for (let i = 0; i < (key || '').length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}
function colorFor(t) {
  return colorForKey(groupKey(t))
}

function openModal() {
  showModal.value = true
  if (!activeCategory.value && categories.value.length) activeCategory.value = categories.value[0].key
  nextTick(() => searchInput.value && searchInput.value.focus())
}
function closeModal() { showModal.value = false }

watch(() => props.tools, () => {
  if (!activeCategory.value && categories.value.length) activeCategory.value = categories.value[0].key
})
</script>
