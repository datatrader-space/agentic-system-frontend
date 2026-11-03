<template>
  <aside class="cgs">
    <div class="cgs-panel">
      <div class="cgs-head">
        <span class="cgs-head-title">Getting started</span>
        <button class="cgs-close" aria-label="Close"><Icon icon="lucide:x" class="h-4 w-4" /></button>
      </div>

      <div class="cgs-card">
        <span class="cgs-title">What are connectors?</span>
        <p class="cgs-body">Connectors are secure integrations that let agents use external tools, APIs, and data sources.</p>
      </div>

      <div class="cgs-card">
        <span class="cgs-title">What is scope?</span>
        <p class="cgs-body">Global connectors are available to all your agents. You can also connect per agent from the agent settings.</p>
        <button class="cgs-link">Learn more about scope <Icon icon="lucide:external-link" class="h-3 w-3" /></button>
      </div>

      <div class="cgs-card">
        <span class="cgs-title">Connector types</span>
        <ul class="cgs-types">
          <li><span class="cgs-ic"><Icon icon="lucide:blocks" class="h-4 w-4" /></span><div><span class="cgs-type-name">Built-in services</span><span class="cgs-type-sub">Prebuilt integrations with popular tools.</span></div></li>
          <li><span class="cgs-ic"><Icon icon="lucide:server" class="h-4 w-4" /></span><div><span class="cgs-type-name">MCP servers</span><span class="cgs-type-sub">Connect to MCP servers via stdio, HTTP, or SSE.</span></div></li>
          <li><span class="cgs-ic"><Icon icon="lucide:shield" class="h-4 w-4" /></span><div><span class="cgs-type-name">Custom services</span><span class="cgs-type-sub">Register your own API using OpenAPI or Postman specs.</span></div></li>
        </ul>
      </div>
    </div>

    <div class="cgs-help">
      <div class="cgs-help-row">
        <span class="cgs-help-ic"><Icon icon="lucide:life-buoy" class="h-4 w-4" /></span>
        <div>
          <p class="cgs-help-title">Need help?</p>
          <p class="cgs-help-sub">Visit our docs or open a help ticket.</p>
        </div>
      </div>
      <button class="cgs-browse" @click="$emit('browse')">
        Open help center <Icon icon="lucide:external-link" class="h-4 w-4" />
      </button>
    </div>
  </aside>
</template>

<script setup>
import { Icon } from '@iconify/vue'
defineEmits(['browse'])
</script>

<style scoped>
.cgs { display: flex; flex-direction: column; gap: 10px; }
.cgs-panel,
.cgs-help {
  background: var(--vm-surface);
  border: 1px solid var(--vm-line-2);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(16,24,40,.04);
  padding: 16px;
}
.cgs-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.cgs-head-title { font-family: var(--vm-font-display); font-size: 15px; font-weight: 800; color: var(--vm-ink); }
.cgs-close { display: grid; width: 24px; height: 24px; place-items: center; color: var(--vm-ink-faint); }
.cgs-card { padding-bottom: 15px; }
.cgs-card + .cgs-card { border-top: 1px solid var(--vm-line-2); padding-top: 15px; }
.cgs-title { display: block; margin-bottom: 7px; font-size: 12.5px; font-weight: 800; color: var(--vm-ink); }
.cgs-body { font-size: 11.5px; line-height: 1.55; color: var(--vm-ink-faint); }
.cgs-link { display: inline-flex; align-items: center; gap: 5px; margin-top: 9px; color: var(--vm-link); font-size: 11.5px; font-weight: 800; }
.cgs-types { display: flex; flex-direction: column; gap: 10px; padding: 0; margin: 0; list-style: none; }
.cgs-types li { display: flex; align-items: flex-start; gap: 10px; }
.cgs-ic { display: grid; width: 26px; height: 26px; flex-shrink: 0; place-items: center; border-radius: 8px; background: var(--vm-surface-soft); color: var(--vm-ink-faint); }
.cgs-type-name { display: block; font-size: 12px; font-weight: 800; color: var(--vm-ink); }
.cgs-type-sub { display: block; margin-top: 2px; font-size: 11px; line-height: 1.4; color: var(--vm-ink-faint); }
.cgs-help { border-color: #BFDBFE; background: var(--vm-surface-soft); }
.cgs-help-row { display: flex; align-items: center; gap: 12px; }
.cgs-help-ic { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 999px; background: var(--vm-surface-soft); color: var(--vm-link); }
.cgs-help-title { font-size: 13px; font-weight: 800; color: var(--vm-ink); }
.cgs-help-sub { margin-top: 2px; font-size: 11.5px; color: var(--vm-ink-faint); }
.cgs-browse {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 12px;
  padding: 0 14px;
  border: 1px solid var(--vm-line-2);
  border-radius: 8px;
  background: var(--vm-surface);
  color: var(--vm-link);
  font: 800 12.5px var(--vm-font-sans);
}
</style>
