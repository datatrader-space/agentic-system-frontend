<template>
  <span class="dots" aria-label="Thinking">
    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
  </span>
</template>

<style scoped>
.dots { display: inline-flex; align-items: center; gap: 4px; padding: 4px 0; }
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vm-violet);
  animation: blink 1.2s infinite ease-in-out both;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-3px); }
}
</style>
