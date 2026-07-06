<template>
  <!-- Static informational right sidebar for the connector catalog (Aadml). -->
  <aside class="iis">
    <div class="iis-card">
      <div class="iis-head">
        <span class="iis-ic brand"><Icon icon="lucide:plug-zap" class="w-4 h-4" /></span>
        <span class="iis-title">About these connectors</span>
      </div>
      <p class="iis-body">
        Integrations connect your agents to outside platforms — GitHub, Slack, email, payments and more.
        Connect once with your own account; the platform stores credentials encrypted server-side and
        manages runtime access for every agent you own.
      </p>
    </div>

    <div class="iis-card">
      <div class="iis-head">
        <span class="iis-ic teal"><Icon icon="lucide:target" class="w-4 h-4" /></span>
        <span class="iis-title">Understanding scope</span>
      </div>
      <p class="iis-body">
        A connection made here is available globally to all your agents. You can still tighten per-tool
        permissions (allow / ask / deny) for any single agent from the Connectors page.
      </p>
    </div>

    <div class="iis-card">
      <div class="iis-head">
        <span class="iis-ic indigo"><Icon icon="lucide:list-checks" class="w-4 h-4" /></span>
        <span class="iis-title">How installation works</span>
      </div>
      <ol class="iis-steps">
        <li><span class="iis-step-n">1</span><span>Pick an integration and open it.</span></li>
        <li><span class="iis-step-n">2</span><span>Connect with OAuth (recommended) or a personal access token.</span></li>
        <li><span class="iis-step-n">3</span><span>Credentials are validated and stored encrypted — never exposed to the browser.</span></li>
        <li><span class="iis-step-n">4</span><span>Tools become available to your agents immediately.</span></li>
      </ol>
    </div>

    <div class="iis-note">
      <Icon icon="lucide:info" class="w-4 h-4 shrink-0" />
      <span>Cards marked <strong>Soon</strong> aren't connectable yet. GitHub and Slack are the built-ins live today.</span>
    </div>
  </aside>
</template>

<script setup>
import { Icon } from '@iconify/vue'
</script>

<style scoped>
.iis { display: flex; flex-direction: column; gap: 14px; }
.iis-card { background: var(--vm-glass-strong); border: 1px solid var(--vm-line); border-radius: var(--vm-r); box-shadow: var(--vm-shadow-s); padding: 16px; }
.iis-head { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }
.iis-ic { width: 28px; height: 28px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
.iis-ic.brand { background: var(--vm-g-brand); }
.iis-ic.teal { background: var(--vm-g-teal); }
.iis-ic.indigo { background: linear-gradient(135deg, #6366F1, #4F46E5); }
.iis-title { font-size: 13px; font-weight: 800; color: var(--vm-ink); }
.iis-body { font-size: 12px; color: var(--vm-ink-soft); line-height: 1.6; }
.iis-steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 9px; }
.iis-steps li { display: flex; align-items: flex-start; gap: 9px; font-size: 12px; color: var(--vm-ink-soft); line-height: 1.5; }
.iis-step-n { width: 18px; height: 18px; border-radius: 999px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: var(--vm-sky); background: rgba(46,144,250,.12); }
.iis-note { display: flex; align-items: flex-start; gap: 8px; font-size: 11.5px; color: var(--vm-ink-faint); line-height: 1.5; padding: 12px; border-radius: var(--vm-r); background: var(--vm-bg); border: 1px dashed var(--vm-line-2); }
.iis-note strong { color: var(--vm-ink-soft); }
</style>

