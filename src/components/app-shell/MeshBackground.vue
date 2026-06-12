<template>
  <!-- Global animated color-mesh canvas (Vibrant Light Mesh, power-up #1).
       Pure CSS, transform/opacity-only animation → GPU cheap; auto-disabled
       under prefers-reduced-motion via the shared media query in style.css. -->
  <div class="mesh" aria-hidden="true">
    <div class="blob b1"></div>
    <div class="blob b2"></div>
    <div class="blob b3"></div>
    <div class="blob b4"></div>
    <div class="grain"></div>
  </div>
</template>

<script setup>
// Presentational only — no state.
</script>

<style scoped>
.mesh {
  position: fixed;
  inset: 0;
  z-index: -1;            /* sit BEHIND all shell content (it's a child of .app-shell,
                             which is the stacking context). Without this, the positioned
                             mesh paints over static content like the Configure form. */
  overflow: hidden;
  pointer-events: none;
  background: var(--vm-bg);
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: .4;            /* subtle — enterprise, not candy */
  mix-blend-mode: multiply;
  will-change: transform;
}
/* Cool slate/blue + a hint of teal — barely-there professional tint. */
.b1 { width: 46vw; height: 46vw; left: -8vw; top: -10vw; background: radial-gradient(circle, #C7DBFF, transparent 70%); animation: vmDrift1 26s var(--vm-ease2) infinite; }
.b2 { width: 40vw; height: 40vw; right: -6vw; top: -8vw; background: radial-gradient(circle, #DBE4F0, transparent 70%); animation: vmDrift2 30s var(--vm-ease2) infinite; }
.b3 { width: 42vw; height: 42vw; left: 18vw; bottom: -16vw; background: radial-gradient(circle, #CDEFE9, transparent 70%); animation: vmDrift3 32s var(--vm-ease2) infinite; }
.b4 { width: 34vw; height: 34vw; right: 8vw; bottom: -12vw; background: radial-gradient(circle, #E2E8F0, transparent 70%); animation: vmDrift4 28s var(--vm-ease2) infinite; }
.grain {
  position: absolute;
  inset: 0;
  opacity: .025;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
</style>
