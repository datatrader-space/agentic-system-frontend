# AADML / Agentic v2 UI-UX Design & Implementation Plan

Generated from the uploaded ZIP: `New Frontend UIUX.zip`.

## 1. What this package contains

- `screens/` — all UI images renamed with descriptive, implementation-friendly filenames.
- `rename-map.csv` — original filename to new filename mapping.
- `design.md` — this design and implementation brief for the design/frontend/backend agents.

## 2. Important backend verification note

The uploaded ZIP contains screenshots only. It does **not** include backend route files, OpenAPI docs, Postman collections, Django `urls.py`, DRF routers, or FastAPI route files. Because of that, this document separates backend items into:

- **Verify existing** — likely present in your current agentic backend, but exact route names need route-code verification.
- **New/extend** — the screenshot shows functionality that probably needs a new endpoint or an expanded data model.
- **Reference only** — composite journey images used for design direction, not direct screens.

The design agent should not claim an endpoint already exists until the backend agent scans your actual route files.

## 3. Design direction

This UI is a professional SaaS control panel for an agentic AI platform. The strongest direction is the later `Agentic v2` visual language: clean white canvas, soft blue-tinted background, high-contrast navy text, blue primary actions, teal/green success accents, compact enterprise tables, and contextual right-side guidance panels.

Use one unified shell across the product. The ZIP contains two brand directions: older `AADML` purple/blue screens and newer `Agentic v2` blue/teal screens. For implementation, standardize on one product identity and migrate AADML-only screens to the newer Agentic v2 shell unless the product is intentionally keeping both brands.

### Product shell

- Left sidebar width: `248px` desktop, collapsible to icon-only.
- Main content: full width for dense dashboards/tables; max-width `1120px–1280px` for setup wizards and onboarding flows.
- Right context panel: `300px–360px` for help, tips, summaries, and explanations.
- Top action bar: sticky on builder/detail pages with Save, Test, Configure/Publish, and overflow actions.
- Use workspace/org switcher at the top of the sidebar, not scattered inside pages.

### Visual tokens

```txt
Primary blue:       #155EEF / #2563EB
Primary hover:      #004EEB
Accent teal:        #14B8A6
Accent purple:      #7C3AED, only for secondary highlights
Text strong:        #0F172A
Text normal:        #344054
Text muted:         #667085
Border:             #E4E7EC
Surface:            #FFFFFF
Page background:    #F6F8FC or subtle blue gradient
Success:            #12B76A
Warning:            #F79009
Danger:             #F04438
Info:               #2E90FA
Card radius:        14px–18px
Button radius:      10px–12px
Shadow:             very soft, avoid heavy glow
```

### Typography

Recommended SaaS font stack: `Inter`, `Geist`, `Instrument Sans`, or `Manrope`. Use one primary font only. Avoid mixing multiple AI-looking rounded fonts.

```txt
Page title:     28–32px / 700
Section title:  18–20px / 650
Card title:     14–16px / 650
Body:           14px / 450–500
Table text:     13–14px / 450
Meta text:      12–13px / 450
```

### Core reusable components

- `AppShell`
- `SidebarNav`
- `WorkspaceSwitcher`
- `PageHeader`
- `StickyBuilderHeader`
- `Stepper`
- `Tabs`
- `MetricCard`
- `DataTable`
- `StatusBadge`
- `EmptyState`
- `RightHelpPanel`
- `SettingsCard`
- `FormSection`
- `ConfirmDialog`
- `Drawer`
- `CommandSearch`
- `QuickTestChatPanel`
- `ChartCard`
- `PolicyToggleRow`
- `WizardLayout`
- `CanvasLayout`

## 4. Renamed screen catalog

| # | Renamed screen | Module | What the screen is | Implementation route | Backend status |
|---:|---|---|---|---|---|
| 1 | `screen-01-workspace-growth-ops-overview.png` | Organization / workspace admin | Growth Ops workspace overview with members, agents, credentials, approvals, budget and guardrails. | `/organizations/:orgId/workspaces/:workspaceId` | New/extend org workspace governance; verify member/agent/budget endpoints. |
| 2 | `screen-02-service-library-overview.png` | Connectors / services | Service Library overview with KPIs, filters, categories and service list. | `/connectors/services` | New/extend service registry. |
| 3 | `screen-03-service-register-wizard-basic-info.png` | Connectors / services | Register New Service wizard step 1 for basic information, visibility and workspace access. | `/connectors/services/new?step=basic-info` | New service registry create wizard. |
| 4 | `screen-04-service-detail-asana-overview.png` | Connectors / services | Asana service detail page with overview, health, usage, quick actions and activity. | `/connectors/services/:serviceId` | New/extend service detail, health and usage. |
| 5 | `screen-05-service-edit-basic-settings.png` | Connectors / services | Edit Service wizard for basic settings, rate limit, retry, timeout and sharing. | `/connectors/services/:serviceId/edit?step=basic-info` | New/extend service settings update. |
| 6 | `screen-06-service-configure-actions.png` | Connectors / services | Configure Actions wizard step for service endpoints/actions, methods, paths and enable toggles. | `/connectors/services/:serviceId/edit?step=actions` | New/extend service actions/OpenAPI import. |
| 7 | `screen-07-services-management-table.png` | Connectors / services | Services Management table with filters, export, register service and pagination. | `/connectors/services/manage` | New/extend service management list. |
| 8 | `screen-08-oauth-provider-connection-flow-overview.png` | Connectors / OAuth | Composite OAuth provider setup flow: connections list, provider wizard, scopes, review and success state. | `/connectors/oauth-providers/new` | New/extend OAuth provider admin flow. |
| 9 | `screen-09-agent-builder-attach-credentials-vault.png` | Agent builder | Attach Credentials from Vault step for reusable encrypted credentials and permission education. | `/agents/:agentId/setup/credentials` | New/extend credentials vault agent binding. |
| 10 | `screen-10-agent-detail-test-publish-monitor.png` | Agent detail | Published agent Test, Publish & Monitor dashboard with status, last test, controls, charts and quick test. | `/agents/:agentId/monitor` | Verify agent run/test/publish endpoints; extend monitoring metrics. |
| 11 | `screen-11-agent-detail-overview-dashboard.png` | Agent detail | Agent overview dashboard showing purpose, knowledge, tools, credentials, autonomy and quick test panel. | `/agents/:agentId` | Verify agent detail endpoints; extend summary cards. |
| 12 | `screen-12-agent-builder-ux-journey-overview.png` | Agent builder | Composite UX journey showing create agent, define brain, add knowledge/tools, attach credentials, autonomy and test. | `reference-only / agent-builder journey` | Reference image, no endpoint. |
| 13 | `screen-13-agent-create-template-selection.png` | Agent builder | Create agent entry screen with templates, agent basics, workspace and save/next controls. | `/agents/new` | Verify agent create endpoint; add templates endpoint if missing. |
| 14 | `screen-14-agent-brain-define-behavior.png` | Agent builder | Define Brain step with purpose, system prompt, behavioral rules, memory and response style. | `/agents/:agentId/setup/brain` | Verify agent settings endpoint; extend brain fields. |
| 15 | `screen-15-agent-knowledge-tools-setup.png` | Agent builder | Add Knowledge & Tools step with file/URL/memory sources and tool capability cards. | `/agents/:agentId/setup/knowledge-tools` | Verify KB/tool endpoints; extend memory-source support. |
| 16 | `screen-16-agent-builder-attach-credentials-vault-duplicate-a.png` | Agent builder | Duplicate copy of Attach Credentials from Vault screen retained for completeness. | `/agents/:agentId/setup/credentials` | Duplicate of screen 09. |
| 17 | `screen-17-agent-builder-attach-credentials-vault-duplicate-b.png` | Agent builder | Duplicate copy of Attach Credentials from Vault screen retained for completeness. | `/agents/:agentId/setup/credentials` | Duplicate of screen 09. |
| 18 | `screen-18-agent-autonomy-safety-configuration.png` | Agent builder | Configure Autonomy & Safety step with execution mode, approval rules, guardrails, spend and action limits. | `/agents/:agentId/setup/autonomy` | New/extend autonomy, approvals and safety policy endpoints. |
| 19 | `screen-19-agent-autonomy-safety-configuration-duplicate-a.png` | Agent builder | Duplicate copy of Configure Autonomy & Safety screen retained for completeness. | `/agents/:agentId/setup/autonomy` | Duplicate of screen 18. |
| 20 | `screen-20-agent-detail-test-publish-monitor-duplicate-a.png` | Agent detail | Duplicate copy of Test, Publish & Monitor dashboard retained for completeness. | `/agents/:agentId/monitor` | Duplicate of screen 10. |
| 21 | `screen-21-home-dashboard-overview.png` | Core app | Home dashboard with active agents, runs, success rate, cost, recent agents/activity and onboarding links. | `/dashboard` | Verify dashboard summary endpoints. |
| 22 | `screen-22-activity-request-log.png` | Core app | Activity page with request log, audit trail/failures tabs, filters and run details. | `/activity` | Verify run/activity/audit log endpoints. |
| 23 | `screen-23-settings-general-workspace-preferences.png` | Core app | Settings page with account, appearance, workspace, platform preferences and setup checklist. | `/settings/general` | Verify settings/profile/workspace endpoints. |
| 24 | `screen-24-tools-library-management.png` | Tools | Tools management page for built-in tools, MCP servers and custom tools. | `/tools` | Verify tool registry/MCP endpoints. |
| 25 | `screen-25-workflow-builder-canvas-manual-trigger.png` | Workflow builder | Workflow Builder canvas with node palette, manual trigger and right-side configuration inspector. | `/workflows/:workflowId/builder` | Verify workflow CRUD; extend canvas graph APIs if needed. |
| 26 | `screen-26-ai-cost-dashboard.png` | Cost analytics | AI Cost Dashboard for LLM requests, cost over time, model/agent costs and request log. | `/costs/ai` | Verify cost tracking endpoints; cost tracking likely exists but route names need scan. |
| 27 | `screen-27-connectors-overview-global-scope.png` | Connectors | Connectors overview with global scope, connected/available/MCP/custom tabs and sandbox summary. | `/connectors` | Verify connector catalog/OAuth endpoints; extend global/per-agent scope. |
| 28 | `screen-28-automation-schedules-create-run.png` | Automation | Automation & Schedules page for scheduled runs, frequency, timing, controls and schedule table. | `/automations/schedules` | New/extend scheduled run endpoints. |
| 29 | `screen-29-integration-hub-catalog.png` | Connectors | Integration Hub catalog with cards for GitHub, Slack, Gmail, Stripe, Notion, HubSpot, Salesforce, Drive and custom MCP. | `/connectors/integrations` | Verify connector catalog; extend installed integrations. |
| 30 | `screen-30-help-center-home-alt-layout.png` | Help / education | Alternative help center home with search, quick start, topics, tutorials and recommended next steps. | `/help` | New/static CMS/help content. |
| 31 | `screen-31-budgets-cost-controls.png` | Governance | Budgets page with spend cards, budget-by-scope table, spend charts, rules and presets. | `/budgets` | New/extend budget hierarchy and rules. |
| 32 | `screen-32-guardrails-policy-controls.png` | Governance | Guardrails page with approval policies, risky actions, tool permissions, modes, checkpoints and escalation rules. | `/guardrails` | New/extend guardrails policy endpoints. |
| 33 | `screen-33-help-center-home.png` | Help / education | Help Center page with search, setup checklist, browse topics, tutorials and support actions. | `/help` | New/static CMS/help content. |
| 34 | `screen-34-documentation-home.png` | Help / education | Documentation home with docs categories, quickstart, API reference, SDKs, code examples and support links. | `/documentation` | New/static docs/API reference content. |
| 35 | `screen-35-tutorials-library.png` | Help / education | Tutorials library with featured series, popular tutorials, learning paths and progress panels. | `/tutorials` | New/tutorial CMS content. |
| 36 | `screen-36-guided-tours-library.png` | Help / education | Guided Tours library with recommended tours, updated tours, admin tours and progress/stat panels. | `/guided-tours` | New/tour/onboarding progress APIs. |
| 37 | `screen-37-getting-started-onboarding.png` | Onboarding | Getting Started page with checklist, setup progress, templates, guided setup and support resources. | `/getting-started` | New/onboarding checklist progress APIs. |
| 38 | `screen-38-organization-overview-north-rays.png` | Organization admin | North Rays organization dashboard with workspaces, members, approvals, credentials, budget and guardrails. | `/organizations/:orgId` | New/extend organization dashboard APIs. |
| 39 | `screen-39-organization-admin-module-overview.png` | Organization admin | Composite organization admin module reference: workspaces, cloud resources, sandboxes, budgets, procurement, usage, policies and activity. | `reference-only / organization admin modules` | Reference image; split into multiple org-admin routes. |



## 5. Per-screen implementation plan

### Screen 01 — Workspace Growth Ops overview
Use this as the workspace command center. The main sections are KPI cards, members, agents, pending access requests, credentials, tools policy, approvals, budget and guardrails. Implement as `WorkspaceOverviewPage.vue` using `PageHeader`, `MetricCardGrid`, `MembersTable`, `WorkspaceAgentsTable`, `CredentialsList`, `ToolsPolicyCard`, `ApprovalsCard`, and `BudgetGuardrailsPanel`.

Backend wiring: workspace summary, members, agents, credentials, approvals, tool policy and budget. Recommended endpoints: `GET /api/v1/workspaces/:id/summary`, `GET /api/v1/workspaces/:id/members`, `GET /api/v1/workspaces/:id/agents`, `GET /api/v1/workspaces/:id/credentials`, `GET /api/v1/workspaces/:id/approvals`, `PATCH /api/v1/workspaces/:id/tool-policy`, `GET/PATCH /api/v1/workspaces/:id/budget`. Treat exact current endpoints as unverified until route files are checked.

### Screens 02–07 — Service registry and service management
These screens define a service registry layer above connectors. The service library shows metrics, categories, filters and service rows. The register/edit wizard collects basic info, API config, actions/endpoints, schema review and final review. The Asana detail page includes service metadata, health, usage, tags, quick actions and recent activity.

Frontend components: `ServiceLibraryPage`, `ServicesManagementPage`, `ServiceWizard`, `ServiceBasicInfoStep`, `ServiceApiConfigStep`, `ServiceActionsStep`, `ServiceSchemaReviewStep`, `ServiceDetailPage`, `ServiceUsageChart`, and `ServiceHealthCard`. Use server-side filtering and pagination for all service tables. Actions need optimistic toggles, but show rollback toast if the backend rejects enabling an action.

Backend wiring: this is probably a new or expanded backend module. Recommended endpoints: `GET /api/v1/services`, `POST /api/v1/services`, `GET/PATCH/DELETE /api/v1/services/:id`, `GET /api/v1/services/:id/actions`, `POST /api/v1/services/:id/actions`, `PATCH /api/v1/services/:id/actions/:actionId`, `POST /api/v1/services/:id/import-openapi`, `POST /api/v1/services/:id/test-connection`, `GET /api/v1/services/:id/health`, `GET /api/v1/services/:id/usage`, `GET /api/v1/service-categories`.

### Screen 08 — OAuth provider connection flow overview
This composite reference shows the full provider onboarding: connections list, add provider wizard, OAuth endpoints, client credentials/scopes, review and success. Implement the actual flow as route children inside `/connectors/oauth-providers/new` with draft persistence so users can leave and resume.

Frontend components: `ConnectionsPage`, `OAuthProviderWizard`, `ProviderBasicInfoStep`, `ProviderEndpointsStep`, `ProviderScopesStep`, `ProviderReviewStep`, and `ProviderSuccessState`. Validate URL fields, slug uniqueness, scope names and PKCE settings before submit.

Backend wiring: recommended endpoints are `GET /api/v1/oauth-providers`, `POST /api/v1/oauth-providers`, `GET/PATCH/DELETE /api/v1/oauth-providers/:id`, `POST /api/v1/oauth-providers/:id/test`, `POST /api/v1/oauth-providers/discover`, and `GET /api/v1/connections`. This is likely new for custom providers; existing built-in OAuth connectors should be reused where possible.

### Screens 09, 16, 17 — Attach credentials from vault
These three files are the same screen. Keep one route and one implementation. The screen attaches global encrypted credentials to an agent with permission modes and a right-side permission explainer.

Frontend components: `AgentCredentialsStep`, `CredentialVaultTable`, `CredentialPermissionPanel`, `CredentialAttachButton`, and `CredentialPagination`. Required states: loading, attached, expired, empty, no-permission, and attach-confirmation. Make “Manage Vault” open the global credentials page in a drawer or new route.

Backend wiring: recommended endpoints are `GET /api/v1/credentials?workspaceId=...`, `GET /api/v1/agents/:id/credentials`, `POST /api/v1/agents/:id/credentials`, `PATCH /api/v1/agents/:id/credentials/:credentialId`, `DELETE /api/v1/agents/:id/credentials/:credentialId`, and `GET /api/v1/credentials/:id/usage`. Add permission modes: `use_only`, `view_metadata`, `edit`.

### Screens 10, 20 — Test, publish and monitor agent
These are duplicate copies of the published agent monitoring page. It shows deployment status, health, success rate, response time, last test result, publish controls, activity summary, recent runs, health indicators and quick test chat.

Frontend components: `AgentMonitorPage`, `AgentStatusCards`, `LastTestResultCard`, `PublishControlsCard`, `ActivitySummaryChart`, `RecentRunsList`, `AgentQuickTestPanel`, and `HealthIndicatorsBar`. Quick Test should use the same streaming transport as your current chat/emulator so tokens and tool steps appear live.

Backend wiring: likely partially existing. Recommended endpoints: `GET /api/v1/agents/:id/monitoring`, `POST /api/v1/agents/:id/test`, `POST /api/v1/agents/:id/publish`, `POST /api/v1/agents/:id/rollback`, `GET /api/v1/agents/:id/runs`, `GET /api/v1/agents/:id/metrics`, and streaming `WS /ws/agents/:id/test` or `POST /api/v1/agents/:id/test/stream`.

### Screen 11 — Agent detail overview dashboard
This page is the normal agent detail overview. It summarizes purpose, knowledge, tools, credentials, autonomy, last test and a quick test panel. This should be the primary landing page after opening an agent.

Frontend components: `AgentOverviewPage`, `AgentSummaryCards`, `AgentBrainPreview`, `AgentActionsPreview`, `ConnectedCredentialsPreview`, `AutonomySummaryCard`, and `AgentQuickTestPanel`. Use card click-throughs to take users to the relevant setup step.

Backend wiring: `GET /api/v1/agents/:id`, `GET /api/v1/agents/:id/summary`, `GET /api/v1/agents/:id/tools`, `GET /api/v1/agents/:id/knowledge-sources`, `GET /api/v1/agents/:id/credentials`, `GET /api/v1/agents/:id/autonomy`, `GET /api/v1/agents/:id/latest-test`.

### Screen 12 — Agent builder UX journey
This is a design reference image, not a direct route. Use it as the north-star flow: create agent → define brain → add knowledge/tools → attach credentials → configure autonomy → test/publish/monitor.

Implementation requirement: all builder steps should use one shared `AgentBuilderLayout` with left app shell, top stepper, sticky header actions, autosave, draft/published status, and route guards for incomplete required steps.

### Screen 13 — Create agent / template selection
This is the starting point for agent creation. It includes template cards, agent basics, workspace selection, draft/save controls and next step.

Frontend components: `CreateAgentPage`, `AgentTemplateSelector`, `AgentBasicsForm`, `WorkspaceSelect`, and `BuilderHelpCallout`. Persist a draft immediately after the user enters name/purpose/workspace.

Backend wiring: `GET /api/v1/agent-templates`, `POST /api/v1/agents`, `POST /api/v1/agents/drafts`, `PATCH /api/v1/agents/:id`, `GET /api/v1/workspaces`. Templates may be new if they are currently hardcoded.

### Screen 14 — Agent brain / define behavior
This step configures purpose, system prompt, behavioral rules, memory and response style. Use inline edit panels instead of sending the user to different pages.

Frontend components: `AgentBrainStep`, `PurposeCard`, `SystemPromptEditor`, `BehaviorRulesEditor`, `MemorySettingsCard`, and `ResponseStyleEditor`. Use autosave with debounced PATCH and versioned prompt history.

Backend wiring: `GET/PATCH /api/v1/agents/:id/brain`, `GET /api/v1/agents/:id/prompt-history`, `POST /api/v1/agents/:id/brain/validate`. If your backend already has agent prompt fields, map these UI fields onto existing model columns first before creating new tables.

### Screen 15 — Agent knowledge and tools setup
This step adds files, URLs, memory sources and tool capability groups. It is central to your RAG + tool configuration.

Frontend components: `AgentKnowledgeToolsStep`, `KnowledgeSourcesPanel`, `UploadedFilesList`, `UrlSourcesList`, `MemorySourcesList`, `ToolCapabilityCard`, and `ManageConnectorsButton`. Indexing status must be visible for uploaded files and URLs.

Backend wiring: likely partially existing in your KB/RAG backend. Recommended endpoints: `GET /api/v1/agents/:id/knowledge-sources`, `POST /api/v1/agents/:id/knowledge-sources/files`, `POST /api/v1/agents/:id/knowledge-sources/urls`, `POST /api/v1/agents/:id/memory-sources`, `GET /api/v1/agents/:id/tools`, `PATCH /api/v1/agents/:id/tools`, `GET /api/v1/tools/catalog`, `GET /api/v1/indexing/jobs/:jobId`.

### Screens 18, 19 — Agent autonomy and safety configuration
These duplicate screens configure execution mode, approval rules, guardrails, spending limits, action limits and a human-readable autonomy summary.

Frontend components: `AgentAutonomyStep`, `ExecutionModeCards`, `ApprovalRulesForm`, `GuardrailsSummaryCard`, `SpendingLimitsForm`, `ActionLimitsForm`, and `AutonomySummaryPreview`. The summary should be generated deterministically from selected settings, not by LLM.

Backend wiring: recommended endpoints are `GET/PATCH /api/v1/agents/:id/autonomy`, `GET/PATCH /api/v1/agents/:id/approval-rules`, `GET/PATCH /api/v1/agents/:id/spend-limits`, `GET/PATCH /api/v1/agents/:id/action-limits`, and `POST /api/v1/agents/:id/autonomy/test`. This likely requires backend extension.

### Screen 21 — Home dashboard overview
This is the main dashboard after login. It shows active agents, runs, success rate, cost, recent agents, recent activity, quick start and onboarding/help links.

Frontend components: `DashboardPage`, `DashboardMetricCards`, `RecentAgentsCard`, `RecentActivityCard`, `QuickStartGrid`, and `OnboardingHelpStrip`. Keep this screen fast: load summary first, then recent activity and help content lazily.

Backend wiring: `GET /api/v1/dashboard/summary`, `GET /api/v1/agents?recent=true`, `GET /api/v1/activity?limit=5`, `GET /api/v1/onboarding/status`.

### Screen 22 — Activity request log
This page is for operational debugging: request log, audit trail and failures. It needs filters, pagination and run detail drawers.

Frontend components: `ActivityPage`, `ActivityTabs`, `RunLogTable`, `AuditTrailTable`, `FailuresTable`, `RunDetailsDrawer`, and `ActivityHelpPanel`. Make “View run” open a drawer containing inputs, output, tool calls, token/cost details and timeline.

Backend wiring: likely partially existing. Recommended endpoints: `GET /api/v1/activity/runs`, `GET /api/v1/activity/audit`, `GET /api/v1/activity/failures`, `GET /api/v1/runs/:id`, `GET /api/v1/runs/:id/events`, `GET /api/v1/runs/:id/cost`, `POST /api/v1/runs/:id/retry`.

### Screen 23 — General settings and workspace preferences
This page handles account settings, appearance, workspace metadata, platform preferences and setup checklist.

Frontend components: `SettingsPage`, `SettingsSideTabs`, `GeneralSettingsForm`, `AppearanceToggle`, `WorkspaceSettingsForm`, `PlatformPreferencesForm`, and `SettingsChecklistPanel`.

Backend wiring: `GET/PATCH /api/v1/me`, `GET/PATCH /api/v1/user/preferences`, `GET/PATCH /api/v1/workspaces/:id`, `GET /api/v1/onboarding/status`, `POST /api/v1/billing/portal`. Appearance can be local first, then synced to preferences.

### Screen 24 — Tools library management
This page manages built-in tools, MCP servers and custom tools. It explains tools versus connectors and guides assignment to agents.

Frontend components: `ToolsPage`, `ToolsTabs`, `ToolsTable`, `McpServersTable`, `CustomToolsTable`, `ToolDetailsDrawer`, and `ToolHelpSidebar`. Do not hide disabled tools; show why disabled or why credentials are required.

Backend wiring: likely partially existing in your MCP/tool registry. Recommended endpoints: `GET /api/v1/tools`, `PATCH /api/v1/tools/:id`, `GET /api/v1/mcp/servers`, `POST /api/v1/mcp/servers`, `GET /api/v1/custom-tools`, `POST /api/v1/custom-tools`, `GET /api/v1/tools/:id/agents`.

### Screen 25 — Workflow builder canvas
This is a visual workflow editor with node palette, canvas, minimap, node inspector and top bar actions for validate/test/run/save/publish.

Frontend components: use Vue Flow or a similar canvas library. Implement `WorkflowBuilderPage`, `NodePalette`, `WorkflowCanvas`, `WorkflowNode`, `NodeInspector`, `WorkflowTopBar`, `WorkflowMinimap`, and `WorkflowValidationPanel`. Store the graph as nodes + edges + version.

Backend wiring: `GET/POST /api/v1/workflows`, `GET/PATCH /api/v1/workflows/:id`, `PATCH /api/v1/workflows/:id/graph`, `POST /api/v1/workflows/:id/validate`, `POST /api/v1/workflows/:id/test`, `POST /api/v1/workflows/:id/run`, `POST /api/v1/workflows/:id/publish`, `GET /api/v1/workflow-node-types`.

### Screen 26 — AI cost dashboard
This page visualizes LLM requests, cost, latency, model mix, cost by agent and request-level logs. The user already discussed cost tracking, so backend likely exists partially, but exact route names are unverified from this ZIP.

Frontend components: `AiCostDashboardPage`, `CostMetricCards`, `CostOverTimeChart`, `TopModelsChart`, `CostByAgentChart`, `CostRequestLogTable`, and `CostInsightsPanel`. Use server aggregation, not client-side aggregation over raw logs.

Backend wiring: `GET /api/v1/costs/summary`, `GET /api/v1/costs/timeseries`, `GET /api/v1/costs/models`, `GET /api/v1/costs/agents`, `GET /api/v1/costs/requests`, `GET /api/v1/costs/audit`. Add filters for provider, model, agent, status and date range.

### Screen 27 — Connectors overview / global scope
This page is the main connector management surface. It combines global scope, connected/available/MCP/custom tabs, connector details and sandboxes.

Frontend components: `ConnectorsPage`, `ConnectorScopeSelector`, `ConnectorTabs`, `ConnectorList`, `ConnectorDetailsEmptyState`, `AddConnectorMenu`, `SandboxSummaryCard`, and `ConnectorGettingStartedSidebar`.

Backend wiring: likely partially existing. Recommended endpoints: `GET /api/v1/connectors`, `GET /api/v1/connectors/catalog`, `GET /api/v1/connectors/:id`, `POST /api/v1/connectors/:id/connect`, `POST /api/v1/connectors/:id/disconnect`, `PATCH /api/v1/connectors/:id/scope`, `GET /api/v1/sandboxes`, `POST /api/v1/sandboxes`.

### Screen 28 — Automation and schedules
This page creates recurring agent runs with task prompt, frequency, timing, advanced overrides, safety settings and schedule table.

Frontend components: `SchedulesPage`, `ScheduleRunForm`, `ScheduleTemplateMenu`, `CronPreview`, `SchedulesTable`, and `ScheduleHelpSidebar`. The UI must prevent unsupported cadences and show timezone explicitly.

Backend wiring: likely new or extension. Recommended endpoints: `GET /api/v1/schedules`, `POST /api/v1/schedules`, `GET/PATCH/DELETE /api/v1/schedules/:id`, `POST /api/v1/schedules/:id/run-now`, `POST /api/v1/schedules/:id/pause`, `POST /api/v1/schedules/:id/resume`, `GET /api/v1/schedule-templates`.

### Screen 29 — Integration Hub catalog
This is a marketplace-style integration catalog. It should share connector models with the Connectors page but use card browsing and installation flow.

Frontend components: `IntegrationHubPage`, `IntegrationSearchFilters`, `IntegrationCardGrid`, `IntegrationInfoSidebar`, and `InstalledIntegrationsTab`.

Backend wiring: `GET /api/v1/integrations/catalog`, `GET /api/v1/integrations/installed`, `POST /api/v1/integrations/:key/install`, `GET /api/v1/integrations/:key/scopes`. Prefer mapping to existing connector catalog if it already exists.

### Screens 30 and 33 — Help center home variants
These are two variants of the help center home. Pick screen 33 as the final because it is cleaner and has a stronger right-side support hierarchy; screen 30 can remain as an alternate reference.

Frontend components: `HelpCenterPage`, `HelpSearchBar`, `SetupChecklistCard`, `HelpTopicGrid`, `FeaturedTutorialsRow`, `RecommendedNextSteps`, and `SupportActionsCard`. Use local static JSON first if backend CMS is not ready.

Backend wiring: `GET /api/v1/help/search`, `GET /api/v1/help/topics`, `GET /api/v1/help/tutorials`, `GET /api/v1/help/recommended`, `POST /api/v1/support/tickets`, `POST /api/v1/support/onboarding-booking`. This can be static content for v1.

### Screen 31 — Budgets and cost controls
This page controls spend limits and budget rules across workspace, agent, workflow and schedule scopes. It also shows spend charts and budget presets.

Frontend components: `BudgetsPage`, `BudgetMetricCards`, `BudgetByScopeTable`, `SpendTrendChart`, `SpendByAgentChart`, `SpendByProviderChart`, `BudgetRulesTable`, and `BudgetPresetsSidebar`.

Backend wiring: likely new/extend. Recommended endpoints: `GET /api/v1/budgets/summary`, `GET /api/v1/budgets/scopes`, `POST/PATCH/DELETE /api/v1/budgets/rules`, `GET /api/v1/budgets/spend-timeseries`, `GET /api/v1/budgets/presets`, `POST /api/v1/budgets/presets/:id/apply`, `GET /api/v1/budgets/alerts`.

### Screen 32 — Guardrails and policy controls
This page is the enterprise safety control center. It includes approval policies, risky action blocking, tool permissions, read-only/action mode, human checkpoints, spending/communication restrictions and escalation rules.

Frontend components: `GuardrailsPage`, `ApprovalPoliciesCard`, `RiskyActionsCard`, `ToolPermissionsCard`, `ModeSelectorCard`, `HumanCheckpointsCard`, `RestrictionsCard`, `EscalationRulesTable`, and `GuardrailPresetsSidebar`.

Backend wiring: likely new/extend. Recommended endpoints: `GET/PATCH /api/v1/guardrails`, `GET/POST/PATCH/DELETE /api/v1/guardrails/escalations`, `GET /api/v1/guardrails/audit-log`, `POST /api/v1/guardrails/presets/:id/apply`, `GET /api/v1/tools`, `GET /api/v1/connectors`.

### Screen 34 — Documentation home
This page is docs + API reference + SDKs. It can launch as static generated content first, then move to a CMS.

Frontend components: `DocumentationPage`, `DocsSearchBar`, `DocsCategoryTabs`, `DocsCategoryCards`, `QuickstartPanel`, `ApiReferencePreview`, `SdkCliCard`, `CodeExampleCard`, `PopularArticlesCard`, and `DocsSidebar`.

Backend wiring: static files or `GET /api/v1/docs/search`, `GET /api/v1/docs/categories`, `GET /api/v1/docs/articles`, `GET /api/v1/docs/api-reference`, `GET /api/v1/docs/changelog`.

### Screen 35 — Tutorials library
This page is the video/tutorial learning library with progress and recommended paths.

Frontend components: `TutorialsPage`, `TutorialFilters`, `FeaturedSeriesGrid`, `PopularTutorialsGrid`, `LearningPathsGrid`, `LearningProgressSidebar`, and `TutorialCard`.

Backend wiring: static JSON for v1 or `GET /api/v1/tutorials`, `GET /api/v1/tutorial-series`, `GET /api/v1/learning-paths`, `GET/PATCH /api/v1/learning-progress`.

### Screen 36 — Guided tours library
This page manages in-app guided tours. It should integrate with your product tour system, not just documentation pages.

Frontend components: `GuidedToursPage`, `TourFilters`, `RecommendedTourCards`, `UpdatedTourGrid`, `AdminTourGrid`, `TourProgressPanel`, and `TourStatsPanel`.

Backend wiring: likely new. Recommended endpoints: `GET /api/v1/tours`, `POST /api/v1/tours/:id/start`, `POST /api/v1/tours/:id/step-complete`, `GET /api/v1/tours/progress`, `POST /api/v1/tours/:id/reset`.

### Screen 37 — Getting Started onboarding
This is the onboarding command center. It shows setup progress, checklist steps, starter templates, guided setup and support resources.

Frontend components: `GettingStartedPage`, `SetupHero`, `SetupChecklist`, `StarterTemplatesRow`, `GuidedSetupRow`, `SetupProgressPanel`, `HelpfulResourcesCard`, and `SupportContactCard`.

Backend wiring: `GET /api/v1/onboarding/status`, `PATCH /api/v1/onboarding/steps/:key`, `GET /api/v1/agent-templates`, `GET /api/v1/onboarding/guides`, `POST /api/v1/support/contact`.

### Screen 38 — Organization overview
This is the organization-level admin dashboard for North Rays. It summarizes workspaces, members, agents, organization credentials, approvals, spend, budget, tools/capability policy, organization guardrails and activity.

Frontend components: `OrganizationOverviewPage`, `OrgMetricCards`, `WorkspacesTable`, `OrganizationMembersTable`, `ApprovalQueueCard`, `OrgCredentialsVaultCard`, `ToolsCapabilityPolicyCard`, `OrgBudgetBillingCard`, `OrgGuardrailsCard`, and `OrgActivityTimeline`.

Backend wiring: `GET /api/v1/organizations/:id/summary`, `GET /api/v1/organizations/:id/workspaces`, `GET /api/v1/organizations/:id/members`, `GET /api/v1/organizations/:id/credentials`, `GET /api/v1/organizations/:id/approvals`, `GET/PATCH /api/v1/organizations/:id/tool-policy`, `GET/PATCH /api/v1/organizations/:id/guardrails`, `GET /api/v1/organizations/:id/activity`.

### Screen 39 — Organization admin module overview
This is a composite reference containing multiple organization admin screens: Workspaces, Cloud Resources, Sandboxes, Budgets & Finance, Procurement, Usage & Insights, Policies & Controls and Activity. Split this into separate routes rather than implementing it as one page.

Recommended routes: `/organizations/:orgId/workspaces`, `/organizations/:orgId/cloud-resources`, `/organizations/:orgId/sandboxes`, `/organizations/:orgId/budgets`, `/organizations/:orgId/procurement`, `/organizations/:orgId/usage`, `/organizations/:orgId/policies`, and `/organizations/:orgId/activity`.

Backend wiring: this is mostly new enterprise admin scope. Use the same data models as workspaces, budgets, guardrails and activity where possible. New tables may be needed for cloud resource inventory, sandbox lifecycle, procurement requests and policy compliance scans.


## 7. Vue implementation architecture

Use Vue 3 + TypeScript + Vue Router + Pinia or TanStack Query for server state. Keep server state out of global stores unless it is truly global. For tables, use server pagination and filters. For forms, use local draft state and debounced save.

Recommended structure:

```txt
src/
  app/
    router.ts
    apiClient.ts
    queryClient.ts
  layouts/
    AppShell.vue
    BuilderLayout.vue
    WizardLayout.vue
    CanvasLayout.vue
  components/
    ui/
    data-table/
    charts/
    forms/
    feedback/
  modules/
    dashboard/
    agents/
    agent-builder/
    connectors/
    services/
    credentials/
    tools/
    workflows/
    schedules/
    activity/
    costs/
    budgets/
    guardrails/
    settings/
    organizations/
    help/
  stores/
    auth.store.ts
    workspace.store.ts
    ui.store.ts
  types/
    api.ts
    agent.ts
    connector.ts
    workflow.ts
```

### Frontend implementation rules

1. Use route-level code splitting for every major module.
2. Use skeleton loaders for dashboards and tables.
3. Every table must support loading, empty, error, filtered-empty and permission-denied states.
4. Builder pages must autosave and show `Saved`, `Saving`, `Unsaved`, and `Save failed` states.
5. Destructive actions must require confirmation.
6. Tool/credential/connector toggles must handle approval-required and blocked states.
7. Agent test panels must stream progress, not wait for a final response.
8. Charts should use backend aggregates; do not compute expensive analytics in the browser.
9. Keep setup flows linear, but allow revisiting previous steps.
10. Use one design token file for spacing, colors, radius and shadows.


## 6. Backend endpoint contract to hand to backend/design agent

Exact existing endpoints cannot be confirmed from this ZIP because it contains screenshots only. The design agent should ask the backend agent to scan Django URLs/DRF routers/FastAPI routes and map current routes to the proposed contract below.

### Likely existing or partially existing modules to verify
- Agents: create, list, detail, update, test, publish, run history.
- Chat / quick test streaming: reuse your existing agent chat/emulator streaming path.
- Connectors: built-in GitHub/Slack/Gmail style OAuth connection list and status.
- Tool registry/MCP: built-in tools, MCP tools, tool enablement.
- Activity/runs: request logs, run events, token/cost fields.
- AI cost tracking: cost summary and request logs likely exist based on current project work, but route names need verification.
- Knowledge base/RAG: files, URLs, chunks/indexing status, vector search/memory sources.

### New or likely-expanded modules
- Service registry: custom services, OpenAPI/Postman import, endpoint actions, service usage and health.
- OAuth provider admin: custom OAuth provider setup and discovery.
- Credentials vault permission model: global credential sharing, attach-to-agent, use-only/view/edit permissions.
- Autonomy and guardrails: execution modes, approval rules, spending/action limits, escalation policies.
- Scheduled runs: recurring agent execution with cron/timezone/budget limits.
- Budget hierarchy: budgets by workspace, agent, workflow, schedule, provider/model.
- Organization admin: org-level workspaces, members, credentials, policies, budgets and activity.
- Help/docs/tutorials/tours: static content first, CMS/progress APIs later.

### Recommended API groups

```txt
/api/v1/dashboard/*
/api/v1/agents/*
/api/v1/agent-templates/*
/api/v1/knowledge-sources/*
/api/v1/tools/*
/api/v1/mcp/*
/api/v1/connectors/*
/api/v1/integrations/*
/api/v1/oauth-providers/*
/api/v1/credentials/*
/api/v1/workflows/*
/api/v1/schedules/*
/api/v1/activity/*
/api/v1/runs/*
/api/v1/costs/*
/api/v1/budgets/*
/api/v1/guardrails/*
/api/v1/workspaces/*
/api/v1/organizations/*
/api/v1/help/*
/api/v1/docs/*
/api/v1/tutorials/*
/api/v1/tours/*
/api/v1/onboarding/*
```

### Core response conventions
All list endpoints should support `page`, `page_size`, `search`, `sort`, `status`, `workspace_id`, `agent_id`, and `date_range` where relevant. Return pagination as `{results, count, next, previous}` if DRF is used.

All mutation endpoints should return updated resource state, not only `{success: true}`. The Vue frontend should not have to refetch immediately after every save.

All agent test/run endpoints should return a `run_id` immediately and stream updates using your existing websocket/SSE event model.

All sensitive operations should return an approval state when blocked: `allowed`, `requires_approval`, `blocked`, with `reason`, `policy_id`, and optional `approval_request_id`.


## 8. Priority implementation order

1. Global app shell, sidebar, page header, cards, tables, badges, drawers.
2. Agent create/detail/builder flow: screens 13, 14, 15, 09, 18, 11, 10.
3. Connectors + tools: screens 27, 29, 24.
4. Activity + cost tracking: screens 22, 26.
5. Workflow builder and schedules: screens 25, 28.
6. Budgets and guardrails: screens 31, 32.
7. Organization/workspace admin: screens 01, 38, 39.
8. Help/onboarding/docs/tutorials/tours: screens 33, 37, 34, 35, 36.
9. Service registry and custom OAuth provider admin: screens 02–08, if this is part of the immediate product scope.

## 9. Duplicate handling

Exact duplicate screenshots were not removed. They were renamed and kept so the returned ZIP still contains every uploaded image.

- `screen-09-agent-builder-attach-credentials-vault.png`
- `screen-16-agent-builder-attach-credentials-vault-duplicate-a.png`
- `screen-17-agent-builder-attach-credentials-vault-duplicate-b.png`

- `screen-10-agent-detail-test-publish-monitor.png`
- `screen-20-agent-detail-test-publish-monitor-duplicate-a.png`

- `screen-18-agent-autonomy-safety-configuration.png`
- `screen-19-agent-autonomy-safety-configuration-duplicate-a.png`

## 10. Final design-agent instruction

Implement this UI as a real product interface, not as static mockup pages. Prioritize reusable components, real loading/error/empty states, permission-aware actions, backend-driven tables, streaming agent test panels, and a consistent Agentic v2 shell across all modules. Before wiring backend calls, scan the backend route files and replace every proposed endpoint in this document with the actual available route or create a backend task for the missing route.
