// Colorful tool/category icon — full-color brand logo (Iconify 'logos' set) when the tool/category
// matches a known provider, else a keyword-matched Lucide icon tinted by a hashed category color.
// Ported verbatim from the legacy ToolPicker so the new agent-editor modal + cards share the exact
// same icon library the old "Add tools" modal used.
import { h } from 'vue'
import { Icon } from '@iconify/vue'
import {
  Wrench, Globe, Webhook, MessageCircle, RadioTower, Brain, Lightbulb, Bot, Database, Table2,
  Terminal, Bell, Clock, FileCode, FileText, Search, Send, Camera, Network, Braces, Settings,
  BookOpen, CreditCard, Rocket, GitBranch, Smartphone, Video, Volume2, Languages, MapPin,
  ShoppingCart, Users, Calendar, Mail, Image, Phone,
} from 'lucide-vue-next'

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
export function matchIcon(name) {
  const s = String(name == null ? '' : name).toLowerCase()
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
export function brandIcon(name) {
  const s = String(name == null ? '' : name).toLowerCase()
  for (const [kw, icon] of BRAND) if (s.includes(kw)) return icon
  return null
}

const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#2563EB', '#1E40AF', '#14b8a6']
export function colorForKey(key) {
  let h = 0
  for (let i = 0; i < (key || '').length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

// Functional component: <ToolIcon :name="tool.name" :group="tool.category" :size="52" :inner="26" />
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
export default ToolIcon
