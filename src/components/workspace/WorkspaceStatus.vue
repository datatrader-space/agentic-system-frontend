<template>
  <div class="workspace-status" :class="[statusClass, { compact: compact }]" @click="$emit('click')">
    <div class="status-dot" :class="statusClass"></div>
    <div class="status-info" v-if="!compact">
      <span class="status-name">{{ workspace?.name || 'Workspace' }}</span>
      <span class="status-label">{{ statusLabel }}</span>
    </div>
    <span class="status-badge" v-if="compact">{{ statusLabel }}</span>
  </div>
</template>

<script>
export default {
  name: 'WorkspaceStatus',
  props: {
    workspace: { type: Object, default: null },
    compact: { type: Boolean, default: false },
  },
  emits: ['click'],
  computed: {
    statusClass() {
      if (!this.workspace) return 'offline'
      switch (this.workspace.status) {
        case 'connected': return 'online'
        case 'stale': return 'stale'
        case 'disconnected': return 'offline'
        default: return 'offline'
      }
    },
    statusLabel() {
      if (!this.workspace) return 'No workspace'
      switch (this.workspace.status) {
        case 'connected': return 'Connected'
        case 'stale': return 'Stale'
        case 'disconnected': return 'Disconnected'
        default: return this.workspace.status
      }
    },
  },
}
</script>

<style scoped>
.workspace-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
}
.workspace-status:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.15);
}
.workspace-status.compact {
  padding: 4px 10px;
  gap: 6px;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
}
.status-dot.online {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34,197,94,0.6);
  animation: pulse-green 2s ease-in-out infinite;
}
.status-dot.stale {
  background: #f59e0b;
  box-shadow: 0 0 6px rgba(245,158,11,0.5);
}
.status-dot.offline {
  background: #6b7280;
}
.status-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.status-name {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  line-height: 1.2;
}
.status-label {
  font-size: 10px;
  color: rgba(255,255,255,0.5);
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.status-badge {
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  font-weight: 500;
}
@keyframes pulse-green {
  0%, 100% { box-shadow: 0 0 4px rgba(34,197,94,0.4); }
  50% { box-shadow: 0 0 10px rgba(34,197,94,0.8); }
}
</style>
