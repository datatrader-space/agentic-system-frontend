<!-- ServiceRegistrationV2.vue - Complete 4-Step Service Registration Wizard -->
<template>
  <div class="service-registration-v2">
    <!-- Progress Stepper -->
    <div class="progress-stepper">
      <div class="step" :class="{ completed: currentStep > 1, active: currentStep === 1 }" @click="goToStep(1)">
        <div class="step-icon">
          <svg v-if="currentStep > 1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
          <span v-else>1</span>
        </div>
        <div class="step-content">
          <div class="step-title">Connect</div>
          <div class="step-subtitle">API configuration</div>
        </div>
      </div>

      <div class="step-line" :class="{ completed: currentStep > 1 }"></div>

      <div class="step" :class="{ completed: currentStep > 2, active: currentStep === 2 }" @click="goToStep(2)">
        <div class="step-icon">
          <svg v-if="currentStep > 2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
          <span v-else>2</span>
        </div>
        <div class="step-content">
          <div class="step-title">Discovery</div>
          <div class="step-subtitle">Select actions</div>
        </div>
      </div>

      <div class="step-line" :class="{ completed: currentStep > 2 }"></div>

      <div class="step" :class="{ completed: currentStep > 3, active: currentStep === 3 }" @click="goToStep(3)">
        <div class="step-icon">
          <svg v-if="currentStep > 3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
          <span v-else>3</span>
        </div>
        <div class="step-content">
          <div class="step-title">Examples</div>
          <div class="step-subtitle">Review & generate</div>
        </div>
      </div>

      <div class="step-line" :class="{ completed: currentStep > 3 }"></div>

      <div class="step" :class="{ completed: currentStep > 4, active: currentStep === 4 }" @click="goToStep(4)">
        <div class="step-icon">
          <svg v-if="currentStep > 4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
          <span v-else>4</span>
        </div>
        <div class="step-content">
          <div class="step-title">Review & Edit</div>
          <div class="step-subtitle">Validate actions</div>
        </div>
      </div>

      <div class="step-line" :class="{ completed: currentStep > 4 }"></div>

      <div class="step" :class="{ active: currentStep === 5 }" @click="goToStep(5)">
        <div class="step-icon">5</div>
        <div class="step-content">
          <div class="step-title">Register</div>
          <div class="step-subtitle">Deploy actions</div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Step 1: Connect -->
      <div v-if="currentStep === 1" class="connect-step">
        <div class="step-card">
          <h2>Connect Your API</h2>
          <p class="subtitle">Configure service details and authentication</p>

          <div class="form-section">
            <label>Service Name *</label>
            <input v-model="formData.name" type="text" placeholder="e.g., Slack, GitHub, Jira" />
          </div>

          <div class="form-section">
            <label>Description</label>
            <textarea v-model="formData.description" rows="3" placeholder="What does this service do?"></textarea>
          </div>

          <div class="form-grid">
            <div class="form-section">
              <label>Category</label>
              <select v-model="formData.category">
                <option value="">Select category...</option>
                <option value="communication">Communication</option>
                <option value="development">Development</option>
                <option value="analytics">Analytics</option>
                <option value="crm">CRM</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div class="form-section">
              <label>Base URL *</label>
              <input v-model="formData.baseUrl" type="url" placeholder="https://api.example.com" />
            </div>
          </div>

          <div class="form-section">
            <label>Authentication Type *</label>
            <div class="auth-types">
              <div 
                v-for="type in authTypes" 
                :key="type.value"
                :class="['auth-card', { selected: formData.authType === type.value }]"
                @click="formData.authType = type.value"
              >
                <div class="auth-icon">{{ type.icon }}</div>
                <div class="auth-name">{{ type.label }}</div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <label>OpenAPI Specification *</label>
            <div class="upload-area" @click="$refs.fileInput.click()">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
              </svg>
              <p v-if="!formData.specFile">Click to upload or drag OpenAPI spec (JSON/YAML)</p>
              <p v-else class="file-name">{{ formData.specFile.name }}</p>
            </div>
            <input ref="fileInput" type="file" accept=".json,.yaml,.yml" @change="handleFileUpload" style="display: none" />
          </div>

          <div class="form-section">
            <label>Or Spec URL</label>
            <input v-model="formData.specUrl" type="url" placeholder="https://api.example.com/openapi.json" />
          </div>
        </div>
      </div>

      <!-- Step 2: Discovery & Category Selection -->
      <div v-if="currentStep === 2" class="discovery-step">
        <!-- GraphQL Detection Banner -->
        <div v-if="graphqlHint" class="graphql-banner">
          <div class="graphql-banner-icon">🔮</div>
          <div class="graphql-banner-content">
            <h3>GraphQL API Detected</h3>
            <p>{{ graphqlHint.message }}</p>
            <div class="graphql-rediscover">
              <input
                v-model="graphqlEndpointUrl"
                type="url"
                placeholder="https://your-store.myshopify.com/admin/api/2025-01/graphql.json"
                class="graphql-endpoint-input"
              />
              <input
                v-model="graphqlAuthToken"
                type="password"
                placeholder="Authentication token (optional, e.g. X-Shopify-Access-Token)"
                class="graphql-auth-input"
              />
              <button
                class="btn-graphql-rediscover"
                @click="rediscoverGraphQL"
                :disabled="!graphqlEndpointUrl || rediscoveringGraphQL"
              >
                <svg v-if="!rediscoveringGraphQL" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" class="spin">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                {{ rediscoveringGraphQL ? 'Introspecting...' : 'Re-discover via Introspection' }}
              </button>
            </div>
            <button class="btn-dismiss-banner" @click="graphqlHint = null">Dismiss — use as-is</button>
          </div>
        </div>

        <div class="step-card">
          <div class="discovery-header">
            <div>
              <h2>Discovered Actions</h2>
              <p class="subtitle">Select which action categories to include</p>
            </div>
            
            <div class="header-actions">
              <!-- Save Draft Button -->
              <button class="btn-save-draft" @click="saveDraft()" :disabled="isSaving">
                <svg v-if="!isSaving" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" class="spin">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                {{ isSaving ? 'Saving...' : 'Save Draft' }}
              </button>
              
              <!-- Save Status Indicator -->
              <div v-if="lastSaved" class="save-indicator">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                Saved {{ formatTimeAgo(lastSaved) }}
              </div>
              
              <!-- View Toggle -->
              <div class="view-toggle">
                <button 
                  :class="['toggle-btn', { active: discoveryView === 'cards' }]"
                  @click="discoveryView = 'cards'"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 5v14h18V5H3zm16 12H5V7h14v10z"/>
                  </svg>
                  Cards
                </button>
              <button 
                :class="['toggle-btn', { active: discoveryView === 'tree' }]"
                @click="discoveryView = 'tree'"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 3L5 7l4 4V8h6V6H9V3zm6 18l4-4-4-4v3H9v2h6v3z"/>
                </svg>
                Tree
              </button>
              <button 
                :class="['toggle-btn', { active: discoveryView === 'raw' }]"
                @click="discoveryView = 'raw'"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                </svg>
                Raw
              </button>
            </div>
          </div>
        </div>

          <!-- Cards View -->
          <div v-if="discoveryView === 'cards'">
            <div class="discovery-stats">
              <div class="stat-card">
                <div class="stat-number">{{ discoveredActions }}</div>
                <div class="stat-label">Total Actions</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">{{ categories.length }}</div>
                <div class="stat-label">Categories</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">{{ selectedActions }}</div>
                <div class="stat-label">Selected</div>
              </div>
            </div>

            <div class="categories-section">
              <div 
                v-for="category in categories" 
                :key="category.name"
                class="category-card"
              >
                <div class="category-header" @click="toggleCategory(category.name)">
                  <input type="checkbox" :checked="selectedCategories.includes(category.name)" />
                  <div class="category-info">
                    <h3>{{ category.name }}</h3>
                    <span class="action-count">{{ category.actions.length }} actions</span>
                  </div>
                  <svg viewBox="0 0 24 24" fill="currentColor" class="expand-icon" :class="{ expanded: expandedCategories.includes(category.name) }">
                    <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
                  </svg>
                </div>

                <div v-if="expandedCategories.includes(category.name)" class="actions-list">
                  <div 
                    v-for="action in category.actions" 
                    :key="action.name"
                    class="action-item-card"
                  >
                    <div class="action-header">
                      <span class="http-method" :class="`method-${action.http_method?.toLowerCase()}`">
                        {{ action.http_method }}
                      </span>
                      <span class="action-name">{{ action.name }}</span>
                    </div>
                    <div class="action-path">{{ action.endpoint_path }}</div>
                    <div class="action-description">{{ action.description }}</div>
                    <div v-if="action.parameters?.length" class="params-count">
                      {{ action.parameters.length }} parameters
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- JSON Tree View -->
          <div v-else-if="discoveryView === 'tree'" class="json-editor-wrapper">
            <MonacoJsonEditor 
              v-model="discoveredActionsJSON"
              label="📝 Discovered Actions (Tree View)"
              @update:modelValue="validateJSON"
            />
          </div>

          <!-- Raw JSON Editor -->
          <div v-else-if="discoveryView === 'raw'" class="raw-json-container">
            <div class="raw-json-toolbar">
              <span class="editor-label">✏️ Edit JSON (Raw)</span>
              <button class="btn-format" @click="formatJSON">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                Format
              </button>
            </div>
            <textarea 
              v-model="discoveredActionsJSON" 
              class="raw-json-editor"
              spellcheck="false"
              @input="validateJSON"
            ></textarea>
            <div v-if="jsonError" class="json-error">
              ❌ {{ jsonError }}
            </div>
            <div v-else class="json-valid">
              ✓ Valid JSON
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Examples -->
      <div v-if="currentStep === 3" class="examples-step">
        <div class="examples-layout">
          <!-- Actions Sidebar -->
          <div class="actions-sidebar">
            <div class="sidebar-header">
              <h3>Actions</h3>
              <span class="count">{{ actionsWithExamples }}/{{ actions.length }} have examples</span>
            </div>

            <div class="actions-list">
              <div
                v-for="action in actions"
                :key="action.name"
                :class="['action-item', { active: selectedAction?.name === action.name }]"
                @click="selectAction(action)"
              >
                <div class="example-status">
                  <span v-if="action.exampleCount > 0" class="badge-green">{{ action.exampleCount }}</span>
                  <span v-else class="badge-gray">0</span>
                </div>

                <div class="action-info">
                  <div class="action-name">{{ formatActionName(action.name) }}</div>
                  <div class="action-path">{{ action.http_method }} {{ action.endpoint_path }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Examples Manager -->
          <div class="examples-manager" v-if="selectedAction">
            <div class="manager-header">
              <div>
                <h2>{{ selectedAction.name }} Examples</h2>
                <p class="subtitle">Review spec examples and generate more with AI</p>
              </div>
              
              <!-- Save Draft Button -->
              <button class="btn-save-draft" @click="saveDraft()" :disabled="isSaving">
                <svg v-if="!isSaving" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" class="spin">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                {{ isSaving ? 'Saving...' : 'Save Draft' }}
              </button>
            </div>

            <!-- Examples Stats -->
            <div class="examples-stats">
              <div class="stat-item">
                <span class="stat-icon">📄</span>
                <div>
                  <div class="stat-value">{{ specExamplesCount }}</div>
                  <div class="stat-label">From OpenAPI Spec</div>
                </div>
              </div>
              <div class="stat-item">
                <span class="stat-icon">🤖</span>
                <div>
                  <div class="stat-value">{{ llmExamplesCount }}</div>
                  <div class="stat-label">LLM Generated</div>
                </div>
              </div>
              <div class="stat-item">
                <span class="stat-icon">👤</span>
                <div>
                  <div class="stat-value">{{ userExamplesCount }}</div>
                  <div class="stat-label">User Added</div>
                </div>
              </div>
            </div>

            <!-- LLM

 Generation -->
            <div v-if="specExamplesCount === 0 || llmExamplesCount === 0" class="llm-generation-card">
              <div class="llm-header">
                <svg viewBox="0 0 24 24" fill="#8b5cf6">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <div>
                  <h3>Generate Examples with AI</h3>
                  <p>Let GPT-4o create realistic examples based on the action schema</p>
                </div>
              </div>
              <button class="btn-generate-llm" @click="generateExamples" :disabled="generating">
                <svg v-if="!generating" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                <span v-if="generating">⏳ Generating...</span>
                <span v-else>Generate {{ specExamplesCount > 0 ? 'More' : ''  }} Examples</span>
              </button>
            </div>

            <!-- Examples List -->
            <div class="examples-list">
              <div v-for="(example, index) in selectedAction.examples || mockExamples" :key="index" class="example-card">
                <div class="example-header">
                  <div class="example-badge" :class="`badge-${example.example_source}`">
                    <span v-if="example.example_source === 'spec'">📄 Spec</span>
                    <span v-else-if="example.example_source === 'llm'">🤖 LLM</span>
                    <span v-else>👤 User</span>
                  </div>
                  <div class="example-validation">
                    <svg v-if="example.valid" viewBox="0 0 24 24" fill="#10b981">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                    <span :class="example.valid ? 'text-green' : 'text-red'">
                      {{ example.valid ? 'Valid' : 'Invalid' }}
                    </span>
                  </div>
                </div>

                <!-- View Mode -->
                <div v-if="editingExampleIndex !== index">
                  <pre class="example-code">{{ JSON.stringify(example.data, null, 2) }}</pre>

                  <div class="example-actions">
                    <button class="btn-icon" title="Edit" @click="editExample(index)">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </button>
                    <button class="btn-icon btn-delete" title="Delete" @click="deleteExample(index)">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Edit Mode -->
                <div v-else class="edit-mode">
                  <textarea 
                    v-model="editingExampleData" 
                    class="example-editor"
                    rows="15"
                    spellcheck="false"
                  ></textarea>
                  
                  <div v-if="editError" class="edit-error">
                    ⚠️ {{ editError }}
                  </div>

                  <div class="edit-actions">
                    <button class="btn-secondary" @click="cancelEdit()">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
                      </svg>
                      Cancel
                    </button>
                    <button class="btn-primary" @click="saveExample()">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                      </svg>
                      Save
                    </button>
                  </div>
                </div>
              </div>

              <button class="btn-add-example">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Add Custom Example
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 4: Review & Edit -->
      <div v-if="currentStep === 4" class="review-step">
        <div class="actions-sidebar">
          <div class="sidebar-header">
            <h3>Actions</h3>
            <span class="count">{{ readyActionsCount }} of {{ actions.length }} ready</span>
          </div>

          <div class="actions-list">
            <div
              v-for="action in actions"
              :key="action.name"
              :class="['action-item', { 
                active: selectedAction?.name === action.name,
                ready: action.status === 'ready',
                warning: action.status === 'warning',
                error: action.status === 'error'
              }]"
              @click="selectAction(action)"
            >
              <div class="action-status">
                <svg v-if="action.status === 'ready'" viewBox="0 0 24 24" fill="currentColor" class="icon-ready">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                <svg v-else-if="action.status === 'warning'" viewBox="0 0 24 24" fill="currentColor" class="icon-warning">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" class="icon-error">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
                </svg>
              </div>

              <div class="action-info">
                <div class="action-name">{{ formatActionName(action.name) }}</div>
                <div class="action-description">{{ action.description }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Editor -->
        <div class="action-editor" v-if="selectedAction">
          <div class="editor-header">
            <div class="action-title">
              <svg viewBox="0 0 24 24" fill="#3b82f6" class="title-icon">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
              </svg>
              <div>
                <h2>{{ selectedAction.name }}</h2>
                <p>{{ selectedAction.description }}</p>
              </div>
            </div>

            <div class="status-badges">
              <span class="badge badge-success">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
                Valid schema
              </span>
              <span class="badge badge-success">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                ≥1 approved example
              </span>
              <span class="badge badge-success">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
                </svg>
                LLM notes present
              </span>
            </div>
          </div>

          <!-- Tabs -->
          <div class="tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="['tab', { active: activeTab === tab.id }]"
              @click="activeTab = tab.id"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="tab-icon">
                <path v-if="tab.id === 'schema'" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
                <path v-else-if="tab.id === 'examples'" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                <path v-else-if="tab.id === 'documentation'" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z"/>
                <path v-else d="M8 5v14l11-7z"/>
              </svg>
              {{ tab.label }}
            </button>
          </div>

          <!-- Tab Content -->
          <div class="tab-content">
            <div v-if="activeTab === 'test'" class="test-tab">
              <div class="test-header">
                <h3>Agent Simulation</h3>
                <p class="test-description">
                  Lightweight test to verify agent understands this action
                </p>
              </div>

              <div class="test-info-box">
                <svg viewBox="0 0 24 24" fill="#f59e0b">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                <div>
                  <strong>What this test does:</strong>
                  <ul>
                    <li>Validates schema structure is parseable</li>
                    <li>Checks LLM notes are comprehensive</li>
                    <li>Verifies examples match schema</li>
                    <li>Simulates agent action selection</li>
                    <li><strong>No actual API calls are made</strong></li>
                  </ul>
                </div>
              </div>

              <div class="test-placeholder">
                <svg viewBox="0 0 24 24" fill="#94a3b8" class="placeholder-icon">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <p>Run a test to verify agent understanding</p>
              </div>

              <button 
                class="run-test-btn" 
                @click="runActionTest"
                :disabled="testingAction || !selectedAction"
              >
                <svg v-if="testingAction" class="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ testingAction ? 'Testing...' : 'Run Test' }}
              </button>

              <button 
                class="agent-test-btn" 
                @click="runAgentTest"
                :disabled="testingAgent || !selectedAction"
              >
                <svg v-if="testingAgent" class="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {{ testingAgent ? 'Testing Agent...' : 'Agent Test' }}
              </button>

              <!-- Test Results -->
              <div v-if="actionTestResult" class="test-result-panel" :class="{ success: actionTestResult.success, error: !actionTestResult.success }">
                <div class="result-header">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path v-if="actionTestResult.success" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    <path v-else d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  <strong>{{ actionTestResult.success ? 'Test Passed' : 'Test Failed' }}</strong>
                </div>
                <div v-if="actionTestResult.response" class="result-body">
                  <div class="result-section">
                    <label>Response:</label>
                    <pre><code>{{ JSON.stringify(actionTestResult.response, null, 2) }}</code></pre>
                  </div>
                  <small v-if="actionTestResult.response_time_ms">Response time: {{ actionTestResult.response_time_ms }}ms</small>
                </div>
                <p v-else class="result-error">{{ actionTestResult.error || 'Unknown error' }}</p>
              </div>

              <!-- Agent Test Results -->
              <div v-if="agentTestResult" class="agent-test-results">
                <h4>Agent Comprehension Test Results</h4>
                <div class="success-summary">
                  <span class="success-rate">Success Rate: {{ (agentTestResult.success_rate * 100).toFixed(0) }}%</span>
                </div>
                
                <div v-for="result in agentTestResult.results" :key="result.model" class="model-result">
                  <div class="model-header">
                    <span class="model-name">{{ result.model }}</span>
                    <span class="model-status" :class="{ valid: result.valid, invalid: !result.valid }">
                      {{ result.valid ? '✓ Valid' : '✗ Invalid' }}
                    </span>
                    <span class="generation-time">{{ result.generation_time_ms }}ms</span>
                  </div>
                  
                  <div v-if="result.generated_payload" class="generated-payload">
                    <label>Generated Payload:</label>
                    <pre><code>{{ JSON.stringify(result.generated_payload, null, 2) }}</code></pre>
                  </div>
                  
                  <div v-if="result.validation_errors && result.validation_errors.length > 0" class="validation-errors">
                    <label>Validation Errors:</label>
                    <ul>
                      <li v-for="(error, idx) in result.validation_errors" :key="idx">{{ error }}</li>
                    </ul>
                  </div>

                  <!-- Connectivity Test Button (bottom of each valid result) -->
                  <div v-if="result.valid && result.generated_payload" class="connectivity-test-section">
                    <button 
                      @click="testActionWithCredentials(result.generated_payload)" 
                      class="connectivity-test-btn"
                      :disabled="testingAction"
                    >
                      {{ testingAction ? '⏳ Testing...' : '🔌 Test Connectivity' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Schema Tab -->
            <div v-else-if="activeTab === 'schema'" class="schema-tab">
              <div v-if="selectedAction" class="schema-content">
                <div class="schema-section">
                  <h4>Endpoint</h4>
                  <div class="endpoint-info">
                    <span class="method-badge" :class="selectedAction.http_method.toLowerCase()">
                      {{ selectedAction.http_method }}
                    </span>
                    <code>{{ selectedAction.endpoint_path }}</code>
                  </div>
                </div>

                <div v-if="selectedAction.parameters && selectedAction.parameters.length > 0" class="schema-section">
                  <h4>Parameters</h4>
                  <div class="parameters-list">
                    <div v-for="param in selectedAction.parameters" :key="param.name" class="parameter-item">
                      <div class="param-header">
                        <span class="param-name">{{ param.name }}</span>
                        <span class="param-type">{{ param.type || 'string' }}</span>
                        <span v-if="param.required" class="param-required">required</span>
                      </div>
                      <p v-if="param.description" class="param-desc">{{ param.description }}</p>
                    </div>
                  </div>
                </div>

                <div v-else class="empty-state">
                  <p>No parameters defined for this action</p>
                </div>
              </div>
            </div>

            <!-- Examples Tab -->
            <div v-else-if="activeTab === 'examples'" class="examples-tab">
              <div v-if="selectedAction && selectedAction.examples && selectedAction.examples.length > 0" class="examples-content">
                <div v-for="(example, idx) in selectedAction.examples" :key="idx" class="example-item">
                  <div class="example-header">
                    <h4>Example {{ idx + 1 }}</h4>
                    <span class="example-status">{{ example.status || 'approved' }}</span>
                  </div>
                  <div class="example-body">
                    <div v-if="example.request_params" class="example-section">
                      <label>Request Parameters:</label>
                      <pre><code>{{ JSON.stringify(example.request_params, null, 2) }}</code></pre>
                    </div>
                    <div v-if="example.expected_output" class="example-section">
                      <label>Expected Output:</label>
                      <pre><code>{{ JSON.stringify(example.expected_output, null, 2) }}</code></pre>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state">
                <p>No examples available for this action</p>
                <button class="btn-secondary">Generate Examples</button>
              </div>
            </div>

            <!-- Documentation Tab -->
            <div v-else-if="activeTab === 'documentation'" class="documentation-tab">
              <div v-if="selectedAction" class="documentation-content">
                <div class="doc-section">
                  <h4>Description</h4>
                  <p>{{ selectedAction.description || 'No description available' }}</p>
                </div>

                <div class="doc-section">
                  <h4>Action Details</h4>
                  <div class="details-grid">
                    <div class="detail-item">
                      <span class="detail-label">Tool Name</span>
                      <code>{{ selectedAction.tool_name }}</code>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">HTTP Method</span>
                      <code>{{ selectedAction.http_method }}</code>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Endpoint</span>
                      <code>{{ selectedAction.endpoint_path }}</code>
                    </div>
                  </div>
                </div>

                <div v-if="selectedAction.category" class="doc-section">
                  <h4>Category</h4>
                  <span class="category-badge">{{ selectedAction.category }}</span>
                </div>
              </div>
            </div>

            <div v-else class="tab-placeholder">
              <p>{{ activeTab }} tab (coming soon)</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 5: Final Review & Register -->
      <div v-if="currentStep === 5" class="register-step">
        <div class="step-card">
          <div v-if="!registering && !registered" class="review-page">
            <!-- Review Header -->
            <div class="review-header">
              <div class="success-icon large">🚀</div>
              <h2>Final Review</h2>
              <p class="subtitle">Review your service configuration before activation</p>
            </div>

            <!-- Service Information Card -->
            <div class="review-section">
              <h3>📋 Service Information</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">Service Name</span>
                  <span class="value">{{ formData.name }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Description</span>
                  <span class="value">{{ formData.description || 'No description' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Category</span>
                  <span class="value">{{ formData.category }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Base URL</span>
                  <span class="value code">{{ formData.baseUrl }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Authentication</span>
                  <span class="value">{{ authTypes.find(t => t.value === formData.authType)?.label || formData.authType }}</span>
                </div>
              </div>
            </div>

            <!-- Actions Summary -->
            <div class="review-section">
              <h3>⚡ Actions Summary</h3>
              <div class="stats-grid">
                <div class="stat-box">
                  <div class="stat-value">{{ actions.length }}</div>
                  <div class="stat-label">Total Actions</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value">{{ selectedCategories.length }}</div>
                  <div class="stat-label">Categories</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value">{{ actionsWithExamples }}</div>
                  <div class="stat-label">With Examples</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value">{{ readyActionsCount }}</div>
                  <div class="stat-label">Ready to Deploy</div>
                </div>
              </div>
              
              <!-- Top Actions List -->
              <div v-if="actions.length > 0" class="top-actions">
                <h4>Featured Actions</h4>
                <div class="action-chips">
                  <div v-for="action in actions.slice(0, 8)" :key="action.name" class="action-chip">
                    <span class="method-badge" :class="action.http_method.toLowerCase()">{{ action.http_method }}</span>
                    <span class="action-name">{{ action.name }}</span>
                  </div>
                  <div v-if="actions.length > 8" class="more-chip">
                    +{{ actions.length - 8 }} more
                  </div>
                </div>
              </div>
            </div>

            <!-- Schema Quality (if applicable) -->
            <div v-if="openApiSpec" class="review-section">
              <h3>📊 Configuration Quality</h3>
              <div class="quality-metrics">
                <div class="metric">
                  <div class="metric-bar">
                    <div class="metric-fill" :style="{ width: (actions.length > 0 ? '100%' : '0%') }"></div>
                  </div>
                  <span class="metric-label">Actions Discovered</span>
                  <span class="metric-status">{{ actions.length > 0 ? '✓' : '○' }}</span>
                </div>
                <div class="metric">
                  <div class="metric-bar">
                    <div class="metric-fill" :style="{ width: (actionsWithExamples > 0 ? Math.round((actionsWithExamples / actions.length) * 100) + '%' : '0%') }"></div>
                  </div>
                  <span class="metric-label">Examples Generated</span>
                  <span class="metric-status">{{ actionsWithExamples > 0 ? '✓' : '○' }}</span>
                </div>
                <div class="metric">
                  <div class="metric-bar">
                    <div class="metric-fill" :style="{ width: (selectedCategories.length > 0 ? '100%' : '0%') }"></div>
                  </div>
                  <span class="metric-label">Categories Selected</span>
                  <span class="metric-status">{{ selectedCategories.length > 0 ? '✓' : '○' }}</span>
                </div>
              </div>
            </div>

            <!-- Test Connection Option -->
            <div class="review-section">
              <h3>🔌 Connection Test</h3>
              <p class="section-desc">Test the connection before activating the service</p>
              <button class="btn-test-connection" @click="testConnection" :disabled="testingConnection">
                <svg v-if="!testingConnection" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" class="spin">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                {{ testingConnection ? 'Testing...' : 'Test Connection' }}
              </button>
              
              <div v-if="connectionTestResult" class="test-result" :class="{ success: connectionTestResult.success, error: !connectionTestResult.success }">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path v-if="connectionTestResult.success" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                  <path v-else d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <div>
                  <strong>{{ connectionTestResult.success ? 'Connection Successful!' : 'Connection Failed' }}</strong>
                  <p>{{ connectionTestResult.message }}</p>
                  <small v-if="connectionTestResult.response_time_ms">Response time: {{ connectionTestResult.response_time_ms }}ms</small>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="register-actions">
              <button class="btn-secondary" @click="currentStep = 3">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
                Back to Examples
              </button>
              <button class="btn-primary btn-large" @click="finalizeRegistration" :disabled="actions.length === 0">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                Activate Service
              </button>
            </div>
          </div>

          <div v-if="registering" class="registering-state">
            <div class="loader"></div>
            <h3>Registering Service...</h3>
            <p>Creating service and deploying actions</p>
          </div>

          <div v-if="registered" class="registered-state">
            <div class="success-icon large">✓</div>
            <h2>Service Registered Successfully!</h2>
            <p>Your service is now available to all agents</p>
            
            <div class="actions-grid">
              <button class="btn-secondary" @click="viewService">View Service</button>
              <button class="btn-primary" @click="registerAnother">Register Another</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="bottom-actions">
      <button v-if="currentStep > 1" class="btn-back" @click="goBack">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Back
      </button>

      <div class="spacer"></div>

      <button v-if="currentStep === 1" class="btn-primary" @click="discoverActions" :disabled="!canProceedFromStep1">
        Next: Discover Actions
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>
        </svg>
      </button>

      <button v-if="currentStep === 2" class="btn-primary" @click="goNext" :disabled="selectedCategories.length === 0">
        Continue to Examples
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>
        </svg>
      </button>

      <button v-if="currentStep === 3" class="btn-primary" @click="goNext">
        Continue to Review
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>
        </svg>
      </button>

      <button v-if="currentStep === 4" class="btn-primary" @click="goNext">
        Finalize Registration
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>
        </svg>
      </button>

      <button v-if="currentStep === 5 && !registering && !registered" class="btn-register" @click="finalizeRegistration">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
        </svg>
        Register Service
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../services/api'
import MonacoJsonEditor from '../components/MonacoJsonEditor.vue'

const router = useRouter()
const route = useRoute()

onMounted(async () => {
  // Check if we have a draft ID in the query parameters
  const draftId = route.query.draft
  if (draftId) {
    await loadDraft(draftId)
  }
  
  // Setup auto-save every 30 seconds
  autoSaveInterval.value = setInterval(() => {
    if (hasUnsavedChanges.value && canSaveDraft()) {
      saveDraft(true) // true = auto-save
    }
  }, 30000)
  
  // Setup keyboard shortcuts
  window.addEventListener('keydown', handleKeyboardShortcut)
  
  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', handleBeforeUnload)
  
  // Reload draft when window gains focus (in case service was edited in another tab/modal)
  window.addEventListener('focus', handleWindowFocus)
})

// Handle window focus - reload draft if it exists
async function handleWindowFocus() {
  const draftId = route.query.draft
  if (draftId && serviceId.value) {
    console.log('Window focused - reloading draft to get latest changes')
    await loadDraft(draftId)
  }
}

// Cleanup on unmount
function onBeforeUnmount() {
  if (autoSaveInterval.value) {
    clearInterval(autoSaveInterval.value)
  }
  window.removeEventListener('keydown', handleKeyboardShortcut)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('focus', handleWindowFocus)
}

const currentStep = ref(1)
const activeTab = ref('test')

const tabs = [
  { id: 'schema', label: 'Schema' },
  { id: 'examples', label: 'Examples' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'test', label: 'Test' }
]

// Step 1: Connect
const formData = ref({
  name: '',
  description: '',
  category: '',
  baseUrl: '',
  authType: 'api-key',
  specFile: null,
  specUrl: ''
})

const authTypes = [
  { value: 'api-key', label: 'API Key', icon: '🔑' },
  { value: 'oauth2', label: 'OAuth 2.0', icon: '🔐' },
  { value: 'bearer', label: 'Bearer Token', icon: '🎟️' },
  { value: 'basic', label: 'Basic Auth', icon: '👤' }
]

const canProceedFromStep1 = computed(() => {
  return formData.value.name && formData.value.baseUrl && (formData.value.specFile || formData.value.specUrl)
})

const discovering = ref(false)
const discoveryError = ref(null)
const discoveryView = ref('cards') // 'cards' or 'json'
const discoveredActionsJSON = ref('')
const jsonError = ref(null)

// GraphQL detection
const graphqlHint = ref(null)
const graphqlEndpointUrl = ref('')
const graphqlAuthToken = ref('')
const rediscoveringGraphQL = ref(false)

// Step 2: Discovery
const categories = ref([]) // Real data from API discovery
const actions = ref([]) // All actions (flat list for Step 3)
const openApiSpec = ref(null) // Store the OpenAPI spec for enrichment
const selectedCategories = ref([])
const expandedCategories = ref(['User Management'])
const discoveredActions = computed(() => {
  return categories.value.reduce((acc, cat) => acc + cat.actions.length, 0)
})
const selectedActions = computed(() => {
  return categories.value
    .filter(cat => selectedCategories.value.includes(cat.name))
    .reduce((acc, cat) => acc + cat.actions.length, 0)
})

const enrichmentStats = ref({
  total: 5,
  enriched: 5,
  validated: 5,
  repaired: 2
})

// Step 3: Examples
const selectedAction = ref(null)
const editingExampleIndex = ref(null)
const editingExampleData = ref(null)
const editError = ref(null)

// Draft Save State
const serviceId = ref(null)
const isSaving = ref(false)
const lastSaved = ref(null)
const saveError = ref(null)
const hasUnsavedChanges = ref(false)
const autoSaveInterval = ref(null)

// Connection Test State
const testingConnection = ref(false)
const connectionTestResult = ref(null)

// Action Test State
const testingAction = ref(false)
const actionTestResult = ref(null)

// Agent Test State 
const testingAgent = ref(false)
const agentTestResult = ref(null)

const actionsWithExamples = computed(() => {
  return actions.value.filter(a => (a.exampleCount || 0) > 0).length
})

const specExamplesCount = computed(() => {
  if (!selectedAction.value || !selectedAction.value.examples) return 0
  return selectedAction.value.examples.filter(e => e.example_source === 'spec').length
})

const llmExamplesCount = computed(() => {
  if (!selectedAction.value || !selectedAction.value.examples) return 0
  return selectedAction.value.examples.filter(e => e.example_source === 'llm').length
})

const userExamplesCount = computed(() => {
  if (!selectedAction.value || !selectedAction.value.examples) return 0
  return selectedAction.value.examples.filter(e => e.example_source === 'user').length
})
const readyActionsCount = computed(() => actions.value.filter(a => a.status === 'ready').length)

// Step 4: Register
const registering = ref(false)
const registered = ref(false)

// Methods
function handleFileUpload(event) {
  formData.value.specFile = event.target.files[0]
}

function toggleCategory(name) {
  const index = selectedCategories.value.indexOf(name)
  if (index > -1) {
    selectedCategories.value.splice(index, 1)
  } else {
    selectedCategories.value.push(name)
  }
  
  // Also toggle expansion
  const expIndex = expandedCategories.value.indexOf(name)
  if (expIndex > -1) {
    expandedCategories.value.splice(expIndex, 1)
  } else {
    expandedCategories.value.push(name)
  }
}

async function discoverActions() {
  if (!canProceedFromStep1.value) return

  discovering.value = true
  discoveryError.value = null

  try {
    const response = await api.discoverActions({
      specFile: formData.value.specFile,
      specUrl: formData.value.specUrl,
      baseUrl: formData.value.baseUrl,
      discoveryMethod: 'openapi'
    })

    const data = response.data
    
    // Transform backend response to wizard format
    const categoriesMap = {}
    
    if (data.categories) {
      // Backend returns categories object
      Object.entries(data.categories).forEach(([catName, catData]) => {
        categoriesMap[catName] = {
          name: catName,
          actions: catData.actions.map(action => ({
            ...action,
            exampleCount: (action.examples || []).length
          }))
        }
      })
    }
    
    // Build examples array for each action from parameters
    Object.values(categoriesMap).forEach(category => {
      category.actions = category.actions.map(action => {
        const examples = []
        
        // Extract examples from parameters
        if (action.parameters && action.parameters.length > 0) {
          const exampleData = {}
          let hasExamples = false
          
          action.parameters.forEach(param => {
            if (param.example !== undefined) {
              // Build nested object structure from dot notation (e.g., "data.name")
              const keys = param.name.split('.')
              let current = exampleData
              
              for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i].replace(/\[\]/g, '') // Remove array brackets
                if (!current[key]) {
                  current[key] = {}
                }
                current = current[key]
              }
              
              const finalKey = keys[keys.length - 1].replace(/\[\]/g, '')
              current[finalKey] = param.example
              hasExamples = true
            }
          })
          
          if (hasExamples) {
            examples.push({
              example_source: 'spec',
              data: exampleData,
              valid: true
            })
          }
        }
        
        return {
          ...action,
          examples,
          exampleCount: examples.length
        }
      })
    })
    
    // Store the OpenAPI spec for later enrichment
    if (data.openapi_doc) {
      openApiSpec.value = data.openapi_doc
    }
    
    // Update wizard state with real data  
    categories.value = Object.values(categoriesMap)
    
    // Flatten all actions from categories for Step 3
    actions.value = categories.value.flatMap(cat => cat.actions)
    
    // Populate JSON editor
    discoveredActionsJSON.value = JSON.stringify(data, null, 2)
    
    // Auto-select all categories by default
    selectedCategories.value = categories.value.map(cat => cat.name)
    expandedCategories.value = [categories.value[0]?.name].filter(Boolean)
    
    // Select first action with examples for Step 3
    const firstActionWithExamples = actions.value.find(action => action.exampleCount > 0)
    
    if (firstActionWithExamples) {
      selectedAction.value = firstActionWithExamples
    }
    
    // Check for GraphQL hint
    if (data.graphql_hint) {
      graphqlHint.value = data.graphql_hint
      // Pre-fill the endpoint URL from the detected base_url + endpoint path
      const hint = data.graphql_hint
      if (hint.base_url && hint.detected_endpoint) {
        graphqlEndpointUrl.value = hint.base_url + hint.detected_endpoint
      }
    } else {
      graphqlHint.value = null
    }

    // Move to next step
    currentStep.value = 2
  } catch (error) {
    console.error('Discovery failed:', error)
    discoveryError.value = error.response?.data?.error || error.message
    alert('Failed to discover actions: ' + discoveryError.value)
  } finally {
    discovering.value = false
  }
}

async function rediscoverGraphQL() {
  if (!graphqlEndpointUrl.value) return

  rediscoveringGraphQL.value = true
  discoveryError.value = null

  try {
    const requestData = new FormData()
    requestData.append('graphql_endpoint', graphqlEndpointUrl.value)
    requestData.append('base_url', formData.value?.baseUrl || graphqlEndpointUrl.value)
    requestData.append('discovery_method', 'graphql')
    
    // Add auth header if provided (Shopify uses X-Shopify-Access-Token)
    if (graphqlAuthToken.value) {
      requestData.append('auth_header_X-Shopify-Access-Token', graphqlAuthToken.value)
    }

    const response = await api.post('/services/discover/', requestData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    })

    const data = response.data

    // Re-populate wizard with GraphQL introspection results
    const categoriesMap = {}
    if (data.categories) {
      Object.entries(data.categories).forEach(([catName, catData]) => {
        categoriesMap[catName] = {
          name: catName,
          actions: catData.actions.map(action => ({
            ...action,
            exampleCount: (action.examples || []).length
          }))
        }
      })
    }

    categories.value = Object.values(categoriesMap)
    actions.value = categories.value.flatMap(cat => cat.actions)
    discoveredActionsJSON.value = JSON.stringify(data, null, 2)
    selectedCategories.value = categories.value.map(cat => cat.name)
    expandedCategories.value = [categories.value[0]?.name].filter(Boolean)

    // Update base URL if returned
    if (data.base_url) {
      formData.value.baseUrl = data.base_url
    }

    // Clear GraphQL hint — introspection was successful
    graphqlHint.value = null

    console.log(`GraphQL introspection discovered ${actions.value.length} actions`)
  } catch (error) {
    console.error('GraphQL introspection failed:', error)
    alert('GraphQL introspection failed: ' + (error.response?.data?.error || error.message) + 
          '\n\nMake sure the endpoint is accessible and supports introspection queries.')
  } finally {
    rediscoveringGraphQL.value = false
  }
}

function validateJSON() {
  try {
    const parsed = JSON.parse(discoveredActionsJSON.value)
    jsonError.value = null
    
    // Sync JSON edits back to categories
    if (parsed.categories) {
      const categoriesMap = {}
      Object.entries(parsed.categories).forEach(([catName, catData]) => {
        categoriesMap[catName] = {
          name: catName,
          actions: catData.actions.map(action => ({
            ...action,
            exampleCount: (action.examples || []).length
          }))
        }
      })
      categories.value = Object.values(categoriesMap)
    }
  } catch (error) {
    jsonError.value = error.message
  }
}

function formatJSON() {
  try {
    const parsed = JSON.parse(discoveredActionsJSON.value)
    discoveredActionsJSON.value = JSON.stringify(parsed, null, 2)
    jsonError.value = null
  } catch (error) {
    jsonError.value = 'Cannot format invalid JSON'
  }
}

function startEnrichment() {
  enriching.value = true
  enrichmentProgress.value = 0
  
  const interval = setInterval(() => {
    enrichmentProgress.value += 10
    if (enrichmentProgress.value >= 100) {
      clearInterval(interval)
      enriching.value = false
      enriched.value = true
    }
  }, 300)
}

function selectAction(action) {
  selectedAction.value = action
}

const generating = ref(false)

async function generateExamples() {
  if (!selectedAction.value) return
  
  try {
    generating.value = true
    
    // Check if we have the OpenAPI spec
    if (!openApiSpec.value) {
      alert('OpenAPI spec not available. Please re-run discovery.')
      return
    }
    
    // Use the existing enrich-schemas endpoint
    const response = await api.post('/services/enrich-schemas/', {
      service_name: formData.value.name || 'Service',
      openapi_doc: openApiSpec.value,
      actions: [selectedAction.value],
      api_documentation: ''
    }, {
      timeout: 120000  // 2 minutes timeout for LLM enrichment
    })
    
    // Extract enriched schema with examples
    const enrichedAction = response.data.enriched_actions?.[0]
    if (enrichedAction && enrichedAction.invocation_schema?.examples) {
      // Add LLM-generated examples to the action
      const llmExamples = enrichedAction.invocation_schema.examples.map(ex => ({
        example_source: 'llm',
        data: ex,
        valid: true
      }))
      
      if (!selectedAction.value.examples) {
        selectedAction.value.examples = []
      }
      
      selectedAction.value.examples.push(...llmExamples)
      selectedAction.value.exampleCount = selectedAction.value.examples.length
      
      // Update the action in the actions list
      const actionIndex = actions.value.findIndex(a => a.name === selectedAction.value.name)
      if (actionIndex !== -1) {
        actions.value[actionIndex] = selectedAction.value
      }
    }
    
  } catch (error) {
    console.error('Failed to generate examples:', error)
    alert('Failed to generate examples: ' + (error.response?.data?.error || error.message))
  } finally {
    generating.value = false
  }
}

function editExample(index) {
  editingExampleIndex.value = index
  editingExampleData.value = JSON.stringify(
    selectedAction.value.examples[index].data,
    null,
    2
  )
  editError.value = null
}

function saveExample() {
  if (editingExampleIndex.value === null) return
  
  try {
    // Validate JSON
    const parsedData = JSON.parse(editingExampleData.value)
    
    // Update the example
    selectedAction.value.examples[editingExampleIndex.value].data = parsedData
    
    // Update the action in the actions list
    const actionIndex = actions.value.findIndex(a => a.name === selectedAction.value.name)
    if (actionIndex !== -1) {
      actions.value[actionIndex] = selectedAction.value
    }
    
    // Clear edit state
    editingExampleIndex.value = null
    editingExampleData.value = null
    editError.value = null
  } catch (error) {
    editError.value = 'Invalid JSON: ' + error.message
  }
}

function cancelEdit() {
  editingExampleIndex.value = null
  editingExampleData.value = null
  editError.value = null
}

function deleteExample(index) {
  if (!selectedAction.value || !selectedAction.value.examples) return
  
  if (confirm('Delete this example?')) {
    selectedAction.value.examples.splice(index, 1)
    selectedAction.value.exampleCount = selectedAction.value.examples.length
    
    // Update the action in the actions list
    const actionIndex = actions.value.findIndex(a => a.name === selectedAction.value.name)
    if (actionIndex !== -1) {
      actions.value[actionIndex] = selectedAction.value
    }
  }
}

function formatActionName(name) {
  return name.replace(/([A-Z])/g, ' $1').trim()
}

function goToStep(step) {
  // Only allow going back or to current step
  if (step <= currentStep.value) {
    currentStep.value = step
  }
}

function goBack() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

function goNext() {
  if (currentStep.value < 5) {
    currentStep.value++
  }
}

// Validation
function canSaveDraft() {
  if (currentStep.value === 1) {
    return formData.value.name && formData.value.baseUrl
  }
  if (currentStep.value === 2) {
    return categories.value.length > 0 || actions.value.length > 0
  }
  return true
}

// Keyboard shortcut handler
function handleKeyboardShortcut(e) {
  // Ctrl+S or Cmd+S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (canSaveDraft()) {
      saveDraft()
    }
  }
  // Ctrl+Enter to go to next step
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    if (currentStep.value < 5) {
      nextStep()
    }
  }
}

// Warn before leaving
function handleBeforeUnload(e) {
  if (hasUnsavedChanges.value) {
    e.preventDefault()
    e.returnValue = ''
    return ''
  }
}

async function saveDraft(isAutoSave = false) {
  isSaving.value = true
  saveError.value = null
  
  try {
    const wizardState = {
      currentStep: currentStep.value,
      formData: formData.value,
      categories: categories.value,
      actions: actions.value,
      selectedCategories: selectedCategories.value,
      openApiSpec: openApiSpec.value,
      selectedAction: selectedAction.value
    }
    
    const response = await api.saveDraft({
      service_id: serviceId.value,
      wizard_state: wizardState,
      current_step: currentStep.value,
      metadata: {
        name: formData.value.name,
        description: formData.value.description,
        category: formData.value.category,
        base_url: formData.value.baseUrl,
        auth_type: formData.value.authType
      }
    })
    
    serviceId.value = response.data.service_id
    lastSaved.value = new Date()
    
    // Sync action IDs from backend response
    if (response.data.action_ids && response.data.action_ids.length > 0) {
      // Update actions array with database IDs from backend
      response.data.action_ids.forEach((id, index) => {
        if (actions.value[index]) {
          actions.value[index].id = id
        }
      })
      
      // Update selectedAction if it exists
      if (selectedAction.value) {
        const selectedIndex = actions.value.findIndex(a => a.tool_name === selectedAction.value.tool_name)
        if (selectedIndex >= 0 && actions.value[selectedIndex].id) {
          selectedAction.value.id = actions.value[selectedIndex].id
        }
      }
      
      console.log('Actions synced with database IDs:', actions.value.map(a => ({ name: a.name, id: a.id })))
    }
    
    // Show success notification
    console.log(isAutoSave ? 'Auto-saved draft' : 'Draft saved successfully:', response.data)
    lastSaved.value = new Date()
    saveError.value = null
    hasUnsavedChanges.value = false
    
    if (!isAutoSave) {
      // Show success message (will use toast when available)
      console.info('✓ Draft saved successfully')
    }
  } catch (error) {
    console.error('Failed to save draft:', error)
    saveError.value = error.response?.data?.error || error.message
  } finally {
    isSaving.value = false
  }
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000)
  
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

async function loadDraft(draftId) {
  try {
    const response = await api.loadDraft(draftId)
    const draft = response.data
    
    // Restore service ID
    serviceId.value = draft.service_id
    
    // Restore wizard state
    const state = draft.wizard_state
    if (state) {
      // Restore form data
      if (state.formData) {
        Object.assign(formData.value, state.formData)
      }
      
      // Restore categories and actions
      if (state.categories) {
        categories.value = state.categories
      }
      if (state.actions) {
        actions.value = state.actions
      }
      if (state.selectedCategories) {
        selectedCategories.value = state.selectedCategories
      }
      if (state.openApiSpec) {
        openApiSpec.value = state.openApiSpec
      }
      if (state.selectedAction) {
        selectedAction.value = state.selectedAction
      }
      
      // Restore current step
      if (state.currentStep) {
        currentStep.value = state.currentStep
      }
    }
    
    console.log('Draft loaded successfully:', draft)
  } catch (error) {
    console.error('Failed to load draft:', error)
    alert('Failed to load draft')
  }
}

// Test Connection
async function testConnection() {
  if (!serviceId.value) {
    connectionTestResult.value = {
      success: false,
      message: 'Please save draft first before testing connection'
    }
    return
  }
  testingConnection.value = true
  connectionTestResult.value = null
  
  try {
    const response = await api.post(`/services/${serviceId.value}/test-connection/`)
    connectionTestResult.value = response.data
  } catch (error) {
    connectionTestResult.value = {
      success: false,
      message: error.response?.data?.error || error.message || 'Connection test failed'
    }
  } finally {
    testingConnection.value = false
  }
}

// Test Action
async function runActionTest() {
  console.log('=== RUN ACTION TEST CALLED ===')
  console.log('Selected Action:', selectedAction.value)
  
  if (!selectedAction.value) {
    alert('No action selected')
    return
  }
  
  console.log('Action ID:', selectedAction.value.id)
  console.log('Action tool_name:', selectedAction.value.tool_name)
  
  // Check if action has an ID (from database)
  if (!selectedAction.value.id) {
    console.warn('Action has no ID, attempting auto-save...')
    
    // Auto-save draft if not already saved
    if (!serviceId.value) {
      console.log('No serviceId, saving draft...')
      await saveDraft()
      
      // Check if save succeeded
      if (!serviceId.value) {
        alert('Failed to save draft. Please try manually saving first.')
        return
      }
    } else {
      console.log('Service already saved (ID:', serviceId.value, '), re-saving to sync action IDs...')
      await saveDraft()
    }
    
    // Check again after save
    console.log('After save - Selected Action:', selectedAction.value)
    console.log('After save - Action ID:', selectedAction.value.id)
    
    if (!selectedAction.value.id) {
      console.error('Action still has no ID after save!')
      console.error('All actions:', actions.value.map(a => ({ name: a.name, tool_name: a.tool_name, id: a.id })))
      alert('Action must be saved to database before testing. Please refresh and try again.')
      return
    }
  }
  
  console.log(`Testing action ${selectedAction.value.id} for service ${serviceId.value}`)
  testingAction.value = true
  actionTestResult.value = null
  
  try {
    // Build sample parameters from action schema
    const sampleParams = {}
    if (selectedAction.value.parameters && selectedAction.value.parameters.length > 0) {
      selectedAction.value.parameters.forEach(param => {
        if (param.required) {
          // Use example value or generate default based on type
          if (param.type === 'string') {
            sampleParams[param.name] = param.example || 'test'
          } else if (param.type === 'number' || param.type === 'integer') {
            sampleParams[param.name] = param.example || 1
          } else if (param.type === 'boolean') {
            sampleParams[param.name] = param.example !== undefined ? param.example : true
          } else {
            sampleParams[param.name] = param.example || {}
          }
        }
      })
    }
    
    console.log('Test parameters:', sampleParams)
    
    // Call test endpoint
    const response = await api.post(
      `/services/${serviceId.value}/actions/${selectedAction.value.id}/test/`,
      { parameters: sampleParams }
    )
    
    console.log('Test result:', response.data)
    actionTestResult.value = response.data
  } catch (error) {
    console.error('Test failed:', error)
    actionTestResult.value = {
      success: false,
      error: error.response?.data?.error || error.message || 'Test failed'
    }
  } finally {
    testingAction.value = false
  }
}

// Agent comprehension test function
async function runAgentTest() {
  console.log('=== RUN AGENT TEST CALLED ===')
  
  if (!selectedAction.value) {
    alert('No action selected')
    return
  }
  
  // Ensure action has an ID
  if (!selectedAction.value.id) {
    console.warn('Action has no ID, attempting auto-save...')
    await saveDraft()
    
    if (!selectedAction.value.id) {
      alert('Action must be saved to database before testing. Please save the draft first.')
      return
    }
  }
  
  console.log(`Running agent test for action ${selectedAction.value.id}`)
  console.log('Action details:', {
    id: selectedAction.value.id,
    name: selectedAction.value.name,
    tool_name: selectedAction.value.tool_name,
    endpoint: selectedAction.value.endpoint_path
  })
  testingAgent.value = true
  agentTestResult.value = null
  
  try {
    const url = `/services/${serviceId.value}/actions/${selectedAction.value.id}/agent-test/`
    console.log(`Calling: ${url}`)
    
    // Send examples if available
    const requestBody = {}
    if (selectedAction.value.examples && selectedAction.value.examples.length > 0) {
      requestBody.examples = selectedAction.value.examples
      console.log(`Sending ${selectedAction.value.examples.length} examples`)
    }
    
    const response = await api.post(url, requestBody)
    
    console.log('Agent test result:', response.data)
    agentTestResult.value = response.data
  } catch (error) {
    console.error('Agent test failed:', error)
    alert(`Agent test failed: ${error.response?.data?.error || error.message}`)
  } finally {
    testingAgent.value = false
  }
}

// Test action using service credentials with toast feedback
async function testActionWithCredentials(payload = null) {
  if (!selectedAction.value || !selectedAction.value.id) {
    showToast('No action selected', 'error')
    return
  }
  
  if (!serviceId.value) {
    showToast('Service not saved yet', 'error')
    return
  }
  
  testingAction.value = true
  
  try {
    // Call backend test endpoint with optional payload
    const response = await api.post(
      `/services/${serviceId.value}/actions/${selectedAction.value.id}/test/`,
      payload ? { parameters: payload } : {}
    )
    
    console.log('Connectivity test result:', response.data)
    
    // Show success toast with response time
    if (response.data.success) {
      const time = response.data.response_time_ms || 'unknown'
      showToast(`✅ Connection successful! (${time}ms)`, 'success')
    } else {
      showToast(`❌ Test failed: ${response.data.error || 'Unknown error'}`, 'error')
    }
  } catch (error) {
    console.error('Connectivity test failed:', error)
    const errorMsg = error.response?.data?.error || error.message || 'Test failed'
    showToast(`❌ ${errorMsg}`, 'error')
  } finally {
    testingAction.value = false
  }
}

// Simple toast notification helper
function showToast(message, type = 'info') {
  // Create toast element
  const toast = document.createElement('div')
  toast.className = `wizard-toast wizard-toast-${type}`
  toast.textContent = message
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 8px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    font-weight: 600;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
    max-width: 400px;
  `
  
  document.body.appendChild(toast)
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-in'
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}

async function finalizeRegistration() {
  registering.value = true
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  registering.value = false
  registered.value = true
}

function viewService() {
  router.push('/services')
}

function registerAnother() {
  currentStep.value = 1
  registered.value = false
  enriched.value = false
  formData.value = {
    name: '',
    description: '',
    category: '',
    baseUrl: '',
    authType: 'api-key',
    specFile: null,
    specUrl: ''
  }
}
</script>

<style scoped>
.service-registration-v2 {
  min-height: 100vh;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
}

/* Progress Stepper */
.progress-stepper {
  background: white;
  padding: 2rem 3rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.step {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.step-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
}

.step.active .step-icon {
  background: #3b82f6;
  color: white;
}

.step.completed .step-icon {
  background: #10b981;
  color: white;
}

.step-icon svg {
  width: 20px;
  height: 20px;
}

.step-content {
  display: flex;
  flex-direction: column;
}

.step-title {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.95rem;
}

.step-subtitle {
  font-size: 0.8rem;
  color: #64748b;
}

.step-line {
  width: 80px;
  height: 2px;
  background: #e2e8f0;
}

.step-line.completed {
  background: #10b981;
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 2rem 4rem;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

/* Step Card */
.step-card {
  width: 100%;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 2rem;
}

.step-card h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  color: #1e293b;
}

.subtitle {
  color: #64748b;
  margin: 0 0 2rem 0;
}

/* Form Sections */
.form-section {
  margin-bottom: 1.5rem;
}

.form-section label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #1e293b;
}

.form-section input,
.form-section textarea,
.form-section select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
}

.form-section input:focus,
.form-section textarea:focus,
.form-section select:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* GraphQL Detection Banner */
.graphql-banner {
  display: flex;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(168, 85, 247, 0.12));
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 12px;
  margin-bottom: 1.5rem;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.graphql-banner-icon {
  font-size: 2rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.graphql-banner-content {
  flex: 1;
}

.graphql-banner-content h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
  color: #8b5cf6;
}

.graphql-banner-content p {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: #94a3b8;
  line-height: 1.5;
}

.graphql-rediscover {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.graphql-endpoint-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.85rem;
  font-family: 'Fira Code', monospace;
  outline: none;
  transition: border-color 0.2s;
}

.graphql-endpoint-input:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
}

.graphql-endpoint-input::placeholder {
  color: #64748b;
}

.graphql-auth-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.85rem;
  font-family: 'Fira Code', monospace;
  outline: none;
  transition: border-color 0.2s;
  margin-top: 0.5rem;
}

.graphql-auth-input:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
}

.graphql-auth-input::placeholder {
  color: #64748b;
}

.btn-graphql-rediscover {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-graphql-rediscover:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn-graphql-rediscover:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-graphql-rediscover svg {
  width: 16px;
  height: 16px;
}

.btn-dismiss-banner {
  background: none;
  border: none;
  color: #64748b;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}

.btn-dismiss-banner:hover {
  color: #94a3b8;
}

/* Discovery Step */
.discovery-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.categories-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.category-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;
}

.category-header {
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  background: white;
  transition: background 0.2s;
}

.category-header:hover {
  background: #f8fafc;
}

.category-info {
  flex: 1;
}

.category-info h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  color: #1e293b;
  font-weight: 600;
}

.action-count {
  font-size: 0.875rem;
  color: #64748b;
}

.expand-icon {
  width: 20px;
  height: 20px;
  color: #64748b;
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.actions-list {
  padding: 0 1rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #f8fafc;
}

.action-item-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
}

.action-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.http-method {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: monospace;
}

.method-get {
  background: #d1fae5;
  color: #065f46;
}

.method-post {
  background: #dbeafe;
  color: #1e40af;
}

.method-put {
  background: #fef3c7;
  color: #92400e;
}

.method-delete {
  background: #fee2e2;
  color: #991b1b;
}

.action-name {
  font-weight: 500;
  color: #1e293b;
}

.action-path {
  font-size: 0.875rem;
  color: #64748b;
  font-family: monospace;
  margin-bottom: 0.5rem;
}

.action-description {
  font-size: 0.875rem;
  color: #475569;
  margin-bottom: 0.5rem;
}

.params-count {
  font-size: 0.75rem;
  color: #94a3b8;
}

/* Discovery Header & Toggle */
.discovery-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.view-toggle {
  display: flex;
  gap: 0.5rem;
  background: #f1f5f9;
  padding: 0.25rem;
  border-radius: 8px;
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: #64748b;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn svg {
  width: 18px;
  height: 18px;
}

.toggle-btn:hover {
  background: #e2e8f0;
}

.toggle-btn.active {
  background: white;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* JSON Editor Wrapper */
.json-editor-wrapper {
  height: 750px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

/* Raw JSON Editor */
.raw-json-container {
  display: flex;
  flex-direction: column;
  height: 750px;
}

.raw-json-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #252526;
  border: 1px solid #3e3e42;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
}

.raw-json-toolbar .editor-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #cccccc;
}

.raw-json-toolbar .btn-format {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #3c3c3c;
  border: 1px solid #454545;
  border-radius: 4px;
  color: #cccccc;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
}

.raw-json-toolbar .btn-format:hover {
  background: #505050;
  border-color: #007acc;
}

.raw-json-toolbar .btn-format svg {
  width: 14px;
  height: 14px;
}

.raw-json-editor {
  flex: 1;
  width: 100%;
  padding: 1rem;
  border: 1px solid #3e3e42;
  border-radius: 0;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.9375rem;
  line-height: 1.8;
  resize: none;
  background: #1e1e1e;
  color: #d4d4d4;
  tab-size: 2;
}

.raw-json-editor:focus {
  outline: none;
  border-color: #007acc;
}

.json-error {
  padding: 0.75rem 1rem;
  background: #5a1d1d;
  border: 1px solid #be1100;
  border-top: none;
  border-radius: 0 0 8px 8px;
  color: #f48771;
  font-size: 0.875rem;
}

.json-valid {
  padding: 0.75rem 1rem;
  background: #1e3a1e;
  border: 1px solid #14ce14;
  border-top: none;
  border-radius: 0 0 8px 8px;
  color: #89d185;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Auth Types */
.auth-types {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.auth-card {
  padding: 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.auth-card:hover {
  border-color: #cbd5e1;
}

.auth-card.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.auth-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.auth-name {
  font-size: 0.875rem;
  color: #1e293b;
  font-weight: 500;
}

/* Upload Area */
.upload-area {
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-area:hover {
  border-color: #3b82f6;
  background: #f8fafc;
}

.upload-area svg {
  width: 48px;
  height: 48px;
  color: #94a3b8;
  margin: 0 auto 1rem;
}

.upload-area p {
  margin: 0;
  color: #64748b;
}

.file-name {
  color: #3b82f6 !important;
  font-weight: 500;
}

/* Enrich Step */
.preview-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #f8fafc;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  color: #3b82f6;
}

.stat-label {
  color: #64748b;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.categories-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.category-item {
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.category-item:hover {
  background: #f8fafc;
}

.category-item.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.category-info {
  flex: 1;
}

.category-name {
  font-weight: 500;
  color: #1e293b;
}

.category-count {
  font-size: 0.875rem;
  color: #64748b;
}

.enriching-state,
.enriched-state,
.registering-state,
.registered-state {
  text-align: center;
  padding: 3rem 2rem;
}

.loader {
  width: 64px;
  height: 64px;
  border: 4px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.enriching-state h3,
.enriched-state h3,
.registering-state h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  color: #1e293b;
}

.enriching-state p,
.enriched-state p,
.registering-state p {
  color: #64748b;
  margin: 0 0 1.5rem 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.875rem;
  color: #64748b;
}

.success-icon {
  width: 64px;
  height: 64px;
  background: #10b981;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin: 0 auto 1rem;
}

.success-icon.large {
  width: 80px;
  height: 80px;
  font-size: 3rem;
}

.enrichment-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}

.enrichment-stats .stat {
  color: #1e293b;
  font-size: 0.95rem;
}

/* Review Step */
.review-step {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 2rem;
  height: calc(100vh - 280px);
}

.actions-sidebar {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1.25rem;
  border-bottom: 1px solid #e2e8f0;
}

.sidebar-header h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  color: #1e293b;
}

.count {
  font-size: 0.875rem;
  color: #64748b;
}

.actions-list {
  flex: 1;
  overflow-y: auto;
}

.action-item {
  padding: 1rem;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  transition: background 0.2s;
}

.action-item:hover {
  background: #f8fafc;
}

.action-item.active {
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.action-status svg {
  width: 20px;
  height: 20px;
}

.icon-ready {
  color: #10b981;
}

.icon-warning {
  color: #f59e0b;
}

.icon-error {
  color: #ef4444;
}

.action-info {
  flex: 1;
  min-width: 0;
}

.action-name {
  font-weight: 500;
  color: #1e293b;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.action-description {
  font-size: 0.8rem;
  color: #64748b;
  line-height: 1.3;
}

.action-editor {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.action-title {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.title-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.action-title h2 {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
  color: #1e293b;
}

.action-title p {
  margin: 0;
  font-size: 0.9rem;
  color: #64748b;
}

.status-badges {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
}

.badge svg {
  width: 14px;
  height: 14px;
}

.badge-success {
  background: #d1fae5;
  color: #065f46;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 1.5rem;
  gap: 0.5rem;
}

.tab {
  padding: 0.875rem 1.25rem;
  border: none;
  background: none;
  cursor: pointer;
  font-weight: 500;
  color: #64748b;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tab:hover {
  color: #3b82f6;
}

.tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-icon {
  width: 18px;
  height: 18px;
}

.tab-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

.test-tab {
  max-width: 800px;
}

.test-header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  color: #1e293b;
}

.test-description {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0 0 1.5rem 0;
}

.test-info-box {
  background: #fffbeb;
  border: 1px solid #fef3c7;
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.test-info-box svg {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.test-info-box strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #92400e;
}

.test-info-box ul {
  margin: 0;
  padding-left: 1.25rem;
  color: #78350f;
}

.test-info-box li {
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.test-placeholder {
  text-align: center;
  padding: 3rem 2rem;
  color: #94a3b8;
}

.placeholder-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
}

.test-placeholder p {
  margin: 0;
  font-size: 0.95rem;
}

.btn-run-test {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.95rem;
  margin: 0 0 0 auto;
  transition: background 0.2s;
}

.btn-run-test:hover {
  background: #2563eb;
}

.btn-run-test svg {
  width: 18px;
  height: 18px;
}

.tab-placeholder {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
}

/* Register Step */
.summary-card {
  background: #f8fafc;
  padding: 1.5rem;
  border-radius: 8px;
  margin-top: 2rem;
}

.sum.empty-state p {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

/* === TEST RESULT PANEL === */
.test-result-panel {
  margin-top: 2rem;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid;
}

.test-result-panel.success {
  background: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.3);
}

.test-result-panel.error {
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.3);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.test-result-panel.success .result-header {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.test-result-panel.error .result-header {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.result-header svg {
  width: 24px;
  height: 24px;
}

.result-header strong {
  font-size: 1rem;
}

.result-body {
  padding: 1.5rem;
}

.result-section {
  margin-bottom: 1rem;
}

.result-section:last-child {
  margin-bottom: 0;
}

.result-section label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #475569;
  font-size: 0.9rem;
}

.result-section pre {
  margin: 0;
  padding: 1rem;
  background: #1e293b;
  border-radius: 6px;
  overflow-x: auto;
  max-height: 400px;
}

.result-section code {
  font-family: 'Monaco', 'Menlo', monospace;
  color: #e2e8f0;
  font-size: 0.875rem;
  line-height: 1.6;
}

.result-body small {
  color: #64748b;
  font-size: 0.85rem;
}

.result-error {
  padding: 1.5rem;
  margin: 0;
  color: #dc2626;
}

/* === STEP 4 TAB STYLES === */
.schema-tab, .examples-tab, .documentation-tab {
  padding: 2rem;
}

.schema-content, .examples-content, .documentation-content {
  max-width: 800px;
}

.schema-section, .doc-section {
  margin-bottom: 2rem;
}

.schema-section h4, .doc-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: #1e293b;
  font-weight: 600;
}

.endpoint-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(100, 116, 139, 0.05);
  border-radius: 6px;
}

.endpoint-info code {
  font-family: 'Monaco', 'Menlo', monospace;
  color: #475569;
  font-size: 0.9rem;
}

.parameters-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.parameter-item {
  padding: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.param-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.param-name {
  font-weight: 600;
  color: #1e293b;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
}

.param-type {
  font-size: 0.85rem;
  color: #64748b;
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.param-required {
  font-size: 0.75rem;
  color: #dc2626;
  background: #fee2e2;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.param-desc {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
  line-height: 1.5;
}

.example-item {
  margin-bottom: 2rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.example-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.example-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #1e293b;
}

.example-status {
  font-size: 0.85rem;
  color: #10b981;
  font-weight: 600;
  text-transform: capitalize;
}

.example-body {
  padding: 1.5rem;
}

.example-section {
  margin-bottom: 1.5rem;
}

.example-section:last-child {
  margin-bottom: 0;
}

.example-section label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #475569;
  font-size: 0.9rem;
}

.example-section pre {
  margin: 0;
  padding: 1rem;
  background: #1e293b;
  border-radius: 6px;
  overflow-x: auto;
}

.example-section code {
  font-family: 'Monaco', 'Menlo', monospace;
  color: #e2e8f0;
  font-size: 0.875rem;
  line-height: 1.6;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-label {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.detail-item code {
  font-family: 'Monaco', 'Menlo', monospace;
  background: #f8fafc;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  color: #1e293b;
  font-size: 0.9rem;
  border: 1px solid #e2e8f0;
}

.category-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
}

.empty-state p {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.summary-card h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #1e293b;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid #e2e8f0;
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row .label {
  color: #64748b;
  font-weight: 500;
}

.summary-row .value {
  color: #1e293b;
  font-weight: 600;
}

.actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 2rem;
}

/* Bottom Actions */
.bottom-actions {
  background: white;
  border-top: 1px solid #e2e8f0;
  padding: 1.25rem 3rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  color: #64748b;
  transition: all 0.2s;
}

.btn-back:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.btn-back svg {
  width: 18px;
  height: 18px;
}

.spacer {
  flex: 1;
}

.btn-primary,
.btn-secondary,
.btn-register {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.75rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  border: 1px solid #e2e8f0;
  color: #1e293b;
}

.btn-secondary:hover {
  background: #f8fafc;
}

.btn-register {
  background: #10b981;
  color: white;
}

.btn-register:hover {
  background: #059669;
}

.btn-primary svg,
.btn-register svg {
  width: 18px;
  height: 18px;
}

/* Examples Step */
.examples-step {
  height: calc(100vh - 280px);
}

.examples-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 2rem;
  height: 100%;
}

.examples-manager {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 2rem;
  overflow-y: auto;
}

.manager-header h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  color: #1e293b;
}

.examples-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 2rem 0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
}

.stat-icon {
  font-size: 2rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1e293b;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
}

.llm-generation-card {
  background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%);
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.llm-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.llm-header svg {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.llm-header h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1.125rem;
  color: #1e293b;
}

.llm-header p {
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
}

.btn-generate-llm {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #8b5cf6;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-generate-llm:hover {
  background: #7c3aed;
}

.btn-generate-llm svg {
  width: 18px;
  height: 18px;
}

.examples-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.example-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
  background: white;
}

.example-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.example-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.badge-spec {
  background: #dbeafe;
  color: #1e40af;
}

.badge-llm {
  background: #f3e8ff;
  color: #6b21a8;
}

.badge-user {
  background: #d1fae5;
  color: #065f46;
}

.example-validation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.example-validation svg {
  width: 16px;
  height: 16px;
}

.text-green {
  color: #10b981;
  font-size: 0.875rem;
  font-weight: 500;
}

.text-red {
  color: #ef4444;
  font-size: 0.875rem;
  font-weight: 500;
}

.example-code {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  overflow-x: auto;
  margin: 0 0 1rem 0;
}

.example-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.btn-icon svg {
  width: 18px;
  height: 18px;
  color: #64748b;
}

.btn-delete:hover {
  background: #fef2f2;
  border-color: #fca5a5;
}

.btn-delete:hover svg {
  color: #dc2626;
}

/* Edit Mode Styles */
.edit-mode {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.example-editor {
  width: 100%;
  min-height: 300px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  background: #f8fafc;
  color: #1e293b;
  resize: vertical;
  transition: border-color 0.2s;
}

.example-editor:focus {
  outline: none;
  border-color: #8b5cf6;
  background: white;
}

.edit-error {
  padding: 0.75rem;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 6px;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.edit-actions button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-actions button svg {
  width: 18px;
  height: 18px;
}

.edit-actions .btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.edit-actions .btn-secondary:hover {
  background: #e2e8f0;
}

.edit-actions .btn-primary {
  background: #8b5cf6;
  color: white;
}

.edit-actions .btn-primary:hover {
  background: #7c3aed;
}

.btn-add-example {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 1rem;
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  background: white;
  color: #64748b;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-example:hover {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #3b82f6;
}

.btn-add-example svg {
  width: 20px;
  height: 20px;
}

.example-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
}

.badge-green {
  background: #d1fae5;
  color: #065f46;
}

.badge-gray {
  background: #f1f5f9;
  color: #94a3b8;
}

/* Save Draft Button & Indicator */
.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-save-draft {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save-draft:hover:not(:disabled) {
  background: #7c3aed;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(139, 92, 246, 0.2);
}

.btn-save-draft:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-save-draft svg {
  width: 18px;
  height: 18px;
}

.save-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #dcfce7;
  color: #166534;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.save-indicator svg {
  width: 16px;
  height: 16px;
}

/* Spin animation for saving state */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spin {
  animation: spin 1s linear infinite;
}

/* Update manager-header to flex */
.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.manager-header > div:first-child {
  flex: 1;
}

/* Discovery header layout */
.discovery-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.discovery-header > div:first-child {
  flex: 1;
}

/* Resume Draft Link */
.resume-draft-link {
  margin-top: 1rem;
  text-align: center;
}

.resume-draft-link a {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #8b5cf6;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.resume-draft-link a:hover {
  color: #7c3aed;
  transform: translateX(4px);
}

.resume-draft-link svg {
  width: 18px;
  height: 18px;
}

/* === REVIEW PAGE STYLES === */
.review-page {
  max-width: 900px;
  margin: 0 auto;
}

.review-header {
  text-align: center;
  margin-bottom: 3rem;
}

.review-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.review-section h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
  color: #e2e8f0;
}

.review-section h4 {
  margin: 1.5rem 0 1rem 0;
  font-size: 1rem;
  color: #cbd5e1;
}

.section-desc {
  color: #94a3b8;
  margin: -0.5rem 0 1.5rem 0;
  font-size: 0.9rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item .label {
  font-size: 0.85rem;
  color: #94a3b8;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-item .value {
  color: #e2e8f0;
  font-size: 1rem;
}

.info-item .value.code {
  font-family: 'Monaco', 'Menlo', monospace;
  background: rgba(100, 116, 139, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-box {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  padding: 1.5rem 1rem;
  text-align: center;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: #818cf8;
  line-height: 1;
}

.stat-label {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.action-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 0.5rem 1rem;
}

.action-chip .method-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.action-chip .method-badge.get { background: #10b981; color: white; }
.action-chip .method-badge.post { background: #3b82f6; color: white; }
.action-chip .method-badge.put { background: #f59e0b; color: white; }
.action-chip .method-badge.patch { background: #8b5cf6; color: white; }
.action-chip .method-badge.delete { background: #ef4444; color: white; }

.action-chip .action-name {
  font-size: 0.9rem;
  color: #cbd5e1;
}

.more-chip {
  display: flex;
  align-items: center;
  background: rgba(100, 116, 139, 0.2);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

.quality-metrics {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.metric {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 1rem;
}

.metric-bar {
  height: 8px;
  background: rgba(100, 116, 139, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #818cf8);
  transition: width 0.5s ease;
}

.metric-label {
  font-size: 0.9rem;
  color: #cbd5e1;
}

.metric-status {
  font-size: 1.2rem;
  color: #10b981;
  width: 24px;
  text-align: center;
}

.btn-test-connection {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(99, 102, 241, 0.1);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.3);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-test-connection:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
  transform: translateY(-1px);
}

.btn-test-connection:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-test-connection svg {
  width: 20px;
  height: 20px;
}

.test-result {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
}

.test-result.success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.test-result.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.test-result svg {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.test-result strong {
  color: inherit;
  display: block;
  margin-bottom: 0.25rem;
}

.test-result p {
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

.test-result small {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  display: block;
  margin-top: 0.5rem;
}

.register-actions {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}

/* Agent Test Styling */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.agent-test-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #a855f7, #ec4899);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
}

.agent-test-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(168, 85, 247, 0.4);
}

.agent-test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.agent-test-btn svg {
  width: 20px;
  height: 20px;
}

.run-test-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.run-test-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0.6px 20px rgba(59, 130, 246, 0.4);
}

.run-test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.run-test-btn svg {
  width: 20px;
  height: 20px;
}

.agent-test-results {
  margin-top: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(236, 72, 153, 0.05));
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-radius: 12px;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.agent-test-results h4 {
  font-size: 1.3rem;
  color: #e0e7ff;
  margin: 0 0 1.5rem 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.agent-test-results h4::before {
  content: '🤖';
  font-size: 1.5rem;
}

.success-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(16, 185, 129, 0.1);
  border: 2px solid rgba(16, 185, 129, 0.3);
  border-radius: 10px;
  margin-bottom: 2rem;
}

.success-rate {
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #10b981, #34d399);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.model-result {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  transition: all 0.3s;
}

.model-result:hover {
  border-color: rgba(168, 85, 247, 0.5);
  transform: translateX(4px);
}

.model-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(100, 116, 139, 0.2);
}

.model-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #cbd5e1;
  font-family: 'Courier New', monospace;
}

.model-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
}

.model-status.valid {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.model-status.invalid {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.generation-time {
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 400;
}

.generated-payload {
  margin-top: 1rem;
}

.generated-payload label {
  display: block;
  color: #94a3b8;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.generated-payload pre {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 6px;
  padding: 1rem;
  overflow-x: auto;
  max-height: 300px;
}

.generated-payload code {
  color: #e0e7ff;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.6;
}

.validation-errors {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
}

.validation-errors label {
  display: block;
  color: #f87171;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.validation-errors ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.validation-errors li {
  color: #fca5a5;
  font-size: 0.85rem;
  padding: 0.4rem 0;
  padding-left: 1.5rem;
  position: relative;
}

.validation-errors li::before {
  content: '⚠';
  position: absolute;
  left: 0;
  color: #ef4444;
}

.best-payload-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(100, 116, 139, 0.3);
  text-align: center;
}

.use-payload-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.use-payload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

.use-payload-btn::before {
  content: '→';
  font-size: 1.3rem;
  font-weight: bold;
}

</style>
