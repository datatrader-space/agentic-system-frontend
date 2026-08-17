/**
 * Breadcrumb hierarchy map — the single source of truth for the site-wide,
 * *location-based* breadcrumb trail (Home > Category > Subcategory > Current).
 *
 * Keyed by Vue Router route name (see src/main.js). Each entry:
 *   { label, parent?, dynamic? }
 *     - label:   text shown for this crumb (fallback for dynamic pages).
 *     - parent:  route NAME of the logical parent. Roots omit it.
 *     - dynamic: true when the page overrides the trailing label at runtime
 *                (real entity name) via setBreadcrumbLabel()/setBreadcrumbTrail().
 *
 * Rules:
 *   - The router is flat under /dashboard, so `route.matched` can't express the
 *     logical hierarchy — this explicit parent chain does.
 *   - Every `parent` MUST point at a param-free (static) route so its link
 *     resolves from just `{ name }`. Deep param-nested pages parent to a root
 *     instead of to another dynamic route.
 *   - Routes NOT listed here (auth, landing, chat, editors, canvases, redirects)
 *     render no breadcrumb bar.
 */
export default {
  // ── Dashboard (root: Home) ────────────────────────────────────────────────
  'dashboard-home': { label: 'Home' },

  'dashboard-agents': { label: 'Agents', parent: 'dashboard-home' },
  'dashboard-agent-overview': { label: 'Agent', parent: 'dashboard-agents', dynamic: true },

  'dashboard-tools': { label: 'Tools', parent: 'dashboard-home' },
  'dashboard-connectors': { label: 'Connectors', parent: 'dashboard-home' },
  'dashboard-connections': { label: 'Connections', parent: 'dashboard-home' },
  'dashboard-connection-docs': { label: 'Connection docs', parent: 'dashboard-connections' },
  'dashboard-integration-guide': { label: 'Integration guide', parent: 'dashboard-home' },

  'dashboard-workflow-builder': { label: 'Workflows', parent: 'dashboard-home' },
  'dashboard-schedules': { label: 'Schedules', parent: 'dashboard-home' },
  'dashboard-budgets': { label: 'Budgets', parent: 'dashboard-home' },
  'dashboard-activity': { label: 'Activity', parent: 'dashboard-home' },
  'dashboard-billing': { label: 'Billing', parent: 'dashboard-home' },
  'dashboard-llm-settings': { label: 'LLM settings', parent: 'dashboard-home' },
  'dashboard-settings': { label: 'Settings', parent: 'dashboard-home' },

  'dashboard-organization': { label: 'Organization', parent: 'dashboard-home' },
  'dashboard-organization-module': { label: 'Module', parent: 'dashboard-organization', dynamic: true },
  'dashboard-org-settings': { label: 'Org settings', parent: 'dashboard-home', dynamic: true },
  'dashboard-org-settings-tab': { label: 'Org settings', parent: 'dashboard-home', dynamic: true },

  'dashboard-service-register': { label: 'Register service', parent: 'dashboard-home' },
  'dashboard-service-wizard': { label: 'Service wizard', parent: 'dashboard-home' },
  'dashboard-service-drafts': { label: 'Service drafts', parent: 'dashboard-home' },
  'dashboard-system-detail': { label: 'System', parent: 'dashboard-home', dynamic: true },
  'dashboard-workspace': { label: 'Workspace', parent: 'dashboard-home', dynamic: true },
  'dashboard-workspace-tab': { label: 'Workspace', parent: 'dashboard-home', dynamic: true },

  'dashboard-documentation': { label: 'Documentation', parent: 'dashboard-home' },

  // Help Center subtree
  'dashboard-help-center': { label: 'Help Center', parent: 'dashboard-home' },
  'dashboard-help-get-started': { label: 'Get started', parent: 'dashboard-help-center' },
  'dashboard-help-documentation': { label: 'Documentation', parent: 'dashboard-help-center' },
  'dashboard-help-topics': { label: 'Topics', parent: 'dashboard-help-center' },
  'dashboard-help-api-reference': { label: 'API reference', parent: 'dashboard-help-center' },
  'dashboard-help-tutorials': { label: 'Tutorials', parent: 'dashboard-help-center' },
  'dashboard-help-tutorial-detail': { label: 'Tutorial', parent: 'dashboard-help-tutorials', dynamic: true },
  'dashboard-help-article': { label: 'Article', parent: 'dashboard-help-center', dynamic: true },
  'dashboard-help-learning-paths': { label: 'Learning paths', parent: 'dashboard-help-center' },
  'dashboard-help-learning-path': { label: 'Path', parent: 'dashboard-help-learning-paths', dynamic: true },
  'dashboard-help-docs': { label: 'Docs', parent: 'dashboard-help-center' },
  'dashboard-help-docs-area': { label: 'Area', parent: 'dashboard-help-docs', dynamic: true },
  'dashboard-help-guided-tours': { label: 'Guided tours', parent: 'dashboard-help-center' },
  'dashboard-help-guided-tour': { label: 'Tour', parent: 'dashboard-help-guided-tours', dynamic: true },
  'dashboard-help-support': { label: 'Support', parent: 'dashboard-help-center' },

  // ── Admin (root: Admin) ───────────────────────────────────────────────────
  'admin-overview': { label: 'Admin' },
  'admin-platform': { label: 'Platform', parent: 'admin-overview' },
  'admin-knowledge': { label: 'Knowledge', parent: 'admin-overview' },
  'admin-model-pricing': { label: 'Model pricing', parent: 'admin-overview' },
  'admin-llm-context': { label: 'LLM context', parent: 'admin-overview' },
  'admin-crawler-export': { label: 'Crawler export', parent: 'admin-overview' },
  'admin-api-reference': { label: 'API reference', parent: 'admin-overview' },
  'admin-help-center': { label: 'Help Center', parent: 'admin-overview' },
  'admin-help-content': { label: 'Help content', parent: 'admin-overview' },
  'admin-guided-tours': { label: 'Guided tours', parent: 'admin-overview' },
  'admin-help-analytics': { label: 'Help analytics', parent: 'admin-overview' },
  'admin-builtin-agents': { label: 'Built-in agents', parent: 'admin-overview' },
  'admin-learning-monitor': { label: 'Learning monitor', parent: 'admin-overview' },

  // ── Public marketing (root: Home) ─────────────────────────────────────────
  'landing': { label: 'Home' },
  'features': { label: 'Features', parent: 'landing' },
  'how-it-works': { label: 'How it works', parent: 'landing' },
  'pricing': { label: 'Pricing', parent: 'landing' },
  'about': { label: 'About', parent: 'landing' },
  'contact': { label: 'Contact', parent: 'landing' },
  'blog': { label: 'Blog', parent: 'landing' },
  'blog-post': { label: 'Post', parent: 'blog', dynamic: true },
  'docs': { label: 'Docs', parent: 'landing' },
  'docs-page': { label: 'Doc', parent: 'docs', dynamic: true },
}
