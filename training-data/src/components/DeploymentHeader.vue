<script setup>
defineProps({ title: String, headingId: String, description: String, eyebrow: String, icon: [Object, Function] });
</script>

<template>
  <header class="deployment-header">
    <div class="deployment-header-copy">
      <span class="deployment-header-icon" aria-hidden="true"><component :is="icon" :size="23"/></span>
      <div><span class="deployment-eyebrow">{{ eyebrow }}</span><h2 :id="headingId">{{ title }}</h2><p>{{ description }}</p></div>
    </div>
    <div v-if="$slots.default" class="deployment-header-actions"><slot/></div>
  </header>
</template>

<style scoped>
.deployment-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:8px 0 24px}.deployment-header-copy{display:flex;align-items:center;gap:15px;min-width:0}.deployment-header-icon{display:grid;place-items:center;width:52px;height:52px;border-radius:14px;background:var(--aadml-tint);border:1px solid var(--aadml-outline);color:var(--aadml-primary);flex-shrink:0}.deployment-eyebrow{display:block;font-size:10px;font-weight:650;letter-spacing:1.5px;color:#68768c;margin-bottom:5px}.deployment-header h2{margin:0;font-size:25px;letter-spacing:-.7px;color:#17243b}.deployment-header p{font-size:13px;color:#64748b;margin:5px 0 0;max-width:65ch;line-height:1.65}.deployment-header-actions{flex-shrink:0}
@media(max-width:760px){.deployment-header{align-items:flex-start;flex-wrap:wrap;gap:15px}.deployment-header-icon{display:none}.deployment-eyebrow{font-size:9px}.deployment-header h2{font-size:23px}.deployment-header p{font-size:12px}}
</style>
