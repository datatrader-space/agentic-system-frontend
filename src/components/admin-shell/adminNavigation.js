// One navigation inventory for the shell, search, breadcrumbs, and overview. Routes and access guards stay unchanged.
export const adminItems = [
  { to: '/admin-dashboard/overview', label: 'Overview', icon: ['M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z'] },
  { to: '/admin-dashboard/operations', label: 'Operations', icon: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
  { to: '/admin-dashboard/platform', label: 'Platform & Users', icon: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 7a4 4 0 1 0 0 .01', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'] },
  { to: '/admin-dashboard/guardrails', label: 'System Guardrails', icon: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'] },
  { to: '/admin-dashboard/sandbox-network', label: 'Sandbox Network', icon: ['M12 2a10 10 0 100 20 10 10 0 000-20z', 'M2 12h20', 'M12 2a15 15 0 010 20a15 15 0 010-20z'] },
  { to: '/admin-dashboard/knowledge', label: 'Knowledge & Crawl', icon: ['M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0', 'M2 12h20', 'M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20'] },
  { to: '/admin-dashboard/platform-apis', label: 'Platform APIs', icon: ['M12 2 2 7l10 5 10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'] },
  { to: '/admin-dashboard/model-defaults', label: 'Default Models', icon: ['M4 6h16', 'M4 12h16', 'M4 18h10', 'M18 16l2 2 3-3'] },
  { to: '/admin-dashboard/billing', label: 'Billing & Wallets', icon: ['M2 7h20v12H2z', 'M2 11h20', 'M6 15h4'] },
  { to: '/admin-dashboard/model-pricing', label: 'Model Pricing', icon: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'] },
  { to: '/admin-dashboard/llm-context', label: 'LLM Context', icon: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16', 'M4 12h16'] },
  { to: '/admin-dashboard/conversation-steps', label: 'Conversation Steps', icon: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'] },
  { to: '/admin-dashboard/training-data', label: 'Training Data', icon: ['M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3z', 'M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6', 'M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6'] },
  { to: '/admin-dashboard/crawler-export', label: 'Crawler Export API', icon: ['M21 2H3v16h5v4l4-4h5l4-4z', 'M8 9h8', 'M8 13h6'] },
  { to: '/admin-dashboard/partner-keys', label: 'Partner Agent API', icon: ['M15 7a2 2 0 0 1 2 2m4-2a6 6 0 0 1-7.7 5.7l-4 4a2 2 0 0 1-1.4.6H8v2H6v2H2v-4l6.3-6.3A6 6 0 1 1 21 7z'] },
  { to: '/admin-dashboard/help-center', match: '/admin-dashboard/help-center', label: 'Help Center', icon: ['M4 4h16v16H4z', 'M8 8h8', 'M8 12h8', 'M8 16h5'] },
  { to: '/admin-dashboard/help-analytics', label: 'Help Analytics', icon: ['M3 3v18h18', 'M7 16l4-4 3 3 5-6'] },
  { to: '/admin-dashboard/builtin-agents', label: 'Built-in Agents', icon: ['M12 8V4H8', 'M4 12a8 8 0 0 1 8-8', 'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2', 'M6 10h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z'] },
  { to: '/admin-dashboard/issues', label: 'Issues', icon: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'] },
  { to: '/admin-dashboard/builtin-skills', label: 'Built-in Skills', icon: ['M12 3 2 8l10 5 10-5z', 'M4 10v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6', 'M8 12v5', 'M16 12v5'] },
  { to: '/admin-dashboard/super-agent', label: 'Super Agent', icon: ['M12 2l2.4 5.4 5.6.6-4.2 3.9 1.2 5.6L12 14.9 7 17.5l1.2-5.6L4 8l5.6-.6L12 2z'] },
  { to: '/admin-dashboard/trace-waterfall', label: 'Trace Waterfall', icon: ['M3 3v18h18', 'M7 8h6', 'M7 12h10', 'M7 16h4'] },
  { to: '/admin-dashboard/eval-snapshot', label: 'Eval Snapshot', icon: ['M3 3v18h18', 'M7 16l4-4 3 3 5-6'] },
  { to: '/admin-dashboard/learning', label: 'Learning Monitor', icon: ['M12 3 2 8l10 5 10-5z', 'M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5', 'M22 8v6'] },
  { to: '/admin-dashboard/cost', label: 'Cost per Org', icon: ['M3 3v18h18', 'M7 16v-5', 'M12 16V8', 'M17 16v-3'] },
  { to: '/admin-dashboard/speed-cache', label: 'Speed & Cache', icon: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'] },
  { to: '/admin-dashboard/registry-governance', label: 'Registry Governance', icon: ['M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z', 'M9 12l2 2 4-4'] },
  { to: '/admin-dashboard/capability-graph', label: 'Capability Graph', icon: ['M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M8.59 13.51l6.83 3.98', 'M15.41 6.51l-6.82 3.98'] },
  { to: '/admin-dashboard/runtime-metrics', label: 'Runtime Metrics', icon: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
].map(item => ({ ...item, key: item.to.split('/').pop() }))
export const adminGroups = [
  {
    "key": "workspace",
    "label": "Workspace",
    "paths": [
      "overview",
      "platform",
      "issues"
    ]
  },
  {
    "key": "intelligence",
    "label": "AI & agents",
    "paths": [
      "platform-apis",
      "model-defaults",
      "builtin-agents",
      "builtin-skills",
      "super-agent",
      "guardrails",
      "sandbox-network",
      "capability-graph"
    ]
  },
  {
    "key": "data",
    "label": "Data & content",
    "paths": [
      "knowledge",
      "training-data",
      "crawler-export",
      "partner-keys",
      "help-center",
      "help-analytics"
    ]
  },
  {
    "key": "finance",
    "label": "Finance",
    "paths": [
      "billing",
      "model-pricing",
      "cost"
    ]
  },
  {
    "key": "operations",
    "label": "Operations",
    "paths": [
      "operations",
      "llm-context",
      "conversation-steps",
      "trace-waterfall",
      "eval-snapshot",
      "learning",
      "speed-cache",
      "registry-governance",
      "runtime-metrics"
    ]
  }
]
export const adminDescriptions = {
  "overview": "Platform summary and shortcuts",
  "platform": "Users, traffic, and security analytics",
  "issues": "Review reported issues and resolutions",
  "platform-apis": "AI providers, models, and web search",
  "model-defaults": "Choose platform model defaults",
  "builtin-agents": "Manage shared platform agents",
  "builtin-skills": "Author and review system skills",
  "super-agent": "Shared coordination and capabilities",
  "guardrails": "Platform safety and approval rules",
  "sandbox-network": "Outbound access policies for sandboxes",
  "capability-graph": "Canonical capabilities and lifecycle",
  "knowledge": "Retrieval quality, sources, and corrections",
  "training-data": "Capture consent and corpus exports",
  "crawler-export": "Crawler access keys and integration guide",
  "partner-keys": "Partner Agent API access and guidance",
  "help-center": "Content, tours, and API documentation",
  "help-analytics": "Search, feedback, and content gaps",
  "billing": "Usage, prepaid wallets, and revenue",
  "model-pricing": "Provider model prices and coverage",
  "cost": "Organization spend and attribution",
  "operations": "Platform health and subsystem status",
  "llm-context": "Context assembly, retention, and costs",
  "conversation-steps": "Inspect recorded conversation timelines",
  "trace-waterfall": "Captured execution spans and tool receipts",
  "eval-snapshot": "Evaluation results and quality signals",
  "learning": "Learning activity and sweep cadence",
  "speed-cache": "Latency, throughput, and cache performance",
  "registry-governance": "Review live registry configuration hygiene",
  "runtime-metrics": "Process-local pools and circuit breakers"
}
export function adminSection(path) {
 const item = adminItems.find(i => path === i.to || path.startsWith(i.to + '/'))
 if (item) return item
 if (path.includes('/agents/')) return adminItems.find(i => i.key === 'builtin-agents')
 if (/help-content|guided-tours|api-reference/.test(path)) return adminItems.find(i => i.key === 'help-center')
 return adminItems[0]
}
