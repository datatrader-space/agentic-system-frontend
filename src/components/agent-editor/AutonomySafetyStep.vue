<template>
  <div class="mx-auto w-full max-w-[1840px] px-6 pb-8 font-[Inter,system-ui,sans-serif]">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-[21px] font-bold tracking-tight text-[#0F172A]">Configure Autonomy &amp; Safety</h2>
        <p class="mt-1 text-[13.5px] text-[#475569]">Set how your agent works, when it acts, and the boundaries it must follow.</p>
      </div>
      <button class="guide-btn" @click="go('/dashboard/docs?topic=autonomy-safety')">
        <BookOpen :size="16" :stroke-width="2" /> View Autonomy Guide
      </button>
    </div>

    <section class="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <div class="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div>
          <h3 class="text-[16px] font-semibold text-[#0F172A]">Execution Mode &amp; Controls</h3>
          <p class="mt-2 text-[13px] leading-5 text-[#64748B]">Choose how your agent makes decisions, then fine-tune the advanced capabilities it can use.</p>
        </div>

        <div class="space-y-4">
          <!-- Run mode — the single canonical agent_run_mode (four options) -->
            <div class="grid gap-3 md:grid-cols-2">
            <button
              v-for="mode in runModes"
              :key="mode.key"
              class="mode-card"
              :class="runMode === mode.key ? 'mode-card-active' : ''"
              @click="selectMode(mode.key)"
            >
              <span class="flex items-start justify-between gap-3">
                <component :is="mode.icon" :size="26" :stroke-width="2" :class="mode.iconClass" />
                <span class="radio-dot" :class="executionMode === mode.key ? 'radio-dot-active' : ''" />
              </span>
              <span class="mt-3 block text-[15px] font-semibold text-[#0F172A]">{{ mode.title }}</span>
              <span class="mt-1 block text-[13px] leading-5 text-[#475569]">{{ mode.desc }}</span>
              <span v-if="mode.recommended" class="mt-3 inline-flex rounded-full bg-[#EAF0FF] px-3 py-1 text-[11px] font-bold text-[#2563EB]">Recommended</span>
            </button>
          </div>

          <!-- Advanced controls (Code Execution / Service Setup) -->
          <div class="border-t border-[#EEF1F5] pt-4">
            <p class="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">Controls &amp; limits</p>
            <div class="grid gap-3 md:grid-cols-2">
              <!-- Code Execution (was "Code Mode") -->
              <div class="rounded-xl border p-4 transition-colors" :class="codeModeEnabled ? 'border-violet-300 bg-gradient-to-r from-violet-50 to-indigo-50' : 'border-[#E5E7EB] bg-white'">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-600">
                      <Code2 :size="18" :stroke-width="2" />
                    </span>
                    <div>
                      <div class="text-[13.5px] font-semibold text-[#0F172A]">Code Execution</div>
                      <div class="mt-0.5 text-[12px] text-[#64748B]">Reach APIs by searching + running code instead of loading every tool.</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="codeModeEnabled"
                    @click="codeModeEnabled = !codeModeEnabled"
                    :class="['relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2', codeModeEnabled ? 'bg-violet-600' : 'bg-gray-300']"
                  >
                    <span :class="['inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform', codeModeEnabled ? 'translate-x-6' : 'translate-x-1']" />
                  </button>
                </div>
                <div v-if="codeModeEnabled" class="mt-3 border-t border-violet-200/60 pt-3">
                  <div class="flex items-start gap-2 text-[12px] text-[#475569]">
                    <span class="mt-0.5 text-violet-500">ℹ</span>
                    <div>
                      <p class="mb-1">The agent uses <strong>CODE_MODE_SEARCH</strong> to discover API endpoints and <strong>CODE_MODE_EXECUTE</strong> to run authenticated code — instead of loading hundreds of individual tools.</p>
                      <p class="text-[#94A3B8]">Reduces context window usage by ~90%. Requires valid service credentials.</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Service Setup (was "Builder Mode") -->
              <div class="rounded-xl border p-4 transition-colors" :class="serviceSetupEnabled ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50' : 'border-[#E5E7EB] bg-white'">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600">
                      <PlugZap :size="18" :stroke-width="2" />
                    </span>
                    <div>
                      <div class="text-[13.5px] font-semibold text-[#0F172A]">Service Setup</div>
                      <div class="mt-0.5 text-[12px] text-[#64748B]">Let the agent prompt users to connect services and register providers.</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="serviceSetupEnabled"
                    @click="serviceSetupEnabled = !serviceSetupEnabled"
                    :class="['relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2', serviceSetupEnabled ? 'bg-amber-500' : 'bg-gray-300']"
                  >
                    <span :class="['inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform', serviceSetupEnabled ? 'translate-x-6' : 'translate-x-1']" />
                  </button>
                </div>
                <div v-if="serviceSetupEnabled" class="mt-3 border-t border-amber-200/60 pt-3">
                  <div class="flex items-start gap-2 text-[12px] text-[#475569]">
                    <span class="mt-0.5 text-amber-500">ℹ</span>
                    <div>
                      <p class="mb-1">The agent can use <strong>SETUP_SERVICE_AUTH</strong> to prompt the user to connect a service (everyone), and <strong>REGISTER_OAUTH_PROVIDER</strong> to register new OAuth providers (admin only).</p>
                      <p class="text-[#94A3B8]">The agent never sees the actual credentials. New providers are created disabled until client credentials are added.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="mt-4 grid gap-4 xl:grid-cols-3">
      <!-- CARD 1 — Tool Permissions & Approvals (the tools chosen in Step 4) -->
      <section class="config-card xl:col-span-2">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <ShieldCheck :size="21" :stroke-width="2" />
          </span>
          <div>
            <h3 class="text-[15px] font-semibold text-[#0F172A]">Tool Permissions &amp; Approvals</h3>
            <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">Decide when this agent needs human approval for the tools you selected.</p>
          </div>
        </div>

        <label class="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] px-3 py-2">
          <span class="text-[12px] font-medium text-[#334155]">Require approval for actions above</span>
          <select v-model="riskCeiling" class="control !w-[140px] !py-1.5">
            <option value="low">Low impact</option>
            <option value="medium">Medium impact</option>
            <option value="high">High impact</option>
            <option value="critical">Critical only</option>
          </select>
        </label>

        <label class="mt-2 flex items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] px-3 py-2">
          <span class="text-[12px] font-medium text-[#334155]">Approval from</span>
          <select v-model="approverRole" class="control !w-[160px] !py-1.5">
            <option value="agent_owner">Agent owner</option>
            <option value="org_owner">Organization owners</option>
            <option value="workspace_admin">Workspace admins</option>
          </select>
        </label>

        <div class="mt-3 flex items-center justify-between">
          <p class="policy-sec !mb-0">Per-tool approval</p>
          <div v-if="toolTotalPages > 1" class="flex items-center gap-1.5">
            <button class="pg-btn" :disabled="toolPage <= 1" @click="toolPage--"><ChevronRight :size="13" class="rotate-180" /></button>
            <span class="text-[11px] text-[#64748B]">{{ toolPage }}/{{ toolTotalPages }}</span>
            <button class="pg-btn" :disabled="toolPage >= toolTotalPages" @click="toolPage++"><ChevronRight :size="13" /></button>
          </div>
        </div>
        <ul class="mt-1.5 min-h-[132px] divide-y divide-[#F2F4F7]">
          <li v-for="row in pagedSelectedRows" :key="row.key" class="flex items-center gap-2.5 py-1.5">
            <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#F1F5F9] text-[#64748B]"><Wrench :size="13" :stroke-width="2" /></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[12px] font-medium text-[#0F172A]">{{ row.label }}</span>
              <span class="block truncate text-[10px] text-[#98A2B3]">{{ row.name }}</span>
            </span>
            <span v-if="row.locked" class="perm-locked"><Lock :size="11" :stroke-width="2.4" /> Blocked</span>
            <select v-else class="control !w-[132px] !py-1" :value="row.agent" @change="setAgentToolPerm(row.key, $event.target.value)">
              <option value="">{{ row.org === 'ask' ? 'Inherit · Ask' : 'Inherit · Allow' }}</option>
              <option value="ask">Ask approval</option>
              <option value="deny">Block</option>
            </select>
          </li>
          <li v-if="!selectedToolRows.length" class="py-6 text-center text-[12px] text-[#98A2B3]">
            No tools selected yet — pick tools in the <button class="link-btn inline" @click="go(`/dashboard/agents/${agent.id}/editor`)">Knowledge &amp; Tools</button> step first.
          </li>
        </ul>

        <div class="mt-4 border-t border-[#F2F4F7] pt-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="prev-chip bg-amber-50 text-amber-600">{{ previewStats.by.ask || 0 }} approval</span>
              <span class="prev-chip bg-red-50 text-red-600">{{ previewStats.by.block || 0 }} blocked</span>
              <span class="text-[11px] text-[#98A2B3]">· {{ previewStats.total }} agent rule(s)</span>
            </div>
            <div class="flex items-center gap-3">
              <button class="link-btn" @click="go(`/dashboard/agents/${agent.id}/guardrails`)">Manage guardrails <ChevronRight :size="14" /></button>
              <button class="link-btn" @click="openRulesModal">View all rules <ChevronRight :size="15" /></button>
            </div>
          </div>
        </div>
      </section>

      <!-- CARD 2 — Guardrails (boundaries the agent must always follow) -->
      <section class="config-card">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck :size="21" :stroke-width="2" />
          </span>
          <div>
            <h3 class="text-[15px] font-semibold text-[#0F172A]">Guardrails</h3>
            <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">Boundaries the agent must always follow.</p>
          </div>
        </div>

        <p class="mt-3 rounded-lg bg-[#F8FAFC] px-3 py-2 text-[11px] leading-5 text-[#64748B]">
          Org policy is the safety floor — agent rules can only make it <strong>stricter</strong>, never weaker.
        </p>

        <p class="mt-4 text-[11.5px] leading-5 text-[#64748B]">
          Behavioral rules, blocked tools, external-write control, approvals, checkpoints and escalation
          are managed on the agent’s dedicated Guardrails page.
        </p>
        <button class="link-btn mt-3" @click="go(`/dashboard/agents/${agent.id}/guardrails`)">Manage guardrails <ChevronRight :size="14" /></button>
      </section>

    </div>

    <div class="mt-4 grid gap-4 xl:grid-cols-2">
      <section class="config-card">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">
            <CircleDollarSign :size="21" :stroke-width="2" />
          </span>
          <div>
            <h3 class="text-[15px] font-semibold text-[#0F172A]">Spending Limits</h3>
            <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">Cap how much this agent can spend. Enforced by Budgets.</p>
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <label class="field-row">
            <span>Per day</span>
            <div class="money-input"><span>$</span><input v-model="budgetPerDay" class="control !pl-5" inputmode="decimal" placeholder="No limit" /></div>
          </label>
        </div>

        <div class="mt-4 flex items-center justify-between border-t border-[#F2F4F7] pt-3">
          <button class="link-btn" @click="go('/dashboard/budgets')">Budgets <ChevronRight :size="14" /></button>
          <button class="save-limit" :disabled="budgetSaving || !agent.id" @click="saveAgentBudget">{{ budgetSaving ? 'Saving…' : 'Save limit' }}</button>
        </div>
      </section>

      <section class="config-card">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <ClipboardCheck :size="21" :stroke-width="2" />
          </span>
          <div>
            <h3 class="text-[15px] font-semibold text-[#0F172A]">Action Limits</h3>
            <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">Limit how often the agent can take actions.</p>
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <label class="field-row">
            <span>Max steps
              <small class="block text-[11px] font-normal text-[#94A3B8]">Max number of tool steps the agent may take in one run (default {{ DEFAULT_MAX_STEPS }}).</small>
            </span>
            <span class="flex flex-col items-end">
              <input v-model="maxActionsPerRun" class="control" type="number" min="1" :max="actionsCeiling"
                     :placeholder="`Default (${DEFAULT_MAX_STEPS})`" />
              <small class="mt-1 text-[11px] text-[#94A3B8]">Platform limit: {{ actionsCeiling }}</small>
            </span>
          </label>
          <label class="field-row">
            <span>Max runs per day</span>
            <input v-model="maxRunsPerDay" class="control" type="number" min="1" placeholder="Unlimited" />
          </label>
        </div>

        <button class="link-btn mt-5" @click="openUsageModal">View usage <ChevronRight :size="15" /></button>
      </section>
    </div>

    <div class="mt-4">
      <section class="config-card">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Sparkles :size="21" :stroke-width="2" />
          </span>
          <div>
            <h3 class="text-[15px] font-semibold text-[#0F172A]">Autonomy Summary</h3>
            <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">A plain-language summary of how your agent will operate.</p>
          </div>
        </div>

        <div class="mt-4 rounded-xl bg-[#EEF4FF] p-5 text-[13px] leading-6 text-[#344054]">
          <p>Your agent will <strong class="text-[#2563EB]">{{ summaryMode }}</strong>.</p>
          <p>It can spend up to <strong class="text-[#2563EB]">{{ budgetPerDay ? '$' + budgetPerDay : 'unlimited' }}</strong> per day.</p>
          <p>It will follow <strong class="text-[#2563EB]">{{ activeGuardrailCount }} guardrails</strong> and ask for approval on <strong class="text-[#0F172A]">{{ riskCeiling }}</strong> impact actions.</p>
          <p>It can take up to <strong class="text-[#2563EB]">{{ maxActionsPerRun || DEFAULT_MAX_STEPS }} steps per run</strong> and <strong class="text-[#2563EB]">{{ maxRunsPerDay || 'unlimited' }} runs per day</strong>.</p>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span class="inline-flex items-center gap-2 rounded-lg bg-[#E6F7EE] px-3 py-2 text-[13px] font-semibold text-[#027A48]">
            <CheckCircle2 :size="16" :stroke-width="2.4" /> Configuration looks good
          </span>
          <button class="test-btn" @click="go(`/dashboard/agents/${agent.id}/monitor`)">
            <Play :size="15" :stroke-width="2" /> Test these settings
          </button>
        </div>
      </section>
    </div>
    <!-- Action usage — effective limits + real activity (TurnTelemetry) -->
    <Teleport to="body">
      <div v-if="usageModalOpen" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-5 py-8 backdrop-blur-sm" @click.self="usageModalOpen = false">
        <section class="flex max-h-[86vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="flex items-center justify-between gap-4 border-b border-[#F1F5F9] px-6 py-4">
            <div>
              <h3 class="text-[17px] font-bold text-[#0F172A]">Action usage</h3>
              <p class="text-[12.5px] text-[#64748B]">Effective limits and recent activity for this agent.</p>
            </div>
            <button class="rules-close" aria-label="Close" @click="usageModalOpen = false"><X :size="20" :stroke-width="1.8" /></button>
          </header>
          <div class="flex-1 overflow-y-auto px-6 py-5">
            <div v-if="usageLoading" class="py-10 text-center text-[13px] text-[#98A2B3]">Loading usage…</div>
            <div v-else-if="!usage" class="py-10 text-center text-[13px] text-[#98A2B3]">No usage recorded yet. Run the agent to see activity.</div>
            <template v-else>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div class="stat">
                  <p class="stat-k">Max steps / run</p>
                  <p class="stat-v">{{ usage.limits.max_steps.effective }}</p>
                  <span class="src" :class="usage.limits.max_steps.source === 'agent' ? 'src-a' : 'src-d'">{{ usage.limits.max_steps.source === 'agent' ? 'This agent' : 'Default' }}</span>
                </div>
                <div class="stat">
                  <p class="stat-k">Max runs / day</p>
                  <p class="stat-v">{{ usage.limits.max_runs_per_day.unlimited ? 'Unlimited' : usage.limits.max_runs_per_day.effective }}</p>
                  <span class="src" :class="usage.limits.max_runs_per_day.source === 'agent' ? 'src-a' : 'src-d'">{{ usage.limits.max_runs_per_day.source === 'agent' ? 'This agent' : 'Default' }}</span>
                </div>
                <div class="stat">
                  <p class="stat-k">Runs today</p>
                  <p class="stat-v">{{ usage.today.runs }}<span v-if="usage.today.runs_remaining != null" class="text-[12px] font-medium text-[#98A2B3]"> · {{ usage.today.runs_remaining }} left</span></p>
                </div>
                <div class="stat">
                  <p class="stat-k">Avg actions / run</p>
                  <p class="stat-v">{{ usage.today.avg_actions }}</p>
                </div>
                <div class="stat">
                  <p class="stat-k">Peak actions</p>
                  <p class="stat-v">{{ usage.today.max_actions }}</p>
                </div>
              </div>

              <div class="mt-5 flex items-center justify-between">
                <p class="policy-sec !mb-0">Recent runs <span class="font-normal normal-case text-[#98A2B3]">({{ usage.recent_total }})</span></p>
                <div v-if="usageTotalPages > 1" class="flex items-center gap-1.5">
                  <button class="pg-btn" :disabled="usagePage <= 1 || usageLoading" @click="loadUsage(usagePage - 1)"><ChevronRight :size="13" class="rotate-180" /></button>
                  <span class="text-[11px] text-[#64748B]">{{ usagePage }}/{{ usageTotalPages }}</span>
                  <button class="pg-btn" :disabled="usagePage >= usageTotalPages || usageLoading" @click="loadUsage(usagePage + 1)"><ChevronRight :size="13" /></button>
                </div>
              </div>
              <ul class="mt-2 divide-y divide-[#F2F4F7]">
                <li v-for="(r, i) in usage.recent" :key="i" class="flex items-center gap-3 py-2 text-[12px]">
                  <span class="w-[104px] shrink-0 text-[#98A2B3]">{{ fmtWhen(r.at) }}</span>
                  <span class="flex-1 truncate text-[#334155]">{{ r.stop_reason || 'completed' }}</span>
                  <span class="shrink-0 text-[#98A2B3]">{{ fmtDur(r.duration_ms) }}</span>
                  <span class="w-[92px] shrink-0 text-right font-semibold" :class="r.over_cap ? 'text-red-600' : 'text-[#0F172A]'">{{ r.actions }} action{{ r.actions === 1 ? '' : 's' }}</span>
                </li>
                <li v-if="!usage.recent.length" class="py-4 text-center text-[12px] text-[#98A2B3]">No runs yet.</li>
              </ul>
            </template>
          </div>
          <footer class="flex items-center justify-end gap-3 border-t border-[#F1F5F9] px-6 py-4">
            <button class="rules-secondary" @click="usageModalOpen = false">Close</button>
          </footer>
        </section>
      </div>
    </Teleport>

    <!-- View all approval rules — the agent's complete effective policy, paginated -->
    <Teleport to="body">
      <div v-if="rulesModalOpen" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-5 py-8 backdrop-blur-sm" @click.self="rulesModalOpen = false">
        <section class="flex max-h-[86vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="flex items-center justify-between gap-4 border-b border-[#F1F5F9] px-6 py-4">
            <div>
              <h3 class="text-[17px] font-bold text-[#0F172A]">Approval &amp; guardrail rules</h3>
              <p class="text-[12.5px] text-[#64748B]">This agent's own rules — {{ allRules.length }} rule(s).</p>
            </div>
            <button class="rules-close" aria-label="Close" @click="rulesModalOpen = false"><X :size="20" :stroke-width="1.8" /></button>
          </header>
          <div class="flex-1 divide-y divide-[#F1F5F9] overflow-y-auto">
            <div v-if="rulesLoading" class="px-6 py-10 text-center text-[13px] text-[#98A2B3]">Loading rules…</div>
            <div v-else-if="!allRules.length" class="px-6 py-10 text-center text-[13px] text-[#98A2B3]">No agent-specific rules yet.</div>
            <div v-for="(r, i) in pagedRules" :key="i" class="flex items-start gap-3 px-6 py-3">
              <span class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" :class="ruleKindClass(r.kind)"><ShieldCheck :size="16" :stroke-width="2" /></span>
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-medium text-[#0F172A]">{{ r.label }}</p>
                <p v-if="r.detail" class="text-[11.5px] text-[#98A2B3]">{{ r.detail }}</p>
                <p class="mt-0.5 text-[10.5px] text-[#B0B7C3]">key: {{ r.key }}</p>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-1">
                <span class="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" :class="ruleKindClass(r.kind)">{{ actionLabel(r.action) }}</span>
                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-500">{{ r.source }}</span>
              </div>
            </div>
          </div>
          <footer class="flex items-center justify-between gap-3 border-t border-[#F1F5F9] px-6 py-4">
            <div v-if="rulesTotalPages > 1" class="flex items-center gap-1.5">
              <button class="rules-pg" :disabled="rulesPage <= 1" @click="rulesPage--"><ChevronRight :size="14" class="rotate-180" /></button>
              <span class="text-[12px] text-[#64748B]">Page {{ rulesPage }} of {{ rulesTotalPages }}</span>
              <button class="rules-pg" :disabled="rulesPage >= rulesTotalPages" @click="rulesPage++"><ChevronRight :size="14" /></button>
            </div>
            <span v-else class="text-[12px] text-[#98A2B3]">{{ allRules.length }} rule(s)</span>
            <button class="rules-secondary" @click="rulesModalOpen = false">Close</button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Code2,
  Hand,
  ListChecks,
  Lock,
  Play,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-vue-next'
import api from '../../services/api'
import { normalizeRunMode, isAutonomous, isPlanReview } from '../../composables/agentModes'

const props = defineProps({ agent: { type: Object, required: true } })
const router = useRouter()
const go = (to) => router.push(to)

const effectiveGuardrails = ref([])
// "View all rules" modal — the agent's complete EFFECTIVE policy (risk ceiling + external-write +
// forbidden tools + per-tool ask/deny + guardrails), paginated 10 per page.
const allRules = ref([])
const rulesModalOpen = ref(false)
const rulesLoading = ref(false)
const RULES_PAGE_SIZE = 10
const rulesPage = ref(1)
const rulesTotalPages = computed(() => Math.max(1, Math.ceil(allRules.value.length / RULES_PAGE_SIZE)))
const pagedRules = computed(() => allRules.value.slice((rulesPage.value - 1) * RULES_PAGE_SIZE, rulesPage.value * RULES_PAGE_SIZE))
function openRulesModal() {
  rulesPage.value = 1
  rulesModalOpen.value = true
  if (!allRules.value.length && props.agent.id) {
    rulesLoading.value = true
    loadGuardrails().finally(() => { rulesLoading.value = false })
  }
}
function ruleKindClass(kind) {
  if (kind === 'block') return 'bg-red-50 text-red-600'
  if (kind === 'approval') return 'bg-amber-50 text-amber-600'
  if (kind === 'behavioral') return 'bg-violet-50 text-violet-600'
  return 'bg-slate-100 text-slate-500'
}
function actionLabel(action) {
  return { ask: 'Ask approval', block: 'Block', guardrail: 'Guardrail', allow: 'Allow' }[action] || action
}

const runModes = [
  { key: 'manual', title: 'Manual', desc: 'Agent asks every time before taking action.', icon: Hand, iconClass: 'text-violet-600' },
  { key: 'autonomous', title: 'Autonomous', desc: 'Agent acts automatically within defined guardrails.', icon: Zap, iconClass: 'text-emerald-600' },
  { key: 'plan_review_manual', title: 'Plan review → Manual', desc: 'Agent plans, you approve the plan, then approve each action.', icon: ListChecks, iconClass: 'text-[#2563EB]', recommended: true },
  { key: 'plan_review_autonomous', title: 'Plan review → Autonomous', desc: 'Agent plans (reviewed automatically), then runs autonomously.', icon: ListChecks, iconClass: 'text-emerald-600' },
]
const policy = computed({
  get() {
    if (!props.agent.agent_policy || typeof props.agent.agent_policy !== 'object' || Array.isArray(props.agent.agent_policy)) {
      props.agent.agent_policy = {}
    }
    return props.agent.agent_policy
  },
  set(value) {
    props.agent.agent_policy = value
  },
})

const runMode = computed({
  get: () => normalizeRunMode(props.agent.agent_run_mode),
  set: (value) => { props.agent.agent_run_mode = normalizeRunMode(value) },
})
const riskCeiling = computed({
  get: () => policy.value.risk_ceiling || 'high',
  set: (value) => { policy.value = { ...policy.value, risk_ceiling: value } },
})
// Approval routing — who approves when an action is gated (agent_policy.approver_role).
const approverRole = computed({
  get: () => policy.value.approver_role || 'agent_owner',
  set: (value) => { policy.value = { ...policy.value, approver_role: value } },
})
// Behavioral guardrails are now edited on the dedicated Guardrails page; step 5 only SUMMARIZES them.
// Legacy opaque keys map to sentences on read so old data displays as readable rules.
const GUARDRAIL_KEY_MAP = {
  no_external_email: 'Do not send external emails',
  no_pricing_changes: 'Do not modify pricing',
  respect_privacy: 'Respect data privacy policies',
}
const normGuardrail = (g) => GUARDRAIL_KEY_MAP[g] || g
const agentGuardrailsList = computed(() => (policy.value.guardrails || []).map(normGuardrail))
// Effective-policy preview counts (from the merged rules loaded via loadGuardrails).
const previewStats = computed(() => {
  const by = {}, src = {}
  for (const r of allRules.value) { by[r.action] = (by[r.action] || 0) + 1; src[r.source] = (src[r.source] || 0) + 1 }
  return { by, src, total: allRules.value.length }
})

// ── Per-agent Tool Permissions (tighten-only against the org floor) ──
const orgToolPerms = ref({})   // { TOOL: allow|ask|deny } — the org floor (loaded from the endpoint)
const _PERM_RANK = { allow: 0, ask: 1, deny: 2 }
const agentToolPerms = computed(() => policy.value.tool_permissions || {})
const permToolRows = computed(() => {
  const names = new Set([...Object.keys(orgToolPerms.value || {}), ...Object.keys(agentToolPerms.value || {})])
  return [...names].sort().map(tool => {
    const org = String(orgToolPerms.value[tool] || '').toLowerCase()     // '', allow, ask, deny
    const agent = String(agentToolPerms.value[tool] || '').toLowerCase() // '', ask, deny (inherit = '')
    const o = _PERM_RANK[org] ?? 0
    const a = _PERM_RANK[agent] ?? 0
    const eff = a >= o ? (agent || 'allow') : (org || 'allow')           // stricter wins
    return { tool, org, agent, locked: org === 'deny', effective: eff }
  })
})
function setAgentToolPerm(tool, value) {
  const org = String(orgToolPerms.value[tool] || '').toLowerCase()
  if (org === 'deny') return                                    // org floor locks it — cannot change
  const v = String(value || '').toLowerCase()
  const cur = { ...(policy.value.tool_permissions || {}) }
  // Never let the agent WEAKEN the floor: only 'ask'/'deny' (tighten) or '' (inherit) are stored.
  if (v === 'ask' || v === 'deny') cur[tool] = v
  else delete cur[tool]                                         // inherit
  policy.value = { ...policy.value, tool_permissions: cur }
}
const newPermTool = ref('')
const newPermValue = ref('ask')
const showAddPerm = ref(false)
function addAgentPerm() {
  const t = newPermTool.value.trim().toUpperCase()
  newPermTool.value = ''
  if (!t) return
  setAgentToolPerm(t, newPermValue.value)
}

// ── Resolve the tools the user selected in Step 4 (agent.tool_ids) so Card 1 lists THOSE tools ──
const toolDefsById = ref({})
async function loadToolDefs() {
  try {
    let all = [], next = '/tools/definitions/', guard = 0
    while (next && guard++ < 60) {
      const r = await api.get(next)
      const d = r.data
      if (Array.isArray(d)) { all = all.concat(d); break }
      all = all.concat(d.results || [])
      if (d.next) { const u = new URL(d.next, window.location.origin); next = u.pathname.replace(/^\/api/, '') + u.search }
      else next = null
    }
    const map = {}
    for (const t of all) map[t.id] = t
    toolDefsById.value = map
  } catch (e) { toolDefsById.value = {} }
}
const selectedTools = computed(() => (props.agent.tool_ids || []).map(id => toolDefsById.value[id]).filter(Boolean))
function _permRow(name, label) {
  const key = String(name).toUpperCase()
  return {
    key, name, label: label || name,
    org: String(orgToolPerms.value[key] || '').toLowerCase(),
    agent: String(agentToolPerms.value[key] || '').toLowerCase(),
    locked: String(orgToolPerms.value[key] || '').toLowerCase() === 'deny',
  }
}
const selectedToolRows = computed(() => selectedTools.value.map(t => _permRow(t.name, t.display_name || t.name)))
// Paginate the per-tool list at 3 rows/page (keeps the card compact).
const TOOL_PAGE_SIZE = 3
const toolPage = ref(1)
const toolTotalPages = computed(() => Math.max(1, Math.ceil(selectedToolRows.value.length / TOOL_PAGE_SIZE)))
const pagedSelectedRows = computed(() => {
  const start = (toolPage.value - 1) * TOOL_PAGE_SIZE
  return selectedToolRows.value.slice(start, start + TOOL_PAGE_SIZE)
})
// Any tool rules set on tools NOT in the selected set (don't hide existing rules).
const extraPermRows = computed(() => {
  const sel = new Set(selectedTools.value.map(t => String(t.name).toUpperCase()))
  return Object.keys(agentToolPerms.value || {}).filter(k => !sel.has(k)).map(k => _permRow(k, k))
})
const maxCostPerRun = computed({
  get: () => formatMoneyInput(props.agent.max_cost_per_run_usd ?? '500.00'),
  set: (value) => { props.agent.max_cost_per_run_usd = parseMoney(value) },
})
const dailyBudget = computed({
  get: () => formatMoneyInput(props.agent.daily_budget_usd ?? '2000.00'),
  set: (value) => { props.agent.daily_budget_usd = parseMoney(value) },
})
// Platform ceiling for "max actions per run" (= max steps / tool iterations). Model B: the agent may only
// TIGHTEN below the platform ceiling; when the platform admin set nothing, that ceiling IS the absolute
// default (500). The platform value may itself exceed the absolute (admin is unbounded), so the agent cap
// = the platform value if set, else the absolute default.
const DEFAULT_MAX_STEPS = 250          // default steps when the agent sets no explicit value
const PLATFORM_CEILING_DEFAULT = 500   // absolute platform ceiling fallback when nothing is set
const actionsCeiling = ref(PLATFORM_CEILING_DEFAULT)
async function loadPlatformLimits() {
  try {
    const r = await api.getGlobalAgentPolicy()
    const pol = r.data?.llm_policy || {}
    const abs = r.data?.llm_policy_absolute || {}
    const absMax = Number(abs.max_steps) || PLATFORM_CEILING_DEFAULT
    // Platform value wins as the ceiling; if unset the absolute default applies. Agent tightens below this.
    actionsCeiling.value = Number(pol.max_steps) || absMax
    // If a stored agent value exceeds the ceiling, clamp it down so the editor never shows an over-limit
    // number that the backend would reduce at runtime.
    const cur = Number(policy.value.max_steps)
    if (Number.isFinite(cur) && cur > actionsCeiling.value) _setLimit('max_steps', actionsCeiling.value, actionsCeiling.value)
  } catch (e) { /* keep safe defaults */ }
}
// Empty = inherit the system default (env fallback). Only a positive number is stored as an override.
// `max` (when given) clamps the value so a user can never store more than the platform/absolute ceiling.
function _setLimit(key, value, max) {
  const n = Number(value)
  const p = { ...policy.value }
  if (Number.isFinite(n) && n > 0) p[key] = (max && n > max) ? max : n
  else delete p[key]
  policy.value = p
}
const maxActionsPerRun = computed({
  // max_steps is the only step-cap key.
  get: () => policy.value.max_steps ?? '',
  set: (value) => _setLimit('max_steps', value, actionsCeiling.value),
})
const maxRunsPerDay = computed({
  get: () => policy.value.max_runs_per_day ?? '',
  set: (value) => _setLimit('max_runs_per_day', value),
})
// Advanced execution controls (mapped from the legacy "Code Mode" / "Builder Mode" fields).
const codeModeEnabled = computed({
  get: () => !!props.agent.code_mode_enabled,
  set: (value) => { props.agent.code_mode_enabled = value },
})
const serviceSetupEnabled = computed({
  get: () => !!props.agent.builder_mode_enabled,
  set: (value) => { props.agent.builder_mode_enabled = value },
})
const activeGuardrailCount = computed(() => Math.max(agentGuardrailsList.value.length, effectiveGuardrails.value.length))
const summaryMode = computed(() => {
  if (isPlanReview(runMode.value)) {
    return isAutonomous(runMode.value)
      ? 'plan first, then run autonomously'
      : 'plan before acting and wait for approval'
  }
  if (isAutonomous(runMode.value)) return 'act automatically within guardrails'
  return 'ask before every action'
})

function selectMode(value) {
  runMode.value = value
}
function parseMoney(value) {
  const n = Number(String(value).replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n.toFixed(2) : null
}
function formatMoneyInput(value) {
  if (value === null || value === undefined || value === '') return ''
  return String(value).startsWith('$') ? String(value) : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function moneyLabel(value) {
  return value || '$0.00'
}
async function loadGuardrails() {
  if (!props.agent.id) return
  try {
    const res = await api.getAgentGuardrails(props.agent.id)
    effectiveGuardrails.value = res.data?.guardrails || []
    allRules.value = res.data?.rules || []
    orgToolPerms.value = res.data?.org_tool_permissions || {}
  } catch (e) {
    effectiveGuardrails.value = []
    allRules.value = []
    orgToolPerms.value = {}
  }
}

// ── Spending limits — wired to the Budget system (agent-scoped Budget), not the agent record ──
const budgetId = ref(null)
const budgetPerDay = ref('')     // daily_limit_usd
const budgetSaving = ref(false)
function _money(v) {
  const s = String(v ?? '').replace(/[$,\s]/g, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}
async function loadAgentBudget() {
  if (!props.agent.id) return
  try {
    const r = await api.getBudgets()
    const list = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.budgets || [])
    const b = (list || []).find(x => x.scope_type === 'agent' && String(x.scope_id) === String(props.agent.id))
    if (b) {
      budgetId.value = b.id
      budgetPerDay.value = b.daily_limit_usd != null ? String(b.daily_limit_usd) : ''
    } else {
      budgetId.value = null; budgetPerDay.value = ''
    }
  } catch (e) { /* budgets optional — never block the step */ }
}
async function saveAgentBudget() {
  if (!props.agent.id || budgetSaving.value) { if (!props.agent.id) notify.info('Save the agent first, then set its spending limit.'); return }
  budgetSaving.value = true
  try {
    // POST upserts the single enabled budget for (org, scope_type=agent, scope_id=agent.id).
    const r = await api.createBudget({
      scope_type: 'agent', scope_id: props.agent.id, name: `${props.agent.name || 'Agent'} spend limit`,
      daily_limit_usd: _money(budgetPerDay.value),
    })
    if (r.data?.id) budgetId.value = r.data.id
    notify.success('Spending limit saved')
  } catch (e) {
    notify.error(e.response?.status === 403 ? 'You need budget-manage permission for this organization' : 'Could not save spending limit')
  } finally { budgetSaving.value = false }
}

// ── Action-limit usage modal (real data from TurnTelemetry via the backend) ──
const usageModalOpen = ref(false)
const usageLoading = ref(false)
const usage = ref(null)
const USAGE_PAGE_SIZE = 10
const usagePage = ref(1)
const usageTotalPages = computed(() => Math.max(1, Math.ceil((usage.value?.recent_total || 0) / USAGE_PAGE_SIZE)))
async function loadUsage(page = 1) {
  if (!props.agent.id) { usage.value = null; return }
  usageLoading.value = true
  try {
    const r = await api.getAgentActionUsage(props.agent.id, { limit: USAGE_PAGE_SIZE, offset: (page - 1) * USAGE_PAGE_SIZE })
    usage.value = r.data; usagePage.value = page
  } catch (e) { usage.value = null }
  finally { usageLoading.value = false }
}
function openUsageModal() { usageModalOpen.value = true; loadUsage(1) }
function fmtWhen(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch (e) { return '' }
}
function fmtDur(ms) { if (!ms) return '—'; return ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms' }

watch(() => props.agent.id, () => { loadGuardrails(); loadAgentBudget() })
onMounted(() => { loadGuardrails(); loadToolDefs(); loadAgentBudget(); loadPlatformLimits() })
</script>

<style scoped>
.legacy-safety-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.legacy-safety-card {
  min-height: 148px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 16px 18px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, .05);
}

.legacy-card-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.legacy-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 9px;
}

.legacy-icon.violet {
  background: #f2efff;
  color: #6d5dfc;
}

.legacy-icon.green {
  background: #e7fbf1;
  color: #10b981;
}

.legacy-card-head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 13.5px;
  font-weight: 850;
}

.legacy-card-head p {
  margin: 3px 0 0;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.35;
}

.legacy-form {
  display: grid;
  gap: 9px;
  margin-top: 14px;
}

.legacy-form label {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.legacy-form label > span {
  color: #475569;
  font-size: 11px;
  font-weight: 750;
}

.legacy-select {
  height: 32px;
  width: 100%;
  border: 1px solid #d8e2f0;
  border-radius: 8px;
  background: #fff;
  padding: 0 10px;
  color: #334155;
  font-size: 11.5px;
  font-weight: 700;
  outline: none;
}

.legacy-select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px #eaf0ff;
}

.legacy-guardrails {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.legacy-guardrails li {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #334155;
  font-size: 11.5px;
  font-weight: 600;
}

.legacy-guardrails li span {
  display: grid;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 999px;
  background: #10b981;
  color: #fff;
}

.legacy-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 14px;
  border: 0;
  background: transparent;
  padding: 0;
  color: #2563eb;
  font-size: 11.5px;
  font-weight: 850;
}

.guide-btn { display: inline-flex; align-items: center; gap: 8px; height: 42px; border: 1px solid #D9E0EA; border-radius: 10px; background: #fff; padding: 0 16px; font-size: 13px; font-weight: 700; color: #344054; box-shadow: 0 1px 2px rgba(16,24,40,.03); }
.rules-close { display: grid; height: 36px; width: 36px; place-items: center; border: 0; border-radius: 10px; color: #475569; background: #fff; }
.rules-close:hover { background: #F1F5F9; color: #0F172A; }
.rules-pg { display: grid; place-items: center; height: 28px; width: 28px; border: 1px solid #E5E7EB; border-radius: 8px; color: #475569; background: #fff; }
.rules-pg:hover:not(:disabled) { border-color: #2563EB; color: #2563EB; }
.rules-pg:disabled { opacity: .4; cursor: not-allowed; }
.rules-secondary { height: 38px; border: 1px solid #D9E0EA; border-radius: 9px; background: #fff; padding: 0 20px; font-size: 13px; font-weight: 700; color: #344054; }
.rules-secondary:hover { border-color: #CBD5E1; color: #0F172A; }
.policy-sec { font-size: 10.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #94A3B8; margin-bottom: 10px; }
.chip-x { display: inline-flex; align-items: center; gap: 5px; height: 24px; border: 0; border-radius: 6px; background: #FEF2F2; color: #DC2626; padding: 0 8px; font-size: 11px; font-weight: 700; cursor: pointer; }
.chip-x:hover { background: #FEE2E2; }
.mini-add { display: grid; place-items: center; height: 30px; width: 32px; flex-shrink: 0; border: 1px solid #E5E7EB; border-radius: 8px; background: #fff; color: #2563EB; cursor: pointer; }
.mini-add:hover { border-color: #2563EB; }
.prev-chip { border-radius: 999px; padding: 3px 9px; font-size: 11px; font-weight: 700; }
.perm-locked { display: inline-flex; align-items: center; gap: 5px; border-radius: 6px; background: #FEF2F2; color: #DC2626; padding: 3px 9px; font-size: 11px; font-weight: 700; }
.stat { border: 1px solid #EEF2F7; border-radius: 10px; background: #FAFBFF; padding: 10px 12px; }
.stat-k { font-size: 10.5px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .03em; }
.stat-v { margin-top: 3px; font-size: 18px; font-weight: 800; color: #0F172A; }
.src { display: inline-block; margin-top: 4px; border-radius: 999px; padding: 1px 7px; font-size: 10px; font-weight: 700; }
.src-a { background: #EDE9FE; color: #6D28D9; }
.src-d { background: #F1F5F9; color: #64748B; }
.pg-btn { display: grid; place-items: center; height: 24px; width: 24px; border: 1px solid #E5E7EB; border-radius: 7px; color: #475569; background: #fff; }
.pg-btn:hover:not(:disabled) { border-color: #2563EB; color: #2563EB; }
.pg-btn:disabled { opacity: .4; cursor: not-allowed; }
.money-input { position: relative; display: inline-block; }
.money-input > span { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 12.5px; font-weight: 700; color: #98A2B3; pointer-events: none; }
.save-limit { height: 32px; border: 0; border-radius: 8px; background: #2563EB; color: #fff; padding: 0 16px; font-size: 12px; font-weight: 700; cursor: pointer; }
.save-limit:hover:not(:disabled) { background: #1D4ED8; }
.save-limit:disabled { opacity: .5; cursor: not-allowed; }
.mode-card { min-height: 132px; border: 1px solid #E5E7EB; border-radius: 12px; background: #fff; padding: 16px; text-align: left; transition: border-color .15s, box-shadow .15s, background .15s; }
.mode-card:hover { border-color: #BFD0FF; box-shadow: 0 8px 20px rgba(16,24,40,.06); }
.mode-card-active { border-color: #2563EB; box-shadow: 0 0 0 1px #2563EB, 0 10px 24px rgba(37,99,235,.08); }
.radio-dot { height: 17px; width: 17px; border-radius: 999px; border: 1.5px solid #98A2B3; background: #fff; }
.radio-dot-active { border: 5px solid #2563EB; }
.config-card { border: 1px solid #E5E7EB; border-radius: 12px; background: #fff; padding: 18px; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
.field-row { display: grid; grid-template-columns: minmax(120px, .78fr) minmax(0, 1.22fr); align-items: center; gap: 16px; font-size: 13px; font-weight: 500; color: #475569; }
.control { height: 38px; width: 100%; border: 1px solid #D0D5DD; border-radius: 8px; background: #fff; padding: 0 12px; font-size: 13px; font-weight: 600; color: #344054; outline: none; box-shadow: 0 1px 2px rgba(16,24,40,.03); }
.control:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
.check-row { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 500; color: #475569; }
.check-row input { height: 16px; width: 16px; accent-color: #12B76A; }
.link-btn { display: inline-flex; align-items: center; gap: 5px; color: #2563EB; font-size: 13px; font-weight: 700; }
.test-btn { display: inline-flex; align-items: center; gap: 7px; height: 40px; border: 1px solid #D9E0EA; border-radius: 10px; background: #fff; padding: 0 16px; color: #2563EB; font-size: 13px; font-weight: 700; }
@media (max-width: 720px) {
  .legacy-safety-grid { grid-template-columns: 1fr; }
  .legacy-form label { grid-template-columns: 1fr; gap: 6px; }
  .field-row { grid-template-columns: 1fr; gap: 7px; }
}
</style>
