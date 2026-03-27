<template>
  <div class="automation-dashboard">
    <!-- Header -->
    <div class="ad-header">
      <div class="ad-header-content">
        <div class="ad-title-group">
          <h1 class="ad-title">
            <svg class="ad-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
            Automation
          </h1>
          <p class="ad-subtitle">Workflows, schedules, scripts & execution history</p>
        </div>
        <div class="ad-header-actions">
          <button class="ad-btn ad-btn-primary" @click="showCreateWorkflow = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg>
            New Workflow
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="ad-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="ad-tab"
          :class="{ 'ad-tab-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <svg class="ad-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="tab.icon"></svg>
          {{ tab.label }}
          <span v-if="tab.count !== null" class="ad-tab-count">{{ tab.count }}</span>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="ad-content">

      <!-- WORKFLOWS TAB -->
      <div v-if="activeTab === 'workflows'" class="ad-panel">
        <div v-if="loading.workflows" class="ad-loading">
          <div class="ad-spinner"></div>
          <span>Loading workflows...</span>
        </div>
        <div v-else-if="workflows.length === 0" class="ad-empty">
          <svg class="ad-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
          </svg>
          <h3>No workflows yet</h3>
          <p>Create your first workflow to automate repetitive tasks.</p>
          <button class="ad-btn ad-btn-primary" @click="showCreateWorkflow = true">Create Workflow</button>
        </div>
        <div v-else class="ad-grid">
          <div v-for="wf in workflows" :key="wf.id" class="ad-card">
            <div class="ad-card-header">
              <div class="ad-card-title-row">
                <h3 class="ad-card-title">{{ wf.name }}</h3>
                <span class="ad-badge" :class="'ad-badge-' + wf.category">{{ wf.category }}</span>
              </div>
              <div class="ad-card-meta">
                <span>{{ wf.execution_count || 0 }} runs</span>
                <span>•</span>
                <span>{{ wf.schedule_count || 0 }} schedules</span>
              </div>
            </div>
            <div class="ad-card-body">
              <pre class="ad-card-prompt">{{ wf.prompt?.substring(0, 200) }}{{ wf.prompt?.length > 200 ? '...' : '' }}</pre>
            </div>
            <div class="ad-card-actions">
              <button class="ad-btn ad-btn-sm ad-btn-primary" @click="runWorkflow(wf)">
                ▶ Run
              </button>
              <button class="ad-btn ad-btn-sm ad-btn-ghost" @click="editWorkflow(wf)">
                Edit
              </button>
              <button class="ad-btn ad-btn-sm ad-btn-ghost ad-btn-danger" @click="deleteWorkflow(wf)">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- SCHEDULES TAB -->
      <div v-if="activeTab === 'schedules'" class="ad-panel">
        <div v-if="loading.schedules" class="ad-loading">
          <div class="ad-spinner"></div>
          <span>Loading schedules...</span>
        </div>
        <div v-else-if="schedules.length === 0" class="ad-empty">
          <svg class="ad-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3>No schedules</h3>
          <p>Create a schedule from chat using CREATE_SCHEDULE, or add one to a workflow.</p>
        </div>
        <div v-else class="ad-table-wrap">
          <table class="ad-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Agent</th>
                <th>Schedule</th>
                <th>Runs</th>
                <th>Cost</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="s in schedules" :key="s.id">
                <tr @click="toggleExpanded(s.id)" style="cursor:pointer">
                  <td class="ad-table-name">
                    {{ s.template_name }}
                    <span v-if="s.source === 'agent_tool'" class="ad-badge ad-badge-agent">agent</span>
                  </td>
                  <td>{{ s.agent_name || '—' }}</td>
                  <td><code class="ad-code">{{ s.schedule }}</code></td>
                  <td>{{ s.run_count || 0 }}</td>
                  <td>
                    <span v-if="s.total_cost_usd && s.total_cost_usd !== '0'" class="ad-cost">${{ parseFloat(s.total_cost_usd).toFixed(4) }}</span>
                    <span v-else class="ad-cost-zero">$0</span>
                  </td>
                  <td>
                    <span class="ad-status-dot" :class="s.active ? 'ad-status-active' : 'ad-status-inactive'"></span>
                    {{ s.active ? 'Active' : 'Paused' }}
                    <span v-if="s.consecutive_failures > 0" class="ad-fail-count">{{ s.consecutive_failures }}✗</span>
                    <span v-if="s.read_only" class="ad-readonly-badge">🔒</span>
                  </td>
                  <td @click.stop>
                    <button class="ad-btn ad-btn-xs ad-btn-primary" @click="runSchedule(s)" :disabled="firingScheduleId === s.id" title="Run Now">
                      {{ firingScheduleId === s.id ? '...' : '▶' }}
                    </button>
                    <button class="ad-btn ad-btn-xs" @click="openEditSchedule(s)" title="Edit">
                      ✎
                    </button>
                    <button class="ad-btn ad-btn-xs" @click="toggleSchedule(s)">
                      {{ s.active ? 'Pause' : 'Resume' }}
                    </button>
                    <button class="ad-btn ad-btn-xs ad-btn-danger" @click="deleteSchedule(s)">
                      ✕
                    </button>
                  </td>
                </tr>
                <!-- Expanded detail row -->
                <tr v-if="expandedSchedules.has(s.id)" class="ad-expanded-row">
                  <td colspan="7">
                    <!-- Sub-tabs -->
                    <div class="ad-subtab-bar">
                      <button
                        v-for="tab in scheduleDetailTabs"
                        :key="tab.key"
                        @click="scheduleDetailTab[s.id] = tab.key"
                        class="ad-subtab"
                        :class="{ 'ad-subtab-active': (scheduleDetailTab[s.id] || 'overview') === tab.key }"
                      >{{ tab.label }}</button>
                    </div>

                    <div class="ad-schedule-detail">
                      <!-- Overview -->
                      <div v-if="(scheduleDetailTab[s.id] || 'overview') === 'overview'">
                        <div class="ad-detail-section" style="flex-basis:100%">
                          <label>Prompt</label>
                          <pre class="ad-detail-prompt">{{ s.prompt || '(no prompt — uses workflow template)' }}</pre>
                        </div>
                        <div class="ad-detail-grid-4">
                          <div class="ad-detail-item">
                            <label>Last Run</label>
                            <span>{{ s.last_run ? formatDate(s.last_run) : 'Never' }}</span>
                          </div>
                          <div class="ad-detail-item">
                            <label>Next Run</label>
                            <span>{{ s.next_run ? formatDate(s.next_run) : '—' }}</span>
                          </div>
                          <div class="ad-detail-item">
                            <label>Total Cost</label>
                            <span>${{ parseFloat(s.total_cost_usd || 0).toFixed(4) }}</span>
                          </div>
                          <div class="ad-detail-item">
                            <label>Failures</label>
                            <span :style="s.consecutive_failures > 0 ? 'color:#fca5a5' : ''">{{ s.consecutive_failures }}</span>
                          </div>
                        </div>
                        <div v-if="s.last_error" class="ad-error-block">
                          <label>Last Error</label>
                          <pre class="ad-result-pre ad-result-error">{{ s.last_error }}</pre>
                        </div>
                      </div>

                      <!-- Profile & Tools -->
                      <div v-if="(scheduleDetailTab[s.id] || 'overview') === 'profile'">
                        <div v-if="s.profile_overrides && Object.keys(s.profile_overrides).length > 0">
                          <div class="ad-detail-grid-4">
                            <div v-if="s.profile_overrides.model_id" class="ad-detail-item">
                              <label>Model</label>
                              <code class="ad-code">{{ s.profile_overrides.model_id }}</code>
                            </div>
                            <div v-if="s.profile_overrides.temperature != null" class="ad-detail-item">
                              <label>Temperature</label>
                              <span>{{ s.profile_overrides.temperature }}</span>
                            </div>
                            <div v-if="s.profile_overrides.budget_usd" class="ad-detail-item">
                              <label>Budget/Run</label>
                              <span>${{ s.profile_overrides.budget_usd }}</span>
                            </div>
                            <div v-if="s.profile_overrides.max_iterations" class="ad-detail-item">
                              <label>Max Iterations</label>
                              <span>{{ s.profile_overrides.max_iterations }}</span>
                            </div>
                          </div>
                          <div v-if="s.profile_overrides.system_prompt" class="ad-detail-section" style="margin-top:12px">
                            <label>System Prompt Override</label>
                            <pre class="ad-detail-prompt">{{ s.profile_overrides.system_prompt }}</pre>
                          </div>
                          <div v-if="s.profile_overrides.tools?.length" style="margin-top:8px">
                            <label style="font-size:0.7rem;color:#64748b;text-transform:uppercase;font-weight:600">Tools</label>
                            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
                              <span v-for="t in s.profile_overrides.tools" :key="t" class="ad-badge" style="background:rgba(139,92,246,0.15);color:#c4b5fd">{{ t }}</span>
                            </div>
                          </div>
                        </div>
                        <p v-else style="color:#64748b;font-size:0.85rem;font-style:italic">No profile overrides — uses agent defaults.</p>
                      </div>

                      <!-- Guardrails -->
                      <div v-if="(scheduleDetailTab[s.id] || 'overview') === 'guardrails'">
                        <div class="ad-detail-grid-4">
                          <div class="ad-detail-item">
                            <label>Max Runs</label>
                            <span>{{ s.max_runs || '∞' }}</span>
                          </div>
                          <div class="ad-detail-item">
                            <label>Daily Budget Cap</label>
                            <span>{{ s.daily_budget_cap ? '$' + s.daily_budget_cap : 'No limit' }}</span>
                          </div>
                          <div class="ad-detail-item">
                            <label>Pause After Failures</label>
                            <span>{{ s.auto_pause_on_failures || '0 (never)' }}</span>
                          </div>
                          <div class="ad-detail-item">
                            <label>Read-Only</label>
                            <span>{{ s.read_only ? '🔒 Yes' : 'No' }}</span>
                          </div>
                          <div class="ad-detail-item">
                            <label>Expires</label>
                            <span>{{ s.expires_at ? formatDate(s.expires_at) : 'Never' }}</span>
                          </div>
                          <div class="ad-detail-item">
                            <label>Agent</label>
                            <span>{{ s.agent_name || '—' }}</span>
                          </div>
                        </div>
                      </div>

                      <!-- Run History -->
                      <div v-if="(scheduleDetailTab[s.id] || 'overview') === 'runs'">
                        <div v-if="loadingRuns[s.id]" class="ad-loading" style="padding:20px 0">
                          <div class="ad-spinner"></div>
                          <span>Loading runs...</span>
                        </div>
                        <div v-else-if="!scheduleRuns[s.id]?.length" style="color:#64748b;text-align:center;padding:20px">
                          No runs recorded yet.
                        </div>
                        <div v-else class="ad-runs-list">
                          <div v-for="run in scheduleRuns[s.id]" :key="run.id" class="ad-run-item">
                            <div class="ad-run-header">
                              <div style="display:flex;align-items:center;gap:8px">
                                <span class="ad-run-dot" :class="{
                                  'ad-run-ok': run.status === 'completed',
                                  'ad-run-running': run.status === 'running',
                                  'ad-run-fail': run.status === 'failed',
                                }"></span>
                                <span class="ad-run-status">{{ run.status }}</span>
                                <span v-if="run.manual" class="ad-badge" style="background:rgba(99,102,241,0.15);color:#a5b4fc;font-size:0.6rem">manual</span>
                              </div>
                              <div style="display:flex;align-items:center;gap:12px;font-size:0.75rem;color:#64748b">
                                <span v-if="run.duration_seconds">{{ run.duration_seconds }}s</span>
                                <span v-if="run.cost_usd !== '0'">${{ run.cost_usd }}</span>
                                <span>{{ formatDate(run.started_at) }}</span>
                              </div>
                            </div>
                            <div v-if="run.error" class="ad-run-error">
                              <pre class="ad-result-pre ad-result-error" style="max-height:80px;font-size:0.75rem">{{ run.error }}</pre>
                            </div>
                            <div v-if="run.task_results && Object.keys(run.task_results).length" class="ad-run-results">
                              <pre class="ad-result-pre" style="max-height:100px;font-size:0.75rem">{{ JSON.stringify(run.task_results, null, 2) }}</pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SCRIPTS TAB -->
      <div v-if="activeTab === 'scripts'" class="ad-panel">
        <div v-if="loading.scripts" class="ad-loading">
          <div class="ad-spinner"></div>
          <span>Loading scripts...</span>
        </div>
        <div v-else-if="scripts.length === 0" class="ad-empty">
          <svg class="ad-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/>
          </svg>
          <h3>No scripts registered</h3>
          <p>Run the seed command to register your engineering scripts.</p>
          <code class="ad-code-block">python manage.py seed_engineering_scripts --profile-id 3</code>
        </div>
        <div v-else class="ad-grid">
          <div v-for="script in scripts" :key="script.id" class="ad-card ad-card-script">
            <div class="ad-card-header">
              <div class="ad-card-title-row">
                <div class="ad-script-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25"/>
                  </svg>
                </div>
                <div>
                  <h3 class="ad-card-title">{{ script.name }}</h3>
                  <span class="ad-badge" :class="'ad-badge-' + script.category">{{ script.category }}</span>
                </div>
              </div>
            </div>
            <div class="ad-card-body">
              <p class="ad-card-desc">{{ script.description }}</p>
              <div v-if="Object.keys(script.parameters || {}).length" class="ad-param-list">
                <div class="ad-param-header">Parameters:</div>
                <div v-for="(param, key) in script.parameters" :key="key" class="ad-param-item">
                  <code>{{ key }}</code>
                  <span class="ad-param-type">{{ param.type || 'string' }}</span>
                  <span v-if="param.required" class="ad-param-required">required</span>
                </div>
              </div>
            </div>
            <div class="ad-card-footer">
              <span class="ad-card-path">{{ script.file_path }}</span>
              <span class="ad-card-runs">{{ script.execution_count || 0 }} runs</span>
            </div>
          </div>
        </div>
      </div>

      <!-- EXECUTIONS TAB -->
      <div v-if="activeTab === 'executions'" class="ad-panel">
        <div class="ad-exec-filters">
          <select v-model="execFilter.status" @change="loadExecutions" class="ad-select">
            <option value="">All Statuses</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <select v-model="execFilter.triggered_by" @change="loadExecutions" class="ad-select">
            <option value="">All Triggers</option>
            <option value="manual">Manual</option>
            <option value="schedule">Scheduled</option>
            <option value="monitor">Monitor</option>
          </select>
          <button class="ad-btn ad-btn-ghost" @click="loadExecutions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
        </div>

        <div v-if="loading.executions" class="ad-loading">
          <div class="ad-spinner"></div>
          <span>Loading execution history...</span>
        </div>
        <div v-else-if="executions.length === 0" class="ad-empty">
          <svg class="ad-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/>
          </svg>
          <h3>No executions yet</h3>
          <p>Run a workflow or script to see execution history here.</p>
        </div>
        <div v-else class="ad-table-wrap">
          <table class="ad-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Trigger</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ex in executions" :key="ex.id" class="ad-exec-row" :class="'ad-exec-' + ex.status">
                <td class="ad-table-id">#{{ ex.id }}</td>
                <td class="ad-table-name">{{ ex.workflow_name || ex.script_name || '—' }}</td>
                <td>
                  <span class="ad-status-badge" :class="'ad-status-' + ex.status">
                    {{ ex.status }}
                  </span>
                </td>
                <td>{{ ex.triggered_by }}</td>
                <td>{{ formatDate(ex.started_at) }}</td>
                <td>{{ ex.duration_seconds ? ex.duration_seconds.toFixed(1) + 's' : '—' }}</td>
                <td>
                  <button class="ad-btn ad-btn-xs" @click="viewExecution(ex)">
                    Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- EDIT SCHEDULE MODAL -->
    <Transition name="modal">
      <div v-if="editingSchedule" class="ad-modal-overlay" @click.self="editingSchedule = null">
        <div class="ad-modal ad-modal-lg">
          <div class="ad-modal-header">
            <h2>Edit Schedule: {{ editingSchedule.template_name }}</h2>
            <button class="ad-modal-close" @click="editingSchedule = null">&times;</button>
          </div>
          <div class="ad-modal-body">
            <div class="ad-form-group">
              <label>Name</label>
              <input v-model="scheduleForm.name" type="text" class="ad-input" />
            </div>
            <div class="ad-form-group">
              <label>Prompt</label>
              <textarea v-model="scheduleForm.prompt" class="ad-textarea" rows="4"></textarea>
            </div>
            <div class="ad-form-group">
              <label>Cron Schedule</label>
              <input v-model="scheduleForm.schedule" type="text" class="ad-input" placeholder="0 8 * * *" />
              <span class="ad-form-hint">minute hour day month weekday</span>
            </div>

            <h3 style="font-size:0.85rem;color:#94a3b8;margin:16px 0 8px;font-weight:600">Profile Overrides</h3>
            <div class="ad-form-group">
              <label>LLM Provider</label>
              <select v-model="scheduleProviderId" class="ad-select">
                <option :value="null">All Providers</option>
                <option v-for="p in llmProviders" :key="p.id" :value="p.id">
                  {{ p.name }} ({{ p.provider_type }})
                </option>
              </select>
            </div>
            <div class="ad-form-group">
              <label>Model Override</label>
              <select v-model="scheduleForm.profile_overrides.model_id" class="ad-select">
                <option :value="null">Use agent default</option>
                <option v-for="m in filteredScheduleModels" :key="m.id" :value="m.id">
                  {{ m.name }}
                </option>
              </select>
            </div>
            <div class="ad-form-group">
              <label>System Prompt Override</label>
              <textarea v-model="scheduleForm.profile_overrides.system_prompt" class="ad-textarea" rows="2" placeholder="Override agent system prompt"></textarea>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
              <div class="ad-form-group">
                <label>Temperature</label>
                <input v-model.number="scheduleForm.profile_overrides.temperature" type="number" min="0" max="2" step="0.1" class="ad-input" />
              </div>
              <div class="ad-form-group">
                <label>Budget ($/run)</label>
                <input v-model.number="scheduleForm.profile_overrides.budget_usd" type="number" min="0" step="0.01" class="ad-input" />
              </div>
              <div class="ad-form-group">
                <label>Max Iterations</label>
                <input v-model.number="scheduleForm.profile_overrides.max_iterations" type="number" min="1" max="50" class="ad-input" />
              </div>
            </div>

            <h3 style="font-size:0.85rem;color:#94a3b8;margin:16px 0 8px;font-weight:600">Guardrails</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
              <div class="ad-form-group">
                <label>Max Total Runs</label>
                <input v-model.number="scheduleForm.max_runs" type="number" min="1" class="ad-input" placeholder="∞" />
              </div>
              <div class="ad-form-group">
                <label>Daily Budget Cap ($)</label>
                <input v-model="scheduleForm.daily_budget_cap" type="number" min="0" step="0.01" class="ad-input" placeholder="No limit" />
              </div>
              <div class="ad-form-group">
                <label>Pause After Failures</label>
                <input v-model.number="scheduleForm.auto_pause_on_failures" type="number" min="0" class="ad-input" />
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:16px;margin-top:8px">
              <label class="ad-label-row">
                <input type="checkbox" v-model="scheduleForm.read_only" class="ad-checkbox" />
                <span>Read-only mode</span>
              </label>
              <div style="flex:1">
                <label style="font-size:0.75rem;color:#64748b">Expires</label>
                <input v-model="scheduleForm.expires_at" type="datetime-local" class="ad-input" style="padding:6px 8px" />
              </div>
            </div>
          </div>
          <div class="ad-modal-footer">
            <button class="ad-btn ad-btn-ghost" @click="editingSchedule = null">Cancel</button>
            <button class="ad-btn ad-btn-primary" @click="saveScheduleEdit" :disabled="savingSchedule">{{ savingSchedule ? 'Saving...' : 'Save Changes' }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- CREATE WORKFLOW MODAL -->
    <Transition name="modal">
      <div v-if="showCreateWorkflow" class="ad-modal-overlay" @click.self="showCreateWorkflow = false">
        <div class="ad-modal">
          <div class="ad-modal-header">
            <h2>{{ editingWorkflow ? 'Edit Workflow' : 'New Workflow' }}</h2>
            <button class="ad-modal-close" @click="showCreateWorkflow = false">&times;</button>
          </div>
          <div class="ad-modal-body">
            <div class="ad-form-group">
              <label>Name</label>
              <input v-model="workflowForm.name" type="text" class="ad-input" placeholder="e.g. Morning Health Check" />
            </div>
            <div class="ad-form-group">
              <label>Category</label>
              <select v-model="workflowForm.category" class="ad-select">
                <option value="general">General</option>
                <option value="deployment">Deployment</option>
                <option value="monitoring">Monitoring</option>
                <option value="reporting">Reporting</option>
              </select>
            </div>
            <div class="ad-form-group">
              <label>Prompt</label>
              <textarea v-model="workflowForm.prompt" class="ad-textarea" rows="6"
                placeholder="The prompt to send to the agent when this workflow executes. Use {{today}}, {{now}} for dynamic values."></textarea>
            </div>

            <!-- Schedule section -->
            <div class="ad-form-group">
              <label class="ad-label-row">
                <input type="checkbox" v-model="workflowForm.addSchedule" class="ad-checkbox" />
                <span>Schedule this workflow</span>
              </label>
            </div>
            <template v-if="workflowForm.addSchedule">
              <div class="ad-form-group">
                <label>Cron Expression</label>
                <input v-model="workflowForm.schedule" type="text" class="ad-input" placeholder="0 8 * * *  (8am daily)" />
                <span class="ad-form-hint">minute hour day month weekday</span>
              </div>
              <div class="ad-form-group">
                <label>Delivery Channel</label>
                <select v-model="workflowForm.channel" class="ad-select">
                  <option value="log">Log Only</option>
                  <option value="telegram">Telegram</option>
                  <option value="slack">Slack</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </template>
          </div>
          <div class="ad-modal-footer">
            <button class="ad-btn ad-btn-ghost" @click="showCreateWorkflow = false">Cancel</button>
            <button class="ad-btn ad-btn-primary" @click="saveWorkflow" :disabled="!workflowForm.name || !workflowForm.prompt">
              {{ editingWorkflow ? 'Update' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- EXECUTION DETAIL MODAL -->
    <Transition name="modal">
      <div v-if="selectedExecution" class="ad-modal-overlay" @click.self="selectedExecution = null">
        <div class="ad-modal ad-modal-lg">
          <div class="ad-modal-header">
            <h2>Execution #{{ selectedExecution.id }}</h2>
            <button class="ad-modal-close" @click="selectedExecution = null">&times;</button>
          </div>
          <div class="ad-modal-body">
            <div class="ad-detail-grid">
              <div class="ad-detail-item">
                <label>Status</label>
                <span class="ad-status-badge" :class="'ad-status-' + selectedExecution.status">
                  {{ selectedExecution.status }}
                </span>
              </div>
              <div class="ad-detail-item">
                <label>Triggered By</label>
                <span>{{ selectedExecution.triggered_by }}</span>
              </div>
              <div class="ad-detail-item">
                <label>Started</label>
                <span>{{ formatDate(selectedExecution.started_at) }}</span>
              </div>
              <div class="ad-detail-item">
                <label>Duration</label>
                <span>{{ selectedExecution.duration_seconds ? selectedExecution.duration_seconds.toFixed(2) + 's' : '—' }}</span>
              </div>
            </div>

            <!-- Steps -->
            <div v-if="selectedExecution.steps?.length" class="ad-steps">
              <h3 class="ad-steps-title">Steps</h3>
              <div v-for="(step, i) in selectedExecution.steps" :key="i" class="ad-step">
                <span class="ad-step-icon" :class="step.status === 'success' ? 'ad-step-ok' : 'ad-step-fail'">
                  {{ step.status === 'success' ? '✓' : '✗' }}
                </span>
                <span class="ad-step-name">{{ step.step }}</span>
                <span v-if="step.duration" class="ad-step-dur">{{ step.duration }}s</span>
              </div>
            </div>

            <!-- Result -->
            <div v-if="selectedExecution.result" class="ad-result-section">
              <h3 class="ad-steps-title">Result</h3>
              <pre class="ad-result-pre">{{ selectedExecution.result }}</pre>
            </div>

            <!-- Error -->
            <div v-if="selectedExecution.error" class="ad-error-section">
              <h3 class="ad-steps-title">Error</h3>
              <pre class="ad-result-pre ad-result-error">{{ selectedExecution.error }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject, watch } from 'vue'
import api from '../services/api'

const notify = inject('notify', (msg) => alert(msg))

// State
const activeTab = ref('workflows')
const loading = reactive({ workflows: false, schedules: false, scripts: false, executions: false })
const workflows = ref([])
const schedules = ref([])
const scripts = ref([])
const executions = ref([])
const showCreateWorkflow = ref(false)
const editingWorkflow = ref(null)
const selectedExecution = ref(null)
const expandedSchedules = ref(new Set())
const scheduleDetailTab = reactive({})
const scheduleRuns = reactive({})
const loadingRuns = reactive({})
const firingScheduleId = ref(null)
const editingSchedule = ref(null)
const savingSchedule = ref(false)
const scheduleForm = reactive({
  name: '', prompt: '', schedule: '',
  profile_overrides: {},
  max_runs: null, daily_budget_cap: null, read_only: false,
  expires_at: '', auto_pause_on_failures: 3,
})
const scheduleDetailTabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'profile', label: 'Profile & Tools' },
  { key: 'guardrails', label: 'Guardrails' },
  { key: 'runs', label: 'Run History' },
]
const llmProviders = ref([])
const llmModels = ref([])
const scheduleProviderId = ref(null)
const execFilter = reactive({ status: '', triggered_by: '' })

const workflowForm = reactive({
  name: '',
  prompt: '',
  category: 'general',
  addSchedule: false,
  schedule: '',
  channel: 'log',
})

const filteredScheduleModels = computed(() => {
  if (scheduleProviderId.value) {
    return llmModels.value.filter(m => m.provider === scheduleProviderId.value)
  }
  return llmModels.value
})

// Tabs
const tabs = computed(() => [
  { key: 'workflows', label: 'Workflows', icon: '<path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>', count: workflows.value.length },
  { key: 'schedules', label: 'Schedules', icon: '<path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>', count: schedules.value.length },
  { key: 'scripts', label: 'Scripts', icon: '<path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/>', count: scripts.value.length },
  { key: 'executions', label: 'History', icon: '<path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/>', count: executions.value.length },
])

// Methods
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const loadWorkflows = async () => {
  loading.workflows = true
  try {
    const res = await api.get('/workflows/')
    workflows.value = res.data
  } catch (e) {
    console.error('Failed to load workflows:', e)
  } finally {
    loading.workflows = false
  }
}

const loadSchedules = async () => {
  loading.schedules = true
  try {
    const res = await api.get('/schedules/')
    schedules.value = res.data
  } catch (e) {
    console.error('Failed to load schedules:', e)
  } finally {
    loading.schedules = false
  }
}

const loadScripts = async () => {
  loading.scripts = true
  try {
    const res = await api.get('/scripts/')
    scripts.value = res.data
  } catch (e) {
    console.error('Failed to load scripts:', e)
  } finally {
    loading.scripts = false
  }
}

const loadExecutions = async () => {
  loading.executions = true
  try {
    const params = new URLSearchParams()
    if (execFilter.status) params.set('status', execFilter.status)
    if (execFilter.triggered_by) params.set('triggered_by', execFilter.triggered_by)
    const res = await api.get(`/executions/?${params}`)
    executions.value = res.data
  } catch (e) {
    console.error('Failed to load executions:', e)
  } finally {
    loading.executions = false
  }
}

const saveWorkflow = async () => {
  try {
    if (editingWorkflow.value) {
      await api.put(`/workflows/${editingWorkflow.value.id}/`, {
        name: workflowForm.name,
        prompt: workflowForm.prompt,
        category: workflowForm.category,
      })
      notify('Workflow updated', 'success')
    } else {
      // Get first profile (or let user select)
      const profileRes = await api.get('/agents/')
      const profileId = profileRes.data?.results?.[0]?.id || profileRes.data?.[0]?.id
      if (!profileId) {
        notify('No agent profile found. Create one first.', 'error')
        return
      }

      const res = await api.post('/workflows/', {
        name: workflowForm.name,
        prompt: workflowForm.prompt,
        category: workflowForm.category,
        profile_id: profileId,
      })

      // Create schedule if requested
      if (workflowForm.addSchedule && workflowForm.schedule) {
        await api.post('/schedules/', {
          template_id: res.data.id,
          profile_id: profileId,
          schedule: workflowForm.schedule,
          channel: workflowForm.channel,
        })
      }
      notify('Workflow created', 'success')
    }

    showCreateWorkflow.value = false
    editingWorkflow.value = null
    resetForm()
    loadWorkflows()
    loadSchedules()
  } catch (e) {
    notify(e.response?.data?.error || 'Failed to save workflow', 'error')
  }
}

const runWorkflow = async (wf) => {
  try {
    const res = await api.post(`/workflows/${wf.id}/run/`)
    notify(`Workflow "${wf.name}" executed: ${res.data.status}`, res.data.status === 'success' ? 'success' : 'error')
    loadExecutions()
  } catch (e) {
    notify('Failed to run workflow', 'error')
  }
}

const editWorkflow = (wf) => {
  editingWorkflow.value = wf
  workflowForm.name = wf.name
  workflowForm.prompt = wf.prompt
  workflowForm.category = wf.category
  workflowForm.addSchedule = false
  showCreateWorkflow.value = true
}

const deleteWorkflow = async (wf) => {
  if (!confirm(`Delete workflow "${wf.name}"?`)) return
  try {
    await api.delete(`/workflows/${wf.id}/`)
    notify('Workflow deleted', 'success')
    loadWorkflows()
  } catch (e) {
    notify('Failed to delete workflow', 'error')
  }
}

const toggleSchedule = async (s) => {
  try {
    await api.put(`/schedules/${s.id}/`, { active: !s.active })
    notify(`Schedule ${s.active ? 'paused' : 'resumed'}`, 'success')
    loadSchedules()
  } catch (e) {
    notify('Failed to update schedule', 'error')
  }
}

const runSchedule = async (s) => {
  firingScheduleId.value = s.id
  try {
    const res = await api.post(`/schedules/${s.id}/run/`)
    notify(`Schedule "${s.template_name}" triggered! ${res.data.signal_id ? '(Signal #' + res.data.signal_id + ')' : ''}`, 'success')
    loadSchedules()
    // Refresh runs if tab is open
    if (scheduleDetailTab[s.id] === 'runs') {
      loadScheduleRuns(s.id)
    }
  } catch (e) {
    notify('Failed to run schedule: ' + (e.response?.data?.detail || e.message), 'error')
  } finally {
    firingScheduleId.value = null
  }
}

const toggleExpanded = (id) => {
  if (expandedSchedules.value.has(id)) {
    expandedSchedules.value.delete(id)
  } else {
    expandedSchedules.value.add(id)
    if (!scheduleDetailTab[id]) scheduleDetailTab[id] = 'overview'
  }
  // Force reactivity
  expandedSchedules.value = new Set(expandedSchedules.value)
}

const openEditSchedule = (s) => {
  editingSchedule.value = s
  scheduleForm.name = s.template_name
  scheduleForm.prompt = s.prompt || ''
  scheduleForm.schedule = s.schedule
  scheduleForm.profile_overrides = { ...(s.profile_overrides || {}) }
  scheduleForm.max_runs = s.max_runs
  scheduleForm.daily_budget_cap = s.daily_budget_cap
  scheduleForm.read_only = s.read_only || false
  scheduleForm.expires_at = s.expires_at ? s.expires_at.slice(0, 16) : ''
  scheduleForm.auto_pause_on_failures = s.auto_pause_on_failures || 3
  // Set provider filter based on current model override
  if (scheduleForm.profile_overrides.model_id) {
    const model = llmModels.value.find(m => m.id === scheduleForm.profile_overrides.model_id)
    scheduleProviderId.value = model ? model.provider : null
  } else {
    scheduleProviderId.value = null
  }
}

const saveScheduleEdit = async () => {
  savingSchedule.value = true
  try {
    const payload = {
      name: scheduleForm.name,
      prompt: scheduleForm.prompt,
      schedule: scheduleForm.schedule,
      read_only: scheduleForm.read_only,
    }
    // Include profile overrides if any keys are set
    const po = scheduleForm.profile_overrides || {}
    const cleanOverrides = {}
    if (po.model_id) cleanOverrides.model_id = po.model_id
    if (po.system_prompt) cleanOverrides.system_prompt = po.system_prompt
    if (po.temperature != null && po.temperature !== '') cleanOverrides.temperature = po.temperature
    if (po.budget_usd != null && po.budget_usd !== '') cleanOverrides.budget_usd = po.budget_usd
    if (po.max_iterations) cleanOverrides.max_iterations = po.max_iterations
    if (Object.keys(cleanOverrides).length) payload.profile_overrides = cleanOverrides
    else payload.profile_overrides = {}

    if (scheduleForm.max_runs) payload.max_runs = scheduleForm.max_runs
    if (scheduleForm.daily_budget_cap) payload.daily_budget_cap = scheduleForm.daily_budget_cap
    if (scheduleForm.auto_pause_on_failures != null) payload.auto_pause_on_failures = scheduleForm.auto_pause_on_failures
    if (scheduleForm.expires_at) payload.expires_at = new Date(scheduleForm.expires_at).toISOString()

    await api.put(`/schedules/${editingSchedule.value.id}/`, payload)
    notify('Schedule updated', 'success')
    editingSchedule.value = null
    loadSchedules()
  } catch (e) {
    notify('Failed to update schedule: ' + (e.response?.data?.error || e.message), 'error')
  } finally {
    savingSchedule.value = false
  }
}

const loadScheduleRuns = async (scheduleId) => {
  loadingRuns[scheduleId] = true
  try {
    const res = await api.get(`/schedules/${scheduleId}/runs/`)
    scheduleRuns[scheduleId] = res.data.runs || []
  } catch (e) {
    console.error('Failed to load runs:', e)
    scheduleRuns[scheduleId] = []
  } finally {
    loadingRuns[scheduleId] = false
  }
}

// Auto-load runs when Runs tab is selected
watch(scheduleDetailTab, (tabs) => {
  for (const [id, tab] of Object.entries(tabs)) {
    if (tab === 'runs' && !scheduleRuns[id]) {
      loadScheduleRuns(id)
    }
  }
}, { deep: true })

const deleteSchedule = async (s) => {
  if (!confirm('Delete this schedule?')) return
  try {
    await api.delete(`/schedules/${s.id}/`)
    notify('Schedule deleted', 'success')
    loadSchedules()
  } catch (e) {
    notify('Failed to delete schedule', 'error')
  }
}

const viewExecution = async (ex) => {
  try {
    const res = await api.get(`/executions/${ex.id}/`)
    selectedExecution.value = res.data
  } catch (e) {
    selectedExecution.value = ex
  }
}

const resetForm = () => {
  workflowForm.name = ''
  workflowForm.prompt = ''
  workflowForm.category = 'general'
  workflowForm.addSchedule = false
  workflowForm.schedule = ''
  workflowForm.channel = 'log'
}

// Load on mount
onMounted(() => {
  loadWorkflows()
  loadSchedules()
  loadScripts()
  loadExecutions()
  // Load LLM providers and models for schedule editing
  api.getLlmProviders().then(res => {
    llmProviders.value = res.data.results || res.data
  }).catch(() => {})
  api.getLlmModels().then(res => {
    llmModels.value = res.data.results || res.data
  }).catch(() => {})
})
</script>

<style scoped>
/* ===== Layout ===== */
.automation-dashboard {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
}

/* ===== Header ===== */
.ad-header {
  background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  padding: 0 24px;
}

.ad-header-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.ad-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
}

.ad-title-icon {
  width: 28px;
  height: 28px;
  color: #a78bfa;
}

.ad-subtitle {
  color: #94a3b8;
  font-size: 0.875rem;
  margin: 4px 0 0;
}

/* ===== Tabs ===== */
.ad-tabs {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  gap: 4px;
  padding-top: 20px;
}

.ad-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #94a3b8;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.ad-tab:hover {
  color: #e2e8f0;
}

.ad-tab-active {
  color: #a78bfa;
  border-bottom-color: #8b5cf6;
}

.ad-tab-icon {
  width: 18px;
  height: 18px;
}

.ad-tab-count {
  padding: 1px 8px;
  font-size: 0.75rem;
  background: rgba(139, 92, 246, 0.15);
  color: #c4b5fd;
  border-radius: 10px;
}

.ad-tab-active .ad-tab-count {
  background: rgba(139, 92, 246, 0.3);
}

/* ===== Content ===== */
.ad-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}

.ad-panel {
  min-height: 300px;
}

/* ===== Loading & Empty ===== */
.ad-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  color: #94a3b8;
}

.ad-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(139, 92, 246, 0.2);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ad-empty {
  text-align: center;
  padding: 60px 20px;
}

.ad-empty-icon {
  width: 48px;
  height: 48px;
  color: #475569;
  margin-bottom: 16px;
}

.ad-empty h3 {
  font-size: 1.125rem;
  color: #e2e8f0;
  margin: 0 0 8px;
}

.ad-empty p {
  color: #94a3b8;
  font-size: 0.875rem;
  margin: 0 0 20px;
}

/* ===== Grid ===== */
.ad-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

/* ===== Card ===== */
.ad-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s;
}

.ad-card:hover {
  border-color: #6366f1;
  transform: translateY(-1px);
}

.ad-card-header {
  padding: 16px 16px 0;
}

.ad-card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ad-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.ad-card-meta {
  display: flex;
  gap: 6px;
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 4px;
}

.ad-card-body {
  padding: 12px 16px;
}

.ad-card-prompt {
  font-size: 0.8rem;
  color: #94a3b8;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 10px;
  margin: 0;
  white-space: pre-wrap;
  max-height: 80px;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.ad-card-desc {
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
}

.ad-card-actions {
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  border-top: 1px solid #334155;
}

.ad-card-footer {
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #64748b;
  border-top: 1px solid #334155;
}

.ad-card-path {
  font-family: monospace;
}

/* ===== Script card ===== */
.ad-script-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}

.ad-script-icon svg {
  width: 20px;
  height: 20px;
  color: white;
}

.ad-card-script .ad-card-title-row {
  justify-content: flex-start;
}

/* ===== Parameters ===== */
.ad-param-list {
  margin-top: 10px;
}

.ad-param-header {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 6px;
  font-weight: 600;
}

.ad-param-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  padding: 3px 0;
}

.ad-param-item code {
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.1);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.75rem;
}

.ad-param-type {
  color: #64748b;
  font-size: 0.7rem;
}

.ad-param-required {
  color: #f59e0b;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
}

/* ===== Table ===== */
.ad-table-wrap {
  overflow-x: auto;
}

.ad-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875rem;
}

.ad-table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  border-bottom: 1px solid #334155;
}

.ad-table td {
  padding: 12px;
  border-bottom: 1px solid #1e293b;
  color: #cbd5e1;
}

.ad-table tbody tr:hover {
  background: rgba(139, 92, 246, 0.05);
}

.ad-table-name {
  font-weight: 500;
  color: #f1f5f9;
}

.ad-table-id {
  color: #64748b;
  font-family: monospace;
}

/* ===== Badges ===== */
.ad-badge {
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ad-badge-general { background: #1e3a5f; color: #60a5fa; }
.ad-badge-monitoring { background: #064e3b; color: #34d399; }
.ad-badge-deployment { background: #4c1d95; color: #c4b5fd; }
.ad-badge-reporting { background: #78350f; color: #fbbf24; }
.ad-badge-channel { background: #334155; color: #94a3b8; }

/* ===== Status ===== */
.ad-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.ad-status-active { background: #10b981; }
.ad-status-inactive { background: #64748b; }

.ad-status-badge {
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
}

.ad-status-running { background: #1e3a5f; color: #60a5fa; }
.ad-status-success { background: #064e3b; color: #34d399; }
.ad-status-failed { background: #450a0a; color: #fca5a5; }
.ad-status-partial { background: #78350f; color: #fbbf24; }

/* ===== Filters ===== */
.ad-exec-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

/* ===== Buttons ===== */
.ad-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.ad-btn svg { width: 16px; height: 16px; }

.ad-btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border: none;
}

.ad-btn-primary:hover { background: linear-gradient(135deg, #4f46e5, #7c3aed); }
.ad-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.ad-btn-ghost {
  background: transparent;
  color: #94a3b8;
  border-color: #334155;
}

.ad-btn-ghost:hover { background: #1e293b; color: #e2e8f0; }

.ad-btn-danger { color: #fca5a5; }
.ad-btn-danger:hover { background: rgba(239, 68, 68, 0.1); }

.ad-btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.ad-btn-xs {
  padding: 4px 10px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
  border: 1px solid #334155;
  border-radius: 6px;
  cursor: pointer;
}

.ad-btn-xs:hover { background: rgba(255, 255, 255, 0.1); color: #e2e8f0; }

/* ===== Form Elements ===== */
.ad-input, .ad-select, .ad-textarea {
  width: 100%;
  padding: 10px 12px;
  font-size: 0.875rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e2e8f0;
  transition: border-color 0.2s;
}

.ad-input:focus, .ad-select:focus, .ad-textarea:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.ad-textarea {
  resize: vertical;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  line-height: 1.6;
}

.ad-select {
  appearance: none;
  cursor: pointer;
}

.ad-exec-filters .ad-select {
  width: auto;
  min-width: 140px;
}

/* ===== Code ===== */
.ad-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  padding: 2px 8px;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 4px;
  color: #c4b5fd;
}

.ad-code-block {
  display: block;
  background: #1e293b;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #334155;
  font-family: monospace;
  font-size: 0.8rem;
  color: #a78bfa;
}

/* ===== Modal ===== */
.ad-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5000;
  padding: 20px;
}

.ad-modal {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.ad-modal-lg { max-width: 700px; }

.ad-modal-header {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #334155;
}

.ad-modal-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.ad-modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
  padding: 0 4px;
}

.ad-modal-close:hover { color: #e2e8f0; }

.ad-modal-body {
  padding: 24px;
}

.ad-modal-footer {
  padding: 16px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #334155;
}

/* ===== Form Groups ===== */
.ad-form-group {
  margin-bottom: 16px;
}

.ad-form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 6px;
}

.ad-form-hint {
  display: block;
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 4px;
}

.ad-label-row {
  display: flex !important;
  align-items: center;
  gap: 8px;
}

.ad-checkbox {
  accent-color: #6366f1;
}

/* ===== Detail Modal ===== */
.ad-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.ad-detail-item label {
  display: block;
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 4px;
}

.ad-detail-item span {
  font-size: 0.9rem;
  color: #e2e8f0;
}

/* ===== Steps ===== */
.ad-steps {
  margin-bottom: 20px;
}

.ad-steps-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #94a3b8;
  margin: 0 0 10px;
}

.ad-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.ad-step-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
}

.ad-step-ok { background: #064e3b; color: #34d399; }
.ad-step-fail { background: #450a0a; color: #fca5a5; }

.ad-step-name { flex: 1; font-size: 0.875rem; }
.ad-step-dur { font-size: 0.75rem; color: #64748b; }

/* ===== Result ===== */
.ad-result-pre {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 14px;
  font-size: 0.8rem;
  color: #94a3b8;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', monospace;
}

.ad-result-error {
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

/* ===== Transitions ===== */
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-active .ad-modal, .modal-leave-active .ad-modal {
  transition: transform 0.2s;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-from .ad-modal {
  transform: scale(0.95) translateY(10px);
}
.modal-leave-to .ad-modal {
  transform: scale(0.95) translateY(10px);
}

/* ===== Schedule Expanded Rows ===== */
.ad-expanded-row td {
  background: #1a2236 !important;
  padding: 0 !important;
}

.ad-schedule-detail {
  padding: 16px 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.ad-detail-section {
  flex: 1 1 200px;
}

.ad-detail-section label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-bottom: 6px;
  font-weight: 600;
}

.ad-detail-prompt {
  background: rgba(0,0,0,0.3);
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 10px;
  font-size: 0.8rem;
  color: #cbd5e1;
  white-space: pre-wrap;
  max-height: 120px;
  overflow-y: auto;
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
}

.ad-detail-overrides {
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 6px;
  padding: 10px;
  font-size: 0.75rem;
  color: #c4b5fd;
  white-space: pre-wrap;
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
}

.ad-badge-agent {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 6px;
  vertical-align: middle;
}

.ad-fail-count {
  color: #f87171;
  font-size: 0.75rem;
  margin-left: 4px;
  font-weight: 600;
}

/* ===== Schedule Sub-Tabs ===== */
.ad-subtab-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #334155;
  background: rgba(0,0,0,0.15);
  padding: 0 16px;
}

.ad-subtab {
  padding: 8px 14px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  border: none;
  background: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.ad-subtab:hover { color: #94a3b8; }
.ad-subtab-active { color: #a78bfa; border-bottom-color: #8b5cf6; }

.ad-detail-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.ad-error-block {
  margin-top: 12px;
}

.ad-error-block label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fca5a5;
  margin-bottom: 6px;
  font-weight: 600;
}

.ad-cost { color: #34d399; font-size: 0.85rem; }
.ad-cost-zero { color: #475569; font-size: 0.85rem; }

.ad-readonly-badge {
  font-size: 0.7rem;
  margin-left: 4px;
}

/* ===== Run History ===== */
.ad-runs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.ad-run-item {
  background: rgba(0,0,0,0.2);
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 14px;
}

.ad-run-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ad-run-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ad-run-ok { background: #10b981; }
.ad-run-running { background: #f59e0b; }
.ad-run-fail { background: #ef4444; }

.ad-run-status {
  font-size: 0.8rem;
  font-weight: 500;
  color: #cbd5e1;
  text-transform: capitalize;
}

.ad-run-error, .ad-run-results {
  margin-top: 8px;
}
</style>

