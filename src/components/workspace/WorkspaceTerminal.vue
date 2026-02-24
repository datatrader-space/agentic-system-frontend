<template>
  <div class="workspace-terminal">
    <div class="terminal-header">
      <div class="terminal-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
        <span>Terminal</span>
        <span class="terminal-badge" v-if="workspace">{{ workspace.name }}</span>
      </div>
      <div class="terminal-actions">
        <button class="term-btn" @click="clearOutput" title="Clear">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
        </button>
      </div>
    </div>

    <div class="terminal-output" ref="outputEl">
      <div v-for="(entry, i) in output" :key="i" class="output-line" :class="entry.type">
        <span class="line-prefix" v-if="entry.type === 'command'">❯</span>
        <span class="line-prefix" v-else-if="entry.type === 'error'">✗</span>
        <span class="line-prefix" v-else>│</span>
        <pre class="line-content">{{ entry.text }}</pre>
      </div>
      <div v-if="!output.length" class="empty-state">
        <span>Connected to <strong>{{ workspace?.name || 'workspace' }}</strong></span>
        <span class="hint">Type a command and press Enter to execute remotely</span>
      </div>
    </div>

    <form class="terminal-input" @submit.prevent="sendCommand">
      <span class="input-prompt">❯</span>
      <input
        ref="inputEl"
        v-model="command"
        :placeholder="executing ? 'Executing...' : 'Enter command...'"
        :disabled="executing || !isConnected"
        autocomplete="off"
        spellcheck="false"
      />
      <button type="submit" :disabled="executing || !command.trim() || !isConnected" class="send-btn">
        <svg v-if="!executing" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </button>
    </form>
  </div>
</template>

<script>
import apiService from '../../services/api.js'

export default {
  name: 'WorkspaceTerminal',
  props: {
    workspace: { type: Object, required: true },
  },
  data() {
    return {
      command: '',
      output: [],
      executing: false,
    }
  },
  computed: {
    isConnected() {
      return this.workspace?.status === 'connected'
    },
  },
  methods: {
    async sendCommand() {
      const cmd = this.command.trim()
      if (!cmd || this.executing || !this.isConnected) return

      this.output.push({ type: 'command', text: cmd })
      this.command = ''
      this.executing = true

      try {
        const resp = await apiService.executeWorkspaceCommand(this.workspace.id, cmd, 60)
        const data = resp.data

        if (data.output) {
          this.output.push({ type: 'output', text: data.output })
        }
        if (data.error) {
          this.output.push({ type: 'error', text: data.error })
        }
        if (!data.output && !data.error) {
          this.output.push({ type: 'output', text: '(no output)' })
        }
      } catch (err) {
        this.output.push({
          type: 'error',
          text: err.response?.data?.error || err.message || 'Failed to execute',
        })
      } finally {
        this.executing = false
        this.scrollToBottom()
        this.$nextTick(() => this.$refs.inputEl?.focus())
      }
    },
    clearOutput() {
      this.output = []
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const el = this.$refs.outputEl
        if (el) el.scrollTop = el.scrollHeight
      })
    },
  },
  mounted() {
    this.$refs.inputEl?.focus()
  },
}
</script>

<style scoped>
.workspace-terminal {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  background: #0d1117;
  border: 1px solid rgba(255,255,255,0.08);
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace;
  height: 100%;
  min-height: 300px;
}
.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.terminal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
}
.terminal-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(34,197,94,0.15);
  color: #22c55e;
  font-weight: 500;
}
.terminal-actions {
  display: flex;
  gap: 4px;
}
.term-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s;
}
.term-btn:hover {
  color: rgba(255,255,255,0.8);
  background: rgba(255,255,255,0.06);
}
.terminal-output {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.6;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}
.output-line {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.output-line.command .line-content {
  color: #58a6ff;
  font-weight: 600;
}
.output-line.output .line-content {
  color: rgba(255,255,255,0.75);
}
.output-line.error .line-content {
  color: #f87171;
}
.line-prefix {
  flex-shrink: 0;
  width: 12px;
  text-align: center;
  color: rgba(255,255,255,0.25);
  user-select: none;
}
.output-line.command .line-prefix {
  color: #58a6ff;
}
.output-line.error .line-prefix {
  color: #f87171;
}
.line-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
  font-size: inherit;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 40px 20px;
  color: rgba(255,255,255,0.4);
  font-size: 13px;
}
.empty-state .hint {
  font-size: 11px;
  color: rgba(255,255,255,0.25);
}
.terminal-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.02);
  border-top: 1px solid rgba(255,255,255,0.06);
}
.input-prompt {
  color: #22c55e;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.terminal-input input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: rgba(255,255,255,0.9);
  font-family: inherit;
  font-size: 13px;
  caret-color: #22c55e;
}
.terminal-input input::placeholder {
  color: rgba(255,255,255,0.2);
}
.terminal-input input:disabled {
  opacity: 0.4;
}
.send-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s;
}
.send-btn:hover:not(:disabled) {
  color: #22c55e;
  background: rgba(34,197,94,0.1);
}
.send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
}
</style>
