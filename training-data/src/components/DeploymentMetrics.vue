<script setup>
defineProps({ items: { type: Array, default: () => [] }, loaded: Boolean });
</script>

<template>
  <dl class="deployment-metrics" aria-label="Summary">
    <div v-for="item in items" :key="item.label">
      <dt><component v-if="item.icon" :is="item.icon" :size="16" aria-hidden="true"/>{{ item.label }}</dt>
      <dd :class="{ 'metric-text': item.text }">{{ loaded ? item.value : '—' }}<span>{{ loaded ? item.hint : 'Unavailable' }}</span></dd>
    </div>
  </dl>
</template>

<style scoped>
.deployment-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:0 0 24px}.deployment-metrics>div{min-width:0;padding:19px 22px;background:#fff;border:1px solid #e3e8ef;border-radius:12px;box-shadow:0 2px 3px #182e4e03}.deployment-metrics dt{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:500;color:#617088}.deployment-metrics dt svg{color:#8491a4}.deployment-metrics dd{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px 12px;margin:10px 0 0;font-size:29px;font-weight:650;letter-spacing:-1px;line-height:1.3;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.deployment-metrics dd span{font-size:11px;color:#64748b;font-weight:400;letter-spacing:0}
.deployment-metrics dd.metric-text{font-size:23px;letter-spacing:-.5px}
@media(max-width:760px){.deployment-metrics{gap:8px}.deployment-metrics>div{padding:14px 12px}.deployment-metrics dt{font-size:10px}.deployment-metrics dt svg{display:none}.deployment-metrics dd{font-size:24px}.deployment-metrics dd span{flex-basis:100%;font-size:10px}}
</style>
