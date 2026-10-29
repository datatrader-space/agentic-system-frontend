<script setup>
// What a machine needs (machines.js MACHINE_NEEDS) and the hosts it must reach (machines.firewall_hosts), shown on the
// Your machines page and in the Edge Devices tab's first step, so both say the same thing.
import { Container, Globe, Microchip, MemoryStick, Cpu } from 'lucide-vue-next';
import { MACHINE_NEEDS } from '../api/machines.js';

defineProps({ hosts: { type: Array, default: null } });
const ICONS = { docker: Container, cpu: Cpu, memory: MemoryStick, gpu: Microchip };
</script>

<template>
  <ul class="needs">
    <li v-for="need in MACHINE_NEEDS" :key="need.id">
      <component :is="ICONS[need.id]" :size="18" aria-hidden="true"/>
      <div><strong>{{ need.title }}</strong><span>{{ need.text }}</span></div>
    </li>
    <li class="needs-network">
      <Globe :size="18" aria-hidden="true"/>
      <div>
        <strong>Outbound HTTPS only</strong>
        <span>Nothing to open inbound for AADML: the machine asks AADML for work, and AADML never connects to it. Allow port 443 out to<template v-if="hosts && hosts.length">:</template><template v-else> the hosts listed on Your machines.</template></span>
        <ul v-if="hosts && hosts.length" class="needs-hosts">
          <li v-for="h in hosts" :key="h.host"><code>{{ h.host }}</code> <span>{{ h.why }}</span></li>
        </ul>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.needs{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 24px}
.needs > li{display:flex;gap:12px;align-items:flex-start;min-width:0}
.needs > li > svg{color:var(--aadml-primary);margin-top:2px}
.needs strong{display:block;font-size:13px;font-weight:600;color:#0f172a}
.needs span{display:block;font-size:12.5px;line-height:1.55;color:#475569;margin-top:2px}
.needs-network{grid-column:1 / -1}
.needs-hosts{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px}
.needs-hosts li{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
.needs-hosts code{font-size:12px;color:#0f172a;background:#f1f4f8;border-radius:5px;padding:2px 6px;overflow-wrap:anywhere}
.needs-hosts span{display:inline;margin:0}
@media(max-width:640px){.needs{grid-template-columns:1fr}}
</style>
