<template>
  <div class="page-loader" :style="minHeight ? { minHeight } : null" role="status" aria-live="polite">
    <span v-if="label" class="sr-only">{{ label }}</span>
    <div class="page-loader__toolbar">
      <span class="vm-skel page-loader__search"></span>
      <span class="vm-skel page-loader__filter"></span>
      <span class="vm-skel page-loader__filter short"></span>
    </div>
    <div class="page-loader__grid">
      <article v-for="item in 6" :key="item" class="page-loader__card">
        <div class="page-loader__top">
          <span class="vm-skel page-loader__avatar"></span>
          <span class="vm-skel page-loader__pill"></span>
        </div>
        <span class="vm-skel page-loader__line title"></span>
        <span class="vm-skel page-loader__line"></span>
        <span class="vm-skel page-loader__line wide"></span>
        <span class="vm-skel page-loader__line mid"></span>
        <div class="page-loader__foot">
          <span class="vm-skel"></span>
          <span class="vm-skel"></span>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: 'Loading...' },
  size: { type: String, default: '30px' },
  minHeight: { type: String, default: '240px' },
})
</script>

<style scoped>
.page-loader {
  width: 100%;
  padding: 22px 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.page-loader__toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.page-loader__search {
  width: min(420px, 52%);
  height: 40px;
  border-radius: 9px;
}

.page-loader__filter {
  width: 140px;
  height: 40px;
  border-radius: 9px;
}

.page-loader__filter.short {
  width: 110px;
}

.page-loader__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.page-loader__card {
  min-height: 238px;
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  background: #fff;
  padding: 22px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .035);
}

.page-loader__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page-loader__avatar {
  width: 54px;
  height: 54px;
  border-radius: 16px;
}

.page-loader__pill {
  width: 54px;
  height: 22px;
  border-radius: 999px;
}

.page-loader__line {
  display: block;
  width: 78%;
  height: 13px;
  margin-top: 12px;
}

.page-loader__line.title {
  width: 56%;
  height: 18px;
  margin-top: 18px;
}

.page-loader__line.wide {
  width: 100%;
}

.page-loader__line.mid {
  width: 88%;
  margin-top: 8px;
}

.page-loader__foot {
  display: flex;
  gap: 9px;
  margin-top: 20px;
}

.page-loader__foot span {
  flex: 1;
  height: 38px;
}

@media (max-width: 680px) {
  .page-loader__toolbar {
    flex-direction: column;
  }

  .page-loader__search,
  .page-loader__filter,
  .page-loader__filter.short {
    width: 100%;
  }
}
</style>
