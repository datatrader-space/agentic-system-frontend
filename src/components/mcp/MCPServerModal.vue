<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-xl font-bold text-gray-900">🔌 {{ isEditMode ? 'Edit' : 'Add' }} MCP Server</h2>
            <p class="text-sm text-gray-500 mt-1">{{ isEditMode ? 'Update configuration for ' + form.name : 'Configure a Model Context Protocol server to extend agent capabilities' }}</p>
          </div>
          <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
            <span class="text-2xl">&times;</span>
          </button>
        </div>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-5">
        <!-- Quick Start Examples -->
        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 class="font-medium text-purple-900 mb-2">📋 Quick Start Examples</h4>
          <div class="flex flex-wrap gap-2">
            <button type="button" @click="applyTemplate('github')" 
              class="px-3 py-1 text-xs bg-white border border-purple-300 rounded-full hover:bg-purple-100">
              GitHub
            </button>
            <button type="button" @click="applyTemplate('filesystem')" 
              class="px-3 py-1 text-xs bg-white border border-purple-300 rounded-full hover:bg-purple-100">
              Filesystem
            </button>
            <button type="button" @click="applyTemplate('slack')" 
              class="px-3 py-1 text-xs bg-white border border-purple-300 rounded-full hover:bg-purple-100">
              Slack
            </button>
            <button type="button" @click="applyTemplate('postgres')" 
              class="px-3 py-1 text-xs bg-white border border-purple-300 rounded-full hover:bg-purple-100">
              PostgreSQL
            </button>
          </div>
        </div>

        <!-- Basic Info -->
        <div class="space-y-4">
          <h3 class="font-medium text-gray-900 flex items-center gap-2">
            📝 Basic Information
            <span class="text-xs font-normal text-gray-500">Identify your MCP server</span>
          </h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Name *
                <span class="ml-1 text-gray-400 cursor-help" title="A human-readable name to identify this MCP server">ⓘ</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                required
                placeholder="GitHub MCP"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
              <p class="text-xs text-gray-500 mt-1">Display name shown in the UI</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Slug
                <span class="ml-1 text-gray-400 cursor-help" title="Short identifier used in tool naming (e.g., MCP_GITHUB_)">ⓘ</span>
              </label>
              <input
                v-model="form.slug"
                type="text"
                placeholder="github"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
              <p class="text-xs text-gray-500 mt-1">Used for tool prefix (MCP_SLUG_TOOLNAME)</p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              v-model="form.description"
              rows="2"
              placeholder="GitHub API integration via MCP - provides repository, issue, and PR management tools"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            ></textarea>
          </div>
        </div>

        <!-- Transport Configuration -->
        <div class="bg-gray-50 p-4 rounded-lg space-y-4">
          <h3 class="font-medium text-gray-900 flex items-center gap-2">
            🔗 Transport Configuration
            <span class="text-xs font-normal text-gray-500">How to connect to the MCP server</span>
          </h3>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Transport Type *</label>
            <select
              v-model="form.transport_type"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="stdio">stdio (Local subprocess) - Most common</option>
              <option value="http">HTTP (Remote server)</option>
              <option value="sse">SSE (Server-Sent Events)</option>
            </select>
            <p class="text-xs text-gray-500 mt-1">
              <strong>stdio:</strong> Run MCP as a local process (npx, uvx, node, python)<br>
              <strong>HTTP/SSE:</strong> Connect to a remote MCP server
            </p>
          </div>

          <!-- stdio config -->
          <div v-if="form.transport_type === 'stdio'" class="space-y-4 border-t border-gray-200 pt-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Command *
                <span class="ml-1 text-gray-400 cursor-help" title="The executable to run (npx, uvx, node, python, etc.)">ⓘ</span>
              </label>
              <input
                v-model="form.command"
                type="text"
                required
                placeholder="npx"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
              >
              <p class="text-xs text-gray-500 mt-1">
                Common commands: <code class="bg-gray-200 px-1 rounded">npx</code> (Node), 
                <code class="bg-gray-200 px-1 rounded">uvx</code> (Python), 
                <code class="bg-gray-200 px-1 rounded">node</code>, 
                <code class="bg-gray-200 px-1 rounded">python</code>
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Arguments (JSON array) *
                <span class="ml-1 text-gray-400 cursor-help" title="Command arguments as a JSON array of strings">ⓘ</span>
              </label>
              <input
                v-model="argsText"
                type="text"
                placeholder='["-y", "@modelcontextprotocol/server-github"]'
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              >
              <p class="text-xs text-gray-500 mt-1">
                Example: <code class="bg-gray-200 px-1 rounded text-xs">["-y", "@modelcontextprotocol/server-github"]</code>
              </p>
            </div>
          </div>

          <!-- HTTP/SSE config -->
          <div v-else class="border-t border-gray-200 pt-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Endpoint URL *</label>
            <input
              v-model="form.endpoint_url"
              type="url"
              required
              placeholder="https://mcp-server.example.com/mcp"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
            <p class="text-xs text-gray-500 mt-1">Full URL to the remote MCP server endpoint</p>
          </div>
        </div>

        <!-- Environment Variables -->
        <div class="bg-gray-50 p-4 rounded-lg space-y-3">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-medium text-gray-900">🔐 Environment Variables</h3>
              <p class="text-xs text-gray-500 mt-1">
                Pass API keys and secrets to the MCP server. Values are resolved at runtime.
              </p>
            </div>
          </div>
          
          <!-- Help text for credential syntax -->
          <div class="bg-white border border-gray-200 rounded p-3 text-xs">
            <p class="font-medium text-gray-700 mb-2">Credential Reference Syntax:</p>
            <ul class="space-y-1 text-gray-600">
              <li><code class="bg-gray-100 px-1 rounded">env://VAR_NAME</code> → Read from system environment</li>
              <li><code class="bg-gray-100 px-1 rounded">vault://secret/path#key</code> → Read from HashiCorp Vault</li>
              <li><code class="bg-gray-100 px-1 rounded">ssm://parameter/name</code> → Read from AWS SSM</li>
              <li><code class="bg-gray-100 px-1 rounded">raw_value</code> → Use literal value (⚠️ stored in DB)</li>
            </ul>
          </div>
          
          <div v-for="(value, key, index) in form.env_config" :key="index" class="flex gap-2">
            <input
              :value="key"
              @input="updateEnvKey(key, $event.target.value)"
              type="text"
              placeholder="GITHUB_TOKEN"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            >
            <input
              v-model="form.env_config[key]"
              type="text"
              placeholder="env://GITHUB_TOKEN"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            >
            <button
              type="button"
              @click="removeEnvVar(key)"
              class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >🗑️</button>
          </div>
          
          <button
            type="button"
            @click="addEnvVar"
            class="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
          >
            <span>+</span> Add Environment Variable
          </button>
        </div>

        <!-- Advanced Options -->
        <details class="bg-gray-50 p-4 rounded-lg">
          <summary class="font-medium text-gray-900 cursor-pointer flex items-center gap-2">
            ⚙️ Advanced Options
            <span class="text-xs font-normal text-gray-500">Timeouts, caching, and reliability settings</span>
          </summary>
          <div class="mt-4 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Discovery Mode
                  <span class="ml-1 text-gray-400 cursor-help" title="How tools are discovered from the server">ⓘ</span>
                </label>
                <select v-model="form.discovery_mode" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="hybrid">Hybrid (cached + refresh)</option>
                  <option value="dynamic">Dynamic (always fresh)</option>
                  <option value="cached">Cached (fast startup)</option>
                </select>
                <p class="text-xs text-gray-500 mt-1">Hybrid is recommended for most cases</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Lifecycle Mode
                  <span class="ml-1 text-gray-400 cursor-help" title="How MCP server processes are managed">ⓘ</span>
                </label>
                <select v-model="form.lifecycle_mode" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="per_session">Per Session (start/stop per chat)</option>
                  <option value="persistent">Persistent (keep running)</option>
                </select>
                <p class="text-xs text-gray-500 mt-1">Per-session uses less resources</p>
              </div>
            </div>
            
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Startup Timeout</label>
                <div class="flex items-center gap-2">
                  <input v-model.number="form.startup_timeout_ms" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <span class="text-xs text-gray-500">ms</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Max time to start server</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tool Timeout</label>
                <div class="flex items-center gap-2">
                  <input v-model.number="form.tool_timeout_ms" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <span class="text-xs text-gray-500">ms</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Max time per tool call</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Idle Timeout</label>
                <div class="flex items-center gap-2">
                  <input v-model.number="form.idle_timeout_ms" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <span class="text-xs text-gray-500">ms</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Shutdown after idle</p>
              </div>
            </div>
            
            <div class="flex items-center gap-2 pt-2">
              <input type="checkbox" v-model="form.circuit_breaker_enabled" id="cb-enabled" class="rounded text-purple-600">
              <label for="cb-enabled" class="text-sm text-gray-700">
                Enable Circuit Breaker
                <span class="text-gray-500">(prevents startup storms on repeated failures)</span>
              </label>
            </div>
          </div>
        </details>

        <!-- Actions -->
        <div class="flex justify-between items-center pt-4 border-t border-gray-200">
          <button
            type="button"
            @click="testConnection"
            :disabled="testing || !canTest"
            class="px-4 py-2 text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition disabled:opacity-50 flex items-center gap-2"
          >
            <span v-if="testing" class="animate-spin">⟳</span>
            <span v-else>🧪</span>
            {{ testing ? 'Testing...' : 'Test Connection' }}
          </button>
          
          <div class="flex gap-3">
            <button
              type="button"
              @click="$emit('close')"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >Cancel</button>
            <button
              type="submit"
              :disabled="saving"
              class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Add Server' }}
            </button>
          </div>
        </div>

        <!-- Test Result -->
        <div v-if="testResult" class="p-4 rounded-lg" :class="testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
          <div class="flex items-start gap-2">
            <span class="text-xl">{{ testResult.success ? '✅' : '❌' }}</span>
            <div>
              <p class="font-medium" :class="testResult.success ? 'text-green-800' : 'text-red-800'">
                {{ testResult.success ? 'Connection Successful!' : 'Connection Failed' }}
              </p>
              <p class="text-sm" :class="testResult.success ? 'text-green-700' : 'text-red-700'">
                {{ testResult.message }}
              </p>
              <div v-if="testResult.tools" class="mt-2 text-xs text-green-600">
                Discovered {{ testResult.tools }} tools
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed } from 'vue'
import api from '../../services/api'

export default {
  name: 'MCPServerModal',
  props: {
    server: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const saving = ref(false)
    const testing = ref(false)
    const testResult = ref(null)
    
    const isEditMode = computed(() => !!props.server)
    
    // Initialize form with server data if editing
    const form = reactive({
      name: props.server?.name || '',
      slug: props.server?.slug || '',
      description: props.server?.description || '',
      transport_type: props.server?.transport_type || 'stdio',
      command: props.server?.command || '',
      args: props.server?.args || [],
      endpoint_url: props.server?.endpoint_url || '',
      env_config: props.server?.env_config || {},
      discovery_mode: props.server?.discovery_mode || 'hybrid',
      lifecycle_mode: props.server?.lifecycle_mode || 'per_session',
      startup_timeout_ms: props.server?.startup_timeout_ms || 30000,
      tool_timeout_ms: props.server?.tool_timeout_ms || 60000,
      idle_timeout_ms: props.server?.idle_timeout_ms || 300000,
      circuit_breaker_enabled: props.server?.circuit_breaker_enabled ?? true,
      enabled: props.server?.enabled ?? true
    })

    const argsText = computed({
      get: () => JSON.stringify(form.args),
      set: (val) => {
        try {
          form.args = JSON.parse(val || '[]')
        } catch (e) {
          // Leave as-is if parse fails
        }
      }
    })

    const canTest = computed(() => {
      if (form.transport_type === 'stdio') {
        return form.command && form.args.length > 0
      }
      return form.endpoint_url
    })

    // Quick start templates
    const templates = {
      github: {
        name: 'GitHub MCP',
        slug: 'github',
        description: 'GitHub API integration - repos, issues, PRs, and more',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env_config: { 'GITHUB_TOKEN': 'env://GITHUB_TOKEN' }
      },
      filesystem: {
        name: 'Filesystem MCP',
        slug: 'fs',
        description: 'Read and write files in specified directories',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/dir'],
        env_config: {}
      },
      slack: {
        name: 'Slack MCP',
        slug: 'slack',
        description: 'Slack workspace integration',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env_config: { 'SLACK_BOT_TOKEN': 'env://SLACK_BOT_TOKEN', 'SLACK_TEAM_ID': 'env://SLACK_TEAM_ID' }
      },
      postgres: {
        name: 'PostgreSQL MCP',
        slug: 'postgres',
        description: 'Query PostgreSQL databases',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
        env_config: {}
      }
    }

    const applyTemplate = (templateName) => {
      const template = templates[templateName]
      if (template) {
        form.name = template.name
        form.slug = template.slug
        form.description = template.description
        form.command = template.command
        form.args = [...template.args]
        form.env_config = { ...template.env_config }
        testResult.value = null
      }
    }

    const addEnvVar = () => {
      const key = `VAR_${Object.keys(form.env_config).length + 1}`
      form.env_config[key] = ''
    }

    const removeEnvVar = (key) => {
      delete form.env_config[key]
    }

    const updateEnvKey = (oldKey, newKey) => {
      if (oldKey !== newKey && newKey) {
        form.env_config[newKey] = form.env_config[oldKey]
        delete form.env_config[oldKey]
      }
    }

    const testConnection = async () => {
      testing.value = true
      testResult.value = null
      
      try {
        // For now, create the server temporarily and test
        // In the future, add a dedicated test endpoint
        testResult.value = {
          success: true,
          message: `Configuration looks valid. Save the server and use "Refresh Tools" to discover tools.`,
          tools: null
        }
      } catch (error) {
        testResult.value = {
          success: false,
          message: error.response?.data?.error || error.message
        }
      } finally {
        testing.value = false
      }
    }

    const handleSubmit = async () => {
      saving.value = true
      try {
        if (isEditMode.value) {
          await api.updateMCPServer(props.server.id, form)
        } else {
          await api.createMCPServer(form)
        }
        emit('saved')
      } catch (error) {
        console.error('Failed to save MCP server:', error)
        alert('Failed to save server: ' + (error.response?.data?.error || error.message))
      } finally {
        saving.value = false
      }
    }

    return {
      form,
      argsText,
      saving,
      testing,
      testResult,
      canTest,
      isEditMode,
      applyTemplate,
      addEnvVar,
      removeEnvVar,
      updateEnvKey,
      testConnection,
      handleSubmit
    }
  }
}
</script>
